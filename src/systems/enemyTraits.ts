/**
 * Enemy defensive traits (pure): some enemies guard from the front, some sidestep ki blasts,
 * some drink ki. Each one asks the player to fight differently (flank, punch, charge).
 */
export interface EnemyTraits {
  /** Blocks hits that come from the front while it isn't attacking. */
  guard?: boolean;
  /** Chance (0..1) to sidestep a ki blast heading at it. */
  dodgeChance?: number;
  /** Ki blasts heal it instead of hurting: punch it. */
  absorbKi?: boolean;
  /** Hovers out of reach of punches; a ki hit knocks it down, and it lands to strike. */
  flying?: boolean;
}

export interface IncomingAttack {
  /** `thrown`: rocks and the like; they hurt like blasts but carry no ki to absorb. */
  source: 'melee' | 'ki' | 'thrown';
  /** Combo finisher (melee). */
  finisher: boolean;
  /** Piercing or fully charged blast (ki). */
  pierce: boolean;
  /** Presentation only: big blasts launch the target like a finisher, in the blast's color. */
  launch?: boolean;
  color?: number;
}

export type HitOutcome = 'hit' | 'guarded' | 'guardBroken' | 'absorbed' | 'outOfReach' | 'downed';

export interface HitResolution {
  outcome: HitOutcome;
  /** Multiplies the damage; negative heals. */
  damageMult: number;
  /** Whether the hit stuns and pushes. */
  staggers: boolean;
}

/** Fraction of the damage that gets through a guard. */
export const GUARD_DAMAGE_MULT = 0.15;
/** How long a broken guard stays down. */
export const GUARD_BREAK_MS = 1600;
/** Share of an absorbed blast's damage the enemy heals. */
export const ABSORB_HEAL_MULT = 0.5;
/** How high a flyer hovers; below `FLYER_REACH_PX` punches reach it. */
export const FLYER_ALTITUDE = 12;
export const FLYER_REACH_PX = 4;
/** How long a flyer shot down stays on the ground. */
export const FLYER_DOWNED_MS = 1500;
/** Hits within this angle of where the enemy faces count as frontal. */
export const GUARD_ARC_DEG = 70;

export function resolveEnemyHit(
  traits: EnemyTraits | undefined,
  attack: IncomingAttack,
  ctx: { fromFront: boolean; attacking: boolean; guardBroken: boolean; airborne?: boolean },
): HitResolution {
  if (traits?.flying && ctx.airborne) {
    if (attack.source === 'melee') return { outcome: 'outOfReach', damageMult: 0, staggers: false };
    return { outcome: 'downed', damageMult: 1, staggers: true };
  }
  if (traits?.absorbKi && attack.source === 'ki') {
    return { outcome: 'absorbed', damageMult: -ABSORB_HEAL_MULT, staggers: false };
  }
  if (traits?.guard && ctx.fromFront && !ctx.attacking && !ctx.guardBroken) {
    const heavy = attack.source === 'melee' ? attack.finisher : attack.pierce;
    if (heavy) return { outcome: 'guardBroken', damageMult: 1, staggers: true };
    return { outcome: 'guarded', damageMult: GUARD_DAMAGE_MULT, staggers: false };
  }
  return { outcome: 'hit', damageMult: 1, staggers: true };
}

/** True when `from` lies within the guard arc around the facing direction. */
export function isFrontal(
  facing: { x: number; y: number },
  self: { x: number; y: number },
  from: { x: number; y: number },
): boolean {
  const dx = from.x - self.x;
  const dy = from.y - self.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return true;
  const cos = (dx * facing.x + dy * facing.y) / len;
  return cos >= Math.cos((GUARD_ARC_DEG * Math.PI) / 180);
}

/** A shot is a threat when it is close and moving toward the enemy. */
export function shotThreatens(
  shot: { x: number; y: number; vx: number; vy: number },
  self: { x: number; y: number },
  radius: number,
): boolean {
  const dx = self.x - shot.x;
  const dy = self.y - shot.y;
  if (Math.hypot(dx, dy) > radius) return false;
  return dx * shot.vx + dy * shot.vy > 0;
}
