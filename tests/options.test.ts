import { describe, expect, it } from 'vitest';
import { normalizeOptions } from '../src/services/storage';

describe('options', () => {
  it('fills defaults', () => {
    expect(normalizeOptions({})).toEqual({ volume: 0.6, showControls: true });
  });

  it('clamps the volume so the options bar can always be drawn', () => {
    expect(normalizeOptions({ volume: 1.1 }).volume).toBe(1);
    expect(normalizeOptions({ volume: -0.1 }).volume).toBe(0);
    expect(normalizeOptions({ volume: 0.30000000000000004 }).volume).toBe(0.3);
    expect(normalizeOptions({ volume: Number.NaN }).volume).toBe(0.6);
  });

  it('keeps a stored choice to hide the controls hint', () => {
    expect(normalizeOptions({ showControls: false }).showControls).toBe(false);
  });
});
