import { browser } from 'wxt/browser';

export type Choreo = 'free' | 'wave' | 'chorus' | 'call' | 'auto';

export interface Settings {
  highlight: {
    on: boolean;
    /** Slider position 0..1000 (log scale, right = brighter). null = the profile's own reference (GitHub's look). */
    max: number | null;
    glow: boolean;
  };
  dance: { on: boolean; dancers: number; choreo: Choreo };
  disco: { on: boolean; saturation: number; rainbow: boolean; ball: boolean; beams: boolean; club: boolean };
  bpm: number;
}

export const DEFAULTS: Settings = {
  highlight: { on: true, max: null, glow: true },
  dance: { on: false, dancers: 350, choreo: 'free' },
  disco: { on: false, saturation: 700, rainbow: true, ball: true, beams: true, club: true },
  bpm: 120,
};

export const BPM_MIN = 60;
export const BPM_MAX = 150;
const KEY = 'settings';
const CHOREOS: Choreo[] = ['free', 'wave', 'chorus', 'call', 'auto'];

const clampInt = (v: unknown, lo: number, hi: number, dflt: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(hi, Math.max(lo, v))) : dflt;
const bool = (v: unknown, dflt: boolean) => (typeof v === 'boolean' ? v : dflt);

/** Fills missing or invalid fields from DEFAULTS, so older or hand-edited data never breaks the page. */
export function normalize(raw: unknown): Settings {
  const r = (raw ?? {}) as Partial<Record<keyof Settings, any>>;
  const h = r.highlight ?? {}, d = r.dance ?? {}, s = r.disco ?? {};
  return {
    highlight: {
      on: bool(h.on, DEFAULTS.highlight.on),
      max: h.max === null || h.max === undefined ? null : clampInt(h.max, 0, 1000, 500),
      glow: bool(h.glow, DEFAULTS.highlight.glow),
    },
    dance: {
      on: bool(d.on, DEFAULTS.dance.on),
      dancers: clampInt(d.dancers, 0, 1000, DEFAULTS.dance.dancers),
      choreo: CHOREOS.includes(d.choreo) ? d.choreo : DEFAULTS.dance.choreo,
    },
    disco: {
      on: bool(s.on, DEFAULTS.disco.on),
      saturation: clampInt(s.saturation, 0, 1000, DEFAULTS.disco.saturation),
      rainbow: bool(s.rainbow, DEFAULTS.disco.rainbow),
      ball: bool(s.ball, DEFAULTS.disco.ball),
      beams: bool(s.beams, DEFAULTS.disco.beams),
      club: bool(s.club, DEFAULTS.disco.club),
    },
    bpm: clampInt(r.bpm, BPM_MIN, BPM_MAX, DEFAULTS.bpm),
  };
}

export async function loadSettings(): Promise<Settings> {
  try {
    const got = await browser.storage.sync.get(KEY);
    return normalize(got[KEY]);
  } catch {
    return normalize(undefined);
  }
}

export function saveSettings(s: Settings): Promise<void> {
  return browser.storage.sync.set({ [KEY]: s });
}

/**
 * Settings sync across devices, so dance or disco switched on elsewhere must not start by itself where the OS asks
 * for reduced motion. This per-device flag is set when the user turns them on from the popup on this device.
 */
const MOTION_KEY = 'motionOk';

export async function loadMotionOk(): Promise<boolean> {
  try { return (await browser.storage.local.get(MOTION_KEY))[MOTION_KEY] === true; } catch { return false; }
}

export function setMotionOk(): Promise<void> {
  return browser.storage.local.set({ [MOTION_KEY]: true });
}

export function onMotionOkChanged(cb: (ok: boolean) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'local' && MOTION_KEY in changes) cb(changes[MOTION_KEY]!.newValue === true);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/** What actually runs on this device: without the opt-in, reduced motion keeps dance and disco off. */
export function effective(s: Settings, reducedMotion: boolean, motionOk: boolean): Settings {
  if (!reducedMotion || motionOk) return s;
  return { ...s, dance: { ...s.dance, on: false }, disco: { ...s.disco, on: false } };
}

export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'sync' && KEY in changes) cb(normalize(changes[KEY]!.newValue));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
