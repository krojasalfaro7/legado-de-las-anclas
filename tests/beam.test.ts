import { describe, expect, it } from 'vitest';
import { KI_TECHNIQUES } from '../src/data/kiTechniques';
import {
  approach,
  beamContact,
  beamPushInertia,
  beamPushSpeed,
  beamShouldStop,
  rayToEdge,
} from '../src/systems/beam';

const origin = { x: 0, y: 0 };
const target = (x: number, y: number, ref: string, r = 6) => ({ x, y, r, ref });

describe('beamContact', () => {
  it('stops at the nearest body along the beam', () => {
    const hit = beamContact(origin, 0, 300, 3, [target(120, 0, 'far'), target(60, 2, 'near')]);
    expect(hit?.ref).toBe('near');
    // Meets the body's edge, not its center.
    expect(hit?.dist).toBeLessThan(60);
    expect(hit?.dist).toBeGreaterThan(50);
  });

  it('ignores bodies behind, beside or past the end', () => {
    expect(beamContact(origin, 0, 300, 3, [target(-40, 0, 'behind')])).toBeNull();
    expect(beamContact(origin, 0, 300, 3, [target(80, 20, 'beside')])).toBeNull();
    expect(beamContact(origin, 0, 50, 3, [target(80, 0, 'past')])).toBeNull();
  });

  it('works along any angle', () => {
    const hit = beamContact(origin, Math.PI / 2, 300, 3, [target(0, 90, 'below')]);
    expect(hit?.ref).toBe('below');
  });
});

describe('rayToEdge', () => {
  const view = { x: 0, y: 0, width: 400, height: 200 };
  it('measures to the side the beam points at', () => {
    expect(rayToEdge({ x: 100, y: 100 }, 0, view)).toBeCloseTo(300);
    expect(rayToEdge({ x: 100, y: 100 }, Math.PI, view)).toBeCloseTo(100);
    expect(rayToEdge({ x: 100, y: 100 }, Math.PI / 2, view)).toBeCloseTo(100);
    expect(rayToEdge({ x: 100, y: 100 }, Math.PI / 4, view)).toBeCloseTo(Math.SQRT2 * 100);
  });
});

describe('beam techniques', () => {
  it('fire while the button is held and stop when it is released', () => {
    const beam = { minHoldMs: 350, maxHoldMs: 3000 };
    expect(beamShouldStop(beam, 1000, true, 50)).toBe(false);
    expect(beamShouldStop(beam, 1000, false, 50)).toBe(true);
    // A tap still shows a short beam.
    expect(beamShouldStop(beam, 200, false, 50)).toBe(false);
    expect(beamShouldStop(beam, 3000, true, 50)).toBe(true);
    expect(beamShouldStop(beam, 1000, true, 0)).toBe(true);
  });

  it('only true ki/sky users have one, and every beam ticks several times', () => {
    const beams = Object.values(KI_TECHNIQUES).filter((t) => t.beam);
    expect(beams.map((t) => t.id)).toEqual(['lighthouseBeam', 'skyLance']);
    for (const t of beams) {
      const b = t.beam;
      if (!b) continue;
      expect(b.maxHoldMs / b.tickMs, t.id).toBeGreaterThanOrEqual(5);
      expect(b.maxHoldMs).toBeGreaterThan(b.minHoldMs);
      expect(b.kiPerSec).toBeGreaterThan(0);
    }
  });
});

describe('beam push', () => {
  it('shoves light targets faster than heavy ones, within bounds', () => {
    const light = beamPushSpeed(90, 0, false);
    const mid = beamPushSpeed(90, 0.5, false);
    const heavy = beamPushSpeed(90, 0.95, false);
    expect(light).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(heavy);
    expect(light).toBeLessThanOrEqual(60);
    expect(heavy).toBeGreaterThanOrEqual(10);
  });

  it('bosses give less ground than a regular foe of the same weight', () => {
    expect(beamPushSpeed(90, 0.5, true)).toBeLessThan(beamPushSpeed(90, 0.5, false));
  });

  it('heavy targets take longer to start sliding', () => {
    const dt = 0.1;
    const light = approach(0, 50, dt, beamPushInertia(0));
    const heavy = approach(0, 50, dt, beamPushInertia(0.95));
    expect(light).toBeGreaterThan(heavy);
    expect(approach(0, 50, 10, beamPushInertia(0.95))).toBe(50);
  });
});
