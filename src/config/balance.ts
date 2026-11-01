/**
 * Tunable numbers. Formulas live in src/systems/ and read from here.
 *
 * Damage:  dmg = base × (1 + STAT / statScale) × transformMult − targetDef   (min 1)
 * Max HP:  baseHp + END × hpPerEnd
 * Max Ki:  baseKi + POW × kiPerPow
 * Defense: END × defPerEnd + equipment bonus
 * Speed:   × (1 + (SPD − 1) × speedPerSpd); melee recovery × (1 − (SPD − 1) × recoveryPerSpd)
 * EXP to next level: round(exp.base × exp.growth^(level − 1))   (gentle exponential)
 */
export const BALANCE = {
  maxLevel: 200,
  // Reference FAQ: 3 points per level for 3 stats; SPD made it 4 stats, so 4 points.
  statPointsPerLevel: 4,
  /** Lower = each stat point matters more. 10 keeps early levels noticeable. */
  statScale: 10,

  baseHp: 90,
  hpPerEnd: 10,
  baseKi: 50,
  kiPerPow: 4,
  defPerEnd: 0.6,
  /** SPD: move speed per point (capped), and a shorter melee recovery per point (floored). */
  speedPerSpd: 0.01,
  maxSpdSpeedMult: 1.6,
  recoveryPerSpd: 0.005,
  minRecoveryMult: 0.7,

  flight: {
    speedMult: 1.6,
    /** Pixels the sprite rises above its shadow. */
    altitude: 10,
    liftMs: 180,
  },

  kiRegenPerSec: 4,
  /** Regen pauses this long after spending ki. */
  kiRegenDelayMs: 900,

  /**
   * Melee: a fast 4-hit chain whose last hit launches. Timings feed systems/playerCombat.ts;
   * all arrays are indexed by combo step and must have the same length.
   */
  melee: {
    baseDamage: 6,
    comboMults: [1, 1, 1.25, 1.9],
    // Footage: plain hits barely move a target (the fighter's step keeps contact); the
    // finisher launches it (~45 px).
    knockback: [30, 30, 40, 360],
    /** Time from press to the active hitbox. */
    startupMs: 40,
    activeMs: 90,
    // Reference footage: about 1/3 s from punch to punch at full mash (40 + 90 + 150 ≈ 280 ms).
    recoveryMs: [150, 150, 170, 280],
    /** After the active window, moving cancels the recovery from this point. */
    moveCancelMs: [40, 40, 60, 150],
    /** A press this long after the active window still chains the next step. */
    comboWindowMs: 260,
    /** Hitbox: from the body out to where the fist lands (px), and across the swing. Short, so
     * a blow only connects when the fist visibly touches the target. */
    reach: 15,
    width: 18,
    /** Step forward from startup to the end of the active window, per combo step: each blow
     * walks in about as far as the last one pushed the target, so the string stays in contact. */
    lungeSpeed: [40, 40, 45, 50],
    poses: ['attack', 'attack2', 'attack', 'attack3'],
    power: 1,
    stagger: 1,
    /** Soft lock: a swing turns toward an enemy already within touching distance. */
    assistConeDeg: 45,
    assistRange: 24,
  },

  ki: {
    castMs: 120,
    /** Height above the feet where shots are drawn (chest). */
    shotLift: 12,
    /** Hold the ki button to charge: shorter than tapMs is a plain shot, fullMs is max. */
    chargeTapMs: 180,
    chargeFullMs: 900,
    /** At full charge: damage × (1 + damageExtra), ki cost × (1 + costExtra); it pierces. */
    chargeDamageExtra: 1.5,
    chargeCostExtra: 1,
    chargeKnockbackExtra: 1,
    /** Guard + ki held: standing still gathering ki ("focus"). It starts as a trickle and
     * builds to full flow over focusRampMs, so a full bar takes a few committed seconds. */
    focusRegenStartPerSec: 8,
    focusRegenPerSec: 24,
    focusRampMs: 1500,
  },

  /** Double-tap a direction to run (see systems/run.ts). */
  run: {
    doubleTapMs: 260,
    speedMult: 1.55,
    burstMs: 150,
    burstMult: 2.3,
  },

  /** Presses this early are kept and run as soon as the player can act. */
  inputBufferMs: 180,

  block: {
    damageMult: 0.25,
    kiPerHit: 5,
    /** Gathering ki (guard + ki) still guards, at half strength and no ki cost. */
    focusDamageMult: 0.5,
  },

  // Short: an enemy string lands every blow (~375 ms apart in the reference duel).
  playerIframesMs: 320,
  playerHurtStunMs: 220,
  enemyHurtStunMs: 260,
  /** The launched target stays down this long. */
  enemyLaunchStunMs: 480,
  /** Hit-stop (both fighters freeze): ~4 frames per hit in the footage, longer on finishers. */
  hitStopMs: 60,
  finisherHitStopMs: 100,
  /** Knockback speed decays to 0 over this time (a finisher's launch slides 1.5x longer). */
  knockbackMs: 180,

  exp: {
    base: 20,
    growth: 1.18,
  },
} as const;
