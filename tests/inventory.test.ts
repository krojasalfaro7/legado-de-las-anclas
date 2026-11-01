import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { createNewGame, type GameState } from '../src/systems/gameState';
import {
  addItem,
  canEquip,
  equipmentEffects,
  isEquipped,
  itemCount,
  MAX_STACK,
  removeItem,
  toggleEquip,
  useConsumable,
} from '../src/systems/inventory';

const item = (id: string) => {
  const def = ITEMS[id];
  if (!def) throw new Error(`missing item ${id}`);
  return def;
};

const newState = (level = 10): GameState => {
  const s = createNewGame([{ id: 'tavi', startingTechniques: [] }], 'tavi', { zone: 'x' });
  const p = s.party.tavi;
  return p ? { ...s, party: { tavi: { ...p, level } } } : s;
};

function withVitals(s: GameState, hp: number, ki: number): GameState {
  const p = s.party[s.activeCharacter];
  return p ? { ...s, party: { ...s.party, [p.id]: { ...p, vitals: { hp, ki } } } } : s;
}

describe('inventory', () => {
  it('adds and stacks items up to the cap', () => {
    let inv = addItem({}, 'altitudeBerry');
    inv = addItem(inv, 'altitudeBerry', 2);
    expect(itemCount(inv, 'altitudeBerry')).toBe(3);
    expect(itemCount(addItem(inv, 'altitudeBerry', 500), 'altitudeBerry')).toBe(MAX_STACK);
  });

  it('removes items and drops empty stacks', () => {
    const inv = addItem({}, 'ration', 2);
    expect(removeItem(inv, 'ration', 3)).toBeNull();
    const one = removeItem(inv, 'ration');
    expect(one && itemCount(one, 'ration')).toBe(1);
    const none = one && removeItem(one, 'ration');
    expect(none).toEqual({});
  });
});

describe('equipment', () => {
  it('requires owning the item and toggles it', () => {
    const s = newState();
    expect(toggleEquip(s, item('trainingBallast'))).toBe(s);
    const owned = { ...s, inventory: addItem(s.inventory, 'trainingBallast') };
    const worn = toggleEquip(owned, item('trainingBallast'));
    expect(isEquipped(worn, 'trainingBallast')).toBe(true);
    expect(isEquipped(toggleEquip(worn, item('trainingBallast')), 'trainingBallast')).toBe(false);
  });

  it('weights give more EXP and less speed', () => {
    const s = newState();
    const worn = toggleEquip({ ...s, inventory: { trainingBallast: 1 } }, item('trainingBallast'));
    const fx = equipmentEffects(worn);
    expect(fx.expMult).toBeGreaterThan(1);
    expect(fx.speedMult).toBeLessThan(1);
  });

  it('one item per slot, but every slot can be filled', () => {
    const inventory = { trainingBallast: 1, wardenCoat: 1, quarryBand: 1, copperCharm: 1 };
    let s: GameState = { ...newState(), inventory };
    for (const id of Object.keys(inventory)) s = toggleEquip(s, item(id));
    expect(s.equipment).toEqual({
      head: 'copperCharm',
      body: 'wardenCoat',
      hands: 'quarryBand',
      feet: 'trainingBallast',
    });
    expect(equipmentEffects(s).defBonus).toBe(6);
  });

  it('needs the active character to reach the item level', () => {
    const s = { ...newState(5), inventory: { quarryBand: 1, wardenCoat: 1 } };
    expect(canEquip(s, item('quarryBand'))).toBe('level');
    expect(toggleEquip(s, item('quarryBand'))).toBe(s);
    expect(canEquip(s, item('wardenCoat'))).toBe('ok');
    // Already worn (e.g. after switching to a lower-level member): it can still come off.
    const worn = { ...s, equipment: { hands: 'quarryBand' } };
    expect(isEquipped(toggleEquip(worn, item('quarryBand')), 'quarryBand')).toBe(false);
  });
});

describe('consumables', () => {
  it('altitudeBerry fully restores and is consumed', () => {
    const s = withVitals({ ...newState(), inventory: { altitudeBerry: 1 } }, 10, 0);
    const r = useConsumable(s, item('altitudeBerry'), { hp: 100, ki: 54 });
    expect(r?.party[r.activeCharacter]?.vitals).toEqual({ hp: 100, ki: 54 });
    expect(r && itemCount(r.inventory, 'altitudeBerry')).toBe(0);
  });

  it('is not wasted at full health', () => {
    const s = withVitals({ ...newState(), inventory: { altitudeBerry: 1 } }, 100, 54);
    expect(useConsumable(s, item('altitudeBerry'), { hp: 100, ki: 54 })).toBeNull();
  });

  it('fails without the item', () => {
    const s = { ...newState(), vitals: { hp: 1, ki: 0 } };
    expect(useConsumable(s, item('ration'), { hp: 100, ki: 54 })).toBeNull();
  });

  it('equipment cannot be consumed', () => {
    const s = { ...newState(), inventory: { trainingBallast: 1 }, vitals: { hp: 1, ki: 0 } };
    expect(useConsumable(s, item('trainingBallast'), { hp: 100, ki: 54 })).toBeNull();
  });
});
