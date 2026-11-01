import type Phaser from 'phaser';
import { getItem } from '../../data/items';
import { t } from '../../i18n';
import { input } from '../../services/input';
import { session } from '../../services/session';
import { activeProgress } from '../../systems/gameState';
import {
  canEquip,
  equipmentEffects,
  isEquipped,
  toggleEquip,
  useConsumable,
} from '../../systems/inventory';
import { deriveStats } from '../../systems/stats';
import { MenuList } from '../../ui/MenuList';
import { FONT_SHADOW } from '../../ui/pixelFont';
import type { TabView } from './types';

export class ItemsTab implements TabView {
  private readonly list: MenuList;
  private readonly desc: Phaser.GameObjects.BitmapText;
  private readonly message: Phaser.GameObjects.BitmapText;
  private readonly empty: Phaser.GameObjects.BitmapText;
  private ids: string[] = [];

  constructor(scene: Phaser.Scene, area: Phaser.Geom.Rectangle) {
    this.list = new MenuList(scene, area.x + 4, area.y + 2, 240);
    this.desc = scene.add
      .bitmapText(area.x + 4, area.bottom - 50, FONT_SHADOW, '')
      .setMaxWidth(area.width - 8);
    this.message = scene.add
      .bitmapText(area.x + 4, area.bottom - 12, FONT_SHADOW, '')
      .setTint(0xffd34a);
    this.empty = scene.add
      .bitmapText(area.x + 4, area.y + 2, FONT_SHADOW, t('ui.inventoryEmpty'))
      .setTint(0xa0a0b0);
    this.refresh();
  }

  private refresh(): void {
    this.ids = Object.keys(session.state.inventory).filter(
      (id) => (session.state.inventory[id] ?? 0) > 0,
    );
    this.empty.setVisible(this.ids.length === 0);
    this.list.setItems(
      this.ids.map((id) => {
        const item = getItem(id);
        const equipped = isEquipped(session.state, id);
        const count = session.state.inventory[id] ?? 0;
        const tooLow = canEquip(session.state, item) === 'level';
        return {
          label: t(item.nameKey),
          value: equipped ? t('ui.equipped') : `x${count}`,
          color: equipped ? 0x8cf08c : tooLow ? 0x8a8a9a : 0xffffff,
        };
      }),
    );
    this.showDesc();
  }

  private showDesc(): void {
    const id = this.ids[this.list.index];
    if (!id) {
      this.desc.setText('');
      return;
    }
    const item = getItem(id);
    const info = item.equip
      ? `${t('ui.equipInfo', { slot: t(`slot.${item.equip.slot}`), level: item.equip.minLevel })}\n`
      : '';
    this.desc.setText(info + t(item.descKey));
  }

  update(): void {
    if (this.list.update()) {
      this.showDesc();
      this.message.setText('');
    }
    if (!input.justPressed('confirm')) return;
    const id = this.ids[this.list.index];
    if (!id) return;
    const item = getItem(id);
    if (item.kind === 'equipment') {
      if (canEquip(session.state, item) === 'level') {
        this.message.setText(t('ui.needLevel', { level: item.equip?.minLevel ?? 1 }));
        return;
      }
      const wasEquipped = isEquipped(session.state, id);
      session.state = toggleEquip(session.state, item);
      this.message.setText(
        t(wasEquipped ? 'ui.unequippedToast' : 'ui.equippedToast', { name: t(item.nameKey) }),
      );
    } else {
      const d = deriveStats(
        activeProgress(session.state).stats,
        equipmentEffects(session.state).defBonus,
      );
      const next = useConsumable(session.state, item, { hp: d.maxHp, ki: d.maxKi });
      if (!next) {
        this.message.setText(t('ui.noEffect'));
        return;
      }
      session.state = next;
      this.message.setText(t('ui.used', { name: t(item.nameKey) }));
    }
    this.refresh();
  }

  destroy(): void {
    this.list.destroy();
    this.desc.destroy();
    this.message.destroy();
    this.empty.destroy();
  }
}
