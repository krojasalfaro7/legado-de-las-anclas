import type Phaser from 'phaser';
import type { Action } from '../../config/controls';
import { type StringKey, t } from '../../i18n';
import { keysFor, padFor } from '../../ui/controlNames';
import { FONT_SHADOW } from '../../ui/pixelFont';
import type { TabView } from './types';

const ROWS: Array<[StringKey, Action[]]> = [
  ['controls.move', ['up', 'left', 'down', 'right']],
  ['controls.run', ['up', 'left', 'down', 'right']],
  ['controls.attack', ['attack']],
  ['controls.ki', ['ki']],
  ['controls.charge', ['ki']],
  ['controls.block', ['block']],
  ['controls.focus', ['block', 'ki']],
  ['controls.switchKi', ['switchKi']],
  ['controls.fly', ['fly']],
  ['controls.switchChar', ['switchChar']],
  ['controls.interact', ['interact']],
  ['controls.lens', ['lens']],
  ['controls.pause', ['pause']],
  ['controls.fullscreen', ['fullscreen']],
];

export class ControlsTab implements TabView {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, area: Phaser.Geom.Rectangle) {
    const header = (x: number, key: StringKey) =>
      scene.add.bitmapText(x, area.y, FONT_SHADOW, t(key)).setTint(0xffd34a);
    this.objects.push(
      header(area.x + 4, 'controls.action'),
      header(area.x + 128, 'controls.keyboard'),
    );
    this.objects.push(header(area.x + 244, 'controls.gamepad'));
    ROWS.forEach(([label, actions], i) => {
      const y = area.y + 13 + i * 10;
      const isMove = label === 'controls.move';
      const isRun = label === 'controls.run';
      // Charging holds the button; focus holds two at once.
      const hold = label === 'controls.charge' ? ` ${t('controls.hold')}` : '';
      const joiner = label === 'controls.focus' ? '+' : ' ';
      const keys = isMove
        ? t('controls.moveKeys')
        : isRun
          ? t('controls.runKeys')
          : actions.map(keysFor).join(joiner) + hold;
      // The pad has no dedicated interact button: A interacts when facing something.
      const padOverride = isMove
        ? t('controls.stick')
        : isRun
          ? t('controls.runPad')
          : label === 'controls.interact'
            ? 'A'
            : null;
      const pad = padOverride ?? (actions.map(padFor).join(joiner) + hold || '-');
      this.objects.push(
        scene.add.bitmapText(area.x + 4, y, FONT_SHADOW, t(label)),
        scene.add.bitmapText(area.x + 128, y, FONT_SHADOW, keys),
        scene.add.bitmapText(area.x + 244, y, FONT_SHADOW, pad),
      );
    });
    this.objects.push(
      scene.add
        .bitmapText(area.x + 4, area.bottom - 12, FONT_SHADOW, t('controls.rebind'))
        .setTint(0xa0a0b0),
    );
  }

  update(): void {}

  destroy(): void {
    for (const o of this.objects) o.destroy();
  }
}
