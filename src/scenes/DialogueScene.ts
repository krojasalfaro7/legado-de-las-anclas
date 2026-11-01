import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { audio } from '../services/audio';
import { input } from '../services/input';
import { MenuList } from '../ui/MenuList';
import { FONT_SHADOW } from '../ui/pixelFont';
import { SCENES } from './keys';

export interface DialogueLineView {
  speaker?: string;
  text: string;
  speakerColor?: number;
  /** Speaker's sprite sheet and frame; the head is shown left of the text. */
  portrait?: { key: string; frame: number };
}

export interface DialogueRequest {
  lines: DialogueLineView[];
  /** Shown after the last line; `onDone` receives the chosen index (-1 = cancelled). */
  choices?: string[];
  onDone?: (choice: number) => void;
}

const BOX_H = 70;
/** Portrait: the top of a sprite frame (the head) enlarged 2x inside a small frame. */
const PORTRAIT = { w: 24, h: 17, scale: 2, pad: 3 };
const TEXT_X = 14;
const TEXT_X_PORTRAIT = 14 + PORTRAIT.w * PORTRAIT.scale + PORTRAIT.pad * 2 + 6;
const CHARS_PER_SEC = 55;

/** Text box overlay. The caller pauses the world; this scene resumes it on close. */
export class DialogueScene extends Phaser.Scene {
  private req!: DialogueRequest;
  private lineIndex = 0;
  private shownChars = 0;
  private speaker!: Phaser.GameObjects.BitmapText;
  private body!: Phaser.GameObjects.BitmapText;
  private more!: Phaser.GameObjects.BitmapText;
  private portraitBox!: Phaser.GameObjects.Rectangle;
  private portrait!: Phaser.GameObjects.Image;
  private choices: MenuList | null = null;
  private choiceBox: Phaser.GameObjects.Rectangle | null = null;

  constructor() {
    super(SCENES.dialogue);
  }

  create(req: DialogueRequest): void {
    this.req = req;
    this.lineIndex = 0;
    this.choices = null;
    this.choiceBox = null;
    const top = GAME_HEIGHT - BOX_H - 6;
    this.add
      .rectangle(6, top, GAME_WIDTH - 12, BOX_H, 0x0c1224, 1)
      .setOrigin(0)
      .setStrokeStyle(1, 0xd0d8ff);
    this.speaker = this.add.bitmapText(14, top + 2, FONT_SHADOW, '').setTint(0xffd34a);
    this.body = this.add
      .bitmapText(14, top + 15, FONT_SHADOW, '')
      .setMaxWidth(GAME_WIDTH - 36)
      .setLineSpacing(3);
    this.portraitBox = this.add
      .rectangle(
        12,
        top + 6,
        PORTRAIT.w * PORTRAIT.scale + PORTRAIT.pad * 2,
        PORTRAIT.h * PORTRAIT.scale + PORTRAIT.pad * 2,
        0x1c2a48,
      )
      .setOrigin(0)
      .setStrokeStyle(1, 0x50607a);
    this.portrait = this.add.image(0, top + 6 + PORTRAIT.pad, '__DEFAULT').setOrigin(0);
    this.more = this.add
      .bitmapText(GAME_WIDTH - 18, GAME_HEIGHT - 20, FONT_SHADOW, '▼')
      .setTint(0xffd34a);
    if (req.lines.length === 0) this.showChoices();
    else this.showLine();
  }

  private get line(): DialogueLineView | undefined {
    return this.req.lines[this.lineIndex];
  }

  private showLine(): void {
    const line = this.line;
    if (!line) return;
    this.shownChars = 0;
    this.speaker.setText(line.speaker ?? '').setTint(line.speakerColor ?? 0xffd34a);
    this.body.setText('');
    this.showPortrait(line.portrait);
  }

  private showPortrait(p: DialogueLineView['portrait']): void {
    const has = p !== undefined && this.textures.exists(p.key);
    this.portraitBox.setVisible(has);
    this.portrait.setVisible(has);
    const x = has ? TEXT_X_PORTRAIT : TEXT_X;
    this.speaker.setX(x);
    this.body.setX(x).setMaxWidth(GAME_WIDTH - x - 22);
    if (!p || !has) return;
    this.portrait.setTexture(p.key, p.frame).setScale(PORTRAIT.scale);
    // Center a crop of the frame's top (the head); large sprites crop their middle columns.
    const cx = Math.max(0, Math.round((this.portrait.frame.width - PORTRAIT.w) / 2));
    this.portrait.setCrop(cx, 0, PORTRAIT.w, PORTRAIT.h);
    this.portrait.setX(12 + PORTRAIT.pad - cx * PORTRAIT.scale);
  }

  private showChoices(): void {
    const options = this.req.choices ?? [];
    const width = Math.max(...options.map((o) => o.length)) * 6 + 24;
    const h = options.length * 12 + 8;
    const x = GAME_WIDTH - width - 10;
    const y = GAME_HEIGHT - BOX_H - 12 - h;
    this.choiceBox = this.add
      .rectangle(x, y, width, h, 0x0c1224, 0.96)
      .setOrigin(0)
      .setStrokeStyle(1, 0xd0d8ff);
    this.choices = new MenuList(this, x + 4, y + 2, width - 12);
    this.choices.setItems(options.map((label) => ({ label })));
    this.more.setVisible(false);
  }

  override update(_time: number, delta: number): void {
    if (this.choices) {
      this.choices.update();
      if (input.justPressed('confirm')) this.finish(this.choices.index);
      else if (input.justPressed('cancel')) this.finish(-1);
      return;
    }
    const line = this.line;
    if (!line) return;
    const done = this.shownChars >= line.text.length;
    if (!done) {
      this.shownChars = Math.min(
        line.text.length,
        this.shownChars + (CHARS_PER_SEC * delta) / 1000,
      );
      this.body.setText(line.text.slice(0, Math.floor(this.shownChars)));
    }
    const isLast = this.lineIndex === this.req.lines.length - 1;
    // Questions show their options as soon as the prompt line is fully typed.
    if (done && isLast && this.req.choices?.length) {
      this.showChoices();
      return;
    }
    this.more.setVisible(done && Math.floor(this.time.now / 300) % 2 === 0);
    if (!input.justPressed('confirm') && !input.justPressed('attack')) return;
    if (!done) {
      this.shownChars = line.text.length;
      this.body.setText(line.text);
      return;
    }
    this.lineIndex++;
    if (this.lineIndex < this.req.lines.length) this.showLine();
    else if (this.req.choices?.length) this.showChoices();
    else this.finish(0);
  }

  private finish(choice: number): void {
    if (this.choices && choice >= 0) audio.play('menuConfirm');
    const onDone = this.req.onDone;
    this.choices?.destroy();
    this.choiceBox?.destroy();
    input.consumeAll();
    this.scene.resume(SCENES.world);
    this.scene.stop();
    onDone?.(choice);
  }
}
