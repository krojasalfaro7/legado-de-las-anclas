import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { getCharacter } from '../data/characters';
import { getTechnique } from '../data/kiTechniques';
import type {
  CharacterDef,
  CharacterTraits,
  KiTechniqueDef,
  MeleeStyle,
  TransformationDef,
} from '../data/types';
import { audio } from '../services/audio';
import { input } from '../services/input';
import { session } from '../services/session';
import { baseAim, pickTarget } from '../systems/aim';
import {
  chargedShot,
  focusRegenRate,
  incomingDamage,
  kiDamage,
  meleeDamage,
  shotReach,
} from '../systems/combat';
import { activeProgress, type CharacterProgress } from '../systems/gameState';
import {
  type CombatState,
  type CombatTiming,
  chargeLevel,
  downCombat,
  hurtCombat,
  initialCombat,
  isSwingActive,
  stepCombat,
} from '../systems/playerCombat';
import { type Dir, initialRun, type RunState, runSpeedMult, stepRun } from '../systems/run';
import { cycleIndex, type Special, specialsOf } from '../systems/specials';
import { type DerivedStats, deriveStats } from '../systems/stats';
import { canTransform, tickTransformation } from '../systems/transformation';
import { FEET_BOX, SHEET_KEYS } from '../ui/spriteSpec';
import { ensureActorSheet } from '../ui/textures';
import { facingFromAngle, facingFromVector, facingVector } from '../utils/direction';
import { flashTint, flashWhite, sparkBurst, swingTrail } from '../utils/fx';
import { Actor } from './Actor';
import { Beam } from './Beam';
import type { Enemy } from './Enemy';
import type { CombatHost } from './types';

export const PLAYER_BODY = FEET_BOX.humanoid;

/** The quick 4-hit chain (jab, jab, cross, kick) for characters without their own style. */
const DEFAULT_MELEE: MeleeStyle = BALANCE.melee;

function timingOf(style: MeleeStyle, traits: CharacterTraits, recoveryMult: number): CombatTiming {
  const k = BALANCE.ki;
  return {
    ...style,
    // SPD shortens the recovery between blows (and how soon moving cancels it).
    recoveryMs: style.recoveryMs.map((ms) => Math.round(ms * recoveryMult)),
    moveCancelMs: style.moveCancelMs.map((ms) => Math.round(ms * recoveryMult)),
    castMs: k.castMs,
    bufferMs: BALANCE.inputBufferMs,
    chargeTapMs: k.chargeTapMs,
    chargeFullMs: k.chargeTapMs + (k.chargeFullMs - k.chargeTapMs) * traits.chargeTimeMult,
  };
}

export const characterSheetKey = SHEET_KEYS.character;

/** How long a punch/kick pose outlasts its active window. */
const SWING_POSE_FOLLOW_MS = 80;

export class Player extends Actor {
  character: CharacterDef;
  private combat: CombatState = initialCombat();
  /** Enemies already hit by the current swing. */
  private swingHits = new Set<Enemy>();
  private swingStruckProps = false;
  private swingQuaked = false;
  /** The swing's speed streaks were drawn. */
  private swingTrailed = false;
  /** Direction of the current swing or shot; the sprite faces its closest 4-way facing. */
  private actionAngle = 0;
  private kiCooldownUntil = 0;
  private kiRegenAt = 0;
  /** How long the current focus has been held (its regen ramps up). */
  private focusMs = 0;
  private invulnerableUntil = 0;
  private knock = { vx: 0, vy: 0, until: 0 };
  /** Selected entry of the special selector (techniques, then transformations). */
  specialIndex = 0;
  private run: RunState = initialRun();
  transformation: TransformationDef | null = null;
  private aura: Phaser.GameObjects.Image | null = null;
  /** Equipment multiplier on movement speed (weights). */
  speedMult = 1;
  defBonus = 0;
  /** Equipment flavor effects (see EquipEffect). */
  equipDamageMult = 1;
  equipKiRegenMult = 1;
  /** While false, the player ignores input (dialogue, cutscenes). */
  controllable = true;
  /** True from takeoff until touchdown; the world uses it to relax tile collisions. */
  flying = false;
  /** Current visual height above the shadow (tweened on takeoff/landing). */
  private altitude = 0;
  private liftTween: Phaser.Tweens.Tween | null = null;
  private trailAt = 0;
  private moteAt = 0;
  /** Ball of ki growing in the hands while charging. */
  private chargeGlow: Phaser.GameObjects.Image | null = null;
  /** A sustained beam being fired: roots the player until it is released. */
  private beam: Beam | null = null;
  private beamCooldownMs = 0;
  /** Until when a special (e.g. a barrage still firing) keeps the player in place. */
  private rootedUntil = 0;
  private chargeFull = false;
  private focusPulseAt = 0;

  constructor(
    private readonly host: CombatHost,
    x: number,
    y: number,
    characterId: string,
  ) {
    const character = getCharacter(characterId);
    ensureCharacterSheets(host, character);
    super(host, x, y, characterSheetKey(character.id), PLAYER_BODY);
    this.character = character;
    this.arcadeBody.setCollideWorldBounds(true);
  }

  get style(): MeleeStyle {
    return this.character.melee ?? DEFAULT_MELEE;
  }

  private get timing(): CombatTiming {
    return timingOf(this.style, this.character.traits, this.derived.recoveryMult);
  }

  /** Swaps to another party member in place (the state's active character must match). */
  switchTo(characterId: string): void {
    this.revert();
    this.character = getCharacter(characterId);
    ensureCharacterSheets(this.scene, this.character);
    this.setSheet(characterSheetKey(this.character.id));
    this.specialIndex = 0;
    this.combat = initialCombat();
    this.swingHits = new Set();
    this.run = initialRun();
  }

  /** Switching needs a calm moment: on the ground and not mid-action. */
  get canSwitch(): boolean {
    return this.combat.phase === 'free' && !this.flying && this.transformation === null;
  }

  get progress(): CharacterProgress {
    return activeProgress(session.state);
  }

  get derived(): DerivedStats {
    return deriveStats(this.progress.stats, this.defBonus);
  }

  get hp(): number {
    return this.progress.vitals.hp;
  }

  set hp(v: number) {
    this.progress.vitals.hp = Phaser.Math.Clamp(v, 0, this.derived.maxHp);
  }

  get ki(): number {
    return this.progress.vitals.ki;
  }

  set ki(v: number) {
    this.progress.vitals.ki = Phaser.Math.Clamp(v, 0, this.derived.maxKi);
  }

  get isDowned(): boolean {
    return this.combat.phase === 'downed';
  }

  get isBlocking(): boolean {
    return this.combat.phase === 'block';
  }

  get isFocusing(): boolean {
    return this.combat.phase === 'focus';
  }

  get specials(): Special[] {
    return specialsOf(this.progress.techniques, this.availableForms);
  }

  /** Forms this character has earned so far (later forms unlock with the story). */
  get availableForms(): TransformationDef[] {
    const flags = session.state.flags;
    return this.character.transformations.filter((f) => !f.requiresFlag || flags[f.requiresFlag]);
  }

  get selectedSpecial(): Special | null {
    const list = this.specials;
    return list[this.specialIndex % Math.max(1, list.length)] ?? null;
  }

  /** The selected technique, or the first one while a transformation is selected. */
  get technique(): KiTechniqueDef {
    const sel = this.selectedSpecial;
    return getTechnique(
      sel?.kind === 'technique' ? sel.id : (this.progress.techniques[0] ?? 'spark'),
    );
  }

  get isRunning(): boolean {
    return this.run.running;
  }

  get damageMult(): number {
    return (this.transformation?.damageMult ?? 1) * this.equipDamageMult;
  }

  /**
   * The item-get moment: the player faces the camera with both arms up and the item held over
   * their head for a beat (reference footage), unable to move meanwhile.
   */
  showOff(texture: string, ms = 900): void {
    if (this.flying || this.combat.phase === 'downed') return;
    const wasControllable = this.controllable;
    this.controllable = false;
    this.setVelocity(0, 0);
    this.facing = 'down';
    this.holdPose('hurt', ms);
    const icon = this.scene.add
      .image(Math.round(this.x), Math.round(this.y - this.height / 2 + 2), texture)
      .setDepth(this.depth + 1)
      .setScale(0.5);
    // Held in both hands just above the head, shown at double size so it reads.
    this.scene.tweens.add({
      targets: icon,
      scale: 2,
      y: icon.y - 6,
      duration: 180,
      ease: 'Back.easeOut',
    });
    sparkBurst(this.scene, icon.x, icon.y - 4, 0xffe080, 6);
    this.scene.time.delayedCall(ms, () => {
      icon.destroy();
      if (wasControllable) this.controllable = true;
    });
  }

  get speed(): number {
    const flight = this.flying ? BALANCE.flight.speedMult : 1;
    const r = BALANCE.run;
    const runMult = this.character.traits.runMult;
    const run = runSpeedMult(this.run, this.scene.time.now, r.speedMult * runMult, r.burstMult);
    return (
      this.character.baseSpeed *
      this.speedMult *
      this.derived.speedMult *
      (this.transformation?.speedMult ?? 1) *
      flight *
      run
    );
  }

  override update(time: number, delta: number): void {
    if (this.combat.phase === 'downed') {
      this.setVelocity(0, 0);
      return;
    }
    this.tickKi(time, delta);
    if (this.beam?.holding) {
      this.setVelocity(0, 0);
      this.holdPose('cast', 60);
      this.updateAltitude(time);
      this.updateAura();
      return;
    }
    if (this.beam) {
      // The beam just ended: ki recovers and the technique cools down from now.
      this.kiRegenAt = time + BALANCE.kiRegenDelayMs;
      this.kiCooldownUntil = time + this.beamCooldownMs;
      this.beam = null;
    }
    this.updateRun(time);
    if (this.controllable) this.handleToggles();
    this.updateCombat(time);
    this.move(time);
    this.updateAltitude(time);
    this.updateAura();
    this.updateChargeGlow(time);
  }

  private handleToggles(): void {
    if (input.justPressed('switchKi')) this.cycleSpecial();
    if (input.justPressed('fly')) this.toggleFlight();
  }

  private moveInput(): { x: number; y: number } {
    return this.controllable ? input.move() : { x: 0, y: 0 };
  }

  /** Called by the world when attack is used to interact instead (facing an NPC/chest). */
  cancelQueuedAttack(): void {
    if (this.combat.buffer?.action === 'attack') this.combat = { ...this.combat, buffer: null };
  }

  private updateCombat(time: number): void {
    const tech = this.technique;
    const move = this.moveInput();
    const special = this.selectedSpecial;
    const kiPressed = this.controllable && input.justPressed('ki');
    // The ki button runs the selected special; a transformation toggles outside the state machine.
    const isTechnique = special?.kind !== 'transform';
    const castPressed = kiPressed && isTechnique;
    const blockHeld = this.controllable && input.isDown('block');
    // Focus (guard + ki) works whatever is selected; charging only for techniques.
    const kiHeld = this.controllable && input.isDown('ki') && (isTechnique || blockHeld);
    if (kiPressed && !isTechnique && !blockHeld && this.combat.phase !== 'hurt')
      this.toggleTransformation();
    const step = stepCombat(
      this.combat,
      {
        now: time,
        attackPressed: this.controllable && input.justPressed('attack'),
        kiPressed: castPressed,
        kiHeld,
        blockHeld,
        moving: move.x !== 0 || move.y !== 0,
        kiReady: time >= this.kiCooldownUntil && this.ki >= tech.kiCost,
      },
      this.timing,
    );
    this.combat = step.state;
    for (const e of step.events) {
      if (e.type === 'swing') this.beginSwing(e.step);
      else if (e.type === 'chargeStart' && tech.beam) this.startBeam(time);
      else if (e.type === 'chargeStart') this.beginCharge();
      else if (e.type === 'cast') this.fireKi(time, e.charge);
      else if (this.ki < tech.kiCost) this.host.onNotEnoughKi();
    }
    if (this.combat.phase === 'block' || this.combat.phase === 'focus') this.holdPose('block', 50);
    if (this.combat.phase === 'charge') this.holdPose('cast', 50);
    if (isSwingActive(this.combat, time)) this.applySwingHits();
  }

  /** Every swing re-reads the input, so the player can turn between hits. */
  private beginSwing(step: number): void {
    const m = this.style;
    audio.play('swing');
    const base = baseAim(this.moveInput(), facingVector(this.facing));
    const target = pickTarget({ x: this.footX, y: this.footY }, base, this.aimTargets(), {
      coneDeg: m.assistConeDeg,
      range: m.assistRange,
    });
    this.actionAngle = target ? Math.atan2(target.y - this.footY, target.x - this.footX) : base;
    this.facing = facingFromAngle(this.actionAngle);
    this.swingHits = new Set();
    this.swingStruckProps = false;
    this.swingQuaked = false;
    this.swingTrailed = false;
    const pose = m.poses[step] ?? 'attack';
    // The limb stays out a little into the recovery so the blow reads (footage: ~4 frames).
    this.holdPose(pose, m.startupMs + m.activeMs + SWING_POSE_FOLLOW_MS);
  }

  private aimTargets(): Array<{ x: number; y: number; enemy: Enemy }> {
    return this.host.liveEnemies().map((enemy) => ({ x: enemy.footX, y: enemy.footY, enemy }));
  }

  /**
   * Strip in front of the player, along the swing direction, from the body's edge out to
   * `reach` (where the fist lands) and `width` across; boxed to an AABB for diagonals.
   */
  meleeHitbox(): Phaser.Geom.Rectangle {
    const m = this.style;
    const near = 2;
    const halfDepth = (m.reach - near) / 2;
    const halfWidth = m.width / 2;
    const c = Math.cos(this.actionAngle);
    const s = Math.sin(this.actionAngle);
    const cx = this.footX + c * (near + halfDepth);
    const cy = this.footY - 6 + s * (near + halfDepth);
    const hw = Math.abs(c) * halfDepth + Math.abs(s) * halfWidth;
    const hh = Math.abs(s) * halfDepth + Math.abs(c) * halfWidth;
    return new Phaser.Geom.Rectangle(cx - hw, cy - hh, hw * 2, hh * 2);
  }

  private applySwingHits(): void {
    const step = this.combat.step;
    const m = this.style;
    const finisher = step === m.recoveryMs.length - 1;
    if (!this.swingStruckProps) {
      this.swingStruckProps = true;
      this.host.strikeProps?.(this.meleeHitbox(), finisher);
    }
    const box = this.meleeHitbox();
    if (!this.swingTrailed) {
      // Speed streaks ahead of the fist (or foot) on every swing, hit or miss.
      this.swingTrailed = true;
      // Anchored on the fist at hand height (not the hitbox, which reaches further out).
      const reach = finisher ? 14 : 11;
      swingTrail(
        this.scene,
        this.footX + Math.cos(this.actionAngle) * reach,
        this.footY + Math.sin(this.actionAngle) * reach * 0.6 - BALANCE.ki.shotLift - this.liftPx,
        this.actionAngle,
        finisher ? 13 : 9,
      );
    }
    const mult = (m.comboMults[step] ?? 1) * m.power;
    let landed = false;
    for (const enemy of this.host.enemiesInRect(box)) {
      if (this.swingHits.has(enemy) || enemy.isDead) continue;
      this.swingHits.add(enemy);
      const dmg = meleeDamage(this.progress.stats.str, mult, this.damageMult, enemy.def.def);
      const attack = { source: 'melee', finisher, pierce: false } as const;
      const hit = enemy.takeHit(dmg, this.footX, this.footY, m.knockback[step] ?? 60, attack);
      // A punch passing under a flyer is a whiff: no freeze.
      if (hit.outcome !== 'outOfReach') landed = true;
      this.host.onPlayerHitEnemy(enemy, hit.damage, finisher, hit.outcome);
    }
    // Frozen mid-blow during the hit-stop, like the target.
    if (landed)
      this.holdPose(
        this.pose,
        this.poseLockUntil -
          this.scene.time.now +
          (finisher ? BALANCE.finisherHitStopMs : BALANCE.hitStopMs),
      );
    const quake = this.character.traits.finisherQuake;
    if (finisher && landed && quake && !this.swingQuaked) this.groundQuake(box, quake, mult);
  }

  /** Okun's finisher: the ground cracks around the blow and staggers whoever stands near. */
  private groundQuake(box: Phaser.Geom.Rectangle, radius: number, mult: number): void {
    this.swingQuaked = true;
    this.scene.cameras.main.shake(140, 0.006);
    const ring = this.scene.add
      .image(box.centerX, box.centerY + 6, 'glow')
      .setTint(this.character.color)
      .setAlpha(0.6)
      .setScale(0.3, 0.15)
      .setDepth(this.depth - 1);
    this.scene.tweens.add({
      targets: ring,
      scaleX: radius / 16,
      scaleY: radius / 32,
      alpha: 0,
      duration: 260,
      onComplete: () => ring.destroy(),
    });
    for (const enemy of this.host.liveEnemies()) {
      if (this.swingHits.has(enemy)) continue;
      const d = Phaser.Math.Distance.Between(box.centerX, box.centerY, enemy.footX, enemy.footY);
      if (d > radius) continue;
      this.swingHits.add(enemy);
      const dmg = meleeDamage(this.progress.stats.str, mult * 0.5, this.damageMult, enemy.def.def);
      const hit = enemy.takeHit(dmg, box.centerX, box.centerY, 120);
      this.host.onPlayerHitEnemy(enemy, hit.damage, false, hit.outcome);
    }
  }

  private beginCharge(): void {
    this.chargeFull = false;
    this.facing = facingFromAngle(baseAim(this.moveInput(), facingVector(this.facing)));
  }

  /** Charge of the blast being held right now (0 while not charging). */
  get charge(): number {
    if (this.combat.phase !== 'charge') return 0;
    return chargeLevel(this.scene.time.now - this.combat.chargeFrom, this.timing);
  }

  /**
   * The state machine already checked cooldown and base ki cost; `charge` (0..1) comes from
   * how long the button was held and is trimmed to the ki available.
   */
  private fireKi(time: number, charge: number): void {
    const tech = this.technique;
    const k = BALANCE.ki;
    const shot = chargedShot(tech, charge, this.ki, k);
    const c = shot.charge;
    this.ki -= shot.kiCost;
    audio.play(tech.texture === 'ki-big' || c >= 0.5 ? 'kiBig' : 'kiShot');
    if (c >= 1) this.scene.cameras.main.shake(120, 0.004);
    this.kiRegenAt = time + BALANCE.kiRegenDelayMs;
    this.kiCooldownUntil = time + tech.cooldownMs;

    // Specials go exactly where the player aims (8-way), no lock-on (user feedback).
    const aim = baseAim(this.moveInput(), facingVector(this.facing));
    this.actionAngle = aim;
    this.facing = facingFromAngle(aim);
    this.holdPose('cast', k.castMs);
    if (tech.beam) {
      this.castBeam(tech, tech.beam, shot, aim, time);
      return;
    }

    const spread = Phaser.Math.DegToRad(tech.spreadDeg);
    const pow = this.progress.stats.pow;
    const mult = this.damageMult;
    // Charged blasts swell: bigger orb and glow, wider hit circle.
    const big = tech.texture === 'ki-big' || c >= 0.5;
    const volley = (center: number): void => {
      const start = center - (spread * (tech.count - 1)) / 2;
      for (let i = 0; i < tech.count; i++) {
        // Each shot starts along its own angle so wide spreads (a full ring) open from the body.
        const angle = start + spread * i;
        this.host.fireProjectile({
          faction: 'player',
          x: this.footX + Math.cos(angle) * 8,
          y: this.footY + Math.sin(angle) * 6,
          lift: k.shotLift + this.liftPx,
          angle,
          speed: tech.speed,
          texture: big ? 'ki-big' : 'ki-small',
          look: tech.look,
          color: tech.color,
          radius: c > 0 ? (big ? 7 : 5) + Math.round(3 * c) : undefined,
          glowScale: c > 0 ? (big ? 0.8 : 0.45) + 0.7 * c : undefined,
          ...shotReach(tech),
          pierce: shot.pierce,
          knockback: tech.knockback * shot.knockbackMult,
          heavy: tech.heavy === true || shot.charge >= 1,
          damage: (def) => kiDamage(tech.power * shot.powerMult, pow, mult, def),
        });
      }
    };
    volley(aim);
    this.rootedUntil = time + k.castMs;
    // Barrages keep firing, wobbling a little around the aim; turning mid-barrage swings it.
    const burst = tech.burst;
    if (!burst) return;
    this.holdPose('cast', k.castMs + burst.shots * burst.intervalMs);
    this.rootedUntil = time + k.castMs + burst.shots * burst.intervalMs;
    for (let b = 1; b < burst.shots; b++) {
      this.scene.time.delayedCall(b * burst.intervalMs, () => {
        if (!this.active || this.isDowned || this.combat.phase === 'hurt') return;
        audio.play('kiShot');
        const turned = facingFromAngle(aim) !== this.facing;
        const v = facingVector(this.facing);
        const center = turned ? Math.atan2(v.y, v.x) : aim;
        volley(center + Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-1, 1) * burst.jitterDeg));
      });
    }
  }

  /**
   * Beams don't charge (user feedback): pressing the button fires at once and the beam lasts
   * while it is held. The combat machine goes back to free so the release fires nothing else.
   */
  private startBeam(time: number): void {
    this.combat = initialCombat();
    this.fireKi(time, 0);
  }

  private castBeam(
    tech: KiTechniqueDef,
    beam: NonNullable<KiTechniqueDef['beam']>,
    shot: ReturnType<typeof chargedShot>,
    aim: number,
    time: number,
  ): void {
    this.kiRegenAt = Number.POSITIVE_INFINITY;
    this.kiCooldownUntil = Number.POSITIVE_INFINITY;
    this.beamCooldownMs = tech.cooldownMs;
    void time;
    const pow = this.progress.stats.pow;
    const mult = this.damageMult;
    // Charge mostly buys time; each tick gets only a little stronger.
    const tickPower = tech.power * (1 + (shot.powerMult - 1) * 0.3);
    this.beam = new Beam(this.host, {
      origin: () => ({
        x: this.footX + Math.cos(aim) * 9,
        y: this.footY + Math.sin(aim) * 5,
        lift: BALANCE.ki.shotLift + this.liftPx,
      }),
      casterReady: () => this.active && this.combat.phase !== 'hurt' && !this.isDowned,
      angle: aim,
      color: tech.color,
      width: beam.width + Math.round(2 * shot.charge),
      windupMs: beam.windupMs,
      minHoldMs: beam.minHoldMs,
      maxHoldMs: beam.maxHoldMs,
      held: () => this.controllable && input.isDown('ki'),
      drain: (ms) => {
        this.ki = Math.max(0, this.ki - (beam.kiPerSec * ms) / 1000);
        return this.ki;
      },
      tickMs: beam.tickMs,
      knockback: tech.knockback,
      pierce: shot.pierce,
      damage: (def) => kiDamage(tickPower, pow, mult, def),
    });
  }

  private cycleSpecial(): void {
    const n = this.specials.length;
    if (n <= 1) return;
    this.specialIndex = cycleIndex(this.specialIndex % n, n);
    audio.play('menuMove');
    this.host.onSpecialChanged();
  }

  /** Double-tap a direction to run; see systems/run.ts. */
  private updateRun(time: number): void {
    const dirs: Dir[] = ['up', 'down', 'left', 'right'];
    const tapped = this.controllable ? (dirs.find((d) => input.justPressed(d)) ?? null) : null;
    const move = this.moveInput();
    const free = this.combat.phase === 'free' || this.combat.phase === 'swing';
    const next = stepRun(
      this.run,
      tapped,
      free && (move.x !== 0 || move.y !== 0),
      time,
      BALANCE.run,
    );
    if (next.running && !this.run.running) this.host.onRunStart?.(this.footX, this.footY);
    this.run = next;
    this.anims.timeScale = next.running ? 1.5 : 1;
  }

  toggleTransformation(): void {
    if (this.transformation) {
      this.revert();
      return;
    }
    const sel = this.selectedSpecial;
    const tr =
      this.availableForms.find((f) => sel?.kind === 'transform' && f.id === sel.id) ??
      this.availableForms[0];
    if (!tr) return;
    if (!canTransform(this.ki, tr.minKiToActivate)) {
      this.host.onNotEnoughKi();
      return;
    }
    this.transformation = tr;
    this.setSheet(characterSheetKey(this.character.id, tr.id));
    // Anchor light: a soft halo plus motes drifting up (see updateAura), not a flame aura.
    this.aura = this.scene.add
      .image(this.x, this.y, 'glow')
      .setTint(tr.auraColor)
      .setAlpha(0.55)
      .setScale(0.9, 1.1)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: this.aura,
      alpha: 0.3,
      yoyo: true,
      repeat: -1,
      duration: 700,
      ease: 'Sine.easeInOut',
    });
    this.host.onTransform(tr, true);
  }

  revert(): void {
    const tr = this.transformation;
    if (!tr) return;
    this.transformation = null;
    this.setSheet(characterSheetKey(this.character.id));
    this.aura?.destroy();
    this.aura = null;
    this.host.onTransform(tr, false);
  }

  toggleFlight(): void {
    if (this.flying) {
      if (!this.host.canLandHere()) {
        this.host.onFlightDenied('land');
        return;
      }
      this.setFlying(false, true);
      return;
    }
    if (!this.character.canFly) {
      this.host.onFlightDenied('cantFly');
      return;
    }
    if (!this.host.canFly()) {
      this.host.onFlightDenied('indoors');
      return;
    }
    if (this.combat.phase !== 'free') return;
    this.setFlying(true, true);
  }

  /** Takes off or lands; `animate` false snaps (zone load, knocked out). */
  setFlying(flying: boolean, animate: boolean): void {
    if (this.flying === flying && !this.liftTween) return;
    this.flying = flying;
    this.liftTween?.stop();
    this.liftTween = null;
    const target = flying ? BALANCE.flight.altitude : 0;
    if (!animate) {
      this.altitude = target;
    } else {
      this.liftTween = this.scene.tweens.add({
        targets: this,
        altitude: target,
        duration: BALANCE.flight.liftMs,
        ease: flying ? 'Quad.easeOut' : 'Quad.easeIn',
        onComplete: () => {
          this.liftTween = null;
        },
      });
    }
    this.host.onFlightChanged(flying);
  }

  /**
   * Lifts the sprite without moving the physics body: raising the display origin and the
   * body offset by the same amount cancels out in Arcade's body position.
   */
  private updateAltitude(time: number): void {
    const bob = this.flying && !this.liftTween ? Math.round(Math.sin(time / 180)) : 0;
    const lift = Math.round(this.altitude) + bob;
    this.setDisplayOrigin(this.width / 2, this.height / 2 + lift);
    this.arcadeBody.setOffset(this.bodyOffset.x, this.bodyOffset.y + lift);
    const k = 1 - Math.min(this.altitude / BALANCE.flight.altitude, 1) * 0.35;
    this.shadow.setScale(k).setAlpha(0.5 + 0.5 * k);
    this.spawnTrail(time, lift);
  }

  private spawnTrail(time: number, lift: number): void {
    const v = this.arcadeBody.velocity;
    if (!this.flying || time < this.trailAt || (v.x === 0 && v.y === 0)) return;
    this.trailAt = time + 45;
    const look = this.transformation?.look ?? this.character.look;
    const color = look.kind === 'humanoid' ? look.accent : this.character.color;
    const bit = this.scene.add
      .image(this.x - Math.sign(v.x) * 4, this.y - lift + 2 - Math.sign(v.y) * 3, 'pixel')
      .setScale(2)
      .setTint(color)
      .setDepth(this.depth - 1);
    this.scene.tweens.add({
      targets: bit,
      alpha: 0,
      scale: 0.5,
      duration: 260,
      onComplete: () => bit.destroy(),
    });
  }

  protected override locomotion(moving: boolean): 'idle' | 'walk' | 'fly' {
    return this.flying ? 'fly' : super.locomotion(moving);
  }

  get liftPx(): number {
    return Math.round(this.altitude);
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    // Flying actors draw above everything standing on the ground.
    if (this.flying) this.setDepth(this.depth + 10_000);
  }

  private updateAura(): void {
    if (!this.aura || !this.transformation) return;
    this.aura.setPosition(Math.round(this.x), Math.round(this.y - 2 - this.liftPx));
    this.aura.setDepth(this.depth - 0.5);
    const now = this.scene.time.now;
    if (now < this.moteAt) return;
    this.moteAt = now + 90;
    const a = Math.random() * Math.PI * 2;
    const mote = this.scene.add
      .image(this.x + Math.cos(a) * 7, this.y + 6 - this.liftPx + Math.sin(a) * 3, 'pixel')
      .setTint(this.transformation.auraColor)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(this.depth + (Math.sin(a) > 0 ? 1 : -1));
    this.scene.tweens.add({
      targets: mote,
      y: mote.y - 14 - Math.random() * 6,
      alpha: 0,
      duration: 650,
      onComplete: () => mote.destroy(),
    });
  }

  private tickKi(time: number, delta: number): void {
    if (this.transformation && this.combat.phase !== 'focus') {
      const r = tickTransformation(this.ki, this.transformation.kiDrainPerSec, delta);
      this.ki = r.ki;
      if (!r.active) this.revert();
      return;
    }
    if (this.combat.phase === 'focus') {
      this.focusMs += delta;
      this.ki += (focusRegenRate(this.focusMs, BALANCE.ki) * delta) / 1000;
      return;
    }
    this.focusMs = 0;
    // Ki only recovers on the ground, so flight isn't a free way to snipe from above.
    if (this.flying || this.combat.phase === 'block' || time < this.kiRegenAt) return;
    const regen = BALANCE.kiRegenPerSec * this.character.traits.kiRegenMult * this.equipKiRegenMult;
    this.ki += (regen * delta) / 1000;
  }

  private move(time: number): void {
    if (time < this.knock.until) {
      const k = (this.knock.until - time) / BALANCE.knockbackMs;
      this.setVelocity(this.knock.vx * k, this.knock.vy * k);
      return;
    }
    const move = this.moveInput();
    switch (this.combat.phase) {
      case 'hurt':
        this.setVelocity(0, 0);
        return;
      case 'focus':
        this.setVelocity(0, 0);
        return;
      case 'block':
        // Guard in place, but keep turning to face whoever comes.
        this.facing = facingFromVector(move.x, move.y, this.facing);
        this.setVelocity(0, 0);
        return;
      case 'swing': {
        const step = this.style.lungeSpeed[this.combat.step] ?? 0;
        const lunge = time < this.combat.activeUntil ? step : 0;
        this.setVelocity(Math.cos(this.actionAngle) * lunge, Math.sin(this.actionAngle) * lunge);
        this.animateLocomotion(0, 0);
        return;
      }
      case 'charge':
      case 'cast':
        this.rootInPlace(move);
        return;
      default:
        if (time < this.rootedUntil) {
          this.rootInPlace(move);
          return;
        }
        this.facing = facingFromVector(move.x, move.y, this.facing);
        this.setVelocity(move.x * this.speed, move.y * this.speed);
        this.animateLocomotion(move.x, move.y);
    }
  }

  /**
   * Specials root the caster (user feedback): no moving while charging or casting, but the
   * direction keys still turn them, which also aims the shot.
   */
  private rootInPlace(move: { x: number; y: number }): void {
    this.facing = facingFromVector(move.x, move.y, this.facing);
    this.setVelocity(0, 0);
    this.animateLocomotion(0, 0);
  }

  /** Applies an enemy hit. Returns the damage actually taken (0 when invulnerable). */
  receiveHit(
    raw: number,
    fromX: number,
    fromY: number,
    knockback: number,
  ): { damage: number; blocked: boolean } {
    const now = this.scene.time.now;
    if (now < this.invulnerableUntil || this.combat.phase === 'downed')
      return { damage: 0, blocked: false };
    const phase = this.combat.phase;
    const stance = phase === 'block' ? 'block' : phase === 'focus' ? 'focus' : 'none';
    const traits = this.character.traits;
    const hit = incomingDamage(raw, this.derived.defense, stance, this.ki, traits.guardMult);
    // Armored fighters take the damage mid-swing but keep swinging.
    const armored = traits.armoredSwings && this.combat.phase === 'swing' && !hit.blocked;
    this.ki -= hit.kiSpent;
    this.hp -= hit.damage;
    const angle = Math.atan2(this.footY - fromY, this.footX - fromX);
    const force =
      (hit.blocked ? knockback * 0.35 : armored ? 0 : knockback) *
      Math.max(0.3, this.style.stagger);
    this.knock = {
      vx: Math.cos(angle) * force,
      vy: Math.sin(angle) * force,
      until: now + BALANCE.knockbackMs,
    };
    if (armored) {
      this.invulnerableUntil = now + BALANCE.playerIframesMs / 2;
    } else if (!hit.blocked) {
      this.invulnerableUntil = now + BALANCE.playerIframesMs;
      this.combat = hurtCombat(this.combat, now, BALANCE.playerHurtStunMs * this.style.stagger);
      this.holdPose('hurt', BALANCE.playerHurtStunMs);
      this.blinkInvulnerable();
    }
    // Blocked: a white glint. Hurt: the same red flash enemies get.
    if (hit.blocked || armored) flashWhite(this);
    else flashTint(this, 0xff3a3a);
    if (this.hp <= 0) this.down();
    return { damage: hit.damage, blocked: hit.blocked };
  }

  private blinkInvulnerable(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0.35,
      yoyo: true,
      repeat: Math.floor(BALANCE.playerIframesMs / 100) - 1,
      duration: 50,
      onComplete: () => this.setAlpha(1),
    });
  }

  private down(): void {
    this.revert();
    this.setFlying(false, false);
    this.combat = downCombat(this.combat);
    this.setVelocity(0, 0);
    this.holdPose('hurt', 60_000);
    this.host.onPlayerDowned();
  }

  /** Full restore (level up, berry, save circle). */
  restoreAll(): void {
    this.hp = this.derived.maxHp;
    this.ki = this.derived.maxKi;
  }

  /** The ki ball in the hands while charging; a pulsing body glow and motes while focusing. */
  private updateChargeGlow(time: number): void {
    const charging = this.combat.phase === 'charge';
    const focusing = this.combat.phase === 'focus';
    if (!charging && !focusing) {
      this.chargeGlow?.destroy();
      this.chargeGlow = null;
      return;
    }
    if (!this.chargeGlow) {
      this.chargeGlow = this.scene.add
        .image(this.x, this.y, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD);
    }
    if (focusing) {
      this.chargeGlow
        .setTint(this.character.color)
        .setPosition(this.x, this.y - this.liftPx)
        .setScale(0.85 + 0.15 * Math.sin(time / 90), 1.1 + 0.15 * Math.sin(time / 90))
        .setAlpha(0.5)
        .setDepth(this.depth - 0.5);
    } else {
      const c = this.charge;
      const f = facingVector(this.facing);
      const pulse = c >= 1 ? 0.12 * Math.sin(time / 40) : 0;
      this.chargeGlow
        .setTint(this.technique.color)
        .setPosition(this.x + f.x * 7, this.y - 2 - this.liftPx + f.y * 4)
        .setScale(0.25 + 0.6 * c + pulse)
        .setAlpha(0.55 + 0.4 * c)
        .setDepth(this.depth + (f.y < 0 ? -1 : 1));
      if (c >= 1 && !this.chargeFull) {
        this.chargeFull = true;
        audio.play('kiFull');
        flashWhite(this);
      }
    }
    if (this.combat.phase !== 'focus' || time < this.focusPulseAt) return;
    this.focusPulseAt = time + 70;
    audio.play('kiFocus');
    const a = Math.random() * Math.PI * 2;
    const mote = this.scene.add
      .image(this.x + Math.cos(a) * 9, this.y + 8 - this.liftPx + Math.sin(a) * 3, 'pixel')
      .setScale(1.5)
      .setTint(this.character.color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(this.depth + (Math.sin(a) > 0 ? 1 : -1));
    this.scene.tweens.add({
      targets: mote,
      y: mote.y - 20 - Math.random() * 8,
      alpha: 0,
      duration: 500,
      onComplete: () => mote.destroy(),
    });
  }

  override destroy(fromScene?: boolean): void {
    this.aura?.destroy();
    this.chargeGlow?.destroy();
    super.destroy(fromScene);
  }
}

function ensureCharacterSheets(scene: Phaser.Scene, character: CharacterDef): void {
  ensureActorSheet(scene, characterSheetKey(character.id), character.look);
  for (const tr of character.transformations) {
    ensureActorSheet(scene, characterSheetKey(character.id, tr.id), tr.look);
  }
}
