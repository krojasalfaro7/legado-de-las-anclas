/**
 * The air of each zone: light, grading, floating particles and glowing tiles. Purely visual;
 * see scenes/world/Ambience.ts.
 */
export interface MoteDef {
  /** Particles on screen at once. */
  count: number;
  colors: readonly number[];
  /** Drift in px/s (world space) and side-to-side sway amplitude in px. */
  vx: number;
  vy: number;
  sway: number;
  /** Size in px: 1 is a speck, 2 a soft blob. */
  size: 1 | 2;
  alpha: number;
  /** Additive glow (embers, spores) instead of plain paint (dust, pollen). */
  glow?: boolean;
}

export interface AmbienceDef {
  /** Edge darkening, 0..1. Dark zones center it on the player like a carried light. */
  vignette: number;
  /** A color laid over the whole view (normal blend) for the zone's grading. */
  tint?: { color: number; alpha: number };
  motes?: MoteDef;
  /** Tiles that glow, with the halo color. */
  glow?: Readonly<Record<string, number>>;
  /** Water catches the light now and then. */
  glints?: boolean;
  /** Slow drifting fog banks. */
  fog?: { color: number; alpha: number };
}

const UNDERGROUND_GLOW = { 'glow-root': 0x6af0d0, crystal: 0x9ae8ff, seam: 0x8ad8ff } as const;

export const AMBIENCE: Record<string, AmbienceDef> = {
  hub: {
    vignette: 0.32,
    tint: { color: 0xffb060, alpha: 0.05 },
    motes: {
      count: 14,
      colors: [0xfff0c0, 0xffe0a0],
      vx: 2,
      vy: -3,
      sway: 6,
      size: 1,
      alpha: 0.55,
    },
    glints: true,
  },
  field: {
    vignette: 0.22,
    tint: { color: 0xfff0b0, alpha: 0.04 },
    motes: {
      count: 22,
      colors: [0xffffff, 0xfff6c8, 0xe8ffd0],
      vx: 9,
      vy: -2,
      sway: 10,
      size: 2,
      alpha: 0.7,
    },
    glow: { crystal: 0x9ae8ff, anchor: 0x9ae8ff },
    glints: true,
  },
  cobre: {
    vignette: 0.26,
    tint: { color: 0xff8a40, alpha: 0.06 },
    motes: {
      count: 26,
      colors: [0xffc890, 0xe8a070, 0xfff0d0],
      vx: 26,
      vy: 3,
      sway: 4,
      size: 1,
      alpha: 0.6,
    },
    glow: { 'copper-ore': 0xffa860, crystal: 0x9ae8ff },
  },
  marsh: {
    vignette: 0.26,
    tint: { color: 0x9ad0e0, alpha: 0.06 },
    motes: {
      count: 18,
      colors: [0xffffff, 0xe8f8ff],
      vx: 5,
      vy: -4,
      sway: 8,
      size: 1,
      alpha: 0.75,
    },
    fog: { color: 0xe8f4f0, alpha: 0.14 },
    glints: true,
  },
  rift: {
    vignette: 0.38,
    tint: { color: 0x304a70, alpha: 0.12 },
    motes: {
      count: 20,
      colors: [0x9ae8ff, 0xc8f4ff],
      vx: 0,
      vy: -10,
      sway: 6,
      size: 1,
      alpha: 0.85,
      glow: true,
    },
    glow: { seam: 0x8ad8ff, crystal: 0x9ae8ff },
  },
  cliffs: {
    vignette: 0.3,
    tint: { color: 0xff7040, alpha: 0.06 },
    motes: {
      count: 22,
      colors: [0xffb060, 0xff8040, 0xffe080],
      vx: 6,
      vy: -16,
      sway: 10,
      size: 1,
      alpha: 0.9,
      glow: true,
    },
    glints: true,
  },
  hollow: {
    vignette: 0.62,
    tint: { color: 0x10203a, alpha: 0.2 },
    motes: {
      count: 18,
      colors: [0x6af0d0, 0xa8fff0],
      vx: 0,
      vy: -6,
      sway: 8,
      size: 1,
      alpha: 0.9,
      glow: true,
    },
    glow: UNDERGROUND_GLOW,
  },
  lairs: {
    vignette: 0.5,
    tint: { color: 0x201830, alpha: 0.14 },
    motes: {
      count: 14,
      colors: [0xffe8a0, 0xfff4d0],
      vx: 0,
      vy: -5,
      sway: 6,
      size: 1,
      alpha: 0.8,
      glow: true,
    },
    glow: { ...UNDERGROUND_GLOW, 'copper-ore': 0xffa860, anchor: 0xfff0b0 },
    glints: true,
  },
  abyss: {
    vignette: 0.6,
    tint: { color: 0x281040, alpha: 0.18 },
    motes: {
      count: 22,
      colors: [0xc890ff, 0xffd0ff, 0x9ae8ff],
      vx: 0,
      vy: -7,
      sway: 9,
      size: 1,
      alpha: 0.9,
      glow: true,
    },
    glow: UNDERGROUND_GLOW,
  },
};

/** Zones that share another's air. */
const SHARED: Record<string, string> = {
  cobreVault: 'lairs',
  marshWell: 'lairs',
  anchorHeart: 'lairs',
  abyss1: 'abyss',
  abyss2: 'abyss',
};

export function ambienceFor(zoneId: string): AmbienceDef | undefined {
  return AMBIENCE[SHARED[zoneId] ?? zoneId];
}
