/** The highlight slider: position p in 0..1000 maps to a reference max R on a log scale, right = brighter. */
export const refMax = (p: number) => Math.pow(1000, 1 - p / 1000);

/** Slider position at which R equals the given reference (the "looks like GitHub" tick). */
export const posOf = (r: number) => Math.min(1000, Math.max(0, 1000 * (1 - Math.log(Math.max(1, r)) / Math.log(1000))));
