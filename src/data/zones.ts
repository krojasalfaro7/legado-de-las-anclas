import type { ZoneDef } from './types';

export const ZONES: Record<string, ZoneDef> = {
  hub: {
    id: 'hub',
    music: 'hub',
    mapKey: 'hub',
    nameKey: 'zone.hub',
    interior: true,
    flightSpawn: 'flight',
  },
  field: {
    id: 'field',
    music: 'field',
    mapKey: 'field',
    nameKey: 'zone.field',
    interior: false,
    unlockFlag: 'missionAccepted',
    flightSpawn: 'flight',
  },
  cobre: {
    id: 'cobre',
    music: 'cobre',
    mapKey: 'cobre',
    nameKey: 'zone.cobre',
    interior: false,
    unlockFlag: 'missionReported',
    flightSpawn: 'flight',
  },
  marsh: {
    id: 'marsh',
    music: 'marsh',
    mapKey: 'marsh',
    nameKey: 'zone.marsh',
    interior: false,
    unlockFlag: 'marshBriefed',
    flightSpawn: 'flight',
  },
  rift: {
    id: 'rift',
    music: 'rift',
    mapKey: 'rift',
    nameKey: 'zone.rift',
    interior: false,
    unlockFlag: 'riftBriefed',
    flightSpawn: 'flight',
  },
  cliffs: {
    id: 'cliffs',
    music: 'cliffs',
    mapKey: 'cliffs',
    nameKey: 'zone.cliffs',
    interior: false,
    unlockFlag: 'siegeStarted',
    flightSpawn: 'flight',
  },
  // Tavi alone under the land (chapter 7): no flight circle, the way out is the story.
  hollow: {
    id: 'hollow',
    music: 'hollow',
    mapKey: 'hollow',
    nameKey: 'zone.hollow',
    interior: true,
    solo: 'tavi',
  },
  // Arc 3: the three anchor lights' lairs, reached on foot from known regions.
  cobreVault: {
    id: 'cobreVault',
    music: 'lairs',
    mapKey: 'cobreVault',
    nameKey: 'zone.cobreVault',
    interior: true,
  },
  marshWell: {
    id: 'marshWell',
    music: 'lairs',
    mapKey: 'marshWell',
    nameKey: 'zone.marshWell',
    interior: true,
  },
  anchorHeart: {
    id: 'anchorHeart',
    music: 'lairs',
    mapKey: 'anchorHeart',
    nameKey: 'zone.anchorHeart',
    interior: true,
  },
  // Arc 3: El Fondo, under La Grieta's vein (the way down opens with `fondoOpen`).
  abyss1: {
    id: 'abyss1',
    music: 'abyss',
    mapKey: 'abyss1',
    nameKey: 'zone.abyss1',
    interior: true,
  },
  abyss2: {
    id: 'abyss2',
    music: 'abyss',
    mapKey: 'abyss2',
    nameKey: 'zone.abyss2',
    interior: true,
  },
};

export const DEFAULT_ZONE = 'hub';
