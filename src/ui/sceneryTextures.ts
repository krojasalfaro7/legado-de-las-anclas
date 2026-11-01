import type Phaser from 'phaser';

/**
 * Big scenery drawn over the tile grid so it keeps its real proportions next to the 32 px tall
 * characters (reference footage: trees ~3-4 characters tall, loose boulders ~2/3 of one, rock
 * walls with a visible face). Painted procedurally like the tileset: flat colors, top-left light,
 * dark outline, 15-bit color.
 */

export const TREE_KEYS = ['tree-big-0', 'tree-big-1', 'tree-big-2'] as const;
export const BOULDER_KEYS = ['boulder-big-0', 'boulder-big-1'] as const;
/** Arena pillars: rock columns ~1.4 characters tall, a couple of variants per rock kind. */
export const pillarKey = (kind: 'rock' | 'canyon', variant: number) => `pillar-${kind}-${variant}`;
export const PILLAR_VARIANTS = 2;
/** Wall faces: `lower` meets the ground, `upper` sits above it; `rim` lights the top edge. */
export type CliffKind = 'rock' | 'canyon' | 'basalt' | 'deep' | 'abyss';
export const cliffFaceKey = (kind: CliffKind, part: 'lower' | 'lowerRim' | 'upper') =>
  `cliff-${kind}-${part}`;

type Rgb = number;

class Paint {
  readonly px: Array<Rgb | null>;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Array(w * h).fill(null);
  }
  get(x: number, y: number): Rgb | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x] ?? null;
  }
  set(x: number, y: number, c: Rgb): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }
  /** Dark contour around every painted shape. */
  outline(c: Rgb): void {
    const edge: Array<[number, number]> = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== null) continue;
        if (
          this.get(x + 1, y) !== null ||
          this.get(x - 1, y) !== null ||
          this.get(x, y + 1) !== null ||
          this.get(x, y - 1) !== null
        )
          edge.push([x, y]);
      }
    for (const [x, y] of edge) this.set(x, y, c);
  }
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function to15(c: number): number {
  const ch = (shift: number) => {
    const v = (c >> shift) & 0xf8;
    return v | (v >> 5);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

function commit(scene: Phaser.Scene, key: string, p: Paint): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, p.w, p.h);
  if (!tex) throw new Error(`Could not create texture ${key}`);
  const ctx = tex.getContext();
  const img = ctx.createImageData(p.w, p.h);
  p.px.forEach((c, i) => {
    if (c === null) return;
    const v = to15(c);
    img.data[i * 4] = (v >> 16) & 0xff;
    img.data[i * 4 + 1] = (v >> 8) & 0xff;
    img.data[i * 4 + 2] = v & 0xff;
    img.data[i * 4 + 3] = 255;
  });
  ctx.putImageData(img, 0, 0);
  tex.refresh();
}

const LEAVES = [0x1f4a24, 0x2c6a2e, 0x3c8a38, 0x56a844, 0x7cc65a, 0xa8e07a];
const BARK = { dark: 0x3e2a1a, base: 0x5e4028, light: 0x86603a };

interface Blob {
  x: number;
  y: number;
  r: number;
}

/**
 * A broad leafy tree: a canopy of overlapping leaf clumps lit from the top-left over a short,
 * thick trunk with roots. Its base (bottom center) sits on the tree tile.
 */
function paintTree(w: number, h: number, seed: number): Paint {
  const p = new Paint(w, h);
  const rand = rng(seed);
  const cx = w / 2;
  const trunkTop = Math.round(h * 0.6);
  // Trunk, flaring into roots.
  for (let y = trunkTop; y < h - 1; y++) {
    const t = (y - trunkTop) / (h - 1 - trunkTop);
    const half = 3 + (t > 0.7 ? Math.round((t - 0.7) * 14) : 0);
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const rel = (x - (cx - half)) / (2 * half);
      const c = rel < 0.25 ? BARK.light : rel > 0.7 ? BARK.dark : BARK.base;
      p.set(x, y, (x + y * 3) % 7 === 0 ? BARK.dark : c);
    }
  }
  // Canopy: one big crown and a ring of clumps around it.
  const crownR = w * 0.36;
  const crownY = h * 0.36;
  const blobs: Blob[] = [{ x: cx, y: crownY, r: crownR }];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.95 + (i / 6) * 1.1) + (rand() - 0.5) * 0.3;
    blobs.push({
      x: cx + Math.cos(a) * crownR * 0.75,
      y: crownY + Math.sin(a) * crownR * 0.7 + crownR * 0.25,
      r: crownR * (0.48 + rand() * 0.14),
    });
  }
  blobs.push({ x: cx - crownR * 0.35, y: crownY - crownR * 0.55, r: crownR * 0.55 });
  blobs.push({ x: cx + crownR * 0.3, y: crownY - crownR * 0.6, r: crownR * 0.5 });
  // Small leaf clusters give the leafy texture: each adds a light rim on its top-left.
  const clumps: Blob[] = [];
  for (let i = 0; i < 46; i++) {
    const b = blobs[Math.floor(rand() * blobs.length)] ?? blobs[0];
    if (!b) continue;
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * b.r * 0.9;
    clumps.push({ x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d, r: 2.5 + rand() * 2.5 });
  }
  const lx = -0.62;
  const ly = -0.78;
  for (let y = 0; y < trunkTop + 6; y++) {
    for (let x = 0; x < w; x++) {
      let inside: Blob | null = null;
      let best = Number.POSITIVE_INFINITY;
      for (const b of blobs) {
        const d = Math.hypot(x - b.x, (y - b.y) * 1.08) / b.r;
        if (d <= 1 && d < best) {
          best = d;
          inside = b;
        }
      }
      if (!inside) continue;
      // Overall light: from the whole crown's shape.
      const nx = (x - cx) / (crownR * 1.3);
      const ny = (y - crownY) / (crownR * 1.3);
      let shade = 2.2 - (nx * lx + ny * ly) * 1.9 - Math.max(0, ny) * 0.9;
      // Leaf clumps: lit top-left edge, shaded bottom-right edge.
      for (const c of clumps) {
        const dx = x - c.x;
        const dy = y - c.y;
        const d = Math.hypot(dx, dy);
        if (d > c.r) continue;
        shade +=
          (dx * lx + dy * ly) / c.r > 0.35 ? 0.9 : (dx * lx + dy * ly) / c.r < -0.55 ? -0.7 : 0;
        break;
      }
      const i = Math.max(1, Math.min(LEAVES.length - 1, Math.round(shade)));
      p.set(x, y, LEAVES[i] ?? LEAVES[2] ?? 0);
    }
  }
  p.outline(LEAVES[0] ?? 0);
  return p;
}

const STONE = [0x2e2a34, 0x5a5664, 0x7c7888, 0x9c98a8, 0xc4c0cc];

/** A loose boulder, wider than tall, lit from the top-left, with a crack or two. */
function paintBoulder(w: number, h: number, seed: number): Paint {
  const p = new Paint(w, h);
  const rand = rng(seed);
  const cx = w / 2;
  const cy = h * 0.55;
  const rx = w / 2 - 1.5;
  const ry = h / 2 - 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const wob = 1 + Math.sin(Math.atan2(ny, nx) * 3 + seed) * 0.06;
      if (nx * nx + ny * ny > wob * wob) continue;
      // Flatter bottom resting on the ground.
      if (y > h - 2) continue;
      const lit = -(nx * -0.6 + ny * -0.8);
      const s = lit < -0.45 ? 4 : lit < -0.05 ? 3 : lit < 0.45 ? 2 : 1;
      p.set(x, y, STONE[s] ?? 0);
    }
  // Cracks.
  for (let k = 0; k < 2; k++) {
    let x = Math.round(cx + (rand() - 0.3) * rx);
    let y = Math.round(cy - ry * 0.3 + rand() * 3);
    for (let i = 0; i < 4 + Math.floor(rand() * 3); i++) {
      if (p.get(x, y) !== null) p.set(x, y, STONE[1] ?? 0);
      x += rand() > 0.5 ? 1 : 0;
      y += 1;
    }
  }
  p.outline(STONE[0] ?? 0);
  return p;
}

/**
 * The south-facing face of a rock wall: layered strata with cracks, a bright rim on top where
 * the light catches the edge, and a dark foot where it meets the ground.
 */
function paintCliffFace(
  palette: readonly number[],
  seed: number,
  part: 'lower' | 'lowerRim' | 'upper',
): Paint {
  const s = 16;
  const p = new Paint(s, s);
  const rand = rng(seed);
  const bands = [0, 4, 8, 12];
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      let c = palette[2] ?? 0;
      if (bands.includes(y)) c = palette[1] ?? 0;
      else if (bands.includes(y - 1)) c = palette[3] ?? 0;
      p.set(x, y, c);
    }
  for (let k = 0; k < 4; k++) {
    const x = Math.floor(rand() * s);
    const y0 = bands[Math.floor(rand() * bands.length)] ?? 0;
    for (let y = y0; y < y0 + 4; y++) p.set(x, y, palette[1] ?? 0);
  }
  for (let x = 0; x < s; x++) {
    if (part !== 'lower') {
      p.set(x, 0, palette[4] ?? 0);
      p.set(x, 1, palette[3] ?? 0);
    }
    if (part !== 'upper') {
      p.set(x, s - 1, palette[0] ?? 0);
      p.set(x, s - 2, palette[1] ?? 0);
    }
  }
  return p;
}

/**
 * A standing rock column: slightly wider at the foot, a flat lit top, horizontal strata and a
 * few vertical cracks; lit from the left like the rest of the scenery.
 */
function paintPillar(palette: readonly number[], w: number, h: number, seed: number): Paint {
  const p = new Paint(w, h);
  const rand = rng(seed);
  const top = 7;
  const cx = (w - 1) / 2;
  // Half-width per row: a gentle taper with a little wobble so the edges aren't ruled lines.
  const half = (y: number) =>
    w / 2 - 2.5 + ((y - top) / (h - top)) * 2 + Math.sin(y * 0.9 + seed) * 0.6;
  const bands = new Set<number>();
  for (let y = top + 6; y < h - 3; y += 5 + Math.floor(rand() * 3)) bands.add(y);
  for (let y = top; y < h - 1; y++) {
    const hw = half(y);
    for (let x = 0; x < w; x++) {
      const rel = (x - cx) / hw;
      if (Math.abs(rel) > 1) continue;
      let s = rel < -0.45 ? 3 : rel < 0.35 ? 2 : 1;
      if (bands.has(y)) s = Math.max(1, s - 1);
      else if (bands.has(y - 1) && s < 3) s += 1;
      p.set(x, y, palette[s] ?? 0);
    }
  }
  // The cap: an ellipse seen from slightly above, brightest on its left half.
  const capY = top;
  const capRx = half(top) + 0.5;
  for (let y = capY - 4; y <= capY + 3; y++)
    for (let x = 0; x < w; x++) {
      const nx = (x - cx) / capRx;
      const ny = (y - capY) / 3.6;
      if (nx * nx + ny * ny > 1) continue;
      p.set(x, y, nx < 0.1 && ny < 0.2 ? (palette[4] ?? 0) : (palette[3] ?? 0));
    }
  // Vertical cracks.
  for (let k = 0; k < 3; k++) {
    let x = Math.round(cx + (rand() - 0.5) * w * 0.5);
    const y0 = top + 4 + Math.floor(rand() * (h - top - 16));
    for (let y = y0; y < y0 + 5 + Math.floor(rand() * 6); y++) {
      if (p.get(x, y) !== null) p.set(x, y, palette[1] ?? 0);
      if (rand() > 0.7) x += rand() > 0.5 ? 1 : -1;
    }
  }
  // Rubble at the foot.
  for (const dx of [-1, 1]) {
    const bx = Math.round(cx + dx * (half(h - 2) + 1));
    for (let y = h - 4; y < h - 1; y++)
      for (let x = bx - 1; x <= bx + 1; x++)
        if (p.get(x, y) === null && (x + y) % 3 !== 0) p.set(x, y, palette[2] ?? 0);
  }
  p.outline(palette[0] ?? 0);
  return p;
}

const ROCK_FACE = [0x2e2a34, 0x55515f, 0x76727f, 0x8e8a98, 0xb8b4c4];
const CANYON_FACE = [0x3a1c10, 0x7a3e22, 0x9a5430, 0xb06a3c, 0xd89060];
const BASALT_FACE = [0x16141c, 0x2e2a36, 0x403c4a, 0x55505e, 0x7a7488];
const DEEP_FACE = [0x0c0a12, 0x1c1826, 0x2a2636, 0x3a3448, 0x5a6a7a];
const ABYSS_FACE = [0x12060f, 0x2a1028, 0x3e1a3a, 0x58284e, 0x9a4a8a];
const FACES: Record<CliffKind, readonly number[]> = {
  rock: ROCK_FACE,
  canyon: CANYON_FACE,
  basalt: BASALT_FACE,
  deep: DEEP_FACE,
  abyss: ABYSS_FACE,
};

export function generateSceneryTextures(scene: Phaser.Scene): void {
  commit(scene, TREE_KEYS[0], paintTree(56, 80, 11));
  commit(scene, TREE_KEYS[1], paintTree(50, 72, 23));
  commit(scene, TREE_KEYS[2], paintTree(60, 84, 37));
  commit(scene, BOULDER_KEYS[0], paintBoulder(24, 19, 5));
  commit(scene, BOULDER_KEYS[1], paintBoulder(22, 17, 9));
  for (let v = 0; v < PILLAR_VARIANTS; v++) {
    commit(scene, pillarKey('rock', v), paintPillar(ROCK_FACE, 20 + v * 2, 44 + v * 4, 51 + v));
    commit(scene, pillarKey('canyon', v), paintPillar(CANYON_FACE, 20 + v * 2, 44 + v * 4, 61 + v));
  }
  for (const part of ['lower', 'lowerRim', 'upper'] as const) {
    (Object.keys(FACES) as CliffKind[]).forEach((kind, i) => {
      commit(scene, cliffFaceKey(kind, part), paintCliffFace(FACES[kind], 3 + i * 4, part));
    });
  }
}
