import type Phaser from 'phaser';
import { columnX, type Mode7Camera, rowDepth } from '../../systems/mode7';

/** Fog levels precomputed per ground cell; rows pick a level with 2x2 ordered dithering. */
const FOG_LEVELS = 6;
const FOG_START = 160;
const FOG_END = 760;
const BAYER = [0, 0.5, 0.75, 0.25];

/** RGB → little-endian RGBA word for an ImageData Uint32 view. */
function rgba(rgb: number): number {
  return ((0xff << 24) | ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 0xff)) >>> 0;
}

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 0xff) * (1 - t) + ((b >> s) & 0xff) * t) & 0xff;
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export interface GroundSpec {
  /** Ground colors (RGB) per cell, row-major. */
  cells: Uint32Array;
  cols: number;
  rows: number;
  /** Map px per cell. */
  cell: number;
  /** Colors outside the map (checker), e.g. the open sea. */
  outside: readonly [number, number];
  haze: number;
  skyTop: number;
}

/**
 * Draws the sky and the perspective ground into one canvas texture every frame. The view is
 * small (≤480×270) and the inner loop is integer lookups, so it runs comfortably on the CPU.
 */
export class Mode7Ground {
  readonly key = 'world-mode7';
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tex: Phaser.Textures.CanvasTexture;
  private readonly image: ImageData;
  private readonly pixels: Uint32Array;
  private readonly levels: Uint32Array[];
  private readonly outside: number[][];
  private readonly sky: Uint32Array;
  /** Horizon row the sky gradient was baked for; a higher horizon reads it shifted down. */
  private readonly skyHorizon: number;

  constructor(
    scene: Phaser.Scene,
    private readonly spec: GroundSpec,
    private readonly width: number,
    private readonly height: number,
    horizon: number,
  ) {
    if (scene.textures.exists(this.key)) scene.textures.remove(this.key);
    const tex = scene.textures.createCanvas(this.key, width, height);
    if (!tex) throw new Error('Could not create the map texture');
    this.tex = tex;
    this.ctx = tex.getContext();
    this.image = this.ctx.createImageData(width, height);
    this.pixels = new Uint32Array(this.image.data.buffer);
    this.levels = Array.from({ length: FOG_LEVELS }, (_, l) => {
      const t = l / (FOG_LEVELS - 1);
      return spec.cells.map((c) => rgba(mix(c, spec.haze, t)));
    });
    this.outside = Array.from({ length: FOG_LEVELS }, (_, l) =>
      spec.outside.map((c) => rgba(mix(c, spec.haze, l / (FOG_LEVELS - 1)))),
    );
    this.skyHorizon = horizon;
    this.sky = new Uint32Array(height);
    for (let y = 0; y < height; y++) {
      // Banded gradient down to the haze at the horizon, in flat steps like the title sky.
      const t = Math.min(1, Math.floor((y / Math.max(1, horizon)) * 8) / 7);
      this.sky[y] = rgba(mix(spec.skyTop, spec.haze, t));
    }
  }

  render(cam: Mode7Camera): void {
    const { width, height, pixels, spec } = this;
    const horizon = Math.floor(cam.horizon);
    const top = Math.max(0, Math.min(height, horizon + 1));
    // Keep the haze band at the horizon wherever it is.
    const shift = this.skyHorizon - horizon;
    for (let y = 0; y < top; y++) {
      const sky = this.sky[Math.max(0, Math.min(height - 1, y + shift))] ?? 0;
      pixels.fill(sky, y * width, (y + 1) * width);
    }
    for (let y = top; y < height; y++) {
      const z = rowDepth(cam, y);
      const fog = Math.min(1, Math.max(0, (z - FOG_START) / (FOG_END - FOG_START)));
      const f = fog * (FOG_LEVELS - 1);
      const base = Math.floor(f);
      const frac = f - base;
      const wy = cam.y - z;
      const cy = Math.floor(wy / spec.cell);
      const rowInside = cy >= 0 && cy < spec.rows;
      const x0 = columnX(cam, 0, z);
      const dx = z / cam.focal;
      const rowStart = y * width;
      for (let x = 0; x < width; x++) {
        const level = frac > (BAYER[((y & 1) << 1) | (x & 1)] ?? 0) ? base + 1 : base;
        const cx = Math.floor((x0 + x * dx) / spec.cell);
        const l = Math.min(FOG_LEVELS - 1, level);
        pixels[rowStart + x] =
          rowInside && cx >= 0 && cx < spec.cols
            ? (this.levels[l]?.[cy * spec.cols + cx] ?? 0)
            : (this.outside[l]?.[(cx + cy) & 1] ?? 0);
      }
    }
    this.ctx.putImageData(this.image, 0, 0);
    this.tex.refresh();
  }
}
