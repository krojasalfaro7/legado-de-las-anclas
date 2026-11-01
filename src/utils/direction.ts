import type { Facing } from '../ui/humanoid';

/** Picks a 4-way facing from a vector, preferring the dominant axis. */
export function facingFromVector(x: number, y: number, fallback: Facing): Facing {
  if (x === 0 && y === 0) return fallback;
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
}

export function facingVector(f: Facing): { x: number; y: number } {
  switch (f) {
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
  }
}

/** 4-way facing closest to an angle (radians, y down). */
export function facingFromAngle(angle: number): Facing {
  return facingFromVector(Math.cos(angle), Math.sin(angle), 'down');
}
