export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mod = (a: number, n: number) => ((a % n) + n) % n;
/** smoothstep: every on/off fade uses it so starts and ends are soft. */
export const ease = (x: number) => x * x * (3 - 2 * x);

const DEG = Math.PI / 180;
/** Chroma + hue → OKLab (a, b). Colors are blended as these vectors, never by hue angle, so nothing can flip at the antipode. */
export const polar = (C: number, h: number): [number, number] => [C * Math.cos(h * DEG), C * Math.sin(h * DEG)];

export function oklabToRgb(L: number, A: number, B: number): [number, number, number] {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const enc = (x: number) => { x = clamp(x, 0, 1); return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055; };
  return [
    enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    enc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export type Lab = [number, number, number];

/** sRGB (0..255) → OKLab. */
export function rgbToOklab(r: number, g: number, b: number): Lab {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab → rgb() with chroma pulled back until R/(R+G+B) < 0.7 (WCAG "saturated red" starts at 0.8). */
export function safeRgb(L: number, A: number, B: number): string {
  let rgb = oklabToRgb(L, A, B);
  for (let i = 0; i < 8; i++) {
    const sum = rgb[0] + rgb[1] + rgb[2];
    if (!sum || rgb[0] / sum < 0.7) break;
    A *= 0.7; B *= 0.7;
    rgb = oklabToRgb(L, A, B);
  }
  return `rgb(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)})`;
}

export const mixCss = (a: string, b: string, t: number) =>
  t >= 0.999 ? a : t <= 0.001 ? b : `color-mix(in oklab, ${a} ${(t * 100).toFixed(1)}%, ${b})`;
