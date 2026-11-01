import type Phaser from 'phaser';
import { COLLECTIBLE_IDS } from '../../data/collectibles';
import { OBJECTIVES } from '../../data/objectives';
import { type StringKey, t } from '../../i18n';
import { session } from '../../services/session';
import {
  type ObjectiveDef,
  type ObjectiveProgress,
  visibleObjectives,
} from '../../systems/objectives';
import { MenuList } from '../../ui/MenuList';
import { FONT_SHADOW } from '../../ui/pixelFont';
import type { TabView } from './types';

const DONE = 0x8cf08c;
const CURRENT = 0xffd34a;
const LIST_ROWS = 5;

/**
 * Objectives: the list on top, the selected one's steps below. Only finished steps and the
 * current one are shown, so the list tells you what to do next without spoiling the rest.
 */
export class QuestsTab implements TabView {
  private readonly list: MenuList;
  private readonly entries: Array<{ def: ObjectiveDef<StringKey>; progress: ObjectiveProgress }>;
  private readonly header: Phaser.GameObjects.BitmapText;
  private steps: Phaser.GameObjects.BitmapText[] = [];
  private readonly divider: Phaser.GameObjects.Rectangle;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly area: Phaser.Geom.Rectangle,
  ) {
    const ctx = { allCollectibles: COLLECTIBLE_IDS };
    this.entries = visibleObjectives(OBJECTIVES, session.state, ctx);
    this.list = new MenuList(scene, area.x + 4, area.y + 2, area.width - 12);
    this.list.setItems(
      this.entries.map(({ def, progress }) => ({
        label: t(def.titleKey),
        value: t(progress.complete ? 'obj.done' : def.kind === 'main' ? 'obj.main' : 'obj.side'),
        color: progress.complete ? 0x9098a8 : def.kind === 'main' ? 0xffffff : 0xb8d8ff,
      })),
    );
    const top = area.y + 6 + LIST_ROWS * 12;
    this.divider = scene.add.rectangle(area.x + 4, top, area.width - 8, 1, 0x50607a).setOrigin(0);
    this.header = scene.add.bitmapText(area.x + 4, top + 5, FONT_SHADOW, '');
    if (this.entries.length === 0) this.header.setText(t('obj.none'));
    this.showSteps();
  }

  private showSteps(): void {
    for (const s of this.steps) s.destroy();
    this.steps = [];
    const entry = this.entries[this.list.index];
    if (!entry) return;
    const { def, progress } = entry;
    this.header
      .setText(`${t(def.titleKey)}  ·  ${t(progress.complete ? 'obj.done' : 'obj.inProgress')}`)
      .setTint(progress.complete ? DONE : CURRENT);
    const s = session.state;
    const params = {
      found: s.collectiblesFound.length,
      delivered: s.collectiblesDelivered.length,
      total: COLLECTIBLE_IDS.length,
    };
    let y = this.header.y + 16;
    const shown = Math.min(progress.step + 1, def.steps.length);
    for (let i = 0; i < shown; i++) {
      const step = def.steps[i];
      if (!step) continue;
      const done = i < progress.step;
      const text = this.scene.add
        .bitmapText(
          this.area.x + 8,
          y,
          FONT_SHADOW,
          `${done ? '★' : '▶'} ${t(step.textKey, params)}`,
        )
        .setMaxWidth(this.area.width - 16)
        .setTint(done ? DONE : CURRENT);
      this.steps.push(text);
      y += text.height + 4;
    }
  }

  update(): void {
    if (this.list.update()) this.showSteps();
  }

  destroy(): void {
    this.list.destroy();
    this.header.destroy();
    this.divider.destroy();
    for (const s of this.steps) s.destroy();
  }
}
