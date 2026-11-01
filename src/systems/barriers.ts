import type { GameState } from './gameState';

/**
 * Barriers planted in zones and opened later:
 * - `level`: colored barrier only a given character at level >= N breaks (interact/attack).
 * - `boulder`: rock that only a given character's punches crack (Okun's strength).
 * - `seal`: story seal that opens by itself once a story flag is set.
 * - `vent`: a wind vent jammed by pressure; Iolé's gust clears it (interact as Iolé).
 * - `crawl`: a crack too low for anyone but Nilo, who slips through and opens it from behind.
 */
export type BarrierKind = 'level' | 'boulder' | 'seal' | 'vent' | 'crawl';

/** Barriers opened by interacting as the right character (like level barriers). */
export const FIELD_ABILITY_KINDS: readonly BarrierKind[] = ['level', 'vent', 'crawl'];

export interface BarrierRule {
  kind: BarrierKind;
  character: string;
  level: number;
  /** Seals: the story flag that opens them. */
  openFlag?: string;
}

export type BarrierVerdict = 'open' | 'wrongCharacter' | 'lowLevel' | 'sealed';

export function barrierVerdict(rule: BarrierRule, state: GameState): BarrierVerdict {
  if (rule.kind === 'seal') return rule.openFlag && state.flags[rule.openFlag] ? 'open' : 'sealed';
  if (state.activeCharacter !== rule.character) return 'wrongCharacter';
  const level = state.party[rule.character]?.level ?? 0;
  return level >= rule.level ? 'open' : 'lowLevel';
}

/** Punches a boulder takes; a chain finisher counts double. */
export const BOULDER_HITS = 3;

export function boulderDamage(finisher: boolean): number {
  return finisher ? 2 : 1;
}
