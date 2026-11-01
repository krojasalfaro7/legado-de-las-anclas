import { CHARACTERS } from '../data/characters';
import { DEFAULT_ZONE } from '../data/zones';
import { createNewGame, type GameState } from '../systems/gameState';

export const DEFAULT_CHARACTER = 'tavi';

export function freshGame(): GameState {
  const chars = Object.values(CHARACTERS).map((c) => ({
    id: c.id,
    startingTechniques: c.startingTechniques,
  }));
  return createNewGame(chars, DEFAULT_CHARACTER, { zone: DEFAULT_ZONE });
}

/** The live game state shared by every scene. Saving serializes `state` as-is. */
class Session {
  state: GameState = freshGame();

  reset(): void {
    this.state = freshGame();
  }

  load(state: GameState): void {
    this.state = state;
  }
}

export const session = new Session();
