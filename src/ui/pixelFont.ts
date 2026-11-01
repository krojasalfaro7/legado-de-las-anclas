import type Phaser from 'phaser';
import { ACCENTS, COMPOSED, GLYPHS, SPACE_ADVANCE } from './pixelFontGlyphs';

export const FONT = 'px';
export const FONT_SHADOW = 'pxs';

/** Rows reserved above the cap height for accents on capitals. */
const ACCENT_ROWS = 2;
const BODY_ROWS = 9;
const CELL_H = ACCENT_ROWS + BODY_ROWS + 1;
const CELL_W = 8;
/** Texture rows per glyph cell: one spare row above for the outline. */
const TEX_CELL_H = CELL_H + 1;
const COLS = 16;

export const FONT_LINE_HEIGHT = CELL_H;

type Bitmap = boolean[][];

function emptyBitmap(width: number): Bitmap {
  return Array.from({ length: CELL_H - 1 }, () => Array<boolean>(width).fill(false));
}

function stamp(target: Bitmap, rows: readonly string[], top: number, left: number): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const line = target[top + y];
      if (row[x] === '#' && line) line[left + x] = true;
    }
  });
}

function buildGlyph(char: string): Bitmap | null {
  const composed = COMPOSED[char];
  const baseChar = composed ? composed[0] : char;
  const base = GLYPHS[baseChar];
  if (!base) return null;
  const width = Math.max(...base.map((r) => r.length));
  const bmp = emptyBitmap(width);
  stamp(bmp, base, ACCENT_ROWS, 0);
  if (composed) {
    const accent = ACCENTS[composed[1]] ?? [];
    const accentWidth = Math.max(...accent.map((r) => r.length));
    const left = Math.max(0, Math.round((width - accentWidth) / 2));
    const isUpper = baseChar.toUpperCase() === baseChar;
    stamp(bmp, accent, isUpper ? 0 : ACCENT_ROWS, left);
  }
  return bmp;
}

/**
 * Bakes the glyph table into a canvas texture and registers a variable-width
 * bitmap font. With `outline`, a 1px black outline (8 neighbors) is baked in so the text reads
 * on any background, and tinting (multiply) keeps it dark; letters get 1px more spacing so
 * neighboring outlines don't merge.
 */
function registerFont(scene: Phaser.Scene, key: string, outline: boolean): void {
  const chars = [...Object.keys(GLYPHS), ...Object.keys(COMPOSED)];
  const rows = Math.ceil((chars.length + 1) / COLS);
  const texW = COLS * CELL_W;
  const texH = rows * TEX_CELL_H;
  const canvasTex = scene.textures.createCanvas(key, texW, texH);
  if (!canvasTex) throw new Error(`Could not create font texture ${key}`);
  const ctx = canvasTex.getContext();

  const charData: Record<number, unknown> = {};
  // Frames include the 1px padding on every side; the offsets put the ink back in place.
  const addChar = (code: number, x: number, y: number, w: number, advance: number): void => {
    charData[code] = {
      x,
      y,
      width: w + 2,
      height: TEX_CELL_H,
      centerX: Math.floor(w / 2),
      centerY: Math.floor(CELL_H / 2),
      xOffset: -1,
      yOffset: -1,
      xAdvance: advance,
      data: {},
      kerning: {},
      u0: x / texW,
      v0: 1 - y / texH,
      u1: (x + w + 2) / texW,
      v1: 1 - (y + TEX_CELL_H) / texH,
    };
  };
  const plot = (bmp: Bitmap, ox: number, oy: number): void => {
    bmp.forEach((line, y) => {
      line.forEach((on, x) => {
        if (on) ctx.fillRect(ox + x, oy + y, 1, 1);
      });
    });
  };

  chars.forEach((char, i) => {
    const bmp = buildGlyph(char);
    if (!bmp) return;
    const cx = (i % COLS) * CELL_W;
    const cy = Math.floor(i / COLS) * TEX_CELL_H;
    if (outline) {
      ctx.fillStyle = '#000000';
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if (dx || dy) plot(bmp, cx + 1 + dx, cy + 1 + dy);
    }
    ctx.fillStyle = '#ffffff';
    plot(bmp, cx + 1, cy + 1);
    const width = bmp[0]?.length ?? 0;
    addChar(char.charCodeAt(0), cx, cy, width, width + (outline ? 2 : 1));
  });
  // Space: points at an empty cell past the last glyph.
  const spaceIndex = chars.length;
  addChar(
    32,
    (spaceIndex % COLS) * CELL_W,
    Math.floor(spaceIndex / COLS) * TEX_CELL_H,
    SPACE_ADVANCE,
    SPACE_ADVANCE + (outline ? 2 : 1),
  );
  canvasTex.refresh();

  const data = { retroFont: false, font: key, size: CELL_H, lineHeight: CELL_H, chars: charData };
  scene.cache.bitmapFont.add(key, { data, texture: key, frame: null });
}

export function registerPixelFonts(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(FONT)) return;
  registerFont(scene, FONT, false);
  registerFont(scene, FONT_SHADOW, true);
}
