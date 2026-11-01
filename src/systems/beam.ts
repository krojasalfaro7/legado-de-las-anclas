/**
 * Sustained ki beams (pure): the beam runs from the hands along a fixed angle, stops at the
 * first enemy it touches and keeps hitting it in ticks, pushing it back. With nothing in the
 * way it reaches the edge of the screen.
 */
export interface BeamTarget<T> {
  x: number;
  y: number;
  /** Body radius: the beam touches it when its edge comes this close to the center. */
  r: number;
  ref: T;
}

export interface BeamContact<T> {
  ref: T;
  /** Distance from the origin to where the beam meets the target's body. */
  dist: number;
}

/** First target along the ray within `maxLen`, or null. */
export function beamContact<T>(
  origin: { x: number; y: number },
  angle: number,
  maxLen: number,
  halfWidth: number,
  targets: ReadonlyArray<BeamTarget<T>>,
): BeamContact<T> | null {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best: BeamContact<T> | null = null;
  for (const t of targets) {
    const rx = t.x - origin.x;
    const ry = t.y - origin.y;
    const along = rx * dx + ry * dy;
    if (along <= 0) continue;
    const across = Math.abs(rx * dy - ry * dx);
    const reach = t.r + halfWidth;
    if (across > reach) continue;
    // Where the beam's center line enters the body circle (grown by the beam's half width).
    const dist = Math.max(0, along - Math.sqrt(reach * reach - across * across));
    if (dist > maxLen) continue;
    if (!best || dist < best.dist) best = { ref: t.ref, dist };
  }
  return best;
}

/** Length of the ray from `origin` until it leaves `view` (origin assumed inside). */
export function rayToEdge(
  origin: { x: number; y: number },
  angle: number,
  view: { x: number; y: number; width: number; height: number },
): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const tx =
    dx > 1e-6
      ? (view.x + view.width - origin.x) / dx
      : dx < -1e-6
        ? (view.x - origin.x) / dx
        : Number.POSITIVE_INFINITY;
  const ty =
    dy > 1e-6
      ? (view.y + view.height - origin.y) / dy
      : dy < -1e-6
        ? (view.y - origin.y) / dy
        : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(tx, ty));
}

/**
 * Whether a firing beam should be cut off: the button was let go (a tap still gets
 * `minHoldMs`), it ran `maxHoldMs`, or the caster is out of ki.
 */
export function beamShouldStop(
  beam: { minHoldMs: number; maxHoldMs: number },
  firingMs: number,
  held: boolean,
  kiLeft: number,
): boolean {
  if (firingMs >= beam.maxHoldMs || kiLeft <= 0) return true;
  return !held && firingMs >= beam.minHoldMs;
}

/**
 * How fast a beam shoves its pinned target back (px/s): the beam's power against the target's
 * weight (`resist`, the knockback resistance). Light foes slide back briskly but never fly off;
 * the heaviest still give ground, slowly. Bosses dig in a little more.
 */
export function beamPushSpeed(power: number, resist: number, boss: boolean): number {
  const give = 1 - 0.8 * Math.min(1, Math.max(0, resist));
  const speed = power * 0.55 * give * (boss ? 0.8 : 1);
  return Math.min(BEAM_PUSH_MAX, Math.max(BEAM_PUSH_MIN, speed));
}

/** Seconds the push takes to build up: heavy targets resist, then start to give way. */
export function beamPushInertia(resist: number): number {
  return 0.12 + 0.6 * Math.min(1, Math.max(0, resist));
}

/** Eases `v` toward `target` with time constant `tau` over `dt` seconds. */
export function approach(v: number, target: number, dt: number, tau: number): number {
  return v + (target - v) * Math.min(1, dt / tau);
}

const BEAM_PUSH_MIN = 10;
const BEAM_PUSH_MAX = 60;
