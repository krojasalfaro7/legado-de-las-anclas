import type { GameState } from '../systems/gameState';
import { parseSave, serializeSave } from '../systems/save';

const SAVE_KEY = 'anclas.save';
const OPTIONS_KEY = 'anclas.options';

export interface Options {
  volume: number;
  showControls: boolean;
}

const DEFAULT_OPTIONS: Options = { volume: 0.6, showControls: true };

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState): boolean {
  try {
    storage()?.setItem(SAVE_KEY, serializeSave(state));
    return storage() !== null;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  return parseSave(storage()?.getItem(SAVE_KEY) ?? null);
}

export function hasSave(): boolean {
  return loadGame() !== null;
}

/**
 * Fills missing fields and clamps the volume to 0..1 in tenths. An out-of-range volume once
 * got persisted and broke the options tab on every open, so stored values are repaired too.
 */
export function normalizeOptions(raw: Partial<Options>): Options {
  const o = { ...DEFAULT_OPTIONS, ...raw };
  const volume = Number.isFinite(o.volume) ? o.volume : DEFAULT_OPTIONS.volume;
  return {
    volume: Math.round(Math.max(0, Math.min(1, volume)) * 10) / 10,
    showControls: o.showControls !== false,
  };
}

export function loadOptions(): Options {
  try {
    const raw = storage()?.getItem(OPTIONS_KEY);
    return normalizeOptions(raw ? (JSON.parse(raw) as Partial<Options>) : {});
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

export function saveOptions(options: Options): void {
  try {
    storage()?.setItem(OPTIONS_KEY, JSON.stringify(options));
  } catch {
    // Options are a convenience; failing to persist them is not fatal.
  }
}
