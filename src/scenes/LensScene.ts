import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import type { EnemyDef } from '../data/types';
import { t } from '../i18n';
import { input } from '../services/input';
import { frameIndex } from '../ui/humanoid';
import { FONT_SHADOW } from '../ui/pixelFont';
import { portraitView } from '../ui/portrait';
import { SCENES } from './keys';

export interface LensTarget {
  def: EnemyDef;
  hp: number;
  sheetKey: string;
  /** Screen position of the enemy when the lens opened. */
  x: number;
  y: number;
}

const GREEN = 0x5cff8a;

/** "Power level" flavor number: a readable summary of an enemy's stats. */
function battlePower(def: EnemyDef): number {
  return Math.round((def.hp * 2 + def.atk * 25 + def.def * 40) * (1 + def.level / 4));
}

/** Freezes the game and shows stats of the nearest/selected enemy; left/right cycles. */
export class LensScene extends Phaser.Scene {
  private targets: LensTarget[] = [];
  private index = 0;
  private reticle!: Phaser.GameObjects.Rectangle;
  private portrait!: Phaser.GameObjects.Image;
  private portraitBox = { x: 0, y: 0, w: 48, h: 78 };
  private info!: Phaser.GameObjects.BitmapText;
  private desc!: Phaser.GameObjects.BitmapText;
  private counter!: Phaser.GameObjects.BitmapText;

  constructor() {
    super(SCENES.lens);
  }

  /** Boss introduction: opened by the game when a boss fight starts, closes with D too. */
  private intro = false;

  create(data: { targets: LensTarget[]; intro?: boolean }): void {
    this.targets = data.targets;
    this.intro = data.intro ?? false;
    this.index = 0;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x00ff60, 0.12).setOrigin(0);
    for (let y = 0; y < GAME_HEIGHT; y += 3) {
      this.add.rectangle(0, y, GAME_WIDTH, 1, 0x002010, 0.25).setOrigin(0);
    }
    // Title up top, controls on a bar over the HUD's strip: side by side they don't fit at 384 px.
    this.add
      .bitmapText(GAME_WIDTH - 6, 4, FONT_SHADOW, t(this.intro ? 'lens.rival' : 'lens.title'))
      .setOrigin(1, 0)
      .setTint(this.intro ? 0xffd34a : GREEN);
    this.add.rectangle(0, GAME_HEIGHT - 14, GAME_WIDTH, 14, 0x001808, 0.95).setOrigin(0);
    this.add
      .bitmapText(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 13,
        FONT_SHADOW,
        t(this.intro ? 'lens.introHint' : 'lens.hint'),
      )
      .setOrigin(0.5, 0)
      .setTint(GREEN);

    if (this.targets.length === 0) {
      this.add
        .bitmapText(GAME_WIDTH / 2, GAME_HEIGHT / 2, FONT_SHADOW, t('lens.none'))
        .setOrigin(0.5)
        .setTint(GREEN);
      return;
    }
    this.reticle = this.add.rectangle(0, 0, 24, 30).setStrokeStyle(1, GREEN);
    this.tweens.add({ targets: this.reticle, scale: 1.15, yoyo: true, repeat: -1, duration: 300 });
    const panelX = 10;
    const panelY = 34;
    this.add
      .rectangle(panelX, panelY, 210, 134, 0x001808, 0.88)
      .setOrigin(0)
      .setStrokeStyle(1, GREEN);
    this.portraitBox = { x: panelX + 3, y: panelY + 4, w: 48, h: 78 };
    this.portrait = this.add.image(0, 0, 'pixel').setOrigin(0);
    this.info = this.add
      .bitmapText(panelX + 54, panelY + 6, FONT_SHADOW, '')
      .setTint(GREEN)
      .setLineSpacing(1);
    this.desc = this.add
      .bitmapText(panelX + 6, panelY + 86, FONT_SHADOW, '')
      .setMaxWidth(196)
      .setTint(0xc8ffd8);
    this.counter = this.add
      .bitmapText(panelX + 204, panelY + 120, FONT_SHADOW, '')
      .setOrigin(1, 0)
      .setTint(GREEN);
    this.show();
  }

  private show(): void {
    const target = this.targets[this.index];
    if (!target) return;
    const def = target.def;
    this.reticle.setPosition(Math.round(target.x), Math.round(target.y));
    const frame = frameIndex('down', 'idle');
    const box = this.portraitBox;
    const v = portraitView(this, target.sheetKey, frame, box.w, box.h);
    this.portrait
      .setTexture(target.sheetKey, frame)
      .setScale(v.scale)
      .setCrop(v.x, v.y, v.w, v.h)
      .setPosition(
        box.x + Math.round((box.w - v.w * v.scale) / 2) - v.x * v.scale,
        box.y + Math.round((box.h - v.h * v.scale) / 2) - v.y * v.scale,
      );
    this.info.setText(
      [
        t(def.nameKey),
        t('lens.level', { level: def.level }),
        t('lens.hp', { hp: Math.ceil(target.hp), max: def.hp }),
        `${t('lens.atk', { value: def.atk })}  ${t('lens.def', { value: def.def })}`,
        t('lens.exp', { value: def.exp }),
        t('lens.power', { value: battlePower(def).toLocaleString('es') }),
      ].join('\n'),
    );
    this.desc.setText(t(def.descKey));
    this.counter.setText(t('lens.count', { index: this.index + 1, count: this.targets.length }));
  }

  override update(): void {
    const close =
      input.justPressed('lens') ||
      input.justPressed('cancel') ||
      input.justPressed('pause') ||
      (this.intro && (input.justPressed('confirm') || input.justPressed('attack')));
    if (close) {
      input.consumeAll();
      this.scene.resume(SCENES.world);
      this.scene.stop();
      return;
    }
    const n = this.targets.length;
    if (n < 2) return;
    if (input.menuPressed('right') || input.menuPressed('down')) this.index = (this.index + 1) % n;
    else if (input.menuPressed('left') || input.menuPressed('up'))
      this.index = (this.index - 1 + n) % n;
    else return;
    this.show();
  }
}
