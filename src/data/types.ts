import type { StringKey } from '../i18n';
import type { EnemyTraits } from '../systems/enemyTraits';
import type { ActorLook } from '../ui/actorFrames';
import type { Pose } from '../ui/spriteSpec';

export type StatName = 'str' | 'pow' | 'end' | 'spd';
export type Stats = Record<StatName, number>;

export interface TransformationDef {
  id: string;
  nameKey: StringKey;
  /** Multiplies both melee and ki damage. */
  damageMult: number;
  speedMult: number;
  kiDrainPerSec: number;
  minKiToActivate: number;
  look: ActorLook;
  auraColor: number;
  /** Only offered once this story flag is set (a form earned later in the story). */
  requiresFlag?: string;
}

/**
 * How a character fights hand to hand. Per-step arrays share the combo length; timings feed
 * systems/playerCombat.ts. The default (balance.ts `melee`) is the quick 4-hit chain.
 */
export interface MeleeStyle {
  startupMs: number;
  activeMs: number;
  recoveryMs: readonly number[];
  moveCancelMs: readonly number[];
  comboWindowMs: number;
  comboMults: readonly number[];
  knockback: readonly number[];
  lungeSpeed: readonly number[];
  /** Sprite pose per combo step. */
  poses: readonly Pose[];
  reach: number;
  width: number;
  /** Damage multiplier on top of the combo multipliers. */
  power: number;
  /** Fraction of hurt stun and knockback this character takes (heavy fighters shrug hits off). */
  stagger: number;
  assistConeDeg: number;
  assistRange: number;
}

/** How a fighter differs beyond their melee style (1 = the baseline). */
export interface CharacterTraits {
  /** Natural ki recovery speed. */
  kiRegenMult: number;
  /** Time to reach a full charge. */
  chargeTimeMult: number;
  /** Running speed. */
  runMult: number;
  /** Damage still taken through a guard. */
  guardMult: number;
  /** Swings can't be interrupted: hits still hurt, but don't stun or push. */
  armoredSwings: boolean;
  /** The combo finisher also shakes the ground, hitting enemies within this radius. */
  finisherQuake?: number;
}

export interface CharacterDef {
  id: string;
  nameKey: StringKey;
  /** Disabled characters have data but can't be selected unless `joinFlag` is set. */
  enabled: boolean;
  /** Story flag that makes a disabled character playable (they join the party). */
  joinFlag?: string;
  /** Away from the party (can't be played) from flag `from` until flag `until` is set. */
  absent?: { from: string; until: string };
  /** Melee style; the quick default when omitted. */
  melee?: MeleeStyle;
  /** Only true ki users can fly; the others are carried on the continent map. */
  canFly: boolean;
  traits: CharacterTraits;
  /** Color used for this character's level gates and UI accents. */
  color: number;
  look: ActorLook;
  baseSpeed: number;
  startingTechniques: string[];
  /** Techniques learned on reaching a level (GBA style: new specials as you grow). */
  techniqueUnlocks: { level: number; technique: string }[];
  transformations: TransformationDef[];
}

export interface KiTechniqueDef {
  id: string;
  nameKey: StringKey;
  kiCost: number;
  /** Base damage before the POW multiplier. */
  power: number;
  speed: number;
  count: number;
  spreadDeg: number;
  pierce: boolean;
  texture: 'ki-small' | 'ki-big';
  /** Ki orb by default; Okun throws stone. */
  look?: ShotLook;
  color: number;
  /**
   * Distance in pixels before the shot fades. Omitted: the blast flies until it leaves the
   * screen, like GBA ki blasts. Use it only for close-range moves (rings, bursts).
   */
  range?: number;
  /** Fires the volley several times in a row (a barrage) instead of once. */
  burst?: { shots: number; intervalMs: number; jitterDeg: number };
  /**
   * A sustained beam instead of shots, fired while the button is held (no charging): gathers in
   * the hands for `windupMs`, then the beam grows out and holds on the first enemy in line,
   * hitting every `tickMs` (`power` per tick) and pushing it back. It stops when the button is
   * released (after at least `minHoldMs`), after `maxHoldMs` or when ki runs out (`kiPerSec`
   * on top of `kiCost`). See systems/beam.ts.
   */
  beam?: {
    windupMs: number;
    minHoldMs: number;
    maxHoldMs: number;
    kiPerSec: number;
    tickMs: number;
    width: number;
  };
  cooldownMs: number;
  knockback: number;
  /** Big blasts launch what they hit (long slide, tossed up, heavy hit-stop), like a finisher. */
  heavy?: boolean;
}

export type AiKind = 'melee' | 'ranged' | 'tank';
/**
 * `blink`: shatters, vanishes and re-forms behind the player with an instant swing.
 * `ultimate`: a long, loud windup, then waves of big shots in every direction (`ai.ultimate`).
 */
export type BossPattern = 'melee' | 'tripleShot' | 'radialBurst' | 'dash' | 'blink' | 'ultimate';

/**
 * What a shot is: a glowing ki orb or crystal shard, or something thrown (rock, harpoon, dart).
 * Thrown things don't glow, and ki-drinking enemies can't absorb them.
 */
export type ShotLook = 'ki' | 'shard' | 'rock' | 'harpoon' | 'dart';

export interface ProjectileParams {
  look?: ShotLook;
  speed: number;
  damageMult: number;
  color: number;
  count: number;
  spreadDeg: number;
}

export interface BossPhase {
  /** Phase activates when HP fraction drops to or below this value. */
  hpBelow: number;
  speedMult: number;
  cooldownMult: number;
  patterns: BossPattern[];
  /** Keeps this distance, circling and shooting, instead of closing in (a boss's opening). */
  keepAway?: number;
  dialogueId?: string;
  /** Transformation: from this phase on the boss uses this look (and name, if given). */
  look?: ActorLook;
  nameKey?: StringKey;
}

export interface AiParams {
  kind: AiKind;
  aggroRange: number;
  /** Beyond this distance from home the enemy gives up and returns. */
  leashRange: number;
  attackRange: number;
  attackCooldownMs: number;
  windupMs: number;
  patrolRadius: number;
  /** Ranged: distance it tries to keep from the player. */
  preferredDistance?: number;
  /** Blows per melee string: bosses chain 2-3 while the player stays close (footage). */
  meleeChain?: number;
  projectile?: ProjectileParams;
  /** Tank: dash speed and duration of the charge attack. */
  chargeSpeed?: number;
  chargeDurationMs?: number;
  /** Boss super move (pattern `ultimate`): rings of big shots, each wave offset by half a gap. */
  ultimate?: { windupMs: number; waves: number; waveMs: number; shots: ProjectileParams };
}

export interface EnemyDef {
  id: string;
  nameKey: StringKey;
  descKey: StringKey;
  level: number;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  exp: number;
  look: ActorLook;
  ai: AiParams;
  /** Bosses switch pattern sets by HP. */
  phases?: BossPhase[];
  drops?: Array<{ itemId: string; chance: number }>;
  knockbackResist: number;
  /** Guards, dodges or drinks ki (see systems/enemyTraits.ts). */
  traits?: EnemyTraits;
}

/** `key`: quest items, handed in to NPCs; using them does nothing. */
export type ItemKind = 'consumable' | 'equipment' | 'key';
export type EquipSlot = 'head' | 'body' | 'hands' | 'feet';
export const EQUIP_SLOTS: readonly EquipSlot[] = ['head', 'body', 'hands', 'feet'];

export interface EquipEffect {
  slot: EquipSlot;
  /** The active character must have reached this level to put it on. */
  minLevel: number;
  expMult: number;
  speedMult: number;
  defBonus: number;
  /** Flavor effects: a multiplier on all damage dealt, and on ki regeneration. */
  damageMult?: number;
  kiRegenMult?: number;
}

export interface ItemDef {
  id: string;
  nameKey: StringKey;
  descKey: StringKey;
  kind: ItemKind;
  heal?: { hpPct: number; kiPct: number };
  equip?: EquipEffect;
  /** Shop price in anchor shards; items without one aren't sold. */
  price?: number;
}

export interface CollectibleDef {
  id: string;
  nameKey: StringKey;
  descKey: StringKey;
}

export interface ZoneDef {
  id: string;
  mapKey: string;
  nameKey: StringKey;
  interior: boolean;
  /** Flag required to fly to this zone from a flight circle. */
  unlockFlag?: string;
  /** Spawn used when arriving by flight; zones without it aren't flight destinations. */
  flightSpawn?: string;
  music?: string;
  /** Only this party member can be played here (no switching): a chapter alone. */
  solo?: string;
}

export interface DialogueLine {
  speaker: StringKey;
  text: StringKey;
}

export interface DialogueDef {
  id: string;
  lines: DialogueLine[];
}
