/**
 * Paints a zone's whole ground as one picture instead of a grid of repeated tiles: terrains bleed
 * into each other along noisy edges (grass over dirt, sand over water with a foam line), a slow
 * light/shade drift breaks the repetition, and small details (tufts, pebbles, cracks, salt
 * glints, glowing specks) are scattered by a stable hash. Pure pixel work, no Phaser.
 */

export type Surface =
  | 'grass'
  | 'reeds'
  | 'dirt'
  | 'sand'
  | 'mud'
  | 'salt'
  | 'ash'
  | 'canyon'
  | 'rift'
  | 'deep'
  | 'abyss'
  | 'water'
  | 'void'
  | 'built';

interface SurfaceDef {
  /** Higher terrains spill over lower ones; every pair of different ground terrains blends. */
  prio: number;
  /** What the receiving side shows just past an incoming edge. */
  rim: 'shadow' | 'foam' | 'drop' | 'none';
  /** Slow light/shade drift, as a fraction of brightness. */
  drift: number;
  decals: Decal[];
}

type Decal = 'tuft' | 'flower' | 'pebble' | 'crack' | 'ripple' | 'glint' | 'puddle' | 'speck';

const SURFACES: Record<Surface, SurfaceDef> = {
  grass: { prio: 10, rim: 'shadow', drift: 0.08, decals: ['tuft', 'tuft', 'flower'] },
  reeds: { prio: 9, rim: 'shadow', drift: 0.06, decals: ['tuft'] },
  salt: { prio: 8, rim: 'shadow', drift: 0.04, decals: ['glint', 'crack'] },
  dirt: { prio: 6, rim: 'shadow', drift: 0.07, decals: ['pebble', 'pebble', 'crack'] },
  mud: { prio: 7, rim: 'shadow', drift: 0.07, decals: ['puddle', 'pebble'] },
  ash: { prio: 5, rim: 'shadow', drift: 0.06, decals: ['pebble', 'crack'] },
  canyon: { prio: 4.5, rim: 'shadow', drift: 0.07, decals: ['pebble', 'crack', 'crack'] },
  rift: { prio: 4, rim: 'shadow', drift: 0.06, decals: ['crack', 'pebble', 'glint'] },
  deep: { prio: 3.5, rim: 'shadow', drift: 0.09, decals: ['speck', 'pebble', 'crack'] },
  abyss: { prio: 3, rim: 'shadow', drift: 0.09, decals: ['speck', 'speck', 'crack'] },
  sand: { prio: 2, rim: 'shadow', drift: 0.05, decals: ['ripple', 'pebble'] },
  water: { prio: 0, rim: 'foam', drift: 0.05, decals: [] },
  void: { prio: 0, rim: 'drop', drift: 0, decals: [] },
  // Floors people made keep straight edges and no litter.
  built: { prio: 0, rim: 'none', drift: 0.03, decals: [] },
};

/** Tile name → surface. Anything else (walls, props) is not ground. */
const SURFACE_OF: Record<string, Surface> = {
  grass: 'grass',
  'grass-flowers': 'grass',
  meadow: 'grass',
  'tall-grass': 'grass',
  reeds: 'reeds',
  dirt: 'dirt',
  sand: 'sand',
  ash: 'ash',
  mud: 'mud',
  'salt-flat': 'salt',
  'canyon-floor': 'canyon',
  'rift-floor': 'rift',
  'deep-floor': 'deep',
  'abyss-floor': 'abyss',
  water: 'water',
  sea: 'water',
  brine: 'water',
  void: 'void',
  'wood-floor': 'built',
  'stone-floor': 'built',
  carpet: 'built',
  dock: 'built',
  bridge: 'built',
  rail: 'built',
};

export function surfaceOf(tileName: string | undefined): Surface | null {
  return (tileName && SURFACE_OF[tileName]) || null;
}

/** One map cell: the tile whose pixels show there and the surface it counts as. */
export interface GroundCell {
  /** Index into the tileset (gid − 1). */
  tile: number;
  surface: Surface;
  /** Floors drawn as long planks or irregular flagstones (colored from the tile) instead. */
  pattern?: 'planks' | 'flagstones';
  /** A wall stands here: the floor south of it lies in its shadow. */
  wall?: boolean;
}

export interface Tileset {
  data: Uint8ClampedArray;
  width: number;
  columns: number;
}

const T = 16;

// --- Noise -------------------------------------------------------------------------

function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise in 0..1, continuous in both axes. */
export function noise2(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/**
 * How far (px) an incoming terrain reaches past the edge at world coordinate `along`. Both tiles
 * sharing an edge line read the same noise, so edges run on across tiles.
 */
export function edgeDepth(along: number, line: number, horizontal: boolean): number {
  const seed = horizontal ? 11 : 23;
  const n =
    noise2(along / 14, line / 16, seed) * 0.6 +
    noise2(along / 5, line / 16, seed + 5) * 0.28 +
    noise2(along / 2, line / 16, seed + 9) * 0.12;
  return 2 + n * 9;
}

// --- Painting ----------------------------------------------------------------------

/**
 * Paints the ground for a `width`×`height` grid of cells (null = not ground: left transparent).
 * Returns RGBA pixels, `width*16` by `height*16`.
 */
export function paintGround(
  cells: ReadonlyArray<GroundCell | null>,
  width: number,
  height: number,
  tiles: Tileset,
): Uint8ClampedArray<ArrayBuffer> {
  const W = width * T;
  const out = new Uint8ClampedArray(new ArrayBuffer(W * height * T * 4));
  const cell = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height ? null : (cells[y * width + x] ?? null);
  const src = (tile: number, px: number, py: number): number =>
    ((Math.floor(tile / tiles.columns) * T + py) * tiles.width + (tile % tiles.columns) * T + px) *
    4;
  const averages = new Map<number, readonly [number, number, number]>();
  const average = (tile: number) => {
    let avg = averages.get(tile);
    if (!avg) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let py = 0; py < T; py++)
        for (let px = 0; px < T; px++) {
          const i = src(tile, px, py);
          r += tiles.data[i] ?? 0;
          g += tiles.data[i + 1] ?? 0;
          b += tiles.data[i + 2] ?? 0;
        }
      avg = [r / (T * T), g / (T * T), b / (T * T)];
      averages.set(tile, avg);
    }
    return avg;
  };
  const rows = new RowSegments(W);

  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const here = cell(tx, ty);
      if (!here) continue;
      const def = SURFACES[here.surface];
      // Neighbors that spill onto this tile, lowest first so the highest paints last.
      const incoming: Array<{ dx: number; dy: number; c: GroundCell }> = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const n = cell(tx + dx, ty + dy);
          if (!n || n.surface === here.surface) continue;
          if (n.surface === 'built' || here.surface === 'built') continue;
          if (SURFACES[n.surface].prio <= def.prio) continue;
          incoming.push({ dx, dy, c: n });
        }
      }
      incoming.sort((a, b) => SURFACES[a.c.surface].prio - SURFACES[b.c.surface].prio);

      for (let py = 0; py < T; py++) {
        for (let px = 0; px < T; px++) {
          const wx = tx * T + px;
          const wy = ty * T + py;
          let from: GroundCell = here;
          let rim = 0;
          for (const { dx, dy, c } of incoming) {
            const into = reach(dx, dy, tx, ty, px, py);
            if (into < 0) {
              from = c;
              rim = 0;
            } else if (into < 1.5 && from === here) rim = Math.max(rim, into < 0.75 ? 2 : 1);
          }
          const s = src(from.tile, px, py);
          const o = (wy * W + wx) * 4;
          let r = tiles.data[s] ?? 0;
          let g = tiles.data[s + 1] ?? 0;
          let b = tiles.data[s + 2] ?? 0;
          const a = tiles.data[s + 3] ?? 255;
          if (from.pattern) {
            const [ar, ag, ab] = average(from.tile);
            const k =
              from.pattern === 'planks' ? plankShade(rows, wx, wy) : flagstoneShade(rows, wx, wy);
            r = ar * k;
            g = ag * k;
            b = ab * k;
          }
          if (!here.wall) {
            const occ = wallShadow(cell, tx, ty, px, py);
            r *= occ;
            g *= occ;
            b *= occ;
          }
          const fromDef = SURFACES[from.surface];
          // Broad light and shade so big fields don't read as a grid.
          const drift = (noise2(wx / 90, wy / 90, 3) - 0.5) * 2 * fromDef.drift;
          r *= 1 + drift;
          g *= 1 + drift;
          b *= 1 + drift * 0.8;
          if (rim) {
            const kind = def.rim;
            if (kind === 'shadow') {
              const k = rim === 2 ? 0.72 : 0.86;
              r *= k;
              g *= k;
              b *= k;
            } else if (kind === 'foam') {
              const k = rim === 2 ? 0.55 : 0.22;
              r += (235 - r) * k;
              g += (245 - g) * k;
              b += (250 - b) * k;
            } else if (kind === 'drop') {
              const k = rim === 2 ? 0.35 : 0.6;
              r *= k;
              g *= k;
              b *= k;
            }
          }
          out[o] = r;
          out[o + 1] = g;
          out[o + 2] = b;
          out[o + 3] = a;
        }
      }
      if (!incoming.length) scatterDecals(out, W, tx, ty, def.decals);
    }
  }
  return out;
}

/**
 * Where seams fall along each row of a floor pattern: pieces of random length, the same every
 * time for the same row.
 */
class RowSegments {
  private readonly cache = new Map<string, number[]>();
  constructor(private readonly width: number) {}

  /** Start of the piece that holds `x` in row `row`, and that piece's index. */
  find(row: number, seed: number, min: number, max: number, x: number): [number, number] {
    const key = `${seed}:${row}`;
    let starts = this.cache.get(key);
    if (!starts) {
      starts = [];
      let at = -Math.floor(hash2(row, 0, seed) * max);
      for (let i = 0; at < this.width; i++) {
        starts.push(at);
        at += min + Math.floor(hash2(row, i + 1, seed) * (max - min + 1));
      }
      this.cache.set(key, starts);
    }
    let i = 0;
    while (i + 1 < starts.length && (starts[i + 1] ?? 0) <= x) i++;
    return [starts[i] ?? 0, i];
  }
}

/** Long boards in rows 4 px tall: butt joints, a dark gap under each row, grain and nails. */
function plankShade(rows: RowSegments, wx: number, wy: number): number {
  const row = Math.floor(wy / 4);
  const py = wy - row * 4;
  const [start, idx] = rows.find(row, 61, 22, 58, wx);
  const ux = wx - start;
  let k = 0.9 + hash2(row, idx, 63) * 0.2;
  k *= 1 + (noise2(wx / 9, row * 3.1 + idx, 64) - 0.5) * 0.16;
  if (py === 3) k *= 0.6;
  else if (py === 0) k *= 1.1;
  if (ux === 0) k *= 0.58;
  else if (ux === 1 && py < 3) k *= 1.08;
  if ((ux === 3 || ux === 4) && py === 1 && hash2(row, idx, 65) < 0.6) k *= ux === 3 ? 0.7 : 1.2;
  return k;
}

/** Worn stone slabs of uneven width in rows 8 px tall, lit on their top-left edges. */
function flagstoneShade(rows: RowSegments, wx: number, wy: number): number {
  const row = Math.floor(wy / 8);
  const py = wy - row * 8;
  const [start, idx] = rows.find(row, 71, 9, 21, wx);
  const ux = wx - start;
  let k = 0.88 + hash2(row, idx, 73) * 0.2;
  k *= 1 + (hash2(wx, wy, 74) - 0.5) * 0.08;
  k *= 1 + (noise2(wx / 24, wy / 24, 75) - 0.5) * 0.14;
  if (py === 7 || ux === 0) k *= 0.62;
  else if (py === 0 || ux === 1) k *= 1.14;
  else if (py === 6) k *= 0.9;
  return k;
}

/** Contact shadow on a floor under and beside walls (interiors have no cliff faces). */
function wallShadow(
  cell: (x: number, y: number) => GroundCell | null,
  tx: number,
  ty: number,
  px: number,
  py: number,
): number {
  let k = 1;
  if (py < 6 && cell(tx, ty - 1)?.wall) k *= 0.55 + py * 0.075;
  if (px < 2 && cell(tx - 1, ty)?.wall) k *= 0.82 + px * 0.08;
  if (px > T - 3 && cell(tx + 1, ty)?.wall) k *= 0.82 + (T - 1 - px) * 0.08;
  return k;
}

/**
 * How far pixel (px, py) of tile (tx, ty) lies outside the spill from neighbor (dx, dy):
 * negative = covered by it.
 */
function reach(dx: number, dy: number, tx: number, ty: number, px: number, py: number): number {
  const cx = px + 0.5;
  const cy = py + 0.5;
  if (dx === 0 || dy === 0) {
    const horizontal = dx === 0;
    // Distance into this tile from the shared edge, and the edge line in world pixels.
    const dist = horizontal ? (dy < 0 ? cy : T - cy) : dx < 0 ? cx : T - cx;
    const line = horizontal ? (dy < 0 ? ty * T : (ty + 1) * T) : dx < 0 ? tx * T : (tx + 1) * T;
    const along = horizontal ? tx * T + cx : ty * T + cy;
    return dist - edgeDepth(along, line, horizontal);
  }
  // A diagonal neighbor rounds the corner it touches.
  const ox = dx < 0 ? 0 : T;
  const oy = dy < 0 ? 0 : T;
  const d = Math.hypot(cx - ox, cy - oy);
  const r = 4 + noise2((tx * T + ox) / 7, (ty * T + oy) / 7, 41) * 6;
  return d - r;
}

/** Small details on a plain tile, placed by a stable hash so a zone looks the same every visit. */
function scatterDecals(out: Uint8ClampedArray, W: number, tx: number, ty: number, kinds: Decal[]) {
  if (!kinds.length) return;
  const roll = hash2(tx, ty, 97);
  if (roll > 0.34) return;
  const kind = kinds[Math.floor(hash2(tx, ty, 98) * kinds.length)] ?? kinds[0];
  const x0 = tx * T + 3 + Math.floor(hash2(tx, ty, 99) * 9);
  const y0 = ty * T + 3 + Math.floor(hash2(tx, ty, 100) * 9);
  const shade = (x: number, y: number, k: number, add = 0) => {
    const o = (y * W + x) * 4;
    if (!out[o + 3]) return;
    for (let i = 0; i < 3; i++) out[o + i] = (out[o + i] ?? 0) * k + add;
  };
  const tint = (x: number, y: number, rgb: [number, number, number], k: number) => {
    const o = (y * W + x) * 4;
    if (!out[o + 3]) return;
    for (let i = 0; i < 3; i++) out[o + i] = (out[o + i] ?? 0) * (1 - k) + (rgb[i] ?? 0) * k;
  };
  switch (kind) {
    case 'tuft':
      // A few blades: dark at the root, lit at the tip.
      for (const [bx, h] of [
        [0, 3],
        [2, 4],
        [4, 3],
      ] as const) {
        for (let i = 0; i < h; i++)
          shade(x0 + bx + (i === h - 1 ? (bx < 2 ? -1 : 1) : 0), y0 - i, i ? 1.25 : 0.7, i ? 8 : 0);
      }
      break;
    case 'flower': {
      const colors: Array<[number, number, number]> = [
        [255, 240, 120],
        [255, 255, 255],
        [255, 150, 190],
        [170, 200, 255],
      ];
      const c = colors[Math.floor(hash2(tx, ty, 101) * colors.length)] ?? [255, 255, 255];
      for (const [fx, fy] of [
        [0, -1],
        [-1, 0],
        [1, 0],
        [0, 1],
      ] as const)
        tint(x0 + fx, y0 + fy, c, 0.85);
      tint(x0, y0, [255, 200, 60], 0.9);
      shade(x0, y0 + 2, 0.75);
      break;
    }
    case 'pebble':
      shade(x0, y0, 1.3, 10);
      shade(x0 + 1, y0, 1.15, 6);
      shade(x0, y0 + 1, 0.85);
      shade(x0 + 1, y0 + 1, 0.7);
      shade(x0 + 2, y0 + 1, 0.8);
      break;
    case 'crack': {
      let x = x0;
      let y = y0;
      for (let i = 0; i < 6; i++) {
        shade(x, y, 0.62);
        if (hash2(tx + i, ty, 102) < 0.5) x++;
        else y++;
        if (i === 3) shade(x + 1, y - 1, 0.75);
      }
      break;
    }
    case 'ripple':
      for (let i = 0; i < 5; i++) {
        const lift = i === 0 || i === 4 ? 1 : 0;
        shade(x0 + i, y0 + lift, 1.12, 6);
        shade(x0 + i, y0 + lift + 1, 0.88);
      }
      break;
    case 'glint':
      tint(x0, y0, [255, 255, 255], 0.8);
      tint(x0 + 1, y0, [255, 255, 255], 0.35);
      tint(x0 - 1, y0, [255, 255, 255], 0.35);
      tint(x0, y0 - 1, [255, 255, 255], 0.35);
      tint(x0, y0 + 1, [255, 255, 255], 0.35);
      break;
    case 'puddle':
      for (let y = 0; y < 3; y++)
        for (let x = -2; x <= 3; x++)
          if (Math.abs(x - 0.5) + y * 1.5 < 4) shade(x0 + x, y0 + y, 0.7);
      shade(x0 - 1, y0, 1.25, 12);
      break;
    case 'speck': {
      const glow: [number, number, number] =
        hash2(tx, ty, 103) < 0.5 ? [150, 255, 230] : [210, 160, 255];
      tint(x0, y0, glow, 0.9);
      for (const [fx, fy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const)
        tint(x0 + fx, y0 + fy, glow, 0.3);
      break;
    }
  }
}
