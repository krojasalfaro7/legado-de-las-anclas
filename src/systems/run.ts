/**
 * Double-tap a direction to run: a short burst, then a faster gait while any direction stays
 * held. Releasing every direction ends it.
 */
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface RunState {
  lastDir: Dir | null;
  lastAt: number;
  running: boolean;
  /** Burst end time (extra speed right after the double tap). */
  burstUntil: number;
}

export interface RunTiming {
  doubleTapMs: number;
  burstMs: number;
}

export function initialRun(): RunState {
  return { lastDir: null, lastAt: Number.NEGATIVE_INFINITY, running: false, burstUntil: 0 };
}

/** `tapped` is the direction pressed this frame (edge), if any. */
export function stepRun(
  s: RunState,
  tapped: Dir | null,
  moving: boolean,
  now: number,
  t: RunTiming,
): RunState {
  if (!moving && !tapped) return s.running ? { ...s, running: false } : s;
  if (!tapped) return s;
  const double = tapped === s.lastDir && now - s.lastAt <= t.doubleTapMs;
  if (double) return { lastDir: null, lastAt: now, running: true, burstUntil: now + t.burstMs };
  return { ...s, lastDir: tapped, lastAt: now };
}

/** Speed multiplier for the current frame. */
export function runSpeedMult(s: RunState, now: number, runMult: number, burstMult: number): number {
  if (!s.running) return 1;
  return now < s.burstUntil ? burstMult : runMult;
}
