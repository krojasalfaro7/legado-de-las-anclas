import { describe, expect, it } from 'vitest';
import { BOULDER_HITS, barrierVerdict, boulderDamage } from '../src/systems/barriers';
import { freshGameForTests } from './helpers';

describe('barriers', () => {
  it('level barriers need the right character at the right level', () => {
    const s = freshGameForTests();
    const rule = { kind: 'level' as const, character: 'tavi', level: 5 };
    expect(barrierVerdict(rule, s)).toBe('lowLevel');
    const tavi = s.party.tavi;
    if (!tavi) throw new Error('missing Tavi');
    tavi.level = 5;
    expect(barrierVerdict(rule, s)).toBe('open');
    expect(barrierVerdict({ ...rule, character: 'okun', level: 1 }, s)).toBe('wrongCharacter');
  });

  it("boulders only yield to their character's punches; a finisher counts double", () => {
    const s = { ...freshGameForTests(), activeCharacter: 'okun' };
    expect(barrierVerdict({ kind: 'boulder', character: 'okun', level: 1 }, s)).toBe('open');
    expect(boulderDamage(true) + boulderDamage(false)).toBe(BOULDER_HITS);
  });

  it('seals open only on their story flag, whoever is playing', () => {
    const s = freshGameForTests();
    const rule = { kind: 'seal' as const, character: 'tavi', level: 1, openFlag: 'vaultOpened' };
    expect(barrierVerdict(rule, s)).toBe('sealed');
    expect(barrierVerdict(rule, { ...s, flags: { vaultOpened: true } })).toBe('open');
  });
});
