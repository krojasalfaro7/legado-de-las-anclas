import { tileIndex } from '../tiles.ts';
import { AsciiCanvas } from './paint.ts';
import type { MapSpec, ObjectSpec } from './types.ts';

/**
 * Mist Valley (exterior), 60x40 tiles = 2x2 screens on one map with a following
 * camera. South: landing site. River across the middle. North-west: raider camp and
 * a level-gated grove. East: harpooners and ballast golems (and a quarry nook behind a boulder
 * only Okun breaks). North: Grell guards the valley's anchor; later Sarn comes for it.
 */
function layout(): string[] {
  const c = new AsciiCanvas(60, 40, 'a');
  c.scatter(1, 1, 58, 38, '"', 0.05, 7, 'a');
  // Valley edge: dense forest all around, sea cliffs on the south coast.
  c.frame(0, 0, 60, 40, 'T').hline(0, 59, 39, '^');

  // River with two bridges.
  c.hline(1, 58, 21, '~', 2).rect(10, 21, 2, 2, 'B').rect(44, 21, 2, 2, 'B');

  // Landing site (south-west) and paths.
  c.rect(4, 31, 10, 7, 'x');
  c.vline(10, 23, 30, ':', 2)
    .hline(12, 34, 34, ':', 1)
    .vline(34, 23, 34, ':', 1)
    .hline(34, 44, 23, ':');
  c.rect(24, 31, 5, 3, '~').rect(23, 32, 1, 1, '~').rect(29, 32, 1, 1, '~');

  // Secret alcove (south-east), reached through a gap hidden in tall grass.
  c.frame(50, 32, 9, 7, 'T').rect(51, 33, 7, 5, 'a').rect(50, 35, 1, 1, '"');
  c.scatter(51, 33, 7, 5, '"', 0.35, 11, 'a');

  // Crystal field (east) where harpooners hide.
  c.scatter(37, 24, 20, 8, '*', 0.06, 21, 'a');
  c.scatter(37, 24, 20, 8, '"', 0.1, 23, 'a');

  // Raider camp (north-west) and the level-gated grove in the corner.
  c.rect(10, 9, 12, 8, 'x')
    .rect(11, 10, 1, 1, 'c')
    .rect(20, 10, 1, 2, 'c')
    .set(12, 16, 'w')
    .set(19, 15, 'c');
  c.vline(10, 17, 20, ':', 2).hline(12, 26, 13, ':');
  c.rect(1, 1, 10, 8, '#').rect(2, 2, 7, 5, 'a').rect(5, 7, 2, 2, 'a');
  c.scatter(2, 2, 7, 5, ',', 0.2, 31, 'a').set(3, 3, 'T').set(8, 6, 'T');
  c.vline(5, 9, 12, ':', 2);

  // Golem plateau (north-east), boulders for cover.
  c.scatter(42, 3, 16, 14, 'o', 0.05, 41, 'a');
  c.rect(44, 4, 12, 10, 'x').scatter(44, 4, 12, 10, 'o', 0.04, 43, 'x');
  // Quarry nook in the corner, walled in rock and closed by a boulder only Okun can break.
  c.rect(51, 1, 8, 6, '#').rect(52, 2, 6, 4, 'x').rect(54, 6, 2, 2, 'x');

  // The crater around the valley's anchor, where Grell waits (north-centre).
  c.frame(23, 1, 15, 9, 'o').rect(24, 2, 13, 7, 'x').rect(29, 9, 3, 1, 'x');
  c.rect(29, 2, 3, 2, 'A').set(25, 6, 'w').set(35, 4, 'w');
  // Arc 3: a stone well in the crater's corner, down to the anchor's heart (Okun's trial).
  c.rect(24, 2, 3, 3, '#').set(25, 3, 'x').set(25, 4, 'x');
  // Rock pillars for cover in the duels (reference arenas): break line of sight to shooters.
  c.set(26, 4, 'P').set(34, 6, 'P').set(27, 7, 'P').set(33, 3, 'P');
  c.vline(30, 10, 20, ':', 1).hline(26, 30, 13, ':');

  // Tree clusters to break up open areas.
  for (const [x, y] of [
    [2, 12],
    [3, 13],
    [24, 17],
    [25, 17],
    [17, 26],
    [18, 27],
    [40, 17],
    [41, 18],
    [55, 19],
    [52, 26],
    [2, 27],
  ] as const) {
    c.set(x, y, 'T');
  }
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

export const fieldMap: MapSpec = {
  id: 'field',
  baseGround: 'meadow',
  rows: layout(),
  objects: [
    // Arc 3: Okun's trial, under the broken anchor.
    {
      type: 'gate',
      name: 'heartBoulder',
      x: 25,
      y: 4,
      w: 1,
      h: 1,
      props: { kind: 'boulder', requiredCharacter: 'okun', requiredLevel: 24 },
    },
    {
      type: 'transition',
      name: 'toHeart',
      x: 25,
      y: 3,
      w: 1,
      h: 1,
      props: { targetZone: 'anchorHeart', targetSpawn: 'entry' },
    },
    { type: 'playerSpawn', name: 'fromHeart', x: 25, y: 7 },
    { type: 'playerSpawn', name: 'flight', x: 8, y: 33 },
    { type: 'flightCircle', name: 'flight', x: 8, y: 34 },
    { type: 'saveCircle', name: 'save', x: 11, y: 36 },

    { type: 'chest', name: 'chestWeights', x: 19, y: 36, props: { itemId: 'trainingBallast' } },
    { type: 'chest', name: 'chestPond', x: 26, y: 29, props: { itemId: 'altitudeBerry' } },
    { type: 'chest', name: 'chestGrove', x: 5, y: 3, props: { collectibleId: 'lanternGlass' } },
    {
      type: 'chest',
      name: 'chestCamp',
      x: 15,
      y: 12,
      props: { collectibleId: 'mistBell', hiddenUntilGroupCleared: 'camp' },
    },
    {
      type: 'collectible',
      name: 'shackle',
      x: 56,
      y: 37,
      props: { collectibleId: 'driftCompass' },
    },

    { type: 'chest', name: 'chestQuarry', x: 55, y: 3, props: { itemId: 'quarryBand' } },
    {
      type: 'gate',
      name: 'quarryBoulder',
      x: 54,
      y: 6,
      w: 2,
      h: 1,
      props: { kind: 'boulder', requiredCharacter: 'okun', requiredLevel: 1 },
    },
    {
      type: 'gate',
      name: 'groveGate',
      x: 5,
      y: 8,
      w: 2,
      h: 1,
      props: { requiredCharacter: 'tavi', requiredLevel: 5 },
    },

    enemy('south1', 'raider', 20, 27),
    enemy('south2', 'raider', 28, 26),
    enemy('south3', 'shieldRaider', 36, 37),
    enemy('camp1', 'raider', 12, 11, 'camp'),
    enemy('camp2', 'raider', 18, 11, 'camp'),
    enemy('camp3', 'shieldRaider', 13, 15, 'camp'),
    enemy('camp4', 'raider', 18, 14, 'camp'),
    enemy('camp5', 'campBruiser', 15, 13, 'camp'),
    enemy('east1', 'harpooner', 41, 27),
    enemy('east2', 'harpooner', 48, 29),
    enemy('east3', 'mistRunner', 45, 25),
    enemy('east4', 'greyGlider', 43, 31),
    enemy('ne1', 'ballastGolem', 48, 8),
    enemy('ne2', 'ballastGolem', 53, 12),
    enemy('ne3', 'mistRunner', 50, 15),
    enemy('boss', 'grell', 30, 5),
    // The anchor snaps when Sarn falls (end of arc 1).
    {
      type: 'tileSwap',
      name: 'anchorBreak',
      x: 29,
      y: 2,
      w: 3,
      h: 2,
      props: { flag: 'anchorBroken', gid: tileIndex('anchor-broken') + 1 },
    },
    // Arc 1 finale: Sarn comes for the anchor once Okun has met Iolé.
    {
      type: 'enemy',
      name: 'sarn',
      x: 30,
      y: 5,
      props: { enemyId: 'sarn', requiresFlag: 'okunIntroduced' },
    },
  ],
  props: { nameKey: 'zone.field' },
};
