import { AsciiCanvas } from './paint.ts';
import type { MapSpec, ObjectSpec } from './types.ts';

/**
 * Acantilado de la Atalaya (arc 2, chapter 6), 60x40: the slope between the Watchtower (north)
 * and the sea (south and west) where the Mano Gris lays siege. Two fenced camps flank the path
 * (west, east), a third holds the beach, and the crystal ram climbs the middle path toward the
 * tower gate. Sarn waits at his boat landing (south-east), behind a barricade that Nilo knows
 * how to bring down. Planted: Nilo's crawl into the tower's west store, Tavi's level-26 door
 * into the east store, Iolé's vent into a sea cave.
 */
function layout(): string[] {
  const c = new AsciiCanvas(60, 40, '.');
  c.scatter(0, 0, 60, 40, ',', 0.06, 71, '.');
  c.scatter(0, 0, 60, 40, '"', 0.05, 73, '.');

  // The tower's foot (north) and the sea (west and south) with a beach.
  c.rect(0, 0, 60, 3, 'W').rect(22, 0, 16, 5, 'W');
  c.rect(0, 3, 2, 37, ' ');
  c.rect(2, 31, 41, 6, 's').rect(0, 37, 60, 3, ' ');
  // The path from the gate down to the beach, and a cliff step with three ways down.
  c.vline(29, 5, 31, ':', 2);
  c.hline(2, 56, 22, '^').rect(8, 22, 3, 1, ':').rect(29, 22, 2, 1, ':').rect(48, 22, 3, 1, ':');

  // West and east siege camps: palisades with two gaps each, crates inside.
  for (const x0 of [4, 42]) {
    c.hline(x0, x0 + 13, 8, 'X').hline(x0, x0 + 13, 18, 'X');
    c.vline(x0, 8, 18, 'X').vline(x0 + 13, 8, 18, 'X');
    c.rect(x0 + 6, 18, 2, 1, ':').rect(x0 === 4 ? x0 + 13 : x0, 12, 1, 3, ':');
    c.rect(x0 + 2, 10, 2, 1, 'c').set(x0 + 10, 16, 'c');
  }
  // Beach camp: loose barricades.
  for (const x of [12, 20, 34]) c.vline(x, 31, 32, 'X');
  c.rect(25, 34, 2, 1, 'c');

  // Nilo's crawl: the tower's west store.
  c.rect(2, 3, 8, 6, 'W').rect(3, 4, 6, 4, '=').rect(5, 8, 2, 1, '=');
  // Tavi's door: the tower's east store.
  c.rect(50, 3, 9, 6, 'W').rect(51, 4, 7, 4, '=').rect(53, 8, 2, 1, '=');
  // Iolé's vent: a sea cave in the west cliff.
  c.rect(2, 24, 7, 7, '#').rect(3, 25, 5, 4, ':').rect(5, 29, 2, 2, ':');

  // Sarn's landing (south-east): rock all round, a jetty, one barricaded way in from the beach.
  c.rect(43, 27, 17, 11, '#').rect(44, 28, 15, 8, 's').rect(50, 34, 7, 2, 'h');
  c.rect(43, 30, 1, 2, 's');
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

export const cliffsMap: MapSpec = {
  id: 'cliffs',
  baseGround: 'grass',
  rows: layout(),
  objects: [
    { type: 'playerSpawn', name: 'flight', x: 30, y: 6 },
    { type: 'flightCircle', name: 'flight', x: 30, y: 7 },
    { type: 'saveCircle', name: 'save', x: 26, y: 6 },

    {
      type: 'npc',
      name: 'niloGate',
      x: 33,
      y: 6,
      props: { npcId: 'nilo', facing: 'down', hiddenFlag: 'niloJoined' },
    },

    // The crystal ram on the middle path, and Sarn at his landing.
    { type: 'enemy', name: 'ram', x: 30, y: 14, props: { enemyId: 'crystalRam' } },
    {
      type: 'gate',
      name: 'landingBarricade',
      x: 43,
      y: 30,
      w: 1,
      h: 2,
      props: { kind: 'seal', openFlag: 'siegeBroken', hintKey: 'seal.cliffs' },
    },
    { type: 'enemy', name: 'sarn', x: 51, y: 31, props: { enemyId: 'sarnHollow' } },
    { type: 'chest', name: 'chestLanding', x: 57, y: 29, props: { itemId: 'quarryTonic' } },

    // Planted barriers.
    {
      type: 'gate',
      name: 'storeCrawl',
      x: 5,
      y: 8,
      w: 2,
      h: 1,
      props: { kind: 'crawl', requiredCharacter: 'nilo', requiredLevel: 1 },
    },
    { type: 'chest', name: 'chestStoreWest', x: 4, y: 5, props: { itemId: 'altitudeBerry' } },
    {
      type: 'gate',
      name: 'storeDoor',
      x: 53,
      y: 8,
      w: 2,
      h: 1,
      props: { requiredCharacter: 'tavi', requiredLevel: 26 },
    },
    { type: 'chest', name: 'chestStoreEast', x: 56, y: 5, props: { collectibleId: 'towerBell' } },
    {
      type: 'gate',
      name: 'caveVent',
      x: 5,
      y: 30,
      w: 2,
      h: 1,
      props: { kind: 'vent', requiredCharacter: 'iole', requiredLevel: 1 },
    },
    { type: 'chest', name: 'chestCave', x: 4, y: 26, props: { itemId: 'stormCowl' } },

    // Tavi's letters, scattered when her satchel burst in the quake.
    { type: 'chest', name: 'letterA', x: 19, y: 6, props: { itemId: 'taviLetterA' } },
    { type: 'chest', name: 'letterB', x: 38, y: 20, props: { itemId: 'taviLetterB' } },
    { type: 'chest', name: 'letterC', x: 15, y: 27, props: { itemId: 'taviLetterC' } },

    enemy('wA', 'riftRaider', 8, 11, 'west'),
    enemy('wB', 'riftSlinger', 13, 15, 'west'),
    enemy('wC', 'saltRaider', 7, 16, 'west'),
    enemy('wD', 'convoyHauler', 12, 10, 'west'),
    enemy('eA', 'riftRaider', 47, 11, 'east'),
    enemy('eB', 'cliffGlider', 51, 14, 'east'),
    enemy('eC', 'riftSlinger', 53, 10, 'east'),
    enemy('eD', 'graftedGolem', 46, 16, 'east'),
    enemy('bA', 'saltRaider', 15, 33, 'beach'),
    enemy('bB', 'riftRaider', 22, 32, 'beach'),
    enemy('bC', 'cliffGlider', 30, 34, 'beach'),
    enemy('bD', 'convoyHauler', 36, 33, 'beach'),
    enemy('bE', 'riftSlinger', 40, 31, 'beach'),
    enemy('f1', 'cliffGlider', 22, 26),
    enemy('f2', 'riftRaider', 37, 26),
  ],
  props: { nameKey: 'zone.cliffs' },
};
