import type Phaser from 'phaser';
import { COLLECTIBLE_IDS, getCollectible } from '../../data/collectibles';
import { t } from '../../i18n';
import { session } from '../../services/session';
import { MenuList } from '../../ui/MenuList';
import { FONT_SHADOW } from '../../ui/pixelFont';
import type { TabView } from './types';

export class CollectionTab implements TabView {
  private readonly list: MenuList;
  private readonly desc: Phaser.GameObjects.BitmapText;
  private readonly summary: Phaser.GameObjects.BitmapText;

  constructor(scene: Phaser.Scene, area: Phaser.Geom.Rectangle) {
    const s = session.state;
    this.summary = scene.add.bitmapText(
      area.x + 4,
      area.y + 2,
      FONT_SHADOW,
      t('ui.collectionStatus', {
        found: s.collectiblesFound.length,
        delivered: s.collectiblesDelivered.length,
        total: COLLECTIBLE_IDS.length,
      }),
    );
    this.list = new MenuList(scene, area.x + 4, area.y + 20, area.width - 12);
    this.list.setItems(
      COLLECTIBLE_IDS.map((id) => {
        const found = s.collectiblesFound.includes(id);
        const delivered = s.collectiblesDelivered.includes(id);
        return {
          label: found ? t(getCollectible(id).nameKey) : t('ui.unknown'),
          value: delivered ? t('ui.delivered') : found ? t('ui.found') : '',
          color: delivered ? 0x8cf08c : found ? 0xffd34a : 0x808090,
        };
      }),
    );
    this.desc = scene.add
      .bitmapText(area.x + 4, area.bottom - 30, FONT_SHADOW, '')
      .setMaxWidth(area.width - 8);
    this.showDesc();
  }

  private showDesc(): void {
    const id = COLLECTIBLE_IDS[this.list.index];
    const found = id !== undefined && session.state.collectiblesFound.includes(id);
    this.desc.setText(found && id ? t(getCollectible(id).descKey) : '');
  }

  update(): void {
    if (this.list.update()) this.showDesc();
  }

  destroy(): void {
    this.list.destroy();
    this.desc.destroy();
    this.summary.destroy();
  }
}
