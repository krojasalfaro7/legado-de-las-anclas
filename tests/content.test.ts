import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/data/characters';
import { COLLECTIBLE_IDS, VALLEY_RELICS } from '../src/data/collectibles';
import { DIALOGUES } from '../src/data/dialogue';
import { ENEMIES } from '../src/data/enemies';
import { ITEMS } from '../src/data/items';
import { KI_TECHNIQUES } from '../src/data/kiTechniques';
import { NPCS } from '../src/data/npcs';
import { ZONES } from '../src/data/zones';
import { es } from '../src/i18n/es';
import { expToNext } from '../src/systems/leveling';

type TiledProp = { name: string; value: string | number | boolean };
type TiledObj = { type: string; name: string; properties?: TiledProp[] };
const objectsOf = (zone: string): TiledObj[] => {
  const map = JSON.parse(readFileSync(`public/assets/maps/${zone}.tmj`, 'utf8'));
  return map.layers.find((l: { type: string }) => l.type === 'objectgroup').objects;
};
const prop = (o: TiledObj, name: string) => o.properties?.find((p) => p.name === name)?.value;

describe('content integrity', () => {
  it('every map object references existing data', () => {
    for (const zone of Object.keys(ZONES)) {
      for (const o of objectsOf(zone)) {
        if (o.type === 'enemy')
          expect(ENEMIES[String(prop(o, 'enemyId'))], `${zone}:${o.name}`).toBeDefined();
        if (o.type === 'npc')
          expect(NPCS[String(prop(o, 'npcId'))], `${zone}:${o.name}`).toBeDefined();
        const item = prop(o, 'itemId');
        if (item !== undefined) expect(ITEMS[String(item)], `${zone}:${o.name}`).toBeDefined();
        const col = prop(o, 'collectibleId');
        if (col !== undefined) expect(COLLECTIBLE_IDS, `${zone}:${o.name}`).toContain(col);
      }
    }
  });

  it('the field holds all 3 collectibles, 4 chests + 1 hidden, a level-5 gate and a boss', () => {
    const objs = objectsOf('field');
    const placed = objs.map((o) => prop(o, 'collectibleId')).filter(Boolean);
    expect(new Set(placed)).toEqual(new Set(VALLEY_RELICS));
    const chests = objs.filter((o) => o.type === 'chest');
    expect(chests.filter((c) => !prop(c, 'hiddenUntilGroupCleared'))).toHaveLength(4);
    expect(chests.filter((c) => prop(c, 'hiddenUntilGroupCleared'))).toHaveLength(1);
    const gate = objs.find((o) => o.type === 'gate' && o.name === 'groveGate');
    expect(prop(gate as TiledObj, 'requiredLevel')).toBe(5);
    expect(
      objs.some((o) => o.type === 'enemy' && ENEMIES[String(prop(o, 'enemyId'))]?.phases),
    ).toBe(true);
  });

  it('a full sweep of the field gives enough EXP to reach level 5', () => {
    const exp = objectsOf('field')
      .filter((o) => o.type === 'enemy')
      .map((o) => ENEMIES[String(prop(o, 'enemyId'))])
      .filter((e) => e && !e.phases)
      .reduce((sum, e) => sum + (e?.exp ?? 0), 0);
    const needed = [1, 2, 3, 4].reduce((s, l) => s + expToNext(l), 0);
    expect(exp).toBeGreaterThanOrEqual(needed);
  });

  it('every string key used by data exists', () => {
    const keys = new Set(Object.keys(es));
    const used = [
      ...Object.values(DIALOGUES).flatMap((d) => d.lines.flatMap((l) => [l.speaker, l.text])),
      ...Object.values(ENEMIES).flatMap((e) => [e.nameKey, e.descKey]),
      ...Object.values(ITEMS).flatMap((i) => [i.nameKey, i.descKey]),
      ...Object.values(KI_TECHNIQUES).map((k) => k.nameKey),
      ...Object.values(NPCS).map((n) => n.nameKey),
      ...Object.values(ZONES).map((z) => z.nameKey),
    ];
    for (const k of used) expect(keys.has(k), k).toBe(true);
  });

  it('NPC rules point at existing dialogues', () => {
    for (const npc of Object.values(NPCS)) {
      for (const rule of npc.rules) expect(DIALOGUES[rule.dialogue], `${npc.id}`).toBeDefined();
    }
  });
});

describe('barriers', () => {
  type MapObj = TiledObj & { x: number; y: number; width?: number; height?: number };
  type TiledMap = {
    width: number;
    height: number;
    tilewidth: number;
    layers: Array<{ name: string; type: string; data?: number[]; objects?: MapObj[] }>;
    tilesets: Array<{ firstgid: number; tiles: Array<{ id: number; properties: TiledProp[] }> }>;
  };

  /**
   * Flood fill from every player spawn. Outdoors it uses flying rules (only tall tiles stop
   * you), the most permissive way to move, so a barrier that holds here holds on foot too.
   */
  const analyze = (zone: string) => {
    const map: TiledMap = JSON.parse(readFileSync(`public/assets/maps/${zone}.tmj`, 'utf8'));
    const ts = map.tilesets[0];
    const rule = ZONES[zone]?.interior ? 'collides' : 'blocksFlight';
    const blocking = new Set(
      (ts?.tiles ?? [])
        .filter((t) => t.properties.some((p) => p.name === rule && p.value === true))
        .map((t) => t.id + (ts?.firstgid ?? 1)),
    );
    const collision = map.layers.find((l) => l.name === 'Collision')?.data ?? [];
    const objects = map.layers.find((l) => l.type === 'objectgroup')?.objects ?? [];
    const cell = (px: number) => Math.floor(px / map.tilewidth);
    const barriers = objects.filter((o) => o.type === 'gate');
    // Exits count: a barrier may guard the way down to another zone.
    const goals = objects.filter((o) =>
      ['chest', 'collectible', 'npc', 'transition'].includes(o.type),
    );
    // Ways back up from a deeper zone are only reached once the barriers before them are open.
    const spawns = objects.filter(
      (o) => o.type === 'playerSpawn' && !o.properties?.some((p) => p.name === 'afterBarriers'),
    );
    const inside = (o: MapObj, x: number, y: number) =>
      x >= cell(o.x) &&
      x < cell(o.x + (o.width ?? 0)) &&
      y >= cell(o.y) &&
      y < cell(o.y + (o.height ?? 0));

    /** Names of the goals reachable while the given barriers stay closed. */
    const reachableGoals = (closed: MapObj[]): Set<string> => {
      const seen = new Set<number>();
      const queue: Array<[number, number]> = spawns.map((s) => [cell(s.x), cell(s.y)]);
      while (queue.length) {
        const [x, y] = queue.pop() as [number, number];
        const k = y * map.width + x;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height || seen.has(k)) continue;
        seen.add(k);
        if (blocking.has(collision[k] ?? 0) || closed.some((b) => inside(b, x, y))) continue;
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      return new Set(
        goals.filter((g) => seen.has(cell(g.y) * map.width + cell(g.x))).map((g) => g.name),
      );
    };
    return { barriers, goals, reachableGoals };
  };

  for (const zone of Object.keys(ZONES)) {
    it(`${zone}: everything is reachable once every barrier is open`, () => {
      const { goals, reachableGoals } = analyze(zone);
      expect([...reachableGoals([])].sort()).toEqual(goals.map((g) => g.name).sort());
    });

    it(`${zone}: no barrier can be skipped, walking or flying`, () => {
      const { barriers, reachableGoals } = analyze(zone);
      const all = reachableGoals([]);
      for (const b of barriers) {
        const hidden = [...all].filter((g) => !reachableGoals([b]).has(g));
        expect(hidden.length, `${zone}:${b.name} guards nothing`).toBeGreaterThan(0);
      }
    });
  }

  it('barrier properties are valid', () => {
    for (const zone of Object.keys(ZONES)) {
      for (const o of objectsOf(zone).filter((x) => x.type === 'gate')) {
        const kind = String(prop(o, 'kind') ?? 'level');
        expect(['level', 'boulder', 'seal', 'vent', 'crawl'], `${zone}:${o.name}`).toContain(kind);
        if (kind === 'seal') {
          expect(prop(o, 'openFlag'), `${zone}:${o.name}`).toBeTruthy();
          expect(
            es[String(prop(o, 'hintKey')) as keyof typeof es],
            `${zone}:${o.name}`,
          ).toBeDefined();
        } else {
          const who = String(
            prop(o, 'requiredCharacter') ?? (kind === 'boulder' ? 'okun' : 'tavi'),
          );
          expect(CHARACTERS[who], `${zone}:${o.name}`).toBeDefined();
        }
      }
    }
  });
});

describe('continent map', () => {
  it('every flight destination has a landmark and every landmark zone exists', async () => {
    const { LANDMARKS } = await import('../src/data/worldMap');
    const onMap = new Set(LANDMARKS.map((i) => i.zone).filter(Boolean));
    for (const zone of Object.values(ZONES)) {
      if (zone.flightSpawn) expect(onMap, zone.id).toContain(zone.id);
    }
    for (const island of LANDMARKS) {
      if (island.zone) expect(ZONES[island.zone], island.id).toBeDefined();
      expect(es[island.nameKey], island.id).toBeDefined();
    }
  });
});

describe('continent reveals', () => {
  it('new places show up on the map when the anchor breaks', async () => {
    const { visibleLandmarks } = await import('../src/data/worldMap');
    const before = visibleLandmarks({}).map((l) => l.id);
    const after = visibleLandmarks({ anchorBroken: true }).map((l) => l.id);
    expect(before).not.toContain('marsh');
    expect(after).toEqual(expect.arrayContaining([...before, 'marsh', 'rift']));
  });
});

describe('continent terrain', () => {
  it('every landmark sits on dry land', async () => {
    const { LANDMARKS, WORLD_MAP } = await import('../src/data/worldMap');
    const { biomeAt } = await import('../src/systems/terrain');
    const w = WORLD_MAP.width / 2;
    const h = WORLD_MAP.height / 2;
    for (const l of LANDMARKS) {
      const biome = biomeAt(Math.floor(l.x / 2), Math.floor(l.y / 2), w, h, WORLD_MAP.seed);
      expect(['deepSea', 'sea', 'river'], l.id).not.toContain(biome);
    }
  });
});
