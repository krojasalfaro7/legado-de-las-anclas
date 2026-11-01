import Phaser from 'phaser';
import { getCharacter } from '../data/characters';
import { getNpc, type NpcDef } from '../data/npcs';
import { type StringKey, t } from '../i18n';
import { type BarrierKind, type BarrierRule, BOULDER_HITS } from '../systems/barriers';
import { FEET_BOX, SHEET_KEYS } from '../ui/spriteSpec';
import { TextPanel } from '../ui/TextPanel';
import { ensureActorSheet } from '../ui/textures';
import { Actor } from './Actor';

/** Anything the player can use with the interact button. */
export interface Interactable {
  readonly ix: number;
  readonly iy: number;
  readonly radius: number;
  /** Floor objects trigger when stood on, not only when faced. */
  readonly onFloor: boolean;
  enabled(): boolean;
}

export class Chest extends Phaser.Physics.Arcade.Image implements Interactable {
  readonly onFloor = false;
  readonly radius = 12;
  opened = false;
  hidden = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly key: string,
    readonly itemId: string | undefined,
    readonly collectibleId: string | undefined,
    readonly hiddenGroup: string | undefined,
  ) {
    super(scene, x, y, 'chest-closed');
    scene.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(y);
  }

  get ix(): number {
    return this.x;
  }

  get iy(): number {
    return this.y - 4;
  }

  /** Call after the static body exists (static group add). */
  fitBody(): void {
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(14, 8);
    body.setOffset(1, 5);
    body.updateFromGameObject();
    this.refreshVisibility();
  }

  setOpened(opened: boolean): void {
    this.opened = opened;
    this.setTexture(opened ? 'chest-open' : 'chest-closed');
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.refreshVisibility();
  }

  private refreshVisibility(): void {
    this.setVisible(!this.hidden);
    const body = this.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = !this.hidden;
  }

  enabled(): boolean {
    return !this.opened && !this.hidden;
  }
}

/** Signs (level plaques) stay above actors walking in front of them. */
const LABEL_DEPTH = 250_000;

/**
 * A barrier (see systems/barriers.ts): colored level barrier, boulder or story seal. Solid until
 * it shatters; level barriers show the required level in the character's color.
 */
const BARRIER_TEXTURES: Record<BarrierKind, string> = {
  level: 'gate',
  boulder: 'barrier-boulder',
  seal: 'barrier-seal',
  vent: 'barrier-vent',
  crawl: 'barrier-crawl',
};

export class Gate implements Interactable {
  readonly onFloor = false;
  readonly radius: number;
  readonly zone: Phaser.GameObjects.Zone;
  private readonly tiles: Phaser.GameObjects.Image[] = [];
  private readonly label: TextPanel | null;
  broken = false;
  /** Boulders: punches taken so far. */
  hits = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly rect: Phaser.Geom.Rectangle,
    readonly key: string,
    readonly rule: BarrierRule,
    /** Seals: what the player is told while it's closed. */
    readonly hintKey?: StringKey,
  ) {
    const color = getCharacter(rule.character).color;
    const texture = BARRIER_TEXTURES[rule.kind];
    for (let x = rect.x; x < rect.right; x += 16) {
      for (let y = rect.y; y < rect.bottom; y += 16) {
        const tile = scene.add.image(x + 8, y + 8, texture).setDepth(rect.bottom);
        if (rule.kind === 'level') {
          tile.setTint(color);
          scene.tweens.add({
            targets: tile,
            alpha: 0.65,
            yoyo: true,
            repeat: -1,
            duration: 500 + Math.random() * 200,
          });
        } else if (rule.kind === 'seal') {
          // The rune breathes slowly: sealed, not broken.
          scene.tweens.add({ targets: tile, alpha: 0.82, yoyo: true, repeat: -1, duration: 1400 });
        }
        this.tiles.push(tile);
      }
    }
    // Boulders and seals don't show a number unless they also need a level.
    const showLevel = rule.kind === 'level' || (rule.kind !== 'seal' && rule.level > 1);
    // A plaque (white on dark, framed in the character's color) reads over any tile.
    this.label = showLevel
      ? new TextPanel(scene, rect.centerX, rect.y - 1, t('hud.level', { level: rule.level }), {
          originY: 1,
          border: color,
          padX: 3,
          padY: 1,
        }).setDepth(LABEL_DEPTH)
      : null;
    this.zone = scene.add.zone(rect.centerX, rect.centerY, rect.width, rect.height);
    scene.physics.add.existing(this.zone, true);
    this.radius = Math.max(rect.width, rect.height) / 2 + 6;
  }

  /** Top of whatever is drawn over the barrier (its level plaque), for the "!" prompt. */
  get top(): number {
    return this.label ? this.rect.y - 14 : this.rect.y;
  }

  get kind(): BarrierKind {
    return this.rule.kind;
  }

  /** A boulder shudders and darkens as it cracks. */
  crack(): void {
    const left = 1 - this.hits / BOULDER_HITS;
    const shade = Math.round(150 + 105 * left);
    for (const tile of this.tiles) {
      tile.setTint((shade << 16) | (shade << 8) | shade);
      this.scene.tweens.add({
        targets: tile,
        x: tile.x + 1.5,
        yoyo: true,
        repeat: 2,
        duration: 30,
      });
    }
  }

  get ix(): number {
    return this.rect.centerX;
  }

  get iy(): number {
    return this.rect.centerY;
  }

  enabled(): boolean {
    return !this.broken;
  }

  /** Closest point of the barrier to (x, y); used for "facing the gate" checks. */
  nearestPoint(x: number, y: number): { x: number; y: number } {
    return {
      x: Phaser.Math.Clamp(x, this.rect.x, this.rect.right),
      y: Phaser.Math.Clamp(y, this.rect.y, this.rect.bottom),
    };
  }

  shatter(animate: boolean): void {
    this.broken = true;
    (this.zone.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.label?.destroy();
    for (const tile of this.tiles) {
      if (!animate) {
        tile.destroy();
        continue;
      }
      this.scene.tweens.killTweensOf(tile);
      this.scene.tweens.add({
        targets: tile,
        y: tile.y - 10 - Math.random() * 10,
        x: tile.x + (Math.random() - 0.5) * 20,
        alpha: 0,
        angle: (Math.random() - 0.5) * 90,
        duration: 450,
        onComplete: () => tile.destroy(),
      });
    }
  }
}

export type CircleKind = 'save' | 'flight';

export class FloorCircle extends Phaser.GameObjects.Image implements Interactable {
  readonly onFloor = true;
  readonly radius = 13;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly kind: CircleKind,
  ) {
    super(scene, x, y, kind === 'save' ? 'save-circle' : 'flight-circle');
    scene.add.existing(this);
    this.setDepth(-5);
    scene.tweens.add({ targets: this, alpha: 0.6, yoyo: true, repeat: -1, duration: 900 });
  }

  get ix(): number {
    return this.x;
  }

  get iy(): number {
    return this.y;
  }

  enabled(): boolean {
    return true;
  }
}

export const NPC_BODY = FEET_BOX.humanoid;

export class Npc extends Actor implements Interactable {
  readonly onFloor = false;
  readonly radius = 15;
  readonly def: NpcDef;

  constructor(scene: Phaser.Scene, x: number, y: number, npcId: string, facing: Actor['facing']) {
    const def = getNpc(npcId);
    const key = SHEET_KEYS.npc(def.id);
    ensureActorSheet(scene, key, def.look);
    super(scene, x, y, key, NPC_BODY);
    this.def = def;
    this.facing = facing;
    this.holdPose('idle', 0);
  }

  /** Call after adding to a physics group. */
  initBody(): void {
    this.arcadeBody.setImmovable(true);
    this.arcadeBody.pushable = false;
  }

  get ix(): number {
    return this.footX;
  }

  get iy(): number {
    return this.footY - 4;
  }

  enabled(): boolean {
    return true;
  }

  override update(): void {
    this.setVelocity(0, 0);
    if (!this.scripted) this.animateLocomotion(0, 0);
  }
}

export type PickupKind = 'item' | 'collectible' | 'money';

/** Auto-collected on touch: enemy drops and hidden collectibles. */
const PICKUP_TEXTURE: Record<PickupKind, string> = {
  item: 'item-drop',
  collectible: 'collectible',
  money: 'shard-coin',
};
const PICKUP_GLOW: Record<PickupKind, number> = {
  item: 0x8cf08c,
  collectible: 0xffd34a,
  money: 0x7ae4f4,
};

export class Pickup extends Phaser.Physics.Arcade.Image {
  private readonly glow: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly kind: PickupKind,
    readonly id: string,
    readonly key?: string,
    /** Shards in a money pickup. */
    readonly amount = 0,
  ) {
    super(scene, x, y, PICKUP_TEXTURE[kind]);
    scene.add.existing(this);
    this.setDepth(y);
    const color = PICKUP_GLOW[kind];
    this.glow = scene.add
      .image(x, y, 'glow')
      .setTint(color)
      .setAlpha(0.4)
      .setScale(0.6)
      .setDepth(y - 1);
    this.glow.setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: this,
      y: y - 3,
      yoyo: true,
      repeat: -1,
      duration: 600,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({ targets: this.glow, alpha: 0.15, yoyo: true, repeat: -1, duration: 600 });
  }

  override destroy(fromScene?: boolean): void {
    this.glow.destroy();
    super.destroy(fromScene);
  }
}
