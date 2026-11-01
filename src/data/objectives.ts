import type { StringKey } from '../i18n';
import type { ObjectiveDef } from '../systems/objectives';
import { VALLEY_RELICS } from './collectibles';

/** Story and side objectives shown in the pause menu, in display order within each kind. */
export const OBJECTIVES: ObjectiveDef<StringKey>[] = [
  {
    id: 'valleyAnchor',
    kind: 'main',
    titleKey: 'obj.valleyAnchor',
    start: {},
    steps: [
      { textKey: 'obj.valleyAnchor.talk', done: { flag: 'missionAccepted' } },
      { textKey: 'obj.valleyAnchor.travel', done: { bossDefeated: 'field:boss' } },
      { textKey: 'obj.valleyAnchor.report', done: { flag: 'missionReported' } },
    ],
  },
  {
    id: 'copperHollow',
    kind: 'main',
    titleKey: 'obj.copperHollow',
    start: { flag: 'missionReported' },
    steps: [
      { textKey: 'obj.copperHollow.travel', done: { flag: 'cs.cobreArrive' } },
      { textKey: 'obj.copperHollow.find', done: { bossDefeated: 'cobre:okun' } },
      { textKey: 'obj.copperHollow.boulder', done: { gateBroken: 'cobre:caveBoulder' } },
      { textKey: 'obj.copperHollow.report', done: { flag: 'okunIntroduced' } },
    ],
  },
  {
    id: 'sarnHunt',
    kind: 'main',
    titleKey: 'obj.sarnHunt',
    start: { flag: 'okunIntroduced' },
    steps: [
      { textKey: 'obj.sarnHunt.travel', done: { flag: 'cs.sarnArrive' } },
      { textKey: 'obj.sarnHunt.fight', done: { bossDefeated: 'field:sarn' } },
      { textKey: 'obj.sarnHunt.report', done: { flag: 'vaultOpened' } },
      { textKey: 'obj.sarnHunt.vault', done: { chestOpened: 'hub:chestVault' } },
    ],
  },
  {
    id: 'mistRelics',
    kind: 'side',
    titleKey: 'obj.mistRelics',
    start: { flag: 'pimMet' },
    steps: [
      { textKey: 'obj.mistRelics.find', done: { foundAll: VALLEY_RELICS } },
      { textKey: 'obj.mistRelics.deliver', done: { flag: 'museumRewarded' } },
    ],
  },
  {
    id: 'marshRescue',
    kind: 'main',
    titleKey: 'obj.marshRescue',
    start: { flag: 'marshBriefed' },
    steps: [
      { textKey: 'obj.marshRescue.travel', done: { flag: 'cs.marshArrive' } },
      {
        textKey: 'obj.marshRescue.workers',
        done: { flags: ['rescuedRuy', 'rescuedMela', 'rescuedTobi'] },
      },
      { textKey: 'obj.marshRescue.brea', done: { flag: 'marshRescued' } },
      { textKey: 'obj.marshRescue.colossus', done: { bossDefeated: 'marsh:colossus' } },
      { textKey: 'obj.marshRescue.report', done: { flag: 'riftBriefed' } },
    ],
  },
  {
    id: 'riftDescent',
    kind: 'main',
    titleKey: 'obj.riftDescent',
    start: { flag: 'riftBriefed' },
    steps: [
      { textKey: 'obj.riftDescent.travel', done: { flag: 'cs.riftArrive' } },
      { textKey: 'obj.riftDescent.grell', done: { flag: 'grellBeaten' } },
      { textKey: 'obj.riftDescent.vesk', done: { bossDefeated: 'rift:vesk' } },
    ],
  },
  {
    id: 'siege',
    kind: 'main',
    titleKey: 'obj.siege',
    start: { flag: 'siegeStarted' },
    steps: [
      { textKey: 'obj.siege.travel', done: { flag: 'cs.cliffsArrive' } },
      { textKey: 'obj.siege.ram', done: { bossDefeated: 'cliffs:ram' } },
      {
        textKey: 'obj.siege.camps',
        done: { groupsCleared: ['cliffs:west', 'cliffs:east', 'cliffs:beach'] },
      },
      { textKey: 'obj.siege.nilo', done: { flag: 'siegeBroken' } },
      { textKey: 'obj.siege.sarn', done: { bossDefeated: 'cliffs:sarn' } },
    ],
  },
  {
    id: 'hollow',
    kind: 'main',
    titleKey: 'obj.hollow',
    start: { flag: 'taviWakes' },
    steps: [
      { textKey: 'obj.hollow.echoes', done: { flag: 'echoesHeard' } },
      { textKey: 'obj.hollow.shadow', done: { bossDefeated: 'hollow:shadow' } },
      { textKey: 'obj.hollow.climb', done: { flag: 'taviReturned' } },
    ],
  },
  {
    id: 'lights',
    kind: 'main',
    titleKey: 'obj.lights',
    start: { flag: 'lightsQuest' },
    steps: [
      // Any order: one step until all three burn.
      { textKey: 'obj.lights.find', done: { flags: ['lightCobre', 'lightMarsh', 'lightValley'] } },
      { textKey: 'obj.lights.return', done: { flag: 'fondoOpen' } },
    ],
  },
  {
    id: 'fondo',
    kind: 'main',
    titleKey: 'obj.fondo',
    start: { flag: 'fondoOpen' },
    steps: [
      { textKey: 'obj.fondo.descend', done: { flag: 'cs.abyssArrive' } },
      { textKey: 'obj.fondo.crawl', done: { gateBroken: 'abyss1:roofCrawl' } },
      { textKey: 'obj.fondo.vesk', done: { flag: 'veskFallen' } },
      { textKey: 'obj.fondo.heart', done: { flag: 'gameCleared' } },
    ],
  },
  {
    id: 'letters',
    kind: 'side',
    titleKey: 'obj.letters',
    start: { flag: 'lettersAsked' },
    steps: [
      {
        textKey: 'obj.letters.find',
        done: { chestsOpened: ['cliffs:letterA', 'cliffs:letterB', 'cliffs:letterC'] },
      },
      { textKey: 'obj.letters.report', done: { flag: 'lettersKept' } },
    ],
  },
  {
    id: 'toloTools',
    kind: 'side',
    titleKey: 'obj.toloTools',
    start: { flag: 'toloAsked' },
    steps: [
      {
        textKey: 'obj.toloTools.find',
        done: { chestsOpened: ['rift:toolPick', 'rift:toolLamp', 'rift:toolRope'] },
      },
      { textKey: 'obj.toloTools.report', done: { flag: 'toloPaid' } },
    ],
  },
  {
    id: 'crabHunt',
    kind: 'side',
    titleKey: 'obj.crabHunt',
    start: { flag: 'huntCrabsTaken' },
    steps: [
      { textKey: 'obj.crabHunt.kill', done: { kills: { enemy: 'brineSkitter', count: 8 } } },
      { textKey: 'obj.crabHunt.report', done: { flag: 'huntCrabsPaid' } },
    ],
  },
  {
    id: 'deepHunts',
    kind: 'side',
    titleKey: 'obj.deepHunts',
    start: { flag: 'huntsTaken' },
    steps: [
      { textKey: 'obj.deepHunts.spawn', done: { kills: { enemy: 'fondoSpawn', count: 15 } } },
      { textKey: 'obj.deepHunts.report', done: { flag: 'huntSpawnPaid' } },
      { textKey: 'obj.deepHunts.wisps', done: { kills: { enemy: 'hungerWisp', count: 12 } } },
      { textKey: 'obj.deepHunts.report', done: { flag: 'huntWispsPaid' } },
      { textKey: 'obj.deepHunts.echo', done: { bossDefeated: 'abyss2:echo' } },
      { textKey: 'obj.deepHunts.report', done: { flag: 'huntEchoPaid' } },
    ],
  },
];
