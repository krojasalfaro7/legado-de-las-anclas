import { describe, expect, it } from 'vitest';
import { createNewGame } from '../src/systems/gameState';
import { evaluateNpc, type NpcRule } from '../src/systems/npcRules';

const ctx = { allCollectibles: ['a', 'b', 'c'] };
const base = () =>
  createNewGame([{ id: 'tavi', startingTechniques: ['spark'] }], 'tavi', { zone: 'hub' });

const museum: NpcRule[] = [
  { when: { flag: 'museumRewarded' }, dialogue: 'thanks' },
  {
    when: { undeliveredCollectibles: 'some' },
    dialogue: 'deliver',
    effects: [{ deliverCollectibles: true }],
  },
  {
    when: { allDelivered: true },
    dialogue: 'reward',
    effects: [{ learnTechnique: 'lighthouseBeam' }, { setFlag: 'museumRewarded' }],
  },
  { when: {}, dialogue: 'idle' },
];

describe('evaluateNpc', () => {
  it('falls back to the last rule', () => {
    expect(evaluateNpc(museum, base(), ctx)?.dialogue).toBe('idle');
  });

  it('delivers carried collectibles', () => {
    const s = { ...base(), collectiblesFound: ['a', 'b'] };
    const out = evaluateNpc(museum, s, ctx);
    expect(out?.dialogue).toBe('deliver');
    expect(out?.state.collectiblesDelivered).toEqual(['a', 'b']);
  });

  it('rewards once everything is delivered, only once', () => {
    const s = {
      ...base(),
      collectiblesFound: ['a', 'b', 'c'],
      collectiblesDelivered: ['a', 'b', 'c'],
    };
    const out = evaluateNpc(museum, s, ctx);
    expect(out?.dialogue).toBe('reward');
    expect(out?.state.party.tavi?.techniques).toContain('lighthouseBeam');
    expect(out && evaluateNpc(museum, out.state, ctx)?.dialogue).toBe('thanks');
  });

  it('supports flag and boss conditions', () => {
    const rules: NpcRule[] = [
      {
        when: { bossDefeated: 'boss', notFlag: 'reported' },
        dialogue: 'report',
        effects: [{ setFlag: 'reported' }],
      },
      { when: { notFlag: 'accepted' }, dialogue: 'intro', effects: [{ setFlag: 'accepted' }] },
      { when: {}, dialogue: 'remind' },
    ];
    const first = evaluateNpc(rules, base(), ctx);
    expect(first?.dialogue).toBe('intro');
    expect(first && evaluateNpc(rules, first.state, ctx)?.dialogue).toBe('remind');
    const won = { ...base(), defeatedBosses: ['boss'] };
    expect(evaluateNpc(rules, won, ctx)?.dialogue).toBe('report');
  });
});

describe('quest conditions and rewards', () => {
  const bounty: NpcRule[] = [
    { when: { flag: 'paid' }, dialogue: 'done' },
    {
      when: { kills: { enemy: 'raider', count: 3 }, hasItem: 'ration' },
      dialogue: 'pay',
      effects: [{ takeItem: 'ration' }, { giveMoney: 50 }, { setFlag: 'paid' }],
    },
    { when: { playing: 'okun' }, dialogue: 'stone' },
    { when: {}, dialogue: 'ask' },
  ];

  it('pays a hunt once enough enemies fell and the item is handed in', () => {
    const s = { ...base(), kills: { raider: 2 }, inventory: { ration: 2 } };
    expect(evaluateNpc(bounty, s, ctx)?.dialogue).toBe('ask');
    const ready = { ...s, kills: { raider: 3 } };
    const out = evaluateNpc(bounty, ready, ctx);
    expect(out?.dialogue).toBe('pay');
    expect(out?.state.money).toBe(50);
    expect(out?.state.inventory.ration).toBe(1);
    expect(out && evaluateNpc(bounty, out.state, ctx)?.dialogue).toBe('done');
  });

  it('can answer differently to whoever is being played', () => {
    const s = { ...base(), activeCharacter: 'okun' };
    expect(evaluateNpc(bounty, s, ctx)?.dialogue).toBe('stone');
  });

  it('hunts count from when they were taken', () => {
    const rules: NpcRule[] = [
      { when: { flag: 'taken', kills: { enemy: 'raider', count: 3 } }, dialogue: 'pay' },
      {
        when: { notFlag: 'taken' },
        dialogue: 'ask',
        effects: [{ setFlag: 'taken' }, { startHunt: 'raider' }],
      },
      { when: {}, dialogue: 'remind' },
    ];
    // Five raiders down before the hunt: they don't count.
    const asked = evaluateNpc(rules, { ...base(), kills: { raider: 5 } }, ctx);
    expect(asked?.dialogue).toBe('ask');
    const taken = asked?.state ?? base();
    expect(taken.huntMarks).toEqual({ raider: 5 });
    expect(evaluateNpc(rules, { ...taken, kills: { raider: 7 } }, ctx)?.dialogue).toBe('remind');
    expect(evaluateNpc(rules, { ...taken, kills: { raider: 8 } }, ctx)?.dialogue).toBe('pay');
  });
});
