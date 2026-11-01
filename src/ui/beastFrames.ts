/**
 * Creatures that aren't people or golems: marsh crabs, cave hounds and the wisps that leak out
 * of El Fondo. Pure grid painters like the humanoid and golem ones; they share the humanoid
 * frame (24×32) and stand on its last row, so they use the humanoid feet box and shadow.
 */
// Explicit `.ts` extensions: the asset scripts import this module with plain Node.
import { fill, finishGrid, type Grid, newGrid, tone } from './humanoid.ts';
import { type Facing, FRAME_SIZES, type Pose } from './spriteSpec.ts';

export type BeastShape = 'crab' | 'hound' | 'wisp';

export interface BeastLook {
  shape: BeastShape;
  body: number;
  /** Underside, claws or inner glow. */
  belly: number;
  /** Eyes (drawn flat, never shaded). */
  eye: number;
  /** Boss-sized (3x, the giant frame): only crabs, whose art fits the frame's lower rows. */
  giant?: boolean;
}

const W = FRAME_SIZES.humanoid.w;
const H = FRAME_SIZES.humanoid.h;

function bob(pose: Pose): number {
  return pose === 'idle2' || pose === 'walk2' || pose === 'walk4' ? 1 : 0;
}

/** Front/back: a wide shell, claws raised to the sides; side: shell with one big claw ahead. */
function crab(g: Grid, look: BeastLook, facing: Facing, pose: Pose): void {
  const b = H - 1;
  const dy = bob(pose);
  const legs = tone(look.body, 0.7);
  const attack = pose === 'attack' || pose === 'attack2' || pose === 'attack3';
  const step = pose === 'walk1' || pose === 'walk3' ? 1 : 0;
  if (facing === 'left' || facing === 'right') {
    for (const x of [8, 11, 14]) fill(g, x + step, b - 2, 1, 3, legs);
    fill(g, 7, b - 8 + dy, 12, 6, look.body);
    fill(g, 8, b - 9 + dy, 9, 1, look.body);
    fill(g, 9, b - 3 + dy, 8, 1, look.belly);
    // Claw out front (the frame is drawn facing left).
    const reach = attack ? -3 : 0;
    fill(g, 3 + reach, b - 7 + dy, 5, 4, look.belly);
    fill(g, 2 + reach, b - 8 + dy, 3, 2, look.belly);
    fill(g, 7, b - 11 + dy, 1, 3, look.body);
    fill(g, 7, b - 12 + dy, 1, 1, look.eye);
  } else {
    for (const x of [5, 8, 15, 18]) fill(g, x, b - 2 + (x % 2 ? step : 0), 1, 3, legs);
    fill(g, 6, b - 8 + dy, 12, 6, look.body);
    fill(g, 7, b - 9 + dy, 10, 1, look.body);
    fill(g, 7, b - 3 + dy, 10, 1, look.belly);
    const up = attack ? 3 : 0;
    fill(g, 1, b - 9 - up + dy, 5, 4, look.belly);
    fill(g, 18, b - 9 - up + dy, 5, 4, look.belly);
    fill(g, 2, b - 10 - up + dy, 2, 1, look.belly);
    fill(g, 20, b - 10 - up + dy, 2, 1, look.belly);
    if (facing === 'down') {
      fill(g, 9, b - 11 + dy, 1, 2, look.body);
      fill(g, 14, b - 11 + dy, 1, 2, look.body);
      fill(g, 9, b - 12 + dy, 1, 1, look.eye);
      fill(g, 14, b - 12 + dy, 1, 1, look.eye);
    }
  }
}

/** A lean four-legged hunter: long body, low head, a tail that lifts when it lunges. */
function hound(g: Grid, look: BeastLook, facing: Facing, pose: Pose): void {
  const b = H - 1;
  const dy = bob(pose);
  const legs = tone(look.body, 0.75);
  const lunge = pose === 'attack' || pose === 'attack2' || pose === 'attack3';
  const a = pose === 'walk1' ? 1 : pose === 'walk3' ? -1 : 0;
  if (facing === 'left' || facing === 'right') {
    fill(g, 6 + a, b - 4, 2, 5, legs);
    fill(g, 9 - a, b - 4, 2, 5, legs);
    fill(g, 15 + a, b - 4, 2, 5, legs);
    fill(g, 18 - a, b - 4, 2, 5, legs);
    fill(g, 6, b - 10 + dy, 14, 6, look.body);
    fill(g, 7, b - 5 + dy, 12, 1, look.belly);
    // Head forward (left), lower and further out when lunging.
    const hx = lunge ? 0 : 2;
    const hy = lunge ? 1 : 0;
    fill(g, hx, b - 12 + dy + hy, 7, 5, look.body);
    fill(g, hx - 1, b - 9 + dy + hy, 3, 2, look.belly);
    fill(g, hx + 4, b - 14 + dy + hy, 2, 2, look.body);
    fill(g, hx + 2, b - 11 + dy + hy, 1, 1, look.eye);
    fill(g, 20, b - 12 - (lunge ? 2 : 0) + dy, 3, 2, look.body);
  } else {
    fill(g, 7, b - 4 + Math.max(0, a), 2, 5, legs);
    fill(g, 15, b - 4 + Math.max(0, -a), 2, 5, legs);
    fill(g, 6, b - 11 + dy, 12, 8, look.body);
    if (facing === 'down') {
      fill(g, 8, b - 15 + dy + (lunge ? 1 : 0), 8, 7, look.body);
      fill(g, 10, b - 10 + dy + (lunge ? 1 : 0), 4, 2, look.belly);
      fill(g, 8, b - 17 + dy, 2, 2, look.body);
      fill(g, 14, b - 17 + dy, 2, 2, look.body);
      fill(g, 9, b - 13 + dy, 1, 1, look.eye);
      fill(g, 14, b - 13 + dy, 1, 1, look.eye);
    } else {
      fill(g, 9, b - 15 + dy, 6, 5, look.body);
      fill(g, 11, b - 13 + dy, 2, 6, tone(look.body, 0.85));
    }
  }
}

/** A floating knot of dark light with two eyes; it bobs and never touches the ground. */
function wisp(g: Grid, look: BeastLook, facing: Facing, pose: Pose): void {
  const frame = ['idle', 'walk1', 'walk3', 'fly'].includes(pose) ? 0 : 1;
  const cy = H - 12 + frame;
  const r = pose === 'attack' || pose === 'attack3' ? 8 : 7;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y * 1.3 > r * r) continue;
      fill(g, 12 + x, cy + y, 1, 1, x * x + y * y < (r * r) / 3 ? look.belly : look.body);
    }
  }
  // Wisps trail into a point below (no feet), still touching the frame's last row.
  for (let i = 0; i < H - cy - r; i++)
    fill(g, 11 + ((i + frame) % 3) - 1, cy + r + i, 2, 1, look.body);
  if (facing === 'up') return;
  const ex = facing === 'left' ? -2 : facing === 'right' ? 2 : 0;
  fill(g, 9 + ex, cy - 2, 2, 2, look.eye);
  fill(g, 14 + ex, cy - 2, 2, 2, look.eye);
}

export function beastFrame(look: BeastLook, facing: Facing, pose: Pose): Grid {
  const g = newGrid(W, H);
  // Side views are painted facing left; the right is its mirror.
  const paintFacing = facing === 'right' ? 'left' : facing;
  if (look.shape === 'crab') crab(g, look, paintFacing, pose);
  else if (look.shape === 'hound') hound(g, look, paintFacing, pose);
  else wisp(g, look, paintFacing, pose);
  const out = finishGrid(g, { flat: [look.eye, ...(look.shape === 'wisp' ? [look.belly] : [])] });
  return facing === 'right' ? out.map((row) => [...row].reverse()) : out;
}
