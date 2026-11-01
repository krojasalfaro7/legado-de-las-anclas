import { CHARACTERS } from '../data/characters';
import { ITEMS } from '../data/items';
import { KI_TECHNIQUES } from '../data/kiTechniques';
import type { Stats } from '../data/types';
import { fullVitals, newCharacterProgress } from './gameState';

/** Raw JSON object of some older save version. */
export type RawSave = { version?: unknown; [k: string]: unknown };
export type Migration = (old: RawSave) => RawSave;

const isVitals = (v: unknown): v is { hp: number; ki: number } =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as Record<string, unknown>).hp === 'number' &&
  typeof (v as Record<string, unknown>).ki === 'number';

/** v2 → v3: shared HP/ki became per character; the active one keeps them, the rest start full. */
export function migrateV2ToV3(s: RawSave): RawSave {
  const { vitals, ...rest } = s;
  const party = typeof s.party === 'object' && s.party !== null ? s.party : {};
  return {
    ...rest,
    party: Object.fromEntries(
      Object.entries(party).map(([id, raw]) => {
        const p = raw as Record<string, unknown>;
        const stats = (p.stats ?? { str: 1, pow: 1, end: 1, spd: 1 }) as Stats;
        const own = id === s.activeCharacter && isVitals(vitals) ? vitals : fullVitals(stats);
        return [id, { ...p, vitals: own }];
      }),
    ),
  };
}

/** v3 → v4: equipment went from one `body` slot to head/body/hands/feet; re-slot what's worn. */
export function migrateV3ToV4(s: RawSave): RawSave {
  const old = typeof s.equipment === 'object' && s.equipment !== null ? s.equipment : {};
  const equipment: Record<string, string> = {};
  for (const id of Object.values(old)) {
    const slot = typeof id === 'string' ? ITEMS[id]?.equip?.slot : undefined;
    if (slot && typeof id === 'string') equipment[slot] = id;
  }
  return { ...s, equipment };
}

/** v4 → v5: Okun lost the magma beam (stone fighters don't fire ki); forget removed techniques. */
export function migrateV4ToV5(s: RawSave): RawSave {
  const party = typeof s.party === 'object' && s.party !== null ? s.party : {};
  return {
    ...s,
    party: Object.fromEntries(
      Object.entries(party).map(([id, raw]) => {
        const p = raw as Record<string, unknown>;
        const techniques = Array.isArray(p.techniques)
          ? p.techniques.filter((t) => typeof t === 'string' && t in KI_TECHNIQUES)
          : p.techniques;
        return [id, { ...p, techniques }];
      }),
    ),
  };
}

/**
 * v5 → v6: the SPD stat (starts at 1; the extra point per level already gained is handed out
 * as free points) and money.
 */
export function migrateV5ToV6(s: RawSave): RawSave {
  const party = typeof s.party === 'object' && s.party !== null ? s.party : {};
  return {
    ...s,
    money: typeof s.money === 'number' ? s.money : 0,
    party: Object.fromEntries(
      Object.entries(party).map(([id, raw]) => {
        const p = raw as Record<string, unknown>;
        const stats = { spd: 1, ...(p.stats as Record<string, number>) };
        const level = typeof p.level === 'number' ? p.level : 1;
        const unspent = typeof p.unspentPoints === 'number' ? p.unspentPoints : 0;
        return [id, { ...p, stats, unspentPoints: unspent + level - 1 }];
      }),
    ),
  };
}

/** v6 → v7: Iolé and Nilo join the roster (playable once the story adds them) and kill counts. */
export function migrateV6ToV7(s: RawSave): RawSave {
  const party: Record<string, unknown> =
    typeof s.party === 'object' && s.party !== null ? { ...s.party } : {};
  const order = Array.isArray(s.partyOrder) ? [...s.partyOrder] : [];
  for (const id of Object.keys(CHARACTERS)) {
    if (id in party) continue;
    const c = CHARACTERS[id];
    if (!c) continue;
    party[id] = newCharacterProgress({ id, startingTechniques: c.startingTechniques });
    if (!order.includes(id)) order.push(id);
  }
  return {
    ...s,
    party,
    partyOrder: order,
    kills: typeof s.kills === 'object' && s.kills !== null ? s.kills : {},
  };
}

/**
 * Migrations keyed by the version they upgrade *from* (n → n + 1).
 * When changing GameState or renaming content ids: bump SAVE_VERSION and add an entry.
 * Saves from before v2 (the prototype's content) are no longer supported.
 */
export const MIGRATIONS: Record<number, Migration> = {
  2: migrateV2ToV3,
  3: migrateV3ToV4,
  4: migrateV4ToV5,
  5: migrateV5ToV6,
  6: migrateV6ToV7,
};
