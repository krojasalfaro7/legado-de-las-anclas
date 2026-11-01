/**
 * Compiles ASCII map specs (scripts/maps/*.ts) into Tiled JSON maps (.tmj) with the
 * placeholder tileset embedded (Phaser cannot load external tilesets).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAPS } from './maps/index.ts';
import { LEGEND, type MapSpec, type PropValue } from './maps/types.ts';
import { TILE_SIZE, TILES, TILESET_NAME, tileIndex } from './tiles.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tilesetPath = join(root, `public/assets/tilesets/${TILESET_NAME}.tsj`);
const tileset = JSON.parse(readFileSync(tilesetPath, 'utf8')) as Record<string, unknown>;

function tiledProps(props: Record<string, PropValue> | undefined): unknown[] {
  return Object.entries(props ?? {}).map(([name, value]) => ({
    name,
    type:
      typeof value === 'boolean'
        ? 'bool'
        : typeof value === 'number'
          ? Number.isInteger(value)
            ? 'int'
            : 'float'
          : 'string',
    value,
  }));
}

function compile(spec: MapSpec): Record<string, unknown> {
  const height = spec.rows.length;
  const width = Math.max(...spec.rows.map((r) => r.length));
  spec.rows.forEach((r, y) => {
    if (r.length !== width)
      throw new Error(`${spec.id}: row ${y} has ${r.length} chars, expected ${width}`);
  });
  const ground: number[] = [];
  const collision: number[] = [];
  const base = tileIndex(spec.baseGround) + 1;

  const gidAt = (x: number, y: number): number => {
    const ch = spec.rows[y]?.[x] ?? ' ';
    const name = LEGEND[ch];
    if (!name) throw new Error(`${spec.id}: unknown map char '${ch}' at ${x},${y}`);
    return tileIndex(name) + 1;
  };
  const isSolid = (gid: number) => TILES[gid - 1]?.collides ?? false;

  /** Object tiles are transparent around their shape: put the most common nearby ground under. */
  const groundUnder = (x: number, y: number): number => {
    for (let r = 1; r <= 3; r++) {
      const counts = new Map<number, number>();
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const g = gidAt(nx, ny);
          if (!isSolid(g)) counts.set(g, (counts.get(g) ?? 0) + 1);
        }
      }
      const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
      if (best) return best[0];
    }
    return base;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gid = gidAt(x, y);
      const solid = isSolid(gid);
      ground.push(solid ? groundUnder(x, y) : gid);
      collision.push(solid ? gid : 0);
    }
  }

  let nextId = 1;
  const objects = spec.objects.map((o) => {
    const isPoint = o.w === undefined && o.h === undefined;
    return {
      id: nextId++,
      name: o.name ?? '',
      type: o.type,
      x: isPoint ? (o.x + 0.5) * TILE_SIZE : o.x * TILE_SIZE,
      y: isPoint ? (o.y + 0.5) * TILE_SIZE : o.y * TILE_SIZE,
      width: isPoint ? 0 : (o.w ?? 1) * TILE_SIZE,
      height: isPoint ? 0 : (o.h ?? 1) * TILE_SIZE,
      rotation: 0,
      visible: true,
      ...(isPoint ? { point: true } : {}),
      properties: tiledProps(o.props),
    };
  });

  const layer = (id: number, name: string, data: number[]) => ({
    id,
    name,
    type: 'tilelayer',
    width,
    height,
    x: 0,
    y: 0,
    opacity: 1,
    visible: true,
    data,
  });

  return {
    type: 'map',
    version: '1.10',
    tiledversion: '1.11.0',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    width,
    height,
    tilewidth: TILE_SIZE,
    tileheight: TILE_SIZE,
    infinite: false,
    nextlayerid: 4,
    nextobjectid: nextId,
    properties: tiledProps(spec.props),
    tilesets: [{ firstgid: 1, ...tileset, image: `../tilesets/${TILESET_NAME}.png` }],
    layers: [
      layer(1, 'Ground', ground),
      layer(2, 'Collision', collision),
      {
        id: 3,
        name: 'Objects',
        type: 'objectgroup',
        draworder: 'topdown',
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        objects,
      },
    ],
  };
}

for (const spec of MAPS) {
  const out = join(root, `public/assets/maps/${spec.id}.tmj`);
  writeFileSync(out, `${JSON.stringify(compile(spec))}\n`);
  console.log(`map ${spec.id}: ${spec.rows[0]?.length}x${spec.rows.length} -> ${out}`);
}
