import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { type StringKey, t } from '../i18n';
import { input } from '../services/input';
import { FONT_SHADOW } from '../ui/pixelFont';
import { SCENES } from './keys';
import { CollectionTab } from './pause/CollectionTab';
import { ControlsTab } from './pause/ControlsTab';
import { ItemsTab } from './pause/ItemsTab';
import { OptionsTab } from './pause/OptionsTab';
import { QuestsTab } from './pause/QuestsTab';
import { StatusTab } from './pause/StatusTab';
import type { TabView } from './pause/types';

interface TabDef {
  titleKey: StringKey;
  create: (scene: Phaser.Scene, area: Phaser.Geom.Rectangle) => TabView;
}

// Thin margins: at 384x216 (1080p, 5x) every row counts.
export const PANEL = new Phaser.Geom.Rectangle(6, 4, GAME_WIDTH - 12, GAME_HEIGHT - 8);

/** Tabs are registered here; each is a self-contained view inside the panel. */
const TABS: TabDef[] = [
  { titleKey: 'menu.tab.status', create: (s, a) => new StatusTab(s, a) },
  { titleKey: 'menu.tab.quests', create: (s, a) => new QuestsTab(s, a) },
  { titleKey: 'menu.tab.items', create: (s, a) => new ItemsTab(s, a) },
  { titleKey: 'menu.tab.collection', create: (s, a) => new CollectionTab(s, a) },
  { titleKey: 'menu.tab.options', create: (s, a) => new OptionsTab(s, a) },
  { titleKey: 'menu.tab.controls', create: (s, a) => new ControlsTab(s, a) },
];

export class PauseScene extends Phaser.Scene {
  private tabIndex = 0;
  private view: TabView | null = null;
  private tabLabels: Phaser.GameObjects.BitmapText[] = [];

  constructor() {
    super(SCENES.pause);
  }

  create(data: { tab?: number }): void {
    this.tabIndex = data.tab ?? 0;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0);
    this.add
      .rectangle(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 0x10182c, 0.95)
      .setOrigin(0)
      .setStrokeStyle(1, 0x8aa0ff);
    let x = PANEL.x + 8;
    this.tabLabels = TABS.map((tab) => {
      const label = this.add.bitmapText(x, PANEL.y + 2, FONT_SHADOW, t(tab.titleKey));
      x += label.width + 14;
      return label;
    });
    this.add.rectangle(PANEL.x + 4, PANEL.y + 16, PANEL.width - 8, 1, 0x8aa0ff).setOrigin(0);
    this.add
      .bitmapText(PANEL.right - 6, PANEL.bottom - 13, FONT_SHADOW, t('menu.hint'))
      .setOrigin(1, 0)
      .setTint(0x9090a0);
    this.openTab(this.tabIndex);
  }

  private openTab(i: number): void {
    this.view?.destroy();
    this.tabIndex = (i + TABS.length) % TABS.length;
    this.tabLabels.forEach((l, idx) => {
      l.setTint(idx === this.tabIndex ? 0xffd34a : 0xa8b4d0);
    });
    const area = new Phaser.Geom.Rectangle(
      PANEL.x + 8,
      PANEL.y + 22,
      PANEL.width - 16,
      PANEL.height - 40,
    );
    const tab = TABS[this.tabIndex];
    this.view = tab ? tab.create(this, area) : null;
  }

  override update(): void {
    if (
      input.justPressed('pause') ||
      (input.justPressed('cancel') && !this.view?.capturesCancel?.())
    ) {
      this.close();
      return;
    }
    // Q/A (LB/RB) always switch tabs; arrows only when the tab isn't using them.
    const arrows = !this.view?.capturesHorizontal?.();
    if (input.justPressed('switchKi') || (arrows && input.menuPressed('left'))) {
      this.openTab(this.tabIndex - 1);
      return;
    }
    if (input.justPressed('block') || (arrows && input.menuPressed('right'))) {
      this.openTab(this.tabIndex + 1);
      return;
    }
    this.view?.update();
  }

  close(): void {
    this.view?.destroy();
    this.view = null;
    input.consumeAll();
    this.scene.resume(SCENES.world);
    this.scene.stop();
  }
}
