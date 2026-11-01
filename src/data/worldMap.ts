import type { StringKey } from '../i18n';

/** A landing spot on the continent map. Spots without `zone` are locked teasers. */
export interface Landmark {
  id: string;
  nameKey: StringKey;
  zone?: string;
  x: number;
  y: number;
  /** Landing radius in map pixels. */
  radius: number;
  kind: 'tower' | 'valley' | 'canyon';
  /** Hidden on the map until this story flag is set. */
  revealFlag?: string;
}

export function visibleLandmarks(flags: Readonly<Record<string, boolean>>): Landmark[] {
  return LANDMARKS.filter((l) => !l.revealFlag || flags[l.revealFlag] === true);
}

/** Map size in world pixels; the terrain is generated at half size and drawn at 2x. */
export const WORLD_MAP = { width: 960, height: 640, seed: 1729 };

export const LANDMARKS: Landmark[] = [
  { id: 'atalaya', nameKey: 'zone.hub', zone: 'hub', x: 236, y: 150, radius: 22, kind: 'tower' },
  { id: 'bruma', nameKey: 'zone.field', zone: 'field', x: 564, y: 156, radius: 30, kind: 'valley' },
  { id: 'cobre', nameKey: 'zone.cobre', zone: 'cobre', x: 816, y: 338, radius: 30, kind: 'canyon' },
  // Revealed when the valley's anchor breaks (end of arc 1); arc 2 opens them.
  {
    id: 'marsh',
    nameKey: 'zone.marsh',
    zone: 'marsh',
    x: 300,
    y: 430,
    radius: 30,
    kind: 'valley',
    revealFlag: 'anchorBroken',
  },
  {
    id: 'rift',
    nameKey: 'zone.rift',
    zone: 'rift',
    x: 480,
    y: 300,
    radius: 26,
    kind: 'canyon',
    revealFlag: 'anchorBroken',
  },
  // The slope under the tower, where the Mano Gris lays siege (chapter 6).
  {
    id: 'cliffs',
    nameKey: 'zone.cliffs',
    zone: 'cliffs',
    x: 214,
    y: 206,
    radius: 22,
    kind: 'valley',
    revealFlag: 'siegeStarted',
  },
];
