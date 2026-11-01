import type { GameState } from './gameState';
import { matches, type NpcCondition, type NpcContext } from './npcRules';

export interface ObjectiveStep<K extends string = string> {
  textKey: K;
  /** The step counts as done once this holds (same conditions as NPC rules). */
  done: NpcCondition;
}

export interface ObjectiveDef<K extends string = string> {
  id: string;
  kind: 'main' | 'side';
  titleKey: K;
  /** The objective shows up in the list once this holds. */
  start: NpcCondition;
  steps: ObjectiveStep<K>[];
}

export interface ObjectiveProgress {
  visible: boolean;
  /** Index of the current step (the first not done), or `steps.length` when complete. */
  step: number;
  complete: boolean;
}

/**
 * Where the player is in an objective. Steps are checked in order, so a later step that
 * happens to hold early (e.g. a relic found before meeting Pim) doesn't skip the current one.
 */
export function objectiveProgress(
  def: ObjectiveDef,
  state: GameState,
  ctx: NpcContext,
): ObjectiveProgress {
  let step = def.steps.findIndex((s) => !matches(s.done, state, ctx));
  if (step < 0) step = def.steps.length;
  const complete = step === def.steps.length;
  return { visible: complete || matches(def.start, state, ctx), step, complete };
}

/** Visible objectives: unfinished main ones first, then side ones, then completed ones. */
export function visibleObjectives<K extends string>(
  defs: readonly ObjectiveDef<K>[],
  state: GameState,
  ctx: NpcContext,
): Array<{ def: ObjectiveDef<K>; progress: ObjectiveProgress }> {
  const rank = (d: ObjectiveDef<K>, p: ObjectiveProgress) =>
    (p.complete ? 2 : 0) + (d.kind === 'side' ? 1 : 0);
  return defs
    .map((def) => ({ def, progress: objectiveProgress(def, state, ctx) }))
    .filter((o) => o.progress.visible)
    .sort((a, b) => rank(a.def, a.progress) - rank(b.def, b.progress));
}
