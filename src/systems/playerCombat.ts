/**
 * Player combat state machine (pure, no Phaser). One `stepCombat` call per frame decides the
 * phase from timers and input; the Player entity turns the returned events into hitboxes,
 * shots and poses. Rules that keep it fluid:
 *
 * - Presses are buffered for `bufferMs`, so a button pressed slightly early is never lost.
 * - A swing is committed only through startup + active. During recovery, movement, guard or
 *   ki cancel it, and another attack press chains the next step of the combo.
 * - Mashing after the recovery ended still continues the combo inside `comboWindowMs`.
 * - Ki is held to charge: a tap fires right away, holding grows the blast until release.
 * - Guard + ki held together is "focus": the character stands still gathering ki.
 * - Nothing here waits on an event that might not come: every phase ends on a timer or on a
 *   button that is no longer held.
 */
export type CombatPhase =
  | 'free'
  | 'swing'
  | 'charge'
  | 'cast'
  | 'block'
  | 'focus'
  | 'hurt'
  | 'downed';
export type BufferedAction = 'attack' | 'ki';

export interface CombatTiming {
  startupMs: number;
  activeMs: number;
  /** One entry per combo step; its length is the combo length. */
  recoveryMs: readonly number[];
  /** Time after the active window from which movement cancels the recovery, per step. */
  moveCancelMs: readonly number[];
  comboWindowMs: number;
  castMs: number;
  bufferMs: number;
  /** Holding ki shorter than this is a tap (an uncharged shot). */
  chargeTapMs: number;
  /** Holding this long reaches full charge. */
  chargeFullMs: number;
}

export interface CombatState {
  phase: CombatPhase;
  /** Combo step of the current or last swing. */
  step: number;
  activeFrom: number;
  activeUntil: number;
  /** End of the current swing recovery, cast or hurt stun. */
  until: number;
  /** When the current charge started. */
  chargeFrom: number;
  buffer: { action: BufferedAction; at: number } | null;
}

export interface CombatInput {
  now: number;
  attackPressed: boolean;
  kiPressed: boolean;
  /** The ki button is still down (charging, focusing). */
  kiHeld: boolean;
  blockHeld: boolean;
  moving: boolean;
  /** Ki cooldown elapsed and enough ki for the selected technique. */
  kiReady: boolean;
}

export type CombatEvent =
  | { type: 'swing'; step: number }
  | { type: 'chargeStart' }
  /** `charge` goes from 0 (tap) to 1 (full). */
  | { type: 'cast'; charge: number }
  | { type: 'kiDenied' };

export interface CombatStep {
  state: CombatState;
  events: CombatEvent[];
}

export function initialCombat(): CombatState {
  return {
    phase: 'free',
    step: -1,
    activeFrom: 0,
    activeUntil: 0,
    until: 0,
    chargeFrom: 0,
    buffer: null,
  };
}

export function isSwingActive(s: CombatState, now: number): boolean {
  return s.phase === 'swing' && now >= s.activeFrom && now < s.activeUntil;
}

/** Stun after taking an unblocked hit. Keeps the buffer so the player can mash out of it. */
export function hurtCombat(s: CombatState, now: number, stunMs: number): CombatState {
  if (s.phase === 'downed') return s;
  return { ...s, phase: 'hurt', until: now + stunMs, step: -1 };
}

/** Charge fraction after holding ki for `heldMs`: 0 for a tap, 1 at full charge. */
export function chargeLevel(heldMs: number, t: CombatTiming): number {
  const span = t.chargeFullMs - t.chargeTapMs;
  return Math.max(0, Math.min(1, (heldMs - t.chargeTapMs) / span));
}

export function downCombat(s: CombatState): CombatState {
  return { ...s, phase: 'downed', buffer: null, step: -1 };
}

function startSwing(s: CombatState, step: number, now: number, t: CombatTiming): CombatStep {
  const activeFrom = now + t.startupMs;
  const activeUntil = activeFrom + t.activeMs;
  return {
    state: {
      ...s,
      phase: 'swing',
      step,
      activeFrom,
      activeUntil,
      until: activeUntil + (t.recoveryMs[step] ?? 0),
      buffer: null,
    },
    events: [{ type: 'swing', step }],
  };
}

/** Ki press: starts charging (the shot leaves on release). */
function startCharge(s: CombatState, input: CombatInput): CombatStep {
  if (!input.kiReady) return { state: { ...s, buffer: null }, events: [{ type: 'kiDenied' }] };
  return {
    state: { ...s, phase: 'charge', chargeFrom: input.now, buffer: null },
    events: [{ type: 'chargeStart' }],
  };
}

function release(s: CombatState, now: number, t: CombatTiming): CombatStep {
  const charge = chargeLevel(now - s.chargeFrom, t);
  return {
    state: { ...s, phase: 'cast', until: now + t.castMs, buffer: null },
    events: [{ type: 'cast', charge }],
  };
}

/** Next combo step if the last swing is recent enough, otherwise the opener. */
function nextStep(s: CombatState, now: number, t: CombatTiming): number {
  const last = t.recoveryMs.length - 1;
  const chained = s.step >= 0 && s.step < last && now < s.activeUntil + t.comboWindowMs;
  return chained ? s.step + 1 : 0;
}

/** Acting from free or guard: buffered attack, then buffered ki. */
function act(s: CombatState, input: CombatInput, t: CombatTiming): CombatStep | null {
  if (s.buffer?.action === 'attack') return startSwing(s, nextStep(s, input.now, t), input.now, t);
  if (s.buffer?.action === 'ki') return startCharge(s, input);
  return null;
}

export function stepCombat(prev: CombatState, input: CombatInput, t: CombatTiming): CombatStep {
  const { now } = input;
  if (prev.phase === 'downed') return { state: prev, events: [] };

  let s = prev;
  if (input.kiPressed) s = { ...s, buffer: { action: 'ki', at: now } };
  if (input.attackPressed) s = { ...s, buffer: { action: 'attack', at: now } };
  if (s.buffer && now - s.buffer.at > t.bufferMs) s = { ...s, buffer: null };
  const guard = input.blockHeld;
  const focus = input.blockHeld && input.kiHeld;
  const idle = (state: CombatState): CombatStep => ({ state, events: [] });
  const startFocus = (): CombatStep => idle({ ...s, phase: 'focus', buffer: null });

  switch (s.phase) {
    case 'charge':
      if (focus) return startFocus();
      if (input.kiHeld) return idle(s);
      return release(s, now, t);
    case 'focus':
      if (focus) return idle({ ...s, buffer: null });
      s = { ...s, phase: 'free', buffer: null };
      break;
    case 'hurt':
    case 'cast':
      if (now < s.until) return idle(s);
      s = { ...s, phase: 'free' };
      break;
    case 'swing': {
      if (now < s.activeUntil) return idle(s);
      const last = t.recoveryMs.length - 1;
      if (s.buffer?.action === 'attack' && s.step < last) return startSwing(s, s.step + 1, now, t);
      if (s.buffer?.action === 'ki') return startCharge(s, input);
      if (guard) return idle({ ...s, phase: 'block' });
      const cancelAt = s.activeUntil + (t.moveCancelMs[s.step] ?? 0);
      if (now < s.until && !(input.moving && now >= cancelAt)) return idle(s);
      s = { ...s, phase: 'free' };
      break;
    }
    case 'block':
      if (focus) return startFocus();
      if (guard) return act(s, input, t) ?? idle(s);
      s = { ...s, phase: 'free' };
      break;
    case 'free':
      break;
  }

  if (focus) return startFocus();
  if (guard) return idle({ ...s, phase: 'block' });
  return act(s, input, t) ?? idle(s);
}
