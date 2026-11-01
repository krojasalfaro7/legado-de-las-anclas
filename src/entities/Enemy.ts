import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { getEnemy } from '../data/enemies';
import type { BossPattern, BossPhase, EnemyDef, ProjectileParams } from '../data/types';
import type { StringKey } from '../i18n';
import { audio } from '../services/audio';
import { type AiState, decideAiState } from '../systems/ai';
import { enemyRawDamage } from '../systems/combat';
import {
  FLYER_ALTITUDE,
  FLYER_DOWNED_MS,
  FLYER_REACH_PX,
  GUARD_BREAK_MS,
  type HitOutcome,
  type IncomingAttack,
  isFrontal,
  resolveEnemyHit,
  shotThreatens,
} from '../systems/enemyTraits';
import { spriteClassOf } from '../ui/actorFrames';
import { FEET_BOX, frameIndex, SHEET_KEYS } from '../ui/spriteSpec';
import { ensureActorSheet } from '../ui/textures';
import { facingVector } from '../utils/direction';
import {
  dustPuff,
  flashTint,
  impactFlash,
  kiImpact,
  shakeSprite,
  sparkBurst,
  swingTrail,
} from '../utils/fx';
import { Actor } from './Actor';
import type { CombatHost } from './types';

type AttackPattern = BossPattern | 'shot' | 'charge';
type AttackStage = 'windup' | 'active' | 'recover';

interface AttackRun {
  pattern: AttackPattern;
  stage: AttackStage;
  until: number;
  hitDone: boolean;
  dirX: number;
  dirY: number;
  /** Melee blows still to come in this string. */
  chainLeft: number;
}

const RECOVER_MS = 380;
const MELEE_ACTIVE_MS = 150;
const SHOT_ACTIVE_MS = 120;
const HP_BAR_VISIBLE_MS = 2200;
/** A shove lasts this long past the last frame a beam pressed on the enemy. */
const SHOVE_HOLD_MS = 60;
/** Own movement left to an enemy held under a beam. */
const SHOVED_MOVE_MULT = 0.25;
/** Struck enemies flash solid red for a moment. */
const HIT_FLASH = 0xff3a3a;
/** `blink`: time hidden after shattering, and the quick swing that follows the re-forming. */
const BLINK_GONE_MS = 260;
const BLINK_STRIKE_WINDUP_MS = 200;
/** Re-forms this far behind the player. */
const BLINK_BEHIND_PX = 22;
const MELEE_HIT: IncomingAttack = { source: 'melee', finisher: false, pierce: false };
/** Dodgers react to blasts inside this radius, sidestepping at this speed. */
const DODGE_RADIUS = 60;
const DODGE_SPEED = 210;
const DODGE_MS = 170;
const DODGE_COOLDOWN_MS = 1100;
/** Wind-up between the blows of a melee string (footage: ~3/8 s from blow to blow). */
const CHAIN_WINDUP_MS = 220;
/** Blows after the first one of a string hit a little softer. */
const CHAIN_DAMAGE_MULT = 0.75;
/** A string goes on only while the player is this close. */
const CHAIN_RANGE = 34;
/** Hits on a boss that is powering up land harder (it isn't defending). */
const POWER_UP_DAMAGE_MULT = 1.3;
/** Bosses circle the player inside this distance instead of walking straight at them. */
const ORBIT_RANGE = 80;
/** Flyers drop fast to strike (or when shot down) and climb back slowly: the punish window. */
const FLYER_DROP_SPEED = 80;
const FLYER_CLIMB_SPEED = 30;

export interface EnemySpawn {
  enemyId: string;
  x: number;
  y: number;
  /** Spawn group id: clearing every enemy of a group can reveal hidden things. */
  group?: string;
  /** Unique id inside the zone (Tiled object name), used for bosses. */
  spawnId: string;
}

export class Enemy extends Actor {
  readonly def: EnemyDef;
  readonly spawn: EnemySpawn;
  hp: number;
  private aiState: AiState = 'idle';
  private stateSince = 0;
  private hurtUntil = 0;
  private attackReadyAt = 0;
  private attack: AttackRun | null = null;
  private provokedUntil = 0;
  private patrolTarget: { x: number; y: number } | null = null;
  private knock = { vx: 0, vy: 0, until: 0, ms: 1 };
  /** A beam pressing on this enemy: slides it back whatever it is doing (see shove()). */
  private shoved = { vx: 0, vy: 0, until: 0 };
  private guardBrokenUntil = 0;
  private dodge = { vx: 0, vy: 0, until: 0, readyAt: 0 };
  /** Mid-fight power-up: rooted in a growing aura until `until`, then `done` runs. */
  private powerUp: {
    until: number;
    ms: number;
    color: number;
    done: () => void;
    /** Flame aura: one layer behind the body, a fainter one in front of it. */
    halo: Phaser.GameObjects.Graphics;
    front: Phaser.GameObjects.Graphics;
    nextMote: number;
  } | null = null;
  /** Which way a boss circles the player; flips now and then. */
  private orbitSign = 1;
  private orbitFlipAt = 0;
  /** Flyers: visual height above the shadow, and until when a blast keeps them grounded. */
  private altitude = 0;
  private downedUntil = 0;
  private lastUpdateAt = 0;
  /** Launched enemies are tossed up in an arc while they slide (visual only). */
  private hop = { start: 0, ms: 1, height: 0 };
  private drawnLift = 0;
  /** Blasts already rolled against (each shot gets one dodge roll). */
  private readonly judgedShots = new WeakSet<object>();
  private hpBarUntil = 0;
  private readonly hpBar: Phaser.GameObjects.Rectangle;
  private readonly hpBarBg: Phaser.GameObjects.Rectangle;
  private readonly homeX: number;
  private readonly homeY: number;
  phaseIndex = 0;
  private dying = false;

  constructor(
    private readonly host: CombatHost,
    spawn: EnemySpawn,
  ) {
    const def = getEnemy(spawn.enemyId);
    const key = SHEET_KEYS.enemy(def.id);
    ensureActorSheet(host, key, def.look);
    super(host, spawn.x, spawn.y, key, FEET_BOX[spriteClassOf(def.look)]);
    this.def = def;
    this.spawn = spawn;
    this.hp = def.hp;
    this.homeX = spawn.x;
    this.homeY = spawn.y;
    if (def.traits?.flying) this.altitude = FLYER_ALTITUDE;
    this.hpBarBg = host.add.rectangle(0, 0, 18, 3, 0x000000).setOrigin(0, 0.5).setVisible(false);
    this.hpBar = host.add.rectangle(0, 0, 16, 1, 0xff4040).setOrigin(0, 0.5).setVisible(false);
  }

  get isBoss(): boolean {
    return (this.def.phases?.length ?? 0) > 0;
  }

  /** A flyer high enough that punches pass under it. */
  get airborne(): boolean {
    return this.altitude > FLYER_REACH_PX;
  }

  get poweringUp(): boolean {
    return this.powerUp !== null;
  }

  /**
   * Phase change in the open (reference duel): the boss stands still gathering a growing aura
   * for `ms`, taking extra damage without flinching, then `done` transforms it.
   */
  startPowerUp(ms: number, color: number, done: () => void): void {
    const now = this.scene.time.now;
    this.attack = null;
    this.dodge.until = 0;
    this.holdPose('block', ms);
    const halo = this.scene.add.graphics();
    const front = this.scene.add.graphics();
    this.powerUp = { until: now + ms, ms, color, done, halo, front, nextMote: now };
    audio.play('kiFocus');
  }

  private runPowerUp(now: number): void {
    const pu = this.powerUp;
    if (!pu) return;
    this.setVelocity(0, 0);
    const t = 1 - (pu.until - now) / pu.ms;
    // The aura grows and its flames lick faster as it nears release.
    const cx = Math.round(this.x);
    const feet = Math.round(this.footY - this.drawnLift) + 2;
    const w = 11 + t * 5;
    const h = 34 + t * 10;
    pu.halo.clear().setDepth(this.depth - 0.5);
    pu.front.clear().setDepth(this.depth + 0.5);
    this.drawAura(pu.halo, cx, feet, w * 1.3, h * 1.15, now, pu.color, 0.35 + t * 0.15);
    this.drawAura(pu.halo, cx, feet, w, h, now + 90, pu.color, 0.6 + t * 0.2);
    this.drawAura(pu.halo, cx, feet, w * 0.55, h * 0.7, now + 40, 0xffffff, 0.35 + t * 0.25);
    this.drawAura(pu.front, cx, feet, w, h, now + 90, pu.color, 0.16);
    if (now >= pu.nextMote) {
      pu.nextMote = now + 110 - t * 60;
      const m = this.scene.add
        .image(this.x + Phaser.Math.Between(-9, 9), this.y + 4 - this.drawnLift, 'spark')
        .setTint(pu.color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(this.depth + 1);
      this.scene.tweens.add({
        targets: m,
        y: m.y - 22 - t * 14,
        alpha: 0,
        duration: 420,
        onComplete: () => m.destroy(),
      });
    }
    if (now < pu.until) return;
    pu.halo.destroy();
    pu.front.destroy();
    this.powerUp = null;
    this.attackReadyAt = now + 500;
    pu.done();
    // Damage taken meanwhile may have crossed the next threshold.
    this.updatePhase();
  }

  /**
   * One layer of a power-up aura: an egg around the body, round at the feet, breaking into
   * flickering flame tongues on top.
   */
  private drawAura(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    feet: number,
    w: number,
    h: number,
    now: number,
    color: number,
    alpha: number,
  ): void {
    const points: Phaser.Math.Vector2[] = [];
    const cy = feet - h / 2;
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const up = Math.max(0, -Math.sin(a));
      // Alternate tips and notches on the upper half, each tip flickering on its own beat.
      const tip = i % 2 === 0 ? (0.5 + 0.5 * Math.sin(now / 45 + i * 1.7)) * 9 * up : -2 * up;
      points.push(
        new Phaser.Math.Vector2(
          cx + Math.cos(a) * (w + tip * 0.25),
          cy + Math.sin(a) * (h / 2) - tip,
        ),
      );
    }
    g.fillStyle(color, alpha).fillPoints(points, true);
  }

  get isDead(): boolean {
    return this.dying;
  }

  get aiStateName(): AiState {
    return this.aiState;
  }

  get phase(): BossPhase | undefined {
    return this.def.phases?.[this.phaseIndex];
  }

  /** The latest phase so far that transforms the boss, if any. */
  private get formIndex(): number | undefined {
    const phases = this.def.phases ?? [];
    for (let i = this.phaseIndex; i >= 0; i--) if (phases[i]?.look) return i;
    return undefined;
  }

  /** Name for the boss bar: the transformed one once the boss changes form. */
  get displayNameKey(): StringKey {
    const form = this.formIndex;
    return (form !== undefined && this.def.phases?.[form]?.nameKey) || this.def.nameKey;
  }

  /** Switches to the current phase's transformed look (cutscenes call it at the reveal). */
  applyPhaseLook(): void {
    const form = this.formIndex;
    const look = form !== undefined ? this.def.phases?.[form]?.look : undefined;
    if (form === undefined || !look) return;
    const key = SHEET_KEYS.enemy(this.def.id, form);
    if (this.sheetKey === key) return;
    ensureActorSheet(this.scene, key, look);
    this.setSheet(key);
  }

  private get speedMult(): number {
    return this.phase?.speedMult ?? 1;
  }

  /** Call after adding to a physics group. */
  initBody(): void {
    this.arcadeBody.setCollideWorldBounds(true);
    this.arcadeBody.pushable = !this.isBoss && this.def.knockbackResist < 0.5;
  }

  /**
   * Applies a player hit through this enemy's traits (guard, ki absorption). Returns the damage
   * actually dealt (negative when it healed) and what happened.
   */
  takeHit(
    damage: number,
    fromX: number,
    fromY: number,
    knockback: number,
    attack: IncomingAttack = MELEE_HIT,
  ): { damage: number; outcome: HitOutcome } {
    if (this.dying) return { damage: 0, outcome: 'hit' };
    const now = this.scene.time.now;
    // Finishers and big blasts launch: long slide, tossed up, longer stun.
    const launch = attack.finisher || attack.launch === true;
    const res = resolveEnemyHit(this.def.traits, attack, {
      fromFront: isFrontal(
        facingVector(this.facing),
        { x: this.footX, y: this.footY },
        {
          x: fromX,
          y: fromY,
        },
      ),
      attacking: this.attack !== null,
      guardBroken: now < this.guardBrokenUntil,
      airborne: this.airborne,
    });
    if (res.outcome === 'outOfReach') {
      this.provokedUntil = now + 4000;
      return { damage: 0, outcome: res.outcome };
    }
    if (res.outcome === 'downed') {
      // Shot out of the air: it drops at once and stays down for a beating.
      this.downedUntil = now + FLYER_DOWNED_MS;
      this.altitude = 0;
      dustPuff(this.scene, this.footX, this.footY, 5);
    }
    // A guard still lets a point of chip damage through.
    const powerMult = this.powerUp ? POWER_UP_DAMAGE_MULT : 1;
    const scaled = Math.round(damage * res.damageMult * powerMult);
    const dealt = res.outcome === 'guarded' ? Math.max(1, scaled) : scaled;
    // Absorbed blasts heal (dealt < 0), but never past full health.
    this.hp =
      dealt < 0
        ? Math.max(this.hp, Math.min(this.def.hp, this.hp - dealt))
        : Math.max(0, this.hp - dealt);
    this.provokedUntil = now + 4000;
    this.hpBarUntil = now + HP_BAR_VISIBLE_MS;
    if (res.outcome === 'guarded') {
      this.holdPose('block', 220);
      sparkBurst(this.scene, this.x, this.y - 4, 0x9ad0ff, 4);
    } else if (res.outcome === 'absorbed') {
      sparkBurst(this.scene, this.x, this.y - 4, 0x9ff6ff, 8);
    } else {
      flashTint(this, HIT_FLASH);
      // The flash pops on the side the blow came from, at chest height.
      const a = Math.atan2(fromY - this.footY, fromX - this.footX);
      const chestY = this.y - 6 - this.drawnLift;
      if (attack.source === 'ki') {
        kiImpact(this.scene, this.x + Math.cos(a) * 4, chestY, attack.color ?? 0xffffff, launch);
      } else {
        impactFlash(this.scene, this.x + Math.cos(a) * 5, chestY, launch ? 0.8 : 0.5);
        sparkBurst(this.scene, this.x, chestY + 2, 0xffffff, launch ? 8 : 4);
        // Stone shatters on impact.
        if (attack.source === 'thrown') dustPuff(this.scene, this.x, chestY + 2, launch ? 6 : 3);
      }
      shakeSprite(this, launch ? BALANCE.finisherHitStopMs : BALANCE.hitStopMs);
    }
    if (res.outcome === 'guardBroken') this.guardBrokenUntil = now + GUARD_BREAK_MS;

    const resist = this.def.knockbackResist;
    const superArmor =
      (this.isBoss && (this.attack !== null || this.powerUp !== null)) || !res.staggers;
    if (!superArmor) {
      const angle = Math.atan2(this.footY - fromY, this.footX - fromX);
      const force = knockback * (1 - resist);
      const ms = BALANCE.knockbackMs * (launch ? 1.5 : 1);
      // The slide starts after the hit-stop (physics is frozen during it), at full speed.
      const stop = launch ? BALANCE.finisherHitStopMs : BALANCE.hitStopMs;
      this.knock = {
        vx: Math.cos(angle) * force,
        vy: Math.sin(angle) * force,
        until: now + stop + ms,
        ms,
      };
      if (launch && !this.def.traits?.flying) this.toss(now + stop, ms, 8 * (1 - resist));
      const stun = (launch ? BALANCE.enemyLaunchStunMs : BALANCE.enemyHurtStunMs) * (1 - resist);
      if (stun > 40) {
        this.hurtUntil = now + stun;
        this.attack = null;
        this.holdPose('hurt', stun);
      }
    }
    this.updatePhase();
    if (this.hp <= 0) this.die();
    return { damage: dealt, outcome: res.outcome };
  }

  /** Dodgers sidestep blasts heading at them (one roll per shot, then a cooldown). */
  private tryDodge(now: number): void {
    const chance = this.def.traits?.dodgeChance;
    if (!chance || now < this.dodge.readyAt || this.attack !== null || now < this.hurtUntil) return;
    const self = { x: this.footX, y: this.footY };
    for (const shot of this.host.playerShots?.() ?? []) {
      if (this.judgedShots.has(shot)) continue;
      const v = shot.body?.velocity;
      if (!v || !shotThreatens({ x: shot.x, y: shot.y, vx: v.x, vy: v.y }, self, DODGE_RADIUS))
        continue;
      this.judgedShots.add(shot);
      if (Math.random() >= chance) continue;
      // Step sideways to the shot's path, away from where it would hit.
      const len = Math.hypot(v.x, v.y) || 1;
      const side = (self.x - shot.x) * -v.y + (self.y - shot.y) * v.x >= 0 ? 1 : -1;
      this.dodge = {
        vx: (-v.y / len) * DODGE_SPEED * side,
        vy: (v.x / len) * DODGE_SPEED * side,
        until: now + DODGE_MS,
        readyAt: now + DODGE_COOLDOWN_MS,
      };
      this.afterimage();
      return;
    }
  }

  private afterimage(): void {
    const ghost = this.scene.add
      .image(this.x, this.y, this.texture.key, this.frame.name)
      .setOrigin(this.originX, this.originY)
      .setAlpha(0.5)
      .setTint(0x9ad0ff)
      .setDepth(this.depth - 1);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 220,
      onComplete: () => ghost.destroy(),
    });
  }

  private updatePhase(): void {
    const phases = this.def.phases;
    if (!phases || this.powerUp) return;
    const frac = this.hp / this.def.hp;
    let idx = 0;
    phases.forEach((p, i) => {
      if (frac <= p.hpBelow) idx = i;
    });
    if (idx !== this.phaseIndex && this.hp > 0) {
      this.phaseIndex = idx;
      this.attack = null;
      this.attackReadyAt = this.scene.time.now + 600;
      this.host.onBossPhaseChange?.(this, idx);
    }
  }

  private die(): void {
    this.dying = true;
    this.aiState = 'dead';
    this.attack = null;
    this.powerUp?.halo.destroy();
    this.powerUp?.front.destroy();
    this.powerUp = null;
    this.arcadeBody.enable = false;
    this.holdPose('hurt', 10_000);
    this.hpBar.setVisible(false);
    this.hpBarBg.setVisible(false);
    sparkBurst(this.scene, this.x, this.y, 0xffe080, 8);
    dustPuff(this.scene, this.footX, this.footY - 4, this.isBoss ? 14 : 7);
    this.host.onEnemyDefeated(this);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 380,
      onComplete: () => this.destroy(),
    });
  }

  override update(time: number): void {
    if (this.dying || !this.active) return;
    if (this.scripted || this.host.cinematic) {
      this.setVelocity(0, 0);
      return;
    }
    if (this.powerUp) {
      this.runPowerUp(time);
      this.drawHpBar(time);
      return;
    }
    const player = this.host.player;
    const distToPlayer = player.isDowned
      ? Number.POSITIVE_INFINITY
      : Phaser.Math.Distance.Between(this.footX, this.footY, player.footX, player.footY);
    const distFromHome = Phaser.Math.Distance.Between(
      this.footX,
      this.footY,
      this.homeX,
      this.homeY,
    );

    const next = decideAiState(
      {
        state: this.aiState,
        now: time,
        stateSince: this.stateSince,
        distToPlayer,
        distFromHome,
        hurtUntil: this.hurtUntil,
        attackBusy: this.attack !== null,
        attackReadyAt: this.attackReadyAt,
        provoked: time < this.provokedUntil,
        dead: this.dying,
      },
      this.def.ai,
    );
    if (next !== this.aiState) this.enterState(next, time);
    this.tryDodge(time);
    if (time < this.dodge.until) {
      this.setVelocity(this.dodge.vx, this.dodge.vy);
    } else {
      this.runState(time);
    }
    if (this.def.traits?.flying) this.updateAltitude(time);
    this.applyLift(time);
    this.drawHpBar(time);
  }

  /** Flyers hover, drop to strike or when downed, and climb back up afterwards. */
  private updateAltitude(now: number): void {
    const dt = Math.min(0.05, (now - (this.lastUpdateAt || now)) / 1000);
    this.lastUpdateAt = now;
    const up = now >= this.downedUntil && this.attack === null;
    this.altitude = up
      ? Math.min(FLYER_ALTITUDE, this.altitude + FLYER_CLIMB_SPEED * dt)
      : Math.max(0, this.altitude - FLYER_DROP_SPEED * dt);
  }

  /** Arcs the sprite up over `ms` from `start`, landing in a puff of dust. */
  private toss(start: number, ms: number, height: number): void {
    if (height < 2) return;
    this.hop = { start, ms, height };
    this.scene.time.delayedCall(start + ms - this.scene.time.now, () => {
      if (this.active && !this.dying) dustPuff(this.scene, this.footX, this.footY, 4);
    });
  }

  /** Draws the sprite above its shadow (flight altitude plus any toss), feet box unmoved. */
  private applyLift(now: number): void {
    const t = (now - this.hop.start) / this.hop.ms;
    const tossed = t > 0 && t < 1 ? this.hop.height * Math.sin(Math.PI * t) : 0;
    const hovering = this.def.traits?.flying && this.altitude >= FLYER_ALTITUDE;
    const bob = hovering ? Math.round(Math.sin(now / 200)) : 0;
    const lift = Math.round(this.altitude + tossed) + bob;
    if (lift === this.drawnLift) return;
    this.drawnLift = lift;
    this.setDisplayOrigin(this.width / 2, this.height / 2 + lift);
    this.arcadeBody.setOffset(this.bodyOffset.x, this.bodyOffset.y + lift);
    const k = 1 - Math.min(lift / FLYER_ALTITUDE, 1) * 0.35;
    this.shadow.setScale(k).setAlpha(0.5 + 0.5 * k);
  }

  protected override locomotion(moving: boolean): 'idle' | 'walk' | 'fly' {
    return this.airborne ? 'fly' : super.locomotion(moving);
  }

  private enterState(next: AiState, now: number): void {
    this.aiState = next;
    this.stateSince = now;
    if (next === 'attack') this.beginAttack(now);
    if (next === 'patrol') {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * this.def.ai.patrolRadius;
      this.patrolTarget = { x: this.homeX + Math.cos(a) * r, y: this.homeY + Math.sin(a) * r };
    }
  }

  private runState(now: number): void {
    const player = this.host.player;
    let vx = 0;
    let vy = 0;
    const speed = this.def.speed * this.speedMult;
    switch (this.aiState) {
      case 'hurt':
        ({ vx, vy } = this.knockVelocity(now));
        break;
      case 'patrol':
        if (this.patrolTarget)
          ({ vx, vy } = this.seek(this.patrolTarget.x, this.patrolTarget.y, speed * 0.5, 4));
        break;
      case 'return':
        ({ vx, vy } = this.seek(this.homeX, this.homeY, speed, 4));
        break;
      case 'chase':
        ({ vx, vy } = this.chase(player.footX, player.footY, speed));
        this.faceToward(player.footX, player.footY);
        break;
      case 'attack':
        ({ vx, vy } = this.runAttack(now));
        break;
      default:
        break;
    }
    if (this.aiState !== 'attack' && this.aiState !== 'hurt' && (vx !== 0 || vy !== 0)) {
      this.faceToward(this.footX + vx, this.footY + vy);
    }
    if (now < this.shoved.until) {
      // Under a beam: barely able to step against it, carried back by the shove.
      vx = vx * SHOVED_MOVE_MULT + this.shoved.vx;
      vy = vy * SHOVED_MOVE_MULT + this.shoved.vy;
    }
    this.setVelocity(vx, vy);
    if (this.aiState !== 'attack' && this.aiState !== 'hurt') this.animateLocomotion(vx, vy);
  }

  /** Pushed at (vx, vy) px/s for the next moment; a held beam calls this every frame. */
  shove(vx: number, vy: number, now: number): void {
    this.shoved = { vx, vy, until: now + SHOVE_HOLD_MS };
  }

  private knockVelocity(now: number): { vx: number; vy: number } {
    if (now >= this.knock.until) return { vx: 0, vy: 0 };
    const k = Math.min(1, (this.knock.until - now) / this.knock.ms);
    return { vx: this.knock.vx * k, vy: this.knock.vy * k };
  }

  private seek(
    tx: number,
    ty: number,
    speed: number,
    stopDist: number,
  ): { vx: number; vy: number } {
    const dx = tx - this.footX;
    const dy = ty - this.footY;
    const d = Math.hypot(dx, dy);
    if (d <= stopDist) return { vx: 0, vy: 0 };
    return { vx: (dx / d) * speed, vy: (dy / d) * speed };
  }

  private chase(px: number, py: number, speed: number): { vx: number; vy: number } {
    const preferred = this.phase?.keepAway ?? this.def.ai.preferredDistance;
    if (preferred === undefined && this.isBoss) return this.closeIn(px, py, speed);
    if (preferred === undefined) return this.seek(px, py, speed, this.def.ai.attackRange * 0.6);
    const dx = this.footX - px;
    const dy = this.footY - py;
    const d = Math.hypot(dx, dy) || 1;
    if (d < preferred - 16) return { vx: (dx / d) * speed, vy: (dy / d) * speed };
    if (d > preferred + 16) return { vx: (-dx / d) * speed, vy: (-dy / d) * speed };
    // Strafe around the player at the preferred distance.
    return { vx: (-dy / d) * speed * 0.5, vy: (dx / d) * speed * 0.5 };
  }

  /**
   * Bosses close in on a curve: far away they come straight, near the player they circle to the
   * side (switching direction now and then) to strike from the flank.
   */
  private closeIn(px: number, py: number, speed: number): { vx: number; vy: number } {
    const now = this.scene.time.now;
    if (now >= this.orbitFlipAt) {
      this.orbitFlipAt = now + 1200 + Math.random() * 1400;
      if (Math.random() < 0.5) this.orbitSign = -this.orbitSign;
    }
    const dx = px - this.footX;
    const dy = py - this.footY;
    const d = Math.hypot(dx, dy) || 1;
    if (d <= 18) return { vx: 0, vy: 0 };
    const side = d < ORBIT_RANGE ? 0.55 : 0;
    const vx = dx / d - (dy / d) * side * this.orbitSign;
    const vy = dy / d + (dx / d) * side * this.orbitSign;
    const k = speed / (Math.hypot(vx, vy) || 1);
    return { vx: vx * k, vy: vy * k };
  }

  /** After a string a boss may sidestep out of reach, leaving afterimages. */
  private sidestep(now: number): void {
    const p = this.host.player;
    const a =
      Math.atan2(p.footY - this.footY, p.footX - this.footX) + (Math.PI / 2) * this.orbitSign;
    this.dodge = {
      vx: Math.cos(a) * DODGE_SPEED,
      vy: Math.sin(a) * DODGE_SPEED,
      until: now + DODGE_MS,
      readyAt: now + DODGE_COOLDOWN_MS,
    };
    this.afterimage();
  }

  private choosePattern(dist: number): AttackPattern {
    const phase = this.phase;
    if (!phase) {
      if (this.def.ai.kind === 'ranged') return 'shot';
      if (this.def.ai.kind === 'tank') return 'charge';
      return 'melee';
    }
    const close = dist < 34;
    const options = phase.patterns.filter((p) => (close ? true : p !== 'melee'));
    if (close && phase.patterns.includes('melee') && Math.random() < 0.6) return 'melee';
    return options[Math.floor(Math.random() * options.length)] ?? 'melee';
  }

  private beginAttack(now: number): void {
    const player = this.host.player;
    const dist = Phaser.Math.Distance.Between(this.footX, this.footY, player.footX, player.footY);
    const pattern = this.choosePattern(dist);
    this.faceToward(player.footX, player.footY);
    const dx = player.footX - this.footX;
    const dy = player.footY - this.footY;
    const d = Math.hypot(dx, dy) || 1;
    const windup =
      pattern === 'blink'
        ? BLINK_GONE_MS
        : pattern === 'ultimate'
          ? (this.def.ai.ultimate?.windupMs ?? 1200)
          : this.def.ai.windupMs * (pattern === 'radialBurst' ? 1.5 : 1);
    this.attack = {
      pattern,
      stage: 'windup',
      until: now + windup,
      hitDone: false,
      dirX: dx / d,
      dirY: dy / d,
      chainLeft: pattern === 'melee' ? (this.def.ai.meleeChain ?? 1) - 1 : 0,
    };
    if (pattern === 'blink') {
      this.shatter();
      return;
    }
    if (pattern === 'ultimate') this.gatherUltimate(windup);
    this.holdPose(pattern === 'melee' ? 'block' : 'attack', windup);
    this.telegraph(windup);
  }

  /** `ultimate` windup: light pours into the boss while the screen warns the player. */
  private gatherUltimate(ms: number): void {
    this.host.onBossUltimate?.(this, ms);
    audio.play('kiFull');
    const color = this.def.ai.ultimate?.shots.color ?? 0xffffff;
    const pulses = Math.floor(ms / 160);
    for (let i = 0; i < pulses; i++) {
      this.scene.time.delayedCall(i * 160, () => {
        if (this.active && !this.dying) sparkBurst(this.scene, this.x, this.y - 10, color, 6);
      });
    }
  }

  private releaseUltimate(aim: number): number {
    const u = this.def.ai.ultimate;
    if (!u) return SHOT_ACTIVE_MS;
    const gap = 360 / u.shots.count;
    for (let w = 0; w < u.waves; w++) {
      this.scene.time.delayedCall(w * u.waveMs, () => {
        if (!this.active || this.dying) return;
        audio.play('kiBig');
        this.scene.cameras.main.shake(120, 0.005);
        this.fire(
          { ...u.shots, spreadDeg: gap },
          aim + Phaser.Math.DegToRad((w % 2) * gap * 0.5),
          'ki-big',
        );
      });
    }
    return u.waves * u.waveMs + SHOT_ACTIVE_MS;
  }

  /** `blink` windup: bursts into shards of its glow color and fades out. */
  private shatter(): void {
    sparkBurst(this.scene, this.x, this.y - 8, this.shardColor, 14);
    audio.play('kiFocus');
    this.arcadeBody.enable = false;
    this.scene.tweens.add({ targets: this, alpha: 0, duration: 120 });
  }

  private get shardColor(): number {
    const look = this.phase?.look;
    return look && 'glow' in look && look.glow !== undefined ? look.glow : 0xffffff;
  }

  /** `blink` re-forming: behind the player, already winding up a swing. */
  private reform(now: number): void {
    const player = this.host.player;
    const f = facingVector(player.facing);
    // Behind first; if a wall is there, beside, then in front, else where it vanished.
    const spots = [
      { x: -f.x, y: -f.y },
      { x: -f.y, y: f.x },
      { x: f.y, y: -f.x },
      { x: f.x, y: f.y },
    ].map((d) => ({
      x: player.footX + d.x * BLINK_BEHIND_PX,
      y: player.footY + d.y * BLINK_BEHIND_PX,
    }));
    const b = this.arcadeBody;
    const open = spots.find(
      (p) => this.host.isOpenGround?.(p.x - b.width / 2, p.y - b.height, b.width, b.height) ?? true,
    );
    if (open) this.placeFeet(open.x, open.y);
    this.arcadeBody.enable = true;
    this.setAlpha(1);
    sparkBurst(this.scene, this.x, this.y - 8, this.shardColor, 10);
    this.faceToward(player.footX, player.footY);
    const dx = player.footX - this.footX;
    const dy = player.footY - this.footY;
    const d = Math.hypot(dx, dy) || 1;
    this.attack = {
      pattern: 'melee',
      stage: 'windup',
      until: now + BLINK_STRIKE_WINDUP_MS,
      hitDone: false,
      dirX: dx / d,
      dirY: dy / d,
      // Re-forming behind the player opens a full string.
      chainLeft: (this.def.ai.meleeChain ?? 1) - 1,
    };
    this.holdPose('block', BLINK_STRIKE_WINDUP_MS);
    this.telegraph(BLINK_STRIKE_WINDUP_MS);
  }

  /** Red blink during windup so attacks are readable and dodgeable. */
  private telegraph(ms: number): void {
    const blinks = Math.max(1, Math.floor(ms / 120));
    this.scene.tweens.addCounter({
      from: 0,
      to: blinks,
      duration: ms,
      onUpdate: (tw) => {
        if (!this.active || this.dying) return;
        const on = Math.floor(tw.getValue() ?? 0) % 2 === 0;
        if (on) this.setTint(0xff7070);
        else this.clearTint();
      },
      onComplete: () => {
        if (this.active) this.clearTint();
      },
    });
  }

  private runAttack(now: number): { vx: number; vy: number } {
    const atk = this.attack;
    if (!atk) return { vx: 0, vy: 0 };
    if (now >= atk.until) this.advanceAttack(atk, now);
    if (!this.attack) return { vx: 0, vy: 0 };
    if (atk.stage !== 'active') return { vx: 0, vy: 0 };

    const player = this.host.player;
    if (atk.pattern === 'charge' || atk.pattern === 'dash') {
      const speed = (this.def.ai.chargeSpeed ?? 200) * this.speedMult;
      if (
        !atk.hitDone &&
        Phaser.Math.Distance.Between(this.footX, this.footY, player.footX, player.footY) < 16
      ) {
        atk.hitDone = true;
        this.host.hitPlayer(enemyRawDamage(this.def.atk, 1.3), this.footX, this.footY, 220);
      }
      if (this.arcadeBody.blocked.none === false) atk.until = now;
      return { vx: atk.dirX * speed, vy: atk.dirY * speed };
    }
    if (atk.pattern === 'melee') {
      if (
        !atk.hitDone &&
        Phaser.Math.Distance.Between(this.footX, this.footY, player.footX, player.footY) < 22
      ) {
        atk.hitDone = true;
        const first = atk.chainLeft === (this.def.ai.meleeChain ?? 1) - 1;
        const mult = first ? 1 : CHAIN_DAMAGE_MULT;
        this.host.hitPlayer(enemyRawDamage(this.def.atk, mult), this.footX, this.footY, 150);
      }
      const lunge = this.isBoss ? 170 : 110;
      return { vx: atk.dirX * lunge, vy: atk.dirY * lunge };
    }
    return { vx: 0, vy: 0 };
  }

  private advanceAttack(atk: AttackRun, now: number): void {
    if (atk.stage === 'windup' && atk.pattern === 'blink') {
      this.reform(now);
      return;
    }
    if (atk.stage === 'windup') {
      atk.stage = 'active';
      const activeMs = this.startActive(atk);
      atk.until = now + activeMs;
      this.holdPose('attack', activeMs);
      return;
    }
    if (atk.stage === 'active') {
      const p = this.host.player;
      const near =
        Phaser.Math.Distance.Between(this.footX, this.footY, p.footX, p.footY) < CHAIN_RANGE;
      if (atk.pattern === 'melee' && atk.chainLeft > 0 && near && !p.isDowned) {
        // Next blow of the string: a quick re-aim, no long telegraph.
        atk.chainLeft--;
        atk.stage = 'windup';
        atk.until = now + CHAIN_WINDUP_MS;
        atk.hitDone = false;
        this.faceToward(p.footX, p.footY);
        this.holdPose('block', CHAIN_WINDUP_MS);
        return;
      }
      atk.stage = 'recover';
      atk.until = now + RECOVER_MS;
      this.holdPose('idle', RECOVER_MS);
      return;
    }
    const cooldown = this.def.ai.attackCooldownMs * (this.phase?.cooldownMult ?? 1);
    this.attackReadyAt = now + cooldown * (0.8 + Math.random() * 0.4);
    this.attack = null;
    if (this.isBoss && atk.pattern === 'melee' && Math.random() < 0.5) this.sidestep(now);
  }

  /** Executes the instant part of an attack; returns how long the active stage lasts. */
  private startActive(atk: AttackRun): number {
    const player = this.host.player;
    const aim = Math.atan2(player.footY - this.footY, player.footX - this.footX);
    const base = this.def.ai.projectile;
    switch (atk.pattern) {
      case 'shot':
        if (base) this.fire(base, aim);
        return SHOT_ACTIVE_MS;
      case 'tripleShot':
        if (base) this.fire({ ...base, count: 3 }, aim);
        return SHOT_ACTIVE_MS;
      case 'ultimate':
        return this.releaseUltimate(aim);
      case 'radialBurst':
        if (base)
          this.fire({ ...base, count: 12, spreadDeg: 30, damageMult: base.damageMult * 0.8 }, aim);
        return SHOT_ACTIVE_MS * 2;
      case 'charge':
      case 'dash': {
        atk.dirX = Math.cos(aim);
        atk.dirY = Math.sin(aim);
        return this.def.ai.chargeDurationMs ?? 500;
      }
      default: {
        atk.dirX = Math.cos(aim);
        atk.dirY = Math.sin(aim);
        // Speed streaks ahead of the blow, like the player's.
        const reach = this.isBoss ? 14 : 11;
        swingTrail(this.scene, this.x + atk.dirX * 9, this.y - 6 + atk.dirY * 6, aim, reach);
        return MELEE_ACTIVE_MS;
      }
    }
  }

  private fire(
    p: ProjectileParams,
    aim: number,
    texture: 'ki-small' | 'ki-big' = 'ki-small',
  ): void {
    const spread = Phaser.Math.DegToRad(p.spreadDeg);
    const start = aim - (spread * (p.count - 1)) / 2;
    for (let i = 0; i < p.count; i++) {
      this.host.fireProjectile({
        faction: 'enemy',
        x: this.footX,
        y: this.footY,
        lift: Math.round(this.height / 2),
        angle: start + spread * i,
        speed: p.speed,
        texture,
        look: p.look,
        color: p.color,
        lifetimeMs: 2200,
        pierce: false,
        knockback: 90,
        damage: () => enemyRawDamage(this.def.atk, p.damageMult),
      });
    }
  }

  private drawHpBar(now: number): void {
    const show = now < this.hpBarUntil && !this.isBoss;
    this.hpBar.setVisible(show);
    this.hpBarBg.setVisible(show);
    if (!show) return;
    const top = this.y - this.height / 2 - 4 - this.drawnLift;
    const left = Math.round(this.x - 9);
    this.hpBarBg.setPosition(left, Math.round(top)).setDepth(this.depth + 1);
    this.hpBar
      .setPosition(left + 1, Math.round(top))
      .setDepth(this.depth + 2)
      .setSize(Math.max(1, Math.round(16 * (this.hp / this.def.hp))), 1);
  }

  /** Current idle frame; used by the lens to show a portrait. */
  get portraitFrame(): number {
    return frameIndex('down', 'idle');
  }

  override destroy(fromScene?: boolean): void {
    this.powerUp?.halo.destroy();
    this.powerUp?.front.destroy();
    this.hpBar.destroy();
    this.hpBarBg.destroy();
    super.destroy(fromScene);
  }
}
