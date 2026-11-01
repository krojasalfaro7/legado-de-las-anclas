/** Tiny ASCII painter so larger maps can be described with shapes instead of 40 hand-typed rows. */
export class AsciiCanvas {
  private readonly grid: string[][];
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number, fill: string) {
    this.width = width;
    this.height = height;
    this.grid = Array.from({ length: height }, () => Array<string>(width).fill(fill));
  }

  set(x: number, y: number, ch: string): this {
    const row = this.grid[y];
    if (row && x >= 0 && x < this.width) row[x] = ch;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, ch: string): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, ch);
    return this;
  }

  /** Hollow rectangle outline. */
  frame(x: number, y: number, w: number, h: number, ch: string): this {
    this.rect(x, y, w, 1, ch).rect(x, y + h - 1, w, 1, ch);
    return this.rect(x, y, 1, h, ch).rect(x + w - 1, y, 1, h, ch);
  }

  hline(x0: number, x1: number, y: number, ch: string, thickness = 1): this {
    return this.rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, thickness, ch);
  }

  vline(x: number, y0: number, y1: number, ch: string, thickness = 1): this {
    return this.rect(x, Math.min(y0, y1), thickness, Math.abs(y1 - y0) + 1, ch);
  }

  /** Deterministic sprinkle of `ch` over cells currently equal to `onlyOn`. */
  scatter(
    x: number,
    y: number,
    w: number,
    h: number,
    ch: string,
    density: number,
    seed: number,
    onlyOn: string,
  ): this {
    let s = seed >>> 0;
    const rand = (): number => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (rand() < density && this.grid[yy]?.[xx] === onlyOn) this.set(xx, yy, ch);
      }
    }
    return this;
  }

  rows(): string[] {
    return this.grid.map((r) => r.join(''));
  }
}
