import { ITEMS } from '../data/items';
import type { EquipSlot, ItemDef } from '../data/types';
import type { GameState, Vitals } from './gameState';

export type Inventory = Record<string, number>;

export const MAX_STACK = 99;

export function itemCount(inv: Inventory, id: string): number {
  return inv[id] ?? 0;
}

export function addItem(inv: Inventory, id: string, n = 1): Inventory {
  return { ...inv, [id]: Math.min(MAX_STACK, itemCount(inv, id) + n) };
}

/** Returns null when there are not enough items. Empty stacks are removed. */
export function removeItem(inv: Inventory, id: string, n = 1): Inventory | null {
  const have = itemCount(inv, id);
  if (have < n) return null;
  const next = { ...inv };
  if (have === n) delete next[id];
  else next[id] = have - n;
  return next;
}

export interface EquipmentTotals {
  expMult: number;
  speedMult: number;
  defBonus: number;
  damageMult: number;
  kiRegenMult: number;
}

export function equipmentEffects(
  state: GameState,
  items: Record<string, ItemDef> = ITEMS,
): EquipmentTotals {
  const totals: EquipmentTotals = {
    expMult: 1,
    speedMult: 1,
    defBonus: 0,
    damageMult: 1,
    kiRegenMult: 1,
  };
  for (const id of Object.values(state.equipment)) {
    const eq = id ? items[id]?.equip : undefined;
    if (!eq) continue;
    totals.expMult *= eq.expMult;
    totals.speedMult *= eq.speedMult;
    totals.defBonus += eq.defBonus;
    totals.damageMult *= eq.damageMult ?? 1;
    totals.kiRegenMult *= eq.kiRegenMult ?? 1;
  }
  return totals;
}

export type EquipCheck = 'ok' | 'notOwned' | 'level';

/** Whether the active character can put the item on (taking it off is always allowed). */
export function canEquip(state: GameState, item: ItemDef): EquipCheck {
  if (!item.equip || itemCount(state.inventory, item.id) <= 0) return 'notOwned';
  if (isEquipped(state, item.id)) return 'ok';
  const level = state.party[state.activeCharacter]?.level ?? 1;
  return level >= item.equip.minLevel ? 'ok' : 'level';
}

/** Equips an owned item in its slot (replacing what was there), or unequips it if worn. */
export function toggleEquip(state: GameState, item: ItemDef): GameState {
  if (!item.equip || canEquip(state, item) !== 'ok') return state;
  const slot: EquipSlot = item.equip.slot;
  const worn = isEquipped(state, item.id);
  const equipment = Object.fromEntries(
    Object.entries(state.equipment).filter(([, id]) => id !== item.id),
  ) as GameState['equipment'];
  if (!worn) equipment[slot] = item.id;
  return { ...state, equipment };
}

export function isEquipped(state: GameState, itemId: string): boolean {
  return Object.values(state.equipment).includes(itemId);
}

export type { Vitals };

/** Applies a consumable; returns null if it isn't usable or would have no effect. */
export function useConsumable(state: GameState, item: ItemDef, max: Vitals): GameState | null {
  if (item.kind !== 'consumable' || !item.heal) return null;
  const active = state.party[state.activeCharacter];
  if (!active) return null;
  const { hp, ki } = active.vitals;
  const nextHp = Math.min(max.hp, hp + max.hp * item.heal.hpPct);
  const nextKi = Math.min(max.ki, ki + max.ki * item.heal.kiPct);
  if (nextHp === hp && nextKi === ki) return null;
  const inventory = removeItem(state.inventory, item.id);
  if (!inventory) return null;
  const party = { ...state.party, [active.id]: { ...active, vitals: { hp: nextHp, ki: nextKi } } };
  return { ...state, inventory, party };
}
