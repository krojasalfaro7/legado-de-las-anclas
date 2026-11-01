import { deflateSync, inflateSync } from 'node:zlib';

/** Minimal RGBA PNG encoder/decoder so asset scripts need no dependencies. */
export class RgbaImage {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }

  set(x: number, y: number, rgb: number, alpha = 255): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = (rgb >> 16) & 0xff;
    this.data[i + 1] = (rgb >> 8) & 0xff;
    this.data[i + 2] = rgb & 0xff;
    this.data[i + 3] = alpha;
  }

  /** `[r, g, b, a]`; transparent black outside the image. */
  get(x: number, y: number): [number, number, number, number] {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return [0, 0, 0, 0];
    const i = (y * this.width + x) * 4;
    const d = this.data;
    return [d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0, d[i + 3] ?? 0];
  }

  rect(x: number, y: number, w: number, h: number, rgb: number): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, rgb);
  }

  toPng(): Buffer {
    const raw = Buffer.alloc((this.width * 4 + 1) * this.height);
    for (let y = 0; y < this.height; y++) {
      const row = y * (this.width * 4 + 1);
      raw[row] = 0;
      Buffer.from(this.data.buffer, y * this.width * 4, this.width * 4).copy(raw, row + 1);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Reverses the per-row PNG filters in place; returns one Uint8Array per row. */
function unfilter(raw: Buffer, rowBytes: number, bpp: number, height: number): Uint8Array[] {
  const rows: Uint8Array[] = [];
  let prev = new Uint8Array(rowBytes);
  for (let y = 0; y < height; y++) {
    const start = y * (rowBytes + 1);
    const type = raw[start] ?? 0;
    const row = new Uint8Array(raw.subarray(start + 1, start + 1 + rowBytes));
    for (let i = 0; i < rowBytes; i++) {
      const a = i >= bpp ? (row[i - bpp] ?? 0) : 0;
      const b = prev[i] ?? 0;
      const c = i >= bpp ? (prev[i - bpp] ?? 0) : 0;
      const add = [0, a, b, (a + b) >> 1, paeth(a, b, c)][type];
      if (add === undefined) throw new Error(`filtro PNG desconocido (${type})`);
      row[i] = ((row[i] ?? 0) + add) & 0xff;
    }
    rows.push(row);
    prev = row;
  }
  return rows;
}

/**
 * Decodes a non-interlaced PNG (grayscale, RGB, indexed, gray+alpha or RGBA; 8 bits, or
 * 1/2/4 bits for indexed and grayscale). Throws with a readable message otherwise.
 */
export function decodePng(buf: Buffer): RgbaImage {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('no es un PNG');
  let pos = 8;
  let header: Buffer | null = null;
  let palette: Buffer | null = null;
  let alphas: Buffer | null = null;
  const idat: Buffer[] = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') header = data;
    else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') alphas = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!header) throw new Error('PNG sin cabecera IHDR');
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const depth = header[8] ?? 0;
  const colorType = header[9] ?? 0;
  const channels = CHANNELS[colorType];
  if (channels === undefined) throw new Error(`tipo de color PNG no soportado (${colorType})`);
  if (header[12] !== 0) throw new Error('PNG entrelazado: expórtalo sin entrelazado (interlace)');
  const lowDepth = depth < 8 && (colorType === 0 || colorType === 3);
  if (depth !== 8 && !lowDepth) throw new Error(`profundidad de ${depth} bits no soportada`);
  if (colorType === 3 && !palette) throw new Error('PNG indexado sin paleta');

  const rowBytes = Math.ceil((width * channels * depth) / 8);
  const rows = unfilter(inflateSync(Buffer.concat(idat)), rowBytes, Math.max(1, channels), height);
  const img = new RgbaImage(width, height);
  const sample = (row: Uint8Array, x: number): number => {
    if (depth === 8) return row[x] ?? 0;
    const bit = x * depth;
    return ((row[bit >> 3] ?? 0) >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
  };
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      let r: number;
      let g: number;
      let b: number;
      let a = 255;
      if (colorType === 3) {
        const i = sample(row, x);
        r = palette?.[i * 3] ?? 0;
        g = palette?.[i * 3 + 1] ?? 0;
        b = palette?.[i * 3 + 2] ?? 0;
        a = alphas?.[i] ?? 255;
      } else if (colorType === 0 || colorType === 4) {
        const v = colorType === 0 ? sample(row, x) * (255 / ((1 << depth) - 1)) : (row[x * 2] ?? 0);
        r = g = b = v;
        if (colorType === 4) a = row[x * 2 + 1] ?? 255;
      } else {
        const i = x * channels;
        r = row[i] ?? 0;
        g = row[i + 1] ?? 0;
        b = row[i + 2] ?? 0;
        if (colorType === 6) a = row[i + 3] ?? 255;
      }
      img.set(x, y, (r << 16) | (g << 8) | b, a);
    }
  });
  return img;
}
