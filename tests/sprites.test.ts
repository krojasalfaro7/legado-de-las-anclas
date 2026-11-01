import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePng, RgbaImage } from '../scripts/png';
import { sheetCatalog } from '../scripts/sprites/catalog';
import { validateSheet } from '../scripts/sprites/validate';
import { actorFrame } from '../src/ui/actorFrames';
import {
  FACINGS,
  FRAME_SIZES,
  GROUNDED_POSES,
  is15BitChannel,
  POSES,
  sheetSize,
} from '../src/ui/spriteSpec';

const FRAME = FRAME_SIZES.humanoid;

/** A valid sheet: a 2-color figure in every frame, standing on the last row. */
function validSheet(): RgbaImage {
  const size = sheetSize(FRAME);
  const img = new RgbaImage(size.w, size.h);
  for (let row = 0; row < FACINGS.length; row++) {
    for (let col = 0; col < POSES.length; col++) {
      const ox = col * FRAME.w;
      const oy = row * FRAME.h;
      img.rect(ox + 8, oy + 4, 8, FRAME.h - 4, 0x181818);
      img.rect(ox + 9, oy + 5, 6, FRAME.h - 6, 0xf8a050);
    }
  }
  return img;
}

describe('sprite sheet validator', () => {
  it('accepts a sheet that follows the spec', () => {
    expect(validateSheet(validSheet(), FRAME)).toEqual({ errors: [], warnings: [] });
  });

  it('rejects the wrong size and says the right one', () => {
    const { errors } = validateSheet(new RgbaImage(16 * 14, 24 * 4), FRAME);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('336×128');
  });

  it('rejects semi-transparent pixels and colors outside 15 bits', () => {
    const img = validSheet();
    img.set(10, 10, 0xf8a050, 128);
    img.set(11, 10, 0xf8a051);
    const { errors } = validateSheet(img, FRAME);
    expect(errors.some((e) => e.includes('semitransparentes'))).toBe(true);
    expect(errors.some((e) => e.includes('#f8a051'))).toBe(true);
  });

  it('rejects more than 15 opaque colors', () => {
    const img = validSheet();
    for (let i = 0; i < 14; i++) img.set(10 + i, 12, (i + 1) << 3);
    expect(validateSheet(img, FRAME).errors.some((e) => e.includes('16 colores'))).toBe(true);
  });

  it('reports empty frames by facing and pose', () => {
    const img = validSheet();
    const ox = POSES.indexOf('block') * FRAME.w;
    const oy = FACINGS.indexOf('up') * FRAME.h;
    for (let y = 0; y < FRAME.h; y++)
      for (let x = 0; x < FRAME.w; x++) img.set(ox + x, oy + y, 0, 0);
    expect(validateSheet(img, FRAME).errors).toEqual([
      `frame vacío: fila «arriba», pose «bloqueo» (x ${ox}, y ${oy})`,
    ]);
  });

  it('warns when a grounded pose does not touch the last row', () => {
    const img = validSheet();
    for (let x = 0; x < FRAME.w; x++) img.set(x, FRAME.h - 1, 0, 0);
    const { errors, warnings } = validateSheet(img, FRAME);
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('«abajo», pose «reposo 1»');
  });
});

describe('png decoder', () => {
  it('round-trips the RGBA encoder', () => {
    const img = validSheet();
    img.set(0, 0, 0x123456, 255);
    const back = decodePng(img.toPng());
    expect(back.width).toBe(img.width);
    expect(Buffer.from(back.data).equals(Buffer.from(img.data))).toBe(true);
  });

  it('reads 4-bit indexed PNGs with transparency and filters', () => {
    // 3x2 image, palette [transparent, red, blue]; row 0 unfiltered, row 1 with the Sub filter.
    const chunk = (type: string, data: Buffer) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length);
      return Buffer.concat([len, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
    };
    const ihdr = Buffer.from([0, 0, 0, 3, 0, 0, 0, 2, 4, 3, 0, 0, 0]);
    const raw = Buffer.from([0, 0x01, 0x20, 1, 0x21, 0xf0]);
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('PLTE', Buffer.from([0, 0, 0, 0xf8, 0, 0, 0, 0, 0xf8])),
      chunk('tRNS', Buffer.from([0])),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]);
    const img = decodePng(png);
    expect(img.get(0, 0)).toEqual([0, 0, 0, 0]);
    expect(img.get(1, 0)).toEqual([0xf8, 0, 0, 255]);
    expect(img.get(2, 0)).toEqual([0, 0, 0xf8, 255]);
    // Sub filter: bytes 0x21, 0xf0 decode to 0x21, 0x11 -> indices 2, 1, 1.
    expect(img.get(0, 1)).toEqual([0, 0, 0xf8, 255]);
    expect(img.get(1, 1)).toEqual([0xf8, 0, 0, 255]);
    expect(img.get(2, 1)).toEqual([0xf8, 0, 0, 255]);
  });

  it('explains interlaced files', () => {
    const img = new RgbaImage(1, 1).toPng();
    img[8 + 8 + 12] = 1;
    expect(() => decodePng(img)).toThrow(/entrelazado/);
  });
});

describe('generated sheets follow the same spec', () => {
  for (const entry of sheetCatalog()) {
    it(`${entry.key} has ${entry.frame.w}x${entry.frame.h} frames standing on the last row`, () => {
      for (const facing of FACINGS) {
        for (const pose of POSES) {
          const grid = actorFrame(entry.look, facing, pose);
          expect(grid).toHaveLength(entry.frame.h);
          expect(grid.every((row) => row.length === entry.frame.w)).toBe(true);
          const colors = grid.flat().filter((c): c is number => c !== null);
          expect(colors.length).toBeGreaterThan(0);
          expect(
            colors.every((c) => [16, 8, 0].every((s) => is15BitChannel((c >> s) & 0xff))),
          ).toBe(true);
          if (GROUNDED_POSES.includes(pose))
            expect(
              grid[entry.frame.h - 1]?.some((c) => c !== null),
              `${facing} ${pose}`,
            ).toBe(true);
        }
      }
    });
  }
});
