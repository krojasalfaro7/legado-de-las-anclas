import type { CharacterDef } from './types';

const SKIN = 0xf2c9a0;

const WARDEN_UNIFORM = { outfit: 0x2a3e5a, pants: 0x1e2a3e, accent: 0xe8c860, boots: 0x18202c };

/** Arc 2-3 members: the Atalaya's captain and its junior warden. */
const WARDENS: Record<string, CharacterDef> = {
  // Joins in arc 2 (chapter 6) while Tavi is missing.
  iole: {
    id: 'iole',
    nameKey: 'npc.iole',
    enabled: false,
    joinFlag: 'ioleJoined',
    color: 0x9ab8ff,
    baseSpeed: 88,
    canFly: true,
    // A veteran flier: her mechanical wing hits wide and hard; ki comes back slowly.
    traits: {
      kiRegenMult: 0.9,
      chargeTimeMult: 0.9,
      runMult: 1,
      guardMult: 0.7,
      armoredSwings: false,
    },
    // Wing sweeps: three wide arcs, the last a gust that blows enemies away.
    melee: {
      startupMs: 60,
      activeMs: 100,
      recoveryMs: [160, 170, 300],
      moveCancelMs: [60, 70, 160],
      comboWindowMs: 280,
      comboMults: [1, 1.1, 1.8],
      knockback: [45, 50, 420],
      lungeSpeed: [35, 40, 45],
      poses: ['attack2', 'attack', 'attack3'],
      reach: 18,
      width: 26,
      power: 1.25,
      stagger: 0.7,
      assistConeDeg: 50,
      assistRange: 27,
    },
    look: {
      kind: 'humanoid',
      build: 'slim',
      skin: 0xd8a888,
      hair: 0xd8d8e0,
      hairStyle: 'bun',
      wing: 0xc8a050,
      ...WARDEN_UNIFORM,
    },
    startingTechniques: ['gustBlade', 'downdraft'],
    techniqueUnlocks: [{ level: 20, technique: 'skyLance' }],
    transformations: [],
  },
  // Joins in arc 3 (chapter 8) after crawling through the collapsed archive to save Pim.
  nilo: {
    id: 'nilo',
    nameKey: 'npc.nilo',
    enabled: false,
    joinFlag: 'niloJoined',
    color: 0xffa040,
    baseSpeed: 102,
    // Still a cadet: the Atalaya hasn't given him wings yet (Iolé carries him).
    canFly: false,
    // Small and quick: fastest runner and ki, weakest guard.
    traits: {
      kiRegenMult: 1.35,
      chargeTimeMult: 0.75,
      runMult: 1.2,
      guardMult: 1.2,
      armoredSwings: false,
    },
    // A flurry: five light, quick jabs and a spinning kick.
    melee: {
      startupMs: 30,
      activeMs: 80,
      recoveryMs: [110, 110, 110, 120, 260],
      moveCancelMs: [30, 30, 30, 40, 140],
      comboWindowMs: 240,
      comboMults: [0.8, 0.8, 0.9, 1, 1.7],
      knockback: [20, 20, 25, 30, 320],
      lungeSpeed: [35, 35, 35, 40, 50],
      poses: ['attack', 'attack2', 'attack', 'attack2', 'attack3'],
      reach: 14,
      width: 16,
      power: 0.85,
      stagger: 1.2,
      assistConeDeg: 50,
      assistRange: 22,
    },
    look: {
      kind: 'humanoid',
      build: 'small',
      skin: 0xa86a48,
      hair: 0xe0a030,
      hairStyle: 'shaggy',
      ...WARDEN_UNIFORM,
    },
    startingTechniques: ['needleDart', 'dartFan'],
    techniqueUnlocks: [{ level: 24, technique: 'signalFlare' }],
    transformations: [],
  },
};

export const CHARACTERS: Record<string, CharacterDef> = {
  tavi: {
    id: 'tavi',
    nameKey: 'char.tavi',
    enabled: true,
    // Dragged under the land at the end of La Grieta; she wakes alone in the Hondura (chapter 7).
    absent: { from: 'taviTaken', until: 'taviWakes' },
    color: 0x2ec4b6,
    baseSpeed: 94,
    canFly: true,
    // Quick courier: charges and recovers ki fast, runs fastest, but a plain guard.
    traits: {
      kiRegenMult: 1.25,
      chargeTimeMult: 0.8,
      runMult: 1.1,
      guardMult: 1,
      armoredSwings: false,
    },
    look: {
      kind: 'humanoid',
      skin: SKIN,
      hair: 0x1f7f86,
      hairStyle: 'ponytail',
      outfit: 0xe6d8b8,
      pants: 0x5a4636,
      accent: 0x8a5a36,
      boots: 0x4a3626,
      scarf: 0xd8322a,
    },
    startingTechniques: ['spark', 'fan'],
    techniqueUnlocks: [
      { level: 6, technique: 'mailBarrage' },
      { level: 12, technique: 'tideDisc' },
    ],
    transformations: [
      {
        id: 'anchorAwakening',
        nameKey: 'transform.anchorAwakening',
        damageMult: 1.5,
        speedMult: 1.12,
        kiDrainPerSec: 4,
        minKiToActivate: 20,
        auraColor: 0x9ff6ff,
        look: {
          kind: 'humanoid',
          skin: SKIN,
          hair: 0x2a9aa0,
          hairStyle: 'ponytail',
          outfit: 0xe6d8b8,
          pants: 0x2a4a5e,
          accent: 0x2a8aa0,
          boots: 0x22384a,
          scarf: 0x7af4ff,
          glow: 0xc8ffff,
        },
      },
      // Earned in the Hondura (chapter 7) by accepting her shadow: anchor light and the deep's
      // dark together. Stronger and hungrier than the first form.
      {
        id: 'deepTide',
        nameKey: 'transform.deepTide',
        requiresFlag: 'deepTide',
        damageMult: 1.85,
        speedMult: 1.18,
        kiDrainPerSec: 6,
        minKiToActivate: 30,
        auraColor: 0x8a6aff,
        look: {
          kind: 'humanoid',
          skin: SKIN,
          hair: 0x2a3a9a,
          hairStyle: 'ponytail',
          outfit: 0x2a2a48,
          pants: 0x1a1a30,
          accent: 0x6a5ad0,
          boots: 0x12122a,
          scarf: 0x8a6aff,
          glow: 0xb8a8ff,
        },
      },
    ],
  },
  // Joins in arc 1 (flag `okunJoined`); `?join=okun` enables him in dev builds.
  okun: {
    id: 'okun',
    nameKey: 'char.okun',
    enabled: false,
    joinFlag: 'okunJoined',
    color: 0xd09a2a,
    baseSpeed: 80,
    // Stone doesn't fly ("las piedras no vuelan"): Tavi carries him between regions.
    canFly: false,
    // A wall: slow ki, but his blows can't be interrupted, his guard barely gives, and his
    // finisher cracks the ground around the target.
    traits: {
      kiRegenMult: 0.8,
      chargeTimeMult: 1.3,
      runMult: 0.9,
      guardMult: 0.5,
      armoredSwings: true,
      finisherQuake: 30,
    },
    // Slow and strong: three heavy blows, wide reach, and hits barely stagger him.
    melee: {
      startupMs: 90,
      activeMs: 110,
      recoveryMs: [170, 190, 340],
      moveCancelMs: [90, 100, 200],
      comboWindowMs: 300,
      comboMults: [1, 1.2, 2.1],
      knockback: [55, 70, 260],
      lungeSpeed: [30, 35, 60],
      poses: ['attack2', 'attack', 'attack3'],
      reach: 17,
      width: 22,
      power: 1.6,
      stagger: 0.4,
      assistConeDeg: 45,
      assistRange: 26,
    },
    look: {
      kind: 'humanoid',
      build: 'broad',
      skin: 0x8c8478,
      hair: 0x5a7a3a,
      hairStyle: 'shaggy',
      outfit: 0x6a5a3a,
      pants: 0x4a3e2a,
      accent: 0xd09a2a,
      boots: 0x3a3226,
    },
    startingTechniques: ['rockLance', 'quarryWave'],
    techniqueUnlocks: [
      { level: 13, technique: 'rollingBoulder' },
      { level: 16, technique: 'seismicFist' },
    ],
    transformations: [],
  },
  ...WARDENS,
};

/** Playable now: enabled from the start, or joined through the story. */
export function isPlayable(id: string, flags: Record<string, boolean>): boolean {
  const def = CHARACTERS[id];
  if (!def) return false;
  if (def.absent && flags[def.absent.from] === true && flags[def.absent.until] !== true)
    return false;
  return def.enabled || (def.joinFlag !== undefined && flags[def.joinFlag] === true);
}

export function getCharacter(id: string): CharacterDef {
  const def = CHARACTERS[id];
  if (!def) throw new Error(`Unknown character: ${id}`);
  return def;
}
