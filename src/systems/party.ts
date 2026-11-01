import type { GameState } from './gameState';

/** Party members that can currently be played, in party order. */
export function playableParty(state: GameState, isEnabled: (id: string) => boolean): string[] {
  return state.partyOrder.filter((id) => state.party[id] && isEnabled(id));
}

/** Next playable member after the active one (wraps), or null if there's nobody else. */
export function nextCharacter(state: GameState, isEnabled: (id: string) => boolean): string | null {
  const list = playableParty(state, isEnabled);
  if (list.length < 2) return null;
  const i = list.indexOf(state.activeCharacter);
  return list[(i + 1) % list.length] ?? null;
}

export function switchCharacter(
  state: GameState,
  id: string,
  isEnabled: (id: string) => boolean,
): GameState {
  if (!state.party[id] || !isEnabled(id) || id === state.activeCharacter) return state;
  return { ...state, activeCharacter: id };
}
