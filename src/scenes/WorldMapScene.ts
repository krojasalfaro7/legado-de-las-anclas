import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { getCharacter, isPlayable } from '../data/characters';
import { type Landmark, visibleLandmarks, WORLD_MAP } from '../data/worldMap';
import { ZONES } from '../data/zones';
import { characterSheetKey } from '../entities/Player';
import { t } from '../i18n';
import { audio } from '../services/audio';
import { input } from '../services/input';
import { session } from '../services/session';
import { flightCamera, type Mode7Camera, project, stepAltitude } from '../systems/mode7';
import { type Biome, biomeAt, generateTerrain, terrainHeight } from '../systems/terrain';
import type { Facing } from '../ui/humanoid';
import { FONT_SHADOW } from '../ui/pixelFont';
import { PANEL_STYLE, TextPanel } from '../ui/TextPanel';
import { ensureActorSheet, SHADOW_KEYS } from '../ui/textures';
import { facingFromVector } from '../utils/direction';
import { SCENES } from './keys';
import { Mode7Ground } from './worldmap/Mode7Ground';

export interface WorldMapData {
  /** Zone the player took off from: the flight starts above it. */
  from: string;
}

/** Ground speed at the lowest altitude; climbing covers more ground (see `speedAt`). */
const SPEED = 110;
/** Terrain cells are 2x2 map px: a "reduced map" look, also used by the minimap. */
const CELL = 2;
/**
 * Camera at altitude 0: height above the flyer, focal length, distance behind it, horizon row.
 * `flightCamera` raises and pulls it back as the flyer climbs.
 */
const CAM = { height: 36, focal: 150, behind: 62, horizon: Math.round(GAME_HEIGHT * 0.3) };
/** Hold up/down to climb/descend; touching the ground on a landing ring lands there. */
const ALTITUDE = { max: 140, hover: 8, climbPerSec: 80 };
/** Taking off climbs on its own to this height unless the player steers up/down first. */
const CRUISE = 26;
const FLYER_SCALE = 1.5;
/** Most screen px the flyer is drawn above its shadow. */
const FLYER_LIFT = 34;
const FAR = 760;
const MINIMAP = { w: 96, h: 64 };

const BIOME_COLORS: Record<Biome, readonly [number, number]> = {
  deepSea: [0x1e4a94, 0x22509c],
  sea: [0x2a62b0, 0x2e68b8],
  shore: [0xd8c690, 0xe2d29e],
  meadow: [0x5aa652, 0x529c4a],
  forest: [0x2e7a3e, 0x286e36],
  hills: [0x8a9a5a, 0x7e8e52],
  mountain: [0x8a8494, 0x7a7484],
  snow: [0xeef2f6, 0xdfe6ee],
  canyon: [0xc0743a, 0xb06a34],
  river: [0x3a7ad0, 0x4282d6],
};

const LANDMARK_TEXTURES: Record<Landmark['kind'], string> = {
  tower: 'lm-tower',
  valley: 'lm-valley',
  canyon: 'lm-canyon',
};

interface Billboard {
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
  altitude: number;
  /** Extra scale on top of the perspective one. */
  size: number;
  alpha: number;
}

function shade(c: number, f: number): number {
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((c >> s) & 0xff) * f)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * The continent in perspective: the camera flies behind the character looking north. Arrows
 * move north/south/west/east as before; land on the marked places.
 */
export class WorldMapScene extends Phaser.Scene {
  private from = 'hub';
  private landmarks: Landmark[] = [];
  private ground!: Mode7Ground;
  private cam!: Mode7Camera;
  private flyer!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private billboards: Billboard[] = [];
  private label!: TextPanel;
  private sub!: TextPanel;
  private dot!: Phaser.GameObjects.Rectangle;
  private sheetKey = '';
  private facing: Facing = 'up';
  private pos = new Phaser.Math.Vector2();
  private alt = 0;
  private takingOff = true;
  private leaving = false;
  private altMarker!: Phaser.GameObjects.Rectangle;

  constructor() {
    super(SCENES.worldMap);
  }

  create(data: WorldMapData): void {
    this.from = data.from;
    this.landmarks = visibleLandmarks(session.state.flags);
    this.leaving = false;
    this.alt = 0;
    this.takingOff = true;
    this.billboards = [];
    const start = this.landmarks.find((l) => l.zone === this.from) ?? this.landmarks[0];
    this.pos.set(start?.x ?? 250, (start?.y ?? 330) + 10);
    this.cam = { x: this.pos.x, y: 0, height: 0, focal: CAM.focal, horizon: 0, width: GAME_WIDTH };

    this.makeLandmarkTextures();
    this.ground = new Mode7Ground(this, this.groundSpec(), GAME_WIDTH, GAME_HEIGHT, CAM.horizon);
    this.cam.horizon = CAM.horizon;
    this.add.image(0, 0, this.ground.key).setOrigin(0).setDepth(-20_000);
    for (const l of this.landmarks) this.addBillboard(LANDMARK_TEXTURES[l.kind], l.x, l.y, 0, 1, 1);
    this.addClouds();

    // Someone who can't fly (Okun) is carried: the flyer on the map is the first one who can.
    const flyerId =
      [session.state.activeCharacter, ...session.state.partyOrder].find(
        (id) => getCharacter(id).canFly && isPlayable(id, session.state.flags),
      ) ?? session.state.activeCharacter;
    const character = getCharacter(flyerId);
    this.sheetKey = characterSheetKey(character.id);
    ensureActorSheet(this, this.sheetKey, character.look);
    this.shadow = this.add.image(0, 0, SHADOW_KEYS.humanoid).setAlpha(0.55).setDepth(15_000);
    this.flyer = this.add
      .sprite(0, 0, this.sheetKey)
      .setOrigin(0.5, 1)
      .setScale(FLYER_SCALE)
      .setDepth(16_000);

    this.makeHud();
    this.renderView(0);
    this.cameras.main.fadeIn(350);
    audio.play('takeoff');
    input.consumeAll();
  }

  override update(time: number, delta: number): void {
    if (this.leaving) return;
    const dt = delta / 1000;
    const move = input.move();
    const step = this.speedAt() * dt;
    this.pos.x = Phaser.Math.Clamp(this.pos.x + move.x * step, 12, WORLD_MAP.width - 12);
    this.pos.y = Phaser.Math.Clamp(this.pos.y + move.y * step, 12, WORLD_MAP.height - 8);
    this.facing = facingFromVector(move.x, move.y, this.facing);

    const spot = this.landmarkBelow();
    const landing = spot?.zone && this.unlocked(spot) ? spot.zone : null;
    const steer = (input.isDown('attack') ? 1 : 0) - (input.isDown('ki') ? 1 : 0);
    if (steer !== 0 || this.alt >= CRUISE) this.takingOff = false;
    const dir = (this.takingOff ? 1 : steer) as -1 | 0 | 1;
    const next = stepAltitude(this.alt, dir, landing !== null, dt, ALTITUDE);
    this.alt = next.alt;
    this.renderView(time);
    this.showLandmark(spot);
    if (next.landed && landing) this.land(landing);
  }

  /** Higher up the ground slides by faster, like covering more of the map. */
  private speedAt(): number {
    return SPEED * (1 + (this.alt / ALTITUDE.max) * 1.2);
  }

  /** Camera trails the flyer sideways a little, so strafing feels like banking. */
  private renderView(time: number): void {
    const view = flightCamera(this.alt, CAM);
    this.cam.x += (this.pos.x - this.cam.x) * 0.12;
    this.cam.y = this.pos.y + view.behind;
    this.cam.height = view.height;
    this.cam.horizon = view.horizon;
    this.ground.render(this.cam);
    for (const b of this.billboards) this.placeBillboard(b);

    const groundPoint = project(this.cam, this.pos.x, this.pos.y);
    if (groundPoint) {
      // The flyer stays close above its shadow on screen and the ground falls away instead,
      // so climbing reads as the land shrinking (a true projection would lift it into the sky).
      const lift = FLYER_LIFT * (1 - Math.exp(-this.alt / 18));
      const bob = Math.round(Math.sin(time / 200) * Math.min(1, this.alt / 6));
      this.shadow.setPosition(Math.round(groundPoint.sx), Math.round(groundPoint.sy));
      this.shadow.setScale(groundPoint.scale * 0.6);
      this.shadow.setAlpha(0.55 * (1 - (this.alt / ALTITUDE.max) * 0.5));
      this.flyer.setPosition(Math.round(groundPoint.sx), Math.round(groundPoint.sy - lift) + bob);
      this.flyer.setScale(FLYER_SCALE * Math.sqrt(CAM.behind / view.behind));
    }
    this.altMarker.setY(
      this.minimapY + MINIMAP.h - Math.round((this.alt / ALTITUDE.max) * (MINIMAP.h - 3)),
    );
    this.flyer.anims.play(`${this.sheetKey}-fly-${this.facing}`, true);
    this.dot.setPosition(
      this.minimapX + (this.pos.x / WORLD_MAP.width) * MINIMAP.w,
      this.minimapY + (this.pos.y / WORLD_MAP.height) * MINIMAP.h,
    );
    this.dot.setVisible(Math.floor(time / 250) % 2 === 0);
  }

  private placeBillboard(b: Billboard): void {
    const p = project(this.cam, b.x, b.y, b.altitude, 8);
    if (!p || p.depth > FAR || p.sy < 0) {
      b.image.setVisible(false);
      return;
    }
    const fog = Phaser.Math.Clamp((p.depth - 160) / (FAR - 160), 0, 1);
    b.image
      .setVisible(true)
      .setPosition(Math.round(p.sx), Math.round(p.sy))
      .setScale(p.scale * b.size)
      .setAlpha(b.alpha * (1 - fog * 0.85))
      .setDepth(10_000 - p.depth);
  }

  private landmarkBelow(): Landmark | null {
    return (
      this.landmarks.find(
        (l) => Phaser.Math.Distance.Between(this.pos.x, this.pos.y, l.x, l.y) < l.radius,
      ) ?? null
    );
  }

  private unlocked(spot: Landmark): boolean {
    const zone = spot.zone ? ZONES[spot.zone] : undefined;
    if (!zone?.flightSpawn) return false;
    return !zone.unlockFlag || session.state.flags[zone.unlockFlag] === true;
  }

  private showLandmark(spot: Landmark | null): void {
    if (!spot) {
      this.label.setText('');
      this.sub.setText('');
      return;
    }
    const known = spot.zone !== undefined || spot.revealFlag !== undefined;
    this.label.setText(known ? t(spot.nameKey) : t('map.unknown'));
    this.sub.setText(this.unlocked(spot) ? t('map.land') : known ? t('map.locked') : '');
  }

  private land(zoneId: string): void {
    const zone = ZONES[zoneId];
    if (!zone?.flightSpawn) return;
    this.leaving = true;
    audio.play('land');
    this.tweens.add({ targets: this.flyer, y: this.shadow.y, duration: 350, ease: 'Quad.easeIn' });
    this.cameras.main.fadeOut(400);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      session.state.location = { zone: zone.id, spawn: zone.flightSpawn };
      this.scene.start(SCENES.world, { zone: zone.id, spawn: zone.flightSpawn });
    });
  }

  // --- Ground --------------------------------------------------------------------------

  /** Biome colors lit from the north-west by the height slope, with landing rings stamped in. */
  private groundSpec() {
    const cols = WORLD_MAP.width / CELL;
    const rows = WORLD_MAP.height / CELL;
    const biomes = generateTerrain(cols, rows, WORLD_MAP.seed);
    const height = (x: number, y: number) => terrainHeight(x, y, cols, rows, WORLD_MAP.seed);
    const cells = new Uint32Array(cols * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const biome = biomes[y * cols + x] ?? 'deepSea';
        const base = BIOME_COLORS[biome][(x + y) % 2] ?? 0;
        const water = biome === 'deepSea' || biome === 'sea' || biome === 'river';
        const slope = water ? 0 : height(x - 1, y - 1) - height(x, y);
        cells[y * cols + x] = shade(base, Phaser.Math.Clamp(1 - slope * 9, 0.72, 1.22));
      }
    }
    for (const l of this.landmarks) this.stampRing(cells, cols, rows, l);
    return {
      cells,
      cols,
      rows,
      cell: CELL,
      outside: BIOME_COLORS.deepSea,
      haze: 0xc8d8e8,
      skyTop: 0x3a6ab8,
    };
  }

  private stampRing(cells: Uint32Array, cols: number, rows: number, l: Landmark): void {
    const color = this.unlocked(l) ? 0xf8f0c8 : l.zone ? 0xb0a070 : 0x9a8a6a;
    const r = l.radius / CELL;
    const cx = l.x / CELL;
    const cy = l.y / CELL;
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const d = Math.hypot(x - cx, y - cy);
        // Dashed ring: reads as a marked landing zone without hiding the terrain.
        const dash = Math.floor((Math.atan2(y - cy, x - cx) + Math.PI) * 6) % 2 === 0;
        if (Math.abs(d - r) < 0.75 && dash) cells[y * cols + x] = color;
      }
    }
  }

  // --- Billboards ----------------------------------------------------------------------

  private addBillboard(
    key: string,
    x: number,
    y: number,
    altitude: number,
    size: number,
    alpha: number,
  ): void {
    const image = this.add.image(0, 0, key).setOrigin(0.5, 1);
    this.billboards.push({ image, x, y, altitude, size, alpha });
  }

  /** Clouds below the camera drift past as you fly: the strongest depth cue. */
  private addClouds(): void {
    let s = WORLD_MAP.seed;
    const rand = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < 18; i++) {
      const x = rand() * WORLD_MAP.width;
      const y = rand() * WORLD_MAP.height;
      this.addBillboard('lm-cloud', x, y, 26 + rand() * 12, 0.9 + rand() * 0.6, 0.8);
    }
  }

  private makeLandmarkTextures(): void {
    if (this.textures.exists('lm-tower')) return;
    const draw = (key: string, rows: readonly string[], palette: Record<string, number>) => {
      const w = Math.max(...rows.map((r) => r.length));
      const tex = this.textures.createCanvas(key, w, rows.length);
      if (!tex) return;
      const ctx = tex.getContext();
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const c = palette[row[x] ?? '.'];
          if (c === undefined) continue;
          ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`;
          ctx.fillRect(x, y, 1, 1);
        }
      });
      tex.refresh();
    };
    draw(
      'lm-tower',
      [
        '...kkkkkk...',
        '...kyyyyk...',
        '...kywwyk...',
        '..kkkkkkkk..',
        '...kssssk...',
        '...kslssk...',
        '...kssssk...',
        '...krrrrk...',
        '...krrrrk...',
        '...kssssk...',
        '...kslssk...',
        '...kssssk...',
        '...kssssk...',
        '...krrrrk...',
        '...krrrrk...',
        '..kssssssk..',
        '..kslssssk..',
        '..kssssssk..',
        '..kssssssk..',
        '.kssssssssk.',
        '.kssssslssk.',
        '.kssssssssk.',
        'kkkkkkkkkkkk',
      ],
      { k: 0x3a3640, s: 0x9a96a0, l: 0xc8c4cc, r: 0xc04a3a, y: 0xd8b040, w: 0xfff6c0 },
    );
    draw(
      'lm-valley',
      [
        '....k....',
        '...kck...',
        '...kcwk..',
        '..kccwk..',
        '..kcccwk.',
        '.kcccc.k.',
        '.kccccck.',
        '.kcccdck.',
        '..kccdk..',
        '..kcddk..',
        '...kdk...',
        '..kkkkk..',
      ],
      { k: 0x1a4a5a, c: 0x7ae4f4, w: 0xe8ffff, d: 0x3aa0b8 },
    );
    draw(
      'lm-canyon',
      [
        '......kkkkkkkk........',
        '....kkooooooook.......',
        '...kooollloooook......',
        '..koooooooooodook.....',
        '..kooodoooooooooookk..',
        '.koooooooooodooooooook',
        '.kooooddooooooooodook.',
        'kooooooooooodoooooooook',
        'kkkkkkkkkkkkkkkkkkkkkkk',
      ],
      { k: 0x5a2a14, o: 0xc0743a, l: 0xe0a060, d: 0x8a4a24 },
    );
    draw(
      'lm-cloud',
      [
        '.......wwwww.........',
        '....wwwwwwwwww.ww....',
        '..wwwwwwwwwwwwwwwww..',
        '.wwwwwwwwwwwwwwwwwww.',
        'wwwwwwwwwwwwwwwwwwwww',
        '.gggwwwwwwwwwwwwggg..',
        '...ggggggggggggg.....',
      ],
      { w: 0xf4f8fc, g: 0xc8d4e4 },
    );
  }

  // --- HUD -----------------------------------------------------------------------------

  private minimapX = 0;
  private minimapY = 0;

  private makeHud(): void {
    // Place name and what you can do there, on plates above the controls strip.
    this.sub = new TextPanel(this, GAME_WIDTH / 2, GAME_HEIGHT - 18, '', {
      originY: 1,
      textTint: 0xffe080,
      border: 0x50607a,
    }).setDepth(30_000);
    this.label = new TextPanel(this, GAME_WIDTH / 2, GAME_HEIGHT - 35, '', {
      originY: 1,
      padX: 8,
    }).setDepth(30_000);
    new TextPanel(this, 2, 2, t('map.title'), { originX: 0, originY: 0, center: false }).setDepth(
      30_000,
    );
    this.add
      .rectangle(0, GAME_HEIGHT - 14, GAME_WIDTH, 14, PANEL_STYLE.fill, 0.82)
      .setOrigin(0)
      .setDepth(30_000);
    this.add
      .bitmapText(GAME_WIDTH - 4, GAME_HEIGHT - 13, FONT_SHADOW, t('map.hint'))
      .setOrigin(1, 0)
      .setTint(0xe0e8ff)
      .setDepth(30_001);

    // Top-down minimap: the same terrain seen from above, with landing spots and a blinking dot.
    this.makeMinimapTexture();
    this.minimapX = GAME_WIDTH - MINIMAP.w - 4;
    this.minimapY = 4;
    this.add
      .rectangle(this.minimapX - 1, this.minimapY - 1, MINIMAP.w + 2, MINIMAP.h + 2, 0x000000)
      .setOrigin(0)
      .setStrokeStyle(1, 0xe0e8ff)
      .setDepth(29_000);
    this.add.image(this.minimapX, this.minimapY, 'world-minimap').setOrigin(0).setDepth(29_001);
    for (const l of this.landmarks) {
      this.add
        .rectangle(
          this.minimapX + (l.x / WORLD_MAP.width) * MINIMAP.w,
          this.minimapY + (l.y / WORLD_MAP.height) * MINIMAP.h,
          3,
          3,
          this.unlocked(l) ? 0xffe080 : 0x907a50,
        )
        .setDepth(29_002);
    }
    this.dot = this.add.rectangle(0, 0, 3, 3, 0xffffff).setDepth(29_003);

    // Altimeter: a thin gauge left of the minimap; the marker rises as the flyer climbs.
    const gx = this.minimapX - 7;
    this.add
      .rectangle(gx, this.minimapY - 1, 4, MINIMAP.h + 2, 0x000000, 0.7)
      .setOrigin(0)
      .setStrokeStyle(1, 0xe0e8ff)
      .setDepth(29_000);
    this.altMarker = this.add.rectangle(gx, 0, 4, 3, 0xffe080).setOrigin(0, 1).setDepth(29_001);
  }

  private makeMinimapTexture(): void {
    if (this.textures.exists('world-minimap')) return;
    const cols = WORLD_MAP.width / CELL;
    const rows = WORLD_MAP.height / CELL;
    const tex = this.textures.createCanvas('world-minimap', MINIMAP.w, MINIMAP.h);
    if (!tex) return;
    const ctx = tex.getContext();
    for (let y = 0; y < MINIMAP.h; y++) {
      for (let x = 0; x < MINIMAP.w; x++) {
        const biome = biomeAt(
          (x * cols) / MINIMAP.w,
          (y * rows) / MINIMAP.h,
          cols,
          rows,
          WORLD_MAP.seed,
        );
        ctx.fillStyle = `#${BIOME_COLORS[biome][0].toString(16).padStart(6, '0')}`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    tex.refresh();
  }
}
