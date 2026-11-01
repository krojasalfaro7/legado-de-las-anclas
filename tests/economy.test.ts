import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { NPCS } from '../src/data/npcs';
import { buyItem, moneyDrop, splitMoney } from '../src/systems/economy';
import { createNewGame } from '../src/systems/gameState';
import { equipmentEffects } from '../src/systems/inventory';

const state = (money: number) => ({
  ...createNewGame([{ id: 'tavi', startingTechniques: [] }], 'tavi', { zone: 'hub' }),
  money,
});

describe('money drops', () => {
  it('grow with the enemy and pay bosses more', () => {
    const mid = () => 0.5;
    const weak = moneyDrop({ level: 2, exp: 8 }, false, mid);
    const strong = moneyDrop({ level: 10, exp: 48 }, false, mid);
    expect(weak).toBeGreaterThan(0);
    expect(strong).toBeGreaterThan(weak);
    expect(moneyDrop({ level: 10, exp: 48 }, true, mid)).toBe(strong * 4);
  });

  it('split into pieces that add up to the total', () => {
    for (const total of [1, 7, 23, 100, 333]) {
      const pieces = splitMoney(total);
      expect(pieces.reduce((a, b) => a + b, 0)).toBe(total);
      expect(pieces.length).toBeLessThanOrEqual(6);
      expect(pieces.every((p) => p > 0)).toBe(true);
    }
  });
});

describe('shop', () => {
  it('sells for shards and refuses when short', () => {
    const rich = buyItem(state(100), 'ration');
    expect(rich.result).toBe('ok');
    expect(rich.state.money).toBe(100 - (ITEMS.ration?.price ?? 0));
    expect(rich.state.inventory.ration).toBe(1);
    const poor = buyItem(state(1), 'ration');
    expect(poor.result).toBe('tooPoor');
    expect(poor.state.money).toBe(1);
    expect(buyItem(state(999), 'altitudeBerry').result).toBe('notForSale');
  });

  it('only stocks items that have a price', () => {
    for (const npc of Object.values(NPCS))
      for (const id of npc.shop ?? []) expect(ITEMS[id]?.price, id).toBeGreaterThan(0);
  });
});

describe('equipment flavor effects', () => {
  it('multiply damage and ki regen', () => {
    const s = {
      ...state(0),
      inventory: { reedWraps: 1, tideAmulet: 1 },
      equipment: { hands: 'reedWraps', head: 'tideAmulet' },
    };
    const eq = equipmentEffects(s);
    expect(eq.damageMult).toBeCloseTo(1.1);
    expect(eq.kiRegenMult).toBeCloseTo(1.5);
  });
});
