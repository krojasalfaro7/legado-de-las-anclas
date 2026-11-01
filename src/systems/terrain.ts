/**
 * Procedural continent for the world map: deterministic value noise shaped by an
 * elliptical falloff, classified into biomes. Pure so it can be tested in node.
 */
export type Biome =
  | 'deepSea'
  | 'sea'
  | 'shore'
  | 'meadow'
  | 'forest'
  | 'hills'
  | 'mountain'
  | 'snow'
  | 'canyon'
  | 'river';

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise in [0, 1] with grid spacing `scale`. */
function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const gx = Math.floor(x / scale);
  const gy = Math.floor(y / scale);
  const fx = smooth(x / scale - gx);
  const fy = smooth(y / scale - gy);
  const a = hash(gx, gy, seed);
  const b = hash(gx + 1, gy, seed);
  const c = hash(gx, gy + 1, seed);
  const d = hash(gx + 1, gy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm(x: number, y: number, seed: number): number {
  return (
    valueNoise(x, y, 48, seed) * 0.55 +
    valueNoise(x, y, 20, seed + 1) * 0.3 +
    valueNoise(x, y, 8, seed + 2) * 0.15
  );
}

/** Height in roughly [-1, 1]: positive is land. */
export function terrainHeight(x: number, y: number, w: number, h: number, seed: number): number {
  const dx = (x - w * 0.52) / (w * 0.42);
  const dy = (y - h * 0.5) / (h * 0.42);
  const falloff = dx * dx + dy * dy;
  return 0.6 * (1 - falloff) + 0.9 * (fbm(x, y, seed) - 0.5) + 0.02;
}

/** River course: meanders from the northern mountains to the south coast. */
function riverX(y: number, w: number): number {
  return w * 0.6 + Math.sin(y / 17) * 10 + Math.sin(y / 41) * 18;
}

export function biomeAt(x: number, y: number, w: number, h: number, seed: number): Biome {
  const e = terrainHeight(x, y, w, h, seed);
  if (e < -0.12) return 'deepSea';
  if (e < 0) return 'sea';
  if (e < 0.05) return 'shore';
  if (e < 0.5 && Math.abs(x - riverX(y, w)) < 1.6 && y > h * 0.2) return 'river';
  if (e > 0.74) return 'snow';
  if (e > 0.6) return 'mountain';
  // Copper canyons fill the dry south-east.
  if (x > w * 0.68 && y > h * 0.45 && valueNoise(x, y, 14, seed + 5) > 0.35) return 'canyon';
  if (e > 0.48) return 'hills';
  return valueNoise(x, y, 12, seed + 9) > 0.58 ? 'forest' : 'meadow';
}

/** Biome grid in row-major order. */
export function generateTerrain(w: number, h: number, seed: number): Biome[] {
  const out: Biome[] = new Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) out[y * w + x] = biomeAt(x, y, w, h, seed);
  return out;
}
