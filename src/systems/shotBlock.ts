/**
 * What stops blasts and beams (pure). They travel over a ground point and are drawn `lift` px
 * above it. Walls and trees (anything that also stops flight) stop every blast; waist-high props
 * (rocks, crystals, crates, ore) only stop blasts fired from the ground: one fired in flight
 * passes over them, as the flyer does. Low tiles (water, bushes, cliffs, chasms) never stop
 * them. Props stop a blast only where they visibly stand (a trunk, a crystal's base), inset
 * from the tile, so a blast grazing past one doesn't hit thin air.
 */
export const SHOT_FOOTPRINT_INSET: Readonly<Record<string, { x: number; y: number }>> = {
  // Tall and narrow: the canopy covers the tile's depth, the trunk only its middle.
  tree: { x: 4, y: 0 },
  pillar: { x: 2, y: 0 },
  'canyon-pillar': { x: 2, y: 0 },
  boulder: { x: 2, y: 2 },
  crystal: { x: 3, y: 3 },
  'copper-ore': { x: 3, y: 3 },
  scrap: { x: 3, y: 3 },
  crate: { x: 2, y: 2 },
  anchor: { x: 1, y: 1 },
  'anchor-broken': { x: 2, y: 2 },
};

/** Blasts drawn at least this high clear waist-high props (a grounded blast flies at 12). */
export const PROP_CLEARANCE = 18;

export interface ShotTile {
  name?: string;
  /** Stops flight too (walls, trees, pillars): no blast clears it. */
  tall: boolean;
}

/** Does a blast drawn `lift` px up, at (lx, ly) inside a `size` px tile, hit that tile? */
export function tileStopsShot(
  tile: ShotTile,
  lx: number,
  ly: number,
  size: number,
  lift: number,
): boolean {
  if (!tile.tall && lift >= PROP_CLEARANCE) return false;
  const inset = (tile.name && SHOT_FOOTPRINT_INSET[tile.name]) || { x: 0, y: 0 };
  return lx >= inset.x && lx < size - inset.x && ly >= inset.y && ly < size - inset.y;
}

/** Distance along a ray to the first blocked sample (step px), or `maxLen` if none. */
export function traceRay(
  origin: { x: number; y: number },
  angle: number,
  maxLen: number,
  step: number,
  blocked: (x: number, y: number) => boolean,
): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let d = 0; d < maxLen; d += step) {
    if (blocked(origin.x + dx * d, origin.y + dy * d)) return d;
  }
  return maxLen;
}
