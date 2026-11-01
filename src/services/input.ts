import {
  type Action,
  type Bindings,
  DEFAULT_BINDINGS,
  REPEAT_DELAY_MS,
  REPEAT_INTERVAL_MS,
  STICK_DEADZONE,
} from '../config/controls';
import {
  ActionState,
  applyDeadzone,
  normalizeDigital,
  resolveActions,
  type Vec2,
} from '../systems/inputState';

export type Device = 'keyboard' | 'gamepad';

/**
 * Scene-independent input: reads the DOM keyboard and the Gamepad API directly so
 * every scene (world, menus, dialogue) shares one consistent state per frame.
 */
class InputService {
  private keys = new Set<string>();
  private buttons = new Set<number>();
  private stick: Vec2 = { x: 0, y: 0 };
  private state = new ActionState();
  private bindings: Bindings = DEFAULT_BINDINGS;
  private captured = new Set<string>();
  private now = 0;
  lastDevice: Device = 'keyboard';

  attach(target: Window): void {
    this.captured = new Set(Object.values(this.bindings.keyboard).flat());
    target.addEventListener('keydown', (e) => {
      if (this.captured.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
      this.lastDevice = 'keyboard';
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => this.keys.clear());
  }

  setBindings(bindings: Bindings): void {
    this.bindings = bindings;
    this.captured = new Set(Object.values(bindings.keyboard).flat());
  }

  /** Call once per game step, before scenes update. */
  update(nowMs: number): void {
    this.now = nowMs;
    this.pollGamepad();
    const current = resolveActions(this.keys, this.buttons, this.bindings);
    // The stick also drives directional actions so menus work with it like a d-pad.
    if (this.stick.x < -0.5) current.add('left');
    if (this.stick.x > 0.5) current.add('right');
    if (this.stick.y < -0.5) current.add('up');
    if (this.stick.y > 0.5) current.add('down');
    this.state.update(current, nowMs);
  }

  private pollGamepad(): void {
    this.buttons.clear();
    this.stick = { x: 0, y: 0 };
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad?.connected) continue;
      pad.buttons.forEach((b, i) => {
        if (b.pressed) this.buttons.add(i);
      });
      const v = applyDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, STICK_DEADZONE);
      if (v.x !== 0 || v.y !== 0) this.stick = v;
      if (this.buttons.size > 0 || v.x !== 0 || v.y !== 0) this.lastDevice = 'gamepad';
      break;
    }
  }

  isDown(a: Action): boolean {
    return this.state.isDown(a);
  }

  justPressed(a: Action): boolean {
    return this.state.justPressed(a);
  }

  /** Menu navigation: also fires while held, and treats the stick as a d-pad. */
  menuPressed(a: 'up' | 'down' | 'left' | 'right'): boolean {
    return this.state.repeatPressed(a, this.now, REPEAT_DELAY_MS, REPEAT_INTERVAL_MS);
  }

  /** Movement vector in [-1, 1]; analog when the stick is used. */
  move(): Vec2 {
    if (this.stick.x !== 0 || this.stick.y !== 0) return this.stick;
    const x = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    const y = (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0);
    return normalizeDigital(x, y);
  }

  consumeAll(): void {
    this.state.consumeAll();
  }
}

export const input = new InputService();
