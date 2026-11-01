import { CHARACTERS } from '../src/data/characters';
import { createNewGame, type GameState } from '../src/systems/gameState';

/** Mirrors services/session.freshGame without importing browser-bound modules. */
export function freshGameForTests(): GameState {
  const chars = Object.values(CHARACTERS).map((c) => ({
    id: c.id,
    startingTechniques: c.startingTechniques,
  }));
  return createNewGame(chars, 'tavi', { zone: 'hub' });
}
