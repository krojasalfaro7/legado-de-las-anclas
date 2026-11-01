/**
 * Writes one drawing template per actor sheet to docs/sprite-templates/<key>.png
 * (`npm run sprites:templates`). The sheet area sits at (0, 0) with the exact sheet size, so the
 * finished drawing is exported by cropping the canvas to that size; labels live in the right
 * and bottom margins. Each cell shows a faint ghost of the generated sprite and the guides from
 * docs/SPRITES.md.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { actorFrame, spriteClassOf } from '../src/ui/actorFrames.ts';
import { GLYPHS, SPACE_ADVANCE } from '../src/ui/pixelFontGlyphs.ts';
import {
  FACINGS,
  FEET_BOX,
  FOOT_PAD,
  type FrameSize,
  POSES,
  type Pose,
  sheetSize,
} from '../src/ui/spriteSpec.ts';
import { RgbaImage } from './png.ts';
import { type SheetEntry, sheetCatalog } from './sprites/catalog.ts';
import { FACING_NAMES, POSE_NAMES } from './sprites/validate.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs/sprite-templates');

const MARGIN_RIGHT = 48;
const LINE = 10;
const INK = 0xf0f0f0;
const PANEL = 0x20242e;
const CELL_TINTS = [0xc8d0ff, 0xffe0c0];
const GUIDE_CENTER = 0xff6060;
const GUIDE_FEET = 0xff2020;
const GUIDE_BODY = 0x3a7aff;

const plain = (s: string): string => s.normalize('NFD').replace(/\p{Diacritic}/gu, '');

function textWidth(text: string): number {
  let w = 0;
  for (const ch of plain(text))
    w += ch === ' ' ? SPACE_ADVANCE : (GLYPHS[ch]?.[0]?.length ?? 3) + 1;
  return Math.max(0, w - 1);
}

function drawText(img: RgbaImage, text: string, x: number, y: number, color = INK): void {
  let cx = x;
  for (const ch of plain(text)) {
    const glyph = GLYPHS[ch];
    if (!glyph) {
      cx += SPACE_ADVANCE;
      continue;
    }
    glyph.forEach((row, gy) => {
      for (let gx = 0; gx < row.length; gx++) if (row[gx] === '#') img.set(cx + gx, y + gy, color);
    });
    cx += (glyph[0]?.length ?? 3) + 1;
  }
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function legend(entry: SheetEntry): string[] {
  const { w, h } = entry.frame;
  const box = FEET_BOX[spriteClassOf(entry.look)];
  const code = (p: Pose) => `${POSE_NAMES[p].code} ${POSE_NAMES[p].name}`;
  const half = Math.ceil(POSES.length / 2);
  return [
    `${entry.key}.png - ${entry.label} - frame ${w}x${h}, ${POSES.length}x${FACINGS.length} frames`,
    POSES.slice(0, half).map(code).join('   '),
    POSES.slice(half).map(code).join('   '),
    `Rojo: centro y ultima fila (pies). Azul: cuerpo fisico ${box.w}x${box.h}. ` +
      'Sombra la pone el juego. Max. 15 colores + transparente, 15 bits.',
    `Exporta solo la hoja: recorta el lienzo a ${sheetSize(entry.frame).w}x${sheetSize(entry.frame).h} desde arriba a la izquierda.`,
  ];
}

function drawCell(img: RgbaImage, entry: SheetEntry, col: number, row: number): void {
  const { w, h }: FrameSize = entry.frame;
  const ox = col * w;
  const oy = row * h;
  const tint = CELL_TINTS[(col + row) % 2] ?? 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.set(ox + x, oy + y, tint, 48);
  for (let y = 0; y < h; y++) img.set(ox + Math.floor(w / 2), oy + y, GUIDE_CENTER, 110);
  for (let x = 0; x < w; x++) img.set(ox + x, oy + h - 1, GUIDE_FEET, 150);
  const box = FEET_BOX[spriteClassOf(entry.look)];
  const bx = ox + Math.round((w - box.w) / 2);
  const by = oy + h - box.h - FOOT_PAD;
  for (let x = 0; x < box.w; x++) {
    img.set(bx + x, by, GUIDE_BODY, 150);
    img.set(bx + x, by + box.h - 1, GUIDE_BODY, 150);
  }
  for (let y = 0; y < box.h; y++) {
    img.set(bx, by + y, GUIDE_BODY, 150);
    img.set(bx + box.w - 1, by + y, GUIDE_BODY, 150);
  }
  const ghost = actorFrame(entry.look, FACINGS[row] ?? 'down', POSES[col] ?? 'idle');
  ghost.forEach((line, y) => {
    line.forEach((c, x) => {
      if (c !== null) img.set(ox + x, oy + y, c, 120);
    });
  });
}

function template(entry: SheetEntry): RgbaImage {
  const sheet = sheetSize(entry.frame);
  const width = sheet.w + MARGIN_RIGHT;
  const notes = legend(entry).flatMap((l) => wrap(l, width - 8));
  const img = new RgbaImage(width, sheet.h + LINE + 4 + notes.length * LINE + 4);
  img.rect(sheet.w, 0, MARGIN_RIGHT, img.height, PANEL);
  img.rect(0, sheet.h, width, img.height - sheet.h, PANEL);

  FACINGS.forEach((facing, row) => {
    for (let col = 0; col < POSES.length; col++) drawCell(img, entry, col, row);
    const y = row * entry.frame.h + Math.floor(entry.frame.h / 2) - 4;
    drawText(img, FACING_NAMES[facing], sheet.w + 4, y);
  });
  POSES.forEach((pose, col) => {
    const code = POSE_NAMES[pose].code;
    drawText(
      img,
      code,
      col * entry.frame.w + Math.floor((entry.frame.w - textWidth(code)) / 2),
      sheet.h + 3,
    );
  });
  notes.forEach((line, i) => {
    drawText(img, line, 4, sheet.h + LINE + 6 + i * LINE, i === 0 ? 0xffd34a : INK);
  });
  return img;
}

mkdirSync(outDir, { recursive: true });
for (const entry of sheetCatalog()) {
  const out = join(outDir, `${entry.key}.png`);
  writeFileSync(out, template(entry).toPng());
  console.log(`template ${entry.key} (${entry.label}) -> ${out}`);
}
