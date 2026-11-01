import { describe, expect, it } from 'vitest';
import { PROP_CLEARANCE, tileStopsShot, traceRay } from '../src/systems/shotBlock';

const GROUND = 12;
const FLYING = PROP_CLEARANCE + 4;

describe('tileStopsShot', () => {
  const wall = { name: 'rock-wall', tall: true };
  const tree = { name: 'tree', tall: true };
  const crystal = { name: 'crystal', tall: false };

  it('walls stop every blast over the whole tile', () => {
    expect(tileStopsShot(wall, 0, 0, 16, GROUND)).toBe(true);
    expect(tileStopsShot(wall, 15.5, 15.5, 16, FLYING)).toBe(true);
  });

  it('a tree stops blasts at its trunk, not beside it', () => {
    expect(tileStopsShot(tree, 8, 2, 16, GROUND)).toBe(true);
    expect(tileStopsShot(tree, 2, 8, 16, GROUND)).toBe(false);
  });

  it('waist-high props stop grounded blasts but not ones fired in flight', () => {
    expect(tileStopsShot(crystal, 8, 8, 16, GROUND)).toBe(true);
    expect(tileStopsShot(crystal, 8, 8, 16, FLYING)).toBe(false);
    expect(tileStopsShot(crystal, 1, 8, 16, GROUND)).toBe(false);
  });
});

describe('traceRay', () => {
  const wallAt = (x0: number) => (x: number) => x >= x0;
  it('stops at the first blocked sample', () => {
    expect(traceRay({ x: 0, y: 0 }, 0, 200, 2, wallAt(50))).toBe(50);
  });

  it('runs the full length when nothing is in the way', () => {
    expect(traceRay({ x: 0, y: 0 }, 0, 200, 2, () => false)).toBe(200);
  });
});
