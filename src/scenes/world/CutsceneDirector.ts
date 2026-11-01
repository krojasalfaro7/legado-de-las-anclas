import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/constants';
import { getCharacter } from '../../data/characters';
import { COLLECTIBLE_IDS } from '../../data/collectibles';
import { CUTSCENES } from '../../data/cutscenes';
import { getEnemy } from '../../data/enemies';
import { getNpc } from '../../data/npcs';
import { Actor } from '../../entities/Actor';
import { Enemy } from '../../entities/Enemy';
import { characterSheetKey } from '../../entities/Player';
import { type StringKey, t } from '../../i18n';
import { audio, isSfx } from '../../services/audio';
import { session } from '../../services/session';
import {
  type CutDir,
  type CutStep,
  type CutsceneDef,
  type CutTrigger,
  pickCutscene,
  seenFlag,
  type TilePos,
} from '../../systems/cutscene';
import { restoreParty } from '../../systems/gameState';
import { raiseToLevel } from '../../systems/progression';
import { spriteClassOf } from '../../ui/actorFrames';
import { FONT_SHADOW } from '../../ui/pixelFont';
import { FEET_BOX, type Pose, SHEET_KEYS } from '../../ui/spriteSpec';
import { ensureActorSheet } from '../../ui/textures';
import { facingFromVector } from '../../utils/direction';
import type { WorldScene } from '../WorldScene';

const TILE = 16;
const WALK_SPEED = 70;
const BAR_H = 22;
/** Credits roll speed, px/s. */
const CREDITS_SPEED = 26;

const enemySheet = (id: string, phase?: number) => {
  const def = getEnemy(id);
  const look = phase === undefined ? undefined : def.phases?.[phase]?.look;
  return look
    ? { key: SHEET_KEYS.enemy(id, phase), look }
    : { key: SHEET_KEYS.enemy(id), look: def.look };
};

const tileToPx = ([x, y]: TilePos) => ({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 });

/**
 * Plays data-driven cutscenes (data/cutscenes.ts) inside the world: actors walk and turn,
 * emotes pop over heads, the camera pans, and dialogue boxes show portraits. While one runs
 * the world is "cinematic": letterbox bars, no HUD, the player and enemies hold still.
 */
export class CutsceneDirector {
  private running = false;
  private readonly spawned = new Map<string, Actor>();
  /** Fade-ins of actors spawned since the last dialogue. */
  private readonly fadingIn: Promise<void>[] = [];
  /** Spawn ids that name the player (the party member being spawned is already on screen). */
  private readonly aliases = new Set<string>();
  private readonly touched = new Set<Actor>();
  private bars: Phaser.GameObjects.Rectangle[] = [];
  private pendingToasts: string[] = [];

  constructor(private readonly world: WorldScene) {}

  get active(): boolean {
    return this.running;
  }

  /** Starts the cutscene for this trigger, if one is pending; `onEnd` runs when it finishes. */
  tryPlay(trigger: CutTrigger, onEnd?: () => void): boolean {
    if (this.running) return false;
    const ctx = { allCollectibles: COLLECTIBLE_IDS };
    const def = pickCutscene(CUTSCENES, this.world.zoneId, trigger, session.state, ctx);
    if (!def) return false;
    void this.play(def).then(() => onEnd?.());
    return true;
  }

  private async play(def: CutsceneDef): Promise<void> {
    this.running = true;
    session.state.flags = { ...session.state.flags, [seenFlag(def.id)]: true };
    this.enterCinematic();
    try {
      for (const step of def.steps) await this.run(step);
    } finally {
      this.exitCinematic();
      this.running = false;
    }
  }

  private run(step: CutStep): Promise<void> {
    switch (step.do) {
      case 'talk':
        // A dialogue pauses the world (and its tweens): let fresh spawns finish fading in first.
        return Promise.all(this.fadingIn.splice(0)).then(
          () =>
            new Promise((done) =>
              this.world.runDialogue({
                lines: this.world.content.lines(step.dialogue),
                onDone: () => done(),
              }),
            ),
        );
      case 'move':
        return this.move(step.who, step.to, step.speed ?? WALK_SPEED);
      case 'face': {
        this.actor(step.who)?.scriptLoop('idle', step.dir);
        return Promise.resolve();
      }
      case 'look': {
        const a = this.actor(step.who);
        const b = this.actor(step.target);
        if (a && b) {
          a.faceToward(b.footX, b.footY);
          a.scriptLoop('idle');
        }
        return Promise.resolve();
      }
      case 'emote':
        return this.emote(step.who, step.emote);
      case 'pose': {
        this.actor(step.who)?.holdPose(step.pose as Pose, step.ms);
        return this.wait(step.ms);
      }
      case 'camera':
        return this.pan(step.to, step.ms ?? 700);
      case 'cameraBack':
        return this.pan('player', step.ms ?? 600).then(() => {
          this.world.cameras.main.startFollow(this.world.player, true);
        });
      case 'wait':
        return this.wait(step.ms);
      case 'shake':
        this.world.cameras.main.shake(step.ms, step.intensity ?? 0.006);
        return this.wait(step.ms);
      case 'flash': {
        const c = step.color ?? 0xffffff;
        this.world.cameras.main.flash(step.ms ?? 300, (c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff);
        return this.wait(step.ms ?? 300);
      }
      case 'spawn':
        this.spawn(step.id, step.actor, step.at, step.facing ?? 'down');
        return Promise.resolve();
      case 'despawn':
        return this.despawn(step.who, step.how ?? 'fade');
      case 'place': {
        const a = this.actor(step.who);
        const p = tileToPx(step.at);
        a?.placeFeet(p.x, p.y);
        if (step.facing) a?.scriptLoop('idle', step.facing);
        return Promise.resolve();
      }
      case 'show': {
        const a = this.actor(step.who);
        a?.setVisible(step.visible);
        a?.shadow.setVisible(step.visible);
        return Promise.resolve();
      }
      case 'flag':
        session.state.flags = { ...session.state.flags, [step.flag]: step.value ?? true };
        return Promise.resolve();
      case 'play':
        this.world.playAs(step.character);
        return Promise.resolve();
      case 'heal':
        session.state = restoreParty(session.state);
        return Promise.resolve();
      case 'join': {
        const flag = getCharacter(step.character).joinFlag;
        if (flag) session.state.flags = { ...session.state.flags, [flag]: true };
        session.state = raiseToLevel(session.state, step.character, step.level);
        this.world.learnTechniques(step.character, false);
        return Promise.resolve();
      }
      case 'toast':
        this.pendingToasts.push(t(step.text as StringKey));
        return Promise.resolve();
      case 'sfx':
        if (isSfx(step.id)) audio.play(step.id);
        return Promise.resolve();
      case 'music':
        audio.playMusic(step.id);
        return Promise.resolve();
      case 'transform': {
        const a = this.actor(step.who);
        if (a instanceof Enemy) this.world.transformBoss(a);
        return Promise.resolve();
      }
      case 'goto':
        // The scene restarts under us: this cutscene never resumes.
        this.world.changeZone(step.zone, step.spawn, false);
        return new Promise(() => {});
      case 'credits':
        return this.credits(t(step.text as StringKey));
      case 'title':
        return this.title(t(step.text as StringKey), step.sub && t(step.sub as StringKey), step.ms);
      case 'together':
        return Promise.all(step.steps.map((s) => this.run(s))).then(() => undefined);
    }
  }

  // --- Actors ------------------------------------------------------------------------

  private actor(who: string): Actor | null {
    const found =
      who === 'player' || this.aliases.has(who)
        ? this.world.player
        : (this.spawned.get(who) ?? this.world.content.npcNamed(who) ?? this.world.enemyNamed(who));
    if (found && !this.touched.has(found)) {
      // Scripted actors ignore collisions so walls and colliders can't fight the tweens.
      this.touched.add(found);
      found.scripted = true;
      found.setVelocity(0, 0);
      found.arcadeBody.checkCollision.none = true;
    }
    return found;
  }

  private move(who: string, to: TilePos, speed: number): Promise<void> {
    const a = this.actor(who);
    if (!a) return Promise.resolve();
    const target = tileToPx(to);
    const dx = target.x - a.footX;
    const dy = target.y - a.footY;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return Promise.resolve();
    a.scriptLoop('walk', facingFromVector(dx, dy, a.facing));
    return new Promise((done) => {
      this.world.tweens.add({
        targets: a,
        x: a.x + dx,
        y: a.y + dy,
        duration: (dist / speed) * 1000,
        onComplete: () => {
          a.scriptLoop('idle');
          done();
        },
      });
    });
  }

  private emote(who: string, emote: string): Promise<void> {
    const a = this.actor(who);
    if (!a) return Promise.resolve();
    audio.play('emote');
    const text = this.world.add
      .bitmapText(a.footX, a.footY - a.frame.height - 2, FONT_SHADOW, emote)
      .setOrigin(0.5, 1)
      .setTint(emote === '...' ? 0xd0d8ff : 0xffd34a)
      .setScale(0)
      .setDepth(300_000);
    this.world.tweens.add({ targets: text, scale: 2, duration: 140, ease: 'Back.easeOut' });
    return this.wait(750).then(() => text.destroy());
  }

  private spawn(
    id: string,
    actor: { npc: string } | { character: string } | { enemy: string; phase?: number },
    at: TilePos,
    facing: CutDir,
  ): void {
    if ('character' in actor && actor.character === this.world.player.character.id) {
      this.aliases.add(id);
      return;
    }
    const { key, look } =
      'npc' in actor
        ? { key: SHEET_KEYS.npc(actor.npc), look: getNpc(actor.npc).look }
        : 'character' in actor
          ? { key: characterSheetKey(actor.character), look: getCharacter(actor.character).look }
          : enemySheet(actor.enemy, actor.phase);
    ensureActorSheet(this.world, key, look);
    const p = tileToPx(at);
    const a = new Actor(this.world, p.x, p.y, key, FEET_BOX[spriteClassOf(look)]);
    a.placeFeet(p.x, p.y);
    a.setAlpha(0);
    this.fadingIn.push(
      new Promise((done) => {
        this.world.tweens.add({ targets: a, alpha: 1, duration: 250, onComplete: () => done() });
        // In case the actor is gone before the fade ends (real time: tweens may be paused).
        window.setTimeout(done, 400);
      }),
    );
    this.spawned.set(id, a);
    this.actor(id)?.scriptLoop('idle', facing);
  }

  private despawn(who: string, how: 'fade' | 'flyUp'): Promise<void> {
    if (this.aliases.delete(who)) return Promise.resolve();
    const a = this.actor(who);
    if (!a) return Promise.resolve();
    if (how === 'flyUp') audio.play('takeoff');
    return new Promise((done) => {
      this.world.tweens.add({
        targets: a,
        alpha: 0,
        y: how === 'flyUp' ? a.y - 90 : a.y,
        duration: how === 'flyUp' ? 600 : 350,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.spawned.delete(who);
          this.touched.delete(a);
          if (a === this.world.player) a.setVisible(false);
          else a.destroy();
          done();
        },
      });
    });
  }

  // --- Camera and presentation -------------------------------------------------------

  private pan(to: string | TilePos, ms: number): Promise<void> {
    const cam = this.world.cameras.main;
    let point: { x: number; y: number };
    if (typeof to === 'string') {
      const a = to === 'player' ? this.world.player : this.actor(to);
      if (!a) return Promise.resolve();
      point = { x: a.footX, y: a.footY - 8 };
    } else {
      point = tileToPx(to);
    }
    cam.stopFollow();
    return new Promise((done) => {
      cam.pan(point.x, point.y, ms, 'Sine.easeInOut', true, (_c: unknown, progress: number) => {
        if (progress >= 1) done();
      });
    });
  }

  /** Fades to black, shows the card, then fades back to the scene. */
  private title(text: string, sub: string | undefined, ms = 2600): Promise<void> {
    const w = this.world;
    const depth = 410_000;
    const black = w.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setOrigin(0)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(depth);
    const main = w.add
      .bitmapText(GAME_WIDTH / 2, GAME_HEIGHT / 2 - (sub ? 8 : 0), FONT_SHADOW, text)
      .setOrigin(0.5)
      .setScale(2)
      .setTint(0xffe080)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(depth + 1);
    const second = sub
      ? w.add
          .bitmapText(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 14, FONT_SHADOW, sub)
          .setOrigin(0.5)
          .setTint(0xd0d8ff)
          .setScrollFactor(0)
          .setAlpha(0)
          .setDepth(depth + 1)
      : null;
    const texts = second ? [main, second] : [main];
    const fade = (targets: unknown[], alpha: number, duration: number) =>
      new Promise<void>((done) =>
        w.tweens.add({ targets, alpha, duration, onComplete: () => done() }),
      );
    return fade([black], 1, 500)
      .then(() => fade(texts, 1, 400))
      .then(() => this.wait(ms))
      .then(() => fade(texts, 0, 400))
      .then(() => fade([black], 0, 500))
      .then(() => {
        for (const o of [black, ...texts]) o.destroy();
      });
  }

  /** Scrolls the credits up over black, then fades back. */
  private credits(text: string): Promise<void> {
    const w = this.world;
    audio.playMusic('credits');
    const depth = 410_000;
    const black = w.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setOrigin(0)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(depth);
    const roll = w.add
      .bitmapText(GAME_WIDTH / 2, GAME_HEIGHT + 8, FONT_SHADOW, text)
      .setCenterAlign()
      .setOrigin(0.5, 0)
      .setTint(0xe8e4ff)
      .setScrollFactor(0)
      .setDepth(depth + 1);
    const travel = GAME_HEIGHT + 16 + roll.height;
    return new Promise<void>((done) =>
      w.tweens.add({ targets: black, alpha: 1, duration: 600, onComplete: () => done() }),
    )
      .then(
        () =>
          new Promise<void>((done) =>
            w.tweens.add({
              targets: roll,
              y: roll.y - travel,
              duration: (travel / CREDITS_SPEED) * 1000,
              onComplete: () => done(),
            }),
          ),
      )
      .then(
        () =>
          new Promise<void>((done) =>
            w.tweens.add({ targets: black, alpha: 0, duration: 600, onComplete: () => done() }),
          ),
      )
      .then(() => {
        black.destroy();
        roll.destroy();
      });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((done) => this.world.time.delayedCall(ms, done));
  }

  private enterCinematic(): void {
    this.world.clearEnemyShots();
    this.world.player.setVelocity(0, 0);
    this.world.player.scriptLoop('idle');
    this.world.setHudVisible(false);
    this.bars = [0, GAME_HEIGHT].map((y) =>
      this.world.add
        .rectangle(0, y, GAME_WIDTH, BAR_H, 0x000000)
        .setOrigin(0, y === 0 ? 0 : 1)
        .setScrollFactor(0)
        .setScale(1, 0)
        .setDepth(400_000),
    );
    this.world.tweens.add({ targets: this.bars, scaleY: 1, duration: 300 });
  }

  private exitCinematic(): void {
    for (const a of this.touched) {
      a.scripted = false;
      if (a.active) a.arcadeBody.checkCollision.none = false;
    }
    this.touched.clear();
    this.aliases.clear();
    const bars = this.bars;
    this.world.tweens.add({
      targets: bars,
      scaleY: 0,
      duration: 300,
      onComplete: () => {
        for (const b of bars) b.destroy();
      },
    });
    const cam = this.world.cameras.main;
    cam.startFollow(this.world.player, true);
    this.world.setHudVisible(true);
    this.pendingToasts.forEach((msg, i) => {
      this.world.time.delayedCall(200 + i * 2200, () => this.world.toast(msg));
    });
    this.pendingToasts = [];
  }
}
