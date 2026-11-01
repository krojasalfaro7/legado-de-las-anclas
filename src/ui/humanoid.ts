/**
 * Procedural humanoid sprites. Pure pixel logic (no Phaser) so hand-drawn sheets can replace
 * them without touching entities, and so the asset scripts can draw template ghosts.
 *
 * Bodies are drawn at the frame's own resolution (24x32, `spriteSpec.ts`) from a skeleton per
 * pose, so arms and legs read (a jab is a fully stretched arm, a kick a level leg); heads keep
 * the 16x24 hair/face shapes enlarged x4/3. Then `finishGrid` adds top-left lighting, a colored
 * outline and the 15-bit snap.
 */
// Explicit `.ts` extensions: the asset scripts import this module with plain Node.
import {
  FACINGS,
  type Facing,
  FRAME_SIZES,
  type FrameSize,
  frameIndex,
  POSES,
  type Pose,
} from './spriteSpec.ts';

export { FACINGS, type Facing, frameIndex, POSES, type Pose };

export type HairStyle = 'ponytail' | 'shaggy' | 'bun' | 'mohawk' | 'helmet' | 'tufts' | 'bald';

/** Size of the paint grid; the frame itself is `FRAME_SIZES.humanoid`. */
export const PAINT_W = 16;
export const PAINT_H = 24;

export interface HumanoidLook {
  skin: number;
  hair: number;
  hairStyle: HairStyle;
  outfit: number;
  pants?: number;
  /** Cuffs, collar and belt. */
  accent: number;
  boots: number;
  /** Helmet visor color. */
  detail?: number;
  /** Long scarf that trails behind when moving or flying. */
  scarf?: number;
  /** Single mechanical wing on the back. */
  wing?: number;
  /** Glowing lines on the skin and eyes (transformations). */
  glow?: number;
  /** Large round eyes with a highlight. */
  bigEyes?: boolean;
  /** Body type (default `average`): see BUILDS. */
  build?: Build;
}

/**
 * Body types, so the cast doesn't share one silhouette (user feedback): `slim` stands taller
 * with long thin limbs, `broad` has open shoulders and hips and thick arms, `small` is a
 * shorter body (kids, the youngest warden).
 */
export type Build = 'average' | 'slim' | 'broad' | 'small';

interface BuildSpec {
  /** Front/back views: shoulders and hips move out (+) or in (-) on each side. */
  shoulder: number;
  hip: number;
  /** Upper body and head move down (+) or up (-): shorter or longer legs. */
  bodyDy: number;
  /** Hands reach this much further along the forearm (longer arms). */
  reach: number;
  armW: 2 | 3;
  legW: 2 | 3;
  /** Torso width change on each side. */
  torso: number;
}

const BUILDS: Record<Build, BuildSpec> = {
  average: { shoulder: 0, hip: 0, bodyDy: 0, reach: 1, armW: 2, legW: 3, torso: 0 },
  slim: { shoulder: 0, hip: 0, bodyDy: -1, reach: 2, armW: 2, legW: 2, torso: -1 },
  broad: { shoulder: 1, hip: 1, bodyDy: 0, reach: 1, armW: 3, legW: 3, torso: 1 },
  small: { shoulder: -1, hip: 0, bodyDy: 2, reach: 0, armW: 2, legW: 2, torso: -1 },
};

export type Grid = (number | null)[][];
type View = 'front' | 'side' | 'back';

const EYE = 0x181820;
const EYE_WHITE = 0xf8f8f8;

// --- Grid helpers ------------------------------------------------------------------

export function newGrid(w = PAINT_W, h = PAINT_H): Grid {
  return Array.from({ length: h }, () => Array<number | null>(w).fill(null));
}

export function fill(g: Grid, x: number, y: number, w: number, h: number, c: number): void {
  for (let yy = y; yy < y + h; yy++) {
    const row = g[yy];
    if (!row) continue;
    for (let xx = x; xx < x + w; xx++) if (xx >= 0 && xx < row.length) row[xx] = c;
  }
}

function pattern(g: Grid, rows: readonly string[], dx: number, dy: number, c: number): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') fill(g, x + dx, y + dy, 1, 1, c);
  });
}

/**
 * Enlarges a paint grid by num/den (x4/3 by default; nearest neighbor, integer math) into `frame`, centered
 * horizontally and with the source's last row on the frame's last row.
 */
export function upscale(g: Grid, frame: FrameSize, num = 4, den = 3): Grid {
  const sw = g[0]?.length ?? 0;
  const ox = Math.floor((frame.w * den - sw * num) / (2 * den));
  const oy = frame.h - 1 - Math.ceil(((g.length - 1) * num) / den);
  const out = newGrid(frame.w, frame.h);
  out.forEach((row, ty) => {
    const src = g[Math.floor(((ty - oy) * den) / num)];
    for (let tx = 0; tx < frame.w; tx++) {
      const sx = Math.floor(((tx - ox) * den) / num);
      row[tx] = sx >= 0 ? (src?.[sx] ?? null) : null;
    }
  });
  return out;
}

/** Multiplies each channel; f < 1 darkens, f > 1 lightens. */
export function tone(c: number, f: number): number {
  const ch = (shift: number) => Math.max(0, Math.min(255, Math.round(((c >> shift) & 0xff) * f)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Snaps to 15-bit color (5 bits per channel). */
export function to15(c: number): number {
  const ch = (shift: number) => {
    const v = (c >> shift) & 0xf8;
    return v | (v >> 5);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export interface FinishOptions {
  /** Colors that keep their exact value (eyes, glow): no shading. */
  flat?: readonly number[];
  /** Pixels of `onto` colors right under a `from` color get shaded (hair over face). */
  castFrom?: readonly number[];
  castOnto?: readonly number[];
}

/** Lighting from the top-left, colored outline and 15-bit snap. */
export function finishGrid(g: Grid, opts: FinishOptions = {}): Grid {
  const h = g.length;
  const w = g[0]?.length ?? 0;
  const at = (x: number, y: number): number | null => g[y]?.[x] ?? null;
  const flat = new Set(opts.flat ?? []);
  const castFrom = new Set(opts.castFrom ?? []);
  const castOnto = new Set(opts.castOnto ?? []);
  const out = newGrid(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      if (c === null) {
        const n = at(x, y + 1) ?? at(x, y - 1) ?? at(x - 1, y) ?? at(x + 1, y);
        if (n !== null) fill(out, x, y, 1, 1, to15(tone(n, 0.32)));
        continue;
      }
      let v = c;
      if (!flat.has(c)) {
        const up = at(x, y - 1);
        if (at(x, y + 1) === null || at(x + 1, y) === null) v = tone(c, 0.76);
        else if (up !== null && castFrom.has(up) && castOnto.has(c)) v = tone(c, 0.8);
        else if (up === null || at(x - 1, y) === null) v = tone(c, 1.16);
      }
      fill(out, x, y, 1, 1, to15(v));
    }
  }
  return out;
}

// --- Hair --------------------------------------------------------------------------

const HAIR: Record<HairStyle, Record<View, readonly string[]>> = {
  ponytail: {
    front: [
      '................',
      '.......##.......',
      '....########....',
      '...##########...',
      '...##########...',
      '...##.####.##...',
      '...#........#...',
      '...#........#...',
    ],
    side: [
      '................',
      '................',
      '.....######.....',
      '....#########...',
      '....##########..',
      '.....#.#####.##.',
      '........###..##.',
      '........##....#.',
      '........#.......',
    ],
    back: [
      '................',
      '.......##.......',
      '....########....',
      '...##########...',
      '...##########...',
      '...##########...',
      '....########....',
      '......####......',
      '.......##.......',
      '.......##.......',
      '.......#........',
    ],
  },
  shaggy: {
    front: [
      '................',
      '................',
      '....########....',
      '...##########...',
      '..############..',
      '..##.#.##.#.##..',
      '..#..........#..',
      '...#........#...',
    ],
    side: [
      '................',
      '................',
      '.....######.....',
      '....#########...',
      '...###########..',
      '....#.########..',
      '........#####...',
      '........####.#..',
      '.........##.....',
    ],
    back: [
      '................',
      '................',
      '....########....',
      '...##########...',
      '..############..',
      '..############..',
      '..############..',
      '...##########...',
      '...#.######.#...',
      '.....#.##.#.....',
    ],
  },
  bun: {
    front: [
      '.......##.......',
      '......####......',
      '....########....',
      '...##########...',
      '...##########...',
      '...#........#...',
    ],
    side: [
      '................',
      '.........###....',
      '.....#######....',
      '....#########...',
      '....##########..',
      '.....#..######..',
      '........#####...',
      '.........###....',
    ],
    back: [
      '......####......',
      '......####......',
      '....########....',
      '...##########...',
      '...##########...',
      '...##########...',
      '....########....',
      '.....######.....',
    ],
  },
  mohawk: {
    front: ['.......##.......', '......####......', '......####......', '.......##.......'],
    side: ['................', '.....#####......', '....#######.....', '.....#####......'],
    back: [
      '.......##.......',
      '......####......',
      '......####......',
      '......####......',
      '.......##.......',
      '.......##.......',
    ],
  },
  helmet: {
    front: [
      '................',
      '................',
      '....########....',
      '...##########...',
      '...##########...',
      '...##########...',
    ],
    side: [
      '................',
      '................',
      '.....######.....',
      '....########....',
      '...#########....',
      '...##########...',
      '.........####...',
    ],
    back: [
      '................',
      '................',
      '....########....',
      '...##########...',
      '...##########...',
      '...##########...',
      '...##########...',
      '....########....',
    ],
  },
  tufts: {
    front: [
      '...#........#...',
      '...##......##...',
      '...##########...',
      '...##########...',
      '...##########...',
      '...#........#...',
    ],
    side: [
      '.........#......',
      '.........##.....',
      '.....#######....',
      '....#########...',
      '....##########..',
      '.....#..######..',
      '........#####...',
    ],
    back: [
      '...#........#...',
      '...##......##...',
      '...##########...',
      '...##########...',
      '...##########...',
      '...##########...',
      '...##########...',
      '....########....',
    ],
  },
  bald: { front: [], side: [], back: [] },
};

// --- Head ---------------------------------------------------------------------

function head(g: Grid, look: HumanoidLook, view: View, pose: Pose, dx: number, dy: number): void {
  const k = look.skin;
  if (view === 'side') {
    fill(g, 4 + dx, 3 + dy, 6, 7, k);
    fill(g, 3 + dx, 7 + dy, 1, 1, k);
  } else {
    fill(g, 4, 3 + dy, 8, 7, k);
    fill(g, 3, 6 + dy, 1, 2, k);
    fill(g, 12, 6 + dy, 1, 2, k);
  }
  const hair = HAIR[look.hairStyle][view];
  pattern(g, hair, view === 'side' ? dx : 0, dy, look.hair);
  if (look.hairStyle === 'helmet' && look.detail !== undefined) {
    if (view === 'front') fill(g, 5, 6 + dy, 6, 1, look.detail);
    if (view === 'side') fill(g, 3 + dx, 6 + dy, 4, 1, look.detail);
  }
  if (view === 'back' || look.hairStyle === 'helmet') return;
  const eye = look.glow ?? EYE;
  const closed = pose === 'hurt';
  if (view === 'front') {
    for (const ex of look.bigEyes ? [5, 9] : [6, 9]) {
      if (closed) {
        fill(g, ex, 7 + dy, 2, 1, EYE);
      } else if (look.bigEyes) {
        fill(g, ex, 6 + dy, 2, 2, eye);
        fill(g, ex, 6 + dy, 1, 1, EYE_WHITE);
      } else {
        fill(g, ex, 6 + dy, 1, 2, eye);
      }
    }
  } else if (closed) {
    fill(g, 4 + dx, 7 + dy, 2, 1, EYE);
  } else {
    fill(g, 4 + dx, 6 + dy, 1, 2, eye);
    if (look.bigEyes) fill(g, 5 + dx, 6 + dy, 1, 1, EYE_WHITE);
  }
}

// --- Skeleton --------------------------------------------------------------------
//
// Bodies are drawn at the frame's own resolution (24x32) from a small skeleton per pose:
// shoulder/elbow/hand and hip/knee/ankle. Limbs are thick lines, and a limb drawn over the
// body gets a dark contour, so an arm reads in front of the chest the way GBA sprites do.
// The head keeps the 16x24 paint style (hair shapes, eyes) and is enlarged on its own.

type P = readonly [number, number];
/** Root, middle and end joint: shoulder-elbow-hand or hip-knee-ankle. */
type Limb = readonly [P, P, P];
type Hand = 'small' | 'fist' | 'big' | 'open';
type Boot = 'stand' | 'kick' | 'trail' | 'point';

interface Rig {
  /** Upper-body shift: x toward the back (side view, + = backward), y down. */
  lean: number;
  bob: number;
  headDx: number;
  headDy: number;
  /** Side view: near (viewer side) and far limbs. Front/back: screen-left and screen-right. */
  arm1: Limb;
  arm2: Limb;
  leg1: Limb;
  leg2: Limb;
  hand1: Hand;
  hand2: Hand;
  boot1: Boot;
  boot2: Boot;
  /** Side view: the far arm crosses in front of the body (a cross punch). */
  farArmFront?: boolean;
}

const isFlying = (pose: Pose) => pose === 'fly' || pose === 'fly2';

const FRONT_BASE: Rig = {
  lean: 0,
  bob: 0,
  headDx: 0,
  headDy: 0,
  arm1: [
    [6, 13],
    [5, 16],
    [5, 19],
  ],
  arm2: [
    [16, 13],
    [17, 16],
    [17, 19],
  ],
  leg1: [
    [9, 21],
    [9, 24],
    [9, 27],
  ],
  leg2: [
    [14, 21],
    [14, 24],
    [14, 27],
  ],
  hand1: 'small',
  hand2: 'small',
  boot1: 'stand',
  boot2: 'stand',
};

const SIDE_BASE: Rig = {
  ...FRONT_BASE,
  arm1: [
    [10, 14],
    [10, 17],
    [10, 19],
  ],
  arm2: [
    [12, 14],
    [13, 17],
    [13, 19],
  ],
  leg1: [
    [9, 21],
    [9, 24],
    [9, 27],
  ],
  leg2: [
    [12, 21],
    [12, 24],
    [12, 27],
  ],
};

function frontRig(pose: Pose, back: boolean): Rig {
  const r = FRONT_BASE;
  switch (pose) {
    case 'idle2':
    case 'walk2':
    case 'walk4':
      return { ...r, bob: 1 };
    case 'walk1':
      return {
        ...r,
        arm1: [r.arm1[0], [5, 15], [6, 17]],
        arm2: [r.arm2[0], [17, 16], [17, 20]],
        leg1: [r.leg1[0], [9, 23], [9, 26]],
      };
    case 'walk3':
      return {
        ...r,
        arm1: [r.arm1[0], [5, 16], [5, 20]],
        arm2: [r.arm2[0], [17, 15], [16, 17]],
        leg2: [r.leg2[0], [14, 23], [14, 26]],
      };
    case 'attack':
    case 'attack2': {
      // Front: the fist comes at the camera, big over the chest. Back: it goes away, raised.
      const right = pose === 'attack';
      const punch: Limb = back
        ? right
          ? [r.arm2[0], [18, 12], [17, 9]]
          : [r.arm1[0], [4, 12], [5, 9]]
        : right
          ? [r.arm2[0], [17, 16], [14, 17]]
          : [r.arm1[0], [5, 16], [8, 17]];
      const guard: Limb = right ? [r.arm1[0], [5, 16], [8, 15]] : [r.arm2[0], [17, 16], [15, 15]];
      const stance = {
        leg1: [r.leg1[0], [8, 24], [8, 27]] as Limb,
        leg2: [r.leg2[0], [15, 24], [15, 27]] as Limb,
      };
      const fist: Hand = back ? 'fist' : 'big';
      return right
        ? { ...r, ...stance, arm1: guard, arm2: punch, hand2: fist }
        : { ...r, ...stance, arm1: punch, arm2: guard, hand1: fist };
    }
    case 'attack3':
      // Side kick to screen-right, arms up in guard.
      return {
        ...r,
        lean: -1,
        arm1: [r.arm1[0], [5, 15], [7, 13]],
        arm2: [r.arm2[0], [18, 14], [17, 11]],
        leg2: [r.leg2[0], [18, 21], [21, 20]],
        boot2: 'kick',
        hand1: 'fist',
        hand2: 'fist',
      };
    case 'cast':
      return {
        ...r,
        arm1: [r.arm1[0], [6, 17], [10, 17]],
        arm2: [r.arm2[0], [17, 17], [13, 17]],
        hand1: 'open',
        hand2: 'open',
      };
    case 'block':
      // Forearms crossed in front of the face.
      return {
        ...r,
        arm1: [r.arm1[0], [6, 18], [14, 12]],
        arm2: [r.arm2[0], [17, 18], [9, 12]],
        leg1: [r.leg1[0], [8, 24], [8, 27]],
        leg2: [r.leg2[0], [15, 24], [15, 27]],
        hand1: 'fist',
        hand2: 'fist',
      };
    case 'hurt':
      return {
        ...r,
        bob: -1,
        arm1: [r.arm1[0], [4, 11], [2, 9]],
        arm2: [r.arm2[0], [18, 11], [20, 9]],
        leg1: [r.leg1[0], [8, 24], [8, 27]],
        leg2: [r.leg2[0], [15, 24], [15, 27]],
      };
    case 'cheer':
      // Both arms up in a V beside the head, hands at its crown (the item is drawn above).
      return {
        ...r,
        arm1: [r.arm1[0], [4, 10], [6, 4]],
        arm2: [r.arm2[0], [19, 10], [17, 4]],
        leg1: [r.leg1[0], [8, 24], [8, 27]],
        leg2: [r.leg2[0], [15, 24], [15, 27]],
        hand1: 'open',
        hand2: 'open',
      };
    case 'fly':
    case 'fly2':
      // Legs together, toes pointed down, arms a little out.
      return {
        ...r,
        bob: pose === 'fly2' ? 1 : 0,
        arm1: [r.arm1[0], [4, 16], [3, 19]],
        arm2: [r.arm2[0], [18, 16], [19, 19]],
        leg1: [
          [10, 21],
          [10, 24],
          [10, 26],
        ],
        leg2: [
          [13, 21],
          [13, 24],
          [13, 26],
        ],
        boot1: 'point',
        boot2: 'point',
      };
    default:
      return r;
  }
}

/** Facing left; `right` is the mirror image. */
function sideRig(pose: Pose): Rig {
  const r = SIDE_BASE;
  const stance = {
    leg1: [r.leg1[0], [8, 24], [5, 27]] as Limb,
    leg2: [r.leg2[0], [13, 24], [15, 27]] as Limb,
  };
  switch (pose) {
    case 'idle2':
      return { ...r, bob: 1 };
    case 'walk1':
      return {
        ...r,
        ...stance,
        arm1: [r.arm1[0], [11, 17], [12, 19]],
        arm2: [r.arm2[0], [11, 17], [9, 18]],
      };
    case 'walk2':
      return { ...r, bob: 1, leg2: [r.leg2[0], [12, 24], [11, 26]] };
    case 'walk3':
      return {
        ...r,
        leg1: [r.leg1[0], [10, 24], [12, 27]],
        leg2: [r.leg2[0], [9, 24], [7, 27]],
        arm1: [r.arm1[0], [9, 17], [8, 18]],
        arm2: [r.arm2[0], [14, 17], [15, 19]],
      };
    case 'walk4':
      return { ...r, bob: 1, leg1: [r.leg1[0], [9, 24], [10, 26]] };
    case 'attack':
      // Jab: the near arm snaps out to full length.
      return {
        ...r,
        ...stance,
        lean: -1,
        arm1: [r.arm1[0], [6, 14], [2, 14]],
        arm2: [r.arm2[0], [13, 17], [10, 16]],
        hand1: 'fist',
      };
    case 'attack2':
      // Cross: the far arm drives through in front of the body, the near one pulls back.
      return {
        ...r,
        ...stance,
        lean: -2,
        arm1: [r.arm1[0], [12, 17], [11, 15]],
        arm2: [r.arm2[0], [7, 15], [2, 15]],
        hand1: 'fist',
        hand2: 'fist',
        farArmFront: true,
      };
    case 'attack3':
      // Kick: the near leg out level, body leaning back, guard up.
      return {
        ...r,
        lean: 1,
        arm1: [r.arm1[0], [9, 16], [8, 13]],
        arm2: [r.arm2[0], [12, 17], [11, 14]],
        leg1: [r.leg1[0], [5, 20], [1, 19]],
        leg2: [r.leg2[0], [12, 24], [14, 27]],
        hand1: 'fist',
        hand2: 'fist',
        boot1: 'kick',
      };
    case 'cast':
      return {
        ...r,
        ...stance,
        lean: -1,
        arm1: [r.arm1[0], [7, 16], [4, 16]],
        arm2: [r.arm2[0], [9, 15], [5, 14]],
        hand1: 'open',
        hand2: 'open',
        farArmFront: true,
      };
    case 'block':
      return {
        ...r,
        leg1: [r.leg1[0], [8, 24], [7, 27]],
        leg2: [r.leg2[0], [13, 24], [14, 27]],
        arm1: [r.arm1[0], [7, 17], [6, 12]],
        arm2: [r.arm2[0], [10, 18], [8, 14]],
        hand1: 'fist',
        hand2: 'fist',
      };
    case 'hurt':
      // Thrown back: head snaps back, arms fly up behind, the front foot leaves the ground.
      return {
        ...r,
        lean: 2,
        headDx: 1,
        headDy: 1,
        arm1: [r.arm1[0], [13, 12], [15, 10]],
        arm2: [r.arm2[0], [15, 14], [17, 13]],
        leg1: [r.leg1[0], [8, 24], [6, 26]],
        leg2: [r.leg2[0], [13, 24], [13, 27]],
      };
    case 'cheer':
      return {
        ...r,
        arm1: [r.arm1[0], [9, 11], [9, 6]],
        arm2: [r.arm2[0], [12, 11], [11, 6]],
        hand1: 'open',
        hand2: 'open',
      };
    case 'fly':
    case 'fly2': {
      const wave = pose === 'fly2' ? 1 : 0;
      return {
        ...r,
        lean: -1,
        bob: wave,
        arm1: [r.arm1[0], [11, 17], [13, 19]],
        arm2: [r.arm2[0], [13, 16], [15, 18]],
        leg1: [r.leg1[0], [12, 24], [15, 26 - wave]],
        leg2: [r.leg2[0], [14, 23], [17, 25 - wave]],
        boot1: 'trail',
        boot2: 'trail',
      };
    }
    default:
      return r;
  }
}

/** Thick line from `a` to `b` with a square brush (`w` 2: x..x+1; `w` 3: x-1..x+1). */
function thickLine(g: Grid, a: P, b: P, w: number, c: number): void {
  let [x0, y0] = a;
  const [x1, y1] = b;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const lo = w === 3 ? -1 : 0;
  for (;;) {
    fill(g, x0 + lo, y0 + lo, w, w, c);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/**
 * Pastes `part` over `base`. With `contour`, body pixels right next to the part are darkened,
 * so a limb in front reads against a torso of the same color.
 */
function stamp(base: Grid, part: Grid, contour: boolean): void {
  const edges = new Set<string>();
  part.forEach((row, y) => {
    row.forEach((c, x) => {
      if (c === null) return;
      if (contour) {
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ] as const) {
          if (part[ny]?.[nx] === null && (base[ny]?.[nx] ?? null) !== null)
            edges.add(`${nx},${ny}`);
        }
      }
      const r = base[y];
      if (r) r[x] = c;
    });
  });
  for (const key of edges) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    const r = base[y];
    const c = r?.[x];
    if (r && c !== null && c !== undefined) r[x] = tone(c, 0.62);
  }
}

const shift = (p: P, dx: number, dy: number): P => [p[0] + dx, p[1] + dy];

function armPart(look: HumanoidLook, limb: Limb, hand: Hand, dark: boolean, w: 2 | 3): Grid {
  const g = newGrid(FRAME_SIZES.humanoid.w, FRAME_SIZES.humanoid.h);
  const k = (c: number) => (dark ? tone(c, 0.8) : c);
  const [a, b, c] = limb;
  thickLine(g, a, b, w, k(look.outfit));
  thickLine(g, b, c, w, k(look.outfit));
  // Cuff one step before the hand, then the hand past the wrist along the forearm.
  const sx = Math.sign(c[0] - b[0]);
  const sy = Math.sign(c[1] - b[1]);
  fill(g, c[0], c[1], 2, 2, k(look.accent));
  const hx = c[0] + sx;
  const hy = c[1] + sy;
  const skin = k(look.skin);
  if (hand === 'big') fill(g, hx - 1, hy - 1, 4, 4, skin);
  else if (hand === 'fist') fill(g, hx + (sx < 0 ? -1 : 0), hy + (sy < 0 ? -1 : 0), 3, 3, skin);
  else if (hand === 'open') fill(g, hx + (sx < 0 ? -1 : 0), hy - 1, 2, 3, skin);
  else fill(g, hx, hy, 2, 2, skin);
  return g;
}

function legPart(
  look: HumanoidLook,
  limb: Limb,
  boot: Boot,
  side: boolean,
  dark: boolean,
  w: 2 | 3,
): Grid {
  const g = newGrid(FRAME_SIZES.humanoid.w, FRAME_SIZES.humanoid.h);
  const k = (c: number) => (dark ? tone(c, 0.8) : c);
  const pants = k(look.pants ?? look.outfit);
  const boots = k(look.boots);
  const [a, b, c] = limb;
  thickLine(g, a, b, w, pants);
  thickLine(g, b, c, w, pants);
  const [x, y] = c;
  switch (boot) {
    case 'kick':
      fill(g, x - 2, y - 1, 3, 3, boots);
      break;
    case 'trail':
      fill(g, x - 1, y - 1, 3, 2, boots);
      break;
    case 'point':
      fill(g, x - 1, y + 1, 3, 2, boots);
      break;
    default:
      // Feet sit on row 30 so the outline lands on the frame's last row.
      if (side) fill(g, x - 3, y + 1, 5, 3, boots);
      else fill(g, x - 1, y + 1, 3, 3, boots);
      fill(g, x - 1, 30, side ? 3 : 3, 1, boots);
  }
  return g;
}

function torsoPart(look: HumanoidLook, view: View, dx: number, dy: number, b: BuildSpec): Grid {
  const g = newGrid(FRAME_SIZES.humanoid.w, FRAME_SIZES.humanoid.h);
  const pants = look.pants ?? look.outfit;
  // `dy` includes the build's offset; the pants line sits on the hips, which don't bob.
  const hipY = 21 + b.bodyDy;
  const t = b.torso;
  if (view === 'side') {
    const w = 6 + t;
    fill(g, 8 + dx, 13 + dy, w, hipY - 1 - (13 + dy), look.outfit);
    fill(g, 8 + dx, hipY - 1, w, 1, look.accent);
    fill(g, 8 + Math.round(dx / 2), hipY, w, 1, pants);
    return g;
  }
  const s = b.shoulder;
  fill(g, 7 - s - t, 13 + dy, 10 + 2 * (s + t), 1, look.outfit);
  fill(g, 8 - t, 14 + dy, 8 + 2 * t, hipY - 1 - (14 + dy), look.outfit);
  fill(g, 8 - t, hipY - 1, 8 + 2 * t, 1, look.accent);
  fill(g, 8 - t, hipY, 8 + 2 * t, 1, pants);
  if (view === 'front') fill(g, 10, 13 + dy, 4, 1, look.accent);
  return g;
}

/** Moves a pose's joints to fit a body type (see BUILDS). */
function fitBuild(rig: Rig, b: BuildSpec, side: boolean): Rig {
  const reachOut = (l: Limb): Limb => {
    const [a, e, h] = l;
    const len = Math.hypot(h[0] - e[0], h[1] - e[1]) || 1;
    const hand: P = [
      h[0] + Math.round(((h[0] - e[0]) / len) * b.reach),
      h[1] + Math.round(((h[1] - e[1]) / len) * b.reach),
    ];
    return [a, e, hand];
  };
  const arm = (l: Limb, out: number): Limb => {
    const [a, e, h] = reachOut(l);
    return [shift(a, out, b.bodyDy), shift(e, out, b.bodyDy), shift(h, out, b.bodyDy)];
  };
  // Hips move with the body; knees halfway; feet stay on the ground.
  const leg = (l: Limb, out: number): Limb => [
    shift(l[0], out, b.bodyDy),
    shift(l[1], out, Math.round(b.bodyDy / 2)),
    shift(l[2], out, 0),
  ];
  const s = side ? 0 : b.shoulder;
  const h = side ? 0 : b.hip;
  return {
    ...rig,
    arm1: arm(rig.arm1, -s),
    arm2: arm(rig.arm2, s),
    leg1: leg(rig.leg1, -h),
    leg2: leg(rig.leg2, h),
  };
}

/** The 16x24-style head (hair, eyes) on its own grid, enlarged x4/3 into the frame. */
function headPart(look: HumanoidLook, view: View, pose: Pose, dx: number, dy: number): Grid {
  const small = newGrid(PAINT_W, 14);
  head(small, look, view, pose, 0, 0);
  const { w, h } = FRAME_SIZES.humanoid;
  const out = newGrid(w, h);
  // Same mapping as `upscale` (x offset 1); old row 3 (top of the face) lands on row 3.
  for (let ty = 0; ty < 19; ty++) {
    const src = small[Math.floor((ty * 3) / 4)];
    for (let tx = 0; tx < w; tx++) {
      const sx = Math.floor(((tx - 1) * 3) / 4);
      const c = sx >= 0 ? (src?.[sx] ?? null) : null;
      const row = out[ty - 1 + dy];
      if (c !== null && row && tx + dx >= 0 && tx + dx < w) row[tx + dx] = c;
    }
  }
  return out;
}

function scarfPart(c: number, view: View, pose: Pose, dx: number, dy: number): Grid {
  const g = newGrid(FRAME_SIZES.humanoid.w, FRAME_SIZES.humanoid.h);
  const flying = isFlying(pose);
  const wave = pose === 'fly2' ? 1 : 0;
  const moving = flying || pose.startsWith('walk') || pose.startsWith('attack');
  if (view === 'side') {
    fill(g, 8 + dx, 12 + dy, 6, 2, c);
    if (flying) {
      fill(g, 14 + dx, 12 + dy + wave, 4, 1, c);
      fill(g, 17 + dx, 13 + dy - wave, 4, 1, c);
      fill(g, 14 + dx, 13 + dy, 3, 1, c);
    } else if (moving) {
      fill(g, 14 + dx, 13 + dy, 4, 2, c);
    } else {
      fill(g, 13 + dx, 13 + dy, 2, 5, c);
    }
    return g;
  }
  fill(g, 8, 12 + dy, 8, 2, c);
  if (view === 'front') {
    if (flying) fill(g, 15, 9 + dy + wave, 2, 4, c);
    else fill(g, 14, 14 + dy, 2, 4, c);
  } else if (flying) {
    fill(g, 9, 14 + dy - wave, 2, 4, c);
    fill(g, 13, 14 + dy + wave, 2, 4, c);
  } else {
    fill(g, 10, 14 + dy, 2, 6, c);
    fill(g, 12, 14 + dy, 2, 5, c);
  }
  return g;
}

function wingPart(c: number, view: View, dx: number, dy: number): Grid {
  const g = newGrid(FRAME_SIZES.humanoid.w, FRAME_SIZES.humanoid.h);
  const dark = tone(c, 0.7);
  if (view === 'side') {
    fill(g, 13 + dx, 10 + dy, 2, 7, dark);
    fill(g, 15 + dx, 8 + dy, 2, 6, c);
    fill(g, 17 + dx, 7 + dy, 2, 4, c);
    return g;
  }
  if (view === 'front') {
    fill(g, 17, 9 + dy, 2, 5, dark);
    fill(g, 18, 6 + dy, 2, 4, c);
    return g;
  }
  fill(g, 12, 13 + dy, 3, 6, dark);
  fill(g, 15, 10 + dy, 2, 7, c);
  fill(g, 17, 8 + dy, 2, 5, c);
  fill(g, 16, 17 + dy, 3, 1, c);
  return g;
}

function glowLines(g: Grid, c: number, view: View, dx: number, dy: number): void {
  const set = (x: number, y: number) => {
    if (g[y]?.[x] !== null && g[y]?.[x] !== undefined) fill(g, x, y, 1, 1, c);
  };
  if (view === 'side') {
    set(7 + dx, 9 + dy);
    set(10 + dx, 15 + dy);
    set(11 + dx, 16 + dy);
    set(10 + dx, 17 + dy);
    return;
  }
  if (view === 'front') {
    set(8, 9 + dy);
    set(15, 9 + dy);
  }
  set(11, 15 + dy);
  set(12, 16 + dy);
  set(11, 17 + dy);
}

// --- Frames ------------------------------------------------------------------------

function drawLeftOrFront(look: HumanoidLook, facing: Facing, pose: Pose): Grid {
  const view: View = facing === 'up' ? 'back' : facing === 'down' ? 'front' : 'side';
  const build = BUILDS[look.build ?? 'average'];
  const rig = fitBuild(
    view === 'side' ? sideRig(pose) : frontRig(pose, view === 'back'),
    build,
    view === 'side',
  );
  const { w, h } = FRAME_SIZES.humanoid;
  const g = newGrid(w, h);
  const dx = rig.lean;
  // Upper-body parts (torso, head, scarf, wing) follow the bob and the build's height.
  const dy = rig.bob + build.bodyDy;
  const up = (l: Limb): Limb => [
    shift(l[0], dx, rig.bob),
    shift(l[1], dx, rig.bob),
    shift(l[2], dx, rig.bob),
  ];
  // Hips follow the lean; knees and feet stay where the pose puts them.
  const hip = (l: Limb): Limb => [shift(l[0], dx, 0), l[1], l[2]];
  const side = view === 'side';
  const arm1 = armPart(look, up(rig.arm1), rig.hand1, false, build.armW);
  const arm2 = armPart(look, up(rig.arm2), rig.hand2, side, build.armW);
  const leg1 = legPart(look, hip(rig.leg1), rig.boot1, side, false, build.legW);
  const leg2 = legPart(look, hip(rig.leg2), rig.boot2, side, side, build.legW);
  const torso = torsoPart(look, view, dx, dy, build);
  const headG = headPart(look, view, pose, dx + rig.headDx, dy + rig.headDy);

  if (side) {
    if (look.wing !== undefined) stamp(g, wingPart(look.wing, view, dx, dy), false);
    if (!rig.farArmFront) stamp(g, arm2, false);
    stamp(g, leg2, false);
    stamp(g, torso, false);
    stamp(g, leg1, true);
    stamp(g, headG, false);
    if (look.scarf !== undefined) stamp(g, scarfPart(look.scarf, view, pose, dx, dy), false);
    if (rig.farArmFront) stamp(g, arm2, true);
    stamp(g, arm1, true);
  } else if (view === 'front') {
    if (look.wing !== undefined) stamp(g, wingPart(look.wing, view, dx, dy), false);
    stamp(g, leg1, false);
    stamp(g, leg2, false);
    stamp(g, torso, false);
    stamp(g, headG, false);
    if (look.scarf !== undefined) stamp(g, scarfPart(look.scarf, view, pose, dx, dy), false);
    stamp(g, arm1, true);
    stamp(g, arm2, true);
  } else {
    // From behind, arms reaching forward disappear behind the back.
    stamp(g, leg1, false);
    stamp(g, leg2, false);
    stamp(g, arm1, false);
    stamp(g, arm2, false);
    stamp(g, torso, false);
    if (look.scarf !== undefined) stamp(g, scarfPart(look.scarf, view, pose, dx, dy), false);
    stamp(g, headG, false);
    if (look.wing !== undefined) stamp(g, wingPart(look.wing, view, dx, dy), true);
  }

  // Glow is a flat color, so finishGrid leaves the lines at full brightness.
  if (look.glow !== undefined) glowLines(g, look.glow, view, dx, dy);
  const flat = [EYE, EYE_WHITE, ...(look.glow !== undefined ? [look.glow] : [])];
  return finishGrid(g, {
    flat,
    castFrom: [look.hair, ...(look.scarf !== undefined ? [look.scarf] : [])],
    castOnto: [look.skin, look.outfit],
  });
}

function mirror(g: Grid): Grid {
  return g.map((row) => [...row].reverse());
}

/** Returns the pixel grid for one frame; `null` = transparent. */
export function humanoidFrame(look: HumanoidLook, facing: Facing, pose: Pose): Grid {
  if (facing === 'right') return mirror(drawLeftOrFront(look, 'left', pose));
  return drawLeftOrFront(look, facing, pose);
}
