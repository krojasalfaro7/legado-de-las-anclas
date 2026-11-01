import type Phaser from 'phaser';
import type { Enemy } from '../../entities/Enemy';
import { input } from '../../services/input';
import { session } from '../../services/session';
import { FONT_SHADOW } from '../../ui/pixelFont';
import type { WorldScene } from '../WorldScene';

/** Survives zone changes; `?debug=1` turns it on at startup. */
let enabled = new URLSearchParams(window.location.search).get('debug') === '1';

/** F1 overlay: physics bodies, melee hitbox, FPS and each enemy's AI state. */
export class DebugOverlay {
  private readonly text: Phaser.GameObjects.BitmapText;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly labels = new Map<Enemy, Phaser.GameObjects.BitmapText>();

  constructor(private readonly world: WorldScene) {
    this.text = world.add
      .bitmapText(4, 34, FONT_SHADOW, '')
      .setScrollFactor(0)
      .setDepth(300_000)
      .setTint(0x9cff9c);
    this.gfx = world.add.graphics().setDepth(299_999);
    this.apply();
  }

  private apply(): void {
    const physics = this.world.physics.world;
    physics.drawDebug = enabled;
    if (enabled && !physics.debugGraphic) physics.createDebugGraphic();
    physics.debugGraphic?.setVisible(enabled).clear();
    this.text.setVisible(enabled);
    this.gfx.setVisible(enabled).clear();
    if (!enabled) {
      for (const label of this.labels.values()) label.destroy();
      this.labels.clear();
    }
  }

  update(): void {
    if (input.justPressed('debug')) {
      enabled = !enabled;
      this.apply();
    }
    if (!enabled) return;
    const w = this.world;
    const p = w.player;
    this.text.setText(
      [
        `FPS ${Math.round(w.game.loop.actualFps)}`,
        `zona ${w.zoneId}  x${Math.round(p.x)} y${Math.round(p.y)}`,
        `tile ${Math.floor(p.footX / 16)},${Math.floor(p.footY / 16)}`,
        `enemigos ${w.enemies.countActive()}`,
        `nv ${session.state.party[session.state.activeCharacter]?.level}`,
      ].join('\n'),
    );
    this.gfx.clear().lineStyle(1, 0xff3030, 1);
    const box = p.meleeHitbox();
    this.gfx.strokeRect(box.x, box.y, box.width, box.height);

    for (const child of w.enemies.getChildren()) {
      const e = child as Enemy;
      let label = this.labels.get(e);
      if (!label) {
        label = w.add
          .bitmapText(0, 0, FONT_SHADOW, '')
          .setOrigin(0.5, 1)
          .setDepth(300_000)
          .setTint(0xffe080);
        this.labels.set(e, label);
      }
      label
        .setText(`${e.aiStateName} ${Math.ceil(e.hp)}`)
        .setPosition(Math.round(e.x), Math.round(e.y - 16));
    }
    for (const [e, label] of this.labels) {
      if (!e.active) {
        label.destroy();
        this.labels.delete(e);
      }
    }
  }
}
