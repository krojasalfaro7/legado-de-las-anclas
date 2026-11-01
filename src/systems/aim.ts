/**
 * Aiming for melee and ki. Sprites only face 4 ways, but the stick/arrows give 8, and enemies
 * are rarely on the exact axis: a soft lock bends the shot toward the best target in a cone.
 */
export interface Point {
  x: number;
  y: number;
}

export interface AimOptions {
  /** Half-angle of the cone around the base direction, in degrees. */
  coneDeg: number;
  range: number;
}

/** Angle difference folded into [0, π]. */
export function angleGap(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

/** Base direction: the held direction (8-way) if any, otherwise the facing. */
export function baseAim(move: Point, facing: Point): number {
  const v = move.x !== 0 || move.y !== 0 ? move : facing;
  return Math.atan2(v.y, v.x);
}

/**
 * The target inside the cone that best matches `base` (angular gap first, distance as a
 * tie-breaker), or null. Targets closer than 1 px count as straight ahead.
 */
export function pickTarget<T extends Point>(
  from: Point,
  base: number,
  targets: readonly T[],
  opts: AimOptions,
): T | null {
  const cone = (opts.coneDeg * Math.PI) / 180;
  let best: T | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const t of targets) {
    const dx = t.x - from.x;
    const dy = t.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist > opts.range) continue;
    const gap = dist < 1 ? 0 : angleGap(Math.atan2(dy, dx), base);
    if (gap > cone) continue;
    const score = gap / cone + dist / opts.range / 2;
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}
