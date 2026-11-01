/**
 * Pixel grids for every generated actor look. Pure (no Phaser): the game paints these into
 * canvas textures and `scripts/gen-sprite-templates.ts` draws them as template ghosts.
 */
// Explicit `.ts` extensions: the asset scripts import this module with plain Node.

import { type BeastLook, beastFrame } from './beastFrames.ts';
import { golemFrame } from './golemFrames.ts';
import { type Grid, type HumanoidLook, humanoidFrame, upscale } from './humanoid.ts';
import {
  type Facing,
  FRAME_SIZES,
  type FrameSize,
  type Pose,
  type SpriteClass,
} from './spriteSpec.ts';

/** Shared look descriptor for any generated actor sheet. */
export type ActorLook =
  | ({ kind: 'humanoid' } & HumanoidLook)
  /** A big humanoid (brutes, heavies): the same art drawn at 1.5x. */
  | ({ kind: 'brute' } & HumanoidLook)
  | { kind: 'golem'; body: number; moss: number; crystal: number; giant?: boolean }
  /** Crabs, hounds and wisps (see beastFrames.ts); humanoid-sized frame. */
  | ({ kind: 'beast' } & BeastLook);

export function spriteClassOf(look: ActorLook): SpriteClass {
  if (look.kind === 'golem' || look.kind === 'beast') {
    if (look.giant) return 'giant';
    if (look.kind === 'golem') return 'large';
  }
  return look.kind === 'brute' ? 'heavy' : 'humanoid';
}

export function frameSizeOf(look: ActorLook): FrameSize {
  return FRAME_SIZES[spriteClassOf(look)];
}

function mirrorGrid(g: Grid): Grid {
  return g.map((row) => [...row].reverse());
}

/** The generated frame for a look; sized `frameSizeOf(look)`, `null` = transparent. */
export function actorFrame(look: ActorLook, facing: Facing, pose: Pose): Grid {
  if (look.kind === 'humanoid') return humanoidFrame(look, facing, pose);
  if (look.kind === 'beast')
    return look.giant
      ? upscale(beastFrame(look, facing, pose), FRAME_SIZES.giant, 3, 1)
      : beastFrame(look, facing, pose);
  if (look.kind === 'brute')
    return upscale(humanoidFrame(look, facing, pose), FRAME_SIZES.heavy, 3, 2);
  const size = look.giant ? FRAME_SIZES.giant : FRAME_SIZES.large;
  return facing === 'right'
    ? mirrorGrid(golemFrame(look, 'left', pose, size))
    : golemFrame(look, facing, pose, size);
}
