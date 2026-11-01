import { AsciiCanvas } from './paint.ts';
import type { MapSpec } from './types.ts';

/**
 * The Watchtower on the coast (interior): captain's room, relic archive, corridor, the flight
 * dock and the sealed archive vault.
 */
function layout(): string[] {
  const c = new AsciiCanvas(30, 22, '_');
  c.frame(0, 0, 30, 22, 'W');
  for (const x of [5, 11, 18, 24]) c.set(x, 0, 'O');
  // Command room (left) and archive (right), separated by a wall with a doorway.
  c.vline(13, 1, 6, 'W', 2).rect(13, 4, 2, 1, '_');
  c.hline(1, 28, 7, 'W');
  c.rect(6, 7, 2, 1, '_').rect(22, 7, 2, 1, '_');
  c.rect(1, 1, 3, 1, 'C').rect(4, 3, 6, 3, 'r');
  c.rect(17, 3, 7, 1, '=').rect(17, 5, 7, 1, '=');
  c.rect(25, 1, 3, 1, 'c').set(27, 2, 'c').set(21, 6, 'c');
  // Corridor and hangar.
  c.hline(1, 28, 11, 'W').rect(11, 11, 8, 1, '_');
  c.rect(1, 12, 2, 2, 'c').rect(27, 12, 2, 2, 'c').rect(1, 19, 3, 2, 'c').rect(26, 19, 3, 2, 'c');
  c.rect(10, 14, 10, 1, 'h')
    .rect(10, 20, 10, 1, 'h')
    .rect(10, 15, 1, 5, 'h')
    .rect(19, 15, 1, 5, 'h');
  c.rect(11, 15, 8, 5, '=');
  // Archive vault (bottom-left), behind a story seal that opens at the end of arc 1.
  c.hline(1, 7, 15, 'W').vline(8, 15, 20, 'W').rect(4, 15, 2, 1, '_').rect(1, 16, 7, 3, '=');
  c.rect(1, 21, 28, 1, 'W');
  return c.rows();
}

export const hubMap: MapSpec = {
  id: 'hub',
  baseGround: 'wood-floor',
  rows: layout(),
  objects: [
    { type: 'playerSpawn', name: 'start', x: 7, y: 9 },
    { type: 'playerSpawn', name: 'flight', x: 14, y: 16 },
    {
      type: 'npc',
      name: 'iole',
      x: 6,
      y: 2,
      props: { npcId: 'iole', facing: 'down', hiddenFlag: 'ioleJoined' },
    },
    { type: 'npc', name: 'pim', x: 20, y: 2, props: { npcId: 'pim', facing: 'down' } },
    {
      type: 'npc',
      name: 'nilo',
      x: 21,
      y: 9,
      props: { npcId: 'nilo', facing: 'left', hiddenFlag: 'siegeStarted' },
    },
    { type: 'npc', name: 'oda', x: 25, y: 13, props: { npcId: 'oda', facing: 'left' } },
    // Post-game: Iolé back at her desk, and Maela's hunts.
    {
      type: 'npc',
      name: 'ioleHome',
      x: 6,
      y: 2,
      props: { npcId: 'iole', facing: 'down', requiresFlag: 'gameCleared' },
    },
    {
      type: 'npc',
      name: 'maela',
      x: 26,
      y: 9,
      props: { npcId: 'maela', facing: 'left', requiresFlag: 'gameCleared' },
    },
    { type: 'saveCircle', name: 'save', x: 3, y: 9 },
    { type: 'flightCircle', name: 'flight', x: 14, y: 17 },
    {
      type: 'gate',
      name: 'vaultSeal',
      x: 4,
      y: 15,
      w: 2,
      h: 1,
      props: { kind: 'seal', openFlag: 'vaultOpened', hintKey: 'seal.vault' },
    },
    { type: 'chest', name: 'chestVault', x: 5, y: 17, props: { itemId: 'wardenCoat' } },
  ],
  props: { nameKey: 'zone.hub' },
};
