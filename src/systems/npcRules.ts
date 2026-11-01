import type { GameState } from './gameState';

/** All listed checks must pass. */
export interface NpcCondition {
  flag?: string;
  notFlag?: string;
  bossDefeated?: string;
  /** 'some' = player carries collectibles not yet delivered. */
  undeliveredCollectibles?: 'some' | 'none';
  /** Every collectible in the set has been delivered. */
  allDelivered?: boolean;
  /** Every collectible in the set has been found (delivered or not). */
  allFound?: boolean;
  /** A barrier (`<zone>:<name>`) has been broken. */
  gateBroken?: string;
  /** A chest (`<zone>:<name>`) has been opened. */
  chestOpened?: string;
  /** Every listed enemy group (`<zone>:<group>`) has been wiped out. */
  groupsCleared?: readonly string[];
  /** Every listed chest has been opened (finds that are handed in later). */
  chestsOpened?: readonly string[];
  /** At least `count` defeats of enemy `enemy` (hunts), counted since its hunt was taken. */
  kills?: { enemy: string; count: number };
  /** Every listed collectible has been found / delivered (a set within the whole museum). */
  foundAll?: readonly string[];
  deliveredAll?: readonly string[];
  /** Every listed flag is set. */
  flags?: readonly string[];
  /** Carries at least one of this item. */
  hasItem?: string;
  /** This party member is the one being played. */
  playing?: string;
}

export interface NpcEffect {
  setFlag?: string;
  deliverCollectibles?: boolean;
  learnTechnique?: string;
  giveItem?: string;
  /** Takes one of this item (quest hand-ins). */
  takeItem?: string;
  giveMoney?: number;
  restore?: boolean;
  /** Takes a hunt on this enemy: its `kills` condition counts from now. */
  startHunt?: string;
}

export interface NpcRule {
  when: NpcCondition;
  dialogue: string;
  effects?: NpcEffect[];
  /** Re-evaluate the rules after this dialogue (e.g. deliver, then reward). */
  chain?: boolean;
}

export interface NpcContext {
  /** Every collectible id that exists in the game (for "all delivered"). */
  allCollectibles: readonly string[];
}

export interface NpcOutcome {
  dialogue: string;
  chain: boolean;
  state: GameState;
  /** Effects that need presentation (toasts, fx). */
  applied: NpcEffect[];
}

/** Defeats of `enemy` since its hunt was taken (or ever, if it never was). */
export function huntKills(s: GameState, enemy: string): number {
  return (s.kills?.[enemy] ?? 0) - (s.huntMarks?.[enemy] ?? 0);
}

export function matches(c: NpcCondition, s: GameState, ctx: NpcContext): boolean {
  if (c.flag && !s.flags[c.flag]) return false;
  if (c.notFlag && s.flags[c.notFlag]) return false;
  if (c.bossDefeated && !s.defeatedBosses.includes(c.bossDefeated)) return false;
  if (c.undeliveredCollectibles) {
    const pending = s.collectiblesFound.some((id) => !s.collectiblesDelivered.includes(id));
    if ((c.undeliveredCollectibles === 'some') !== pending) return false;
  }
  if (c.allDelivered !== undefined) {
    const all = ctx.allCollectibles.every((id) => s.collectiblesDelivered.includes(id));
    if (all !== c.allDelivered) return false;
  }
  if (c.gateBroken && !s.brokenGates.includes(c.gateBroken)) return false;
  if (c.chestOpened && !s.openedChests.includes(c.chestOpened)) return false;
  if (c.groupsCleared && !c.groupsCleared.every((g) => s.clearedGroups.includes(g))) return false;
  if (c.chestsOpened && !c.chestsOpened.every((id) => s.openedChests.includes(id))) return false;
  if (c.kills && huntKills(s, c.kills.enemy) < c.kills.count) return false;
  if (c.flags && !c.flags.every((f) => s.flags[f])) return false;
  if (c.foundAll && !c.foundAll.every((id) => s.collectiblesFound.includes(id))) return false;
  if (c.deliveredAll && !c.deliveredAll.every((id) => s.collectiblesDelivered.includes(id)))
    return false;
  if (c.hasItem && (s.inventory[c.hasItem] ?? 0) <= 0) return false;
  if (c.playing && s.activeCharacter !== c.playing) return false;
  if (c.allFound !== undefined) {
    const all = ctx.allCollectibles.every((id) => s.collectiblesFound.includes(id));
    if (all !== c.allFound) return false;
  }
  return true;
}

export function applyEffect(s: GameState, e: NpcEffect): GameState {
  let next = s;
  if (e.setFlag) next = { ...next, flags: { ...next.flags, [e.setFlag]: true } };
  if (e.deliverCollectibles) {
    const delivered = [...new Set([...next.collectiblesDelivered, ...next.collectiblesFound])];
    next = { ...next, collectiblesDelivered: delivered };
  }
  if (e.learnTechnique) {
    const id = next.activeCharacter;
    const p = next.party[id];
    if (p && !p.techniques.includes(e.learnTechnique)) {
      next = {
        ...next,
        party: { ...next.party, [id]: { ...p, techniques: [...p.techniques, e.learnTechnique] } },
      };
    }
  }
  if (e.giveItem) {
    next = {
      ...next,
      inventory: { ...next.inventory, [e.giveItem]: (next.inventory[e.giveItem] ?? 0) + 1 },
    };
  }
  if (e.takeItem) {
    const have = next.inventory[e.takeItem] ?? 0;
    const inventory = { ...next.inventory };
    if (have <= 1) delete inventory[e.takeItem];
    else inventory[e.takeItem] = have - 1;
    next = { ...next, inventory };
  }
  if (e.giveMoney) next = { ...next, money: next.money + e.giveMoney };
  if (e.startHunt) {
    const mark = next.kills?.[e.startHunt] ?? 0;
    next = { ...next, huntMarks: { ...next.huntMarks, [e.startHunt]: mark } };
  }
  return next;
}

/** First matching rule wins; its effects are applied in order. */
export function evaluateNpc(
  rules: readonly NpcRule[],
  s: GameState,
  ctx: NpcContext,
): NpcOutcome | null {
  const rule = rules.find((r) => matches(r.when, s, ctx));
  if (!rule) return null;
  const effects = rule.effects ?? [];
  const state = effects.reduce(applyEffect, s);
  return { dialogue: rule.dialogue, chain: rule.chain ?? false, state, applied: effects };
}
