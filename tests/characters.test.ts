import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/data/characters';
import { getTechnique } from '../src/data/kiTechniques';

describe('character powers match who they are', () => {
  it('only ki users fly', () => {
    expect(CHARACTERS.tavi?.canFly).toBe(true);
    expect(CHARACTERS.okun?.canFly).toBe(false);
  });

  it("Okun's techniques are all thrown stone, with no beams", () => {
    const okun = CHARACTERS.okun;
    if (!okun) throw new Error('no okun');
    const ids = [...okun.startingTechniques, ...okun.techniqueUnlocks.map((u) => u.technique)];
    for (const id of ids) {
      expect(getTechnique(id).look, id).toBe('rock');
      expect(getTechnique(id).beam, id).toBeUndefined();
    }
  });
});
