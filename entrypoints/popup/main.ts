import { browser } from 'wxt/browser';
import type { CalendarInfo, Request } from '@/src/messages';
import { posOf, refMax } from '@/src/scale';
import { type Choreo, type Settings, BPM_MAX, BPM_MIN, loadSettings, saveSettings, setMotionOk } from '@/src/settings';

const $ = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;
const fmt = (n: number) => (n >= 10 ? Math.round(n).toLocaleString('en-US') : n.toFixed(1));
const contributions = (n: number) => `${fmt(n)} ${Math.round(n) === 1 ? 'contribution' : 'contributions'}`;
const GITHUB = { origins: ['https://github.com/*'] };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let s: Settings;
let info: CalendarInfo = { found: false };
/** true when the active tab has no content script to answer (not github.com, no access, or opened before install) */
let unreachable = false;
let hasAccess = true;
let tabId: number | undefined;

async function send(msg: Request): Promise<CalendarInfo | undefined> {
  if (tabId === undefined) return undefined;
  try {
    return (await browser.tabs.sendMessage(tabId, msg)) as CalendarInfo | undefined;
  } catch {
    unreachable = true;
    return undefined;
  }
}

// storage.sync allows about 120 writes a minute, so saves are debounced; closing the popup flushes the last one.
let saveTimer = 0;
function flushSave() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = 0;
  saveSettings(s).catch(() => { $('status').textContent = 'Could not save settings.'; });
}
/** Every change shows on the active tab at once; storage then reaches other tabs and the user's other devices. */
function changed() {
  render();
  void send({ type: 'cd:preview', settings: s });
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushSave, 400);
}
addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });

function render() {
  const h = s.highlight, d = s.dance, c = s.disco;
  const pos = h.max ?? (info.r0 ? Math.round(posOf(info.r0)) : 500);
  const R = h.max === null ? info.r0 : refMax(h.max);

  $('hlOn').checked = h.on;
  $('hl').value = String(pos);
  $('hlGlow').checked = h.glow;
  $<HTMLButtonElement>('hlReset').disabled = h.max === null;
  $('ctlHl').classList.toggle('off', !h.on);
  $('hlVal').textContent = !h.on ? 'off' : h.max === null ? "GitHub's look" : `max ${fmt(R!)}`;
  $('hlSub').textContent = R ? `Full brightness from ${contributions(R)}` : "This profile's scale";
  const mark = $('hlMark');
  mark.hidden = !info.r0;
  if (info.r0) mark.style.left = `${posOf(info.r0) / 10}%`;
  $('hl').setAttribute('aria-valuetext', R ? `full brightness from ${contributions(R)}` : "profile's scale");

  $('dnOn').checked = d.on;
  $('dn').value = String(d.dancers);
  $<HTMLSelectElement>('choreo').value = d.choreo;
  $('ctlDn').classList.toggle('off', !d.on);
  $('dnVal').textContent = d.on ? `${Math.round(d.dancers / 10)}% of tiles` : 'off';

  $('dsOn').checked = c.on;
  $('rainbow').checked = c.rainbow;
  $('ball').checked = c.ball;
  $('beams').checked = c.beams;
  $('sat').value = String(c.saturation);
  $('club').checked = c.club;
  $('ctlDs').classList.toggle('off', !c.on);
  $('dsVal').textContent = c.on ? `saturation ${Math.round(c.saturation / 10)}%` : 'off';

  $('bpm').value = String(s.bpm);
  $('bpmVal').textContent = `${s.bpm} BPM`;
  $('bpmBadge').textContent = `${s.bpm} BPM`;
  document.documentElement.style.setProperty('--beat', `${60000 / s.bpm}ms`);

  $('grant').hidden = hasAccess;
  $('status').textContent = !hasAccess
    ? 'The extension has no access to github.com, so it cannot change the calendar.'
    : info.found
      ? info.countsParsed
        ? `This profile: ${contributions(info.total!)}, best day ${fmt(info.maxDay!)}. GitHub reaches full brightness at ${fmt(info.r0!)}.`
        : "Could not read the counts from the tooltips, so the extension works from GitHub's levels."
      : unreachable
        ? 'No calendar found on this tab. If it is a github.com profile opened before the install, reload the page.'
        : 'There is no contribution calendar on this tab. Settings apply to every profile on github.com.';
}

/** On a reduced-motion device, turning dance or disco on here is the opt-in for this device. */
function motionOptIn(turnedOn: boolean) {
  if (turnedOn && reducedMotion) void setMotionOk();
}

function wire() {
  const on = (id: string, ev: string, fn: (el: HTMLInputElement) => void) =>
    $(id).addEventListener(ev, e => fn(e.currentTarget as HTMLInputElement));

  on('hlOn', 'change', el => { s.highlight.on = el.checked; changed(); });
  on('hl', 'input', el => { s.highlight.max = Number(el.value); changed(); });
  on('hlReset', 'click', () => { s.highlight.max = null; changed(); });
  on('hlGlow', 'change', el => { s.highlight.glow = el.checked; changed(); });

  on('dnOn', 'change', el => { s.dance.on = el.checked; motionOptIn(el.checked); changed(); });
  on('dn', 'input', el => { s.dance.dancers = Number(el.value); changed(); });
  on('choreo', 'change', el => { s.dance.choreo = el.value as Choreo; changed(); });

  on('dsOn', 'change', el => { s.disco.on = el.checked; motionOptIn(el.checked); changed(); });
  for (const k of ['rainbow', 'ball', 'beams', 'club'] as const)
    on(k, 'change', el => { s.disco[k] = el.checked; changed(); });
  on('sat', 'input', el => { s.disco.saturation = Number(el.value); changed(); });

  on('bpm', 'input', el => { s.bpm = Number(el.value); changed(); });
  let taps: number[] = [];
  on('tap', 'click', () => {
    const t = performance.now();
    taps = [...taps.filter(x => t - x < 3000), t];
    if (taps.length < 3) return;
    const beat = (taps[taps.length - 1]! - taps[0]!) / (taps.length - 1);
    s.bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(60000 / beat)));
    changed();
  });

  // Firefox lets the user revoke github.com access; the request must come from a click.
  on('grant', 'click', async () => {
    if (await browser.permissions.request(GITHUB).catch(() => false)) {
      hasAccess = true;
      $('status').textContent = 'Access granted. Reload the profile tab.';
      $('grant').hidden = true;
    }
  });
}

async function init() {
  $('rmNote').hidden = !reducedMotion;
  s = await loadSettings();
  render();
  wire();
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  info = (await send({ type: 'cd:info' })) ?? { found: false };
  if (unreachable) hasAccess = await browser.permissions.contains(GITHUB).catch(() => true);
  render();
}

void init();
