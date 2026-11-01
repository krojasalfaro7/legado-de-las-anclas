import { mkdirSync, writeFileSync } from 'node:fs';
import { RgbaImage } from './png.ts';

/**
 * The app icon: the anchor crystal on a dusk hill with its light rising, as on the title screen.
 * Painted at 48×48 and scaled up with whole pixels (no smoothing).
 */
const N = 48;
const base = new RgbaImage(N, N);

const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const;
function blend(x: number, y: number, color: number, a: number): void {
  const [r0, g0, b0] = base.get(x, y);
  const [r, g, b] = rgb(color);
  const k = Math.max(0, Math.min(1, a));
  base.set(
    x,
    y,
    (Math.round(r0 + (r - r0) * k) << 16) |
      (Math.round(g0 + (g - g0) * k) << 8) |
      Math.round(b0 + (b - b0) * k),
  );
}

const SKY = [0x101436, 0x1e2250, 0x34306a, 0x5a3e7a, 0x9a5a80, 0xd88a80];
const horizon = 34;
for (let y = 0; y < N; y++)
  for (let x = 0; x < N; x++) {
    const t = Math.min(0.999, y / horizon);
    const i = t * (SKY.length - 1);
    // Ordered dither between the two nearest bands.
    const frac = i - Math.floor(i);
    const pick = frac > ((x + y * 2) % 4) / 4 + 0.125 ? Math.ceil(i) : Math.floor(i);
    base.set(x, y, SKY[Math.min(SKY.length - 1, pick)] ?? 0);
  }
for (const [x, y] of [
  [7, 6],
  [39, 9],
  [12, 15],
  [35, 3],
  [42, 18],
  [4, 22],
])
  blend(x ?? 0, y ?? 0, 0xe8ecff, 0.8);

// The light column, brightest in the middle, fading upward.
for (let y = 2; y < 31; y++) {
  const up = (y - 2) / 29;
  for (let dx = -5; dx <= 5; dx++) {
    const across = Math.exp(-(dx * dx) / (dx === 0 ? 1 : 4.5));
    blend(24 + dx, y, 0xd8f6ff, across * (0.25 + up * 0.75));
  }
}
// The hill, rim-lit, and a glow at the crystal's foot.
for (let x = 0; x < N; x++) {
  const top = Math.round(horizon - 3 * Math.exp(-((x - 24) ** 2) / 90) + Math.sin(x / 5) * 0.8);
  for (let y = top; y < N; y++)
    base.set(x, y, y === top ? 0xf0a890 : y === top + 1 ? 0x6a4470 : 0x221c3c);
}
for (let y = 24; y < 40; y++)
  for (let x = 12; x < 37; x++) {
    const d = Math.hypot((x - 24) / 1.6, y - 32);
    if (d < 8) blend(x, y, 0x9ae8ff, (1 - d / 8) * 0.55);
  }
// The crystal: a tall diamond with a lit left facet.
for (let y = 17; y <= 35; y++) {
  const half = y < 30 ? ((y - 17) / 13) * 4 : ((35 - y) / 5) * 4;
  for (let x = Math.round(24 - half); x <= Math.round(24 + half); x++) {
    const edge = x === Math.round(24 - half) || x === Math.round(24 + half);
    base.set(x, y, edge ? 0x1e4a6a : x < 24 ? 0xf0fcff : x === 24 ? 0xc8f4ff : 0x7ad0f0);
  }
}
base.set(24, 16, 0x1e4a6a);

/** Nearest-neighbor scale to `size` px square. */
function scaled(size: number): RgbaImage {
  const out = new RgbaImage(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const [r, g, b] = base.get(Math.floor((x * N) / size), Math.floor((y * N) / size));
      out.set(x, y, (r << 16) | (g << 8) | b);
    }
  return out;
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-48.png', scaled(48).toPng());
writeFileSync('public/icons/icon-192.png', scaled(192).toPng());
writeFileSync('public/icons/icon-512.png', scaled(512).toPng());
console.log('icons written');
