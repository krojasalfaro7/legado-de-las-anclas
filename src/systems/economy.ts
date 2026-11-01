import { ITEMS } from '../data/items';
import type { ItemDef } from '../data/types';
import type { GameState } from './gameState';
import { addItem } from './inventory';

/**
 * Anchor shards, the currency: enemies drop them, shops take them.
 * Drops grow with the enemy's level and reward; bosses pay out much more.
 */
export function moneyDrop(
  enemy: { level: number; exp: number },
  isBoss: boolean,
  rand: () => number = Math.random,
): number {
  const base = enemy.level * 1.5 + enemy.exp * 0.15;
  const amount = Math.round(base * (0.75 + rand() * 0.5));
  return Math.max(1, isBoss ? amount * 4 : amount);
}

/** Splits a drop into the shards scattered on the ground (bigger drops, more pieces). */
export function splitMoney(total: number): number[] {
  const pieces = Math.min(6, Math.max(1, Math.ceil(total / 8)));
  const each = Math.floor(total / pieces);
  return Array.from({ length: pieces }, (_, i) => (i === 0 ? total - each * (pieces - 1) : each));
}

export type PurchaseResult = 'ok' | 'notForSale' | 'tooPoor';

export function buyItem(
  state: GameState,
  itemId: string,
  items: Record<string, ItemDef> = ITEMS,
): { state: GameState; result: PurchaseResult } {
  const price = items[itemId]?.price;
  if (price === undefined) return { state, result: 'notForSale' };
  if (state.money < price) return { state, result: 'tooPoor' };
  return {
    state: { ...state, money: state.money - price, inventory: addItem(state.inventory, itemId) },
    result: 'ok',
  };
}
