import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { t } from '../i18n';
import { audio } from '../services/audio';
import { input } from '../services/input';
import { session } from '../services/session';
import { loadGame } from '../services/storage';
import { isTouchDevice } from '../services/touchControls';
import { MenuList } from '../ui/MenuList';
import { FONT_SHADOW } from '../ui/pixelFont';
import { SCENES } from './keys';
import type { WorldSceneData } from './WorldScene';

type Entry = 'continue' | 'new';

export class TitleScene extends Phaser.Scene {
  private list!: MenuList;
  private entries: Entry[] = [];
  private clouds: Array<{ obj: Phaser.GameObjects.Graphics; speed: number }> = [];

  constructor() {
    super(SCENES.title);
  }

  create(): void {
    this.drawSky();
    this.clouds = [];
    for (let i = 0; i < 5; i++) this.addCloud(Math.random() * GAME_WIDTH, 20 + i * 18, i);
    this.drawLandscape();

    this.add
      .bitmapText(GAME_WIDTH / 2, 64, FONT_SHADOW, t('game.title'))
      .setOrigin(0.5)
      .setScale(3)
      .setTint(0xfff4d8);
    this.add
      .bitmapText(GAME_WIDTH / 2, 88, FONT_SHADOW, t('title.subtitle'))
      .setOrigin(0.5)
      .setTint(0xffe9a8);

    const saved = loadGame();
    this.entries = saved ? ['continue', 'new'] : ['new'];
    const labels: Record<Entry, string> = { continue: t('title.continue'), new: t('title.new') };
    this.list = new MenuList(this, GAME_WIDTH / 2 - 50, 150, 100, 14);
    this.list.setItems(this.entries.map((e) => ({ label: labels[e] })));
    this.add
      .bitmapText(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 30,
        FONT_SHADOW,
        t(isTouchDevice() ? 'title.hintTouch' : 'title.hint'),
      )
      .setOrigin(0.5)
      .setTint(0xe0e8ff);
    this.add
      .bitmapText(GAME_WIDTH / 2, GAME_HEIGHT - 16, FONT_SHADOW, t('title.disclaimer'))
      .setOrigin(0.5)
      .setTint(0xb8c0d0);
    input.consumeAll();
  }

  /** Banded sky from deep blue to a warm horizon, in flat pixel-art steps. */
  private drawSky(): void {
    const bands = [0x3a6ab8, 0x4a7ec4, 0x5c92cc, 0x74a6d4, 0x8ebad8, 0xaccad8, 0xcad6d0, 0xe6dcc4];
    const g = this.add.graphics();
    const h = Math.ceil(GAME_HEIGHT / bands.length);
    bands.forEach((c, i) => {
      g.fillStyle(c).fillRect(0, i * h, GAME_WIDTH, h);
      // Two-pixel dither row between bands so the steps read as a gradient.
      const next = bands[i + 1];
      if (next === undefined) return;
      g.fillStyle(next);
      for (let x = (i % 2) * 2; x < GAME_WIDTH; x += 4) g.fillRect(x, (i + 1) * h - 2, 2, 2);
    });
  }

  private addCloud(x: number, y: number, seed: number): void {
    const g = this.add.graphics({ x, y });
    const puffs = 3 + (seed % 3);
    for (let i = 0; i < puffs; i++) {
      const px = i * 14 - puffs * 7;
      const r = 9 + ((seed * 7 + i * 5) % 7);
      g.fillStyle(0xc8d6e4).fillEllipse(px, 3, r * 2.4, r * 1.2);
      g.fillStyle(0xf4f8fc).fillEllipse(px, 0, r * 2.2, r * 1.1);
    }
    this.clouds.push({ obj: g, speed: 6 + (seed % 4) * 3 });
  }

  /** Mountains, hills, the sea and the Watchtower on its cliff, as flat layered shapes. */
  private drawLandscape(): void {
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const g = this.add.graphics();
    const ridge = (base: number, amp: number, period: number, color: number, phase: number) => {
      g.fillStyle(color);
      for (let x = 0; x < W; x += 2) {
        const top =
          base - Math.abs(Math.sin((x + phase) / period)) * amp - Math.sin((x + phase) / 13) * 3;
        g.fillRect(x, Math.round(top), 2, H - Math.round(top));
      }
    };
    ridge(150, 46, 70, 0x8a90b4, 0);
    // Snow caps on the far range.
    g.fillStyle(0xe8eef6);
    for (let x = 0; x < W; x += 2) {
      const peak = Math.abs(Math.sin(x / 70));
      if (peak > 0.86) g.fillRect(x, Math.round(150 - peak * 46 - Math.sin(x / 13) * 3), 2, 4);
    }
    ridge(178, 22, 50, 0x5e8a6a, 40);
    g.fillStyle(0x2a62b0).fillRect(0, 196, W, H - 196);
    g.fillStyle(0x4a82c8);
    for (let x = 6; x < W; x += 23) g.fillRect(x, 202 + ((x * 7) % 30), 6, 1);
    ridge(206, 18, 90, 0x4c9a58, 200);
    // The Watchtower on the cliff, right side.
    const tx = W - 70;
    g.fillStyle(0x6a6478).fillRect(tx - 34, 180, 70, H - 180);
    g.fillStyle(0x4c9a58).fillRect(tx - 34, 176, 70, 6);
    g.fillStyle(0x3a3640).fillRect(tx - 9, 112, 18, 66);
    g.fillStyle(0x9a96a0).fillRect(tx - 8, 112, 16, 65);
    g.fillStyle(0xc04a3a)
      .fillRect(tx - 8, 132, 16, 6)
      .fillRect(tx - 8, 154, 16, 6);
    g.fillStyle(0x3a3640).fillRect(tx - 11, 104, 22, 9);
    g.fillStyle(0xffe890).fillRect(tx - 6, 96, 12, 8);
    g.fillStyle(0x3a3640).fillRect(tx - 8, 92, 16, 4);
    const beam = this.add
      .image(tx, 100, 'glow')
      .setTint(0xfff0b0)
      .setScale(2, 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: beam, alpha: 0.3, yoyo: true, repeat: -1, duration: 1100 });
  }

  override update(_time: number, delta: number): void {
    for (const c of this.clouds) {
      c.obj.x -= (delta / 1000) * c.speed;
      if (c.obj.x < -90) c.obj.x += GAME_WIDTH + 180;
    }
    this.list.update();
    if (!input.justPressed('confirm') && !input.justPressed('pause')) return;
    const entry = this.entries[this.list.index];
    input.consumeAll();
    audio.play('menuConfirm');
    const data: WorldSceneData = {};
    if (entry === 'continue') {
      const saved = loadGame();
      if (!saved) return;
      session.load(saved);
    } else {
      session.reset();
      data.spawn = 'start';
    }
    this.cameras.main.fadeOut(300);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.world, data);
    });
  }
}
