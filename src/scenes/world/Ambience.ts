import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/constants';
import type { AmbienceDef, MoteDef } from '../../data/ambience';

const nameOf = (tile: Phaser.Tilemaps.Tile | null): string | undefined =>
  (tile?.properties as { name?: string } | undefined)?.name;

const hash = (x: number, y: number): number => ((x * 73856093) ^ (y * 19349663)) >>> 0;

/** Over everything in the world, under the cutscene letterbox (400k). */
const DEPTH_VIGNETTE = 350_000;
const DEPTH_TINT = 349_000;
const DEPTH_FOG = 348_000;
const DEPTH_MOTES = 347_000;
/** Over the ground and its tiles, under every actor. */
const DEPTH_GLOW = -8.5;
const MAX_HALOS = 220;
const WATER = new Set(['water', 'sea', 'brine']);

interface Mote {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  phase: number;
  speed: number;
}

/**
 * A zone's air (data/ambience.ts): a vignette (held around the player like a lamp in dark zones),
 * a color grade, drifting motes, fog banks, glints on water and halos over glowing tiles.
 */
export class Ambience {
  private readonly motes: Mote[] = [];
  private readonly halos: Array<{ img: Phaser.GameObjects.Image; phase: number; base: number }> =
    [];
  private readonly fog: Array<{ img: Phaser.GameObjects.Image; x: number; y: number }> = [];
  private readonly water: Array<[number, number]> = [];
  private lamp: Phaser.GameObjects.Image | null = null;
  private glintIn = 0;
  private t = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly def: AmbienceDef,
    collision: Phaser.Tilemaps.TilemapLayer,
    private readonly follow: { x: number; y: number },
  ) {
    makeTextures(scene);
    const dark = def.vignette >= 0.45;
    if (def.tint) {
      scene.add
        .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, def.tint.color, def.tint.alpha)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(DEPTH_TINT);
    }
    if (dark) {
      this.lamp = scene.add
        .image(follow.x, follow.y, 'amb-lamp')
        .setDisplaySize(GAME_WIDTH * 2.4, GAME_HEIGHT * 2.4)
        .setAlpha(def.vignette)
        .setDepth(DEPTH_VIGNETTE);
    } else if (def.vignette > 0) {
      scene.add
        .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'amb-vignette')
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setScrollFactor(0)
        .setAlpha(def.vignette)
        .setDepth(DEPTH_VIGNETTE);
    }
    collision.forEachTile((tile) => {
      const name = nameOf(tile);
      if (!name) return;
      if (def.glints && WATER.has(name)) this.water.push([tile.pixelX, tile.pixelY]);
      const color = def.glow?.[name];
      if (color !== undefined && this.halos.length < MAX_HALOS) this.addHalo(tile, color);
    });
    if (def.motes) this.addMotes(def.motes);
    if (def.fog) {
      const view = scene.cameras.main.worldView;
      for (let i = 0; i < 4; i++) {
        const img = scene.add
          .image(0, 0, 'amb-fog')
          .setTint(def.fog.color)
          .setAlpha(def.fog.alpha)
          .setScale(2.2 + (i % 2) * 0.8, 1.6)
          .setDepth(DEPTH_FOG);
        this.fog.push({
          img,
          x: view.x + (i / 4) * (GAME_WIDTH + 200),
          y: view.y + (((i * 37) % 100) / 100) * GAME_HEIGHT,
        });
      }
    }
  }

  private addHalo(tile: Phaser.Tilemaps.Tile, color: number): void {
    const h = hash(tile.x, tile.y);
    const img = this.scene.add
      .image(tile.pixelX + 8, tile.pixelY + 8, 'amb-halo')
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(1.1 + (h % 5) * 0.08)
      .setDepth(DEPTH_GLOW);
    this.halos.push({ img, phase: (h % 628) / 100, base: 0.32 + ((h >> 4) % 10) * 0.012 });
  }

  private addMotes(m: MoteDef): void {
    const view = this.scene.cameras.main.worldView;
    for (let i = 0; i < m.count; i++) {
      const color = m.colors[i % m.colors.length] ?? 0xffffff;
      const img = this.scene.add
        .image(0, 0, m.size === 2 ? 'amb-mote2' : 'amb-mote1')
        .setTint(color)
        .setDepth(DEPTH_MOTES);
      if (m.glow) img.setBlendMode(Phaser.BlendModes.ADD);
      this.motes.push({
        img,
        x: view.x + Math.random() * view.width,
        y: view.y + Math.random() * view.height,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.8,
      });
    }
  }

  update(delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    this.t += dt;
    const view = this.scene.cameras.main.worldView;
    if (this.lamp) this.lamp.setPosition(this.follow.x, this.follow.y - 8);
    for (const h of this.halos) h.img.setAlpha(h.base + Math.sin(this.t * 1.6 + h.phase) * 0.12);

    const m = this.def.motes;
    if (m) {
      for (const p of this.motes) {
        p.x += m.vx * p.speed * dt;
        p.y += m.vy * p.speed * dt;
        // Keep every mote inside the view (plus a margin) so they never thin out as you walk.
        p.x = wrap(p.x, view.x - 8, view.width + 16);
        p.y = wrap(p.y, view.y - 8, view.height + 16);
        const sway = Math.sin(this.t * 1.3 * p.speed + p.phase) * m.sway;
        const twinkle = 0.55 + 0.45 * Math.sin(this.t * 2.2 * p.speed + p.phase * 2);
        p.img.setPosition(Math.round(p.x + sway), Math.round(p.y)).setAlpha(m.alpha * twinkle);
      }
    }

    for (const f of this.fog) {
      f.x += 6 * dt;
      f.x = wrap(f.x, view.x - 160, view.width + 320);
      f.y = wrap(f.y, view.y - 60, view.height + 120);
      f.img.setPosition(f.x, f.y + Math.sin(this.t * 0.3 + f.x * 0.01) * 6);
    }

    if (this.water.length) {
      this.glintIn -= delta;
      if (this.glintIn <= 0) {
        this.glintIn = 70 + Math.random() * 90;
        this.glint(view);
      }
    }
  }

  /** A short sparkle on a random water tile in view. */
  private glint(view: Phaser.Geom.Rectangle): void {
    for (let tries = 0; tries < 6; tries++) {
      const cell = this.water[Math.floor(Math.random() * this.water.length)];
      if (!cell) return;
      const [x, y] = cell;
      if (x < view.x - 16 || x > view.right || y < view.y - 16 || y > view.bottom) continue;
      const img = this.scene.add
        .image(x + 2 + Math.random() * 12, y + 2 + Math.random() * 12, 'amb-glint')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0)
        .setDepth(DEPTH_GLOW);
      this.scene.tweens.add({
        targets: img,
        alpha: 0.9,
        duration: 260,
        yoyo: true,
        onComplete: () => img.destroy(),
      });
      return;
    }
  }
}

function wrap(v: number, min: number, size: number): number {
  return ((((v - min) % size) + size) % size) + min;
}

/** Soft shapes drawn once per game on canvases. */
function makeTextures(scene: Phaser.Scene): void {
  const tx = scene.textures;
  const canvas = (
    key: string,
    w: number,
    h: number,
    draw: (c: CanvasRenderingContext2D) => void,
  ) => {
    if (tx.exists(key)) return;
    const el = document.createElement('canvas');
    el.width = w;
    el.height = h;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    draw(ctx);
    tx.addCanvas(key, el);
  };
  const radial = (
    c: CanvasRenderingContext2D,
    w: number,
    h: number,
    stops: Array<[number, string]>,
  ) => {
    // Drawn round, then the image is stretched to the view's aspect.
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    for (const [at, color] of stops) g.addColorStop(at, color);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  };
  canvas('amb-vignette', 128, 128, (c) =>
    radial(c, 128, 128, [
      [0, 'rgba(0,0,0,0)'],
      [0.55, 'rgba(0,0,0,0)'],
      [0.85, 'rgba(0,0,0,0.55)'],
      [1, 'rgba(0,0,0,1)'],
    ]),
  );
  canvas('amb-lamp', 256, 256, (c) => {
    radial(c, 256, 256, [
      [0, 'rgba(0,0,0,0)'],
      [0.1, 'rgba(0,0,0,0)'],
      [0.32, 'rgba(0,0,0,0.75)'],
      [0.5, 'rgba(0,0,0,1)'],
      [1, 'rgba(0,0,0,1)'],
    ]);
  });
  canvas('amb-halo', 32, 32, (c) =>
    radial(c, 32, 32, [
      [0, 'rgba(255,255,255,0.9)'],
      [0.35, 'rgba(255,255,255,0.35)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  canvas('amb-fog', 128, 64, (c) => {
    c.save();
    c.scale(1, 0.5);
    radial(c, 128, 128, [
      [0, 'rgba(255,255,255,0.8)'],
      [0.6, 'rgba(255,255,255,0.3)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    c.restore();
  });
  canvas('amb-mote1', 1, 1, (c) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 1, 1);
  });
  canvas('amb-mote2', 3, 3, (c) => {
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.fillRect(0, 1, 3, 1);
    c.fillRect(1, 0, 1, 3);
    c.fillStyle = '#fff';
    c.fillRect(1, 1, 1, 1);
  });
  canvas('amb-glint', 5, 5, (c) => {
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.fillRect(0, 2, 5, 1);
    c.fillRect(2, 0, 1, 5);
    c.fillStyle = '#fff';
    c.fillRect(1, 2, 3, 1);
    c.fillRect(2, 1, 1, 3);
  });
}
