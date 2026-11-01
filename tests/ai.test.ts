import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { type AiInput, decideAiState } from '../src/systems/ai';

const raider = ENEMIES.raider;
if (!raider) throw new Error('raider enemy missing');
const params = raider.ai;
const base: AiInput = {
  state: 'idle',
  now: 10_000,
  stateSince: 9_900,
  distToPlayer: 500,
  distFromHome: 0,
  hurtUntil: 0,
  attackBusy: false,
  attackReadyAt: 0,
  provoked: false,
  dead: false,
};

describe('decideAiState', () => {
  it('idles, then patrols after a while', () => {
    expect(decideAiState(base, params)).toBe('idle');
    expect(decideAiState({ ...base, stateSince: 0 }, params)).toBe('patrol');
  });

  it('chases inside aggro range and attacks when close and ready', () => {
    expect(decideAiState({ ...base, distToPlayer: params.aggroRange - 1 }, params)).toBe('chase');
    expect(decideAiState({ ...base, distToPlayer: params.attackRange - 1 }, params)).toBe('attack');
    expect(decideAiState({ ...base, distToPlayer: 5, attackReadyAt: 20_000 }, params)).toBe(
      'chase',
    );
  });

  it('prioritizes dead > hurt > running attack', () => {
    expect(decideAiState({ ...base, dead: true, hurtUntil: 99_999 }, params)).toBe('dead');
    expect(decideAiState({ ...base, hurtUntil: 99_999, attackBusy: true }, params)).toBe('hurt');
    expect(decideAiState({ ...base, attackBusy: true }, params)).toBe('attack');
  });

  it('returns home when leashed and resumes idle there', () => {
    expect(
      decideAiState(
        { ...base, state: 'chase', distToPlayer: 50, distFromHome: params.leashRange + 1 },
        params,
      ),
    ).toBe('return');
    expect(decideAiState({ ...base, state: 'return', distFromHome: 2 }, params)).toBe('idle');
  });

  it('being provoked widens aggro range', () => {
    const far = { ...base, distToPlayer: params.aggroRange * 1.5 };
    expect(decideAiState(far, params)).toBe('idle');
    expect(decideAiState({ ...far, provoked: true }, params)).toBe('chase');
  });
});
