export interface TransformTick {
  ki: number;
  active: boolean;
}

/** Drains ki while transformed; the form is cancelled when ki hits 0. */
export function tickTransformation(ki: number, drainPerSec: number, dtMs: number): TransformTick {
  const next = ki - (drainPerSec * dtMs) / 1000;
  if (next <= 0) return { ki: 0, active: false };
  return { ki: next, active: true };
}

export function canTransform(ki: number, minKi: number): boolean {
  return ki >= minKi;
}
