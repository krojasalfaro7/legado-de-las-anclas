import { describe, expect, it } from 'vitest';
import { angleGap, baseAim, pickTarget } from '../src/systems/aim';
import {
  type CombatInput,
  type CombatState,
  type CombatTiming,
  chargeLevel,
  hurtCombat,
  initialCombat,
  isSwingActive,
  stepCombat,
} from '../src/systems/playerCombat';

const T: CombatTiming = {
  startupMs: 40,
  activeMs: 90,
  recoveryMs: [110, 110, 130, 260],
  moveCancelMs: [40, 40, 60, 150],
  comboWindowMs: 260,
  castMs: 120,
  bufferMs: 180,
  chargeTapMs: 180,
  chargeFullMs: 900,
};

const base: CombatInput = {
  now: 0,
  attackPressed: false,
  kiPressed: false,
  blockHeld: false,
  moving: false,
  kiHeld: false,
  kiReady: true,
};

/** Runs frames every 16 ms from `from` to `to`; `press` maps a time to extra input. */
function run(
  state: CombatState,
  from: number,
  to: number,
  press: (now: number) => Partial<CombatInput> = () => ({}),
) {
  let s = state;
  const events: Array<{ at: number; type: string; step?: number }> = [];
  for (let now = from; now <= to; now += 16) {
    const r = stepCombat(s, { ...base, now, ...press(now) }, T);
    s = r.state;
    for (const e of r.events) events.push({ at: now, ...e });
  }
  return { state: s, events };
}

describe('player combat state machine', () => {
  it('mashing chains the 4-hit combo, then starts over', () => {
    const { events } = run(initialCombat(), 0, 1600, (now) => ({ attackPressed: now % 96 === 0 }));
    const steps = events.filter((e) => e.type === 'swing').map((e) => e.step);
    expect(steps.slice(0, 5)).toEqual([0, 1, 2, 3, 0]);
  });

  it('a press during startup is buffered and chains right after the active window', () => {
    const { events } = run(initialCombat(), 0, 400, (now) => ({
      attackPressed: now === 0 || now === 32,
    }));
    const swings = events.filter((e) => e.type === 'swing');
    expect(swings.map((e) => e.step)).toEqual([0, 1]);
    // Active window ends at 130; the chained swing starts on the first frame after it.
    expect(swings[1]?.at).toBe(144);
  });

  it('moving cancels the recovery, so turning after a hit is immediate', () => {
    const swing = stepCombat(initialCombat(), { ...base, attackPressed: true }, T).state;
    expect(swing.phase).toBe('swing');
    const committed = stepCombat(swing, { ...base, now: 120, moving: true }, T).state;
    expect(committed.phase).toBe('swing');
    const freed = stepCombat(swing, { ...base, now: 130 + 40, moving: true }, T).state;
    expect(freed.phase).toBe('free');
  });

  it('never stays stuck: with no input every phase returns to free', () => {
    let s = stepCombat(initialCombat(), { ...base, attackPressed: true }, T).state;
    s = run(s, 16, 600).state;
    expect(s.phase).toBe('free');
    s = stepCombat(s, { ...base, now: 700, kiPressed: true, kiHeld: true }, T).state;
    expect(s.phase).toBe('charge');
    // Releasing the button fires; the cast then ends on its own.
    s = stepCombat(s, { ...base, now: 716 }, T).state;
    expect(s.phase).toBe('cast');
    s = run(s, 732, 900).state;
    expect(s.phase).toBe('free');
    s = hurtCombat(s, 1000, 220);
    s = run(s, 1000, 1300).state;
    expect(s.phase).toBe('free');
  });

  it('turning while attacking (and attacking while turning) keeps chaining', () => {
    const { events, state } = run(initialCombat(), 0, 800, (now) => ({
      attackPressed: now % 112 === 0,
      moving: now % 64 < 32,
    }));
    expect(events.filter((e) => e.type === 'swing').length).toBeGreaterThanOrEqual(5);
    expect(run(state, 816, 1400).state.phase).toBe('free');
  });

  it('ki during the recovery cancels it; ki without ki is denied and not retried', () => {
    const swing = run(initialCombat(), 0, 140, (now) => ({ attackPressed: now === 0 })).state;
    const cast = stepCombat(swing, { ...base, now: 144, kiPressed: true, kiHeld: true }, T);
    expect(cast.events).toEqual([{ type: 'chargeStart' }]);
    const denied = stepCombat(initialCombat(), { ...base, kiPressed: true, kiReady: false }, T);
    expect(denied.events).toEqual([{ type: 'kiDenied' }]);
    expect(stepCombat(denied.state, { ...base, now: 16, kiReady: true }, T).events).toEqual([]);
  });

  it('guard: held block guards, attack from guard swings, releasing frees', () => {
    let s = stepCombat(initialCombat(), { ...base, blockHeld: true }, T).state;
    expect(s.phase).toBe('block');
    const r = stepCombat(s, { ...base, now: 16, blockHeld: true, attackPressed: true }, T);
    expect(r.events).toEqual([{ type: 'swing', step: 0 }]);
    s = stepCombat(s, { ...base, now: 32 }, T).state;
    expect(s.phase).toBe('free');
  });

  it('a tap fires an uncharged shot, holding charges up to full', () => {
    const start = stepCombat(initialCombat(), { ...base, kiPressed: true, kiHeld: true }, T);
    expect(start.events).toEqual([{ type: 'chargeStart' }]);
    const tap = stepCombat(start.state, { ...base, now: 100 }, T);
    expect(tap.events).toEqual([{ type: 'cast', charge: 0 }]);
    const held = run(start.state, 16, 2000, () => ({ kiHeld: true }));
    expect(held.state.phase).toBe('charge');
    expect(stepCombat(held.state, { ...base, now: 2016 }, T).events).toEqual([
      { type: 'cast', charge: 1 },
    ]);
    expect(chargeLevel(T.chargeTapMs + (T.chargeFullMs - T.chargeTapMs) / 2, T)).toBeCloseTo(0.5);
  });

  it('guard + ki held is focus; letting go of either ends it', () => {
    let s = stepCombat(initialCombat(), { ...base, blockHeld: true }, T).state;
    s = stepCombat(
      s,
      { ...base, now: 16, blockHeld: true, kiPressed: true, kiHeld: true },
      T,
    ).state;
    expect(s.phase).toBe('focus');
    s = run(s, 32, 600, () => ({ blockHeld: true, kiHeld: true })).state;
    expect(s.phase).toBe('focus');
    expect(stepCombat(s, { ...base, now: 616, blockHeld: true }, T).state.phase).toBe('block');
    // Charging then pressing guard switches to focus without firing.
    const charging = stepCombat(initialCombat(), { ...base, kiPressed: true, kiHeld: true }, T);
    const f = stepCombat(charging.state, { ...base, now: 16, kiHeld: true, blockHeld: true }, T);
    expect(f.state.phase).toBe('focus');
    expect(f.events).toEqual([]);
  });

  it('a stale buffered press expires', () => {
    const swing = stepCombat(initialCombat(), { ...base, attackPressed: true }, T).state;
    const late = run(swing, 16, 600, (now) => ({ attackPressed: now === 16 }));
    expect(late.events.filter((e) => e.type === 'swing')).toHaveLength(1);
    expect(isSwingActive(swing, 50)).toBe(true);
  });
});

describe('aim assist', () => {
  const opts = { coneDeg: 22, range: 170 };

  it('uses the held direction (8-way) or else the facing', () => {
    expect(baseAim({ x: 0.7, y: 0.7 }, { x: 1, y: 0 })).toBeCloseTo(Math.PI / 4);
    expect(baseAim({ x: 0, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(-Math.PI / 2);
  });

  it('ignores enemies outside the cone or the range', () => {
    expect(pickTarget({ x: 0, y: 0 }, 0, [{ x: 10, y: 60 }], opts)).toBeNull();
    expect(pickTarget({ x: 0, y: 0 }, 0, [{ x: 400, y: 0 }], opts)).toBeNull();
  });

  it('prefers the best-aligned target, then the closest', () => {
    const near = { x: 50, y: 15 };
    const aligned = { x: 120, y: 0 };
    expect(pickTarget({ x: 0, y: 0 }, 0, [near, aligned], opts)).toBe(aligned);
    expect(angleGap(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
  });
});
