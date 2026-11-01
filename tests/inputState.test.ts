import { describe, expect, it } from 'vitest';
import { type Action, DEFAULT_BINDINGS, PAD } from '../src/config/controls';
import {
  ActionState,
  applyDeadzone,
  normalizeDigital,
  resolveActions,
} from '../src/systems/inputState';

const set = (...a: Action[]) => new Set<Action>(a);

describe('resolveActions', () => {
  it('maps keyboard codes and gamepad buttons to actions', () => {
    const out = resolveActions(new Set(['KeyD', 'ArrowUp']), new Set([PAD.RB]), DEFAULT_BINDINGS);
    expect(out.has('attack')).toBe(true);
    expect(out.has('up')).toBe(true);
    expect(out.has('block')).toBe(true);
    expect(out.has('ki')).toBe(false);
  });
});

describe('ActionState', () => {
  it('reports justPressed only on the first frame', () => {
    const s = new ActionState();
    s.update(set('attack'), 0);
    expect(s.justPressed('attack')).toBe(true);
    s.update(set('attack'), 16);
    expect(s.justPressed('attack')).toBe(false);
    expect(s.isDown('attack')).toBe(true);
  });

  it('consumeAll hides held actions until released', () => {
    const s = new ActionState();
    s.update(set('confirm'), 0);
    s.consumeAll();
    expect(s.justPressed('confirm')).toBe(false);
    s.update(set('confirm'), 16);
    expect(s.isDown('confirm')).toBe(false);
    s.update(set(), 32);
    s.update(set('confirm'), 48);
    expect(s.justPressed('confirm')).toBe(true);
  });

  it('auto-repeats after the delay', () => {
    const s = new ActionState();
    s.update(set('down'), 0);
    expect(s.repeatPressed('down', 0, 300, 100)).toBe(true);
    s.update(set('down'), 200);
    expect(s.repeatPressed('down', 200, 300, 100)).toBe(false);
    s.update(set('down'), 310);
    expect(s.repeatPressed('down', 310, 300, 100)).toBe(true);
    s.update(set('down'), 350);
    expect(s.repeatPressed('down', 350, 300, 100)).toBe(false);
    s.update(set('down'), 420);
    expect(s.repeatPressed('down', 420, 300, 100)).toBe(true);
  });
});

describe('vectors', () => {
  it('normalizes diagonals', () => {
    const v = normalizeDigital(1, 1);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
  });

  it('applies the stick deadzone', () => {
    expect(applyDeadzone(0.1, 0.1, 0.3)).toEqual({ x: 0, y: 0 });
    const v = applyDeadzone(1, 0, 0.3);
    expect(v.x).toBeCloseTo(1);
  });
});
