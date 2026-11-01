import { AsciiCanvas } from './paint.ts';
import type { MapSpec, ObjectSpec } from './types.ts';

/**
 * Hondonada de Cobre (exterior), 56x40 tiles: winding paths cut into tall canyon walls.
 * South-west: landing basin. West: bandit mesa. Centre: the Mano Gris mining camp. South-east:
 * a pocket behind Tavi's level-10 barrier. North: Okun's ring, and east of it a cave sealed by
 * a boulder only Okun can break (the first thing he does once he joins).
 */
function layout(): string[] {
  const c = new AsciiCanvas(56, 40, 'Q');
  // Landing basin and the trail north.
  c.rect(3, 29, 13, 9, 'q').vline(8, 17, 29, 'q', 3);
  c.scatter(3, 29, 13, 9, ':', 0.12, 3, 'q');

  // Bandit mesa (west), copper ore for cover.
  c.rect(3, 11, 18, 9, 'q').scatter(4, 12, 16, 7, 'u', 0.06, 5, 'q');
  c.hline(20, 34, 14, 'q', 3);

  // Mano Gris mining camp (centre).
  c.vline(30, 16, 18, 'q', 3).rect(25, 18, 17, 11, 'q');
  c.scatter(25, 18, 17, 11, ':', 0.15, 9, 'q');
  c.rect(26, 19, 2, 1, 'c').rect(39, 19, 2, 2, 'c').set(27, 27, 'w').set(38, 26, 'w');
  c.set(33, 22, 'u').set(34, 22, 'u').set(29, 24, 'c');

  // South trail to the pocket behind Tavi's barrier.
  c.vline(32, 28, 33, 'q', 3).hline(14, 43, 33, 'q', 3);
  c.rect(44, 28, 9, 9, 'q').scatter(45, 29, 7, 7, 'u', 0.08, 13, 'q');

  // Okun's ring (north): a circle of boulders around a sandy floor.
  c.vline(34, 9, 18, 'q', 3).rect(26, 2, 17, 8, 'q');
  c.rect(28, 3, 13, 6, 's');
  for (const x of [27, 41]) c.vline(x, 3, 7, 'o');
  c.hline(28, 32, 2, 'o').hline(37, 40, 2, 'o');
  c.set(30, 4, 'K').set(38, 4, 'K').set(31, 7, 'K').set(37, 7, 'K');

  // The sealed cave east of the ring.
  c.hline(43, 45, 6, 'q').rect(46, 3, 8, 6, 'q').scatter(47, 4, 6, 4, 'u', 0.1, 17, 'q');
  // Arc 3: a pocket off the west gorge, closed by a crack only Nilo fits through, and the
  // stairs down to the vault of the first golem.
  c.rect(12, 23, 6, 4, 'q').set(11, 24, 'q');
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

export const cobreMap: MapSpec = {
  id: 'cobre',
  baseGround: 'canyon-floor',
  rows: layout(),
  objects: [
    {
      type: 'gate',
      name: 'vaultCrawl',
      x: 11,
      y: 24,
      w: 1,
      h: 1,
      props: { kind: 'crawl', requiredCharacter: 'nilo', requiredLevel: 1 },
    },
    {
      type: 'transition',
      name: 'toVault',
      x: 16,
      y: 24,
      w: 1,
      h: 2,
      props: { targetZone: 'cobreVault', targetSpawn: 'entry' },
    },
    { type: 'playerSpawn', name: 'fromVault', x: 9, y: 25 },
    { type: 'playerSpawn', name: 'flight', x: 8, y: 33 },
    { type: 'flightCircle', name: 'flight', x: 8, y: 34 },
    { type: 'saveCircle', name: 'save', x: 13, y: 35 },
    { type: 'cutscene', name: 'campOverlook', x: 30, y: 15, w: 3, h: 2 },

    { type: 'chest', name: 'chestMesa', x: 4, y: 12, props: { itemId: 'kiFlask' } },
    {
      type: 'chest',
      name: 'chestCamp',
      x: 40,
      y: 23,
      props: { itemId: 'altitudeBerry', hiddenUntilGroupCleared: 'camp' },
    },
    { type: 'chest', name: 'chestPocket', x: 50, y: 32, props: { itemId: 'copperCharm' } },
    {
      type: 'gate',
      name: 'pocketGate',
      x: 43,
      y: 33,
      w: 1,
      h: 3,
      props: { requiredCharacter: 'tavi', requiredLevel: 10 },
    },
    { type: 'chest', name: 'chestCave', x: 51, y: 5, props: { itemId: 'quarryTonic' } },
    {
      type: 'gate',
      name: 'caveBoulder',
      x: 44,
      y: 6,
      w: 1,
      h: 1,
      props: { kind: 'boulder', requiredCharacter: 'okun', requiredLevel: 1 },
    },

    enemy('mesa1', 'canyonBandit', 8, 14, 'mesa'),
    enemy('mesa2', 'canyonBandit', 14, 16, 'mesa'),
    enemy('mesa3', 'prospector', 17, 12, 'mesa'),
    enemy('trail1', 'canyonBandit', 9, 22),
    enemy('trail2', 'greyGlider', 24, 15),
    enemy('camp1', 'prospector', 28, 21, 'camp'),
    enemy('camp2', 'prospector', 37, 21, 'camp'),
    enemy('camp3', 'canyonBandit', 31, 25, 'camp'),
    enemy('camp4', 'canyonBandit', 36, 26, 'camp'),
    enemy('camp5', 'copperGolem', 33, 20, 'camp'),
    enemy('camp6', 'quarryBrute', 30, 23, 'camp'),
    enemy('south1', 'crystalLeech', 24, 34),
    enemy('south2', 'prospector', 36, 34),
    enemy('pocket1', 'crystalLeech', 48, 31),
    enemy('okun', 'okunRival', 34, 5),
  ],
  props: { nameKey: 'zone.cobre' },
};
