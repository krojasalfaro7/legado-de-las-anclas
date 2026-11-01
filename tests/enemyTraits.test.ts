import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { t } from '../src/i18n';
import {
  ABSORB_HEAL_MULT,
  GUARD_DAMAGE_MULT,
  type IncomingAttack,
  isFrontal,
  resolveEnemyHit,
  shotThreatens,
} from '../src/systems/enemyTraits';

const jab: IncomingAttack = { source: 'melee', finisher: false, pierce: false };
const finisher: IncomingAttack = { source: 'melee', finisher: true, pierce: false };
const blast: IncomingAttack = { source: 'ki', finisher: false, pierce: false };
const charged: IncomingAttack = { source: 'ki', finisher: false, pierce: true };
const rock: IncomingAttack = { source: 'thrown', finisher: false, pierce: false };
const idleFront = { fromFront: true, attacking: false, guardBroken: false };

describe('resolveEnemyHit', () => {
  it('lets every hit through on enemies without traits', () => {
    expect(resolveEnemyHit(undefined, blast, idleFront)).toEqual({
      outcome: 'hit',
      damageMult: 1,
      staggers: true,
    });
  });

  it('guards light frontal hits, melee or ki', () => {
    for (const attack of [jab, blast]) {
      const res = resolveEnemyHit({ guard: true }, attack, idleFront);
      expect(res).toEqual({ outcome: 'guarded', damageMult: GUARD_DAMAGE_MULT, staggers: false });
    }
  });

  it('breaks the guard with finishers and charged blasts', () => {
    for (const attack of [finisher, charged]) {
      expect(resolveEnemyHit({ guard: true }, attack, idleFront).outcome).toBe('guardBroken');
    }
  });

  it('cannot guard from behind, mid-attack or while broken', () => {
    const guard = { guard: true };
    expect(resolveEnemyHit(guard, jab, { ...idleFront, fromFront: false }).outcome).toBe('hit');
    expect(resolveEnemyHit(guard, jab, { ...idleFront, attacking: true }).outcome).toBe('hit');
    expect(resolveEnemyHit(guard, jab, { ...idleFront, guardBroken: true }).outcome).toBe('hit');
  });

  it('absorbs every blast but not punches', () => {
    const leech = { absorbKi: true };
    expect(resolveEnemyHit(leech, charged, idleFront)).toEqual({
      outcome: 'absorbed',
      damageMult: -ABSORB_HEAL_MULT,
      staggers: false,
    });
    expect(resolveEnemyHit(leech, jab, idleFront).outcome).toBe('hit');
    // Thrown stone carries no ki: it hurts.
    expect(resolveEnemyHit(leech, rock, idleFront).outcome).toBe('hit');
  });

  it('keeps flyers out of punching reach until a blast downs them', () => {
    const flyer = { flying: true };
    const aloft = { ...idleFront, airborne: true };
    expect(resolveEnemyHit(flyer, jab, aloft)).toEqual({
      outcome: 'outOfReach',
      damageMult: 0,
      staggers: false,
    });
    expect(resolveEnemyHit(flyer, finisher, aloft).outcome).toBe('outOfReach');
    expect(resolveEnemyHit(flyer, blast, aloft)).toEqual({
      outcome: 'downed',
      damageMult: 1,
      staggers: true,
    });
    expect(resolveEnemyHit(flyer, rock, aloft).outcome).toBe('downed');
    // Landed (to strike, or shot down): an ordinary target.
    expect(resolveEnemyHit(flyer, jab, idleFront).outcome).toBe('hit');
  });
});

describe('isFrontal', () => {
  const self = { x: 0, y: 0 };
  it('accepts hits ahead and within the arc, rejects sides and back', () => {
    const right = { x: 1, y: 0 };
    expect(isFrontal(right, self, { x: 20, y: 0 })).toBe(true);
    expect(isFrontal(right, self, { x: 20, y: 10 })).toBe(true);
    expect(isFrontal(right, self, { x: 0, y: 20 })).toBe(false);
    expect(isFrontal(right, self, { x: -20, y: 0 })).toBe(false);
  });
});

describe('shotThreatens', () => {
  const self = { x: 100, y: 100 };
  it('only flags close shots moving toward the enemy', () => {
    expect(shotThreatens({ x: 60, y: 100, vx: 200, vy: 0 }, self, 60)).toBe(true);
    expect(shotThreatens({ x: 60, y: 100, vx: -200, vy: 0 }, self, 60)).toBe(false);
    expect(shotThreatens({ x: 0, y: 100, vx: 200, vy: 0 }, self, 60)).toBe(false);
  });
});

describe('trait enemies', () => {
  it('cover all four traits and describe them in the Lens', () => {
    const withTraits = Object.values(ENEMIES).filter((e) => e.traits);
    expect(withTraits.some((e) => e.traits?.guard)).toBe(true);
    expect(withTraits.some((e) => (e.traits?.dodgeChance ?? 0) > 0)).toBe(true);
    expect(withTraits.some((e) => e.traits?.absorbKi)).toBe(true);
    expect(withTraits.some((e) => e.traits?.flying)).toBe(true);
    for (const e of withTraits) {
      expect(t(e.nameKey)).not.toBe(e.nameKey);
      expect(t(e.descKey)).not.toBe(e.descKey);
    }
  });
});
