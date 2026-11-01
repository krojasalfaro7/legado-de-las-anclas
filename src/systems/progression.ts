import { fullVitals, type GameState } from './gameState';
import { addExp, expToNext } from './leveling';

export interface ExpGrant {
  state: GameState;
  gained: number;
  levelsGained: number;
  newLevel: number;
}

/** Grants EXP to a party member, applying equipment multipliers (e.g. weights). */
export function grantExp(
  state: GameState,
  characterId: string,
  baseExp: number,
  expMult = 1,
): ExpGrant {
  const current = state.party[characterId];
  if (!current) throw new Error(`Character ${characterId} not in party`);
  const gained = Math.round(baseExp * expMult);
  const { progress, levelsGained } = addExp(current, gained);
  return {
    state: { ...state, party: { ...state.party, [characterId]: progress } },
    gained,
    levelsGained,
    newLevel: progress.level,
  };
}

/**
 * Brings a character up to at least `level` (EXP-equivalent, so the stat points they earn
 * are left to spend) with full vitals; used when someone joins the party mid-story.
 */
export function raiseToLevel(state: GameState, characterId: string, level: number): GameState {
  const p = state.party[characterId];
  if (!p) throw new Error(`Character ${characterId} not in party`);
  let needed = -p.exp;
  for (let l = p.level; l < level; l++) needed += expToNext(l);
  const next = needed > 0 ? grantExp(state, characterId, needed).state : state;
  const raised = next.party[characterId] ?? p;
  return {
    ...next,
    party: { ...next.party, [characterId]: { ...raised, vitals: fullVitals(raised.stats) } },
  };
}

export interface TechniqueUnlock {
  level: number;
  technique: string;
}

/**
 * Teaches a party member every technique their level has reached (idempotent, so it also
 * catches up old saves). Returns the newly learned ids, in unlock order.
 */
export function learnByLevel(
  state: GameState,
  characterId: string,
  unlocks: readonly TechniqueUnlock[],
): { state: GameState; learned: string[] } {
  const p = state.party[characterId];
  if (!p) return { state, learned: [] };
  const learned = unlocks
    .filter((u) => u.level <= p.level && !p.techniques.includes(u.technique))
    .map((u) => u.technique);
  if (learned.length === 0) return { state, learned };
  const next = { ...p, techniques: [...p.techniques, ...learned] };
  return { state: { ...state, party: { ...state.party, [characterId]: next } }, learned };
}
