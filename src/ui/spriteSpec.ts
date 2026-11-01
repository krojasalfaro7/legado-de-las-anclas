/**
 * Sprite sheet format shared by the game, the generated sheets and the asset scripts
 * (`sprites:check`, `sprites:templates`). Documented for artists in docs/SPRITES.md.
 *
 * This module must not import anything: the scripts load it with plain Node.
 */
export type Facing = 'down' | 'left' | 'right' | 'up';
export type Pose =
  | 'idle'
  | 'idle2'
  | 'walk1'
  | 'walk2'
  | 'walk3'
  | 'walk4'
  | 'attack'
  | 'attack2'
  | 'attack3'
  | 'cast'
  | 'block'
  | 'hurt'
  | 'fly'
  | 'fly2';

/** Sheet rows, top to bottom. */
export const FACINGS: readonly Facing[] = ['down', 'left', 'right', 'up'];
/** Sheet columns, left to right. */
export const POSES: readonly Pose[] = [
  'idle',
  'idle2',
  'walk1',
  'walk2',
  'walk3',
  'walk4',
  'attack',
  'attack2',
  'attack3',
  'cast',
  'block',
  'hurt',
  'fly',
  'fly2',
];

/** `heavy`: big humanoids, the humanoid art at 1.5x (reference: heavies ~1.5 characters tall). */
/** `giant`: boss golems drawn at 3x (colossi that fill an arena). */
export type SpriteClass = 'humanoid' | 'large' | 'heavy' | 'giant';

export interface FrameSize {
  w: number;
  h: number;
}

export const FRAME_SIZES: Record<SpriteClass, FrameSize> = {
  humanoid: { w: 24, h: 32 },
  large: { w: 48, h: 42 },
  heavy: { w: 36, h: 48 },
  giant: { w: 72, h: 63 },
};

/** Opaque colors per sheet; with transparency that is one 16-color GBA palette. */
export const MAX_COLORS = 15;

/**
 * Pivot: grounded poses touch the frame's last row (the outline under the feet), centered
 * horizontally. The physics body is a feet box centered horizontally whose bottom edge is
 * `FOOT_PAD` px above the frame bottom, and the engine draws the ground shadow there.
 */
export const FOOT_PAD = 1;

/** Physics feet box per class; narrow so actors fit one-tile corridors. */
export const FEET_BOX: Record<SpriteClass, FrameSize> = {
  humanoid: { w: 10, h: 7 },
  large: { w: 26, h: 10 },
  heavy: { w: 16, h: 9 },
  giant: { w: 40, h: 14 },
};

/** Poses whose lowest pixel must be on the frame's last row (the others may lift or crouch). */
export const GROUNDED_POSES: readonly Pose[] = ['idle', 'idle2', 'walk2', 'walk4', 'block'];

export function frameIndex(facing: Facing, pose: Pose): number {
  return FACINGS.indexOf(facing) * POSES.length + POSES.indexOf(pose);
}

export function sheetSize(frame: FrameSize): FrameSize {
  return { w: frame.w * POSES.length, h: frame.h * FACINGS.length };
}

/**
 * A channel is 15-bit if it is a 5-bit value either shifted (`c << 3`, what most editors
 * write) or expanded (`c << 3 | c >> 2`, what the generated sheets use).
 */
export function is15BitChannel(v: number): boolean {
  return (v & 7) === 0 || (v & 7) === v >> 5;
}

/** Hand-drawn sheets found by `sprites:check`; only valid ones are listed. */
export interface SpriteManifest {
  sheets: Record<string, { file: string; frameWidth: number; frameHeight: number }>;
}

export const SPRITE_DIR = 'assets/sprites';
export const SPRITE_MANIFEST = `${SPRITE_DIR}/manifest.json`;

/** Texture keys of actor sheets; a hand-drawn sheet is `<key>.png` in `SPRITE_DIR`. */
export const SHEET_KEYS = {
  character: (id: string, transformationId?: string): string =>
    transformationId ? `actor-${id}-${transformationId}` : `actor-${id}`,
  npc: (id: string): string => `actor-npc-${id}`,
  /** `phase` is a boss phase that transforms (see BossPhase.look). */
  enemy: (id: string, phase?: number): string =>
    phase === undefined ? `actor-enemy-${id}` : `actor-enemy-${id}-p${phase}`,
};
