import { AsciiCanvas } from './paint.ts';
import type { MapSpec, ObjectSpec } from './types.ts';

/**
 * The three anchor lights' lairs (arc 3, chapter 8), small interiors under regions the party
 * already knows. Each: stairs in from the south (spawn `entry`, a transition back up), a few
 * guards on the way, and an arena with the guardian before the light. The stairs are long so
 * the guardian (which notices you from the arena) can't shove you back out mid-fight.
 */

const exit = (zone: string, spawn: string, x: number, y: number, w = 2): ObjectSpec => ({
  type: 'transition',
  name: 'exit',
  x,
  y,
  w,
  h: 1,
  props: { targetZone: zone, targetSpawn: spawn },
});

const enemy = (name: string, enemyId: string, x: number, y: number): ObjectSpec => ({
  type: 'enemy',
  name,
  x,
  y,
  props: { enemyId },
});

/** Bóveda de Cobre (under the Hondonada): the first golem kept its light in a copper vault. */
function vaultLayout(): string[] {
  const c = new AsciiCanvas(30, 31, 'Q');
  c.rect(12, 19, 6, 10, 'q').rect(13, 28, 4, 2, 'q');
  c.rect(3, 3, 24, 15, 'q').rect(9, 18, 12, 1, 'q');
  c.rect(14, 3, 3, 2, 'A');
  c.set(7, 7, 'K').set(22, 7, 'K').set(7, 14, 'K').set(22, 14, 'K');
  c.scatter(4, 5, 22, 12, 'u', 0.03, 91, 'q');
  return c.rows();
}

export const cobreVaultMap: MapSpec = {
  id: 'cobreVault',
  baseGround: 'canyon-floor',
  rows: vaultLayout(),
  objects: [
    { type: 'playerSpawn', name: 'entry', x: 14, y: 26 },
    exit('cobre', 'fromVault', 14, 29),
    { type: 'saveCircle', name: 'save', x: 16, y: 25 },
    enemy('g1', 'echoWarden', 6, 15),
    enemy('g2', 'hollowCrawler', 23, 16),
    { type: 'enemy', name: 'guardian', x: 15, y: 9, props: { enemyId: 'ancientGolem' } },
    { type: 'chest', name: 'chestVault', x: 4, y: 4, props: { itemId: 'quarryTonic' } },
  ],
  props: { nameKey: 'zone.cobreVault' },
};

/** Pozo de Salmuera (under the marshes): a drowned well where the brine mother nests. */
function wellLayout(): string[] {
  const c = new AsciiCanvas(30, 31, '#');
  c.rect(12, 19, 6, 10, 'z').rect(13, 28, 4, 2, 'z');
  c.rect(3, 3, 24, 15, 'z').rect(10, 18, 10, 1, 'z');
  // Brine pools at the edges, the nest's eggs (crates of salt) for cover.
  c.rect(3, 3, 4, 3, 'n').rect(23, 3, 4, 3, 'n').rect(3, 15, 3, 3, 'n').rect(24, 15, 3, 3, 'n');
  c.rect(14, 3, 3, 2, 'A');
  c.set(9, 8, 'c').set(20, 8, 'c').set(10, 13, 'c').set(19, 13, 'c');
  return c.rows();
}

export const marshWellMap: MapSpec = {
  id: 'marshWell',
  baseGround: 'salt-flat',
  rows: wellLayout(),
  objects: [
    { type: 'playerSpawn', name: 'entry', x: 14, y: 26 },
    exit('marsh', 'fromWell', 14, 29),
    { type: 'saveCircle', name: 'save', x: 16, y: 25 },
    enemy('g1', 'brineSkitter', 8, 15),
    enemy('g2', 'brineSkitter', 21, 15),
    enemy('g3', 'mireHound', 15, 16),
    { type: 'enemy', name: 'guardian', x: 15, y: 9, props: { enemyId: 'brineMother' } },
    { type: 'chest', name: 'chestWell', x: 25, y: 7, props: { itemId: 'kiFlask' } },
  ],
  props: { nameKey: 'zone.marshWell' },
};

/** Corazón del Ancla (under Valle Bruma): the broken anchor's roots, and an old promise. */
function heartLayout(): string[] {
  const c = new AsciiCanvas(30, 31, '#');
  c.rect(12, 19, 6, 10, 'x').rect(13, 28, 4, 2, 'x');
  c.rect(3, 3, 24, 15, 'x').rect(10, 18, 10, 1, 'x');
  c.rect(14, 3, 3, 2, 'A');
  c.set(8, 6, 'P').set(21, 6, 'P').set(8, 13, 'P').set(21, 13, 'P');
  c.scatter(4, 5, 22, 12, 'w', 0.02, 93, 'x');
  return c.rows();
}

export const anchorHeartMap: MapSpec = {
  id: 'anchorHeart',
  baseGround: 'ash',
  rows: heartLayout(),
  objects: [
    { type: 'playerSpawn', name: 'entry', x: 14, y: 26 },
    exit('field', 'fromHeart', 14, 29),
    { type: 'saveCircle', name: 'save', x: 16, y: 25 },
    enemy('g1', 'echoWarden', 9, 15),
    enemy('g2', 'echoWarden', 20, 15),
    { type: 'enemy', name: 'guardian', x: 15, y: 9, props: { enemyId: 'quarryEcho' } },
    { type: 'chest', name: 'chestHeart', x: 25, y: 4, props: { itemId: 'altitudeBerry' } },
  ],
  props: { nameKey: 'zone.anchorHeart' },
};
