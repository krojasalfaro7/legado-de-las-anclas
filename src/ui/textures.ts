import type Phaser from 'phaser';
import { type ActorLook, actorFrame, frameSizeOf } from './actorFrames';
import type { Grid } from './humanoid';
import {
  FACINGS,
  type FrameSize,
  frameIndex,
  POSES,
  type Pose,
  type SpriteClass,
} from './spriteSpec';

type Ctx = CanvasRenderingContext2D;

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number): Ctx {
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`Could not create texture ${key}`);
  return tex.getContext();
}

function refresh(scene: Phaser.Scene, key: string): void {
  (scene.textures.get(key) as Phaser.Textures.CanvasTexture).refresh();
}

function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

function addGridFrames(
  scene: Phaser.Scene,
  key: string,
  fw: number,
  fh: number,
  count: number,
  cols: number,
): void {
  const tex = scene.textures.get(key);
  for (let i = 0; i < count; i++) {
    tex.add(i, 0, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh);
  }
}

function paintGrid(ctx: Ctx, grid: Grid, ox: number, oy: number): void {
  grid.forEach((row, y) => {
    row.forEach((c, x) => {
      if (c === null) return;
      ctx.fillStyle = hex(c);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    });
  });
}

function drawSheet(scene: Phaser.Scene, key: string, look: ActorLook): void {
  const { w, h } = frameSizeOf(look);
  const cols = POSES.length;
  const ctx = canvasTexture(scene, key, cols * w, FACINGS.length * h);
  for (const facing of FACINGS) {
    for (const pose of POSES) {
      const i = frameIndex(facing, pose);
      paintGrid(ctx, actorFrame(look, facing, pose), (i % cols) * w, Math.floor(i / cols) * h);
    }
  }
  refresh(scene, key);
  addGridFrames(scene, key, w, h, cols * FACINGS.length, cols);
}

/** A loaded sheet whose frames don't match its look's size class (stale manifest) is dropped. */
function loadedSheetFits(scene: Phaser.Scene, key: string, expected: FrameSize): boolean {
  if (!scene.textures.exists(key)) return false;
  const frame = scene.textures.getFrame(key, 0);
  if (frame && frame.width === expected.w && frame.height === expected.h) return true;
  console.warn(`Sprite sheet ${key}: frames are not ${expected.w}x${expected.h}, using generated`);
  scene.textures.remove(key);
  return false;
}

/** Creates the sprite sheet + idle/walk/fly animations for an actor look (idempotent). */
export function ensureActorSheet(scene: Phaser.Scene, key: string, look: ActorLook): void {
  if (scene.anims.exists(`${key}-idle-down`)) return;
  // Hand-drawn sheets from the sprite manifest are already loaded; only animations are missing.
  if (!loadedSheetFits(scene, key, frameSizeOf(look))) drawSheet(scene, key, look);
  const anim = (name: string, poses: Pose[], frameRate: number) => {
    for (const facing of FACINGS) {
      scene.anims.create({
        key: `${key}-${name}-${facing}`,
        frames: poses.map((p) => ({ key, frame: frameIndex(facing, p) })),
        frameRate,
        repeat: -1,
      });
    }
  };
  anim('idle', ['idle', 'idle2'], 2.5);
  anim('walk', ['walk1', 'walk2', 'walk3', 'walk4'], 9);
  anim('fly', ['fly', 'fly2'], 7);
}

function circleTexture(
  scene: Phaser.Scene,
  key: string,
  size: number,
  rings: Array<[number, number, number]>,
): void {
  const ctx = canvasTexture(scene, key, size, size);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      for (const [r, color, alpha] of rings) {
        if (d <= r) {
          ctx.fillStyle = hex(color);
          ctx.globalAlpha = alpha;
          ctx.fillRect(x, y, 1, 1);
          break;
        }
      }
    }
  }
  ctx.globalAlpha = 1;
  refresh(scene, key);
}

function ringTexture(
  scene: Phaser.Scene,
  key: string,
  size: number,
  color: number,
  inner: number,
  glyph: 'save' | 'flight',
): void {
  const ctx = canvasTexture(scene, key, size, size / 2);
  const cx = (size - 1) / 2;
  const cy = (size / 2 - 1) / 2;
  for (let y = 0; y < size / 2; y++) {
    for (let x = 0; x < size; x++) {
      // Squashed ellipse so the circle reads as lying on the floor.
      const d = Math.hypot((x - cx) / (size / 2), (y - cy) / (size / 4));
      if (d <= 1 && d >= 0.78) {
        ctx.fillStyle = hex(color);
        ctx.fillRect(x, y, 1, 1);
      } else if (d < 0.78) {
        ctx.fillStyle = hex(inner);
        ctx.globalAlpha = 0.45;
        ctx.fillRect(x, y, 1, 1);
        ctx.globalAlpha = 1;
      }
    }
  }
  ctx.fillStyle = hex(color);
  if (glyph === 'save') {
    ctx.fillRect(cx - 3, cy - 0.5, 7, 1);
    ctx.fillRect(cx - 0.5, cy - 3, 1, 7);
  } else {
    ctx.fillRect(cx - 4, cy, 9, 1);
    ctx.fillRect(cx - 2, cy - 1, 5, 1);
    ctx.fillRect(cx, cy - 2, 1, 1);
  }
  refresh(scene, key);
}

function pixelArt(
  scene: Phaser.Scene,
  key: string,
  rows: readonly string[],
  palette: Record<string, number>,
): void {
  const w = Math.max(...rows.map((r) => r.length));
  const ctx = canvasTexture(scene, key, w, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x] ?? '.'];
      if (color === undefined) continue;
      ctx.fillStyle = hex(color);
      ctx.fillRect(x, y, 1, 1);
    }
  });
  refresh(scene, key);
}

/** Ground shadow under each sprite class; sprite sheets never include their own. */
export const SHADOW_KEYS: Record<SpriteClass, string> = {
  humanoid: 'shadow',
  large: 'shadow-large',
  heavy: 'shadow-heavy',
  giant: 'shadow-giant',
};

function shadowTexture(scene: Phaser.Scene, key: string, w: number, h: number): void {
  const ctx = canvasTexture(scene, key, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(2, 0, w - 4, h);
  ctx.fillRect(0, 1, w, h - 2);
  refresh(scene, key);
}

/** Generates every non-actor placeholder texture used by the game. */
export function generateCommonTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('pixel')) return;
  const pixel = canvasTexture(scene, 'pixel', 1, 1);
  pixel.fillStyle = '#ffffff';
  pixel.fillRect(0, 0, 1, 1);
  refresh(scene, 'pixel');

  circleTexture(scene, 'ki-small', 8, [
    [1.6, 0xffffff, 1],
    [2.8, 0xffffff, 0.85],
    [3.6, 0xffffff, 0.4],
  ]);
  circleTexture(scene, 'ki-big', 14, [
    [3, 0xffffff, 1],
    [5, 0xffffff, 0.8],
    [6.6, 0xffffff, 0.35],
  ]);
  circleTexture(scene, 'spark', 4, [[1.6, 0xffffff, 1]]);
  shotTextures(scene);
  circleTexture(scene, 'glow', 32, [
    [6, 0xffffff, 0.5],
    [11, 0xffffff, 0.3],
    [15.5, 0xffffff, 0.12],
  ]);

  shadowTexture(scene, SHADOW_KEYS.humanoid, 16, 5);
  shadowTexture(scene, SHADOW_KEYS.large, 32, 8);
  shadowTexture(scene, SHADOW_KEYS.heavy, 22, 6);
  shadowTexture(scene, SHADOW_KEYS.giant, 50, 12);

  ringTexture(scene, 'save-circle', 32, 0x6bf0ff, 0x2a7ac0, 'save');
  ringTexture(scene, 'flight-circle', 32, 0xffd34a, 0xc0702a, 'flight');

  const chestPal = { k: 0x2a1a10, w: 0x9a6b3a, l: 0xc08a4e, g: 0xf2c84a, d: 0x1a1010 };
  pixelArt(
    scene,
    'chest-closed',
    [
      '................',
      '................',
      '..kkkkkkkkkkkk..',
      '.kllllllllllllk.',
      '.klwwwwwwwwwwlk.',
      '.kwwwwwwwwwwwwk.',
      '.kkkkkkggkkkkkk.',
      '.kwwwwwggwwwwwk.',
      '.kwwwwwkkwwwwwk.',
      '.kwwwwwwwwwwwwk.',
      '.kwwwwwwwwwwwwk.',
      '.kwwwwwwwwwwwwk.',
      '.kkkkkkkkkkkkkk.',
    ],
    chestPal,
  );
  pixelArt(
    scene,
    'chest-open',
    [
      '..kkkkkkkkkkkk..',
      '.kllllllllllllk.',
      '.kwwwwwwwwwwwwk.',
      '.kkkkkkkkkkkkkk.',
      '.kddddddddddddk.',
      '.kddddddddddddk.',
      '.kkkkkkkkkkkkkk.',
      '.kwwwwwwwwwwwwk.',
      '.kwwwwwwwwwwwwk.',
      '.kwwwwwwwwwwwwk.',
      '.kwwwwwwwwwwwwk.',
      '.kwwwwwwwwwwwwk.',
      '.kkkkkkkkkkkkkk.',
    ],
    chestPal,
  );
  pixelArt(
    scene,
    'gate',
    [
      '#..##..##..##..#',
      ...Array.from({ length: 14 }, (_, i) =>
        i % 4 < 2 ? '.##..##..##..##.' : '##..##..##..##..',
      ),
      '#..##..##..##..#',
    ],
    { '#': 0xffffff, '.': 0xb0b0b0 },
  );
  // Boulder only Okun's punches crack: a rounded rock with ore flecks, darker at the base.
  pixelArt(
    scene,
    'barrier-boulder',
    [
      '....kkkkkkk.....',
      '..kkllllllkkk...',
      '.kllllhhlllllk..',
      '.kllhhhllllllkk.',
      'kllllllllollllk.',
      'klllllllllllmlkk',
      'kllolllllllllmlk',
      'klllllmmlllllllk',
      'kllllmmmmllllolk',
      'klllllmmllllmmlk',
      'kmlllllllllmmmlk',
      'kmmllollllmmmmmk',
      '.kmmmllllmmmmmk.',
      '.kkmmmmmmmmmmkk.',
      '...kkkkkkkkkk...',
      '................',
    ],
    { k: 0x3a3028, l: 0x9a8a78, h: 0xc8b8a4, m: 0x6a5a4a, o: 0xd88a3a },
  );
  // Wind vent (Iolé): an iron grate over a shaft, choked with grit and old feathers.
  pixelArt(
    scene,
    'barrier-vent',
    [
      'kkkkkkkkkkkkkkkk',
      'kiiiiiiiiiiiiiik',
      'kidkdkdkdkdkdkik',
      'kidkdkdkdkdkdkik',
      'kiddkdfdkdkddkik',
      'kidkdkdkdffkdkik',
      'kiiiiiiiiiiiiiik',
      'kidkdkdkdkdkdkik',
      'kidkdgdkdkdkdkik',
      'kidkdkdkdkgkdkik',
      'kidkdkdkdkdkdkik',
      'kiiiiiiiiiiiiiik',
      'kidkdkdffkdkdkik',
      'kidkdkdkdkdkdkik',
      'kiiiiiiiiiiiiiik',
      'kkkkkkkkkkkkkkkk',
    ],
    { k: 0x1c2028, i: 0x7a8494, d: 0x2a303c, f: 0xd8d0b8, g: 0x9ab8ff },
  );
  // Low crack (Nilo): a rock face with a narrow dark slit at the bottom.
  pixelArt(
    scene,
    'barrier-crawl',
    [
      '..kkkkkkkkkkkk..',
      '.kllllhllllllmk.',
      'kllhhllllllllmmk',
      'kllllllmlllllmmk',
      'klllllllmllllllk',
      'kmlllllllmlllllk',
      'kmllllllllmllmmk',
      'kmmlllllllmlmmmk',
      'kmmmllllllmmmmmk',
      'kmmmlllllmmmmmmk',
      'kmmmmkkkkkkmmmmk',
      'kmmmkooooookmmmk',
      'kmmkoooooooookmk',
      'kmkooooooooooomk',
      'kkoooooooooooook',
      'kkkkkkkkkkkkkkkk',
    ],
    { k: 0x2a2420, l: 0x9a8a78, h: 0xc8b8a4, m: 0x6a5a4a, o: 0x0c0a0a },
  );
  // Story seal: a carved stone slab with a glowing anchor rune.
  pixelArt(
    scene,
    'barrier-seal',
    [
      'kkkkkkkkkkkkkkkk',
      'kssssssssssssssk',
      'ksddddddddddddsk',
      'ksd....gg....dsk',
      'ksd...gccg...dsk',
      'ksd....gg....dsk',
      'ksd....gg....dsk',
      'ksd..gggggg..dsk',
      'ksd....gg....dsk',
      'ksd.g..gg..g.dsk',
      'ksd.gg.gg.gg.dsk',
      'ksd..gggggg..dsk',
      'ksd....gg....dsk',
      'ksddddddddddddsk',
      'kssssssssssssssk',
      'kkkkkkkkkkkkkkkk',
    ],
    { k: 0x24222c, s: 0x6a6878, d: 0x4a4858, '.': 0x5a5868, g: 0x7ae4f4, c: 0xe8ffff },
  );
  pixelArt(
    scene,
    'collectible',
    [
      '.....#.....',
      '....###....',
      '....#w#....',
      '.#########.',
      '..##www##..',
      '...#####...',
      '..##...##..',
      '.##.....##.',
    ],
    { '#': 0xffd34a, w: 0xffffff },
  );
  // Anchor shard (the currency): a small cyan crystal.
  pixelArt(scene, 'shard-coin', ['..k..', '.klk.', 'klcck', 'kccdk', 'kcddk', '.kdk.', '..k..'], {
    k: 0x1e4a5a,
    l: 0xe8ffff,
    c: 0x7ae4f4,
    d: 0x3aa8c0,
  });
  pixelArt(scene, 'item-drop', ['..##..', '.#ww#.', '#wwww#', '#wwww#', '.#ww#.', '..##..'], {
    '#': 0x3a8a3a,
    w: 0x8cf08c,
  });
}

/**
 * Thrown and crystal shots, drawn pointing right (they rotate to their flight). Rocks and shards
 * are greyscale so the shot's color tints them; harpoons and darts keep their own colors.
 */
function shotTextures(scene: Phaser.Scene): void {
  const stone = { k: 0x2a2a2a, d: 0x7a7a7a, m: 0xb4b4b4, l: 0xececec };
  pixelArt(
    scene,
    'shot-rock-s',
    ['.kkk..', 'kmlmk.', 'kmmmdk', 'kdmmdk', '.kddk.', '..kk..'],
    stone,
  );
  pixelArt(
    scene,
    'shot-rock-b',
    [
      '...kkkk.....',
      '..kmllmkk...',
      '.kmllmmmmk..',
      'kmlmmmmmmdk.',
      'kmmmmmdmmmdk',
      'kmmmmddmmmdk',
      'kdmmmmmmmddk',
      '.kdmmmmmmdk.',
      '.kddmmmddk..',
      '..kkddddk...',
      '....kkkk....',
    ],
    stone,
  );
  const crystal = { k: 0x3a3a50, m: 0xc8c8d8, l: 0xffffff };
  pixelArt(scene, 'shot-shard-s', ['..kk...', 'kmmllk.', 'kmllllk', 'kmmllk.', '..kk...'], crystal);
  pixelArt(
    scene,
    'shot-shard-b',
    ['...kkk.....', '.kkmmllkk..', 'kmmmllllllk', 'kmmlllllllk', '.kkmmllkk..', '...kkk.....'],
    crystal,
  );
  pixelArt(
    scene,
    'shot-harpoon',
    [
      '............k...',
      '..........kkmk..',
      'wwwwwwwwwwmmllk.',
      '..........kkmk..',
      '............k...',
    ],
    { w: 0x8a5a30, k: 0x3a3a44, m: 0xa8b0bc, l: 0xf0f4f8 },
  );
  pixelArt(scene, 'shot-dart', ['ff....k.', 'fffwwmlk', 'ff....k.'], {
    f: 0xb8d8f0,
    w: 0x6a5a48,
    k: 0x3a3a44,
    m: 0xa8b0bc,
    l: 0xf0f4f8,
  });
}
