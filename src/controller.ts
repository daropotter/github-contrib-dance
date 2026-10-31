import { type Calendar, type Tile, levelVar } from './calendar';
import { BeatClock } from './clock';
import { type Lab, clamp, ease, lerp, mixCss, mod, polar, rgbToOklab, safeRgb } from './color';
import type { CalendarInfo } from './messages';
import { refMax } from './scale';
import type { Choreo, Settings } from './settings';

const FADE_MS = 600;
/** A dancer fades its move out/in over this long when it joins, leaves or changes move. */
const MOVE_FADE_MS = 420;
/** Max OKLab-L change per second for any tile: no hard luminance edges (photosensitivity). */
const SLEW = 3;
/** Time constant for the displayed highlight reference, so a reset or a synced change never jumps in one frame. */
const R_TAU_S = 0.15;

type Move = 'pulse' | 'sway' | 'shimmy' | 'bounce' | 'robot' | 'conga' | 'wave' | 'jump' | 'spin' | 'flip';
const MOVE_BEATS: Record<Move, number> = { pulse: 1, sway: 2, shimmy: 1, bounce: 1, robot: 4, conga: 4, wave: 4, jump: 2, spin: 4, flip: 2 };
const VOCAB: Move[] = ['pulse', 'sway', 'shimmy', 'bounce', 'robot', 'conga', 'jump', 'spin', 'flip'];
const TIER: Record<Move, number> = { pulse: 0, sway: 0, shimmy: 0, wave: 0, bounce: 1, robot: 1, conga: 1, jump: 2, spin: 2, flip: 2 };
const CALMER: Partial<Record<Move, Move>> = { jump: 'bounce', spin: 'robot', flip: 'conga', bounce: 'pulse', robot: 'sway', conga: 'shimmy' };
const AUTO_SEQ: Choreo[] = ['wave', 'chorus', 'call', 'free'];
const AUTO_BEATS = 32;
/** Dance wildness comes from tile brightness. */
const tierOf = (v: number) => (v > 0.67 ? 2 : v >= 0.34 ? 1 : 0);

const PALETTE = [330, 200, 100, 150, 270]; // OKLCH hues: pink, cyan, yellow, green, violet (no red)
const SPOTS = Array.from({ length: 8 }, (_, k) => {
  const [ux, uy] = polar(1, PALETTE[k % 5]!);
  return { u: (k * 0.618034) % 1, y: ((k * 2.718) % 7) - 0.5, spd: 1 / (12 + (k % 3) * 6), ux, uy };
});
/** Beam hues all keep R/(R+G+B) < 0.7, and they are composited normally, so the red guard survives the overlay. */
const BEAM_HUES = [195, 320, 50];
const BEAM_EDGES = [0.05, 0.09, 0.13];         // stacked wedges = feathered edges instead of a hard sweep line
const GREEN = polar(1, 150);
/** GitHub's default light palette (OKLab), used only if the theme's colors cannot be read. */
const FALLBACK_PALETTE: Lab[] = (['#eff2f5', '#aceebb', '#4ac26b', '#2da44e', '#116329'] as const).map(hex =>
  rgbToOklab(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)));

type Fade = 'hl' | 'disco' | 'rain' | 'ball' | 'beams' | 'glow' | 'dark';
const FADES: Fade[] = ['hl', 'disco', 'rain', 'ball', 'beams', 'glow', 'dark'];
const CD_CLASSES = ['cd-on', 'cd-club', 'cd-disco'];

interface TileState extends Tile {
  rank: number;
  /** current move (null = not dancing), its phase in beats and duration */
  move: Move | null;
  phase: number;
  dur: number;
  /** move class currently on the element */
  cls: string | null;
  leave: number;
  swapping: boolean;
  next: { m: Move; phase: number } | null;
  amp: string;
  col: string;
  g: string;
  L: number | null;
}

function hash01(str: string, salt = 0) {
  let h = (0x811c9dc5 ^ salt) >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const doubleRaf = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn));

/**
 * Owns one contribution calendar: highlight colors, dancers, disco lights, and putting the page back.
 * GitHub's own properties are only overridden from the stylesheet under .cd-on; inline we write nothing but
 * our --cd-* custom properties, so removing the class (or the stylesheet, when the extension is disabled) restores the page.
 */
export class CalendarController {
  private s: Settings;
  private readonly tiles: TileState[];
  private readonly k = {} as Record<Fade, number>;
  private readonly target = {} as Record<Fade, number>;
  /** displayed ln(R), eased toward the setting */
  private lr: number;
  private mounted = false;
  private readonly rootHadStyle: boolean;
  private readonly scrollerHadClass: boolean;
  private legendCol: string[] = [];
  private hot = '';
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private ball: HTMLElement | null = null;
  private dark = false;
  /** The theme's own level colors 0..4 in OKLab (holiday palettes included): the base the disco lights start from. */
  private palette: Lab[] = FALLBACK_PALETTE;
  /** Unit (a, b) direction of the palette's most colorful level, for tiles whose own level is near-neutral. */
  private paletteHue: [number, number] = GREEN;
  private visible = true;
  private raf = 0;
  private lastT = 0;
  private danceOffTimer = 0;
  private danceRefreshTimer = 0;
  private autoTimer = 0;
  private lastChoreo: Choreo | null = null;
  private readonly io: IntersectionObserver;
  private readonly ro: ResizeObserver;
  private readonly themeObs: MutationObserver;
  private readonly schemeMq = matchMedia('(prefers-color-scheme: dark)');

  constructor(private readonly cal: Calendar, settings: Settings, private readonly clock: BeatClock) {
    this.s = settings;
    this.scrubLeftovers();
    this.rootHadStyle = !!cal.root.getAttribute('style');
    this.scrollerHadClass = !!cal.scroller?.getAttribute('class');
    const order = cal.tiles.map((_, i) => i).filter(i => cal.tiles[i]!.count > 0)
      .sort((a, b) => cal.tiles[b]!.count - cal.tiles[a]!.count || hash01(cal.tiles[a]!.date, 11) - hash01(cal.tiles[b]!.date, 11));
    const rank: number[] = [];
    order.forEach((idx, r) => (rank[idx] = r));
    this.tiles = cal.tiles.map((t, i) => ({
      ...t, rank: rank[i] ?? Infinity, move: null, phase: 0, dur: 0, cls: null, leave: 0, swapping: false, next: null, amp: '', col: '', g: '', L: null,
    }));

    this.dark = this.detectDark();
    this.readPalette();
    this.retarget();
    for (const f of FADES) this.k[f] = this.target[f];  // first paint has no fade-in from GitHub's look...
    this.k.hl = 0;                                      // ...except the highlight, which eases in from the original
    this.lr = Math.log(this.targetR());

    this.io = new IntersectionObserver(entries => {
      this.visible = entries[entries.length - 1]!.isIntersecting;
      if (this.visible) this.kick();
    });
    this.io.observe(cal.root);
    this.ro = new ResizeObserver(() => { this.sizeCanvas(); this.updateScroller(); });
    this.themeObs = new MutationObserver(() => this.onTheme());
    this.themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-mode', 'data-light-theme', 'data-dark-theme'] });
    this.schemeMq.addEventListener('change', this.onTheme);

    this.update(settings);
  }

  /** True once GitHub has replaced the calendar's contents (year switch, org filter). */
  isStale() { return !this.cal.root.isConnected || !this.cal.table.isConnected; }

  info(): CalendarInfo {
    const c = this.cal;
    return { found: true, r0: c.r0, maxDay: c.maxDay, activeDays: c.activeDays, total: c.total, countsParsed: c.countsParsed };
  }

  update(settings: Settings) {
    this.s = settings;
    const bpmChanged = this.clock.setBpm(settings.bpm);
    this.retarget();
    if (this.anyOn()) this.mount();
    if (!this.mounted) return;
    this.cal.root.style.setProperty('--cd-bar', `${this.clock.beatMs() * 4}ms`);
    this.applyDance();
    this.syncDiscoDom();
    if (bpmChanged) this.pinBall();
    this.scheduleAuto();
    this.kick();
  }

  /** Immediate teardown (no fades): page unload into Turbo's cache, or the extension going away. */
  destroy() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.danceOffTimer); clearTimeout(this.danceRefreshTimer); clearTimeout(this.autoTimer);
    this.io.disconnect(); this.ro.disconnect(); this.themeObs.disconnect();
    this.schemeMq.removeEventListener('change', this.onTheme);
    this.unmount();
  }

  // ---------- state ----------

  private anyOn() { const s = this.s; return s.highlight.on || s.dance.on || s.disco.on; }

  private retarget() {
    const s = this.s, t = this.target;
    t.hl = s.highlight.on ? 1 : 0;
    t.glow = s.highlight.glow ? 1 : 0;
    t.disco = s.disco.on ? 1 : 0;
    t.rain = s.disco.rainbow ? 1 : 0;
    t.ball = s.disco.ball ? 1 : 0;
    t.beams = s.disco.beams ? 1 : 0;
    t.dark = (s.disco.on && s.disco.club) || this.dark ? 1 : 0;
  }

  private targetR() { return this.s.highlight.max === null ? this.cal.r0 : refMax(this.s.highlight.max); }
  private R() { return Math.exp(this.lr); }

  /** Brightness 0..1 used by the dance and the lights: GitHub's scale blended toward ours as the highlight fades in. */
  private intensity(t: Tile) {
    if (!t.count) return 0;
    return lerp(Math.min(1, t.count / this.cal.r0), Math.min(1, t.count / this.R()), ease(this.k.hl));
  }

  private detectDark() {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;width:0;height:0;background-color:var(--contribution-default-bgColor-0)';
    document.body.appendChild(probe);
    const m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/.exec(getComputedStyle(probe).backgroundColor);
    probe.remove();
    if (!m) return this.schemeMq.matches;
    const [r, g, b] = [m[1], m[2], m[3]].map(Number) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
  }

  /** Reads the level colors GitHub is showing right now (theme, colorblind mode, holiday) for the disco base and glow. */
  private readPalette() {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none';
    this.cal.root.appendChild(probe);
    const read: Lab[] = [];
    for (let level = 0; level <= 4; level++) {
      probe.style.backgroundColor = '';
      probe.style.backgroundColor = levelVar(this.cal.holiday, level);
      const m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/.exec(getComputedStyle(probe).backgroundColor);
      if (!m) break;
      read.push(rgbToOklab(Number(m[1]), Number(m[2]), Number(m[3])));
    }
    probe.remove();
    this.palette = read.length === 5 ? read : FALLBACK_PALETTE;
    let best = 0;
    for (const [, a, b] of this.palette.slice(1)) {
      const c = Math.hypot(a, b);
      if (c > best) { best = c; this.paletteHue = [a / c, b / c]; }
    }
    if (best < 0.02) this.paletteHue = GREEN;
  }

  /** Palette color at position x (0..4), interpolated in OKLab like the highlight gradient. */
  private paletteAt(x: number): Lab {
    const i = Math.min(3, Math.max(0, Math.floor(x))), f = clamp(x - i, 0, 1);
    const p = this.palette[i]!, q = this.palette[i + 1]!;
    return [lerp(p[0], q[0], f), lerp(p[1], q[1], f), lerp(p[2], q[2], f)];
  }

  private onTheme = () => {
    this.dark = this.detectDark();
    this.readPalette();                              // also catches palette-only switches (colorblind themes)
    this.hot = '';
    this.retarget();
    if (this.mounted) { this.syncDiscoDom(); this.kick(); }
  };

  // ---------- mounting ----------

  /** A Turbo snapshot or a disabled/updated extension can leave our classes and nodes behind; start from GitHub's page. */
  private scrubLeftovers() {
    const { root, scroller, tiles, legend } = this.cal;
    root.querySelectorAll('.cd-beams, .cd-ball').forEach(n => n.remove());
    scroller?.classList.remove('cd-scroll-visible', 'cd-scroll-pad');
    const strip = (el: HTMLElement) => {
      for (const p of Array.from(el.style)) if (p.startsWith('--cd-')) el.style.removeProperty(p);
      for (const c of Array.from(el.classList)) if (c.startsWith('cd-')) el.classList.remove(c);
    };
    strip(root);
    tiles.forEach(t => strip(t.el));
    legend.forEach(strip);
    if (root.getAttribute('style') === '') root.removeAttribute('style');
  }

  private mount() {
    if (this.mounted) return;
    this.mounted = true;
    const root = this.cal.root;
    root.style.setProperty('--cd-dk', this.s.dance.on ? '1' : '0');
    root.style.setProperty('--cd-bar', `${this.clock.beatMs() * 4}ms`);
    root.classList.add('cd-on');
    this.updateScroller();
    this.legendCol = [];
    this.hot = '';
    this.render(BeatClock.now(), 0);
    this.ro.observe(root);
  }

  private unmount() {
    if (!this.mounted) return;
    this.mounted = false;
    cancelAnimationFrame(this.raf); this.raf = 0; this.lastT = 0;
    this.ro.unobserve(this.cal.root);
    this.clearDancers();
    for (const t of this.tiles) {
      for (const p of ['--cd-fill', '--cd-g', '--cd-j', '--cd-amp', '--cd-dur']) t.el.style.removeProperty(p);
      t.col = ''; t.g = ''; t.amp = ''; t.L = null;
    }
    this.cal.legend.forEach(el => el.style.removeProperty('--cd-fill'));
    this.removeCanvas();
    this.removeBall();
    const root = this.cal.root;
    root.classList.remove(...CD_CLASSES);
    const sc = this.cal.scroller;
    sc?.classList.remove('cd-scroll-visible', 'cd-scroll-pad');
    if (sc && !this.scrollerHadClass && sc.getAttribute('class') === '') sc.removeAttribute('class');
    for (const p of ['--cd-dk', '--cd-bar', '--cd-hot']) root.style.removeProperty(p);
    if (!this.rootHadStyle && root.getAttribute('style') === '') root.removeAttribute('style');
  }

  /** Puts the page back once everything is off and every fade has finished. */
  private maybeUnmount() {
    if (this.anyOn() || this.k.hl > 0 || this.k.disco > 0 || this.tiles.some(t => t.move)) return;
    this.unmount();
  }

  /**
   * Dancers must not be clipped by GitHub's overflow containers. If the calendar fits, its scroller can show overflow;
   * if it has to scroll (narrow window), it keeps scrolling and gets vertical padding for the jumps instead.
   */
  private updateScroller() {
    const sc = this.cal.scroller;
    if (!sc || !this.mounted) return;
    const needsScroll = this.cal.table.offsetWidth > sc.clientWidth + 1;
    sc.classList.toggle('cd-scroll-visible', !needsScroll);
    sc.classList.toggle('cd-scroll-pad', needsScroll);
  }

  // ---------- render loop ----------

  private kick() {
    if (!this.raf && this.mounted && this.visible) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = this.lastT ? Math.min(0.1, (now - this.lastT) / 1000) : 0;
    this.lastT = now;
    let moving = false;
    const step = (dt * 1000) / FADE_MS;
    for (const f of FADES) {
      const d = this.target[f] - this.k[f];
      if (d) { this.k[f] += clamp(d, -step, step); moving = true; }
    }
    const dr = Math.log(this.targetR()) - this.lr;
    if (Math.abs(dr) > 1e-3) { this.lr += dr * Math.min(1, dt / R_TAU_S); moving = true; }
    else this.lr += dr;
    if (moving) this.refreshDanceSoon();      // amplitudes and moves follow the brightness while it changes
    // Tiles still slewing toward a new lightness (e.g. after a theme change) keep the loop running.
    if (this.render(BeatClock.now(), dt)) moving = true;
    this.cleanupFaded();
    const animated = this.k.disco > 0 && this.k.rain + this.k.ball + this.k.beams > 0;
    if ((moving || animated) && this.visible) this.raf = requestAnimationFrame(this.frame);
    else if (!moving && !animated) { this.lastT = 0; this.maybeUnmount(); }
    else this.lastT = 0;                      // off-screen: resume from a fresh dt when visible again
  };

  /** Draws one frame; returns true while any disco tile is still slewing toward its target lightness. */
  private render(now: number, dt: number): boolean {
    if (!this.mounted) return false;
    let slewing = false;
    const k = this.k, kh = ease(k.hl), kd = ease(k.disco), kg = ease(k.glow);
    const R = this.R(), hol = this.cal.holiday;
    const b = this.clock.beat(now), slew = SLEW * dt;

    const [ha, hb] = this.paletteHue;          // glow in the palette's own color: lighter on dark, richer on light
    const hot = mixCss(safeRgb(0.92, ha * 0.09, hb * 0.09), safeRgb(0.74, ha * 0.2, hb * 0.2), ease(k.dark));
    if (hot !== this.hot) this.cal.root.style.setProperty('--cd-hot', (this.hot = hot));

    for (const t of this.tiles) {
      let col: string;
      if (!t.count) col = levelVar(hol, 0);
      else col = mixCss(this.smooth(t.count / R), levelVar(hol, t.level), kh);
      if (kd > 0.001) {
        const sh = this.shade(t, b, this.intensity(t));
        // Only a tile with no lightness yet starts at its target; otherwise even a first frame (dt = 0) is slew-limited.
        t.L = t.L === null ? sh.L : t.L + clamp(sh.L - t.L, -slew, slew);
        if (Math.abs(sh.L - t.L) > 1e-3) slewing = true;
        col = mixCss(safeRgb(t.L, sh.A, sh.B), col, kd);
      } else t.L = null;
      if (col !== t.col) t.el.style.setProperty('--cd-fill', (t.col = col));
      // Glow: days above the chosen max, ln-scaled so a day eight times the max glows fully.
      const g = t.count > R ? (ease(clamp(Math.log2(t.count / R) / 3, 0, 1)) * kh * kg).toFixed(2) : '0';
      if (g !== t.g) t.el.style.setProperty('--cd-g', (t.g = g));
    }
    this.cal.legend.forEach((el, i) => {
      const level = Number(el.dataset.level) || 0;
      const col = level ? mixCss(this.smooth((level - 0.5) / 4), levelVar(hol, level), kh) : levelVar(hol, 0);
      if (col !== this.legendCol[i]) el.style.setProperty('--cd-fill', (this.legendCol[i] = col));
    });
    if (this.ctx) this.drawBeams(b);
    return slewing;
  }

  /** Continuous color for brightness t, interpolated in OKLab between the theme's own level colors. */
  private smooth(t: number) {
    const x = clamp(4 * t + 0.5, 0.4, 4);           // band centres equal GitHub's levels; dim days keep a floor
    const i = Math.min(3, Math.floor(x));
    return mixCss(levelVar(this.cal.holiday, i + 1), levelVar(this.cal.holiday, i), x - i);
  }

  // ---------- dance ----------

  private choreoNow(): Choreo {
    const c = this.s.dance.choreo;
    return c === 'auto' ? AUTO_SEQ[Math.floor(this.clock.beat() / AUTO_BEATS) % AUTO_SEQ.length]! : c;
  }

  private moveFor(t: TileState, tier: number, choreo: Choreo): { m: Move; phase: number } {
    const W = this.cal.weeks;
    switch (choreo) {
      case 'wave': return { m: 'wave', phase: (4 * t.w) / W + 0.1 * t.d };
      case 'chorus': return { m: 'jump', phase: 0.25 * t.d };
      case 'call': return { m: 'wave', phase: 2 * (t.w % 2) + 0.05 * t.d };
    }
    let m = VOCAB[Math.floor(hash01(t.date, 23) * VOCAB.length)]!;
    while (TIER[m] > tier) m = CALMER[m]!;           // dim tiles fall back to a calmer relative of their move
    return { m, phase: Math.floor(hash01(t.date, 37) * 4) * 0.5 };
  }

  private applyDance() {
    const root = this.cal.root;
    if (!this.s.dance.on) {
      root.style.setProperty('--cd-dk', '0');      // fade every move out, then stop the animations
      clearTimeout(this.danceOffTimer);
      this.danceOffTimer = window.setTimeout(() => {
        if (this.s.dance.on) return;
        this.clearDancers();
        this.maybeUnmount();
      }, FADE_MS + 60);
      return;
    }
    clearTimeout(this.danceOffTimer);
    const still = !this.tiles.some(t => t.move);
    if (still) root.style.setProperty('--cd-dk', '0');

    const count = Math.round((this.cal.activeDays * this.s.dance.dancers) / 1000);
    const choreo = (this.lastChoreo = this.choreoNow()), bm = this.clock.beatMs();
    const restart: TileState[] = [], fadeIn: TileState[] = [], swaps: TileState[] = [];
    for (const t of this.tiles) {
      const el = t.el;
      if (t.count <= 0 || t.rank >= count) { this.leave(t); continue; }
      if (t.leave) { clearTimeout(t.leave); t.leave = 0; if (!t.swapping) el.style.setProperty('--cd-j', '1'); }
      const v = this.intensity(t);
      const amp = String(Math.round(20 * (0.35 + 0.65 * v)) / 20);
      if (amp !== t.amp) el.style.setProperty('--cd-amp', (t.amp = amp));
      const { m, phase } = this.moveFor(t, tierOf(v), choreo);
      const dur = bm * MOVE_BEATS[m];
      if (!t.move) {                                 // joining
        t.move = m; t.phase = phase; t.dur = dur;
        el.style.setProperty('--cd-dur', `${dur}ms`);
        el.style.setProperty('--cd-j', still ? '1' : '0');
        restart.push(t);
        if (!still) fadeIn.push(t);
        continue;
      }
      if (t.swapping) { t.next = { m, phase }; continue; }
      if (t.move === m && t.phase === phase) {
        // Tempo change only: restarting at the pinned position keeps the same point in the cycle, so no jump.
        if (t.dur !== dur) { t.dur = dur; el.style.setProperty('--cd-dur', `${dur}ms`); restart.push(t); }
        continue;
      }
      // A different move or phase: fade this one out, swap while still, fade the new one in. Never cut mid-move.
      t.swapping = true; t.next = { m, phase };
      el.style.setProperty('--cd-j', '0');
      swaps.push(t);
    }
    this.restartPinned(restart, fadeIn);
    if (swaps.length) window.setTimeout(() => this.finishSwaps(swaps), MOVE_FADE_MS);
    if (still) doubleRaf(() => { if (this.mounted && this.s.dance.on) root.style.setProperty('--cd-dk', '1'); });
    else root.style.setProperty('--cd-dk', '1');
  }

  private leave(t: TileState) {
    if (!t.move || t.leave) return;
    t.el.style.setProperty('--cd-j', '0');
    t.leave = window.setTimeout(() => {
      if (t.cls) t.el.classList.remove('cd-dance', t.cls);
      t.cls = null; t.move = null; t.leave = 0; t.swapping = false; t.next = null;
      this.maybeUnmount();
    }, MOVE_FADE_MS);
  }

  private finishSwaps(list: TileState[], tries = 0) {
    if (!this.mounted || !this.s.dance.on) { list.forEach(t => (t.swapping = false)); return; }
    // Swap only once the old move has really faded out (a late transition start must not show as a jump).
    const dk = parseFloat(getComputedStyle(this.cal.root).getPropertyValue('--cd-dk')) || 0;
    const live = list.filter(t => t.swapping && t.move && !t.leave && t.next);
    const waiting = tries < 15 ? live.filter(t => (parseFloat(getComputedStyle(t.el).getPropertyValue('--cd-j')) || 0) * dk > 0.03) : [];
    const ready = live.filter(t => !waiting.includes(t));
    list.forEach(t => { if (!waiting.includes(t)) t.swapping = false; });
    if (waiting.length) window.setTimeout(() => this.finishSwaps(waiting, tries + 1), 60);
    const bm = this.clock.beatMs();
    for (const t of ready) {
      t.move = t.next!.m; t.phase = t.next!.phase; t.dur = bm * MOVE_BEATS[t.move]; t.next = null;
      t.el.style.setProperty('--cd-dur', `${t.dur}ms`);
    }
    this.restartPinned(ready, ready);
  }

  /** (Re)starts moves pinned to the shared clock: startTime = beat zero + the tile's phase. */
  private restartPinned(list: TileState[], fadeIn: TileState[]) {
    if (!list.length) return;
    for (const t of list) if (t.cls) t.el.classList.remove(t.cls);
    void this.cal.table.offsetWidth;                 // flush removals so re-added moves start fresh
    const bm = this.clock.beatMs();
    for (const t of list) { t.cls = `cd-m-${t.move}`; t.el.classList.add('cd-dance', t.cls); }
    for (const t of list) {
      const a = t.el.getAnimations({ subtree: true }).find(x => (x as CSSAnimation).animationName === `cd-${t.move}`);
      if (a) a.startTime = this.clock.t0 + t.phase * bm;
    }
    if (fadeIn.length) doubleRaf(() => {
      if (!this.mounted || !this.s.dance.on) return;
      for (const t of fadeIn) if (t.move && !t.leave && !t.swapping) t.el.style.setProperty('--cd-j', '1');
    });
  }

  private refreshDanceSoon() {
    if (this.danceRefreshTimer || !this.s.dance.on) return;
    this.danceRefreshTimer = window.setTimeout(() => { this.danceRefreshTimer = 0; if (this.mounted) this.applyDance(); }, 120);
  }

  private clearDancers() {
    for (const t of this.tiles) {
      if (t.leave) { clearTimeout(t.leave); t.leave = 0; }
      if (t.cls) t.el.classList.remove('cd-dance', t.cls);
      t.cls = null; t.move = null; t.swapping = false; t.next = null;
    }
  }

  /** The "auto" choreography switches routine every 32 beats. */
  private scheduleAuto() {
    clearTimeout(this.autoTimer);
    if (!this.s.dance.on || this.s.dance.choreo !== 'auto') return;
    const b = this.clock.beat(), next = (Math.floor(b / AUTO_BEATS) + 1) * AUTO_BEATS;
    this.autoTimer = window.setTimeout(() => {
      if (this.mounted && this.choreoNow() !== this.lastChoreo) this.applyDance();
      this.scheduleAuto();
    }, (next - b) * this.clock.beatMs() + 5);
  }

  // ---------- disco ----------

  private syncDiscoDom() {
    const s = this.s.disco, root = this.cal.root;
    root.classList.toggle('cd-disco', s.on);
    root.classList.toggle('cd-club', s.on && s.club);
    if (s.on && s.beams && !this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'cd-beams';
      this.canvas.setAttribute('aria-hidden', 'true');
      this.canvas.setAttribute('data-turbo-temporary', '');
      root.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.sizeCanvas();
    }
    const ballOn = s.on && s.ball;
    if (ballOn && !this.ball) {
      this.ball = document.createElement('div');
      this.ball.className = 'cd-ball';
      this.ball.setAttribute('aria-hidden', 'true');
      this.ball.setAttribute('data-turbo-temporary', '');
      root.appendChild(this.ball);
      this.pinBall();
      const ball = this.ball;
      doubleRaf(() => { if (this.ball === ball && this.s.disco.on && this.s.disco.ball) ball.classList.add('cd-ball-on'); });
    } else this.ball?.classList.toggle('cd-ball-on', ballOn);
  }

  /** Drop the ball and the beam canvas once they have faded out, so nothing animates invisibly. */
  private cleanupFaded() {
    if (this.ball && !(this.s.disco.on && this.s.disco.ball) && this.k.disco * this.k.ball === 0) this.removeBall();
    if (this.canvas && !(this.s.disco.on && this.s.disco.beams) && this.k.disco * this.k.beams === 0) this.removeCanvas();
  }

  private removeBall() { this.ball?.remove(); this.ball = null; }
  private removeCanvas() { this.canvas?.remove(); this.canvas = null; this.ctx = null; }

  /** The ball's facet scroll is a 4-beat loop on the shared clock, so a tempo change does not make it jump. */
  private pinBall() {
    const a = this.ball?.getAnimations().find(x => (x as CSSAnimation).animationName === 'cd-ballspin');
    if (a) a.startTime = this.clock.t0;
  }

  private sizeCanvas() {
    if (!this.canvas || !this.ctx) return;
    const r = this.cal.root.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * Per-tile light in OKLab. The base is the theme's own palette at the tile's brightness (the same color the
   * highlight shows), so Halloween, winter, colorblind and dark palettes stay themselves until a layer recolors
   * them. Layers move the (a, b) color vector; vectors blend continuously, so fades and crossing spots never flip a hue.
   */
  private shade(t: Tile, b: number, v: number) {
    const k = this.k, kd = ease(k.dark), kr = ease(k.rain), kb = ease(k.ball), sgn = lerp(-1, 1, kd), active = t.count > 0;
    let [L, A, B] = this.paletteAt(active ? clamp(4 * v + 0.5, 0.4, 4) : 0);
    const C0 = active ? 0.035 + 0.13 * v : 0.02;
    // Club backdrop over a light theme: the palette is drawn for a white page (more = darker), so lightness is
    // re-mapped to "more = brighter" while the hue stays the palette's. Near-neutral levels (Halloween's black
    // top level) get only the missing chroma added along the palette's main hue, which is zero at C == C0, so a
    // tile whose brightness crosses that point never snaps hue.
    const club = this.dark ? 0 : kd;
    if (club > 0) {
      L = lerp(L, active ? 0.27 + 0.56 * v : 0.22, club);
      const miss = active ? Math.max(0, C0 - Math.hypot(A, B)) * club : 0;
      A += this.paletteHue[0] * miss; B += this.paletteHue[1] * miss;
    }
    if (kr > 0) {                                     // rainbow: hue flows diagonally across the year
      const [ra, rb] = polar(Math.max(C0, Math.hypot(A, B)) + 0.04, 150 + t.w * 7 + t.d * 13 + mod(b * 30, 360));
      A = lerp(A, ra, kr); B = lerp(B, rb, kr);
    }
    if (kb > 0) {                                     // mirror-ball spots drifting left to right
      let lit = 0, sa = 0, sb = 0;
      for (const s of SPOTS) {
        const dx = t.w - (mod(s.u + b * s.spd, 1) * (this.cal.weeks + 6) - 3), dy = t.d - s.y;
        const a = Math.exp(-(dx * dx + dy * dy) / 2.2);
        lit += a; sa += a * s.ux; sb += a * s.uy;
      }
      const mag = Math.hypot(sa, sb), litC = Math.min(1, lit);
      L += sgn * 0.3 * litC * kb;
      if (mag > 1e-6) {
        const w = Math.min(1, mag * 1.3) * kb, Cs = 0.06 + 0.1 * litC;
        A = lerp(A, (Cs * sa) / mag, w); B = lerp(B, (Cs * sb) / mag, w);
      }
    }
    const sat = 0.05 + 1.35 * (this.s.disco.saturation / 1000);   // the slider is saturation only
    A *= sat; B *= sat;
    const C = Math.hypot(A, B);
    if (C > 0.22) { A *= 0.22 / C; B *= 0.22 / C; }
    return { L: clamp(L, 0.18, 0.97), A, B };
  }

  private drawBeams(b: number) {
    const ctx = this.ctx!, c = this.canvas!, dpr = Math.min(2, devicePixelRatio || 1);
    const w = c.width / dpr, hgt = c.height / dpr;
    ctx.clearRect(0, 0, w, hgt);
    const kk = ease(this.k.beams) * ease(this.k.disco);
    if (kk < 0.005) return;
    // Normal compositing (no blend-mode switch); color and strength follow the faded dark/light value.
    const kd = ease(this.k.dark), sat = Math.round(this.s.disco.saturation / 10), light = lerp(45, 62, kd);
    const alpha = (lerp(0.24, 0.4, kd) * kk) / BEAM_EDGES.length;
    const len = Math.hypot(w, hgt) * 1.3;
    BEAM_HUES.forEach((hue, j) => {
      const ox = w * (0.18 + 0.32 * j), oy = -6;
      const ang = Math.PI / 2 + 0.66 * Math.sin((2 * Math.PI * b) / 16 + j * 2.1);
      for (const spread of BEAM_EDGES) {
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, len);
        g.addColorStop(0, `hsla(${hue},${sat}%,${light}%,${alpha})`);
        g.addColorStop(1, `hsla(${hue},${sat}%,${light}%,0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(ang - spread) * len, oy + Math.sin(ang - spread) * len);
        ctx.lineTo(ox + Math.cos(ang + spread) * len, oy + Math.sin(ang + spread) * len);
        ctx.closePath();
        ctx.fill();
      }
    });
  }
}
