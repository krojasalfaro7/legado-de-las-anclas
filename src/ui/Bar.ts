import type Phaser from 'phaser';

/** Simple segmented-look resource bar drawn with rectangles. */
export class Bar {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly lag: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private shown = -1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly w: number,
    h: number,
    color: number,
  ) {
    this.bg = scene.add.rectangle(x - 1, y - 1, w + 2, h + 2, 0x000000).setOrigin(0);
    this.lag = scene.add.rectangle(x, y, w, h, 0xffffff).setOrigin(0).setAlpha(0.6);
    this.fill = scene.add.rectangle(x, y, w, h, color).setOrigin(0);
  }

  setColor(color: number): void {
    this.fill.setFillStyle(color);
  }

  /** `lagging` keeps a white trail that catches up, so damage chunks are visible. */
  set(fraction: number, lagging = true): void {
    const f = Math.max(0, Math.min(1, fraction));
    const px = Math.round(this.w * f);
    this.fill.width = px;
    if (!lagging || this.shown < 0 || px > this.shown) this.shown = px;
    else this.shown = Math.max(px, this.shown - 0.6);
    this.lag.width = Math.round(this.shown);
  }

  setVisible(v: boolean): void {
    this.bg.setVisible(v);
    this.lag.setVisible(v);
    this.fill.setVisible(v);
  }
}
