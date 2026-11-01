import Phaser from 'phaser';
import { getTechnique } from '../data/kiTechniques';
import type { TransformationDef } from '../data/types';
import { t } from '../i18n';
import type { Special } from '../systems/specials';
import { TextPanel } from './TextPanel';

const SLOT = 14;
const GAP = 2;
const SELECTED = 0xffd34a;
const IDLE = 0x50607a;

export interface SelectorView {
  specials: Special[];
  selected: number;
  ki: number;
  /** Transformations of the active character, to resolve names and colors. */
  transformations: readonly TransformationDef[];
  activeTransform: string | null;
}

interface Slot {
  frame: Phaser.GameObjects.Rectangle;
  icons: Phaser.GameObjects.Image[];
  cost: number;
}

/**
 * HUD strip of special abilities (techniques and transformations) under the character info,
 * left-aligned, with the selected one's name and cost to its right.
 * The selected slot is framed in gold; the ones the player can't afford are dimmed.
 */
export class SpecialSelector {
  private slots: Slot[] = [];
  private signature = '';
  private readonly label: TextPanel;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly left: number,
    private readonly top: number,
  ) {
    this.label = new TextPanel(scene, left, top, '', {
      originX: 0,
      originY: 0,
      center: false,
      border: IDLE,
      padX: 4,
      padY: 2,
    });
  }

  update(view: SelectorView): void {
    const signature = view.specials.map((s) => `${s.kind}:${s.id}`).join(',');
    if (signature !== this.signature) this.rebuild(view);
    const pulse = 0.7 + 0.3 * Math.sin(this.scene.time.now / 90);
    view.specials.forEach((special, i) => {
      const slot = this.slots[i];
      if (!slot) return;
      const selected = i === view.selected;
      const active = special.kind === 'transform' && special.id === view.activeTransform;
      slot.frame.setStrokeStyle(1, selected ? SELECTED : IDLE);
      slot.frame.setY(this.top + (selected ? -1 : 0));
      const affordable = active || view.ki >= slot.cost;
      for (const icon of slot.icons) icon.setAlpha((affordable ? 1 : 0.35) * (active ? pulse : 1));
    });
    const sel = view.specials[view.selected];
    const text = sel ? this.describe(sel, view) : '';
    if (text !== this.label.text) this.label.setText(text);
  }

  private describe(special: Special, view: SelectorView): string {
    if (special.kind === 'technique') {
      const tech = getTechnique(special.id);
      return `${t(tech.nameKey)}  ${t('hud.kiCost', { cost: tech.kiCost })}`;
    }
    const tr = view.transformations.find((x) => x.id === special.id);
    if (!tr) return '';
    return special.id === view.activeTransform
      ? `${t(tr.nameKey)}  ${t('hud.formActive')}`
      : `${t(tr.nameKey)}  ${t('hud.kiCost', { cost: tr.minKiToActivate })}`;
  }

  private rebuild(view: SelectorView): void {
    for (const slot of this.slots) {
      slot.frame.destroy();
      for (const icon of slot.icons) icon.destroy();
    }
    this.signature = view.specials.map((s) => `${s.kind}:${s.id}`).join(',');
    const n = view.specials.length;
    this.label.setX(this.left + n * (SLOT + GAP) + 2);
    this.slots = view.specials.map((special, i) => {
      const x = this.left + i * (SLOT + GAP);
      const frame = this.scene.add
        .rectangle(x, this.top, SLOT, SLOT, 0x101020, 0.85)
        .setOrigin(0)
        .setStrokeStyle(1, IDLE);
      const cx = x + SLOT / 2;
      const cy = this.top + SLOT / 2;
      return { frame, ...this.icon(special, view, cx, cy) };
    });
  }

  private icon(
    special: Special,
    view: SelectorView,
    cx: number,
    cy: number,
  ): { icons: Phaser.GameObjects.Image[]; cost: number } {
    const add = (key: string, x: number, y: number, tint: number, scale = 1) =>
      this.scene.add.image(x, y, key).setTint(tint).setScale(scale);
    if (special.kind === 'technique') {
      const tech = getTechnique(special.id);
      // Okun's stones show as stones, ki techniques as orbs.
      const rock = tech.look === 'rock';
      if (tech.count > 1) {
        return {
          icons: [-4, 0, 4].map((dx, k) =>
            add(
              rock ? 'shot-rock-s' : 'ki-small',
              cx + dx,
              cy + (k === 1 ? -2 : 1),
              tech.color,
              0.7,
            ),
          ),
          cost: tech.kiCost,
        };
      }
      const big = tech.texture === 'ki-big';
      const key = rock ? (big ? 'shot-rock-b' : 'shot-rock-s') : tech.texture;
      return {
        icons: [add(key, cx, cy, tech.color, big ? 0.75 : 1.2)],
        cost: tech.kiCost,
      };
    }
    const tr = view.transformations.find((x) => x.id === special.id);
    const color = tr?.auraColor ?? 0xffffff;
    const halo = add('glow', cx, cy, color, 0.36).setBlendMode(Phaser.BlendModes.ADD);
    return { icons: [halo, add('spark', cx, cy, 0xffffff, 1.4)], cost: tr?.minKiToActivate ?? 0 };
  }
}
