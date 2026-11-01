import { tileIndex } from '../tiles.ts';
import { AsciiCanvas } from './paint.ts';
import type { MapSpec, ObjectSpec } from './types.ts';

/**
 * La Grieta (arc 2, chapter 5), 60x40: a basalt rift that steps down in four terraces, joined
 * by ramps that alternate sides, so the way down zig-zags (walls block flight). Top: the rim
 * where the party lands and the Mano Gris convoy camp. Second terrace: Grell's rematch, which
 * seals the ramp down. Third: the crystal seam, where Vesk's grafts are cut. Bottom: Vesk's
 * workshop over the vein, where the floor opens at the end of the chapter.
 * Planted barriers: Iolé's vent (rim alcove), Okun's boulder (a store under the second terrace)
 * and Nilo's crawl (a pocket beside the bottom).
 */
function layout(): string[] {
  const c = new AsciiCanvas(60, 40, 'Y');

  // Terrace 1, the rim: landing (west), convoy camp (east), rails between.
  c.rect(2, 4, 55, 6, 'R');
  c.scatter(2, 4, 55, 6, ':', 0.08, 61, 'R');
  c.hline(10, 56, 7, 'l');
  for (const x of [34, 42, 50]) c.vline(x, 4, 5, 'X');
  c.rect(37, 4, 2, 1, 'c').rect(45, 8, 2, 1, 'c').set(53, 4, 'c');
  // Iolé's alcove above the rim.
  c.rect(24, 1, 4, 2, 'R').rect(25, 3, 2, 1, 'R');

  // Ramp 1 (east) down to terrace 2.
  c.rect(52, 10, 4, 2, 'R');
  // Terrace 2: the convoy route west and Grell's arena at its end.
  c.rect(3, 12, 54, 7, 'R');
  c.hline(22, 56, 15, 'l');
  c.scatter(22, 12, 34, 7, 'j', 0.03, 63, 'R');
  c.set(7, 13, 'P').set(16, 13, 'P').set(7, 17, 'P').set(16, 17, 'P');
  // Okun's store under the terrace.
  c.rect(30, 20, 6, 2, 'R').set(32, 19, 'R');

  // Ramp 2 (west, sealed by Grell) down to terrace 3.
  c.rect(4, 19, 3, 4, 'R');
  // Terrace 3: the crystal seam.
  c.rect(3, 23, 54, 7, 'R');
  c.scatter(8, 23, 46, 7, 'j', 0.09, 67, 'R');
  c.hline(8, 50, 26, 'l');
  // Nilo's crawl into the pocket beside the bottom.
  c.rect(3, 33, 4, 5, 'R').rect(4, 30, 2, 3, 'R');

  // Ramp 3 (east) down to the bottom.
  c.rect(51, 30, 4, 2, 'R');
  // Terrace 4: Vesk's workshop over the vein.
  c.rect(9, 32, 48, 7, 'R');
  c.hline(26, 34, 38, 'j');
  c.set(22, 33, 'P').set(38, 33, 'P').set(22, 37, 'P').set(38, 37, 'P');
  c.rect(12, 33, 2, 1, 'c').rect(47, 36, 2, 2, 'c');
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

export const riftMap: MapSpec = {
  id: 'rift',
  baseGround: 'rift-floor',
  rows: layout(),
  objects: [
    { type: 'playerSpawn', name: 'flight', x: 5, y: 6 },
    { type: 'flightCircle', name: 'flight', x: 5, y: 7 },
    { type: 'saveCircle', name: 'save', x: 9, y: 5 },
    { type: 'saveCircle', name: 'saveDeep', x: 52, y: 26 },

    { type: 'npc', name: 'tolo', x: 14, y: 5, props: { npcId: 'tolo', facing: 'down' } },

    // Grell waits at the west end of the second terrace; beating him lifts the seal on ramp 2.
    {
      type: 'enemy',
      name: 'grell',
      x: 11,
      y: 15,
      props: { enemyId: 'grellCrystal' },
    },
    {
      type: 'gate',
      name: 'grellSeal',
      x: 4,
      y: 19,
      w: 3,
      h: 1,
      props: { kind: 'seal', openFlag: 'grellBeaten', hintKey: 'seal.rift' },
    },
    { type: 'enemy', name: 'vesk', x: 30, y: 34, props: { enemyId: 'vesk' } },
    // The floor opens under the vein when the Fondo takes Tavi.
    {
      type: 'tileSwap',
      name: 'veinOpens',
      x: 27,
      y: 36,
      w: 7,
      h: 2,
      props: { flag: 'taviTaken', gid: tileIndex('void') + 1 },
    },
    // Arc 3: once the three lights open the seal, the pit's edge is the way down to El Fondo.
    {
      type: 'transition',
      name: 'toAbyss',
      x: 28,
      y: 35,
      w: 5,
      h: 1,
      props: { targetZone: 'abyss1', targetSpawn: 'top', requiresFlag: 'fondoOpen' },
    },
    { type: 'playerSpawn', name: 'fromAbyss', x: 36, y: 34, props: { afterBarriers: true } },

    // Planted barriers and their rewards.
    {
      type: 'gate',
      name: 'alcoveVent',
      x: 25,
      y: 3,
      w: 2,
      h: 1,
      props: { kind: 'vent', requiredCharacter: 'iole', requiredLevel: 1 },
    },
    { type: 'chest', name: 'chestAlcove', x: 25, y: 1, props: { collectibleId: 'veinGeode' } },
    {
      type: 'gate',
      name: 'storeBoulder',
      x: 32,
      y: 19,
      w: 1,
      h: 1,
      props: { kind: 'boulder', requiredCharacter: 'okun', requiredLevel: 20 },
    },
    { type: 'chest', name: 'chestStore', x: 34, y: 21, props: { itemId: 'quarryTonic' } },
    {
      type: 'gate',
      name: 'pocketCrawl',
      x: 4,
      y: 30,
      w: 2,
      h: 1,
      props: { kind: 'crawl', requiredCharacter: 'nilo', requiredLevel: 1 },
    },
    { type: 'chest', name: 'chestPocket', x: 4, y: 36, props: { itemId: 'deepcoreBand' } },

    // Tolo's lost tools, one per terrace.
    { type: 'chest', name: 'toolPick', x: 41, y: 17, props: { itemId: 'toloPick' } },
    { type: 'chest', name: 'toolLamp', x: 20, y: 28, props: { itemId: 'toloLamp' } },
    { type: 'chest', name: 'toolRope', x: 53, y: 37, props: { itemId: 'toloRope' } },
    { type: 'chest', name: 'chestCamp', x: 55, y: 5, props: { itemId: 'kiFlask' } },

    enemy('rim1', 'riftRaider', 30, 6),
    enemy('rim2', 'riftSlinger', 38, 8),
    enemy('rim3', 'riftRaider', 46, 5),
    enemy('rim4', 'convoyHauler', 53, 7),
    enemy('t2a', 'riftSlinger', 48, 13),
    enemy('t2b', 'seamWisp', 40, 14),
    enemy('t2c', 'riftRaider', 33, 17),
    enemy('t2d', 'seamWisp', 26, 13),
    enemy('t3a', 'graftedGolem', 12, 25),
    enemy('t3b', 'seamWisp', 22, 24),
    enemy('t3c', 'riftSlinger', 31, 28),
    enemy('t3d', 'convoyHauler', 40, 25),
    enemy('t3e', 'seamWisp', 47, 28),
    enemy('t4a', 'riftRaider', 48, 33),
    enemy('t4b', 'graftedGolem', 44, 37),
  ],
  props: { nameKey: 'zone.rift' },
};
