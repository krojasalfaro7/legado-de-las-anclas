import type Phaser from 'phaser';
import { t } from '../../i18n';
import { audio } from '../../services/audio';
import { input } from '../../services/input';
import { options } from '../../services/options';
import { MenuList } from '../../ui/MenuList';
import { FONT_SHADOW } from '../../ui/pixelFont';
import type { TabView } from './types';

const VOLUME_STEP = 0.1;

export class OptionsTab implements TabView {
  private readonly list: MenuList;
  private readonly hint: Phaser.GameObjects.BitmapText;
  /** The volume row being adjusted with left/right, if any. */
  private editing: 'volume' | 'music' | null = null;

  constructor(scene: Phaser.Scene, area: Phaser.Geom.Rectangle) {
    this.list = new MenuList(scene, area.x + 4, area.y + 2, area.width - 12, 14);
    this.hint = scene.add
      .bitmapText(area.x + 4, area.bottom - 12, FONT_SHADOW, t('options.hint'))
      .setTint(0xa0a0b0);
    this.refresh();
  }

  private refresh(): void {
    const row = (key: 'volume' | 'music', label: string) => {
      const bars = Math.round(options[key] * 10);
      const bar = `${'|'.repeat(bars)}${'.'.repeat(10 - bars)} ${bars * 10}%`;
      const on = this.editing === key;
      return { label, value: on ? `< ${bar} >` : bar, color: on ? 0xffd34a : undefined };
    };
    this.list.setItems([
      row('volume', t('options.volume')),
      row('music', t('options.music')),
      { label: t('options.showControls'), value: options.showControls ? t('ui.yes') : t('ui.no') },
    ]);
    this.hint.setText(t(this.editing ? 'options.hintEditing' : 'options.hint'));
  }

  /**
   * Arrows switch tabs like everywhere else in the menu; only while the volume is being edited
   * (D on its row) do left/right adjust it, and D/S finish the edit.
   */
  capturesHorizontal(): boolean {
    return this.editing !== null;
  }

  capturesCancel(): boolean {
    return this.editing !== null;
  }

  update(): void {
    if (this.editing) {
      const dir = input.menuPressed('right') ? 1 : input.menuPressed('left') ? -1 : 0;
      if (dir !== 0) {
        const key = this.editing;
        options.update({ [key]: options[key] + dir * VOLUME_STEP });
        audio.play('menuMove');
        this.refresh();
      } else if (input.justPressed('confirm') || input.justPressed('cancel')) {
        this.editing = null;
        audio.play('menuMove');
        this.refresh();
      }
      return;
    }
    this.list.update();
    if (!input.justPressed('confirm')) return;
    if (this.list.index === 0) this.editing = 'volume';
    else if (this.list.index === 1) this.editing = 'music';
    else options.update({ showControls: !options.showControls });
    audio.play('menuMove');
    this.refresh();
  }

  destroy(): void {
    this.list.destroy();
    this.hint.destroy();
  }
}
