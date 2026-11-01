import { describe, expect, it } from 'vitest';
import { createNewGame, fullVitals, SAVE_VERSION } from '../src/systems/gameState';
import {
  isValidState,
  type Migration,
  migrate,
  parseSave,
  serializeSave,
} from '../src/systems/save';

const state = () => {
  const s = createNewGame([{ id: 'tavi', startingTechniques: ['spark'] }], 'tavi', {
    zone: 'hub',
  });
  s.inventory = { altitudeBerry: 2 };
  s.openedChests = ['field:chest1'];
  s.flags = { missionAccepted: true };
  s.location = { zone: 'field', x: 100, y: 200 };
  return s;
};

describe('save round trip', () => {
  it('serializes and parses back the same state', () => {
    const s = state();
    const raw = serializeSave(s, new Date('2026-01-01T00:00:00Z'));
    expect(JSON.parse(raw).savedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(parseSave(raw)).toEqual(s);
  });

  it('returns null for missing, corrupt or invalid data', () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave('{nope')).toBeNull();
    expect(parseSave(JSON.stringify({ version: SAVE_VERSION, state: { party: {} } }))).toBeNull();
  });

  it('rejects saves from a newer version', () => {
    const raw = JSON.stringify({ version: SAVE_VERSION + 1, state: state() });
    expect(parseSave(raw)).toBeNull();
  });
});

describe('migrations', () => {
  // Simulated history: v0 had "items" instead of "inventory"; v1 added "playTimeMs".
  const migrations: Record<number, Migration> = {
    0: ({ items, ...rest }) => ({ ...rest, inventory: items ?? {} }),
    1: (s) => ({ ...s, playTimeMs: 0 }),
  };

  it('applies each step in order up to the target', () => {
    const out = migrate({ version: 0, items: { altitudeBerry: 1 } }, migrations, 2);
    expect(out).toEqual({ version: 2, inventory: { altitudeBerry: 1 }, playTimeMs: 0 });
  });

  it('treats saves without a version as v0', () => {
    expect(migrate({ items: {} }, migrations, 1)).toEqual({ version: 1, inventory: {} });
  });

  it('throws when a step is missing', () => {
    expect(() => migrate({ version: 0 }, {}, 1)).toThrow();
  });

  it('parseSave migrates an old file into a valid state', () => {
    const { inventory, playTimeMs: _drop, ...old } = state();
    const raw = JSON.stringify({ version: 0, state: { ...old, items: inventory } });
    const parsed = parseSave(raw, migrations, 2);
    expect(parsed?.inventory).toEqual({ altitudeBerry: 2 });
    expect(parsed && isValidState(parsed)).toBe(true);
  });
});

describe('v2 → v3 per-character vitals', () => {
  it('gives the shared vitals to the active character and full vitals to the rest', () => {
    const { party: _p, ...base } = state();
    const progress = (id: string, end: number) => ({
      id,
      level: 3,
      exp: 0,
      stats: { str: 1, pow: 1, end },
      unspentPoints: 0,
      techniques: ['spark'],
    });
    const v2 = {
      ...base,
      version: 2,
      party: { tavi: progress('tavi', 1), okun: progress('okun', 4) },
      partyOrder: ['tavi', 'okun'],
      activeCharacter: 'tavi',
      vitals: { hp: 37, ki: 12 },
    };
    const parsed = parseSave(JSON.stringify({ version: 2, state: v2 }));
    expect(parsed?.party.tavi?.vitals).toEqual({ hp: 37, ki: 12 });
    expect(parsed?.party.okun?.vitals).toEqual(fullVitals({ str: 1, pow: 1, end: 4, spd: 1 }));
    expect(parsed && 'vitals' in parsed).toBe(false);
  });
});

describe('v3 → v4 equipment slots', () => {
  it('moves what was worn in the single body slot to its own slot', () => {
    const v3 = { ...state(), version: 3, equipment: { body: 'quarryBand' } };
    const parsed = parseSave(JSON.stringify({ version: 3, state: v3 }));
    expect(parsed?.equipment).toEqual({ hands: 'quarryBand' });
  });
});

describe('v4 → v5 removed techniques', () => {
  it('drops techniques that no longer exist', () => {
    const base = state();
    const tavi = base.party.tavi;
    if (!tavi) throw new Error('no tavi');
    const v4 = {
      ...base,
      version: 4,
      party: { tavi: { ...tavi, techniques: ['spark', 'magmaVein'] } },
    };
    const parsed = parseSave(JSON.stringify({ version: 4, state: v4 }));
    expect(parsed?.party.tavi?.techniques).toEqual(['spark']);
  });
});

describe('v5 → v6 SPD and money', () => {
  it('adds SPD at 1, one free point per level gained, and an empty purse', () => {
    const base = state();
    const tavi = base.party.tavi;
    if (!tavi) throw new Error('no tavi');
    const { money: _money, ...rest } = base;
    const v5 = {
      ...rest,
      version: 5,
      party: { tavi: { ...tavi, level: 4, unspentPoints: 2, stats: { str: 3, pow: 2, end: 3 } } },
    };
    const parsed = parseSave(JSON.stringify({ version: 5, state: v5 }));
    expect(parsed?.party.tavi?.stats).toEqual({ str: 3, pow: 2, end: 3, spd: 1 });
    expect(parsed?.party.tavi?.unspentPoints).toBe(5);
    expect(parsed?.money).toBe(0);
  });
});

describe('v6 → v7 new party members and kill counts', () => {
  it('adds Iolé and Nilo at level 1 and an empty kill record', () => {
    const base = state();
    const { kills: _kills, ...rest } = base;
    const party = { tavi: base.party.tavi, okun: base.party.okun };
    const v6 = { ...rest, version: 6, party, partyOrder: ['tavi', 'okun'] };
    const parsed = parseSave(JSON.stringify({ version: 6, state: v6 }));
    expect(parsed?.partyOrder).toEqual(['tavi', 'okun', 'iole', 'nilo']);
    expect(parsed?.party.iole?.level).toBe(1);
    expect(parsed?.party.nilo?.techniques).toEqual(['needleDart', 'dartFan']);
    expect(parsed?.kills).toEqual({});
  });
});
