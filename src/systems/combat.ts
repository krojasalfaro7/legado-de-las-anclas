import { BALANCE } from '../config/balance';

function scaled(base: number, stat: number, mult: number, targetDef: number): number {
  const raw = base * (1 + stat / BALANCE.statScale) * mult - targetDef;
  return Math.max(1, Math.round(raw));
}

/** Player melee hit: base × hit multiplier (combo step × style power) scaled by STR. */
export function meleeDamage(
  str: number,
  hitMult: number,
  transformMult: number,
  targetDef: number,
): number {
  return scaled(BALANCE.melee.baseDamage * hitMult, str, transformMult, targetDef);
}

/** Player ki hit: technique power scaled by POW. */
export function kiDamage(
  power: number,
  pow: number,
  transformMult: number,
  targetDef: number,
): number {
  return scaled(power, pow, transformMult, targetDef);
}

export interface IncomingHit {
  damage: number;
  kiSpent: number;
  blocked: boolean;
}

/** `focus` is guard + ki held (gathering ki): a half guard that costs nothing. */
export type GuardStance = 'none' | 'block' | 'focus';

/**
 * Damage the player takes from a raw enemy attack. Blocking reduces damage and
 * costs ki per hit; without enough ki the guard breaks and the hit lands fully.
 * Focusing keeps a weaker guard for free (user feedback: it looked like a guard but let
 * every hit through in full).
 */
export function incomingDamage(
  raw: number,
  defense: number,
  stance: GuardStance,
  ki: number,
  /** Character trait: how much of the guarded damage still gets through (1 = baseline). */
  guardMult = 1,
): IncomingHit {
  const base = Math.max(1, Math.round(raw - defense));
  if (stance === 'none') return { damage: base, kiSpent: 0, blocked: false };
  if (stance === 'focus') {
    const damage = Math.max(1, Math.round(base * BALANCE.block.focusDamageMult * guardMult));
    return { damage, kiSpent: 0, blocked: true };
  }
  if (ki < BALANCE.block.kiPerHit) return { damage: base, kiSpent: ki, blocked: false };
  return {
    damage: Math.max(1, Math.round(base * BALANCE.block.damageMult * guardMult)),
    kiSpent: BALANCE.block.kiPerHit,
    blocked: true,
  };
}

/** Damage an enemy deals to another target before defense. */
export function enemyRawDamage(atk: number, patternMult: number): number {
  return atk * patternMult;
}

/** Safety cap for blasts that fly until they leave the screen. */
export const OFFSCREEN_SHOT_MAX_MS = 4000;

/**
 * How long a ki technique's shot lives: blasts cross the whole screen (they vanish once off
 * camera), ranged moves fade after `range` pixels.
 */
export function shotReach(tech: { speed: number; range?: number }): {
  lifetimeMs: number;
  untilOffscreen: boolean;
} {
  if (tech.range === undefined) return { lifetimeMs: OFFSCREEN_SHOT_MAX_MS, untilOffscreen: true };
  return { lifetimeMs: (tech.range / tech.speed) * 1000, untilOffscreen: false };
}

export interface ChargeTuning {
  chargeDamageExtra: number;
  chargeCostExtra: number;
  chargeKnockbackExtra: number;
}

export interface ChargedShot {
  /** Charge actually used: lowered when there isn't ki for the full cost. */
  charge: number;
  kiCost: number;
  powerMult: number;
  knockbackMult: number;
  /** Full charge always pierces. */
  pierce: boolean;
}

/** What a technique's shot becomes at `charge` (0..1) with `ki` available. */
export function chargedShot(
  tech: { kiCost: number; pierce: boolean },
  charge: number,
  ki: number,
  k: ChargeTuning,
): ChargedShot {
  const affordable = tech.kiCost > 0 ? (ki / tech.kiCost - 1) / k.chargeCostExtra : 1;
  const c = Math.max(0, Math.min(charge, affordable, 1));
  return {
    charge: c,
    kiCost: Math.round(tech.kiCost * (1 + k.chargeCostExtra * c)),
    powerMult: 1 + k.chargeDamageExtra * c,
    knockbackMult: 1 + k.chargeKnockbackExtra * c,
    pierce: tech.pierce || c >= 1,
  };
}

/** Ki per second gathered after focusing for `heldMs`: ramps from a trickle to full flow. */
export function focusRegenRate(
  heldMs: number,
  k: { focusRegenStartPerSec: number; focusRegenPerSec: number; focusRampMs: number },
): number {
  const t = Math.min(1, Math.max(0, heldMs / k.focusRampMs));
  return k.focusRegenStartPerSec + (k.focusRegenPerSec - k.focusRegenStartPerSec) * t;
}
