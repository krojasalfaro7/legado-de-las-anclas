import { type Action, DEFAULT_BINDINGS, PAD } from '../config/controls';

const PAD_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(PAD).map(([name, index]) => [index, name]),
);

/** Human-readable key label from a KeyboardEvent.code. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Arrow')) return code.slice(5);
  return (
    {
      Escape: 'Esc',
      Space: 'Espacio',
      Backspace: 'Retroceso',
      ShiftLeft: 'Shift',
      ShiftRight: 'Shift',
    }[code] ?? code
  );
}

export function keysFor(action: Action): string {
  return [...new Set(DEFAULT_BINDINGS.keyboard[action].map(keyLabel))].join('/');
}

export function padFor(action: Action): string {
  return DEFAULT_BINDINGS.gamepad[action].map((b) => PAD_NAMES[b] ?? `B${b}`).join('/');
}
