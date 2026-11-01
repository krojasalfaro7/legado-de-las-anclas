/**
 * Generates the tileset (PNG + Tiled .tsj). Run with `npm run assets`.
 * Every tile is procedurally drawn: outlined shapes, top-left lighting and 15-bit color.
 * Object tiles (trees, rocks, crates...) are transparent around the shape; the map compiler
 * puts the surrounding ground under them.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RgbaImage } from './png.ts';
import { TILE_SIZE, TILES, TILESET_COLUMNS, TILESET_NAME, type TileName } from './tiles.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/assets/tilesets');

const S = TILE_SIZE;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

type Painter = (img: RgbaImage, ox: number, oy: number, rand: () => number) => void;

/** Multiplies each channel; f < 1 darkens, f > 1 lightens. */
function tone(c: number, f: number): number {
  const ch = (shift: number) => Math.max(0, Math.min(255, Math.round(((c >> shift) & 0xff) * f)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Snaps to 15-bit color (5 bits per channel) for a GBA-like palette. */
function to15(c: number): number {
  const ch = (shift: number) => {
    const v = (c >> shift) & 0xf8;
    return v | (v >> 5);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

interface Tones {
  base: number;
  dark: number;
  light: number;
  outline: number;
}

const tones = (base: number): Tones => ({
  base,
  dark: tone(base, 0.72),
  light: tone(base, 1.25),
  outline: tone(base, 0.38),
});

function speckle(colors: number[], base: number, density: number): Painter {
  return (img, ox, oy, rand) => {
    img.rect(ox, oy, S, S, base);
    for (let i = 0; i < S * S * density; i++) {
      const c = colors[Math.floor(rand() * colors.length)] ?? base;
      img.set(ox + Math.floor(rand() * S), oy + Math.floor(rand() * S), c);
    }
  };
}

/** Grass with small "v" tufts instead of noise, so it reads as blades at 1x. */
function turf(t: Tones, tufts: number): Painter {
  return (img, ox, oy, rand) => {
    img.rect(ox, oy, S, S, t.base);
    for (let i = 0; i < 14; i++)
      img.set(
        ox + Math.floor(rand() * S),
        oy + Math.floor(rand() * S),
        rand() > 0.5 ? t.dark : t.light,
      );
    for (let i = 0; i < tufts; i++) {
      const x = ox + 1 + Math.floor(rand() * 13);
      const y = oy + 2 + Math.floor(rand() * 12);
      img.set(x, y, t.dark);
      img.set(x + 2, y, t.dark);
      img.set(x + 1, y + 1, t.dark);
      img.set(x, y - 1, t.light);
    }
  };
}

/**
 * Filled ellipse with a dark outline and top-left lighting: the shape used for
 * canopies, bushes and rocks. Pixels outside stay transparent so the ground shows.
 */
function blob(
  img: RgbaImage,
  ox: number,
  oy: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  t: Tones,
  rand: () => number,
  grain = 0.12,
): void {
  const inside = (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const light = (-(x - cx) / rx) * 0.55 + (-(y - cy) / ry) * 0.85;
      let c = light > 0.45 ? t.light : light < -0.35 ? t.dark : t.base;
      if (!edge && rand() < grain) c = c === t.base ? t.dark : t.base;
      img.set(ox + x, oy + y, edge ? t.outline : c);
    }
  }
}

function planks(t: Tones, vertical: boolean): Painter {
  return (img, ox, oy, rand) => {
    img.rect(ox, oy, S, S, t.base);
    for (let i = 0; i < 4; i++) {
      const a = i * 4;
      if (vertical) {
        img.rect(ox + a, oy, 1, S, t.light);
        img.rect(ox + a + 3, oy, 1, S, t.dark);
      } else {
        img.rect(ox, oy + a, S, 1, t.light);
        img.rect(ox, oy + a + 3, S, 1, t.dark);
      }
      // Board ends at staggered positions.
      const cut = (i * 7 + Math.floor(rand() * 3)) % S;
      if (vertical) img.rect(ox + a, oy + cut, 3, 1, t.outline);
      else img.rect(ox + cut, oy + a, 1, 3, t.outline);
    }
    for (let i = 0; i < 6; i++)
      img.set(ox + Math.floor(rand() * S), oy + Math.floor(rand() * S), t.dark);
  };
}

const MEADOW = tones(0x4c9a58);
const GRASS = tones(0x5aa64e);
const ROCK = tones(0x8a8494);
const WOOD = tones(0xa0703e);
const DARK_WOOD = tones(0x6e4a2c);
const STONE = tones(0x9a96a0);
const WATER = tones(0x3a7ad0);
const SEA = tones(0x2a5aa8);
const ASH = tones(0x5a4e48);
const CANYON = tones(0xa8603a);
const MUD = tones(0x5e4a36);
const SALT = tones(0xe2ddcc);
const BRINE = tones(0x3e8a86);
const THATCH = tones(0xb88c4a);
const BASALT = tones(0x4a4650);
const DEEP = tones(0x2e2a3a);
const ABYSS = tones(0x3a1e3a);
const COPPER = tones(0xc87a3a);

const meadow = turf(MEADOW, 4);
const grass = turf(GRASS, 4);

/** Water with a horizontal wave pattern; shared by the bridge so they line up. */
function waterBase(img: RgbaImage, ox: number, oy: number, rand: () => number): void {
  img.rect(ox, oy, S, S, WATER.base);
  for (let y = 0; y < S; y += 4) {
    const shift = Math.floor(rand() * 8);
    for (let x = 0; x < S; x++) {
      const w = (x + shift) % 8;
      if (w < 3)
        img.set(ox + x, oy + y + (w === 1 ? 0 : 1), w === 1 ? WATER.light : tone(WATER.base, 1.1));
    }
  }
  img.set(ox + Math.floor(rand() * S), oy + Math.floor(rand() * S), 0xe8f4ff);
}

/**
 * The rough top of a rock mass seen from above: mottled stone with chips and cracks, no grid (the
 * game draws a cliff face along its south edge, see Scenery).
 */
function rockTop(t: Tones): Painter {
  // A little lighter than the ground around it: the top catches the light. Low contrast, since
  // the one tile repeats over the whole mass.
  const top = tone(t.base, 1.12);
  return (img, ox, oy, rand) => {
    img.rect(ox, oy, S, S, top);
    for (let i = 0; i < 6; i++) {
      const x = ox + Math.floor(rand() * 13);
      const y = oy + Math.floor(rand() * 13);
      img.rect(x, y, 2 + Math.floor(rand() * 3), 2, tone(top, rand() > 0.5 ? 0.95 : 1.05));
    }
    for (let i = 0; i < 3; i++) {
      const x = ox + Math.floor(rand() * 15);
      const y = oy + Math.floor(rand() * 15);
      img.set(x, y, tone(top, 1.15));
      img.set(x + 1, y + 1, tone(top, 0.85));
    }
  };
}

const PAINTERS: Record<TileName, Painter> = {
  grass,
  'grass-flowers': (img, ox, oy, rand) => {
    grass(img, ox, oy, rand);
    for (let i = 0; i < 3; i++) {
      const x = ox + 2 + Math.floor(rand() * 11);
      const y = oy + 2 + Math.floor(rand() * 11);
      const c = rand() > 0.5 ? 0xf6e070 : 0xf090c8;
      img.set(x + 1, y, c);
      img.set(x, y + 1, c);
      img.set(x + 2, y + 1, c);
      img.set(x + 1, y + 2, c);
      img.set(x + 1, y + 1, 0xfff8e0);
      img.set(x + 1, y + 3, GRASS.dark);
    }
  },
  dirt: (img, ox, oy, rand) => {
    speckle([0x9a7448, 0x86633c], 0x957047, 0.12)(img, ox, oy, rand);
    for (let i = 0; i < 3; i++) {
      const x = ox + Math.floor(rand() * 14);
      const y = oy + Math.floor(rand() * 15);
      img.rect(x, y, 2, 1, 0x6e5232);
      img.set(x, y - 1, 0xb48c5c);
    }
  },
  sand: speckle([0xd8c48a, 0xc8b273, 0xeadaa6], 0xd4bf84, 0.15),
  'rock-wall': rockTop(ROCK),
  tree: (img, ox, oy, rand) => {
    img.rect(ox + 6, oy + 11, 4, 5, DARK_WOOD.base);
    img.rect(ox + 6, oy + 11, 1, 5, DARK_WOOD.outline);
    img.rect(ox + 9, oy + 11, 1, 5, DARK_WOOD.outline);
    img.rect(ox + 7, oy + 15, 2, 1, DARK_WOOD.dark);
    blob(img, ox, oy, 7.5, 6.5, 7.5, 6.6, tones(0x3e8a46), rand, 0.18);
    // A couple of leaf clusters for texture.
    img.set(ox + 4, oy + 4, tone(0x3e8a46, 1.45));
    img.set(ox + 5, oy + 3, tone(0x3e8a46, 1.45));
    img.set(ox + 9, oy + 6, tone(0x3e8a46, 1.25));
  },
  water: (img, ox, oy, rand) => waterBase(img, ox, oy, rand),
  bush: (img, ox, oy, rand) => {
    blob(img, ox, oy, 7.5, 9, 7, 5.6, tones(0x3c8040), rand, 0.2);
    img.set(ox + 5, oy + 7, 0xe86a6a);
    img.set(ox + 10, oy + 9, 0xe86a6a);
  },
  'wood-floor': planks(WOOD, false),
  'stone-floor': (img, ox, oy, rand) => {
    img.rect(ox, oy, S, S, STONE.dark);
    for (const [x, y, w, h] of [
      [0, 0, 8, 8],
      [8, 0, 8, 8],
      [0, 8, 8, 8],
      [8, 8, 8, 8],
    ] as const) {
      img.rect(
        ox + x + 1,
        oy + y + 1,
        w - 1,
        h - 1,
        rand() > 0.5 ? STONE.base : tone(STONE.base, 0.95),
      );
      img.rect(ox + x + 1, oy + y + 1, w - 1, 1, STONE.light);
    }
  },
  'stone-wall': (img, ox, oy) => {
    // Wall cap on top, brick face below: the "front" of the wall faces the player.
    img.rect(ox, oy, S, 5, tone(STONE.base, 1.1));
    img.rect(ox, oy, S, 1, STONE.light);
    img.rect(ox, oy + 4, S, 1, STONE.outline);
    img.rect(ox, oy + 5, S, 11, tones(0x6e6a78).base);
    for (let row = 0; row < 3; row++) {
      const y = oy + 5 + row * 4;
      img.rect(ox, y + 3, S, 1, tones(0x6e6a78).outline);
      for (let x = (row % 2) * 4; x < S; x += 8) img.rect(ox + x, y, 1, 3, tones(0x6e6a78).outline);
      img.rect(ox, y, S, 1, tones(0x6e6a78).light);
    }
  },
  shelf: (img, ox, oy, rand) => {
    img.rect(ox, oy, S, S, DARK_WOOD.outline);
    img.rect(ox + 1, oy + 1, 14, 14, DARK_WOOD.base);
    for (const y of [2, 8]) {
      img.rect(ox + 1, oy + y + 5, 14, 1, DARK_WOOD.light);
      let x = ox + 2;
      while (x < ox + 14) {
        const w = 1 + Math.floor(rand() * 2);
        const c =
          [0xc04a3a, 0x3a6ac0, 0xd8b040, 0x4a9a5a, 0xe8e0d0][Math.floor(rand() * 5)] ?? 0xc04a3a;
        const h = 4 + Math.floor(rand() * 2);
        img.rect(x, oy + y + 5 - h, w, h, c);
        x += w + (rand() > 0.7 ? 1 : 0);
      }
    }
  },
  window: (img, ox, oy) => {
    img.rect(ox, oy, S, S, tones(0x6e6a78).base);
    img.rect(ox, oy, S, 1, STONE.light);
    img.rect(ox + 2, oy + 2, 12, 11, 0x9ccaf0);
    img.rect(ox + 2, oy + 9, 12, 4, 0xe8f2fa);
    img.rect(ox + 4, oy + 8, 5, 1, 0xe8f2fa);
    img.rect(ox + 7, oy + 2, 2, 11, DARK_WOOD.base);
    img.rect(ox + 2, oy + 7, 12, 1, DARK_WOOD.base);
    img.rect(ox + 1, oy + 13, 14, 2, DARK_WOOD.light);
  },
  ash: (img, ox, oy, rand) => {
    speckle([ASH.dark, ASH.light], ASH.base, 0.2)(img, ox, oy, rand);
    if (rand() > 0.5) img.set(ox + Math.floor(rand() * S), oy + Math.floor(rand() * S), 0xe8783a);
  },
  meadow,
  crystal: (img, ox, oy) => {
    // Anchor shards: small cyan crystals growing out of the ground.
    const shard = (x: number, h: number) => {
      for (let y = 0; y < h; y++) {
        const top = y >= h - 2;
        img.set(ox + x, oy + 15 - y, 0x2a6a80);
        img.rect(ox + x + 1, oy + 15 - y, top ? 1 : 2, 1, y > h / 2 ? 0xc8fcff : 0x6ad8ec);
        if (!top) img.set(ox + x + 3, oy + 15 - y, 0x2a6a80);
      }
    };
    shard(2, 9);
    shard(7, 13);
    shard(11, 7);
  },
  carpet: (img, ox, oy) => {
    img.rect(ox, oy, S, S, 0x2a4a8a);
    img.rect(ox, oy, S, 1, 0xd8b040);
    img.rect(ox, oy + S - 1, S, 1, 0xd8b040);
    for (let x = 2; x < S; x += 4) img.set(ox + x, oy + 8, 0x4a6ab0);
  },
  boulder: (img, ox, oy, rand) => blob(img, ox, oy, 7.5, 9, 7, 5.8, ROCK, rand),
  sea: (img, ox, oy, rand) => {
    // Deep coastal water: darker than rivers, with sparse foam crests.
    img.rect(ox, oy, S, S, SEA.base);
    for (let i = 0; i < 4; i++) {
      const x = ox + Math.floor(rand() * 12);
      const y = oy + Math.floor(rand() * 15);
      img.rect(x, y, 3, 1, SEA.light);
      img.set(x + 1, y - 1, 0xe8f4ff);
    }
    for (let i = 0; i < 8; i++)
      img.set(ox + Math.floor(rand() * S), oy + Math.floor(rand() * S), SEA.dark);
  },
  dock: planks(DARK_WOOD, true),
  bridge: (img, ox, oy, rand) => {
    waterBase(img, ox, oy, rand);
    img.rect(ox, oy + 1, S, 14, WOOD.base);
    for (let x = 0; x < S; x += 4) {
      img.rect(ox + x, oy + 1, 1, 14, WOOD.dark);
      img.rect(ox + x + 1, oy + 1, 1, 14, WOOD.light);
    }
    img.rect(ox, oy + 1, S, 1, 0xd8c08a);
    img.rect(ox, oy + 14, S, 1, 0xd8c08a);
  },
  scrap: (img, ox, oy, rand) => {
    // Pile of salvaged hull plates the scavengers stripped from anchors.
    blob(img, ox, oy, 7.5, 10, 7, 5, tones(0x6a7280), rand, 0.25);
    img.rect(ox + 3, oy + 7, 5, 1, 0xb84a2a);
    img.rect(ox + 9, oy + 9, 3, 2, 0x3a3e48);
    img.set(ox + 6, oy + 6, 0xd8dce8);
  },
  'tall-grass': (img, ox, oy, rand) => {
    meadow(img, ox, oy, rand);
    for (let i = 0; i < 9; i++) {
      const x = ox + 1 + Math.floor(rand() * 14);
      const y = oy + 5 + Math.floor(rand() * 9);
      img.rect(x, y, 1, 3, MEADOW.outline);
      img.set(x, y - 1, MEADOW.light);
    }
  },
  crate: (img, ox, oy) => {
    const t = WOOD;
    img.rect(ox + 1, oy + 2, 14, 13, t.outline);
    img.rect(ox + 2, oy + 3, 12, 11, t.base);
    img.rect(ox + 2, oy + 3, 12, 1, t.light);
    img.rect(ox + 2, oy + 8, 12, 1, t.dark);
    for (let i = 0; i < 10; i++) img.set(ox + 3 + i, oy + 4 + i, t.dark);
    img.rect(ox + 2, oy + 13, 12, 1, t.dark);
  },
  cliff: (img, ox, oy, rand) => {
    // Coast: a strip of grass, then the rock face dropping into the sea.
    img.rect(ox, oy, S, S, SEA.base);
    img.rect(ox, oy, S, 4, MEADOW.base);
    img.rect(ox, oy + 3, S, 1, MEADOW.dark);
    for (let x = 0; x < S; x++) {
      const depth = 9 + Math.floor(rand() * 3) - (x % 5 === 0 ? 2 : 0);
      for (let y = 4; y < 4 + depth; y++) {
        const c =
          y === 4
            ? ROCK.light
            : x % 4 === 0
              ? ROCK.dark
              : y > 4 + depth - 3
                ? ROCK.dark
                : ROCK.base;
        img.set(ox + x, oy + y, c);
      }
      img.set(ox + x, oy + 4 + depth, ROCK.outline);
    }
  },
  'canyon-floor': speckle([0xb8683c, 0xa85c34, 0xd08a54, 0x8a4a2a], 0xbc6e40, 0.16),
  'canyon-wall': rockTop(CANYON),
  'copper-ore': (img, ox, oy, rand) => {
    blob(img, ox, oy, 7.5, 9, 7, 5.8, ROCK, rand);
    // Copper veins catching the light.
    for (const [x, y] of [
      [5, 7],
      [6, 8],
      [9, 6],
      [10, 10],
      [4, 11],
    ] as const)
      img.set(ox + x, oy + y, rand() > 0.3 ? COPPER.light : COPPER.base);
  },
  anchor: (img, ox, oy) => {
    // A pillar of anchor crystal: the island's heart.
    for (let y = 0; y < S; y++) {
      const half = y < 4 ? y + 1 : y > 12 ? 16 - y + 2 : 5;
      for (let x = 8 - half; x < 8 + half; x++) {
        const edge = x === 8 - half || x === 8 + half - 1;
        const c = edge ? 0x1e5a70 : x < 8 ? 0xc8fcff : x < 10 ? 0x7ae4f4 : 0x4ab8d0;
        img.set(ox + x, oy + y, c);
      }
    }
    img.set(ox + 6, oy + 5, 0xffffff);
    img.set(ox + 6, oy + 6, 0xffffff);
  },
  'anchor-broken': (img, ox, oy, rand) => {
    // The same pillar snapped off low, dull and cracked, over a dark fissure.
    for (let x = 2; x < 14; x++) img.set(ox + x, oy + 14, 0x241838);
    for (let x = 4; x < 12; x++) img.set(ox + x, oy + 15, 0x160e24);
    for (let y = 8; y < 14; y++) {
      const half = 5 - (y === 8 ? 2 : y === 9 ? 1 : 0);
      for (let x = 8 - half; x < 8 + half; x++) {
        const edge = x === 8 - half || x === 8 + half - 1 || y === 8;
        img.set(ox + x, oy + y, edge ? 0x1e3a48 : x < 8 ? 0x6a98a8 : 0x3a6878);
      }
    }
    for (const [x, y] of [
      [7, 9],
      [8, 10],
      [7, 11],
      [8, 12],
    ] as const)
      img.set(ox + x, oy + y, 0x160e24);
    // Loose shards around the stump.
    for (const [x, y] of [
      [2, 12],
      [13, 11],
      [12, 13],
    ] as const)
      img.set(ox + x, oy + y, rand() > 0.5 ? 0x7ae4f4 : 0x4ab8d0);
  },
  // Pillar bases (the game stands a tall column sprite on them; this is the map/fallback art).
  pillar: (img, ox, oy, rand) => blob(img, ox, oy, 7.5, 8, 6.5, 6.5, ROCK, rand),
  'canyon-pillar': (img, ox, oy, rand) => blob(img, ox, oy, 7.5, 8, 6.5, 6.5, CANYON, rand),
  mud: (img, ox, oy, rand) => {
    speckle([MUD.dark, MUD.light], MUD.base, 0.18)(img, ox, oy, rand);
    // Puddles catching the sky.
    if (rand() > 0.55) {
      const x = ox + 2 + Math.floor(rand() * 9);
      const y = oy + 3 + Math.floor(rand() * 9);
      img.rect(x, y, 4, 2, tone(BRINE.base, 0.9));
      img.set(x + 1, y, BRINE.light);
    }
  },
  'salt-flat': (img, ox, oy, rand) => {
    speckle([SALT.dark, 0xf4f2ea], SALT.base, 0.14)(img, ox, oy, rand);
    // Hexagonal crust cracks.
    for (let i = 0; i < 2; i++) {
      const x = ox + Math.floor(rand() * 12);
      const y = oy + Math.floor(rand() * 12);
      img.rect(x, y, 4, 1, SALT.dark);
      img.set(x + 4, y + 1, SALT.dark);
      img.set(x - 1, y + 1, SALT.dark);
    }
  },
  reeds: (img, ox, oy, rand) => {
    speckle([MUD.dark], MUD.base, 0.12)(img, ox, oy, rand);
    for (let i = 0; i < 10; i++) {
      const x = ox + Math.floor(rand() * 15);
      const y = oy + 4 + Math.floor(rand() * 10);
      img.rect(x, y - 3, 1, 4, 0x6a7a3a);
      img.set(x, y - 4, 0xb09a5a);
    }
  },
  brine: (img, ox, oy, rand) => {
    img.rect(ox, oy, S, S, BRINE.base);
    for (let i = 0; i < 5; i++) {
      const x = ox + Math.floor(rand() * 13);
      const y = oy + Math.floor(rand() * 15);
      img.rect(x, y, 3, 1, BRINE.light);
    }
    // Salt scum drifting on the surface.
    for (let i = 0; i < 3; i++)
      img.set(ox + Math.floor(rand() * S), oy + Math.floor(rand() * S), 0xe8e4d8);
  },
  hut: (img, ox, oy, rand) => {
    // Thatched roof seen from above, with a ridge line.
    img.rect(ox, oy, S, S, THATCH.base);
    for (let y = 0; y < S; y += 3) img.rect(ox, oy + y, S, 1, THATCH.dark);
    for (let i = 0; i < 8; i++)
      img.set(ox + Math.floor(rand() * S), oy + Math.floor(rand() * S), THATCH.light);
    img.rect(ox + 7, oy, 2, S, THATCH.outline);
  },
  'rift-floor': speckle([BASALT.dark, BASALT.light, 0x5a3a4a], BASALT.base, 0.16),
  'rift-wall': rockTop(BASALT),
  seam: (img, ox, oy, rand) => {
    // A vein of raw anchor light running through the basalt.
    rockTop(BASALT)(img, ox, oy, rand);
    let x = 3 + Math.floor(rand() * 4);
    for (let y = 0; y < S; y++) {
      img.rect(ox + x, oy + y, 3, 1, 0x4ab8d0);
      img.set(ox + x + 1, oy + y, 0xc8fcff);
      if (rand() > 0.6) x = Math.max(1, Math.min(11, x + (rand() > 0.5 ? 1 : -1)));
    }
  },
  rail: (img, ox, oy, rand) => {
    speckle([BASALT.dark, BASALT.light], BASALT.base, 0.12)(img, ox, oy, rand);
    for (let y = 1; y < S; y += 4) img.rect(ox + 2, oy + y, 12, 2, DARK_WOOD.base);
    img.rect(ox + 4, oy, 1, S, 0x8a8a96);
    img.rect(ox + 11, oy, 1, S, 0x8a8a96);
  },
  palisade: (img, ox, oy) => {
    // Sharpened stakes lashed together (the Mano Gris siege line).
    for (let x = 0; x < S; x += 4) {
      img.rect(ox + x, oy + 3, 3, 13, DARK_WOOD.base);
      img.set(ox + x + 1, oy + 1, DARK_WOOD.light);
      img.rect(ox + x, oy + 2, 3, 1, DARK_WOOD.light);
      img.rect(ox + x + 3, oy + 3, 1, 13, DARK_WOOD.outline);
    }
    img.rect(ox, oy + 8, S, 1, 0xa08a5a);
  },
  'deep-floor': (img, ox, oy, rand) => {
    speckle([DEEP.dark, DEEP.light], DEEP.base, 0.18)(img, ox, oy, rand);
    if (rand() > 0.7) img.set(ox + Math.floor(rand() * S), oy + Math.floor(rand() * S), 0x6ad8ec);
  },
  'deep-wall': rockTop(DEEP),
  'glow-root': (img, ox, oy, rand) => {
    speckle([DEEP.dark], DEEP.base, 0.12)(img, ox, oy, rand);
    // Roots that drank anchor light, glowing faintly.
    let y = 4 + Math.floor(rand() * 8);
    for (let x = 0; x < S; x++) {
      img.rect(ox + x, oy + y, 1, 2, 0x3a8a8a);
      img.set(ox + x, oy + y, 0x9ff6ff);
      if (rand() > 0.6) y = Math.max(1, Math.min(13, y + (rand() > 0.5 ? 1 : -1)));
    }
  },
  'abyss-floor': (img, ox, oy, rand) => {
    speckle([ABYSS.dark, ABYSS.light, 0x5a2a5a], ABYSS.base, 0.2)(img, ox, oy, rand);
    if (rand() > 0.5) img.set(ox + Math.floor(rand() * S), oy + Math.floor(rand() * S), 0xd080ff);
  },
  'abyss-wall': rockTop(ABYSS),
  void: (img, ox, oy, rand) => {
    img.rect(ox, oy, S, S, 0x08040c);
    for (let i = 0; i < 3; i++)
      img.set(ox + Math.floor(rand() * S), oy + Math.floor(rand() * S), 0x3a1e5a);
  },
};

const rows = Math.ceil(TILES.length / TILESET_COLUMNS);
const img = new RgbaImage(TILESET_COLUMNS * S, rows * S);
TILES.forEach((tile, i) => {
  const ox = (i % TILESET_COLUMNS) * S;
  const oy = Math.floor(i / TILESET_COLUMNS) * S;
  PAINTERS[tile.name](img, ox, oy, rng(1000 + i * 7919));
});
for (let i = 0; i < img.data.length; i += 4) {
  const c = ((img.data[i] ?? 0) << 16) | ((img.data[i + 1] ?? 0) << 8) | (img.data[i + 2] ?? 0);
  const q = to15(c);
  img.data[i] = (q >> 16) & 0xff;
  img.data[i + 1] = (q >> 8) & 0xff;
  img.data[i + 2] = q & 0xff;
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${TILESET_NAME}.png`), img.toPng());

export function tilesetJson(imagePath: string): Record<string, unknown> {
  return {
    name: TILESET_NAME,
    type: 'tileset',
    version: '1.10',
    tiledversion: '1.11.0',
    image: imagePath,
    imagewidth: img.width,
    imageheight: img.height,
    tilewidth: S,
    tileheight: S,
    tilecount: TILES.length,
    columns: TILESET_COLUMNS,
    margin: 0,
    spacing: 0,
    tiles: TILES.map((t, id) => ({
      id,
      properties: [
        { name: 'name', type: 'string', value: t.name },
        { name: 'collides', type: 'bool', value: t.collides },
        { name: 'blocksFlight', type: 'bool', value: 'blocksFlight' in t && t.blocksFlight },
        { name: 'low', type: 'bool', value: 'low' in t && t.low },
      ],
    })),
  };
}

writeFileSync(
  join(outDir, `${TILESET_NAME}.tsj`),
  `${JSON.stringify(tilesetJson(`${TILESET_NAME}.png`), null, 2)}\n`,
);
console.log(`tileset: ${TILES.length} tiles -> ${outDir}`);
