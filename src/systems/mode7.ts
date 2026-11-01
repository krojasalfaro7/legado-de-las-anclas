/**
 * Perspective ("Mode 7") projection for the continent map: a camera above the ground looking
 * north (toward -y), like flying behind the character. Pure math so it can be tested; the
 * renderer samples the ground row by row with `rowDepth` and places billboards with `project`.
 */
export interface Mode7Camera {
  /** Camera position on the map (it sits `behind` px south of the flyer). */
  x: number;
  y: number;
  /** Height above the ground, in map px. */
  height: number;
  /** Focal length in screen px. */
  focal: number;
  /** Screen row of the horizon. */
  horizon: number;
  /** Screen width (the view is centered on it). */
  width: number;
}

/** Ground distance seen by screen row `row` (must be below the horizon). */
export function rowDepth(cam: Mode7Camera, row: number): number {
  return (cam.height * cam.focal) / (row - cam.horizon);
}

/** Map x seen at screen column `col` on a row at depth `z`. */
export function columnX(cam: Mode7Camera, col: number, z: number): number {
  return cam.x + ((col - cam.width / 2) * z) / cam.focal;
}

export interface Projected {
  sx: number;
  sy: number;
  /** Screen px per map px at that depth (billboard scale). */
  scale: number;
  depth: number;
}

/**
 * Screen position of a map point `altitude` px above the ground, or null when it's behind the
 * camera (closer than `near`).
 */
export function project(
  cam: Mode7Camera,
  x: number,
  y: number,
  altitude = 0,
  near = 4,
): Projected | null {
  const depth = cam.y - y;
  if (depth < near) return null;
  const scale = cam.focal / depth;
  return {
    sx: cam.width / 2 + (x - cam.x) * scale,
    sy: cam.horizon + (cam.height - altitude) * scale,
    scale,
    depth,
  };
}

/** Altitude limits and climb rate for the continent flight (map px, px/s). */
export interface AltitudeTuning {
  max: number;
  /** Lowest hover where there's nowhere to land. */
  hover: number;
  climbPerSec: number;
}

/**
 * One step of the map flight's altitude: `dir` 1 climbs, -1 descends. Descending to the
 * ground is only possible over a landing spot, and touching it there means landing.
 */
export function stepAltitude(
  alt: number,
  dir: -1 | 0 | 1,
  canLand: boolean,
  dtSec: number,
  t: AltitudeTuning,
): { alt: number; landed: boolean } {
  const floor = canLand ? 0 : t.hover;
  const rise = t.climbPerSec * dtSec;
  let next = Math.min(t.max, alt + dir * rise);
  // Leaving a landing spot low: ease back up to the hover floor instead of snapping.
  if (next < floor) next = alt < floor ? Math.min(floor, alt + rise) : floor;
  return { alt: next, landed: canLand && dir < 0 && next <= 0 };
}

/**
 * Camera for a flyer `alt` px above the ground: it rises with the flyer and pulls back, so the
 * ground shrinks while the flyer's shadow (the landing point) stays on screen.
 */
export function flightCamera(
  alt: number,
  base: { height: number; behind: number; horizon: number },
): { height: number; behind: number; horizon: number } {
  return {
    height: base.height + alt,
    behind: base.behind + alt * 0.9,
    horizon: Math.round(base.horizon - alt * 0.2),
  };
}
