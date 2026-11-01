import type Phaser from 'phaser';
import type { TransformationDef } from '../data/types';
import type { HitOutcome } from '../systems/enemyTraits';
import type { Enemy } from './Enemy';
import type { Player } from './Player';
import type { Projectile, ProjectileSpec } from './Projectile';

/** What entities need from the world scene, without importing it (avoids cycles). */
export interface CombatHost extends Phaser.Scene {
  player: Player;
  /** A cutscene is running: enemies hold still. */
  readonly cinematic?: boolean;
  fireProjectile(spec: ProjectileSpec): void;
  enemiesInRect(rect: Phaser.Geom.Rectangle): Enemy[];
  /** Living enemies, for aim assist. */
  liveEnemies(): Enemy[];
  hitPlayer(raw: number, fromX: number, fromY: number, knockback: number): void;
  /** Feedback for a landed hit; `outcome` says if a trait blocked or absorbed it. */
  /** `quiet`: one tick of a sustained beam (no hit-stop, fewer sounds). */
  onPlayerHitEnemy(
    enemy: Enemy,
    damage: number,
    finisher: boolean,
    outcome?: HitOutcome,
    quiet?: boolean,
  ): void;
  /** How far a blast drawn `lift` px up gets from `origin` along `angle` (≤ maxLen). */
  shotReach?(origin: { x: number; y: number }, angle: number, maxLen: number, lift: number): number;
  /** Player blasts in flight, for enemies that dodge. */
  playerShots?(): Projectile[];
  /** A swing reached `rect` (once per swing): breakable props like boulders react. */
  strikeProps?(rect: Phaser.Geom.Rectangle, finisher: boolean): void;
  onEnemyDefeated(enemy: Enemy): void;
  onBossPhaseChange?(enemy: Enemy, phaseIndex: number): void;
  /** A boss started winding up its super move (warning text, screen effects). */
  onBossUltimate?(enemy: Enemy, windupMs: number): void;
  onNotEnoughKi(): void;
  /** The special selector moved. */
  onSpecialChanged(): void;
  /** Feedback when a double-tap run starts. */
  onRunStart?(x: number, y: number): void;
  onTransform(tr: TransformationDef, active: boolean): void;
  onPlayerDowned(): void;
  /** Whether the current zone allows flying (outdoors). */
  canFly(): boolean;
  /** Whether the ground under the player's body is walkable. */
  canLandHere(): boolean;
  /** No wall tiles inside this world rectangle. */
  isOpenGround?(x: number, y: number, width: number, height: number): boolean;
  onFlightDenied(reason: 'indoors' | 'land' | 'cantFly'): void;
  onFlightChanged(flying: boolean): void;
}
