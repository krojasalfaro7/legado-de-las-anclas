/** Every actor sheet the game can draw, with the look used for its generated version. */
import { CHARACTERS } from '../../src/data/characters.ts';
import { ENEMIES } from '../../src/data/enemies.ts';
import { NPCS } from '../../src/data/npcs.ts';
import { es } from '../../src/i18n/es.ts';
import { type ActorLook, frameSizeOf } from '../../src/ui/actorFrames.ts';
import { type FrameSize, SHEET_KEYS } from '../../src/ui/spriteSpec.ts';

export interface SheetEntry {
  key: string;
  /** Who it is, for messages and template labels. */
  label: string;
  look: ActorLook;
  frame: FrameSize;
}

const name = (key: string): string => (es as Record<string, string>)[key] ?? key;

function entry(key: string, label: string, look: ActorLook): SheetEntry {
  return { key, label, look, frame: frameSizeOf(look) };
}

export function sheetCatalog(): SheetEntry[] {
  const list: SheetEntry[] = [];
  for (const c of Object.values(CHARACTERS)) {
    list.push(entry(SHEET_KEYS.character(c.id), name(c.nameKey), c.look));
    for (const tr of c.transformations) {
      const label = `${name(c.nameKey)} (${name(tr.nameKey)})`;
      list.push(entry(SHEET_KEYS.character(c.id, tr.id), label, tr.look));
    }
  }
  for (const n of Object.values(NPCS))
    list.push(entry(SHEET_KEYS.npc(n.id), name(n.nameKey), n.look));
  for (const e of Object.values(ENEMIES)) {
    list.push(entry(SHEET_KEYS.enemy(e.id), name(e.nameKey), e.look));
    e.phases?.forEach((p, i) => {
      if (!p.look) return;
      const label = `${name(e.nameKey)} (${name(p.nameKey ?? e.nameKey)}, fase ${i + 1})`;
      list.push(entry(SHEET_KEYS.enemy(e.id, i), label, p.look));
    });
  }
  return list;
}
