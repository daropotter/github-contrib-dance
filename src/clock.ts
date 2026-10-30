import { BPM_MAX, BPM_MIN } from './settings';

/**
 * One tempo for the dance and the lights, in document-timeline time so CSS animations can be pinned to it
 * (animation.startTime = t0 + phase · beat).
 */
export class BeatClock {
  bpm = 120;
  t0 = BeatClock.now();

  static now(): number {
    const t = document.timeline?.currentTime;
    return typeof t === 'number' ? t : performance.now();
  }

  beatMs() { return 60000 / this.bpm; }

  beat(now = BeatClock.now()) { return (now - this.t0) / this.beatMs(); }

  /** Changes tempo without jumping: the current beat position is kept. */
  setBpm(bpm: number) {
    const next = Math.min(BPM_MAX, Math.max(BPM_MIN, bpm));
    if (next === this.bpm) return false;
    const now = BeatClock.now(), b = this.beat(now);
    this.bpm = next;
    this.t0 = now - b * this.beatMs();
    return true;
  }
}
