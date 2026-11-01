import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { KI_TECHNIQUES } from '../src/data/kiTechniques';
import {
  chargedShot,
  focusRegenRate,
  incomingDamage,
  kiDamage,
  meleeDamage,
  shotReach,
} from '../src/systems/combat';

/** The widest internal resolution (config/constants MAX_VIEW_WIDTH). */
const GAME_WIDTH_MAX = 480;

describe('meleeDamage', () => {
  it('follows base × (1 + STR/scale) × mult − def', () => {
    const expected = Math.round(BALANCE.melee.baseDamage * (1 + 10 / BALANCE.statScale) * 1.5 - 2);
    expect(meleeDamage(10, 1, 1.5, 2)).toBe(expected);
  });

  it('applies the combo finisher multiplier', () => {
    const finisher = BALANCE.melee.comboMults[3] ?? 1;
    expect(meleeDamage(1, finisher, 1, 0)).toBeGreaterThan(meleeDamage(1, 1, 1, 0));
  });

  it('never goes below 1', () => {
    expect(meleeDamage(1, 0, 1, 999)).toBe(1);
  });
});

describe('kiDamage', () => {
  it('scales with POW and transformation', () => {
    expect(kiDamage(10, 10, 1.5, 0)).toBe(Math.round(10 * 2 * 1.5));
    expect(kiDamage(10, 0, 1, 50)).toBe(1);
  });
});

describe('incomingDamage', () => {
  it('focusing (guard + ki) is a free half guard, never worse than no guard', () => {
    const open = incomingDamage(20, 0, 'none', 50);
    const focus = incomingDamage(20, 0, 'focus', 50);
    expect(focus).toEqual({ damage: 10, kiSpent: 0, blocked: true });
    expect(focus.damage).toBeLessThan(open.damage);
    expect(incomingDamage(20, 0, 'block', 50).damage).toBeLessThan(focus.damage);
  });

  it('subtracts defense when not blocking', () => {
    expect(incomingDamage(10, 3, 'none', 50)).toEqual({ damage: 7, kiSpent: 0, blocked: false });
  });

  it('reduces damage and spends ki when blocking', () => {
    const hit = incomingDamage(20, 0, 'block', 50);
    expect(hit.blocked).toBe(true);
    expect(hit.damage).toBe(Math.round(20 * BALANCE.block.damageMult));
    expect(hit.kiSpent).toBe(BALANCE.block.kiPerHit);
  });

  it('breaks the guard without enough ki', () => {
    const hit = incomingDamage(20, 0, 'block', 1);
    expect(hit.blocked).toBe(false);
    expect(hit.damage).toBe(20);
  });
});

describe('ki blast reach', () => {
  it('blasts cross the whole screen; only ranged moves fade early', () => {
    const screenDiagonal = Math.hypot(GAME_WIDTH_MAX, 270);
    // Beams don't fly: they reach the screen edge at once (tests/beam.test.ts).
    for (const tech of Object.values(KI_TECHNIQUES).filter((t) => !t.beam)) {
      const reach = shotReach(tech);
      if (tech.range === undefined) {
        expect(reach.untilOffscreen, tech.id).toBe(true);
        // Even the slowest blast outlives a trip across the widest screen.
        expect((reach.lifetimeMs / 1000) * tech.speed, tech.id).toBeGreaterThan(screenDiagonal);
      } else {
        expect(reach.untilOffscreen).toBe(false);
        expect((reach.lifetimeMs / 1000) * tech.speed).toBeCloseTo(tech.range);
      }
    }
  });
});

describe('charged ki', () => {
  const k = { chargeDamageExtra: 1.5, chargeCostExtra: 1, chargeKnockbackExtra: 1 };
  const tech = { kiCost: 10, pierce: false };

  it('a tap costs the base and a full charge doubles the cost and pierces', () => {
    expect(chargedShot(tech, 0, 100, k)).toMatchObject({ kiCost: 10, powerMult: 1, pierce: false });
    expect(chargedShot(tech, 1, 100, k)).toMatchObject({
      kiCost: 20,
      powerMult: 2.5,
      pierce: true,
    });
  });

  it('without ki for the full charge it fires what it can afford', () => {
    const s = chargedShot(tech, 1, 15, k);
    expect(s.charge).toBeCloseTo(0.5);
    expect(s.kiCost).toBeLessThanOrEqual(15);
    expect(s.pierce).toBe(false);
  });
});

describe('character guard', () => {
  it('a sturdier guard lets less damage through', () => {
    const plain = incomingDamage(40, 0, 'block', 100);
    const sturdy = incomingDamage(40, 0, 'block', 100, 0.5);
    expect(sturdy.blocked).toBe(true);
    expect(sturdy.damage).toBeLessThan(plain.damage);
  });
});

describe('focusRegenRate', () => {
  const k = { focusRegenStartPerSec: 8, focusRegenPerSec: 24, focusRampMs: 1500 };
  it('starts as a trickle and builds to full flow', () => {
    expect(focusRegenRate(0, k)).toBe(8);
    expect(focusRegenRate(750, k)).toBe(16);
    expect(focusRegenRate(5000, k)).toBe(24);
  });
});
