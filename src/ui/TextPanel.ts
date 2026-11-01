import Phaser from 'phaser';
import { FONT_SHADOW } from './pixelFont';

/** Same palette as the dialogue box, so every message reads as part of one UI. */
export const PANEL_STYLE = {
  fill: 0x0c1224,
  fillAlpha: 0.92,
  border: 0xd0d8ff,
  text: 0xffffff,
} as const;

export interface TextPanelOptions {
  /** Which point of the box sits at (x, y): 0 = left/top, 0.5 = center, 1 = right/bottom. */
  originX?: number;
  originY?: number;
  /** Text wraps past this width (pixels, without padding). */
  maxWidth?: number;
  center?: boolean;
  border?: number;
  textTint?: number;
  padX?: number;
  padY?: number;
}

/**
 * A bitmap text on a dark bordered box that resizes to fit it, so short messages (toasts,
 * barrier plaques, map labels) stay readable over grass, stone or water.
 */
export class TextPanel extends Phaser.GameObjects.Container {
  private readonly box: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.BitmapText;
  private readonly opts: Required<Omit<TextPanelOptions, 'maxWidth'>> & { maxWidth?: number };

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    opts: TextPanelOptions = {},
  ) {
    super(scene, x, y);
    this.opts = {
      originX: 0.5,
      originY: 0.5,
      center: true,
      border: PANEL_STYLE.border,
      textTint: PANEL_STYLE.text,
      padX: 6,
      padY: 3,
      ...opts,
    };
    this.box = scene.add
      .rectangle(0, 0, 8, 8, PANEL_STYLE.fill, PANEL_STYLE.fillAlpha)
      .setOrigin(0)
      .setStrokeStyle(1, this.opts.border);
    this.label = scene.add.bitmapText(0, 0, FONT_SHADOW, '').setTint(this.opts.textTint);
    if (this.opts.maxWidth) this.label.setMaxWidth(this.opts.maxWidth);
    if (this.opts.center) this.label.setCenterAlign();
    this.add([this.box, this.label]);
    scene.add.existing(this);
    this.setText(text);
  }

  get text(): string {
    return this.label.text;
  }

  setText(text: string): this {
    this.label.setText(text);
    this.layout();
    return this;
  }

  setBorder(color: number): this {
    this.box.setStrokeStyle(1, color);
    return this;
  }

  setTextTint(color: number): this {
    this.label.setTint(color);
    return this;
  }

  private layout(): void {
    const { padX, padY, originX, originY } = this.opts;
    const b = this.label.getTextBounds().local;
    const w = Math.ceil(b.width) + padX * 2;
    // The font's cell has accent rows on top; trim one so the text sits visually centered.
    const h = Math.ceil(b.height) + padY * 2 - 1;
    const left = -Math.round(w * originX);
    const top = -Math.round(h * originY);
    this.box.setPosition(left, top).setSize(w, h);
    this.label.setPosition(left + padX, top + padY - 1);
    this.setVisible(this.label.text !== '');
  }
}
