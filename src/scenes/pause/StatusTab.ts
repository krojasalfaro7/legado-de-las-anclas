import type Phaser from 'phaser';
import { getCharacter } from '../../data/characters';
import { getTechnique } from '../../data/kiTechniques';
import type { StatName } from '../../data/types';
import { characterSheetKey } from '../../entities/Player';
import { t } from '../../i18n';
import { input } from '../../services/input';
import { session } from '../../services/session';
import { activeProgress } from '../../systems/gameState';
import { equipmentEffects } from '../../systems/inventory';
import { expToNext } from '../../systems/leveling';
import { allocatePoint, canAllocate, deriveStats, STAT_NAMES } from '../../systems/stats';
import { MenuList } from '../../ui/MenuList';
import { FONT_SHADOW } from '../../ui/pixelFont';
import type { TabView } from './types';

export class StatusTab implements TabView {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly list: MenuList;
  private readonly info: Phaser.GameObjects.BitmapText;
  private readonly derived: Phaser.GameObjects.BitmapText;
  private readonly side: Phaser.GameObjects.BitmapText;
  private readonly message: Phaser.GameObjects.BitmapText;

  constructor(scene: Phaser.Scene, area: Phaser.Geom.Rectangle) {
    const p = activeProgress(session.state);
    const char = getCharacter(p.id);
    const portrait = scene.add
      .image(area.x + 20, area.y + 26, characterSheetKey(char.id), 0)
      .setScale(2);
    const header = scene.add
      .bitmapText(area.x + 44, area.y, FONT_SHADOW, t(char.nameKey))
      .setTint(char.color);
    this.info = scene.add.bitmapText(area.x + 44, area.y + 12, FONT_SHADOW, '');
    this.list = new MenuList(scene, area.x + 4, area.y + 66, 150);
    // Derived stats sit beside the name; the technique list gets the column under them.
    this.derived = scene.add.bitmapText(area.x + 170, area.y, FONT_SHADOW, '').setLineSpacing(1);
    this.side = scene.add.bitmapText(area.x + 170, area.y + 66, FONT_SHADOW, '').setLineSpacing(1);
    this.message = scene.add
      .bitmapText(area.x + 4, area.bottom - 12, FONT_SHADOW, '')
      .setTint(0xffd34a);
    this.objects.push(portrait, header, this.info, this.derived, this.side, this.message);
    this.refresh();
  }

  private refresh(): void {
    const p = activeProgress(session.state);
    const char = getCharacter(p.id);
    const eq = equipmentEffects(session.state);
    const d = deriveStats(p.stats, eq.defBonus);
    this.info.setText(
      [
        t('status.level', { level: p.level }),
        t('status.exp', { exp: p.exp, next: expToNext(p.level) }),
        t('status.points', { points: p.unspentPoints }),
      ].join('\n'),
    );
    this.list.setItems(
      STAT_NAMES.map((s) => ({
        label: t(`stat.${s}`),
        value: `${p.stats[s]}${canAllocate(p, s) ? ' +' : ''}`,
        color: canAllocate(p, s) ? 0xffffff : 0xb0b0c0,
      })),
    );
    const forms = char.transformations.map((f) => t(f.nameKey)).join(', ') || '-';
    const techs = p.techniques.map(
      (id) => `· ${t(getTechnique(id).nameKey)} (${getTechnique(id).kiCost})`,
    );
    this.derived.setText(
      [
        t('status.maxHp', { value: d.maxHp }),
        t('status.maxKi', { value: d.maxKi }),
        t('status.defense', { value: Math.round(d.defense * 10) / 10 }),
        t('status.speed', { value: Math.round(d.speedMult * 100) }),
        t('status.forms', { value: forms }),
      ].join('\n'),
    );
    this.side.setText([t('status.techniques'), ...techs].join('\n'));
  }

  update(): void {
    if (this.list.update()) this.message.setText('');
    if (!input.justPressed('confirm')) return;
    const stat: StatName | undefined = STAT_NAMES[this.list.index];
    if (!stat) return;
    const p = activeProgress(session.state);
    if (p.unspentPoints <= 0) {
      this.message.setText(t('status.noPoints'));
      return;
    }
    if (!canAllocate(p, stat)) {
      this.message.setText(t('status.capped'));
      return;
    }
    const before = deriveStats(p.stats);
    const next = allocatePoint(p, stat);
    const after = deriveStats(next.stats);
    // Raising END/POW grows current HP/ki too, so a point never feels like a loss.
    session.state.party[p.id] = {
      ...next,
      vitals: {
        hp: next.vitals.hp + after.maxHp - before.maxHp,
        ki: next.vitals.ki + after.maxKi - before.maxKi,
      },
    };
    this.message.setText('');
    this.refresh();
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
    this.list.destroy();
  }
}
