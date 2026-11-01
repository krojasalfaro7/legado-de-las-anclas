import { describe, expect, it } from 'vitest';
import { type GroundCell, paintGround, surfaceOf } from '../src/ui/groundPainter';

/** A fake 3-tile tileset: solid red (grass), green (dirt) and blue (water). */
function tileset() {
  const width = 48;
  const data = new Uint8ClampedArray(width * 16 * 4);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const t = Math.floor(x / 16);
      data[i] = t === 0 ? 200 : 0;
      data[i + 1] = t === 1 ? 200 : 0;
      data[i + 2] = t === 2 ? 200 : 0;
      data[i + 3] = 255;
    }
  return { data, width, columns: 3 };
}

const grass: GroundCell = { tile: 0, surface: 'grass' };
const dirt: GroundCell = { tile: 1, surface: 'dirt' };
const pixel = (out: Uint8ClampedArray, w: number, x: number, y: number) => {
  const i = (y * w * 16 + x) * 4;
  return [out[i], out[i + 1], out[i + 2]];
};

describe('ground painter', () => {
  it('lets a higher terrain spill over the edge of a lower one, never the reverse', () => {
    const out = paintGround([grass, dirt], 2, 1, tileset());
    // Just past the shared edge, inside the dirt tile, it's grass (red channel).
    expect(pixel(out, 2, 16, 8)[0]).toBeGreaterThan(100);
    // Far into the dirt tile it's dirt.
    expect(pixel(out, 2, 30, 8)[1]).toBeGreaterThan(100);
    // The grass tile keeps its own color right up to the edge.
    expect(pixel(out, 2, 15, 8)[0]).toBeGreaterThan(100);
    expect(pixel(out, 2, 15, 8)[1]).toBe(0);
  });

  it('is the same picture every time', () => {
    const a = paintGround([grass, dirt, dirt, grass], 2, 2, tileset());
    const b = paintGround([grass, dirt, dirt, grass], 2, 2, tileset());
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('keeps built floors square and leaves non-ground cells empty', () => {
    const floor: GroundCell = { tile: 1, surface: 'built' };
    const out = paintGround([grass, floor, null], 3, 1, tileset());
    expect(pixel(out, 3, 16, 8)[1]).toBeGreaterThan(100);
    expect(out[(8 * 48 + 40) * 4 + 3]).toBe(0);
    expect(surfaceOf('rock-wall')).toBeNull();
    expect(surfaceOf('meadow')).toBe('grass');
  });
});
