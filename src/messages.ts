import type { Settings } from './settings';

/** Popup → content script. */
export type Request =
  | { type: 'cd:info' }
  /** Live preview while a slider is dragged; the popup saves to storage on release. */
  | { type: 'cd:preview'; settings: Settings };

/** What the popup shows about the calendar on the active tab. */
export interface CalendarInfo {
  found: boolean;
  /** GitHub's own reference max, inferred from the page. */
  r0?: number;
  maxDay?: number;
  activeDays?: number;
  total?: number;
  /** false when counts could not be read from the tooltips and only data-level is used. */
  countsParsed?: boolean;
}
