import Phaser from 'phaser';
import { registerPixelFonts } from '../ui/pixelFont';
import { generateCommonTextures } from '../ui/textures';
import { SCENES } from './keys';

/** Generates code-made assets (fonts, placeholder textures) before anything is loaded. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    registerPixelFonts(this);
    generateCommonTextures(this);
    this.scene.start(SCENES.preload);
  }
}
