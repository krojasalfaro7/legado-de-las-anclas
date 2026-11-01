import type Phaser from 'phaser';
import {
  BOULDER_KEYS,
  type CliffKind,
  cliffFaceKey,
  generateSceneryTextures,
  PILLAR_VARIANTS,
  pillarKey,
  TREE_KEYS,
} from '../../ui/sceneryTextures';

/** Canopies fade to this when someone walks behind them. */
const BEHIND_ALPHA = 0.5;

const nameOf = (tile: Phaser.Tilemaps.Tile | null): string | undefined =>
  (tile?.properties as { name?: string } | undefined)?.name;

/** Small, stable per-tile variation (same look every visit). */
const hash = (x: number, y: number): number => ((x * 73856093) ^ (y * 19349663)) >>> 0;

/**
 * Replaces the small tile art of trees, boulders and rock walls with full-size scenery: the tile
 * keeps its collision (a tree's trunk, a boulder's base) while a big sprite stands on it, sorted
 * by depth with the actors. Walls get a face on their south edge so they read as having height.
 */
export class Scenery {
  /** Tall scenery (trees, pillars) that fades when an actor is behind it. */
  private readonly occluders: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly collision: Phaser.Tilemaps.TilemapLayer,
  ) {
    generateSceneryTextures(scene);
    collision.forEachTile((tile) => {
      if (tile.index <= 0) return;
      switch (nameOf(tile)) {
        case 'tree':
          this.addTree(tile);
          break;
        case 'boulder':
          this.addBoulder(tile);
          break;
        case 'pillar':
          this.addPillar(tile, 'rock');
          break;
        case 'canyon-pillar':
          this.addPillar(tile, 'canyon');
          break;
        case 'rock-wall':
          this.addFace(tile, 'rock-wall', 'rock');
          break;
        case 'canyon-wall':
          this.addFace(tile, 'canyon-wall', 'canyon');
          break;
        case 'rift-wall':
          this.addFace(tile, 'rift-wall', 'basalt');
          break;
        case 'deep-wall':
          this.addFace(tile, 'deep-wall', 'deep');
          break;
        case 'abyss-wall':
          this.addFace(tile, 'abyss-wall', 'abyss');
          break;
        default:
          break;
      }
    });
  }

  private addTree(tile: Phaser.Tilemaps.Tile): void {
    tile.setVisible(false);
    const h = hash(tile.x, tile.y);
    const key = TREE_KEYS[h % TREE_KEYS.length] ?? TREE_KEYS[0];
    // Stand on the tile's bottom edge, nudged a little so forests don't look like a grid.
    const x = tile.pixelX + tile.width / 2 + ((h >> 4) % 5) - 2;
    const y = tile.pixelY + tile.height + 1;
    const tree = this.scene.add
      .image(x, y, key)
      .setOrigin(0.5, 1)
      .setFlipX(((h >> 8) & 1) === 1)
      .setDepth(y);
    this.occluders.push(tree);
  }

  private addBoulder(tile: Phaser.Tilemaps.Tile): void {
    tile.setVisible(false);
    const h = hash(tile.x, tile.y);
    const key = BOULDER_KEYS[h % BOULDER_KEYS.length] ?? BOULDER_KEYS[0];
    const y = tile.pixelY + tile.height;
    this.scene.add
      .image(tile.pixelX + tile.width / 2, y, key)
      .setOrigin(0.5, 1)
      .setFlipX(((h >> 8) & 1) === 1)
      .setDepth(y);
  }

  /** A tall rock column standing on its tile; it fades like a canopy when someone is behind. */
  private addPillar(tile: Phaser.Tilemaps.Tile, kind: 'rock' | 'canyon'): void {
    tile.setVisible(false);
    const h = hash(tile.x, tile.y);
    const y = tile.pixelY + tile.height + 1;
    const pillar = this.scene.add
      .image(tile.pixelX + tile.width / 2, y, pillarKey(kind, h % PILLAR_VARIANTS))
      .setOrigin(0.5, 1)
      .setFlipX(((h >> 8) & 1) === 1)
      .setDepth(y);
    this.occluders.push(pillar);
  }

  /**
   * A wall tile with open ground to its south shows its face instead of its top: two tiles tall
   * when the wall is thick enough, lit along its top edge, casting a shadow on the ground.
   */
  private addFace(tile: Phaser.Tilemaps.Tile, wall: string, kind: CliffKind): void {
    const isWall = (x: number, y: number) => nameOf(this.collision.getTileAt(x, y)) === wall;
    if (isWall(tile.x, tile.y + 1) || tile.y + 1 >= this.collision.layer.height) return;
    const tall = isWall(tile.x, tile.y - 1) && isWall(tile.x, tile.y - 2);
    const put = (y: number, part: 'lower' | 'lowerRim' | 'upper') =>
      this.scene.add.image(tile.pixelX, y, cliffFaceKey(kind, part)).setOrigin(0).setDepth(-8);
    put(tile.pixelY, tall ? 'lower' : 'lowerRim');
    if (tall) put(tile.pixelY - tile.height, 'upper');
    this.scene.add
      .rectangle(tile.pixelX, tile.pixelY + tile.height, tile.width, 4, 0x000000, 0.22)
      .setOrigin(0)
      .setDepth(-8);
  }

  /** Fades canopies that hide whoever is standing behind them. */
  update(actors: ReadonlyArray<{ x: number; y: number; footY: number }>): void {
    for (const tree of this.occluders) {
      const hides = actors.some(
        (a) =>
          a.footY < tree.y - 4 &&
          Math.abs(a.x - tree.x) < tree.width * 0.42 &&
          a.y > tree.y - tree.height &&
          a.y < tree.y,
      );
      tree.setAlpha(hides ? BEHIND_ALPHA : 1);
    }
  }
}
