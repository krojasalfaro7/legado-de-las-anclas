import { glyphBitmap } from './pixelFont';

/**
 * The title screen's painted pieces: a dusk landscape (sky, stars, ranges in haze, the sea, the
 * cliffs and the Atalaya) and the logo. Pure pixel work on RGBA buffers; TitleScene animates
 * the rest (the anchor's light, the lighthouse beam, motes, stars).
 */
export interface Picture {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

type Rgb = readonly [number, number, number];

const rgb = (c: number): Rgb => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function picture(width: number, height: number): Picture {
  return { width, height, data: new Uint8ClampedArray(new ArrayBuffer(width * height * 4)) };
}

function put(p: Picture, x: number, y: number, c: Rgb, a = 1): void {
  if (x < 0 || y < 0 || x >= p.width || y >= p.height) return;
  const i = (Math.floor(y) * p.width + Math.floor(x)) * 4;
  const d = p.data;
  const inv = 1 - a;
  d[i] = (d[i] ?? 0) * inv + c[0] * a;
  d[i + 1] = (d[i + 1] ?? 0) * inv + c[1] * a;
  d[i + 2] = (d[i + 2] ?? 0) * inv + c[2] * a;
  d[i + 3] = Math.max(d[i + 3] ?? 0, a * 255);
}

/** 4×4 ordered dither threshold, 0..1. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const dither = (x: number, y: number) => BAYER[(y % 4) * 4 + (x % 4)] ?? 0.5;

/** Posterized gradient through `stops` (position 0..1 → color), dithered between steps. */
function gradient(
  stops: ReadonlyArray<readonly [number, number]>,
  t: number,
  x: number,
  y: number,
) {
  const levels = 18;
  const q = t * levels;
  const step = Math.floor(q) + (q - Math.floor(q) > dither(x, y) ? 1 : 0);
  const tt = Math.min(1, step / levels);
  let i = 0;
  while (i < stops.length - 2 && tt > (stops[i + 1]?.[0] ?? 1)) i++;
  const [p0, c0] = stops[i] ?? [0, 0];
  const [p1, c1] = stops[i + 1] ?? [1, 0];
  return mix(rgb(c0), rgb(c1), Math.max(0, Math.min(1, (tt - p0) / (p1 - p0 || 1))));
}

function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 974634121) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise1(x: number, s: number): number {
  const x0 = Math.floor(x);
  const f = x - x0;
  const t = f * f * (3 - 2 * f);
  return hash(x0, 0, s) * (1 - t) + hash(x0 + 1, 0, s) * t;
}

/** Ridge height in px at column x: a few octaves of noise. */
function ridge(x: number, scale: number, seed: number): number {
  return (
    noise1(x / scale, seed) * 0.6 +
    noise1(x / (scale / 2.3), seed + 1) * 0.28 +
    noise1(x / (scale / 6), seed + 2) * 0.12
  );
}

/** Where things sit, as fractions of the view, shared with TitleScene. */
export const TITLE_LAYOUT = {
  horizon: 0.64,
  pillarX: 0.27,
  towerX: 0.86,
  cliffTop: 0.8,
  heroX: 0.13,
} as const;

const SKY: ReadonlyArray<readonly [number, number]> = [
  [0, 0x0e1230],
  [0.3, 0x242a5a],
  [0.55, 0x4a3a72],
  [0.75, 0x9a5a7e],
  [0.9, 0xe08a7a],
  [1, 0xffc890],
];

export function paintBackdrop(W: number, H: number): Picture {
  const p = picture(W, H);
  const horizon = Math.round(H * TITLE_LAYOUT.horizon);
  const px = Math.round(W * TITLE_LAYOUT.pillarX);

  // Sky, warmer near the anchor's light.
  for (let y = 0; y < horizon; y++)
    for (let x = 0; x < W; x++) {
      const near = Math.max(0, 1 - Math.abs(x - px) / (W * 0.6)) * 0.08;
      put(p, x, y, gradient(SKY, Math.min(1, y / horizon + near), x, y));
    }
  // Fixed faint stars in the upper sky (TitleScene adds twinkling ones).
  for (let y = 0; y < horizon * 0.55; y++)
    for (let x = 0; x < W; x++)
      if (hash(x, y, 7) < 0.004) put(p, x, y, [220, 225, 255], 0.35 + hash(x, y, 8) * 0.4);

  // Far range in haze: the color leans to the horizon's as it gets lower.
  const haze = rgb(0xc07a8a);
  for (let x = 0; x < W; x++) {
    const top = horizon - 8 - ridge(x, 90, 3) * H * 0.2;
    for (let y = Math.floor(top); y < horizon + 4; y++) {
      const depth = (y - top) / (horizon - top + 1);
      let c = mix(rgb(0x5a4e86), haze, 0.25 + depth * 0.45);
      // Snow and light on the ridge line.
      if (y - top < 1.5) c = mix(c, rgb(0xffd0b0), 0.5);
      put(p, x, y, c);
    }
  }
  // Nearer hills, darker, the anchor's hill among them.
  for (let x = 0; x < W; x++) {
    const bump = Math.max(0, 1 - Math.abs(x - px) / 34);
    const top = horizon + 2 - ridge(x, 60, 11) * H * 0.07 - bump * bump * H * 0.06;
    for (let y = Math.floor(top); y < horizon + H * 0.06; y++) {
      const lit = y - top < 1.2 ? 0.45 : 0;
      put(p, x, y, mix(mix(rgb(0x2e2a52), rgb(0x6a4a72), 0.25), rgb(0xffb890), lit));
    }
  }
  // The sea, catching the sky's warm band near the horizon.
  const seaTop = Math.round(horizon + H * 0.04);
  for (let y = seaTop; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = (y - seaTop) / (H - seaTop);
      let c = mix(rgb(0x6a4a7e), rgb(0x141a3a), Math.min(1, t * 1.6));
      // Long low waves: lighter dashes that thin out with distance.
      if (hash(Math.floor(x / (6 + t * 10)), y, 21) < 0.08 + t * 0.05)
        c = mix(c, rgb(0xb07a9a), 0.35);
      put(p, x, y, c);
    }

  // Foreground cliff on the left, where the hero stands.
  const cliffTop = Math.round(H * TITLE_LAYOUT.cliffTop);
  const edge = Math.round(W * 0.42);
  for (let x = 0; x < edge + 10; x++) {
    const fall = x > edge ? (x - edge) * 2.6 : 0;
    const top = cliffTop - ridge(x, 40, 31) * 6 + fall + (x < W * 0.08 ? -(W * 0.08 - x) * 0.4 : 0);
    for (let y = Math.floor(top); y < H; y++) {
      const d = y - top;
      let c = rgb(0x161428);
      if (d < 1.2) c = rgb(0xf0a080);
      else if (d < 2.5) c = rgb(0x7a4a6a);
      else if (d < 5 && hash(x, y, 33) < 0.4) c = rgb(0x2a2240);
      put(p, x, y, c);
    }
    // Grass blades against the light.
    if (hash(x, 0, 34) < 0.35 && x < edge)
      for (let k = 1; k <= 1 + Math.floor(hash(x, 1, 35) * 3); k++)
        put(p, x, top - k, rgb(0x161428));
  }

  // The Atalaya's cliff and tower on the right.
  const tx = Math.round(W * TITLE_LAYOUT.towerX);
  const rockTop = horizon + H * 0.02;
  for (let x = Math.round(W * 0.7); x < W; x++) {
    const top = rockTop - ridge(x, 30, 41) * 8 - Math.max(0, (x - W * 0.7) * 0.25);
    for (let y = Math.floor(top); y < H; y++) {
      const d = y - top;
      put(p, x, y, d < 1.2 ? rgb(0xd08a8a) : d < 3 ? rgb(0x4a3456) : rgb(0x1c1830));
    }
  }
  const towerTop = Math.round(horizon - H * 0.3);
  const baseY = Math.round(rockTop - 10);
  for (let y = towerTop; y < baseY; y++) {
    const half = 5 + ((y - towerTop) / (baseY - towerTop)) * 3;
    for (let x = Math.round(tx - half); x <= Math.round(tx + half); x++) {
      const left = x - (tx - half) < 1.5;
      put(p, x, y, left ? rgb(0x8a6a8a) : rgb(0x2a2440));
    }
  }
  // Lit windows, the lantern room and its cap.
  for (const wy of [0.35, 0.6, 0.82]) put(p, tx, towerTop + (baseY - towerTop) * wy, rgb(0xffd890));
  for (let y = towerTop - 8; y < towerTop; y++)
    for (let x = tx - 6; x <= tx + 6; x++)
      put(p, x, y, y < towerTop - 6 ? rgb(0x1c1830) : rgb(0xfff0b0));
  for (let x = tx - 7; x <= tx + 7; x++) put(p, x, towerTop - 9, rgb(0x1c1830));
  for (let y = towerTop - 13; y < towerTop - 9; y++)
    for (let x = tx - 4 + (towerTop - 9 - y); x <= tx + 4 - (towerTop - 9 - y); x++)
      put(p, x, y, rgb(0x1c1830));
  return p;
}

/** Scale2x (EPX): doubles a bitmap and rounds its diagonals. */
function scale2x(src: boolean[][]): boolean[][] {
  const h = src.length;
  const w = src[0]?.length ?? 0;
  const at = (x: number, y: number) => src[y]?.[x] ?? false;
  const out = Array.from({ length: h * 2 }, () => Array<boolean>(w * 2).fill(false));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const P = at(x, y);
      const A = at(x, y - 1);
      const B = at(x + 1, y);
      const C = at(x - 1, y);
      const D = at(x, y + 1);
      const row0 = out[y * 2] as boolean[];
      const row1 = out[y * 2 + 1] as boolean[];
      row0[x * 2] = C === A && C !== D && A !== B ? A : P;
      row0[x * 2 + 1] = A === B && A !== C && B !== D ? B : P;
      row1[x * 2] = D === C && D !== B && C !== A ? C : P;
      row1[x * 2 + 1] = B === D && B !== A && D !== C ? D : P;
    }
  return out;
}

/** A line of text as one smooth bitmap: glyphs scaled `times` doublings, `gap` px apart. */
function textMask(text: string, times: number, gap: number): boolean[][] {
  const glyphs = [...text].map((ch) => {
    if (ch === ' ') return null;
    let g = glyphBitmap(ch);
    for (let i = 0; g && i < times; i++) g = scale2x(g);
    return g;
  });
  const k = 2 ** times;
  const h = Math.max(...glyphs.map((g) => g?.length ?? 0));
  const width = glyphs.reduce((w, g) => w + (g ? (g[0]?.length ?? 0) + gap : 3 * k), 0);
  const mask = Array.from({ length: h }, () => Array<boolean>(width).fill(false));
  let x = 0;
  for (const g of glyphs) {
    if (!g) {
      x += 3 * k;
      continue;
    }
    g.forEach((row, y) => {
      const line = mask[y];
      row.forEach((on, gx) => {
        if (on && line) line[x + gx] = true;
      });
    });
    x += (g[0]?.length ?? 0) + gap;
  }
  return mask;
}

interface LogoStyle {
  top: number;
  mid: number;
  bottom: number;
  outline: number;
  /** Rows of the mask that hold ink (glyphs keep accent rows above the caps). */
  inkTop: number;
}

function stampText(
  p: Picture,
  mask: boolean[][],
  ox: number,
  oy: number,
  style: LogoStyle,
  outline: number,
): void {
  const h = mask.length;
  const w = mask[0]?.length ?? 0;
  const ink = (x: number, y: number) => mask[y]?.[x] ?? false;
  const near = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (dx * dx + dy * dy <= r * r + 1 && ink(x + dx, y + dy)) return true;
    return false;
  };
  // Drop shadow, then the outline ring, then the gradient fill with a lit top edge.
  for (let y = -outline - 4; y < h + outline + 4; y++)
    for (let x = -outline - 2; x < w + outline + 2; x++) {
      if (near(x, y - 3, outline)) put(p, ox + x, oy + y, rgb(0x0a0614), 0.55);
    }
  for (let y = -outline; y < h + outline; y++)
    for (let x = -outline; x < w + outline; x++)
      if (!ink(x, y) && near(x, y, outline)) put(p, ox + x, oy + y, rgb(style.outline));
  const span = Math.max(1, h - style.inkTop);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!ink(x, y)) continue;
      const t = Math.max(0, (y - style.inkTop) / span);
      let c =
        t < 0.5
          ? mix(rgb(style.top), rgb(style.mid), t * 2)
          : mix(rgb(style.mid), rgb(style.bottom), (t - 0.5) * 2);
      if (!ink(x, y - 1)) c = mix(c, [255, 255, 255], 0.6);
      else if (!ink(x, y + 1)) c = mix(c, [0, 0, 0], 0.25);
      put(p, ox + x, oy + y, c);
    }
}

/** The title: the last word big in gold, the rest above it in silver. */
export function paintLogo(title: string): Picture {
  const words = title.trim().split(/\s+/);
  const big = words.pop() ?? title;
  const small = words.join(' ');
  const bigMask = textMask(big, 2, 3);
  const smallMask = small ? textMask(small, 1, 2) : [];
  const bw = bigMask[0]?.length ?? 0;
  const sw = smallMask[0]?.length ?? 0;
  const pad = 6;
  const width = Math.max(bw, sw) + pad * 2;
  // The masks include the font's accent rows; trim the empty ones from the layout.
  const bigInk = bigMask.findIndex((r) => r.some(Boolean));
  const smallInk = smallMask.findIndex((r) => r.some(Boolean));
  const smallH = smallMask.length ? smallMask.length - Math.max(0, smallInk) : 0;
  const height = pad * 2 + smallH + 2 + bigMask.length - Math.max(0, bigInk) + 4;
  const p = picture(width, height);
  if (smallMask.length) {
    stampText(
      p,
      smallMask,
      Math.round((width - sw) / 2),
      pad - Math.max(0, smallInk),
      { top: 0xffffff, mid: 0xe0e4ff, bottom: 0x9aa4d8, outline: 0x1a1030, inkTop: smallInk },
      1,
    );
  }
  stampText(
    p,
    bigMask,
    Math.round((width - bw) / 2),
    pad + smallH + 2 - Math.max(0, bigInk),
    { top: 0xfffbe0, mid: 0xffd060, bottom: 0xd8642a, outline: 0x2a1028, inkTop: bigInk },
    2,
  );
  return p;
}
