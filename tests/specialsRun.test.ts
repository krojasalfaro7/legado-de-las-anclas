import { describe, expect, it } from 'vitest';
import { initialRun, runSpeedMult, stepRun } from '../src/systems/run';
import { cycleIndex, specialsOf } from '../src/systems/specials';

describe('special selector', () => {
  it('lists techniques first, then transformations', () => {
    expect(specialsOf(['spark', 'fan'], [{ id: 'anchorAwakening' }])).toEqual([
      { kind: 'technique', id: 'spark' },
      { kind: 'technique', id: 'fan' },
      { kind: 'transform', id: 'anchorAwakening' },
    ]);
  });

  it('cycles with wrap-around both ways', () => {
    expect(cycleIndex(2, 3)).toBe(0);
    expect(cycleIndex(0, 3, -1)).toBe(2);
    expect(cycleIndex(5, 0)).toBe(0);
  });
});

describe('double-tap run', () => {
  const T = { doubleTapMs: 260, burstMs: 150 };

  it('two taps of the same direction start a run with a burst', () => {
    let s = stepRun(initialRun(), 'right', true, 0, T);
    s = stepRun(s, null, false, 80, T);
    s = stepRun(s, 'right', true, 200, T);
    expect(s.running).toBe(true);
    expect(runSpeedMult(s, 250, 1.5, 2.3)).toBe(2.3);
    expect(runSpeedMult(s, 400, 1.5, 2.3)).toBe(1.5);
  });

  it('slow taps or different directions do not run', () => {
    let s = stepRun(initialRun(), 'right', true, 0, T);
    s = stepRun(s, 'right', true, 400, T);
    expect(s.running).toBe(false);
    s = stepRun(s, 'left', true, 450, T);
    expect(s.running).toBe(false);
  });

  it('keeps running while turning and stops when every direction is released', () => {
    let s = stepRun(initialRun(), 'up', true, 0, T);
    s = stepRun(s, 'up', true, 150, T);
    s = stepRun(s, 'left', true, 300, T);
    expect(s.running).toBe(true);
    s = stepRun(s, null, false, 320, T);
    expect(s.running).toBe(false);
    expect(runSpeedMult(s, 330, 1.5, 2.3)).toBe(1);
  });
});
