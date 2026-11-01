/**
 * Pixel grids for every generated actor look. Pure (no Phaser): the game paints these into
 * canvas textures and `scripts/gen-sprite-templates.ts` draws them as template ghosts.
 */
// Explicit `.ts` extensions: the asset scripts import this module with plain Node.

import { type BeastLook, beastFrame } from './beastFrames.ts';
import {
  fill,
  finishGrid,
  type Grid,
  type HumanoidLook,
  humanoidFrame,
  newGrid,
  tone,
  upscale,
} from './humanoid.ts';
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

const GOLEM_PAINT_W = 24;
const GOLEM_PAINT_H = 20;

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

/** Ballast golem: a walking block of stone with moss on top and an anchor shard in its back. */
function golemFrame(look: Extract<ActorLook, { kind: 'golem' }>, facing: Facing, pose: Pose): Grid {
  const g = newGrid(GOLEM_PAINT_W, GOLEM_PAINT_H);
  const side = facing === 'left' || facing === 'right';
  const dy = pose === 'idle2' || pose === 'walk2' || pose === 'walk4' || pose === 'attack' ? 1 : 0;
  const lift = (p: Pose) => (pose === p ? 1 : 0);
  const legs = tone(look.body, 0.8);
  if (side) {
    fill(g, 8, 15 - lift('walk1'), 4, 4, legs);
    fill(g, 14, 15 - lift('walk3'), 4, 4, legs);
    fill(g, 6, 4 + dy, 14, 11, look.body);
    fill(g, 7, 3 + dy, 12, 1, look.body);
    fill(g, 8, 3 + dy, 9, 2, look.moss);
    fill(g, 16, 5 + dy, 3, 4, look.crystal);
    fill(g, 2, 6 + dy, 6, 6, tone(look.body, 1.08));
    const reach = pose === 'attack' || pose === 'attack2' ? -3 : 0;
    fill(g, 9 + reach, 9 + dy, 4, 5, tone(look.body, 0.92));
    fill(g, 8 + reach, 13 + dy, 5, 3, tone(look.body, 0.92));
  } else {
    fill(g, 6, 15 - lift('walk1'), 4, 4, legs);
    fill(g, 14, 15 - lift('walk3'), 4, 4, legs);
    fill(g, 4, 4 + dy, 16, 11, look.body);
    fill(g, 5, 3 + dy, 14, 1, look.body);
    fill(g, 6, 3 + dy, 12, 2, look.moss);
    fill(g, 0, 8 + dy, 4, 7, tone(look.body, 0.92));
    fill(g, 20, 8 + dy, 4, 7, tone(look.body, 0.92));
    if (facing === 'up') {
      fill(g, 10, 5 + dy, 4, 6, look.crystal);
    } else {
      fill(g, 9, 6 + dy, 6, 5, tone(look.body, 1.08));
    }
  }
  if (facing !== 'up' && pose !== 'hurt') {
    // Eyes glow with the same anchor light as the crystal (flat, so never shaded).
    if (side) {
      fill(g, 3, 8 + dy, 1, 2, look.crystal);
    } else {
      fill(g, 10, 8 + dy, 1, 2, look.crystal);
      fill(g, 13, 8 + dy, 1, 2, look.crystal);
    }
  }
  // Doubled: golems stand about 1.4 times a person's height (reference: heavies ~1.5x).
  const size = look.giant ? FRAME_SIZES.giant : FRAME_SIZES.large;
  return finishGrid(upscale(g, size, look.giant ? 3 : 2, 1), {
    flat: [look.crystal],
    castFrom: [look.moss],
    castOnto: [look.body],
  });
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
  return facing === 'right'
    ? mirrorGrid(golemFrame(look, 'left', pose))
    : golemFrame(look, facing, pose);
}
