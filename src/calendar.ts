/**
 * Everything that depends on GitHub's markup lives here (checked live 2026-10-29):
 *   div.js-calendar-graph > div[overflow-x:auto] > table.ContributionCalendar-grid
 *   td.ContributionCalendar-day[data-date][data-level] id="contribution-day-component-{weekday}-{week}"
 *   <tool-tip for="{td.id}">24 contributions on January 18th.</tool-tip>  (the only place counts live)
 *   legend: div#contribution-graph-legend-level-{0..4}
 */

export interface Tile {
  el: HTMLTableCellElement;
  date: string;
  /** week column and weekday row */
  w: number;
  d: number;
  /** GitHub's own level 0..4 */
  level: number;
  count: number;
}

export interface Calendar {
  root: HTMLElement;
  table: HTMLTableElement;
  scroller: HTMLElement | null;
  tiles: Tile[];
  weeks: number;
  legend: HTMLElement[];
  /** GitHub's reference max (level = ceil(4·count/r0)), inferred from the page. */
  r0: number;
  maxDay: number;
  activeDays: number;
  total: number;
  countsParsed: boolean;
  /** 'halloween' | 'winter' | '' — GitHub swaps the palette on holidays. */
  holiday: string;
}

export const ROOT_SELECTOR = '.js-calendar-graph';
const TILE_SELECTOR = 'td.ContributionCalendar-day[data-date]';
const COUNT_RE = /^\s*(No|[0-9][0-9,]*)\s+contributions?\s+on\b/i;
const ID_RE = /contribution-day-component-(\d+)-(\d+)$/;

export function parseCount(text: string | null | undefined): number | null {
  const m = text ? COUNT_RE.exec(text) : null;
  if (!m) return null;
  return /^no$/i.test(m[1]!) ? 0 : Number(m[1]!.replace(/,/g, ''));
}

/**
 * GitHub's levels are linear quarters of one reference r0 (the max after trimming outliers; the exact
 * trimming rule is unknown). Each (count, level) pair bounds r0, so we take the middle of the intersection.
 */
export function inferR0(pairs: { count: number; level: number }[]): number {
  let lo = 0, hi = Infinity, max = 0;
  for (const { count: c, level: L } of pairs) {
    if (c <= 0 || L <= 0) continue;
    max = Math.max(max, c);
    if (L <= 3) lo = Math.max(lo, (4 * c) / L);       // ceil(4c/r0) <= L  ->  r0 >= 4c/L
    if (L >= 2) hi = Math.min(hi, (4 * c) / (L - 1)); // ceil(4c/r0) >= L  ->  r0 <  4c/(L-1)
  }
  if (max === 0) return 1;
  if (!Number.isFinite(hi)) return Math.max(lo, max);
  if (lo >= hi) return max;                           // GitHub changed its rule; fall back to the plain max
  return (lo + hi) / 2;
}

export function parseCalendar(root: HTMLElement): Calendar | null {
  const table = root.querySelector<HTMLTableElement>('table.ContributionCalendar-grid');
  const cells = Array.from(root.querySelectorAll<HTMLTableCellElement>(TILE_SELECTOR));
  if (!table || cells.length === 0) return null;

  const tips = new Map<string, string>();
  root.querySelectorAll('tool-tip[for]').forEach(t => tips.set(t.getAttribute('for')!, t.textContent ?? ''));

  const first = Date.parse(cells[0]!.dataset.date + 'T00:00:00Z');
  const firstDow = new Date(first).getUTCDay();
  let parsed = 0;
  const raw = cells.map(el => {
    const date = el.dataset.date!;
    const level = Math.min(4, Math.max(0, Number(el.dataset.level) || 0));
    const id = ID_RE.exec(el.id);
    const t = Date.parse(date + 'T00:00:00Z');
    const d = id ? Number(id[1]) : new Date(t).getUTCDay();
    const w = id ? Number(id[2]) : Math.floor((Math.round((t - first) / 864e5) + firstDow) / 7);
    const count = parseCount(tips.get(el.id));
    if (count !== null) parsed++;
    return { el, date, w, d, level, count };
  });

  // Without readable tooltips, fall back to the levels themselves: count = level, r0 = 4 reproduces them exactly.
  const countsParsed = parsed === raw.length;
  const tiles: Tile[] = raw.map(t => ({ ...t, count: countsParsed ? t.count! : t.level }));
  const r0 = countsParsed ? inferR0(tiles) : 4;
  const active = tiles.filter(t => t.count > 0);

  return {
    root,
    table,
    scroller: table.parentElement instanceof HTMLElement && table.parentElement !== root ? table.parentElement : null,
    tiles,
    weeks: Math.max(...tiles.map(t => t.w)) + 1,
    legend: Array.from(root.querySelectorAll<HTMLElement>('[id^="contribution-graph-legend-level-"]')),
    r0,
    maxDay: active.reduce((m, t) => Math.max(m, t.count), 0),
    activeDays: active.length,
    total: tiles.reduce((s, t) => s + t.count, 0),
    countsParsed,
    holiday: root.dataset.holiday ?? '',
  };
}

/** CSS color for GitHub's own level, following the holiday palette (which has no level-0 variable). */
export function levelVar(holiday: string, level: number): string {
  if (level > 0 && (holiday === 'halloween' || holiday === 'winter'))
    return `var(--contribution-${holiday}-bgColor-${level}, var(--contribution-default-bgColor-${level}))`;
  return `var(--contribution-default-bgColor-${level})`;
}
