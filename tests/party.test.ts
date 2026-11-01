import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { CHARACTERS, isPlayable } from '../src/data/characters';
import { nextCharacter, playableParty, switchCharacter } from '../src/systems/party';
import { freshGameForTests } from './helpers';

const enabledInData = (id: string) => CHARACTERS[id]?.enabled ?? false;

describe('party', () => {
  it('only Tavi is playable at the start; the rest wait for their join flags', () => {
    const s = freshGameForTests();
    expect(s.partyOrder).toEqual(['tavi', 'okun', 'iole', 'nilo']);
    expect(playableParty(s, enabledInData)).toEqual(['tavi']);
    expect(nextCharacter(s, enabledInData)).toBeNull();
    expect(switchCharacter(s, 'okun', enabledInData)).toBe(s);
  });

  it('cycles members once more characters are enabled', () => {
    const s = freshGameForTests();
    const all = () => true;
    expect(nextCharacter(s, all)).toBe('okun');
    const switched = switchCharacter(s, 'okun', all);
    expect(switched.activeCharacter).toBe('okun');
    expect(nextCharacter(switched, all)).toBe('iole');
  });

  it('Tavi is out of the party until she wakes in the Hondura', () => {
    expect(isPlayable('tavi', { taviTaken: true })).toBe(false);
    expect(isPlayable('tavi', { taviTaken: true, taviWakes: true })).toBe(true);
    expect(isPlayable('iole', { ioleJoined: true })).toBe(true);
    expect(isPlayable('nilo', {})).toBe(false);
  });
});

describe('Okun joins the party', () => {
  it('becomes playable once the story sets his join flag', () => {
    expect(isPlayable('okun', {})).toBe(false);
    expect(isPlayable('okun', { okunJoined: true })).toBe(true);
    expect(isPlayable('tavi', {})).toBe(true);
    expect(isPlayable('nobody', { okunJoined: true })).toBe(false);
  });

  it('each member keeps their own vitals across a switch', () => {
    const s = freshGameForTests();
    const playable = (id: string) => isPlayable(id, { okunJoined: true });
    const tavi = s.party.tavi;
    if (!tavi) throw new Error('missing Tavi');
    tavi.vitals = { hp: 3, ki: 1 };
    const switched = switchCharacter(s, 'okun', playable);
    const okun = switched.party.okun;
    expect(okun?.vitals.hp).toBeGreaterThan(3);
    expect(switched.party.tavi?.vitals).toEqual({ hp: 3, ki: 1 });
  });

  it('fights slower but harder than the default chain', () => {
    const okun = CHARACTERS.okun?.melee;
    if (!okun) throw new Error('Okun has no melee style');
    const d = BALANCE.melee;
    const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
    expect(okun.startupMs).toBeGreaterThan(d.startupMs);
    expect(okun.recoveryMs.length).toBeLessThan(d.recoveryMs.length);
    expect(okun.power).toBeGreaterThan(d.power);
    expect(okun.stagger).toBeLessThan(d.stagger);
    // Fewer swings, but each one hits harder on average.
    const perSwing = (m: typeof okun) => (sum(m.comboMults) * m.power) / m.comboMults.length;
    expect(perSwing(okun)).toBeGreaterThan(perSwing(d));
    // Every per-step table must cover the whole chain.
    for (const m of [okun, d]) {
      for (const list of [m.moveCancelMs, m.comboMults, m.knockback, m.lungeSpeed, m.poses]) {
        expect(list.length).toBe(m.recoveryMs.length);
      }
    }
  });
});

describe('fighters feel different', () => {
  it('Tavi is the quick one and Okun the wall', async () => {
    const { CHARACTERS } = await import('../src/data/characters');
    const tavi = CHARACTERS.tavi?.traits;
    const okun = CHARACTERS.okun?.traits;
    if (!tavi || !okun) throw new Error('missing characters');
    expect(tavi.chargeTimeMult).toBeLessThan(okun.chargeTimeMult);
    expect(tavi.kiRegenMult).toBeGreaterThan(okun.kiRegenMult);
    expect(tavi.runMult).toBeGreaterThan(okun.runMult);
    expect(okun.guardMult).toBeLessThan(tavi.guardMult);
    expect(okun.armoredSwings).toBe(true);
    expect(okun.finisherQuake).toBeGreaterThan(0);
  });
});
