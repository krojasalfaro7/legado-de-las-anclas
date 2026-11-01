import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { CHARACTERS } from '../src/data/characters';
import { KI_TECHNIQUES } from '../src/data/kiTechniques';
import { es } from '../src/i18n/es';
import { createNewGame } from '../src/systems/gameState';
import { addExp, expToNext, type LevelProgress } from '../src/systems/leveling';
import { grantExp, learnByLevel, raiseToLevel } from '../src/systems/progression';
import { allCapped, allocatePoint, canAllocate, deriveStats } from '../src/systems/stats';
import { canTransform, tickTransformation } from '../src/systems/transformation';
import { freshGameForTests } from './helpers';

const fresh = (): LevelProgress => ({
  level: 1,
  exp: 0,
  stats: { str: 1, pow: 1, end: 1, spd: 1 },
  unspentPoints: 0,
});

describe('expToNext', () => {
  it('grows monotonically (gentle exponential)', () => {
    expect(expToNext(1)).toBe(BALANCE.exp.base);
    for (let l = 1; l < 50; l++) expect(expToNext(l + 1)).toBeGreaterThanOrEqual(expToNext(l));
    expect(expToNext(2) / expToNext(1)).toBeCloseTo(BALANCE.exp.growth, 1);
  });
});

describe('addExp', () => {
  it('levels up and grants stat points', () => {
    const { progress, levelsGained } = addExp(fresh(), expToNext(1));
    expect(levelsGained).toBe(1);
    expect(progress.level).toBe(2);
    expect(progress.exp).toBe(0);
    expect(progress.unspentPoints).toBe(BALANCE.statPointsPerLevel);
  });

  it('carries overflow across multiple levels', () => {
    const amount = expToNext(1) + expToNext(2) + 3;
    const { progress, levelsGained } = addExp(fresh(), amount);
    expect(levelsGained).toBe(2);
    expect(progress.level).toBe(3);
    expect(progress.exp).toBe(3);
  });

  it('stops at the max level', () => {
    const { progress } = addExp(fresh(), 1_000_000_000, 5);
    expect(progress.level).toBe(5);
    expect(progress.exp).toBe(0);
  });

  it('ignores negative amounts', () => {
    expect(addExp(fresh(), -50).progress.exp).toBe(0);
  });
});

describe('stat allocation', () => {
  it('cannot raise a stat above the current level', () => {
    const p = { ...fresh(), unspentPoints: 5 };
    expect(canAllocate(p, 'str')).toBe(false);
    const leveled = { ...p, level: 2 };
    const once = allocatePoint(leveled, 'str');
    expect(once.stats.str).toBe(2);
    expect(once.unspentPoints).toBe(4);
    const twice = allocatePoint(once, 'str');
    expect(twice).toBe(once);
  });

  it('needs unspent points', () => {
    const p = { ...fresh(), level: 3 };
    expect(canAllocate(p, 'pow')).toBe(false);
    expect(allocatePoint(p, 'pow')).toBe(p);
  });

  it('detects when every stat is capped', () => {
    expect(allCapped(fresh())).toBe(true);
    expect(allCapped({ ...fresh(), level: 2 })).toBe(false);
  });
});

describe('deriveStats', () => {
  it('derives HP from END, ki from POW and defense from END + bonus', () => {
    const d = deriveStats({ str: 3, pow: 4, end: 5, spd: 1 }, 2);
    expect(d.maxHp).toBe(BALANCE.baseHp + 5 * BALANCE.hpPerEnd);
    expect(d.maxKi).toBe(BALANCE.baseKi + 4 * BALANCE.kiPerPow);
    expect(d.defense).toBeCloseTo(5 * BALANCE.defPerEnd + 2);
    expect(d.speedMult).toBe(1);
    expect(d.recoveryMult).toBe(1);
  });

  it('SPD speeds up movement and melee recovery, within limits', () => {
    const d = deriveStats({ str: 1, pow: 1, end: 1, spd: 21 });
    expect(d.speedMult).toBeCloseTo(1 + 20 * BALANCE.speedPerSpd);
    expect(d.recoveryMult).toBeCloseTo(1 - 20 * BALANCE.recoveryPerSpd);
    const maxed = deriveStats({ str: 1, pow: 1, end: 1, spd: 200 });
    expect(maxed.speedMult).toBe(BALANCE.maxSpdSpeedMult);
    expect(maxed.recoveryMult).toBe(BALANCE.minRecoveryMult);
  });
});

describe('transformation', () => {
  it('drains ki per second and cancels at 0', () => {
    expect(tickTransformation(10, 4, 500)).toEqual({ ki: 8, active: true });
    expect(tickTransformation(1, 4, 500)).toEqual({ ki: 0, active: false });
  });

  it('requires a minimum ki to activate', () => {
    expect(canTransform(19, 20)).toBe(false);
    expect(canTransform(20, 20)).toBe(true);
  });
});

describe('grantExp', () => {
  it('applies the equipment EXP multiplier', () => {
    const state = createNewGame([{ id: 'tavi', startingTechniques: [] }], 'tavi', { zone: 'x' });
    const r = grantExp(state, 'tavi', 10, 1.5);
    expect(r.gained).toBe(15);
    expect(r.state.party.tavi?.exp).toBe(15);
    expect(state.party.tavi?.exp).toBe(0);
  });
});

describe('techniques learned by level', () => {
  const unlocks = [
    { level: 6, technique: 'mailBarrage' },
    { level: 12, technique: 'tideDisc' },
  ];

  it('learns what the level reached, once, in unlock order', () => {
    let state = freshGameForTests();
    expect(learnByLevel(state, 'tavi', unlocks).learned).toEqual([]);
    state = raiseToLevel(state, 'tavi', 12);
    const first = learnByLevel(state, 'tavi', unlocks);
    expect(first.learned).toEqual(['mailBarrage', 'tideDisc']);
    expect(first.state.party.tavi?.techniques).toEqual(
      expect.arrayContaining(['spark', 'mailBarrage', 'tideDisc']),
    );
    expect(learnByLevel(first.state, 'tavi', unlocks).learned).toEqual([]);
  });

  it('every unlock names a real technique with a name, above the starting kit', () => {
    for (const c of Object.values(CHARACTERS)) {
      for (const u of c.techniqueUnlocks) {
        const tech = KI_TECHNIQUES[u.technique];
        expect(tech, `${c.id}: ${u.technique}`).toBeDefined();
        if (tech) expect(es[tech.nameKey], u.technique).toBeDefined();
        expect(c.startingTechniques).not.toContain(u.technique);
      }
    }
    for (const tech of Object.values(KI_TECHNIQUES)) {
      if (tech.burst) expect(tech.burst.shots).toBeGreaterThan(1);
    }
  });
});
