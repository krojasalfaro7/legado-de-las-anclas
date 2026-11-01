import { AsciiCanvas } from './paint.ts';
import type { MapSpec, ObjectSpec } from './types.ts';

/**
 * La Hondura (arc 2, chapter 7), 60x40, underground (interior: no flying). Tavi wakes in the
 * north-west cave where she fell. East: a maze of glowing roots. South-west: the echo shrine,
 * where three echoes of the first wardens tell what the anchors are for; hearing all three
 * opens the way to the arena in the south-east, where her shadow waits. Past the arena, up
 * north-east, the root chamber where Iolé and Okun climb down to find her.
 */
function layout(): string[] {
  const c = new AsciiCanvas(60, 40, 'D');
  // A: the fall cave, and the ways out east (roots) and south (shrine).
  c.rect(2, 2, 12, 8, 'd').rect(13, 5, 4, 3, 'd').rect(6, 9, 3, 6, 'd');
  // B: the root maze.
  c.rect(16, 2, 25, 15, 'd').scatter(17, 3, 23, 13, 'g', 0.14, 81, 'd');
  c.rect(16, 6, 25, 1, 'd').rect(28, 2, 1, 15, 'd');
  // C: the echo shrine.
  c.rect(2, 14, 17, 12, 'd').scatter(3, 15, 15, 10, 'g', 0.05, 83, 'd');
  c.rect(4, 17, 1, 1, 'g').rect(16, 17, 1, 1, 'g');
  // D: the central cavern, with chasms.
  c.rect(18, 20, 6, 3, 'd').rect(30, 16, 3, 4, 'd');
  c.rect(23, 19, 18, 12, 'd').scatter(24, 20, 16, 10, 'V', 0.07, 85, 'd');
  c.rect(23, 24, 18, 1, 'd').rect(31, 19, 1, 12, 'd');
  // E: the shadow's arena (south-east), sealed until the echoes are heard.
  c.rect(40, 27, 4, 2, 'd');
  c.rect(44, 22, 14, 15, 'd');
  c.set(47, 25, 'P').set(54, 25, 'P').set(47, 33, 'P').set(54, 33, 'P');
  // F: the root chamber (north-east), past the arena.
  c.rect(49, 15, 3, 7, 'd');
  c.rect(44, 3, 14, 12, 'd').scatter(45, 4, 12, 3, 'g', 0.2, 87, 'd');
  return c.rows();
}

const enemy = (name: string, enemyId: string, x: number, y: number): ObjectSpec => ({
  type: 'enemy',
  name,
  x,
  y,
  props: { enemyId },
});

const echo = (name: string, x: number, y: number): ObjectSpec => ({
  type: 'npc',
  name,
  x,
  y,
  props: { npcId: name, facing: 'down' },
});

export const hollowMap: MapSpec = {
  id: 'hollow',
  baseGround: 'deep-floor',
  rows: layout(),
  objects: [
    { type: 'playerSpawn', name: 'fall', x: 6, y: 5 },
    { type: 'saveCircle', name: 'save', x: 10, y: 4 },

    echo('echoA', 5, 19),
    echo('echoB', 10, 23),
    echo('echoC', 15, 19),

    {
      type: 'gate',
      name: 'arenaSeal',
      x: 43,
      y: 27,
      w: 1,
      h: 2,
      props: { kind: 'seal', openFlag: 'echoesHeard', hintKey: 'seal.hollowArena' },
    },
    { type: 'enemy', name: 'shadow', x: 51, y: 29, props: { enemyId: 'taviShadow' } },
    { type: 'chest', name: 'chestArena', x: 56, y: 35, props: { itemId: 'quarryTonic' } },
    {
      type: 'gate',
      name: 'chamberSeal',
      x: 49,
      y: 21,
      w: 3,
      h: 1,
      props: { kind: 'seal', openFlag: 'deepTide', hintKey: 'seal.hollowChamber' },
    },
    { type: 'cutscene', name: 'reunionArea', x: 45, y: 8, w: 12, h: 6 },
    { type: 'chest', name: 'chestChamber', x: 56, y: 4, props: { itemId: 'altitudeBerry' } },

    { type: 'chest', name: 'chestRoots', x: 39, y: 3, props: { itemId: 'glowrootSandals' } },
    { type: 'chest', name: 'chestShrine', x: 3, y: 24, props: { collectibleId: 'echoStone' } },
    { type: 'chest', name: 'chestDeep', x: 39, y: 29, props: { itemId: 'kiFlask' } },

    enemy('r1', 'hollowCrawler', 22, 4),
    enemy('r2', 'rootWisp', 26, 10),
    enemy('r3', 'hollowCrawler', 33, 8),
    enemy('r4', 'rootWisp', 37, 13),
    enemy('r5', 'echoWarden', 35, 4),
    enemy('s1', 'rootWisp', 9, 16),
    enemy('d1', 'echoWarden', 27, 22),
    enemy('d2', 'hollowCrawler', 36, 21),
    enemy('d3', 'rootWisp', 28, 28),
    enemy('d4', 'hollowCrawler', 38, 26),
    enemy('d5', 'echoWarden', 34, 29),
    enemy('f1', 'rootWisp', 47, 10),
  ],
  props: { nameKey: 'zone.hollow' },
};
