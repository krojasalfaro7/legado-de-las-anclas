import type { CollectibleDef } from './types';

/** Unique relics of fallen islands, delivered to the archivist NPC. */
export const COLLECTIBLES: Record<string, CollectibleDef> = {
  driftCompass: {
    id: 'driftCompass',
    nameKey: 'col.driftCompass',
    descKey: 'col.driftCompass.desc',
  },
  mistBell: { id: 'mistBell', nameKey: 'col.mistBell', descKey: 'col.mistBell.desc' },
  lanternGlass: {
    id: 'lanternGlass',
    nameKey: 'col.lanternGlass',
    descKey: 'col.lanternGlass.desc',
  },
  brinePearl: { id: 'brinePearl', nameKey: 'col.brinePearl', descKey: 'col.brinePearl.desc' },
  veinGeode: { id: 'veinGeode', nameKey: 'col.veinGeode', descKey: 'col.veinGeode.desc' },
  towerBell: { id: 'towerBell', nameKey: 'col.towerBell', descKey: 'col.towerBell.desc' },
  echoStone: { id: 'echoStone', nameKey: 'col.echoStone', descKey: 'col.echoStone.desc' },
  fondoPearl: { id: 'fondoPearl', nameKey: 'col.fondoPearl', descKey: 'col.fondoPearl.desc' },
};

export const COLLECTIBLE_IDS = Object.keys(COLLECTIBLES);
/** The valley's three relics: Pim's first exhibition (arc 1 reward). */
export const VALLEY_RELICS = ['driftCompass', 'mistBell', 'lanternGlass'] as const;

export function getCollectible(id: string): CollectibleDef {
  const def = COLLECTIBLES[id];
  if (!def) throw new Error(`Unknown collectible: ${id}`);
  return def;
}
