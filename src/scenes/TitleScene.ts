import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { getCharacter } from '../data/characters';
import { t } from '../i18n';
import { audio } from '../services/audio';
import { input } from '../services/input';
import { session } from '../services/session';
import { loadGame } from '../services/storage';
import { isTouchDevice } from '../services/touchControls';
import { MenuList } from '../ui/MenuList';
import { FONT_SHADOW } from '../ui/pixelFont';
import { SHEET_KEYS } from '../ui/spriteSpec';
import { ensureActorSheet } from '../ui/textures';
import { type Picture, paintBackdrop, paintLogo, TITLE_LAYOUT } from '../ui/titleArt';
import { SCENES } from './keys';
import type { WorldSceneData } from './WorldScene';

type Entry = 'continue' | 'new';

interface Drifter {
  obj: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
}

/**
 * Dusk over Aurel: the anchor's light rises from the hills, the Atalaya's beam sweeps the sea and
 * Tavi watches from a cliff. The landscape and logo are painted once (ui/titleArt.ts); this scene
 * animates the light, the stars, the clouds and the motes.
 */
export class TitleScene extends Phaser.Scene {
  private list!: MenuList;
  private entries: Entry[] = [];
  private clouds: Drifter[] = [];
  private motes: Drifter[] = [];
  private beam!: Phaser.GameObjects.Image;
  private pillar!: Phaser.GameObjects.Image;
  private time0 = 0;

  constructor() {
    super(SCENES.title);
  }

  create(): void {
    audio.playMusic('title');
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    this.time0 = 0;
    this.addPicture(`title-backdrop-${W}x${H}`, () => paintBackdrop(W, H)).setOrigin(0);
    this.makeLightTextures();
    this.addStars();
    this.addClouds();
    this.addAnchorLight();
    this.addBeam();
    this.addHero();

    const logo = this.addPicture('title-logo', () => paintLogo(t('game.title')));
    logo.setPosition(W / 2, Math.round(H * 0.2)).setAlpha(0);
    this.tweens.add({ targets: logo, alpha: 1, y: logo.y - 4, duration: 1400, ease: 'Sine.Out' });
    this.add
      .bitmapText(
        W / 2,
        Math.round(H * 0.2) + logo.height / 2 + 6,
        FONT_SHADOW,
        t('title.subtitle'),
      )
      .setOrigin(0.5)
      .setTint(0xffd8b0);

    const saved = loadGame();
    this.entries = saved ? ['continue', 'new'] : ['new'];
    const labels: Record<Entry, string> = { continue: t('title.continue'), new: t('title.new') };
    const menuY = Math.round(H * 0.5);
    this.add
      .rectangle(
        W / 2,
        menuY + this.entries.length * 7 - 2,
        132,
        this.entries.length * 14 + 10,
        0x0a0820,
        0.55,
      )
      .setStrokeStyle(1, 0xffc890, 0.35);
    this.list = new MenuList(this, W / 2 - 50, menuY, 100, 14);
    this.list.setItems(this.entries.map((e) => ({ label: labels[e] })));
    this.add
      .bitmapText(W / 2, H - 30, FONT_SHADOW, t(isTouchDevice() ? 'title.hintTouch' : 'title.hint'))
      .setOrigin(0.5)
      .setTint(0xe0e8ff);
    this.add
      .bitmapText(W / 2, H - 16, FONT_SHADOW, t('title.disclaimer'))
      .setOrigin(0.5)
      .setTint(0xb8c0d0);
    this.cameras.main.fadeIn(600);
    input.consumeAll();
  }

  /** A painted picture, cached as a texture for the session. */
  private addPicture(key: string, paint: () => Picture): Phaser.GameObjects.Image {
    if (!this.textures.exists(key)) {
      const pic = paint();
      const canvas = document.createElement('canvas');
      canvas.width = pic.width;
      canvas.height = pic.height;
      canvas.getContext('2d')?.putImageData(new ImageData(pic.data, pic.width, pic.height), 0, 0);
      this.textures.addCanvas(key, canvas);
    }
    return this.add.image(0, 0, key);
  }

  private makeLightTextures(): void {
    const canvas = (
      key: string,
      w: number,
      h: number,
      draw: (c: CanvasRenderingContext2D) => void,
    ) => {
      if (this.textures.exists(key)) return;
      const el = document.createElement('canvas');
      el.width = w;
      el.height = h;
      const c = el.getContext('2d');
      if (c) draw(c);
      this.textures.addCanvas(key, el);
    };
    // The anchor's light: a soft column, brightest at its core and its foot.
    canvas('title-pillar', 48, 256, (c) => {
      const across = c.createLinearGradient(0, 0, 48, 0);
      across.addColorStop(0, 'rgba(255,255,255,0)');
      across.addColorStop(0.42, 'rgba(255,255,255,0.35)');
      across.addColorStop(0.5, 'rgba(255,255,255,1)');
      across.addColorStop(0.58, 'rgba(255,255,255,0.35)');
      across.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = across;
      c.fillRect(0, 0, 48, 256);
      c.globalCompositeOperation = 'destination-in';
      const up = c.createLinearGradient(0, 0, 0, 256);
      up.addColorStop(0, 'rgba(0,0,0,0)');
      up.addColorStop(0.6, 'rgba(0,0,0,0.55)');
      up.addColorStop(1, 'rgba(0,0,0,1)');
      c.fillStyle = up;
      c.fillRect(0, 0, 48, 256);
    });
    canvas('title-glow', 64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.3, 'rgba(255,255,255,0.4)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    });
    // The lighthouse beam: a cone that widens and fades away from the lamp.
    canvas('title-beam', 200, 40, (c) => {
      const g = c.createLinearGradient(0, 0, 200, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.7)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, 18);
      c.lineTo(200, 0);
      c.lineTo(200, 40);
      c.lineTo(0, 22);
      c.closePath();
      c.fill();
    });
    canvas('title-dot', 1, 1, (c) => {
      c.fillStyle = '#fff';
      c.fillRect(0, 0, 1, 1);
    });
  }

  private addStars(): void {
    const H = GAME_HEIGHT * TITLE_LAYOUT.horizon * 0.5;
    for (let i = 0; i < 28; i++) {
      const star = this.add
        .image(Math.random() * GAME_WIDTH, Math.random() * H, 'title-dot')
        .setTint(Math.random() < 0.3 ? 0xffe0c0 : 0xe0e8ff)
        .setAlpha(0.2);
      this.tweens.add({
        targets: star,
        alpha: 0.6 + Math.random() * 0.4,
        duration: 700 + Math.random() * 1800,
        delay: Math.random() * 2000,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  /** Long thin clouds, dark on top and lit pink from below by the sunken sun. */
  private addClouds(): void {
    this.clouds = [];
    for (let i = 0; i < 5; i++) {
      const g = this.add.graphics();
      const len = 36 + ((i * 23) % 40);
      // Rows from top to bottom: [inset left, inset right, color].
      const rows: Array<[number, number, number]> = [
        [len * 0.35, len * 0.2, 0x3e3260],
        [len * 0.15, len * 0.05, 0x524070],
        [0, 0, 0x6a4a7a],
        [len * 0.1, len * 0.25, 0xd88a96],
        [len * 0.3, len * 0.45, 0xf0b0a0],
      ];
      rows.forEach(([l, r, color], y) => {
        g.fillStyle(color).fillRect(Math.round(l), y, Math.max(2, Math.round(len - l - r)), 1);
      });
      this.clouds.push({
        obj: g,
        x: Math.random() * GAME_WIDTH,
        y: GAME_HEIGHT * (0.12 + i * 0.075),
        vx: -(2 + i * 1.2),
        vy: 0,
        phase: 0,
      });
    }
  }

  private addAnchorLight(): void {
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const x = Math.round(W * TITLE_LAYOUT.pillarX);
    const foot = Math.round(H * TITLE_LAYOUT.horizon - H * 0.06 + 4);
    this.pillar = this.add
      .image(x, foot, 'title-pillar')
      .setOrigin(0.5, 1)
      .setDisplaySize(26, foot + 8)
      .setTint(0xc8f0ff)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.add
      .image(x, foot, 'title-glow')
      .setScale(1.6, 0.9)
      .setTint(0x9ae8ff)
      .setAlpha(0.8)
      .setBlendMode(Phaser.BlendModes.ADD);
    // The crystal itself, a sliver on the hilltop.
    this.add
      .graphics()
      .fillStyle(0xe8fbff)
      .fillTriangle(x, foot - 9, x - 3, foot - 2, x + 3, foot - 2)
      .fillStyle(0x9ae8ff)
      .fillTriangle(x - 3, foot - 2, x + 3, foot - 2, x, foot + 2);
    // Its reflection, broken by the waves.
    const seaTop = H * TITLE_LAYOUT.horizon + H * 0.04;
    for (let y = seaTop + 2; y < H * 0.92; y += 3) {
      const d = (y - seaTop) / (H - seaTop);
      const dash = this.add
        .rectangle(x + (Math.random() - 0.5) * 6, y, 3 + Math.random() * 6 + d * 8, 1, 0xd8f4ff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.15);
      this.tweens.add({
        targets: dash,
        alpha: 0.65 - d * 0.4,
        duration: 300 + Math.random() * 700,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 800,
      });
    }
    this.motes = [];
    for (let i = 0; i < 18; i++) {
      const img = this.add
        .image(x, foot, 'title-dot')
        .setTint(i % 3 ? 0xc8f4ff : 0xfff0c0)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.motes.push({
        obj: img,
        x,
        y: foot - Math.random() * foot,
        vx: 0,
        vy: -(8 + Math.random() * 14),
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private addBeam(): void {
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const towerTop = Math.round(H * TITLE_LAYOUT.horizon - H * 0.3);
    this.beam = this.add
      .image(Math.round(W * TITLE_LAYOUT.towerX), towerTop - 4, 'title-beam')
      .setOrigin(0, 0.5)
      .setTint(0xfff0c0)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.add
      .image(this.beam.x, this.beam.y, 'title-glow')
      .setScale(0.5)
      .setTint(0xfff0b0)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  /** Tavi on the cliff edge, her back to us, looking at the light. */
  private addHero(): void {
    const tavi = getCharacter('tavi');
    const key = SHEET_KEYS.character('tavi');
    ensureActorSheet(this, key, tavi.look);
    const y = Math.round(GAME_HEIGHT * TITLE_LAYOUT.cliffTop) + 1;
    this.add
      .sprite(Math.round(GAME_WIDTH * TITLE_LAYOUT.heroX), y, key)
      .setOrigin(0.5, 1)
      // Dusk light: a cool shade over her colors.
      .setTint(0xa898c8)
      .play(`${key}-idle-up`);
  }

  override update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.time0 += dt;
    for (const c of this.clouds) {
      c.x += c.vx * dt;
      if (c.x < -100) c.x += GAME_WIDTH + 200;
      c.obj.setPosition(Math.round(c.x), Math.round(c.y));
    }
    const foot = this.pillar.y;
    for (const m of this.motes) {
      m.y += m.vy * dt;
      if (m.y < foot - GAME_HEIGHT * 0.5) {
        m.y = foot - 4;
        m.phase = Math.random() * Math.PI * 2;
      }
      const rise = (foot - m.y) / (GAME_HEIGHT * 0.5);
      m.obj
        .setPosition(
          Math.round(this.pillar.x + Math.sin(this.time0 * 1.7 + m.phase) * (2 + rise * 10)),
          Math.round(m.y),
        )
        .setAlpha(1 - rise);
    }
    this.pillar.setAlpha(0.72 + Math.sin(this.time0 * 1.3) * 0.18);
    // The beam turns: seen from the side, it swings out and back on either side of the lamp.
    const turn = Math.cos(this.time0 * 0.8);
    this.beam.setScale(turn * 1.1, 1).setAlpha(0.25 + Math.abs(turn) * 0.45);

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
