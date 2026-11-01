import Phaser from 'phaser';
import type { ShotLook } from '../data/types';
import { dustPuff } from '../utils/fx';

export type Faction = 'player' | 'enemy';

/** Pixels past the screen edge before a full-screen blast disappears. */
const OFFSCREEN_MARGIN = 16;
/** Sampling step (px) along a shot's path when testing walls. */
const WALL_SWEEP_STEP = 3;

export interface ProjectileSpec {
  faction: Faction;
  /** Ground position (under the shot, at feet level): what collides with bodies and walls. */
  x: number;
  y: number;
  /** How high above the ground the shot is drawn (chest height, plus altitude when flying). */
  lift: number;
  angle: number;
  speed: number;
  /** Size class (hit circle, glow); `look` picks what is drawn. */
  texture: 'ki-small' | 'ki-big';
  look?: ShotLook;
  color: number;
  lifetimeMs: number;
  /** Charged shots: a wider hit circle and a bigger glow than the texture's default. */
  radius?: number;
  glowScale?: number;
  /** Also vanishes once it leaves the camera view (full-screen ki blasts). */
  untilOffscreen?: boolean;
  pierce: boolean;
  knockback: number;
  /** Launches what it hits (big techniques, full charge). */
  heavy?: boolean;
  /** Final damage given the target's defense (player shots) or raw damage (enemy shots). */
  damage: (targetDef: number) => number;
}

export class Projectile extends Phaser.Physics.Arcade.Image {
  readonly spec: ProjectileSpec;
  private readonly hitTargets = new Set<object>();
  private readonly expiresAt: number;
  private readonly glow: Phaser.GameObjects.Image;
  /** Ground point last frame: the wall test sweeps from there, so fast shots can't skip a trunk. */
  private lastX: number;
  private lastY: number;

  constructor(scene: Phaser.Scene, spec: ProjectileSpec) {
    super(scene, spec.x, spec.y, shotTexture(spec));
    this.spec = spec;
    scene.add.existing(this);
    // Harpoons and darts keep their own colors; orbs, shards and rocks take the shot's.
    if (this.tinted) this.setTint(spec.color);
    this.setDepth(spec.y + 1000);
    this.expiresAt = scene.time.now + spec.lifetimeMs;
    this.lastX = spec.x;
    this.lastY = spec.y;
    this.glow = scene.add
      .image(spec.x, spec.y - spec.lift, 'glow')
      .setTint(spec.color)
      .setAlpha(0.5)
      .setScale(spec.glowScale ?? (spec.texture === 'ki-big' ? 0.8 : 0.45))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(this.glows);
  }

  /** Ki orbs and crystal shards shine; thrown things don't. */
  get glows(): boolean {
    const look = this.spec.look ?? 'ki';
    return look === 'ki' || look === 'shard';
  }

  /** Something thrown (stone, harpoon, dart): no ki in it. */
  get thrown(): boolean {
    const look = this.spec.look ?? 'ki';
    return look === 'rock' || look === 'harpoon' || look === 'dart';
  }

  private get tinted(): boolean {
    const look = this.spec.look ?? 'ki';
    return look !== 'harpoon' && look !== 'dart';
  }

  /**
   * Must be called after adding to a physics group (groups reset body velocity). The body is a
   * ground circle a bit wider than the orb, so a shot along the same row as a target's feet
   * connects; the sprite is lifted like Player's (display origin and body offset together).
   */
  launch(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const r = this.spec.radius ?? (this.spec.texture === 'ki-big' ? 7 : 5);
    body.setCircle(r);
    body.setVelocity(
      Math.cos(this.spec.angle) * this.spec.speed,
      Math.sin(this.spec.angle) * this.spec.speed,
    );
    this.setRotation(this.spec.angle);
    this.placeAboveGround();
  }

  /**
   * Draws the shot `lift` px straight above its ground point whatever its rotation (the origin
   * offset turns with the sprite, so it is counter-rotated), and keeps the hit circle centered
   * on the ground point.
   */
  private placeAboveGround(): void {
    const lift = Math.round(this.spec.lift);
    const ox = this.width / 2 + lift * Math.sin(this.rotation);
    const oy = this.height / 2 + lift * Math.cos(this.rotation);
    this.setDisplayOrigin(ox, oy);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const r = body.halfWidth;
    body.setOffset(ox - r, oy - r);
  }

  /** Returns true the first time this projectile touches a given target. */
  registerHit(target: object): boolean {
    if (this.hitTargets.has(target)) return false;
    this.hitTargets.add(target);
    if (!this.spec.pierce) this.explode();
    return true;
  }

  explode(): void {
    if (!this.active) return;
    if (this.thrown) {
      // Stone crumbles, harpoons and darts clatter: a little dust, no glow.
      dustPuff(this.scene, this.x, this.y - this.spec.lift / 2, 4);
      this.destroy();
      return;
    }
    const burst = this.scene.add
      .image(this.x, this.y - this.spec.lift, 'glow')
      .setTint(this.spec.color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.3)
      .setDepth(this.depth);
    this.scene.tweens.add({
      targets: burst,
      scale: 0.9,
      alpha: 0,
      duration: 180,
      onComplete: () => burst.destroy(),
    });
    this.destroy();
  }

  preUpdate(time: number, _delta: number): void {
    this.glow.setPosition(this.x, this.y - this.spec.lift);
    // Thrown stones tumble.
    if (this.spec.look === 'rock') {
      this.rotation += this.spec.texture === 'ki-big' ? 0.12 : 0.25;
      this.placeAboveGround();
    }
    if (this.hitsWall()) this.explode();
    else if (time >= this.expiresAt) this.explode();
    else if (this.spec.untilOffscreen && this.offscreen()) this.destroy();
  }

  /** Walls, prop footprints, closed gates and chests stop shots (see WorldScene.blocksShot). */
  private hitsWall(): boolean {
    const host = this.scene as Phaser.Scene & {
      blocksShot?: (x: number, y: number, lift: number) => boolean;
    };
    if (!host.blocksShot) return false;
    const dx = this.x - this.lastX;
    const dy = this.y - this.lastY;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / WALL_SWEEP_STEP));
    const lift = this.spec.lift;
    this.lastX = this.x;
    this.lastY = this.y;
    for (let i = 1; i <= steps; i++) {
      if (host.blocksShot(this.x - dx + (dx * i) / steps, this.y - dy + (dy * i) / steps, lift))
        return true;
    }
    return false;
  }

  private offscreen(): boolean {
    const view = this.scene.cameras.main.worldView;
    const m = OFFSCREEN_MARGIN;
    const y = this.y - this.spec.lift;
    return this.x < view.x - m || this.x > view.right + m || y < view.y - m || y > view.bottom + m;
  }

  override destroy(fromScene?: boolean): void {
    this.glow.destroy();
    super.destroy(fromScene);
  }
}

function shotTexture(spec: ProjectileSpec): string {
  const big = spec.texture === 'ki-big';
  switch (spec.look ?? 'ki') {
    case 'rock':
      return big ? 'shot-rock-b' : 'shot-rock-s';
    case 'shard':
      return big ? 'shot-shard-b' : 'shot-shard-s';
    case 'harpoon':
      return 'shot-harpoon';
    case 'dart':
      return 'shot-dart';
    default:
      return spec.texture;
  }
}
