import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import type { Enemy } from '../entities/Enemy';
import { t } from '../i18n';
import { options } from '../services/options';
import { session } from '../services/session';
import { isTouchDevice } from '../services/touchControls';
import { activeProgress } from '../systems/gameState';
import { expToNext } from '../systems/leveling';
import { Bar } from '../ui/Bar';
import { FONT_SHADOW } from '../ui/pixelFont';
import { SpecialSelector } from '../ui/SpecialSelector';
import { PANEL_STYLE, TextPanel } from '../ui/TextPanel';
import { SCENES } from './keys';
import { WORLD_EVENTS, type WorldScene } from './WorldScene';

const HP_COLOR = 0x4ade5a;
const HP_LOW_COLOR = 0xe84a3a;
const KI_COLOR = 0x5ac8ff;
const KI_FORM_COLOR = 0x9ff6ff;
const EXP_COLOR = 0xf0f0a0;
/** Toasts stay up long enough to read: a base time plus time per character. */
const TOAST_BASE_MS = 1800;
const TOAST_MS_PER_CHAR = 55;
const TOAST_MAX_MS = 6000;
/** Bottom edge of the toast box: above the controls strip, or above the boss bar. */
const TOAST_BOTTOM = GAME_HEIGHT - 17;
const TOAST_BOTTOM_BOSS = GAME_HEIGHT - 29;

/** HUD running in parallel to the world scene; it polls the player each frame. */
export class UIScene extends Phaser.Scene {
  private hpBar!: Bar;
  private kiBar!: Bar;
  private expBar!: Bar;
  private nameText!: Phaser.GameObjects.BitmapText;
  private hpText!: Phaser.GameObjects.BitmapText;
  private selector!: SpecialSelector;
  private toastPanel!: TextPanel;
  private portrait!: Phaser.GameObjects.Image;
  private portraitFrame!: Phaser.GameObjects.Rectangle;
  private toastTween?: Phaser.Tweens.Tween;
  /** Messages waiting for the current toast to be read (a new one never cuts the last). */
  private toastQueue: string[] = [];
  private toastShowing = false;
  private controlsHint!: Phaser.GameObjects.BitmapText;
  private controlsStrip!: Phaser.GameObjects.Rectangle;
  /** Dark plate behind the portrait, name and bars; it widens with the HP text. */
  private statusPlate!: Phaser.GameObjects.Rectangle;
  private boss: Enemy | null = null;
  private bossBar!: Bar;
  private bossName!: Phaser.GameObjects.BitmapText;
  /** Anchor shards carried, top-right. */
  private moneyPlate!: Phaser.GameObjects.Rectangle;
  private moneyText!: Phaser.GameObjects.BitmapText;
  private moneyIcon!: Phaser.GameObjects.Image;

  constructor() {
    super(SCENES.ui);
  }

  private get world(): WorldScene {
    return this.scene.get(SCENES.world) as WorldScene;
  }

  create(): void {
    this.statusPlate = this.add
      .rectangle(1, 1, 176, 29, PANEL_STYLE.fill, 0.8)
      .setOrigin(0)
      .setStrokeStyle(1, 0x50607a);
    this.portraitFrame = this.add
      .rectangle(4, 4, 20, 22, 0x101020)
      .setOrigin(0)
      .setStrokeStyle(1, 0xffffff);
    this.portrait = this.add.image(14, 16, 'pixel');
    this.nameText = this.add.bitmapText(28, 0, FONT_SHADOW, '');
    this.hpBar = new Bar(this, 28, 13, 96, 5, HP_COLOR);
    this.kiBar = new Bar(this, 28, 20, 96, 3, KI_COLOR);
    this.expBar = new Bar(this, 28, 25, 96, 1, EXP_COLOR);
    this.hpText = this.add.bitmapText(128, 7, FONT_SHADOW, '');
    this.selector = new SpecialSelector(this, 4, 31);
    this.moneyPlate = this.add
      .rectangle(GAME_WIDTH - 1, 1, 40, 14, PANEL_STYLE.fill, 0.8)
      .setOrigin(1, 0)
      .setStrokeStyle(1, 0x50607a);
    this.moneyText = this.add.bitmapText(GAME_WIDTH - 5, 1, FONT_SHADOW, '').setOrigin(1, 0);
    this.moneyIcon = this.add.image(GAME_WIDTH - 1, 8, 'shard-coin');
    // Bottom-anchored and wrapped, so a long hint grows upward into a second line.
    this.toastPanel = new TextPanel(this, GAME_WIDTH / 2, TOAST_BOTTOM, '', {
      originY: 1,
      maxWidth: GAME_WIDTH - 40,
      padX: 8,
      padY: 4,
    }).setAlpha(0);

    // A dark strip keeps the controls hint (or the boss bar) readable over grass and stone.
    this.controlsStrip = this.add
      .rectangle(0, GAME_HEIGHT - 14, GAME_WIDTH, 14, PANEL_STYLE.fill, 0.82)
      .setOrigin(0);
    this.controlsHint = this.add
      .bitmapText(4, GAME_HEIGHT - 13, FONT_SHADOW, t('hud.controls'))
      .setTint(0xe0e8ff);
    this.bossName = this.add
      .bitmapText(GAME_WIDTH / 2, GAME_HEIGHT - 26, FONT_SHADOW, '')
      .setOrigin(0.5, 0)
      .setTint(0xff9a9a);
    this.bossBar = new Bar(this, GAME_WIDTH / 2 - 90, GAME_HEIGHT - 12, 180, 5, 0xe84a3a);
    this.setBoss(null);

    const worldEvents = this.world.events;
    worldEvents.on(WORLD_EVENTS.toast, this.toast, this);
    worldEvents.on(WORLD_EVENTS.hudVisible, this.setHudVisible, this);
    worldEvents.on(WORLD_EVENTS.bossChanged, this.setBoss, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      worldEvents.off(WORLD_EVENTS.toast, this.toast, this);
      worldEvents.off(WORLD_EVENTS.hudVisible, this.setHudVisible, this);
      worldEvents.off(WORLD_EVENTS.bossChanged, this.setBoss, this);
    });
  }

  /** Cutscenes hide the whole HUD (toasts included). */
  private setHudVisible(visible: boolean): void {
    this.cameras.main.setVisible(visible);
  }

  private setBoss(boss: Enemy | null): void {
    this.boss = boss;
    this.bossBar.setVisible(boss !== null);
    this.bossName.setVisible(boss !== null);
    const stripH = boss ? 28 : 14;
    this.controlsStrip.setPosition(0, GAME_HEIGHT - stripH).setSize(GAME_WIDTH, stripH);
    if (boss) {
      this.bossName.setText(t(boss.displayNameKey));
      this.bossBar.set(1, false);
    }
    // Keep toasts clear of the boss bar.
    this.toastPanel.setY(boss ? TOAST_BOTTOM_BOSS : TOAST_BOTTOM);
  }

  toast(message: string): void {
    // Repeats (e.g. "not enough ki" while mashing) refresh the current one instead of piling up.
    const repeat = this.toastShowing && this.toastPanel.text === message;
    if (this.toastShowing && !repeat) {
      if (this.toastQueue.length < 3 && !this.toastQueue.includes(message))
        this.toastQueue.push(message);
      return;
    }
    this.showToast(message);
  }

  private showToast(message: string): void {
    this.toastTween?.stop();
    this.toastShowing = true;
    this.toastPanel.setText(message).setAlpha(1);
    this.toastTween = this.tweens.add({
      targets: this.toastPanel,
      alpha: 0,
      delay: Math.min(TOAST_MAX_MS, TOAST_BASE_MS + message.length * TOAST_MS_PER_CHAR),
      duration: 300,
      onComplete: () => {
        this.toastShowing = false;
        const next = this.toastQueue.shift();
        if (next) this.showToast(next);
      },
    });
  }

  override update(): void {
    const player = this.world.player;
    if (!player?.active) return;
    // The dialogue box covers the bottom of the screen: nothing of the HUD should peek out.
    const talking = this.scene.isActive(SCENES.dialogue);
    // On a phone the buttons are labeled: the keyboard hint would only cover the screen.
    const hint = options.showControls && !isTouchDevice() && !this.boss && !talking;
    this.controlsHint.setVisible(hint);
    this.controlsStrip.setVisible(hint || (this.boss !== null && !talking));
    this.toastPanel.setVisible(!talking && this.toastPanel.text !== '');
    if (this.boss) {
      if (!this.boss.active) this.setBoss(null);
      else this.bossBar.set(this.boss.hp / this.boss.def.hp);
    }
    const progress = activeProgress(session.state);
    const d = player.derived;
    const hpFrac = player.hp / d.maxHp;

    this.nameText.setText(
      `${t(player.character.nameKey)}  ${t('hud.level', { level: progress.level })}`,
    );
    this.hpText.setText(`${Math.ceil(player.hp)}/${d.maxHp}`);
    this.moneyText.setText(t('hud.moneyCount', { amount: session.state.money }));
    const moneyW = this.moneyText.width + 18;
    this.moneyPlate.setSize(moneyW, 14);
    this.moneyIcon.setX(GAME_WIDTH - moneyW + 6);
    this.statusPlate.setSize(
      Math.max(this.hpText.x + this.hpText.width + 3, this.nameText.x + this.nameText.width + 3),
      29,
    );
    this.hpBar.setColor(hpFrac < 0.25 ? HP_LOW_COLOR : HP_COLOR);
    this.hpBar.set(hpFrac);
    this.kiBar.setColor(player.transformation ? KI_FORM_COLOR : KI_COLOR);
    // The white trail shows what each technique cost.
    this.kiBar.set(player.ki / d.maxKi);
    this.expBar.set(progress.exp / expToNext(progress.level), false);

    const specials = player.specials;
    this.selector.update({
      specials,
      selected: player.specialIndex % Math.max(1, specials.length),
      ki: player.ki,
      transformations: player.character.transformations,
      activeTransform: player.transformation?.id ?? null,
    });

    if (this.portrait.texture.key !== player.sheetKey) {
      this.portrait.setTexture(player.sheetKey, 0).setCrop(0, 0, 16, 13);
      this.portraitFrame.setStrokeStyle(1, player.character.color);
    }
  }
}
