import { AsciiCanvas } from './paint.ts';
import type { MapSpec, ObjectSpec } from './types.ts';

/**
 * El Fondo (arc 3, chapter 9): two interiors under La Grieta, reached through the opened vein.
 *
 * Las Raíces del Fondo (`abyss1`, 60x48), top to bottom: the landing under Tolo's rope (the way
 * back up), the hungering cavern, Nilo's crawl through the fallen roof, the membrane hall where
 * Sarn stays behind to hold the horde, and Vesk's arena over the last stairs down.
 */
function rootsLayout(): string[] {
  const c = new AsciiCanvas(60, 48, 'E');
  // A: the landing, and the rope up to the rift.
  c.rect(22, 2, 16, 8, 'e').rect(29, 1, 2, 1, 'e');
  c.rect(28, 10, 4, 4, 'e');
  // B: the hungering cavern, cut by void and propped on pillars.
  c.rect(6, 14, 48, 10, 'e');
  c.scatter(8, 15, 44, 8, 'V', 0.06, 101, 'e');
  c.rect(28, 14, 4, 10, 'e').rect(6, 18, 48, 1, 'e');
  c.set(12, 16, 'P').set(47, 16, 'P').set(12, 21, 'P').set(47, 21, 'P');
  // Nilo's crawl through the fallen roof.
  c.rect(29, 24, 2, 4, 'e');
  // C: the membrane hall, the horde's side (west) and the way on (east).
  c.rect(8, 28, 46, 5, 'e');
  c.scatter(9, 28, 14, 5, 'V', 0.08, 103, 'e');
  c.rect(49, 33, 4, 2, 'e');
  // D: Vesk's arena.
  c.rect(38, 35, 20, 10, 'e');
  c.set(41, 37, 'P').set(54, 37, 'P').set(41, 42, 'P').set(54, 42, 'P');
  c.rect(46, 45, 3, 3, 'e');
  return c.rows();
}

/**
 * El Corazón del Fondo (`abyss2`, 40x44): a long stair north into the round chamber where the
 * heart beats, ringed with void. Post-game: a side chamber off the stair, sealed until the game
 * is cleared, where the Fondo's last echo waits.
 */
function heartLayout(): string[] {
  const c = new AsciiCanvas(40, 44, 'E');
  c.rect(17, 27, 6, 15, 'e').rect(18, 42, 4, 1, 'e');
  c.rect(5, 4, 30, 23, 'e');
  // The void ring round the heart, broken by four ways in.
  c.frame(10, 7, 20, 14, 'V');
  c.rect(18, 7, 4, 1, 'e').rect(18, 20, 4, 1, 'e').rect(10, 12, 1, 3, 'e').rect(29, 12, 1, 3, 'e');
  c.set(7, 6, 'P').set(32, 6, 'P').set(7, 24, 'P').set(32, 24, 'P');
  // Post-game: the echo's chamber.
  c.rect(23, 33, 6, 2, 'e').rect(28, 29, 10, 12, 'e');
  return c.rows();
}

const enemy = (name: string, enemyId: string, x: number, y: number): ObjectSpec => ({
  type: 'enemy',
  name,
  x,
  y,
  props: { enemyId },
});

const seal = (
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  openFlag: string,
): ObjectSpec => ({
  type: 'gate',
  name,
  x,
  y,
  w,
  h,
  props: { kind: 'seal', openFlag, hintKey: `seal.${name}` },
});

export const abyssRootsMap: MapSpec = {
  id: 'abyss1',
  baseGround: 'abyss-floor',
  rows: rootsLayout(),
  objects: [
    { type: 'playerSpawn', name: 'top', x: 30, y: 4 },
    {
      type: 'transition',
      name: 'rope',
      x: 29,
      y: 1,
      w: 2,
      h: 1,
      props: { targetZone: 'rift', targetSpawn: 'fromAbyss' },
    },
    { type: 'saveCircle', name: 'save', x: 34, y: 4 },
    { type: 'chest', name: 'chestLanding', x: 23, y: 8, props: { itemId: 'quarryTonic' } },

    enemy('b1', 'fondoSpawn', 18, 16),
    enemy('b2', 'hungerWisp', 24, 20),
    enemy('b3', 'fondoSpawn', 38, 15),
    enemy('b4', 'drownedWarden', 42, 20),
    enemy('b5', 'hungerWisp', 10, 22),
    enemy('b6', 'fondoSpawn', 50, 22),
    { type: 'chest', name: 'chestCavernW', x: 7, y: 15, props: { itemId: 'abyssWraps' } },
    { type: 'chest', name: 'chestCavernE', x: 52, y: 15, props: { collectibleId: 'fondoPearl' } },

    { type: 'cutscene', name: 'courageArea', x: 26, y: 21, w: 8, h: 3 },
    {
      type: 'gate',
      name: 'roofCrawl',
      x: 29,
      y: 24,
      w: 2,
      h: 1,
      props: { kind: 'crawl', requiredCharacter: 'nilo', requiredLevel: 1 },
    },

    { type: 'cutscene', name: 'sarnArea', x: 26, y: 28, w: 8, h: 5 },
    seal('membrane', 46, 28, 1, 5, 'sarnStays'),
    enemy('h1', 'fondoSpawn', 12, 30),
    enemy('h2', 'drownedWarden', 17, 29),
    { type: 'chest', name: 'chestHall', x: 9, y: 31, props: { itemId: 'kiFlask' } },
    {
      type: 'npc',
      name: 'sarn',
      x: 20,
      y: 30,
      props: { npcId: 'sarn', facing: 'right', requiresFlag: 'gameCleared' },
    },
    { type: 'saveCircle', name: 'saveHall', x: 51, y: 30 },

    { type: 'enemy', name: 'vesk', x: 47, y: 39, props: { enemyId: 'veskFinal' } },
    { type: 'chest', name: 'chestArena', x: 56, y: 43, props: { itemId: 'veskGoggles' } },
    seal('heartStair', 46, 45, 3, 1, 'veskFallen'),
    { type: 'playerSpawn', name: 'fromHeart', x: 47, y: 43, props: { afterBarriers: true } },
    {
      type: 'transition',
      name: 'down',
      x: 46,
      y: 47,
      w: 3,
      h: 1,
      props: { targetZone: 'abyss2', targetSpawn: 'entry' },
    },
  ],
  props: { nameKey: 'zone.abyss1' },
};

export const abyssHeartMap: MapSpec = {
  id: 'abyss2',
  baseGround: 'abyss-floor',
  rows: heartLayout(),
  objects: [
    { type: 'playerSpawn', name: 'entry', x: 19, y: 39 },
    {
      type: 'transition',
      name: 'up',
      x: 18,
      y: 42,
      w: 4,
      h: 1,
      props: { targetZone: 'abyss1', targetSpawn: 'fromHeart' },
    },
    { type: 'saveCircle', name: 'save', x: 21, y: 37 },
    { type: 'enemy', name: 'fondo', x: 20, y: 13, props: { enemyId: 'fondoHeart' } },
    { type: 'chest', name: 'chestHeart', x: 33, y: 5, props: { itemId: 'kiFlask' } },

    seal('echoSeal', 23, 33, 1, 2, 'gameCleared'),
    {
      type: 'enemy',
      name: 'echo',
      x: 33,
      y: 34,
      props: { enemyId: 'fondoEcho', requiresFlag: 'gameCleared' },
    },
    { type: 'chest', name: 'chestEcho', x: 36, y: 39, props: { itemId: 'tideCrown' } },
  ],
  props: { nameKey: 'zone.abyss2' },
};
