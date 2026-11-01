import type { TileName } from '../tiles.ts';

export type PropValue = string | number | boolean;

/** Object placed in tile coordinates; compiled to pixel coordinates in Tiled. */
export interface ObjectSpec {
  type: string;
  name?: string;
  x: number;
  y: number;
  /** Width/height in tiles. Omit both for a point object. */
  w?: number;
  h?: number;
  props?: Record<string, PropValue>;
}

export interface MapSpec {
  id: string;
  /** Tile used under solid tiles that have transparent-looking art (trees, crystals...). */
  baseGround: TileName;
  rows: string[];
  objects: ObjectSpec[];
  /** Map-level custom properties (e.g. zone name key, music). */
  props?: Record<string, PropValue>;
}

/** ASCII legend shared by all maps. Solid tiles go to the Collision layer. */
export const LEGEND: Record<string, TileName> = {
  '.': 'grass',
  ',': 'grass-flowers',
  ':': 'dirt',
  s: 'sand',
  '#': 'rock-wall',
  T: 'tree',
  '~': 'water',
  b: 'bush',
  _: 'wood-floor',
  '=': 'stone-floor',
  W: 'stone-wall',
  C: 'shelf',
  O: 'window',
  x: 'ash',
  a: 'meadow',
  '*': 'crystal',
  r: 'carpet',
  o: 'boulder',
  ' ': 'sea',
  h: 'dock',
  B: 'bridge',
  w: 'scrap',
  '"': 'tall-grass',
  c: 'crate',
  '^': 'cliff',
  A: 'anchor',
  q: 'canyon-floor',
  Q: 'canyon-wall',
  u: 'copper-ore',
  P: 'pillar',
  K: 'canyon-pillar',
  m: 'mud',
  z: 'salt-flat',
  v: 'reeds',
  n: 'brine',
  H: 'hut',
  R: 'rift-floor',
  Y: 'rift-wall',
  j: 'seam',
  l: 'rail',
  X: 'palisade',
  d: 'deep-floor',
  D: 'deep-wall',
  g: 'glow-root',
  e: 'abyss-floor',
  E: 'abyss-wall',
  V: 'void',
};
