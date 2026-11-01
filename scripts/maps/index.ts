import { abyssHeartMap, abyssRootsMap } from './abyss.ts';
import { cliffsMap } from './cliffs.ts';
import { cobreMap } from './cobre.ts';
import { fieldMap } from './field.ts';
import { hollowMap } from './hollow.ts';
import { hubMap } from './hub.ts';
import { anchorHeartMap, cobreVaultMap, marshWellMap } from './lairs.ts';
import { marshMap } from './marsh.ts';
import { riftMap } from './rift.ts';
import type { MapSpec } from './types.ts';

export const MAPS: MapSpec[] = [
  hubMap,
  fieldMap,
  cobreMap,
  marshMap,
  riftMap,
  cliffsMap,
  hollowMap,
  cobreVaultMap,
  marshWellMap,
  anchorHeartMap,
  abyssRootsMap,
  abyssHeartMap,
];
