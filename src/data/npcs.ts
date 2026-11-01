import type { StringKey } from '../i18n';
import type { NpcRule } from '../systems/npcRules';
import type { ActorLook } from '../ui/actorFrames';
// Explicit `.ts`: the sprite scripts load this module with plain Node.
import { VALLEY_RELICS } from './collectibles.ts';
import { SARN_HOLLOW_LOOK } from './enemiesArc2.ts';

export interface NpcDef {
  id: string;
  nameKey: StringKey;
  look: ActorLook;
  /** Evaluated top to bottom; the first match decides the dialogue. */
  rules: NpcRule[];
  /** Items sold (by id); a shop opens after the NPC's dialogue. */
  shop?: readonly string[];
}

const WARDEN_UNIFORM = { outfit: 0x2a3e5a, pants: 0x1e2a3e, accent: 0xe8c860, boots: 0x18202c };

/** The first wardens' echoes in the Hondura: pale, see-through blues, a faint light. */
const ECHO = {
  kind: 'humanoid',
  skin: 0xb8c8e8,
  outfit: 0x5a6a9a,
  pants: 0x3a4a72,
  accent: 0xd8e8ff,
  boots: 0x2a3456,
  glow: 0xc8d8ff,
} as const;

const ECHOES = ['echoA', 'echoB', 'echoC'] as const;

/**
 * An echo tells its part once (setting its flag). Whoever is heard last also opens the way to
 * the arena (chain into `echoesOpen`); after that they only hum.
 */
function echoRules(id: (typeof ECHOES)[number]): NpcRule[] {
  const others = ECHOES.filter((e) => e !== id);
  return [
    {
      when: { flags: ECHOES, notFlag: 'echoesHeard' },
      dialogue: 'echoesOpen',
      effects: [{ setFlag: 'echoesHeard' }],
    },
    {
      when: { flags: others, notFlag: id },
      dialogue: id,
      effects: [{ setFlag: id }],
      chain: true,
    },
    { when: { notFlag: id }, dialogue: id, effects: [{ setFlag: id }] },
    { when: { flag: 'echoesHeard' }, dialogue: 'echoRest' },
    { when: {}, dialogue: 'echoHum' },
  ];
}

export const NPCS: Record<string, NpcDef> = {
  iole: {
    id: 'iole',
    nameKey: 'npc.iole',
    look: {
      kind: 'humanoid',
      build: 'slim',
      skin: 0xd8a888,
      hair: 0xd8d8e0,
      hairStyle: 'bun',
      wing: 0xc8a050,
      ...WARDEN_UNIFORM,
    },
    rules: [
      { when: { flag: 'gameCleared' }, dialogue: 'iolePostGame' },
      { when: { flag: 'riftBriefed' }, dialogue: 'ioleRiftRemind' },
      {
        when: { flag: 'marshDone' },
        dialogue: 'ioleRiftBrief',
        effects: [{ setFlag: 'riftBriefed' }],
      },
      { when: { flag: 'marshBriefed' }, dialogue: 'ioleMarshRemind' },
      {
        when: { flag: 'arc1Done' },
        dialogue: 'ioleMarshBrief',
        effects: [{ setFlag: 'marshBriefed' }],
      },
      { when: { flag: 'anchorBroken' }, dialogue: 'ioleArc1End' },
      {
        when: { bossDefeated: 'field:boss', notFlag: 'missionReported' },
        dialogue: 'ioleReport',
        effects: [{ setFlag: 'missionReported' }, { giveItem: 'altitudeBerry' }],
      },
      {
        when: { flag: 'okunJoined', notFlag: 'okunIntroduced' },
        dialogue: 'ioleOkun',
        effects: [{ setFlag: 'okunIntroduced' }, { giveItem: 'quarryTonic' }],
      },
      { when: { flag: 'okunIntroduced' }, dialogue: 'ioleSarn' },
      { when: { flag: 'missionReported' }, dialogue: 'ioleAfter' },
      {
        when: { notFlag: 'missionAccepted' },
        dialogue: 'ioleIntro',
        effects: [{ setFlag: 'missionAccepted' }],
      },
      { when: {}, dialogue: 'ioleRemind' },
    ],
  },
  pim: {
    id: 'pim',
    nameKey: 'npc.pim',
    look: {
      kind: 'humanoid',
      build: 'small',
      skin: 0xc8a070,
      hair: 0x7a5a3a,
      hairStyle: 'tufts',
      bigEyes: true,
      outfit: 0x5a3a2a,
      pants: 0x3a2a1e,
      accent: 0xe8c860,
      boots: 0x2a1e14,
    },
    rules: [
      {
        when: { undeliveredCollectibles: 'some' },
        dialogue: 'pimDeliver',
        effects: [{ deliverCollectibles: true }],
        chain: true,
      },
      {
        when: { deliveredAll: VALLEY_RELICS, notFlag: 'museumRewarded' },
        dialogue: 'pimReward',
        effects: [{ learnTechnique: 'lighthouseBeam' }, { setFlag: 'museumRewarded' }],
      },
      // Every relic in Aurel, the Fondo's pearl included: the archive is complete.
      {
        when: { allDelivered: true, notFlag: 'museumComplete' },
        dialogue: 'pimComplete',
        effects: [{ giveItem: 'archivistCoat' }, { setFlag: 'museumComplete' }],
      },
      // Arc 3: where the three anchor lights still burn (his archive's old maps).
      { when: { flag: 'lightsQuest', notFlag: 'fondoOpen' }, dialogue: 'pimLights' },
      { when: { flag: 'museumRewarded' }, dialogue: 'pimThanks' },
      { when: { notFlag: 'pimMet' }, dialogue: 'pimIntro', effects: [{ setFlag: 'pimMet' }] },
      { when: {}, dialogue: 'pimIdle' },
    ],
  },
  nilo: {
    id: 'nilo',
    nameKey: 'npc.nilo',
    look: {
      kind: 'humanoid',
      build: 'small',
      skin: 0xa86a48,
      hair: 0xe0a030,
      hairStyle: 'shaggy',
      ...WARDEN_UNIFORM,
    },
    rules: [
      // Chapter 6, at the tower gate: the letters side quest, then the siege.
      {
        when: {
          chestsOpened: ['cliffs:letterA', 'cliffs:letterB', 'cliffs:letterC'],
          notFlag: 'lettersKept',
        },
        dialogue: 'niloLetters',
        effects: [
          { takeItem: 'taviLetterA' },
          { takeItem: 'taviLetterB' },
          { takeItem: 'taviLetterC' },
          { giveItem: 'courierScarf' },
          { setFlag: 'lettersKept' },
        ],
        chain: true,
      },
      { when: { flag: 'siegeDone' }, dialogue: 'niloAfterSiege' },
      { when: { flag: 'siegeBroken' }, dialogue: 'niloBarricadeOpen' },
      {
        when: {
          groupsCleared: ['cliffs:west', 'cliffs:east', 'cliffs:beach'],
          bossDefeated: 'cliffs:ram',
        },
        dialogue: 'niloBarricade',
        effects: [{ setFlag: 'siegeBroken' }],
      },
      {
        when: { flag: 'siegeStarted' },
        dialogue: 'niloSiege',
        effects: [{ setFlag: 'lettersAsked' }],
      },
      { when: { flag: 'anchorBroken' }, dialogue: 'niloAnchor' },
      { when: { flag: 'okunJoined' }, dialogue: 'niloOkun' },
      { when: { bossDefeated: 'field:boss' }, dialogue: 'niloAfter' },
      { when: {}, dialogue: 'niloTip' },
    ],
  },
  oda: {
    id: 'oda',
    nameKey: 'npc.oda',
    look: {
      kind: 'humanoid',
      skin: 0xc89878,
      hair: 0x3a2a4a,
      hairStyle: 'ponytail',
      outfit: 0x6a8a5a,
      pants: 0x4a3a2a,
      accent: 0xe8b050,
      boots: 0x2a1e14,
      scarf: 0xc04a3a,
    },
    rules: [{ when: {}, dialogue: 'odaHello' }],
    shop: ['ration', 'kiFlask', 'quarryTonic', 'reedWraps', 'tideAmulet', 'galeSandals'],
  },
  // --- Salinar (Marismas de Sal) ---------------------------------------------------------
  brea: {
    id: 'brea',
    nameKey: 'npc.brea',
    look: {
      kind: 'humanoid',
      build: 'small',
      skin: 0xb8906a,
      hair: 0xe8e8e0,
      hairStyle: 'bun',
      outfit: 0x7a6a8a,
      pants: 0x4a4050,
      accent: 0xe8e4d8,
      boots: 0x3a3028,
    },
    rules: [
      { when: { flag: 'marshDone' }, dialogue: 'breaAfter' },
      { when: { flag: 'marshRescued' }, dialogue: 'breaAnchor' },
      {
        when: { flags: ['rescuedRuy', 'rescuedMela', 'rescuedTobi'] },
        dialogue: 'breaAllHome',
        effects: [{ setFlag: 'marshRescued' }, { giveItem: 'quarryTonic' }],
      },
      { when: { flag: 'cs.marshArrive' }, dialogue: 'breaAsk' },
      { when: {}, dialogue: 'breaAsk' },
    ],
  },
  damaso: {
    id: 'damaso',
    nameKey: 'npc.damaso',
    look: {
      kind: 'humanoid',
      build: 'broad',
      skin: 0x9a6848,
      hair: 0x5a4a3a,
      hairStyle: 'tufts',
      outfit: 0x4a6a7a,
      pants: 0x3a4a52,
      accent: 0xd8c890,
      boots: 0x2a2620,
    },
    rules: [
      { when: { flag: 'huntCrabsPaid' }, dialogue: 'damasoThanks' },
      {
        when: { kills: { enemy: 'brineSkitter', count: 8 } },
        dialogue: 'damasoPay',
        effects: [{ giveMoney: 150 }, { giveItem: 'kiFlask' }, { setFlag: 'huntCrabsPaid' }],
      },
      {
        when: { notFlag: 'huntCrabsTaken' },
        dialogue: 'damasoAsk',
        effects: [{ setFlag: 'huntCrabsTaken' }, { startHunt: 'brineSkitter' }],
      },
      { when: {}, dialogue: 'damasoAsk' },
    ],
  },
  tolo: {
    id: 'tolo',
    nameKey: 'npc.tolo',
    look: {
      kind: 'humanoid',
      build: 'broad',
      skin: 0xc8946c,
      hair: 0xd8d8d0,
      hairStyle: 'helmet',
      detail: 0xffd060,
      outfit: 0x8a6a3a,
      pants: 0x4a3a2a,
      accent: 0x5a4a3a,
      boots: 0x2a2018,
    },
    rules: [
      { when: { flag: 'toloPaid' }, dialogue: 'toloThanks' },
      {
        when: { chestsOpened: ['rift:toolPick', 'rift:toolLamp', 'rift:toolRope'] },
        dialogue: 'toloPay',
        effects: [
          { takeItem: 'toloPick' },
          { takeItem: 'toloLamp' },
          { takeItem: 'toloRope' },
          { giveMoney: 300 },
          { giveItem: 'altitudeBerry' },
          { setFlag: 'toloPaid' },
        ],
      },
      { when: { flag: 'toloAsked' }, dialogue: 'toloRemind' },
      { when: {}, dialogue: 'toloAsk', effects: [{ setFlag: 'toloAsked' }] },
    ],
  },
  ruy: {
    id: 'ruy',
    nameKey: 'npc.ruy',
    look: {
      kind: 'humanoid',
      build: 'broad',
      skin: 0xc89878,
      hair: 0x2a2a2a,
      hairStyle: 'shaggy',
      outfit: 0xd8d0b8,
      pants: 0x5a5040,
      accent: 0x8a7a5a,
      boots: 0x3a3024,
    },
    rules: [{ when: {}, dialogue: 'ruyHome' }],
  },
  mela: {
    id: 'mela',
    nameKey: 'npc.mela',
    look: {
      kind: 'humanoid',
      build: 'slim',
      skin: 0x8a5a3a,
      hair: 0x1a1a1a,
      hairStyle: 'ponytail',
      outfit: 0xc85a4a,
      pants: 0x4a3a32,
      accent: 0xe8d8b8,
      boots: 0x2a2220,
    },
    rules: [{ when: {}, dialogue: 'melaHome' }],
  },
  tobi: {
    id: 'tobi',
    nameKey: 'npc.tobi',
    look: {
      kind: 'humanoid',
      build: 'small',
      skin: 0xd8a888,
      hair: 0xc87a3a,
      hairStyle: 'tufts',
      bigEyes: true,
      outfit: 0x6a8a4a,
      pants: 0x4a4a32,
      accent: 0xe8d8b8,
      boots: 0x2a2a1e,
    },
    rules: [{ when: {}, dialogue: 'tobiHome' }],
  },
  // --- La Hondura (chapter 7): the first wardens' echoes ---------------------------------
  echoA: {
    id: 'echoA',
    nameKey: 'npc.echoA',
    look: { ...ECHO, build: 'slim', hair: 0x8a9ac8, hairStyle: 'ponytail', scarf: 0xd8e8ff },
    rules: echoRules('echoA'),
  },
  echoB: {
    id: 'echoB',
    nameKey: 'npc.echoB',
    look: { ...ECHO, build: 'broad', hair: 0x6a7aa8, hairStyle: 'bald' },
    rules: echoRules('echoB'),
  },
  echoC: {
    id: 'echoC',
    nameKey: 'npc.echoC',
    look: { ...ECHO, build: 'small', hair: 0xd8e0f8, hairStyle: 'bun' },
    rules: echoRules('echoC'),
  },
  // --- Post-game -------------------------------------------------------------------------
  /** Sarn, alive after holding the horde: he stays below as the Fondo's watchman. */
  sarn: {
    id: 'sarn',
    nameKey: 'npc.sarn',
    look: SARN_HOLLOW_LOOK,
    rules: [{ when: {}, dialogue: 'sarnPostGame' }],
  },
  /** A hunter who follows the news of the Fondo to the Atalaya: hunts, then a deep shop. */
  maela: {
    id: 'maela',
    nameKey: 'npc.maela',
    look: {
      kind: 'humanoid',
      skin: 0xb07a58,
      hair: 0xa83a2a,
      hairStyle: 'ponytail',
      outfit: 0x5a4a3a,
      pants: 0x3a2e24,
      accent: 0xd8b070,
      boots: 0x241a12,
      scarf: 0x3a6a5a,
    },
    rules: [
      { when: { flag: 'huntEchoPaid' }, dialogue: 'maelaDone' },
      {
        when: { flag: 'huntWispsPaid', bossDefeated: 'abyss2:echo' },
        dialogue: 'maelaPayEcho',
        effects: [{ giveMoney: 2000 }, { giveItem: 'abyssTonic' }, { setFlag: 'huntEchoPaid' }],
      },
      { when: { flag: 'huntWispsPaid' }, dialogue: 'maelaAskEcho' },
      {
        when: { flag: 'huntSpawnPaid', kills: { enemy: 'hungerWisp', count: 12 } },
        dialogue: 'maelaPayWisps',
        effects: [{ giveItem: 'hunterBand' }, { setFlag: 'huntWispsPaid' }],
        chain: true,
      },
      { when: { flag: 'huntSpawnPaid' }, dialogue: 'maelaAskWisps' },
      {
        when: { kills: { enemy: 'fondoSpawn', count: 15 } },
        dialogue: 'maelaPaySpawn',
        effects: [
          { giveMoney: 600 },
          { giveItem: 'abyssTonic' },
          { setFlag: 'huntSpawnPaid' },
          { startHunt: 'hungerWisp' },
        ],
        chain: true,
      },
      {
        when: { notFlag: 'huntsTaken' },
        dialogue: 'maelaAsk',
        effects: [{ setFlag: 'huntsTaken' }, { startHunt: 'fondoSpawn' }],
      },
      { when: {}, dialogue: 'maelaAsk' },
    ],
    shop: ['abyssTonic', 'quarryTonic', 'kiFlask', 'wardenPlate', 'deepTreads'],
  },
};

export function getNpc(id: string): NpcDef {
  const def = NPCS[id];
  if (!def) throw new Error(`Unknown NPC: ${id}`);
  return def;
}
