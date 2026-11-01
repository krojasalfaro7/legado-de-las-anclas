/**
 * Pixel grids for every generated actor look. Pure (no Phaser): the game paints these into
 * canvas textures and `scripts/gen-sprite-templates.ts` draws them as template ghosts.
 */
// Explicit `.ts` extensions: the asset scripts import this module with plain Node.

import { type BeastLook, beastFrame } from './beastFrames.ts';
import { golemFrame } from './golemFrames.ts';
import { type Grid, type HumanoidLook, humanoidFrame, newGrid, upscale } from './humanoid.ts';
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

/**
 * Triples a finished frame with Scale3x (AdvMAME3x), which rounds diagonals and curves instead of
 * leaving 3 px stairs, and places it like `upscale` does: centered, feet on the bottom row.
 */
function scale3x(g: Grid, frame: FrameSize): Grid {
  const h = g.length;
  const w = g[0]?.length ?? 0;
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h ? null : (g[y]?.[x] ?? null);
  const ox = Math.floor((frame.w - w * 3) / 2);
  const oy = frame.h - 1 - (h - 1) * 3;
  const out = newGrid(frame.w, frame.h);
  const put = (x: number, y: number, c: number | null) => {
    const row = out[y];
    if (row && x >= 0 && x < frame.w) row[x] = c;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [A, B, C] = [at(x - 1, y - 1), at(x, y - 1), at(x + 1, y - 1)];
      const [D, E, F] = [at(x - 1, y), at(x, y), at(x + 1, y)];
      const [G, H, I] = [at(x - 1, y + 1), at(x, y + 1), at(x + 1, y + 1)];
      const db = D === B && D !== H && B !== F;
      const bf = B === F && B !== D && F !== H;
      const dh = D === H && D !== B && H !== F;
      const hf = H === F && D !== H && B !== F;
      const cells = [
        db ? D : E,
        (db && E !== C) || (bf && E !== A) ? B : E,
        bf ? F : E,
        (db && E !== G) || (dh && E !== A) ? D : E,
        E,
        (bf && E !== I) || (hf && E !== C) ? F : E,
        dh ? D : E,
        (dh && E !== I) || (hf && E !== G) ? H : E,
        hf ? F : E,
      ];
      cells.forEach((c, i) => {
        put(ox + x * 3 + (i % 3), oy + y * 3 + Math.floor(i / 3), c);
      });
    }
  return out;
}

function mirrorGrid(g: Grid): Grid {
  return g.map((row) => [...row].reverse());
}

/** The generated frame for a look; sized `frameSizeOf(look)`, `null` = transparent. */
export function actorFrame(look: ActorLook, facing: Facing, pose: Pose): Grid {
  if (look.kind === 'humanoid') return humanoidFrame(look, facing, pose);
  if (look.kind === 'beast')
    return look.giant
      ? scale3x(beastFrame(look, facing, pose), FRAME_SIZES.giant)
      : beastFrame(look, facing, pose);
  if (look.kind === 'brute')
    return upscale(humanoidFrame(look, facing, pose), FRAME_SIZES.heavy, 3, 2);
  const size = look.giant ? FRAME_SIZES.giant : FRAME_SIZES.large;
  return facing === 'right'
    ? mirrorGrid(golemFrame(look, 'left', pose, size))
    : golemFrame(look, facing, pose, size);
}
