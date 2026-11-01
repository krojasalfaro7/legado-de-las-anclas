import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { t } from '../i18n';
import { input } from '../services/input';
import { session } from '../services/session';
import { loadGame } from '../services/storage';
import { restoreParty } from '../systems/gameState';
import { MenuList } from '../ui/MenuList';
import { FONT_SHADOW } from '../ui/pixelFont';
import { SCENES } from './keys';

type Choice = 'continue' | 'retry' | 'title';

export class GameOverScene extends Phaser.Scene {
  private list!: MenuList;
  private options: Choice[] = [];
  private zone = '';

  constructor() {
    super(SCENES.gameOver);
  }

  create(data: { zone: string }): void {
    this.zone = data.zone;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x200000, 0.7).setOrigin(0);
    this.add
      .bitmapText(GAME_WIDTH / 2, 84, FONT_SHADOW, t('gameover.title'))
      .setOrigin(0.5)
      .setScale(2)
      .setTint(0xff6060);
    this.options = [...(loadGame() ? (['continue'] as const) : []), 'retry', 'title'];
    const labels: Record<Choice, string> = {
      continue: t('gameover.continue'),
      retry: t('gameover.retry'),
      title: t('gameover.title2'),
    };
    this.list = new MenuList(this, GAME_WIDTH / 2 - 90, 120, 180, 14);
    this.list.setItems(this.options.map((o) => ({ label: labels[o] })));
    input.consumeAll();
  }

  override update(): void {
    this.list.update();
    if (!input.justPressed('confirm')) return;
    const choice = this.options[this.list.index];
    input.consumeAll();
    const world = this.scene.get(SCENES.world);
    if (choice === 'continue') {
      const saved = loadGame();
      if (saved) session.load(saved);
      this.scene.stop();
      world.scene.restart({});
    } else if (choice === 'retry') {
      session.state = restoreParty(session.state);
      session.state.location = { zone: this.zone };
      this.scene.stop();
      world.scene.restart({ zone: this.zone });
    } else {
      this.scene.stop();
      this.scene.stop(SCENES.ui);
      this.scene.stop(SCENES.world);
      this.scene.start(SCENES.title);
    }
  }
}
