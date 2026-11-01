import type { GameState } from './gameState';
import { matches, type NpcCondition, type NpcContext } from './npcRules';

/** Tile coordinates on the zone map. */
export type TilePos = readonly [number, number];
export type CutDir = 'up' | 'down' | 'left' | 'right';
export type CutEmote = '!' | '?' | '...' | '!!';

/**
 * In-engine cutscene steps, run in order. `who` is `player`, an actor spawned by the cutscene,
 * a zone NPC (Tiled object name) or an enemy (its spawn object name).
 */
export type CutStep =
  | { do: 'talk'; dialogue: string }
  | { do: 'move'; who: string; to: TilePos; speed?: number }
  | { do: 'face'; who: string; dir: CutDir }
  /** Turns `who` toward `target`. */
  | { do: 'look'; who: string; target: string }
  | { do: 'emote'; who: string; emote: CutEmote }
  | { do: 'pose'; who: string; pose: string; ms: number }
  | { do: 'camera'; to: string | TilePos; ms?: number }
  /** Pans back to the player and follows them again. */
  | { do: 'cameraBack'; ms?: number }
  | { do: 'wait'; ms: number }
  | { do: 'shake'; ms: number; intensity?: number }
  | { do: 'flash'; color?: number; ms?: number }
  | {
      do: 'spawn';
      id: string;
      /**
       * A party member who is the player right now isn't spawned twice: the id then names the
       * player. `phase` uses a boss's transformed look.
       */
      actor: { npc: string } | { character: string } | { enemy: string; phase?: number };
      at: TilePos;
      facing?: CutDir;
    }
  | { do: 'despawn'; who: string; how?: 'fade' | 'flyUp' }
  /** Puts `who` on a tile at once (e.g. under cover of a flash). */
  | { do: 'place'; who: string; at: TilePos; facing?: CutDir }
  /** Hides or shows an actor without removing it (e.g. a boss that's elsewhere in the story). */
  | { do: 'show'; who: string; visible: boolean }
  /** Sets a story flag (or clears it with `value: false`). */
  | { do: 'flag'; flag: string; value?: boolean }
  /** Hands control to another party member (chapters that follow someone else). */
  | { do: 'play'; character: string }
  /** The whole party back to full HP/ki. */
  | { do: 'heal' }
  /** Adds a party member: sets their join flag and raises them to at least `level`. */
  | { do: 'join'; character: string; level: number }
  /** Shown once the cutscene ends (the HUD is hidden while it runs). */
  | { do: 'toast'; text: string }
  | { do: 'sfx'; id: string }
  /** A boss takes its current phase's transformed look (see BossPhase.look). */
  | { do: 'transform'; who: string }
  /**
   * Leaves for another zone (always the last step: the scene restarts). The cutscene counts as
   * seen from its start, so it doesn't replay.
   */
  | { do: 'goto'; zone: string; spawn: string }
  /** The end credits: `text` scrolls up over black. */
  | { do: 'credits'; text: string }
  /** Full-screen card over black, e.g. a chapter title. */
  | { do: 'title'; text: string; sub?: string; ms?: number }
  /** Runs the steps at the same time and waits for all of them. */
  | { do: 'together'; steps: CutStep[] };

export type CutTrigger =
  /** When the zone loads. */
  | { on: 'enter' }
  /** When the player walks into a Tiled `cutscene` area with this name. */
  | { on: 'area'; area: string }
  /** When the player comes close to this boss (spawn object name), before the fight. */
  | { on: 'boss'; spawn: string }
  /** After this boss (spawn object name) is defeated. */
  | { on: 'bossDefeated'; spawn: string }
  /** When this boss enters phase `phase` (index into EnemyDef.phases) mid-fight. */
  | { on: 'bossPhase'; spawn: string; phase: number };

export interface CutsceneDef {
  id: string;
  zone: string;
  trigger: CutTrigger;
  /** Extra conditions (same as NPC rules). Each cutscene plays once. */
  when?: NpcCondition;
  steps: CutStep[];
}

export const seenFlag = (id: string): string => `cs.${id}`;

function sameTrigger(a: CutTrigger, b: CutTrigger): boolean {
  if (a.on !== b.on) return false;
  if (a.on === 'area' && b.on === 'area') return a.area === b.area;
  if ((a.on === 'boss' || a.on === 'bossDefeated') && (b.on === 'boss' || b.on === 'bossDefeated'))
    return a.spawn === b.spawn;
  if (a.on === 'bossPhase' && b.on === 'bossPhase')
    return a.spawn === b.spawn && a.phase === b.phase;
  return true;
}

/** The first unseen cutscene of `zone` for this trigger whose conditions hold, if any. */
export function pickCutscene(
  defs: readonly CutsceneDef[],
  zone: string,
  trigger: CutTrigger,
  state: GameState,
  ctx: NpcContext,
): CutsceneDef | null {
  return (
    defs.find(
      (d) =>
        d.zone === zone &&
        sameTrigger(d.trigger, trigger) &&
        !state.flags[seenFlag(d.id)] &&
        (!d.when || matches(d.when, state, ctx)),
    ) ?? null
  );
}
