import { BALANCE } from '../config/balance';
import type { StatProgress } from './stats';

export interface LevelProgress extends StatProgress {
  exp: number;
}

export function expToNext(level: number): number {
  return Math.round(BALANCE.exp.base * BALANCE.exp.growth ** (level - 1));
}

export interface ExpResult<T extends LevelProgress> {
  progress: T;
  levelsGained: number;
}

/** Adds EXP, carrying overflow across several level-ups. EXP stops at max level. */
export function addExp<T extends LevelProgress>(
  p: T,
  amount: number,
  maxLevel: number = BALANCE.maxLevel,
): ExpResult<T> {
  let { level, exp, unspentPoints } = p;
  let levelsGained = 0;
  if (level >= maxLevel) return { progress: { ...p, exp: 0 }, levelsGained: 0 };
  exp += Math.max(0, Math.floor(amount));
  while (level < maxLevel && exp >= expToNext(level)) {
    exp -= expToNext(level);
    level++;
    levelsGained++;
    unspentPoints += BALANCE.statPointsPerLevel;
  }
  if (level >= maxLevel) exp = 0;
  return { progress: { ...p, level, exp, unspentPoints }, levelsGained };
}
