import { AsciiCanvas } from './paint.ts';
import type { MapSpec, ObjectSpec } from './types.ts';

/**
 * Marismas de Sal (arc 2, chapter 4), 60x40. South-west: salt flats where the party lands.
 * West: Salinar, a village of huts on boardwalks. A brine river crosses the marsh; three salt
 * workers are lost in it (north-west salt pans, the eastern reeds, the south-east pans).
 * North-east: the marsh's anchor in a brine ring, sealed until the workers are safe, where
 * Vesk's colossus is grafted on. Planted barriers: Iolé's vent shrine (north), Nilo's crawl into
 * a sunken hut (east) and a boulder only a strong Okun breaks (south).
 */
function layout(): string[] {
  const c = new AsciiCanvas(60, 40, 'm');
  c.scatter(1, 1, 58, 38, 'v', 0.14, 51, 'm');
  c.scatter(1, 1, 58, 38, 'n', 0.03, 53, 'm');
  c.frame(0, 0, 60, 40, 'n');

  // Brine river (east-west) with boardwalks, and a channel down the middle.
  c.hline(1, 58, 12, 'n', 2).rect(9, 12, 2, 2, 'h').rect(30, 12, 2, 2, 'h').rect(48, 12, 3, 2, 'B');
  c.vline(28, 14, 38, 'n', 2).rect(28, 27, 2, 2, 'h');

  // Landing on the salt flats (south-west) and the walk up to the village.
  c.rect(2, 29, 15, 9, 'z');
  c.vline(9, 24, 29, 'h', 2);

  // Salinar: huts on a boardwalk deck.
  c.rect(3, 15, 16, 10, 'h');
  for (const [x, y] of [
    [4, 16],
    [9, 16],
    [14, 16],
    [4, 21],
    [14, 21],
  ] as const)
    c.rect(x, y, 3, 2, 'H');

  // North-west salt pans (Ruy).
  c.rect(2, 2, 14, 9, 'z').scatter(2, 2, 14, 9, 'n', 0.06, 57, 'z');
  // Eastern reeds (Mela): dense, with a path through.
  c.rect(34, 16, 16, 10, 'v').hline(34, 49, 20, 'm');
  // South-east salt pans (Tobi).
  c.rect(34, 30, 20, 8, 'z').scatter(34, 30, 20, 8, 'n', 0.05, 59, 'z');

  // The anchor ring (north-east): a brine moat, a ring of rock (nobody flies in over it), a salt
  // floor and pillars for cover. One way in, from the south, through Brea's seal.
  c.rect(40, 1, 19, 12, 'n').rect(41, 1, 17, 11, '#').rect(42, 2, 15, 9, 'z');
  c.rect(48, 2, 3, 2, 'A');
  c.rect(48, 11, 3, 1, 'z');
  for (const [x, y] of [
    [44, 4],
    [54, 4],
    [45, 8],
    [53, 8],
  ] as const)
    c.set(x, y, 'P');

  // Iolé's vent shrine (north): stone walls, the vent on its south side.
  c.rect(21, 2, 8, 7, 'W').rect(22, 3, 6, 5, '=').rect(24, 8, 2, 1, '=');
  // Sunken hut (east) that only Nilo can crawl into.
  c.rect(52, 16, 6, 6, 'H').rect(53, 17, 4, 4, 'h').rect(54, 21, 2, 1, 'h');
  // Rock pocket (south) closed by a boulder.
  c.rect(19, 31, 7, 7, '#').rect(20, 32, 5, 4, 'z').rect(22, 36, 1, 2, 'z');
  // Arc 3: the old well shrine (south-east), shut by a vent only Iolé's gust opens.
  c.rect(53, 25, 6, 5, 'W').rect(54, 26, 4, 3, '=').rect(55, 29, 2, 1, '=');
  return c.rows();
}

const enemy = (
  name: string,
  enemyId: string,
  x: number,
  y: number,
  group?: string,
): ObjectSpec => ({
  type: 'enemy',
  name,
  x,
  y,
  props: group ? { enemyId, group } : { enemyId },
});

const area = (name: string, x: number, y: number, w: number, h: number): ObjectSpec => ({
  type: 'cutscene',
  name,
  x,
  y,
  w,
  h,
});

export const marshMap: MapSpec = {
  id: 'marsh',
  baseGround: 'mud',
  rows: layout(),
  objects: [
    {
      type: 'gate',
      name: 'wellVent',
      x: 55,
      y: 29,
      w: 2,
      h: 1,
      props: { kind: 'vent', requiredCharacter: 'iole', requiredLevel: 1 },
    },
    {
      type: 'transition',
      name: 'toWell',
      x: 55,
      y: 26,
      w: 2,
      h: 1,
      props: { targetZone: 'marshWell', targetSpawn: 'entry' },
    },
    { type: 'playerSpawn', name: 'fromWell', x: 55, y: 31 },
    { type: 'playerSpawn', name: 'flight', x: 6, y: 33 },
    { type: 'flightCircle', name: 'flight', x: 6, y: 34 },
    { type: 'saveCircle', name: 'save', x: 11, y: 34 },

    // Salinar.
    { type: 'npc', name: 'brea', x: 11, y: 19, props: { npcId: 'brea', facing: 'down' } },
    { type: 'npc', name: 'damaso', x: 17, y: 23, props: { npcId: 'damaso', facing: 'left' } },
    // The lost workers, and where they wait once safe.
    {
      type: 'npc',
      name: 'ruy',
      x: 8,
      y: 4,
      props: { npcId: 'ruy', facing: 'down', hiddenFlag: 'rescuedRuy' },
    },
    {
      type: 'npc',
      name: 'mela',
      x: 44,
      y: 18,
      props: { npcId: 'mela', facing: 'down', hiddenFlag: 'rescuedMela' },
    },
    {
      type: 'npc',
      name: 'tobi',
      x: 47,
      y: 34,
      props: { npcId: 'tobi', facing: 'left', hiddenFlag: 'rescuedTobi' },
    },
    {
      type: 'npc',
      name: 'ruyHome',
      x: 6,
      y: 19,
      props: { npcId: 'ruy', facing: 'right', requiresFlag: 'rescuedRuy' },
    },
    {
      type: 'npc',
      name: 'melaHome',
      x: 16,
      y: 19,
      props: { npcId: 'mela', facing: 'left', requiresFlag: 'rescuedMela' },
    },
    {
      type: 'npc',
      name: 'tobiHome',
      x: 8,
      y: 23,
      props: { npcId: 'tobi', facing: 'up', requiresFlag: 'rescuedTobi' },
    },
    area('ruyArea', 5, 2, 8, 6),
    area('melaArea', 40, 16, 9, 6),
    area('tobiArea', 43, 31, 9, 6),

    // The anchor, sealed by Brea's salt rite until the workers are home.
    {
      type: 'gate',
      name: 'anchorSeal',
      x: 48,
      y: 11,
      w: 3,
      h: 1,
      props: { kind: 'seal', openFlag: 'marshRescued', hintKey: 'seal.marsh' },
    },
    { type: 'chest', name: 'chestAnchor', x: 55, y: 3, props: { itemId: 'quarryTonic' } },
    {
      type: 'enemy',
      name: 'colossus',
      x: 49,
      y: 6,
      props: { enemyId: 'saltColossus', requiresFlag: 'marshRescued' },
    },

    // Planted barriers and their rewards.
    {
      type: 'gate',
      name: 'shrineVent',
      x: 24,
      y: 8,
      w: 2,
      h: 1,
      props: { kind: 'vent', requiredCharacter: 'iole', requiredLevel: 1 },
    },
    { type: 'chest', name: 'chestShrine', x: 24, y: 4, props: { collectibleId: 'brinePearl' } },
    {
      type: 'gate',
      name: 'hutCrawl',
      x: 54,
      y: 21,
      w: 2,
      h: 1,
      props: { kind: 'crawl', requiredCharacter: 'nilo', requiredLevel: 1 },
    },
    { type: 'chest', name: 'chestHut', x: 55, y: 18, props: { itemId: 'saltwardenSash' } },
    {
      type: 'gate',
      name: 'pocketBoulder',
      x: 22,
      y: 37,
      w: 1,
      h: 1,
      props: { kind: 'boulder', requiredCharacter: 'okun', requiredLevel: 18 },
    },
    { type: 'chest', name: 'chestPocket', x: 22, y: 33, props: { itemId: 'altitudeBerry' } },
    { type: 'chest', name: 'chestFlats', x: 15, y: 31, props: { itemId: 'kiFlask' } },

    enemy('flats1', 'brineSkitter', 14, 36),
    enemy('flats2', 'brineSkitter', 20, 27),
    enemy('mid1', 'mireHound', 22, 18),
    enemy('mid2', 'brineSkitter', 25, 22),
    enemy('mid3', 'saltRaider', 33, 9),
    enemy('ruy1', 'saltRaider', 12, 7, 'ruy'),
    enemy('ruy2', 'brineSkitter', 5, 8, 'ruy'),
    enemy('ruy3', 'graftedGolem', 13, 3, 'ruy'),
    enemy('mela1', 'mireHound', 38, 18, 'mela'),
    enemy('mela2', 'mireHound', 47, 22, 'mela'),
    enemy('mela3', 'saltRaider', 41, 24, 'mela'),
    enemy('tobi1', 'brineBrute', 42, 33, 'tobi'),
    enemy('tobi2', 'brineSkitter', 50, 31, 'tobi'),
    enemy('tobi3', 'saltRaider', 52, 35, 'tobi'),
    enemy('east1', 'graftedGolem', 38, 6),
    enemy('east2', 'brineSkitter', 33, 30),
  ],
  props: { nameKey: 'zone.marsh' },
};
