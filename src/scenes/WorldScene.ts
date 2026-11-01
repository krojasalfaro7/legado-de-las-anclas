import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { getCharacter, isPlayable } from '../data/characters';
import { getTechnique } from '../data/kiTechniques';
import type { TransformationDef } from '../data/types';
import { DEFAULT_ZONE, ZONES } from '../data/zones';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Projectile, type ProjectileSpec } from '../entities/Projectile';
import type { CombatHost } from '../entities/types';
import { t } from '../i18n';
import { audio } from '../services/audio';
import { input } from '../services/input';
import { session } from '../services/session';
import { moneyDrop } from '../systems/economy';
import type { HitOutcome } from '../systems/enemyTraits';
import { equipmentEffects } from '../systems/inventory';
import { nextCharacter, switchCharacter } from '../systems/party';
import { grantExp, learnByLevel } from '../systems/progression';
import { tileStopsShot, traceRay } from '../systems/shotBlock';
import { FONT_SHADOW } from '../ui/pixelFont';
import { impactFlash, kiImpact, sparkBurst } from '../utils/fx';
import { objectCenter, prop } from '../utils/tiled';
import type { DialogueRequest } from './DialogueScene';
import { SCENES } from './keys';
import type { LensTarget } from './LensScene';
import { CutsceneDirector } from './world/CutsceneDirector';
import { DebugOverlay } from './world/DebugOverlay';
import { Scenery } from './world/Scenery';
import { flagsAllow, ZoneContent } from './world/ZoneContent';

export interface WorldSceneData {
  zone?: string;
  spawn?: string;
}

/** Events emitted on `world.events` for the HUD and other overlay scenes. */
export const WORLD_EVENTS = {
  toast: 'toast',
  damageNumber: 'damage-number',
  bossChanged: 'boss-changed',
  hudVisible: 'hud-visible',
} as const;

type DamageKind = 'enemy' | 'player' | 'blocked' | 'exp' | 'money';

/** The last fights get their own theme. */
const FINAL_BOSSES = new Set(['veskFinal', 'fondoHeart', 'fondoEcho']);

const DAMAGE_COLORS: Record<DamageKind, number> = {
  enemy: 0xffffff,
  player: 0xff6060,
  blocked: 0x9ad0ff,
  exp: 0xffe060,
  money: 0x9ff6ff,
};

/** Reads a boolean tileset property from a collision callback argument. */
/** Boss power-ups: a transformation takes longer (reference: ~2.75 s) than a plain rage. */
const BOSS_POWER_UP_MS = 2600;
const BOSS_RAGE_MS = 1500;

/** Sampling step (px) when tracing a beam against walls. */
const SHOT_RAY_STEP = 2;

function tileFlag(obj: unknown, name: string): boolean {
  return (obj as Phaser.Tilemaps.Tile).properties?.[name] === true;
}

export class WorldScene extends Phaser.Scene implements CombatHost {
  player!: Player;
  map!: Phaser.Tilemaps.Tilemap;
  collisionLayer!: Phaser.Tilemaps.TilemapLayer;
  private scenery!: Scenery;
  zoneId = DEFAULT_ZONE;
  enemies!: Phaser.Physics.Arcade.Group;
  content!: ZoneContent;
  cutscenes!: CutsceneDirector;
  /** Last enemy the player hit; the lens shows it first. */
  lastTarget: Enemy | null = null;
  activeBoss: Enemy | null = null;
  private shotGroup!: Phaser.Physics.Arcade.Group;
  /** A boss whose rival card is due once cutscenes and dialogue are over. */
  private pendingBossCard: Enemy | null = null;
  /** Enemy-trait hints already shown this zone visit. */
  private hinted = new Set<string>();
  private enemyShots!: Phaser.Physics.Arcade.Group;
  private changingZone = false;
  private debug!: DebugOverlay;

  constructor() {
    super(SCENES.world);
  }

  create(data: WorldSceneData): void {
    this.changingZone = false;
    this.lastTarget = null;
    this.pendingBossCard = null;
    this.hinted.clear();
    this.activeBoss = null;
    const requested = data.zone ?? session.state.location.zone;
    this.zoneId = ZONES[requested] ? requested : DEFAULT_ZONE;
    const zone = ZONES[this.zoneId];
    if (!zone) throw new Error(`Unknown zone ${this.zoneId}`);
    this.buildMap(zone.mapKey);
    const spawn = this.findSpawn(data.spawn);
    session.state.location = { zone: this.zoneId, spawn: data.spawn };
    if (zone.solo && session.state.party[zone.solo])
      session.state = { ...session.state, activeCharacter: zone.solo };
    this.player = new Player(this, spawn.x, spawn.y, session.state.activeCharacter);
    // Flying skips every solid tile except tall ones (walls, tree canopies).
    this.physics.add.collider(
      this.player,
      this.collisionLayer,
      undefined,
      (_p, tile) => !this.player.flying || tileFlag(tile, 'blocksFlight'),
    );

    this.setupCombatGroups();
    this.content = new ZoneContent(this);
    this.cutscenes = new CutsceneDirector(this);
    this.content.build(this.objects());
    this.spawnEnemies();
    // Saves from before a technique existed catch up silently.
    for (const id of Object.keys(session.state.party)) this.learnTechniques(id, false);

    const w = this.map.widthInPixels;
    const h = this.map.heightInPixels;
    this.physics.world.setBounds(0, 0, w, h);
    this.cameras.main.setBounds(0, 0, w, h);
    this.cameras.main.startFollow(this.player, true);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(250);

    this.listen(WORLD_EVENTS.damageNumber, this.showDamageNumber);
    this.listen(Phaser.Scenes.Events.RESUME, this.applyEquipment);
    this.applyEquipment();
    audio.playMusic(zone.music);
    this.debug = new DebugOverlay(this);
    if (!this.scene.isActive(SCENES.ui)) this.scene.launch(SCENES.ui);
    // A zone change in the middle of a cutscene must not leave the HUD hidden.
    this.setHudVisible(true);
    // Delayed so the HUD scene (launched above) is listening.
    this.time.delayedCall(120, () => this.toast(t(zone.nameKey)));
    this.time.delayedCall(300, () => this.cutscenes.tryPlay({ on: 'enter' }));
  }

  get cinematic(): boolean {
    return this.cutscenes?.active ?? false;
  }

  setHudVisible(visible: boolean): void {
    this.events.emit(WORLD_EVENTS.hudVisible, visible);
  }

  /** Living enemy placed by the Tiled object with this name (for cutscenes). */
  enemyNamed(name: string): Enemy | null {
    const id = `${this.zoneId}:${name}`;
    return this.aliveEnemies().find((e) => e.spawn.spawnId === id) ?? null;
  }

  /** Subscribes to this scene's events and unsubscribes on shutdown. */
  private listen(event: string, fn: (...args: never[]) => void): void {
    this.events.on(event, fn, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(event, fn, this));
  }

  private buildMap(mapKey: string): void {
    this.map = this.make.tilemap({ key: mapKey });
    const tileset = this.map.addTilesetImage('placeholder', 'tiles');
    if (!tileset) throw new Error('Tileset "placeholder" missing in map');
    this.map.createLayer('Ground', tileset, 0, 0)?.setDepth(-10);
    const collision = this.map.createLayer(
      'Collision',
      tileset,
      0,
      0,
    ) as Phaser.Tilemaps.TilemapLayer | null;
    if (!collision) throw new Error(`Map ${mapKey} has no Collision layer`);
    collision.setDepth(-9);
    collision.setCollisionByProperty({ collides: true });
    this.collisionLayer = collision;
    this.scenery = new Scenery(this, collision);
  }

  private setupCombatGroups(): void {
    this.enemies = this.physics.add.group({ runChildUpdate: true });
    this.shotGroup = this.physics.add.group();
    this.enemyShots = this.physics.add.group();
    this.physics.add.collider(this.enemies, this.collisionLayer);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.player, this.enemies);
    this.physics.add.overlap(this.shotGroup, this.enemies, (shotObj, enemyObj) => {
      const shot = shotObj as Projectile;
      const enemy = enemyObj as Enemy;
      if (enemy.isDead || !shot.registerHit(enemy)) return;
      const { spec } = shot;
      const dmg = spec.damage(enemy.def.def);
      const heavy = spec.heavy === true;
      const attack = {
        source: shot.thrown ? 'thrown' : 'ki',
        finisher: false,
        pierce: spec.pierce,
        launch: heavy,
        color: spec.color,
      } as const;
      // Pushed along the blast's flight (piercing blasts are already past the target's center).
      const fromX = enemy.footX - Math.cos(spec.angle) * 10;
      const fromY = enemy.footY - Math.sin(spec.angle) * 10;
      const hit = enemy.takeHit(dmg, fromX, fromY, spec.knockback, attack);
      this.onPlayerHitEnemy(enemy, hit.damage, heavy, hit.outcome);
    });
    this.physics.add.overlap(this.enemyShots, this.player, (_p, shotObj) => {
      const shot = shotObj as Projectile;
      if (!shot.registerHit(this.player)) return;
      const p = this.player;
      const big = shot.spec.texture === 'ki-big';
      if (shot.glows) kiImpact(this, p.x, p.y - 6 - p.liftPx, shot.spec.color, big);
      else impactFlash(this, p.x, p.y - 6 - p.liftPx, big ? 0.8 : 0.5);
      this.hitPlayer(shot.spec.damage(0), shot.x, shot.y, shot.spec.knockback);
    });
  }

  private objects(): Phaser.Types.Tilemaps.TiledObject[] {
    return this.map.getObjectLayer('Objects')?.objects ?? [];
  }

  private findSpawn(name?: string): { x: number; y: number } {
    const loc = session.state.location;
    if (!name && loc.zone === this.zoneId && loc.x !== undefined && loc.y !== undefined) {
      return { x: loc.x, y: loc.y };
    }
    const spawns = this.objects().filter((o) => o.type === 'playerSpawn');
    const chosen = spawns.find((o) => o.name === (name ?? loc.spawn)) ?? spawns[0];
    if (!chosen) return { x: 32, y: 32 };
    return objectCenter(chosen);
  }

  private spawnEnemies(): void {
    for (const obj of this.objects()) {
      if (obj.type !== 'enemy') continue;
      const enemyId = prop<string>(obj, 'enemyId');
      if (!enemyId) continue;
      const spawnId = `${this.zoneId}:${obj.name || obj.id}`;
      if (session.state.defeatedBosses.includes(spawnId)) continue;
      // Story enemies only show up once their chapter starts (and may leave later).
      if (!flagsAllow(obj)) continue;
      const pos = objectCenter(obj);
      const enemy = new Enemy(this, {
        enemyId,
        x: pos.x,
        y: pos.y,
        group: prop<string>(obj, 'group'),
        spawnId,
      });
      this.enemies.add(enemy);
      enemy.initBody();
    }
  }

  private aliveEnemies(): Enemy[] {
    return (this.enemies.getChildren() as Enemy[]).filter((e) => e.active && !e.isDead);
  }

  // --- Overlays ---------------------------------------------------------------

  toast(message: string): void {
    this.events.emit(WORLD_EVENTS.toast, message);
  }

  /** Pauses the world and shows a dialogue box; the dialogue resumes the world. */
  runDialogue(req: DialogueRequest): void {
    this.time.delayedCall(0, () => {
      this.player.setVelocity(0, 0);
      this.scene.pause();
      this.scene.launch(SCENES.dialogue, req);
    });
  }

  private openPause(): void {
    input.consumeAll();
    this.scene.pause();
    this.scene.launch(SCENES.pause);
  }

  private openLens(only?: Enemy): void {
    const cam = this.cameras.main.worldView;
    const onScreen = only ? [only] : this.aliveEnemies().filter((e) => cam.contains(e.x, e.y));
    const p = this.player;
    onScreen.sort(
      (a, b) =>
        Phaser.Math.Distance.Between(p.x, p.y, a.x, a.y) -
        Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y),
    );
    const selected = this.lastTarget && onScreen.includes(this.lastTarget) ? this.lastTarget : null;
    const ordered = selected ? [selected, ...onScreen.filter((e) => e !== selected)] : onScreen;
    const targets: LensTarget[] = ordered.map((e) => ({
      def: e.def,
      hp: e.hp,
      sheetKey: e.sheetKey,
      x: e.x - cam.x,
      y: e.y - cam.y,
    }));
    input.consumeAll();
    this.scene.pause();
    this.scene.launch(SCENES.lens, { targets, intro: only !== undefined });
  }

  /**
   * First time a boss fight starts, the Lens opens on the boss by itself (a rival card, like
   * GBA action-RPGs' boss intros), after any boss cutscene and dialogue.
   */
  private showBossCard(): boolean {
    const boss = this.pendingBossCard;
    if (!boss || this.scene.isActive(SCENES.dialogue)) return false;
    this.pendingBossCard = null;
    if (!boss.active || boss.isDead) return false;
    session.state.flags = { ...session.state.flags, [`bossCard.${boss.def.id}`]: true };
    this.openLens(boss);
    return true;
  }

  // --- Zone flow ----------------------------------------------------------------

  /** Takes off from a flight circle into the continent map. */
  openWorldMap(): void {
    if (this.changingZone) return;
    this.changingZone = true;
    this.player.controllable = false;
    this.player.setVelocity(0, 0);
    audio.play('takeoff');
    this.tweens.add({
      targets: this.player,
      y: this.player.y - 40,
      alpha: 0,
      duration: 400,
      ease: 'Quad.easeIn',
    });
    this.cameras.main.fadeOut(420);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.player.revert();
      this.scene.stop(SCENES.ui);
      this.scene.start(SCENES.worldMap, { from: this.zoneId });
    });
  }

  changeZone(zoneId: string, spawn: string, byFlight: boolean): void {
    if (this.changingZone || !ZONES[zoneId]) return;
    this.changingZone = true;
    if (!byFlight) audio.play('warp');
    this.player.controllable = false;
    this.player.setVelocity(0, 0);
    if (byFlight) {
      this.tweens.add({
        targets: this.player,
        y: this.player.y - 40,
        alpha: 0,
        duration: 400,
        ease: 'Quad.easeIn',
      });
    }
    this.cameras.main.fadeOut(byFlight ? 420 : 220);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.player.revert();
      session.state.location = { zone: zoneId, spawn };
      this.scene.restart({ zone: zoneId, spawn });
    });
  }

  private applyEquipment(): void {
    const eq = equipmentEffects(session.state);
    this.player.speedMult = eq.speedMult;
    this.player.defBonus = eq.defBonus;
    this.player.equipDamageMult = eq.damageMult;
    this.player.equipKiRegenMult = eq.kiRegenMult;
  }

  // --- CombatHost ---------------------------------------------------------------

  fireProjectile(spec: ProjectileSpec): void {
    const shot = new Projectile(this, spec);
    (spec.faction === 'player' ? this.shotGroup : this.enemyShots).add(shot);
    shot.launch();
  }

  liveEnemies(): Enemy[] {
    return this.aliveEnemies();
  }

  enemiesInRect(rect: Phaser.Geom.Rectangle): Enemy[] {
    return this.aliveEnemies().filter((e) =>
      Phaser.Geom.Intersects.RectangleToRectangle(rect, e.hurtbox),
    );
  }

  hitPlayer(raw: number, fromX: number, fromY: number, knockback: number): void {
    const res = this.player.receiveHit(raw, fromX, fromY, knockback);
    if (res.damage > 0) {
      audio.play(res.blocked ? 'block' : 'hurt');
      if (!res.blocked) {
        this.cameras.main.shake(90, 0.004);
        this.hitStop(BALANCE.hitStopMs);
      }
      this.events.emit(
        WORLD_EVENTS.damageNumber,
        this.player.x,
        this.player.y - 16,
        res.damage,
        res.blocked ? 'blocked' : 'player',
      );
    }
  }

  onPlayerHitEnemy(
    enemy: Enemy,
    damage: number,
    finisher: boolean,
    outcome: HitOutcome = 'hit',
    quiet = false,
  ): void {
    this.lastTarget = enemy;
    const number = (value: number | string, kind: DamageKind, dy = 14) =>
      this.events.emit(WORLD_EVENTS.damageNumber, enemy.x, enemy.y - dy, value, kind);
    if (outcome === 'outOfReach') {
      this.hintOnce('flying', t('hud.enemyFlies'));
      return;
    }
    if (outcome === 'downed') this.hintOnce('downed', t('hud.enemyDowned'));
    if (outcome === 'guarded') {
      if (!quiet) audio.play('block');
      number(damage, 'blocked');
      this.hintOnce('guard', t('hud.enemyGuards'));
      return;
    }
    if (outcome === 'absorbed') {
      if (!quiet) audio.play('kiFull');
      number(`+${-damage}`, 'blocked');
      this.hintOnce('absorb', t('hud.enemyAbsorbs'));
      return;
    }
    if (quiet) {
      // Beam ticks: a steady rattle of small hits, no freeze frames.
      if (outcome === 'guardBroken') audio.play('hitHeavy');
      number(damage, 'enemy');
      if (outcome === 'guardBroken') number(t('hud.guardBroken'), 'exp', 26);
      return;
    }
    audio.play(finisher || outcome === 'guardBroken' ? 'hitHeavy' : 'hit');
    this.hitStop(finisher ? BALANCE.finisherHitStopMs : BALANCE.hitStopMs);
    if (finisher) this.cameras.main.shake(70, 0.003);
    number(damage, 'enemy');
    if (outcome === 'guardBroken') number(t('hud.guardBroken'), 'exp', 26);
  }

  /** One explanatory toast per kind of enemy trait per zone visit. */
  private hintOnce(key: string, message: string): void {
    if (this.hinted.has(key)) return;
    this.hinted.add(key);
    this.toast(message);
  }

  onBossUltimate(enemy: Enemy, windupMs: number): void {
    this.toast(t('hud.bossUltimate', { name: t(enemy.displayNameKey) }));
    audio.play('ultimate');
    this.cameras.main.shake(windupMs, 0.0015);
    this.time.delayedCall(windupMs, () => this.cameras.main.flash(120, 220, 250, 255));
  }

  /** How far a blast or beam drawn `lift` px up gets along a ray before something stops it. */
  shotReach(origin: { x: number; y: number }, angle: number, maxLen: number, lift: number): number {
    return traceRay(origin, angle, maxLen, SHOT_RAY_STEP, (x, y) => this.blocksShot(x, y, lift));
  }

  /** A blast over ground point (x, y), drawn `lift` px up, hits a wall, a prop, a gate or a chest. */
  blocksShot(x: number, y: number, lift: number): boolean {
    const tile = this.collisionLayer.getTileAtWorldXY(x, y);
    if (tile?.collides && !tileFlag(tile, 'low')) {
      const name = (tile.properties as { name?: string } | undefined)?.name;
      const shotTile = { name, tall: tileFlag(tile, 'blocksFlight') };
      if (tileStopsShot(shotTile, x - tile.pixelX, y - tile.pixelY, tile.width, lift)) return true;
    }
    return this.content.blocksShot(x, y, lift);
  }

  playerShots(): Projectile[] {
    return this.shotGroup.getChildren() as Projectile[];
  }

  onEnemyDefeated(enemy: Enemy): void {
    audio.play('enemyDown');
    const char = session.state.activeCharacter;
    const grant = grantExp(
      session.state,
      char,
      enemy.def.exp,
      equipmentEffects(session.state).expMult,
    );
    session.state = grant.state;
    this.events.emit(
      WORLD_EVENTS.damageNumber,
      enemy.x,
      enemy.y - 24,
      t('hud.exp', { exp: grant.gained }),
      'exp',
    );
    if (grant.levelsGained > 0) this.onLevelUp(grant.newLevel);
    if (grant.levelsGained > 0) this.learnTechniques(char, true);
    if (this.lastTarget === enemy) this.lastTarget = null;
    const kills = session.state.kills;
    session.state.kills = { ...kills, [enemy.def.id]: (kills[enemy.def.id] ?? 0) + 1 };

    this.content.dropMoney(enemy.footX, enemy.footY, moneyDrop(enemy.def, enemy.isBoss));
    for (const drop of enemy.def.drops ?? []) {
      if (Math.random() < drop.chance) {
        this.content.dropItem(enemy.footX, enemy.footY - 4, drop.itemId);
        break;
      }
    }
    this.checkGroupCleared(enemy);
    if (enemy.isBoss) this.onBossDefeated(enemy);
  }

  private checkGroupCleared(enemy: Enemy): void {
    const group = enemy.spawn.group;
    if (!group) return;
    const remaining = this.aliveEnemies().some((e) => e.spawn.group === group);
    if (remaining) return;
    const key = `${this.zoneId}:${group}`;
    if (!session.state.clearedGroups.includes(key)) {
      session.state.clearedGroups = [...session.state.clearedGroups, key];
    }
    this.content.onGroupCleared(group);
  }

  private onBossDefeated(enemy: Enemy): void {
    session.state.defeatedBosses = [...session.state.defeatedBosses, enemy.spawn.spawnId];
    this.activeBoss = null;
    this.events.emit(WORLD_EVENTS.bossChanged, null);
    audio.play('explode');
    audio.sting('victory', ZONES[this.zoneId]?.music ?? null);
    const spawn = enemy.spawn.spawnId.slice(this.zoneId.length + 1);
    this.time.delayedCall(600, () => this.cutscenes.tryPlay({ on: 'bossDefeated', spawn }));
  }

  /**
   * A new boss phase is earned in the open (reference duel): the boss roots itself in a growing
   * aura, open to punishment, then bursts out transformed, blasting away whoever is close. A phase
   * cutscene (if any) plays first and the power-up starts when it ends.
   */
  onBossPhaseChange(enemy: Enemy, phaseIndex: number): void {
    const spawn = enemy.spawn.spawnId.slice(this.zoneId.length + 1);
    const phase = enemy.def.phases?.[phaseIndex];
    const look = phase?.look;
    const color = look && 'glow' in look && look.glow !== undefined ? look.glow : 0xffe070;
    const begin = () => {
      if (!enemy.active || enemy.isDead) return;
      // Still under the old name: the new one comes with the transformation.
      const named = enemy.def.phases?.slice(0, phaseIndex).filter((ph) => ph.nameKey) ?? [];
      const before = named[named.length - 1]?.nameKey;
      this.toast(t('hud.bossPowerUp', { name: t(before ?? enemy.def.nameKey) }));
      this.cameras.main.shake(BOSS_POWER_UP_MS, 0.0012);
      enemy.startPowerUp(look ? BOSS_POWER_UP_MS : BOSS_RAGE_MS, color, () => {
        // Beaten during the power-up: no transformation or taunt after the fact.
        if (!enemy.active || enemy.isDead) return;
        this.transformBoss(enemy);
        this.bossBurst(enemy, color);
        if (phase?.dialogueId) this.runDialogue({ lines: this.content.lines(phase.dialogueId) });
      });
    };
    if (this.cutscenes.tryPlay({ on: 'bossPhase', spawn, phase: phaseIndex }, begin)) return;
    begin();
  }

  /** The power-up's release: a flash and a shockwave that throws back a player standing close. */
  private bossBurst(enemy: Enemy, color: number): void {
    audio.play('kiBig');
    this.cameras.main.shake(260, 0.008);
    this.cameras.main.flash(160, 255, 255, 255);
    kiImpact(this, enemy.x, enemy.y - 6, color, true);
    const p = this.player;
    if (Phaser.Math.Distance.Between(enemy.footX, enemy.footY, p.footX, p.footY) < 44) {
      this.hitPlayer(Math.round(enemy.def.atk * 0.6), enemy.footX, enemy.footY, 300);
    }
  }

  /** Gives the boss its current phase's look and refreshes the boss bar's name. */
  transformBoss(enemy: Enemy): void {
    enemy.applyPhaseLook();
    audio.play('roar');
    if (enemy === this.activeBoss) this.events.emit(WORLD_EVENTS.bossChanged, enemy);
  }

  /** Replaces the solid tiles inside a pixel rect (story changes such as a broken anchor). */
  swapTiles(x: number, y: number, w: number, h: number, gid: number): void {
    const layer = this.collisionLayer;
    for (const tile of layer.getTilesWithinWorldXY(x, y, w, h)) {
      if (tile.index > 0) layer.putTileAt(gid, tile.x, tile.y);
    }
    layer.setCollisionByProperty({ collides: true });
  }

  clearEnemyShots(): void {
    for (const shot of [...this.enemyShots.getChildren()] as Projectile[]) shot.explode();
  }

  /** Teaches level-gated techniques; `announce` toasts each new one (after the level-up). */
  learnTechniques(characterId: string, announce: boolean): void {
    const { state, learned } = learnByLevel(
      session.state,
      characterId,
      getCharacter(characterId).techniqueUnlocks,
    );
    session.state = state;
    if (!announce) return;
    const name = t(getCharacter(characterId).nameKey);
    for (const id of learned) {
      audio.play('levelUp');
      this.toast(t('hud.learnedTechnique', { name, technique: t(getTechnique(id).nameKey) }));
    }
  }

  private onLevelUp(level: number): void {
    audio.play('levelUp');
    this.player.restoreAll();
    this.toast(t('hud.levelUp', { name: t(this.player.character.nameKey), level }));
    this.time.delayedCall(2100, () => this.toast(t('hud.pointsAvailable')));
    const ring = this.add
      .image(this.player.x, this.player.y, 'glow')
      .setTint(0xffe080)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(this.player.depth + 1)
      .setScale(0.2);
    this.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: 600,
      onComplete: () => ring.destroy(),
    });
  }

  onNotEnoughKi(): void {
    this.toast(t('hud.notEnoughKi'));
  }

  onSpecialChanged(): void {}

  onRunStart(x: number, y: number): void {
    sparkBurst(this, x, y, 0xd8c8a0, 4);
  }

  onTransform(_tr: TransformationDef, active: boolean): void {
    if (!active) return;
    audio.play('transform');
    this.cameras.main.flash(180, 255, 230, 120);
    this.cameras.main.shake(200, 0.004);
  }

  /** Freezes physics for a few ms so hits feel heavy. Uses real time: scene clocks keep running. */
  private hitStop(ms: number): void {
    if (this.physics.world.isPaused) return;
    this.physics.world.pause();
    this.anims.pauseAll();
    window.setTimeout(() => {
      if (!this.sys.isActive() && !this.sys.isPaused()) return;
      this.physics.world.resume();
      this.anims.resumeAll();
    }, ms);
  }

  canFly(): boolean {
    return !ZONES[this.zoneId]?.interior;
  }

  canLandHere(): boolean {
    const b = this.player.arcadeBody;
    return this.isOpenGround(b.x, b.y, b.width, b.height);
  }

  isOpenGround(x: number, y: number, width: number, height: number): boolean {
    return !this.collisionLayer
      .getTilesWithinWorldXY(x, y, width, height)
      .some((tile) => tile.collides);
  }

  onFlightDenied(reason: 'indoors' | 'land' | 'cantFly'): void {
    if (reason === 'cantFly') {
      this.toast(t('hud.cantFly', { name: t(this.player.character.nameKey) }));
      return;
    }
    this.toast(t(reason === 'indoors' ? 'hud.cantFlyIndoors' : 'hud.cantLand'));
  }

  onFlightChanged(flying: boolean): void {
    audio.play(flying ? 'takeoff' : 'land');
    if (!flying) this.dustPuff(this.player.footX, this.player.footY);
  }

  private dustPuff(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bit = this.add
        .image(x, y, 'pixel')
        .setScale(2)
        .setTint(0xd8d0b8)
        .setDepth(y + 1);
      this.tweens.add({
        targets: bit,
        x: x + Math.cos(a) * 10,
        y: y + Math.sin(a) * 4,
        alpha: 0,
        duration: 300,
        onComplete: () => bit.destroy(),
      });
    }
  }

  onPlayerDowned(): void {
    this.time.delayedCall(1100, () => {
      this.scene.pause();
      this.scene.launch(SCENES.gameOver, { zone: this.zoneId });
    });
  }

  /** A short floating label (damage, EXP, shards picked up). */
  floatText(x: number, y: number, text: string, kind: DamageKind): void {
    this.showDamageNumber(x, y, text, kind);
  }

  private showDamageNumber(x: number, y: number, amount: number | string, kind: DamageKind): void {
    const txt = this.add
      .bitmapText(Math.round(x), Math.round(y), FONT_SHADOW, String(amount))
      .setOrigin(0.5)
      .setTint(DAMAGE_COLORS[kind])
      .setDepth(100_000);
    this.tweens.add({
      targets: txt,
      y: y - 14,
      alpha: { from: 1, to: 0 },
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  // --- Loop -----------------------------------------------------------------------

  private bossCheck(): void {
    if (this.activeBoss?.active) return;
    const boss = this.aliveEnemies().find((e) => e.isBoss);
    if (!boss) return;
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, boss.x, boss.y);
    if (d > boss.def.ai.aggroRange) return;
    this.activeBoss = boss;
    this.events.emit(WORLD_EVENTS.bossChanged, boss);
    audio.playMusic(FINAL_BOSSES.has(boss.def.id) ? 'finale' : 'boss');
    if (!session.state.flags[`bossCard.${boss.def.id}`]) this.pendingBossCard = boss;
    const spawn = boss.spawn.spawnId.slice(this.zoneId.length + 1);
    this.cutscenes.tryPlay({ on: 'boss', spawn });
  }

  override update(time: number, delta: number): void {
    session.state.playTimeMs += delta;
    if (this.changingZone) return;
    this.scenery.update([this.player]);
    if (this.cinematic) {
      this.content.update();
      return;
    }
    if (this.showBossCard()) return;
    if (!this.player.isDowned) {
      if (input.justPressed('pause')) {
        this.openPause();
        return;
      }
      if (input.justPressed('lens')) {
        this.openLens();
        return;
      }
      if (this.handleInteract()) return;
      if (input.justPressed('switchChar')) this.switchCharacter();
    }
    this.player.update(time, delta);
    this.content.update();
    this.debug.update();
    this.bossCheck();
  }

  strikeProps(rect: Phaser.Geom.Rectangle, finisher: boolean): void {
    this.content.strike(rect, finisher);
  }

  /** Story hand-over: control passes to `id` in place (no tag effects beyond a flash). */
  playAs(id: string): void {
    if (session.state.activeCharacter === id) return;
    session.state = { ...session.state, activeCharacter: id };
    this.player.switchTo(id);
    this.learnTechniques(id, false);
  }

  /** R/RT tags in the next playable party member, in place, keeping each one's vitals. */
  private switchCharacter(): void {
    if (ZONES[this.zoneId]?.solo) return;
    const playable = (id: string) => isPlayable(id, session.state.flags);
    const next = nextCharacter(session.state, playable);
    if (!next || !this.player.canSwitch) return;
    session.state = switchCharacter(session.state, next, playable);
    this.player.switchTo(next);
    sparkBurst(this, this.player.x, this.player.y - 10, this.player.character.color, 10);
    audio.play('transform');
    this.toast(t('hud.switched', { name: t(this.player.character.nameKey) }));
  }

  /** E always interacts; attack interacts instead of punching when facing something. */
  private handleInteract(): boolean {
    const wantsInteract = input.justPressed('interact');
    const attackPressed = input.justPressed('attack');
    if (!wantsInteract && !attackPressed) return false;
    const target = this.content.target(!wantsInteract);
    if (!target) return false;
    input.consumeAll();
    this.player.cancelQueuedAttack();
    this.content.interact(target);
    return true;
  }
}
