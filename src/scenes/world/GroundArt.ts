import type Phaser from 'phaser';
import { type GroundCell, paintGround, surfaceOf } from '../../ui/groundPainter';

/** Built floors painted as a pattern across the room rather than a repeated tile. */
const PATTERNS: Record<string, 'planks' | 'flagstones'> = {
  'wood-floor': 'planks',
  dock: 'planks',
  'stone-floor': 'flagstones',
};
/** Solids that cast a contact shadow on the floor (walls outdoors draw their own face). */
const WALLS = new Set(['stone-wall', 'shelf', 'window', 'hut', 'palisade']);

const nameOf = (tile: Phaser.Tilemaps.Tile | null): string | undefined =>
  (tile?.properties as { name?: string } | undefined)?.name;

/**
 * Replaces the tiled ground with one painted picture (see ui/groundPainter.ts). Water and pits
 * are painted from the collision layer, whose tiles are hidden there; every other collision tile
 * (walls, props) still draws on top. The picture depends only on the map, so it is kept for the
 * session.
 */
export function paintZoneGround(
  scene: Phaser.Scene,
  mapKey: string,
  ground: Phaser.Tilemaps.TilemapLayer,
  collision: Phaser.Tilemaps.TilemapLayer,
): void {
  const { width, height } = ground.layer;
  const cells: Array<GroundCell | null> = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const solid = collision.getTileAt(x, y);
      const solidSurface = surfaceOf(nameOf(solid));
      if (solid && (solidSurface === 'water' || solidSurface === 'void')) {
        solid.setVisible(false);
        cells.push({ tile: solid.index - 1, surface: solidSurface });
        continue;
      }
      const tile = ground.getTileAt(x, y);
      if (!tile) {
        cells.push(null);
        continue;
      }
      const name = nameOf(tile);
      cells.push({
        tile: tile.index - 1,
        surface: surfaceOf(name) ?? 'built',
        pattern: name ? PATTERNS[name] : undefined,
        wall: WALLS.has(nameOf(solid) ?? ''),
      });
    }
  }
  const key = `ground-${mapKey}`;
  if (!scene.textures.exists(key)) {
    const source = scene.textures.get('tiles').getSourceImage() as CanvasImageSource & {
      width: number;
      height: number;
    };
    const read = document.createElement('canvas');
    read.width = source.width;
    read.height = source.height;
    const rctx = read.getContext('2d', { willReadFrequently: true });
    if (!rctx) return;
    rctx.drawImage(source, 0, 0);
    const tiles = {
      data: rctx.getImageData(0, 0, source.width, source.height).data,
      width: source.width,
      columns: Math.floor(source.width / 16),
    };
    const pixels = paintGround(cells, width, height, tiles);
    const canvas = document.createElement('canvas');
    canvas.width = width * 16;
    canvas.height = height * 16;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(pixels, canvas.width, canvas.height), 0, 0);
    scene.textures.addCanvas(key, canvas);
  }
  ground.setVisible(false);
  scene.add.image(0, 0, key).setOrigin(0).setDepth(-9.5);
}
