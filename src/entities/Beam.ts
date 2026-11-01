import Phaser from 'phaser';
import { audio } from '../services/audio';
import {
  approach,
  type BeamTarget,
  beamContact,
  beamPushInertia,
  beamPushSpeed,
  beamShouldStop,
  rayToEdge,
} from '../systems/beam';
import { sparkBurst } from '../utils/fx';
import type { Enemy } from './Enemy';
import type { CombatHost } from './types';

/** Drawn above actors and shots, below the world's text plaques. */
const BEAM_DEPTH = 200_000;
/**
 * How fast the beam's head grows out of the hands (slow enough to see it travel), and how fast
 * the cut-off tail flies away.
 */
const EXTEND_SPEED = 420;
/** The beam swells from thin to full width over its first moments. */
const SWELL_MS = 180;
const TAIL_SPEED = 900;
/** Sparks where a wall stops the beam, this often. */
const WALL_SPARK_MS = 90;
/** Extra reach on each side of the beam when testing contact. */
const CONTACT_SLACK = 6;

export interface BeamSpec {
  /** Where the beam leaves the hands, at feet level (`lift` raises the drawing). */
  origin: () => { x: number; y: number; lift: number };
  /** False once the caster is gone, hurt or downed: the beam is cut off. */
  casterReady: () => boolean;
  angle: number;
  color: number;
  width: number;
  windupMs: number;
  minHoldMs: number;
  maxHoldMs: number;
  /** True while the player keeps the button down. */
  held: () => boolean;
  /** Spends ki for `ms` of firing; returns the ki left. */
  drain: (ms: number) => number;
  tickMs: number;
  knockback: number;
  /** Charged beams break guards. */
  pierce: boolean;
  damage: (targetDef: number) => number;
}

type Stage = 'windup' | 'firing' | 'release' | 'done';

/**
 * A sustained ki beam, fired while the button is held: a ball gathers in the hands, then the
 * beam grows out, sticks to the first enemy in line hitting it every tick (pushing it back),
 * and when the button is released the tail breaks off and flies out of the screen. Runs
 * itself from the scene's update.
 */
export class Beam {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private stage: Stage = 'windup';
  private readonly startedAt: number;
  private fireAt = 0;
  private head = 0;
  private tail = 0;
  private nextTickAt = 0;
  /** The enemy the beam is pressing on right now: it takes the final, launching blow. */
  private pinned: Enemy | null = null;
  /** Current shove on the pinned enemy (px/s): builds up with the target's inertia. */
  private pushSpeed = 0;
  /** A wall cuts the beam short this frame: its head sprays sparks there. */
  private walled = false;
  private nextSparkAt = 0;
  private origin: { x: number; y: number; lift: number };

  constructor(
    private readonly host: CombatHost,
    private readonly spec: BeamSpec,
  ) {
    this.gfx = host.add.graphics().setDepth(BEAM_DEPTH);
    this.startedAt = host.time.now;
    this.origin = spec.origin();
    audio.play('kiFocus');
    host.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    host.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** While true the caster stays rooted in the casting pose. */
  get holding(): boolean {
    return this.stage === 'windup' || this.stage === 'firing';
  }

  get done(): boolean {
    return this.stage === 'done';
  }

  /** Ends the beam early (caster hurt): an unfired ball just fizzles. */
  release(): void {
    if (this.stage === 'windup') this.finish();
    else if (this.stage === 'firing') this.stage = 'release';
  }

  private update(time: number, delta: number): void {
    if (this.stage === 'done') return;
    const dt = delta / 1000;
    if (this.holding && !this.spec.casterReady()) this.release();
    // release() may have finished it (an unfired ball fizzles).
    if ((this.stage as Stage) === 'done') return;
    if (this.stage !== 'release') this.origin = this.spec.origin();
    if (this.stage === 'windup') {
      if (time - this.startedAt >= this.spec.windupMs) this.fire(time);
      this.draw(time);
      return;
    }
    const edge = rayToEdge(this.origin, this.spec.angle, this.host.cameras.main.worldView) + 8;
    // Walls, trees and rocks stop the beam where they stop blasts (low tiles let it pass).
    const maxLen =
      this.host.shotReach?.(this.origin, this.spec.angle, edge, this.origin.lift) ?? edge;
    this.walled = maxLen < edge;
    if (this.stage === 'firing') {
      const kiLeft = this.spec.drain(delta);
      if (beamShouldStop(this.spec, time - this.fireAt, this.spec.held(), kiLeft)) {
        this.stage = 'release';
        if (this.pinned?.active && !this.pinned.isDead) this.strike(this.pinned, true);
      } else this.extend(time, dt, maxLen);
    }
    if (this.stage === 'release') {
      // Cut off from the hands: the beam's body flies on out of the screen.
      this.head = Math.min(maxLen, this.head + TAIL_SPEED * dt);
      this.tail += TAIL_SPEED * dt;
      if (this.tail >= this.head) {
        this.finish();
        return;
      }
    }
    this.draw(time);
  }

  private fire(time: number): void {
    this.stage = 'firing';
    this.fireAt = time;
    this.nextTickAt = time;
    audio.play('kiBig');
    this.host.cameras.main.shake(90, 0.003);
  }

  private extend(time: number, dt: number, maxLen: number): void {
    // Generous: the beam is drawn at chest height across sprites taller than their feet box.
    const halfWidth = this.spec.width / 2 + CONTACT_SLACK;
    const contact = beamContact(this.origin, this.spec.angle, maxLen, halfWidth, this.targets());
    const stop = contact ? contact.dist : maxLen;
    const pinned = contact && this.head >= contact.dist - 1 ? contact.ref : null;
    if (pinned !== this.pinned) this.pushSpeed = 0;
    this.pinned = pinned;
    if (pinned) this.push(pinned, time, dt);
    // The head races out, but snaps back at once if an enemy steps into the beam.
    this.head = Math.min(stop, this.head + EXTEND_SPEED * dt);
    if (!contact && this.walled && this.head >= maxLen - 1 && time >= this.nextSparkAt) {
      this.nextSparkAt = time + WALL_SPARK_MS;
      const p = this.point(this.head);
      sparkBurst(this.host, p.x, p.y, this.spec.color, 2);
    }
    if (!contact || this.head < contact.dist - 1 || time < this.nextTickAt) return;
    this.nextTickAt = time + this.spec.tickMs;
    this.strike(contact.ref);
  }

  /** A steady shove along the beam, slower and slower to start the heavier the target. */
  private push(enemy: Enemy, time: number, dt: number): void {
    const resist = enemy.def.knockbackResist;
    const target = beamPushSpeed(this.spec.knockback, resist, enemy.isBoss);
    this.pushSpeed = approach(this.pushSpeed, target, dt, beamPushInertia(resist));
    const a = this.spec.angle;
    enemy.shove(Math.cos(a) * this.pushSpeed, Math.sin(a) * this.pushSpeed, time);
  }

  /** A tick, or (`last`) the closing blow that launches the target off the beam's end. */
  private strike(enemy: Enemy, last = false): void {
    const s = this.spec;
    // Push straight along the beam (from a point just behind the target on the beam's line),
    // so the target slides back down the beam instead of drifting off it.
    const fromX = enemy.footX - Math.cos(s.angle) * 10;
    const fromY = enemy.footY - Math.sin(s.angle) * 10;
    const damage = s.damage(enemy.def.def) * (last ? 2 : 1);
    // Ticks only sting (the shove moves the target); the closing blow throws it off the end.
    const knockback = last ? s.knockback * 2.5 : 0;
    const hit = enemy.takeHit(damage, fromX, fromY, knockback, {
      source: 'ki',
      finisher: false,
      pierce: s.pierce,
      launch: last,
      color: s.color,
    });
    this.host.onPlayerHitEnemy(enemy, hit.damage, last, hit.outcome, !last);
    const p = this.point(this.head);
    sparkBurst(this.host, p.x, p.y, s.color, 3);
  }

  private targets(): Array<BeamTarget<Enemy>> {
    return this.host.liveEnemies().map((e) => ({
      x: e.footX,
      y: e.footY,
      r: Math.max(6, (e.body?.width ?? 12) / 2),
      ref: e,
    }));
  }

  /** A point along the beam, in drawing space (lifted to hand height). */
  private point(dist: number): { x: number; y: number } {
    return {
      x: this.origin.x + Math.cos(this.spec.angle) * dist,
      y: this.origin.y - this.origin.lift + Math.sin(this.spec.angle) * dist,
    };
  }

  private draw(time: number): void {
    const g = this.gfx.clear();
    const { color, width } = this.spec;
    const pulse = Math.sin(time / 30) > 0 ? 1 : 0;
    const hand = this.point(0);
    if (this.stage === 'windup') {
      const t = Math.min(1, (time - this.startedAt) / this.spec.windupMs);
      const r = 1.5 + t * width * 0.8 + pulse * 0.5;
      g.fillStyle(color, 0.3).fillCircle(hand.x, hand.y, r + 3);
      g.fillStyle(color, 1).fillCircle(hand.x, hand.y, r);
      g.fillStyle(0xffffff, 1).fillCircle(hand.x, hand.y, r * 0.5);
      return;
    }
    const a = this.point(this.tail);
    const b = this.point(this.head);
    const swell = this.stage === 'firing' ? Math.min(1, (time - this.fireAt) / SWELL_MS) : 1;
    const w = Math.max(2, Math.round(width * (0.35 + 0.65 * swell))) + pulse;
    g.lineStyle(w + 6, color, 0.25).lineBetween(a.x, a.y, b.x, b.y);
    g.lineStyle(w, color, 1).lineBetween(a.x, a.y, b.x, b.y);
    g.lineStyle(Math.max(2, Math.round(w * 0.4)), 0xffffff, 1).lineBetween(a.x, a.y, b.x, b.y);
    g.fillStyle(color, 1).fillCircle(b.x, b.y, w * 0.7);
    g.fillStyle(0xffffff, 1).fillCircle(b.x, b.y, w * 0.35);
    if (this.stage === 'firing') {
      g.fillStyle(color, 0.5).fillCircle(hand.x, hand.y, w * 0.8 + 2);
      g.fillStyle(0xffffff, 1).fillCircle(hand.x, hand.y, w * 0.45);
    }
  }

  private finish(): void {
    this.stage = 'done';
    this.destroy();
  }

  destroy(): void {
    this.stage = 'done';
    this.host.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.host.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    if (this.gfx.active) this.gfx.destroy();
  }
}
