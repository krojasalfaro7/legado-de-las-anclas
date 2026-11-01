import { describe, expect, it } from 'vitest';
import {
  columnX,
  flightCamera,
  type Mode7Camera,
  project,
  rowDepth,
  stepAltitude,
} from '../src/systems/mode7';

const cam: Mode7Camera = { x: 500, y: 400, height: 46, focal: 150, horizon: 81, width: 480 };

describe('mode 7 projection', () => {
  it('row/column sampling and point projection are inverses', () => {
    for (const row of [90, 150, 269]) {
      const z = rowDepth(cam, row);
      for (const col of [0, 240, 479]) {
        const p = project(cam, columnX(cam, col, z), cam.y - z);
        expect(p?.sx).toBeCloseTo(col);
        expect(p?.sy).toBeCloseTo(row);
      }
    }
  });

  it('far rows approach the horizon and the center column stays on the camera x', () => {
    expect(rowDepth(cam, 82)).toBeGreaterThan(rowDepth(cam, 200));
    expect(columnX(cam, 240, 300)).toBe(500);
  });

  it('points behind the camera are not drawn; altitude lifts them toward the horizon', () => {
    expect(project(cam, 500, 420)).toBeNull();
    const ground = project(cam, 500, 300);
    const high = project(cam, 500, 300, 20);
    expect(high && ground && high.sy < ground.sy).toBe(true);
    expect(ground?.scale).toBeCloseTo(1.5);
  });
});

describe('map flight altitude', () => {
  const T = { max: 140, hover: 8, climbPerSec: 80 };

  it('climbs and descends within the limits', () => {
    expect(stepAltitude(30, 1, false, 0.5, T).alt).toBe(70);
    expect(stepAltitude(135, 1, false, 0.5, T).alt).toBe(140);
    expect(stepAltitude(30, -1, false, 0.1, T).alt).toBe(22);
  });

  it('only lands by descending onto a landing spot', () => {
    expect(stepAltitude(4, -1, false, 1, T)).toEqual({ alt: 8, landed: false });
    expect(stepAltitude(4, -1, true, 1, T)).toEqual({ alt: 0, landed: true });
    expect(stepAltitude(0, 0, true, 1, T).landed).toBe(false);
  });

  it('eases back up to the hover floor after leaving a spot low', () => {
    const r = stepAltitude(2, 0, false, 0.05, T);
    expect(r.alt).toBe(6);
  });

  it('the camera pulls up and back as the flyer climbs, keeping the shadow in view', () => {
    const base = { height: 36, behind: 62, horizon: 81 };
    const low = flightCamera(0, base);
    const high = flightCamera(140, base);
    expect(high.height).toBeGreaterThan(low.height);
    expect(high.behind).toBeGreaterThan(low.behind);
    // Screen offset of the ground under the flyer stays within a 270 px view.
    for (const v of [low, high]) {
      const shadowRow = v.horizon + (v.height * 150) / v.behind;
      expect(shadowRow).toBeLessThan(250);
    }
  });
});
