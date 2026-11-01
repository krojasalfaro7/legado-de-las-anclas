import type Phaser from 'phaser';
import { audio } from '../services/audio';
import { input } from '../services/input';
import { FONT_SHADOW } from './pixelFont';

export interface MenuItem {
  label: string;
  /** Right-aligned value column. */
  value?: string;
  disabled?: boolean;
  color?: number;
}

const CURSOR = '▶';

/** Vertical list with a cursor, navigated with up/down (auto-repeat). */
export class MenuList {
  index = 0;
  private readonly rows: Phaser.GameObjects.BitmapText[] = [];
  private readonly values: Phaser.GameObjects.BitmapText[] = [];
  private readonly cursor: Phaser.GameObjects.BitmapText;
  private items: MenuItem[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly width: number,
    private readonly rowHeight = 12,
  ) {
    this.cursor = scene.add.bitmapText(x, y, FONT_SHADOW, CURSOR).setTint(0xffd34a);
  }

  setItems(items: MenuItem[]): void {
    this.items = items;
    this.index = Math.min(this.index, Math.max(0, items.length - 1));
    items.forEach((item, i) => {
      const row = this.rows[i] ?? this.scene.add.bitmapText(this.x + 8, 0, FONT_SHADOW, '');
      const val =
        this.values[i] ??
        this.scene.add.bitmapText(this.x + this.width, 0, FONT_SHADOW, '').setOrigin(1, 0);
      this.rows[i] = row;
      this.values[i] = val;
      const color = item.disabled ? 0x808080 : (item.color ?? 0xffffff);
      row
        .setText(item.label)
        .setY(this.y + i * this.rowHeight)
        .setTint(color)
        .setVisible(true);
      val
        .setText(item.value ?? '')
        .setY(this.y + i * this.rowHeight)
        .setTint(color)
        .setVisible(true);
    });
    for (let i = items.length; i < this.rows.length; i++) {
      this.rows[i]?.setVisible(false);
      this.values[i]?.setVisible(false);
    }
    this.refreshCursor();
  }

  /** Handles navigation; returns true if the cursor moved. */
  update(active = true): boolean {
    this.cursor.setVisible(active && this.items.length > 0);
    if (!active || this.items.length === 0) return false;
    let moved = false;
    if (input.menuPressed('up')) {
      this.index = (this.index - 1 + this.items.length) % this.items.length;
      moved = true;
    } else if (input.menuPressed('down')) {
      this.index = (this.index + 1) % this.items.length;
      moved = true;
    }
    if (moved) {
      this.refreshCursor();
      audio.play('menuMove');
    }
    return moved;
  }

  private refreshCursor(): void {
    this.cursor.setY(this.y + this.index * this.rowHeight);
  }

  destroy(): void {
    for (const r of this.rows) r.destroy();
    for (const v of this.values) v.destroy();
    this.cursor.destroy();
  }
}
