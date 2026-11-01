import { type GameState, SAVE_VERSION } from './gameState';
import { MIGRATIONS, type Migration, type RawSave } from './saveMigrations';

export { MIGRATIONS, type Migration };

export interface SaveFile {
  version: number;
  savedAt: string;
  state: GameState;
}

export function serializeSave(state: GameState, now: Date = new Date()): string {
  const file: SaveFile = {
    version: SAVE_VERSION,
    savedAt: now.toISOString(),
    state: { ...state, version: SAVE_VERSION },
  };
  return JSON.stringify(file);
}

/** Runs migrations in order until `target`. Throws if a step is missing. */
export function migrate(
  raw: RawSave,
  migrations: Record<number, Migration>,
  target: number,
): RawSave {
  let current = raw;
  let version = typeof current.version === 'number' ? current.version : 0;
  if (version > target)
    throw new Error(`Save version ${version} is newer than supported ${target}`);
  while (version < target) {
    const step = migrations[version];
    if (!step) throw new Error(`No migration from save version ${version}`);
    current = { ...step(current), version: version + 1 };
    version++;
  }
  return current;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Structural check of the fields the game relies on. */
export function isValidState(v: unknown): v is GameState {
  if (!isObject(v)) return false;
  if (!isObject(v.party) || !isStringArray(v.partyOrder) || typeof v.activeCharacter !== 'string')
    return false;
  if (!isObject(v.party[v.activeCharacter])) return false;
  const hasVitals = (p: unknown) =>
    isObject(p) &&
    isObject(p.vitals) &&
    typeof p.vitals.hp === 'number' &&
    typeof p.vitals.ki === 'number';
  if (!Object.values(v.party).every(hasVitals)) return false;
  if (!isObject(v.inventory) || !isObject(v.equipment) || !isObject(v.flags)) return false;
  const lists = [
    'collectiblesFound',
    'collectiblesDelivered',
    'openedChests',
    'brokenGates',
    'clearedGroups',
    'defeatedBosses',
  ];
  if (!lists.every((k) => isStringArray(v[k]))) return false;
  if (!isObject(v.location) || typeof v.location.zone !== 'string') return false;
  return typeof v.playTimeMs === 'number';
}

/**
 * Parses a stored save, migrating older versions. Returns null for missing,
 * corrupt or incompatible data instead of throwing, so the title screen can
 * simply hide "Continue".
 */
export function parseSave(
  raw: string | null,
  migrations: Record<number, Migration> = MIGRATIONS,
  target: number = SAVE_VERSION,
): GameState | null {
  if (!raw) return null;
  try {
    const file = JSON.parse(raw) as unknown;
    if (!isObject(file) || !isObject(file.state)) return null;
    const version = typeof file.version === 'number' ? file.version : 0;
    const migrated = migrate({ ...file.state, version }, migrations, target);
    return isValidState(migrated) ? migrated : null;
  } catch {
    return null;
  }
}
