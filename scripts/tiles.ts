/**
 * Tileset definition shared by the tileset generator and the map compiler.
 * Order matters: a tile's index is its Tiled gid - 1, so only append new tiles.
 */
export interface TileDef {
  name: string;
  collides: boolean;
  /** Tall solids (walls, tree canopies) also stop a flying player. */
  blocksFlight?: boolean;
  /** Low solids (water, bushes) that ki shots pass over. */
  low?: boolean;
}

export const TILES = [
  { name: 'grass', collides: false },
  { name: 'grass-flowers', collides: false },
  { name: 'dirt', collides: false },
  { name: 'sand', collides: false },
  { name: 'rock-wall', collides: true, blocksFlight: true },
  { name: 'tree', collides: true, blocksFlight: true },
  { name: 'water', collides: true, low: true },
  { name: 'bush', collides: true, low: true },
  { name: 'wood-floor', collides: false },
  { name: 'stone-floor', collides: false },
  { name: 'stone-wall', collides: true, blocksFlight: true },
  { name: 'shelf', collides: true, blocksFlight: true },
  { name: 'window', collides: true, blocksFlight: true },
  { name: 'ash', collides: false },
  { name: 'meadow', collides: false },
  { name: 'crystal', collides: true },
  { name: 'carpet', collides: false },
  { name: 'boulder', collides: true },
  { name: 'sea', collides: true, low: true },
  { name: 'dock', collides: false },
  { name: 'bridge', collides: false },
  { name: 'scrap', collides: true },
  { name: 'tall-grass', collides: false },
  { name: 'crate', collides: true },
  { name: 'cliff', collides: true, low: true },
  { name: 'anchor', collides: true, blocksFlight: true },
  { name: 'canyon-floor', collides: false },
  { name: 'canyon-wall', collides: true, blocksFlight: true },
  { name: 'copper-ore', collides: true },
  { name: 'anchor-broken', collides: true },
  // Arena cover: tall rock columns that stop shots and fliers (drawn by Scenery).
  { name: 'pillar', collides: true, blocksFlight: true },
  { name: 'canyon-pillar', collides: true, blocksFlight: true },
  // Arc 2: salt marshes.
  { name: 'mud', collides: false },
  { name: 'salt-flat', collides: false },
  { name: 'reeds', collides: false },
  { name: 'brine', collides: true, low: true },
  { name: 'hut', collides: true, blocksFlight: true },
  // Arc 2: La Grieta (basalt rift with a crystal seam and the convoy's rails).
  { name: 'rift-floor', collides: false },
  { name: 'rift-wall', collides: true, blocksFlight: true },
  { name: 'seam', collides: true },
  { name: 'rail', collides: false },
  // Arc 2: the siege below the Atalaya.
  { name: 'palisade', collides: true },
  // Underground: the Hondura and El Fondo.
  { name: 'deep-floor', collides: false },
  { name: 'deep-wall', collides: true, blocksFlight: true },
  { name: 'glow-root', collides: true, low: true },
  { name: 'abyss-floor', collides: false },
  { name: 'abyss-wall', collides: true, blocksFlight: true },
  { name: 'void', collides: true, low: true },
] as const satisfies readonly TileDef[];

export type TileName = (typeof TILES)[number]['name'];

export const TILE_SIZE = 16;
export const TILESET_COLUMNS = 8;
export const TILESET_NAME = 'placeholder';

export function tileIndex(name: TileName): number {
  return TILES.findIndex((t) => t.name === name);
}
