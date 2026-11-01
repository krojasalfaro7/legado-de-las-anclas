import type { Action, Bindings } from '../config/controls';

/** Maps raw device state to the set of actions currently held. */
export function resolveActions(
  keys: ReadonlySet<string>,
  buttons: ReadonlySet<number>,
  bindings: Bindings,
): Set<Action> {
  const out = new Set<Action>();
  for (const action of Object.keys(bindings.keyboard) as Action[]) {
    if (bindings.keyboard[action].some((k) => keys.has(k))) out.add(action);
    if (bindings.gamepad[action].some((b) => buttons.has(b))) out.add(action);
  }
  return out;
}

/**
 * Per-frame edge detection over action sets. `consumeAll` hides currently held
 * actions until they are released, so the key that closes a menu doesn't also
 * fire in the scene underneath.
 */
export class ActionState {
  private held = new Set<Action>();
  private pressed = new Set<Action>();
  private consumed = new Set<Action>();
  private heldSince = new Map<Action, number>();
  private lastRepeat = new Map<Action, number>();

  update(current: ReadonlySet<Action>, nowMs: number): void {
    this.pressed.clear();
    for (const a of current) {
      if (!this.held.has(a)) {
        this.pressed.add(a);
        this.heldSince.set(a, nowMs);
        this.lastRepeat.delete(a);
      }
    }
    for (const a of this.consumed) if (!current.has(a)) this.consumed.delete(a);
    this.held = new Set(current);
  }

  isDown(a: Action): boolean {
    return this.held.has(a) && !this.consumed.has(a);
  }

  justPressed(a: Action): boolean {
    return this.pressed.has(a) && !this.consumed.has(a);
  }

  /** True on the initial press and then periodically while held (menus). */
  repeatPressed(a: Action, nowMs: number, delayMs: number, intervalMs: number): boolean {
    if (this.justPressed(a)) return true;
    if (!this.isDown(a)) return false;
    const since = this.heldSince.get(a) ?? nowMs;
    if (nowMs - since < delayMs) return false;
    const last = this.lastRepeat.get(a) ?? since + delayMs - intervalMs;
    if (nowMs - last >= intervalMs) {
      this.lastRepeat.set(a, nowMs);
      return true;
    }
    return false;
  }

  consumeAll(): void {
    for (const a of this.held) this.consumed.add(a);
    this.pressed.clear();
  }
}

export interface Vec2 {
  x: number;
  y: number;
}

/** Normalizes an 8-direction digital vector so diagonals aren't faster. */
export function normalizeDigital(x: number, y: number): Vec2 {
  const len = Math.hypot(x, y);
  return len === 0 ? { x: 0, y: 0 } : { x: x / len, y: y / len };
}

/** Applies a radial deadzone and clamps the stick vector to length 1. */
export function applyDeadzone(x: number, y: number, deadzone: number): Vec2 {
  const len = Math.hypot(x, y);
  if (len < deadzone) return { x: 0, y: 0 };
  const scaled = Math.min(1, (len - deadzone) / (1 - deadzone));
  return { x: (x / len) * scaled, y: (y / len) * scaled };
}
