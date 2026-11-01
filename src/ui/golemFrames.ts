/**
 * Ballast golems: hunched stone constructs with moss on their shoulders, arms of stacked boulders
 * that reach the ground, a small sunken head with eyes of anchor light, glowing veins and an
 * anchor shard driven into the back. Painted natively at the frame size (48×42, giants 72×63)
 * with shading per stone, so giants get real detail instead of enlarged blocks.
 */
// Explicit `.ts` extensions: the asset scripts import this module with plain Node.

import { finishGrid, type Grid, newGrid, tone } from './humanoid.ts';
import type { Facing, FrameSize, Pose } from './spriteSpec.ts';

export interface GolemLook {
  body: number;
  moss: number;
  crystal: number;
}

/** Design space: everything is laid out on a 48×42 frame and scaled to the real one. */
const DW = 48;

type Pt = readonly [number, number];

class Painter {
  readonly g: Grid;
  readonly k: number;
  /** Pixels that are stone (moss grows on their tops). */
  private readonly stone = new Set<number>();

  readonly size: FrameSize;

  constructor(size: FrameSize) {
    this.size = size;
    this.g = newGrid(size.w, size.h);
    this.k = size.w / DW;
  }

  private set(x: number, y: number, c: number, stone: boolean): void {
    const row = this.g[y];
    if (!row || x < 0 || x >= row.length) return;
    row[x] = c;
    const id = y * this.size.w + x;
    if (stone) this.stone.add(id);
    else this.stone.delete(id);
  }

  /** A shaded stone: an ellipse lit from the top-left, with a few pits. */
  blob(cx: number, cy: number, rx: number, ry: number, color: number): void {
    const k = this.k;
    for (let y = Math.floor((cy - ry) * k); y <= Math.ceil((cy + ry) * k); y++)
      for (let x = Math.floor((cx - rx) * k); x <= Math.ceil((cx + rx) * k); x++) {
        const nx = ((x + 0.5) / k - cx) / rx;
        const ny = ((y + 0.5) / k - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        this.set(x, y, tone(color, shade(nx, ny, d, x - cx * k, y - cy * k)), true);
      }
  }

  /** A rounded block from (x0, y0) to (x1, y1), shaded like a blob. */
  slab(x0: number, y0: number, x1: number, y1: number, color: number): void {
    const k = this.k;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const hx = (x1 - x0) / 2;
    const hy = (y1 - y0) / 2;
    for (let y = Math.floor(y0 * k); y < Math.ceil(y1 * k); y++)
      for (let x = Math.floor(x0 * k); x < Math.ceil(x1 * k); x++) {
        const nx = ((x + 0.5) / k - cx) / hx;
        const ny = ((y + 0.5) / k - cy) / hy;
        // Cut the corners so blocks read as hewn stone, not boxes.
        if (Math.abs(nx) + Math.abs(ny) > 1.75) continue;
        const d = Math.min(1, Math.max(nx * nx, ny * ny));
        this.set(x, y, tone(color, shade(nx, ny, d, x - cx * k, y - cy * k)), true);
      }
  }

  /** An arm or leg as a chain of boulders from `a` to `b`. */
  limb(a: Pt, b: Pt, r: number, color: number): void {
    const stones = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (r * 1.1)) + 1);
    for (let i = 0; i < stones; i++) {
      const t = stones === 1 ? 0 : i / (stones - 1);
      const rr = r * (0.88 + t * 0.24);
      this.blob(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, rr, rr * 0.92, color);
    }
  }

  /** A 1px line in design units (seams, veins); `flat` keeps its color unshaded. */
  line(a: Pt, b: Pt, color: number, onlyOnStone = true): void {
    const k = this.k;
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * k) + 1;
    for (let i = 0; i <= steps; i++) {
      const x = Math.round((a[0] + ((b[0] - a[0]) * i) / steps) * k);
      const y = Math.round((a[1] + ((b[1] - a[1]) * i) / steps) * k);
      if (onlyOnStone && this.g[y]?.[x] == null) continue;
      this.set(x, y, color, false);
    }
  }

  /** A filled triangle (the shard), lit on its left facet. */
  shard(apex: Pt, left: Pt, right: Pt, crystal: number): void {
    const k = this.k;
    const pts = [apex, left, right].map(([x, y]) => [x * k, y * k] as const);
    const [A, B, C] = pts as [
      readonly [number, number],
      readonly [number, number],
      readonly [number, number],
    ];
    const minY = Math.floor(Math.min(A[1], B[1], C[1]));
    const maxY = Math.ceil(Math.max(A[1], B[1], C[1]));
    const minX = Math.floor(Math.min(A[0], B[0], C[0]));
    const maxX = Math.ceil(Math.max(A[0], B[0], C[0]));
    const side = (p: Pt, q: Pt, x: number, y: number) =>
      (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
    const midX = (B[0] + C[0]) / 2;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const s1 = side(A, B, px, py);
        const s2 = side(B, C, px, py);
        const s3 = side(C, A, px, py);
        if ((s1 < 0 || s2 < 0 || s3 < 0) && (s1 > 0 || s2 > 0 || s3 > 0)) continue;
        // The facet toward the light is near white.
        const facet = px < A[0] + ((midX - A[0]) * (py - A[1])) / (B[1] - A[1] || 1);
        this.set(x, y, facet ? tone(crystal, 1.3) : crystal, false);
      }
  }

  eye(x: number, y: number, crystal: number): void {
    const k = this.k;
    const w = Math.max(1, Math.round(1.6 * k));
    const h = Math.max(1, Math.round(1.1 * k));
    for (let yy = 0; yy < h; yy++)
      for (let xx = 0; xx < w; xx++)
        this.set(Math.round(x * k) + xx, Math.round(y * k) + yy, crystal, false);
  }

  /** Moss on every stone top inside [x0, x1], hanging a little lower here and there. */
  moss(x0: number, x1: number, moss: number, skip?: readonly [number, number]): void {
    const k = this.k;
    for (let x = Math.floor(x0 * k); x <= Math.ceil(x1 * k); x++) {
      if (skip && x >= skip[0] * k && x <= skip[1] * k) continue;
      let y = 0;
      while (y < this.size.h && !this.stone.has(y * this.size.w + x)) y++;
      if (y >= this.size.h) continue;
      const h = Math.round((1.5 + (hash(x, 5) % 2) + (hash(x, 9) % 6 === 0 ? 3 : 0)) * k);
      for (let i = 0; i < h; i++) {
        if (!this.stone.has((y + i) * this.size.w + x)) break;
        this.set(x, y + i, i === 0 ? tone(moss, 1.18) : moss, false);
      }
      // The moss's own shadow on the stone below it.
      const below = (y + h) * this.size.w + x;
      if (this.stone.has(below)) this.set(x, y + h, tone(this.g[y + h]?.[x] ?? moss, 0.78), true);
    }
  }
}

function hash(x: number, y: number): number {
  return (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000;
}

/** Light from the top-left in four steps, with pits scattered on the surface. */
function shade(nx: number, ny: number, d: number, px: number, py: number): number {
  const light = -0.55 * nx - 0.75 * ny + 0.25 * (1 - d);
  let f = light > 0.5 ? 1.16 : light > 0.12 ? 1.04 : light > -0.32 ? 0.93 : 0.8;
  if (hash(Math.round(px), Math.round(py)) % 23 === 0) f *= 0.84;
  return f;
}

interface Arms {
  /** Fist positions (design units) for the left and right arm, as seen on screen. */
  fists: [Pt, Pt];
}

function armsFor(pose: Pose, swing: number): Arms {
  if (pose === 'attack' || pose === 'cast')
    return {
      fists: [
        [9, 2],
        [39, 2],
      ],
    };
  if (pose === 'attack2' || pose === 'attack3')
    return {
      fists: [
        [17, 33],
        [31, 33],
      ],
    };
  if (pose === 'block')
    return {
      fists: [
        [19, 16],
        [29, 16],
      ],
    };
  return {
    fists: [
      [6, 33 + swing],
      [42, 33 - swing],
    ],
  };
}

export function golemFrame(look: GolemLook, facing: Facing, pose: Pose, size: FrameSize): Grid {
  const p = new Painter(size);
  const { body, crystal } = look;
  const dark = tone(body, 0.82);
  const seam = tone(body, 0.62);
  const bob = pose === 'idle2' || pose === 'walk2' || pose === 'walk4' ? 1 : 0;
  const lean = pose === 'hurt' ? -2 : 0;
  const top = bob + lean;
  const liftL = pose === 'walk1' ? 2 : 0;
  const liftR = pose === 'walk3' ? 2 : 0;
  const swing = pose === 'walk1' ? 2 : pose === 'walk3' ? -2 : 0;
  const glow = pose !== 'hurt';

  if (facing === 'left' || facing === 'right') {
    // Drawn facing left; the sheet mirrors it for right.
    const fist: Pt =
      pose === 'attack' || pose === 'cast'
        ? [14, 3]
        : pose === 'attack2' || pose === 'attack3'
          ? [5, 30]
          : pose === 'block'
            ? [11, 16]
            : [14 - swing, 34];
    p.limb([28, 17 + top], [30 + swing, 33], 4, dark);
    p.blob(30 + swing, 34, 4.6, 4, dark);
    p.slab(26, 30 - liftR, 34, 42 - liftR, dark);
    p.slab(15, 30 - liftL, 24, 42 - liftL, body);
    p.slab(15, 12 + top, 36, 33 + top, body);
    p.blob(24, 25 + top, 10, 8, tone(body, 0.96));
    p.shard([40, 1 + top], [30, 12 + top], [35, 19 + top], crystal);
    p.slab(14, 10 + top, 29, 21 + top, tone(body, 1.04));
    p.blob(21, 11 + top, 7.5, 3.2, tone(body, 1.08));
    p.moss(14, 36, look.moss);
    p.slab(9, 13 + top, 18, 21 + top, tone(body, 0.95));
    p.slab(9, 13 + top, 16, 15 + top, dark);
    p.limb([20, 18 + top], fist, 4.3, body);
    p.blob(fist[0], fist[1], 5, 4.4, tone(body, 1.04));
    p.line([30, 17 + top], [26, 24 + top], crystal);
    p.line([26, 24 + top], [29, 30 + top], crystal);
    p.line([18, 27 + top], [34, 27 + top], seam);
    if (glow) p.eye(10, 16 + top, crystal);
  } else {
    const { fists } = armsFor(pose, swing);
    p.slab(13, 30 - liftL, 22, 42 - liftL, dark);
    p.slab(26, 30 - liftR, 35, 42 - liftR, dark);
    if (facing === 'up') p.slab(18, 9 + top, 30, 18 + top, tone(body, 0.9));
    p.slab(11, 12 + top, 37, 33 + top, body);
    p.blob(24, 25 + top, 11, 8, tone(body, 0.96));
    if (facing === 'up') p.shard([24, 0 + top], [19, 16 + top], [29, 16 + top], crystal);
    // Shoulders: two hewn blocks, mossy on top.
    p.slab(2, 11 + top, 18, 21 + top, tone(body, 1.04));
    p.slab(30, 11 + top, 46, 21 + top, tone(body, 1.04));
    // Rounded caps and loose stones break the shoulder line.
    p.blob(10, 12 + top, 7.5, 3.2, tone(body, 1.08));
    p.blob(38, 12 + top, 7.5, 3.2, tone(body, 1.08));
    p.blob(6, 10 + top, 2.6, 2.2, tone(body, 0.98));
    p.blob(41, 9.5 + top, 2.4, 2.4, tone(body, 0.98));
    p.moss(2, 46, look.moss, facing === 'up' ? [19, 29] : undefined);
    p.limb([9, 19 + top], fists[0], 4.2, body);
    p.limb([39, 19 + top], fists[1], 4.2, body);
    p.blob(fists[0][0], fists[0][1], 5, 4.4, tone(body, 1.04));
    p.blob(fists[1][0], fists[1][1], 5, 4.4, tone(body, 1.04));
    p.line([13, 27 + top], [35, 27 + top], seam);
    p.line([24, 28 + top], [24, 33 + top], seam);
    if (facing === 'down') {
      // The head sits low between the shoulders, in front of them.
      p.slab(18, 11 + top, 30, 20 + top, tone(body, 0.95));
      p.slab(18, 11 + top, 30, 13 + top, dark);
      // A core of anchor light in the chest, its veins cracking outward.
      p.line([24, 24 + top], [19, 22 + top], crystal);
      p.line([19, 22 + top], [15, 23 + top], crystal);
      p.line([24, 24 + top], [28, 21 + top], crystal);
      p.line([28, 21 + top], [33, 22 + top], crystal);
      p.line([24, 24 + top], [21, 29 + top], crystal);
      p.line([24, 24 + top], [28, 28 + top], crystal);
      p.line([28, 28 + top], [29, 32 + top], crystal);
      p.blob(24, 24 + top, 1.8, 1.6, crystal);
      if (glow) {
        p.eye(20.2, 15 + top, crystal);
        p.eye(26.2, 15 + top, crystal);
      }
    } else {
      p.line([21, 17 + top], [15, 25 + top], crystal);
      p.line([27, 17 + top], [33, 25 + top], crystal);
    }
  }
  return finishGrid(p.g, { flat: [crystal] });
}
