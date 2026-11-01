import Phaser from 'phaser';
import {
  type Facing,
  FOOT_PAD,
  FRAME_SIZES,
  frameIndex,
  type Pose,
  type SpriteClass,
} from '../ui/spriteSpec';
import { SHADOW_KEYS } from '../ui/textures';
import { facingFromVector } from '../utils/direction';

/** The sprite class whose frame width matches (hand-drawn sheets of other sizes count as large). */
function classOfFrame(width: number): SpriteClass {
  const match = (Object.keys(FRAME_SIZES) as SpriteClass[]).find((c) => FRAME_SIZES[c].w === width);
  return match ?? (width > FRAME_SIZES.humanoid.w ? 'large' : 'humanoid');
}

/** Feet box; it is centered horizontally and rests on the frame's bottom (see spriteSpec). */
export interface BodySpec {
  w: number;
  h: number;
}

/**
 * Base for anything that walks: a physics sprite with 4-way facing, pose frames,
 * a ground shadow and y-based depth sorting (top-down "fake 3D").
 */
export class Actor extends Phaser.Physics.Arcade.Sprite {
  facing: Facing = 'down';
  protected pose: Pose = 'idle';
  protected poseLockUntil = 0;
  readonly shadow: Phaser.GameObjects.Image;
  sheetKey: string;
  /** Body offset inside the current frame (frame sizes differ between sprite classes). */
  protected bodyOffset = { x: 0, y: 0 };
  private readonly bodySpec: BodySpec;

  constructor(scene: Phaser.Scene, x: number, y: number, sheetKey: string, body: BodySpec) {
    super(scene, x, y, sheetKey, 0);
    this.sheetKey = sheetKey;
    this.bodySpec = body;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).setSize(body.w, body.h);
    this.shadow = scene.add.image(x, y, SHADOW_KEYS[classOfFrame(this.frame.width)]);
    this.shadow.setDepth(0);
    this.setFrame(frameIndex(this.facing, 'idle'));
    this.fitBody();
  }

  private fitBody(): void {
    this.bodyOffset = {
      x: Math.round((this.frame.width - this.bodySpec.w) / 2),
      y: this.frame.height - this.bodySpec.h - FOOT_PAD,
    };
    this.arcadeBody.setOffset(this.bodyOffset.x, this.bodyOffset.y);
  }

  /** Feet body extended up to mid-sprite, so punches and shots connect with the torso. */
  get hurtbox(): Phaser.Geom.Rectangle {
    const b = this.arcadeBody;
    const extra = Math.round(this.frame.height / 2);
    return new Phaser.Geom.Rectangle(b.x, b.y - extra, b.width, b.height + extra);
  }

  /** Cutscenes drive this actor; subclasses skip their own update while it's set. */
  scripted = false;

  /** Moves the sprite so the feet (body center) land on (x, y) right away. */
  placeFeet(x: number, y: number): void {
    const dy = this.bodyOffset.y + this.bodySpec.h / 2 - this.frame.height / 2;
    this.arcadeBody.reset(x, y - dy);
  }

  /** Cutscene animation: the idle or walk loop, optionally turning first. */
  scriptLoop(loop: 'idle' | 'walk', facing?: Facing): void {
    if (facing) this.facing = facing;
    this.poseLockUntil = 0;
    this.pose = loop === 'walk' ? 'walk1' : 'idle';
    this.anims.play(`${this.sheetKey}-${loop}-${this.facing}`, true);
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  /** Feet position: the physics body center, used for distances and depth. */
  get footX(): number {
    return this.arcadeBody.center.x;
  }

  get footY(): number {
    return this.arcadeBody.center.y;
  }

  setSheet(key: string): void {
    this.sheetKey = key;
    this.setTexture(key, frameIndex(this.facing, this.pose));
    this.fitBody();
  }

  /** Shows a pose frame for `ms` milliseconds, overriding walk animation. */
  holdPose(pose: Pose, ms: number): void {
    this.pose = pose;
    this.poseLockUntil = this.scene.time.now + ms;
    this.anims.stop();
    this.setFrame(frameIndex(this.facing, pose));
  }

  faceToward(x: number, y: number): void {
    this.facing = facingFromVector(x - this.footX, y - this.footY, this.facing);
  }

  /** Which looping animation to show when no pose is locked. */
  protected locomotion(moving: boolean): 'idle' | 'walk' | 'fly' {
    return moving ? 'walk' : 'idle';
  }

  /** Plays the idle/walk/fly loop unless a pose is locked. */
  protected animateLocomotion(moveX: number, moveY: number): void {
    if (this.scene.time.now < this.poseLockUntil) {
      this.setFrame(frameIndex(this.facing, this.pose));
      return;
    }
    const loop = this.locomotion(moveX !== 0 || moveY !== 0);
    this.pose = loop === 'walk' ? 'walk1' : loop === 'fly' ? 'fly' : 'idle';
    this.anims.play(`${this.sheetKey}-${loop}-${this.facing}`, true);
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.shadow.setPosition(Math.round(this.footX), Math.round(this.arcadeBody.bottom));
    this.setDepth(this.arcadeBody.bottom);
  }

  override destroy(fromScene?: boolean): void {
    this.shadow.destroy();
    super.destroy(fromScene);
  }
}
