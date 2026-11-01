import { BALANCE } from '../config/balance';
import type { StatName, Stats } from '../data/types';

export interface DerivedStats {
  maxHp: number;
  maxKi: number;
  defense: number;
  /** Movement multiplier from SPD. */
  speedMult: number;
  /** Melee recovery multiplier from SPD (lower = faster strings). */
  recoveryMult: number;
}

export const STAT_NAMES: readonly StatName[] = ['str', 'pow', 'end', 'spd'];

export function deriveStats(stats: Stats, defBonus = 0): DerivedStats {
  const spd = Math.max(0, (stats.spd ?? 1) - 1);
  return {
    maxHp: BALANCE.baseHp + stats.end * BALANCE.hpPerEnd,
    maxKi: BALANCE.baseKi + stats.pow * BALANCE.kiPerPow,
    defense: stats.end * BALANCE.defPerEnd + defBonus,
    speedMult: Math.min(BALANCE.maxSpdSpeedMult, 1 + spd * BALANCE.speedPerSpd),
    recoveryMult: Math.max(BALANCE.minRecoveryMult, 1 - spd * BALANCE.recoveryPerSpd),
  };
}

export interface StatProgress {
  level: number;
  stats: Stats;
  unspentPoints: number;
}

/** A stat can be raised if there are points left and it would not exceed the level. */
export function canAllocate(p: StatProgress, stat: StatName): boolean {
  return p.unspentPoints > 0 && p.stats[stat] < p.level;
}

export function allocatePoint<T extends StatProgress>(p: T, stat: StatName): T {
  if (!canAllocate(p, stat)) return p;
  return {
    ...p,
    stats: { ...p.stats, [stat]: p.stats[stat] + 1 },
    unspentPoints: p.unspentPoints - 1,
  };
}

/** True when no stat can take another point (all capped by level), even with points left. */
export function allCapped(p: StatProgress): boolean {
  return STAT_NAMES.every((s) => p.stats[s] >= p.level);
}
