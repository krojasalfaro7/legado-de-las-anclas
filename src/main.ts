import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config/constants';
import { DEFAULT_BINDINGS } from './config/controls';
import { BootScene } from './scenes/BootScene';
import { DialogueScene } from './scenes/DialogueScene';
import { GameOverScene } from './scenes/GameOverScene';
import { SCENES } from './scenes/keys';
import { LensScene } from './scenes/LensScene';
import { PauseScene } from './scenes/PauseScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { UIScene } from './scenes/UIScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { WorldScene } from './scenes/WorldScene';
import { audio } from './services/audio';
import { input } from './services/input';
import { session } from './services/session';
import { isTouchDevice, TouchControls } from './services/touchControls';

input.attach(window);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true,
  // Input is read by our own service (DOM + Gamepad API), shared by every scene.
  input: { keyboard: false, gamepad: false },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  scale: {
    // The resolution matches the monitor (see constants.ts), so fullscreen scales by a whole
    // number; in a window FIT fills the height, with thin bars at most.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    PreloadScene,
    TitleScene,
    WorldScene,
    UIScene,
    PauseScene,
    DialogueScene,
    LensScene,
    WorldMapScene,
    GameOverScene,
  ],
};

const game = new Phaser.Game(config);
game.events.on(Phaser.Core.Events.PRE_STEP, (time: number) => input.update(time));
audio.attach(game, window);
if (isTouchDevice()) {
  const touch = new TouchControls(() => game.scale.toggleFullscreen());
  touch.attach();
  const quiet = [SCENES.dialogue, SCENES.pause, SCENES.worldMap, SCENES.lens, SCENES.title];
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    const world = game.scene.getScene(SCENES.world) as WorldScene | null;
    touch.setDim(quiet.some((k) => game.scene.isActive(k)) || Boolean(world?.cinematic));
    touch.setTitle(game.scene.isActive(SCENES.title));
  });
}
// Browsers only allow fullscreen from inside a user gesture, so this can't wait for the game step.
window.addEventListener('keydown', (e) => {
  if (!e.repeat && DEFAULT_BINDINGS.keyboard.fullscreen.includes(e.code))
    game.scale.toggleFullscreen();
});

if (import.meta.env.DEV) {
  // Handy for console debugging and automated smoke tests.
  Object.assign(window, { __game: game, __session: session, __audio: audio });
}

if (import.meta.env.DEV) {
  // An uncaught error inside a scene stops the game loop and looks like a freeze; show it.
  const report = (message: string) => {
    const box = document.createElement('pre');
    box.textContent = `Error: ${message}`;
    box.style.cssText =
      'position:fixed;left:8px;bottom:8px;max-width:90vw;margin:0;padding:6px 8px;' +
      'background:#400;color:#fdd;font:12px monospace;white-space:pre-wrap;z-index:10';
    document.body.append(box);
  };
  window.addEventListener('error', (e) => report(e.error?.stack ?? e.message));
  window.addEventListener('unhandledrejection', (e) => report(String(e.reason?.stack ?? e.reason)));
}
