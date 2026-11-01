import type { EquipSlot, Stats } from '../data/types';
import type { LevelProgress } from './leveling';
import { deriveStats } from './stats';

export const SAVE_VERSION = 7;

export interface Vitals {
  hp: number;
  ki: number;
}

export interface CharacterProgress extends LevelProgress {
  id: string;
  techniques: string[];
  /** Current HP/ki; each party member keeps their own (switching doesn't heal). */
  vitals: Vitals;
}

export interface Location {
  zone: string;
  spawn?: string;
  x?: number;
  y?: number;
}

/** Everything that persists between sessions. Must stay JSON-serializable. */
export interface GameState {
  version: number;
  party: Record<string, CharacterProgress>;
  partyOrder: string[];
  activeCharacter: string;
  inventory: Record<string, number>;
  /** Anchor shards: the currency enemies drop and shops take. */
  money: number;
  equipment: Partial<Record<EquipSlot, string>>;
  collectiblesFound: string[];
  collectiblesDelivered: string[];
  openedChests: string[];
  brokenGates: string[];
  clearedGroups: string[];
  defeatedBosses: string[];
  /** Defeats per enemy id (bounties and hunts). */
  kills: Record<string, number>;
  /** Kill count of an enemy when its hunt was taken: hunts count from there, not from 0. */
  huntMarks?: Record<string, number>;
  flags: Record<string, boolean>;
  location: Location;
  playTimeMs: number;
}

export interface NewGameCharacter {
  id: string;
  startingTechniques: string[];
}

const START_STATS: Stats = { str: 1, pow: 1, end: 1, spd: 1 };

export function newCharacterProgress(c: NewGameCharacter): CharacterProgress {
  return {
    id: c.id,
    level: 1,
    exp: 0,
    stats: { ...START_STATS },
    unspentPoints: 0,
    techniques: [...c.startingTechniques],
    vitals: fullVitals(START_STATS),
  };
}

export function fullVitals(stats: Stats): Vitals {
  const d = deriveStats(stats);
  return { hp: d.maxHp, ki: d.maxKi };
}

/** Every party member back to full HP/ki (save circles, retry). */
export function restoreParty(state: GameState): GameState {
  const party = Object.fromEntries(
    Object.entries(state.party).map(([id, p]) => [id, { ...p, vitals: fullVitals(p.stats) }]),
  );
  return { ...state, party };
}

export function createNewGame(
  characters: NewGameCharacter[],
  activeId: string,
  location: Location,
): GameState {
  const party: Record<string, CharacterProgress> = {};
  for (const c of characters) party[c.id] = newCharacterProgress(c);
  return {
    version: SAVE_VERSION,
    party,
    partyOrder: characters.map((c) => c.id),
    activeCharacter: activeId,
    inventory: {},
    money: 0,
    equipment: {},
    collectiblesFound: [],
    collectiblesDelivered: [],
    openedChests: [],
    brokenGates: [],
    clearedGroups: [],
    defeatedBosses: [],
    kills: {},
    flags: {},
    location,
    playTimeMs: 0,
  };
}

export function activeProgress(state: GameState): CharacterProgress {
  const p = state.party[state.activeCharacter];
  if (!p) throw new Error(`Active character ${state.activeCharacter} not in party`);
  return p;
}
