import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { MUSIC_FILES, SFX_FILES } from '../data/audio';
import { CHARACTERS } from '../data/characters';
import { ZONES } from '../data/zones';
import { session } from '../services/session';
import { FONT_SHADOW } from '../ui/pixelFont';
import { SPRITE_DIR, SPRITE_MANIFEST, type SpriteManifest } from '../ui/spriteSpec';
import { SCENES } from './keys';

/** Loads files from public/assets (tileset, Tiled maps and optional audio/sprite files). */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.preload);
  }

  preload(): void {
    const label = this.add
      .bitmapText(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12, FONT_SHADOW, 'Cargando...')
      .setOrigin(0.5);
    const bar = this.add
      .rectangle(GAME_WIDTH / 2 - 80, GAME_HEIGHT / 2 + 4, 0, 4, 0xffa020)
      .setOrigin(0, 0.5);
    this.load.on('progress', (p: number) => {
      bar.width = 160 * p;
    });
    this.load.on('complete', () => label.destroy());

    this.load.image('tiles', 'assets/tilesets/placeholder.png');
    for (const [id, file] of Object.entries(SFX_FILES))
      this.load.audio(`sfx-${id}`, `assets/audio/${file}`);
    for (const [key, file] of Object.entries(MUSIC_FILES))
      this.load.audio(`music-${key}`, `assets/audio/${file}`);
    // Hand-drawn sheets listed by `npm run sprites:check`. A missing manifest or a sheet that
    // fails to load just leaves the generated sheet in place.
    this.load.json('sprite-manifest', SPRITE_MANIFEST);
    this.load.once(
      'filecomplete-json-sprite-manifest',
      (_key: string, _type: string, data: unknown) => this.loadSheets(data as SpriteManifest),
    );
    for (const zone of Object.values(ZONES)) {
      this.load.tilemapTiledJSON(zone.mapKey, `assets/maps/${zone.mapKey}.tmj`);
    }
  }

  private loadSheets(manifest: SpriteManifest): void {
    for (const [key, sheet] of Object.entries(manifest.sheets ?? {})) {
      this.load.spritesheet(key, `${SPRITE_DIR}/${sheet.file}`, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    }
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    const zone = params.get('zone');
    if (zone) {
      // Debug shortcut: ?zone=<id>&spawn=<id> skips the title with a fresh game;
      // &join=<id> (dev builds) also unlocks a character that joins later in the story.
      const join = import.meta.env.DEV ? CHARACTERS[params.get('join') ?? '']?.joinFlag : undefined;
      if (join) session.state.flags = { ...session.state.flags, [join]: true };
      this.scene.start(SCENES.world, { zone, spawn: params.get('spawn') ?? undefined });
      return;
    }
    this.scene.start(SCENES.title);
  }
}
