/**
 * Default control bindings. Edit this file to rebind. Keyboard values are
 * `KeyboardEvent.code`; gamepad values are W3C "standard" mapping button indices.
 */
export const ACTIONS = [
  'up',
  'down',
  'left',
  'right',
  'attack',
  'ki',
  'block',
  'switchKi',
  'fly',
  'switchChar',
  'interact',
  'lens',
  'pause',
  'fullscreen',
  'confirm',
  'cancel',
  'debug',
] as const;

export type Action = (typeof ACTIONS)[number];

export interface Bindings {
  keyboard: Record<Action, readonly string[]>;
  gamepad: Record<Action, readonly number[]>;
}

/** Standard-mapping gamepad button indices. */
export const PAD = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  BACK: 8,
  START: 9,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const;

export const DEFAULT_BINDINGS: Bindings = {
  keyboard: {
    // Arrows move; every action sits under the left hand around A/S/D.
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    attack: ['KeyD'],
    ki: ['KeyS'],
    block: ['KeyA'],
    switchKi: ['KeyQ'],
    fly: ['ShiftLeft', 'ShiftRight'],
    switchChar: ['KeyR'],
    interact: ['KeyE'],
    lens: ['Tab'],
    pause: ['Escape', 'Enter'],
    fullscreen: ['KeyF'],
    confirm: ['KeyD', 'KeyE', 'Space'],
    cancel: ['KeyS', 'Escape', 'Backspace'],
    debug: ['F1'],
  },
  gamepad: {
    up: [PAD.UP],
    down: [PAD.DOWN],
    left: [PAD.LEFT],
    right: [PAD.RIGHT],
    attack: [PAD.A],
    ki: [PAD.B],
    block: [PAD.RB],
    switchKi: [PAD.LB],
    fly: [PAD.X],
    switchChar: [PAD.RT],
    interact: [],
    lens: [PAD.BACK],
    pause: [PAD.START],
    fullscreen: [],
    confirm: [PAD.A],
    cancel: [PAD.B],
    debug: [],
  },
};

export const STICK_DEADZONE = 0.3;
/** Menu auto-repeat when a direction is held. */
export const REPEAT_DELAY_MS = 320;
export const REPEAT_INTERVAL_MS = 110;
