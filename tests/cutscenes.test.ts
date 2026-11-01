import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLLECTIBLE_IDS } from '../src/data/collectibles';
import { CUTSCENES } from '../src/data/cutscenes';
import { DIALOGUES } from '../src/data/dialogue';
import { ENEMIES } from '../src/data/enemies';
import { ZONES } from '../src/data/zones';
import { type CutStep, pickCutscene, seenFlag } from '../src/systems/cutscene';
import { freshGameForTests } from './helpers';

const ctx = { allCollectibles: COLLECTIBLE_IDS };

type MapObj = { type: string; name: string };
const mapOf = (zone: string): { width: number; height: number; objects: MapObj[] } => {
  const map = JSON.parse(readFileSync(`public/assets/maps/${zone}.tmj`, 'utf8'));
  const layer = map.layers.find((l: { type: string }) => l.type === 'objectgroup');
  return { width: map.width, height: map.height, objects: layer.objects };
};

const flatten = (steps: CutStep[]): CutStep[] =>
  steps.flatMap((s) => (s.do === 'together' ? flatten(s.steps) : [s]));

describe('cutscene picking', () => {
  it('plays the opening once, and not after the mission was accepted', () => {
    const s = freshGameForTests();
    expect(pickCutscene(CUTSCENES, 'hub', { on: 'enter' }, s, ctx)?.id).toBe('opening');
    const seen = { ...s, flags: { [seenFlag('opening')]: true } };
    expect(pickCutscene(CUTSCENES, 'hub', { on: 'enter' }, seen, ctx)).toBeNull();
    const accepted = { ...s, flags: { missionAccepted: true } };
    expect(pickCutscene(CUTSCENES, 'hub', { on: 'enter' }, accepted, ctx)).toBeNull();
  });

  it('matches boss triggers by spawn name and zone', () => {
    const s = freshGameForTests();
    expect(pickCutscene(CUTSCENES, 'field', { on: 'boss', spawn: 'boss' }, s, ctx)?.id).toBe(
      'grellIntro',
    );
    expect(pickCutscene(CUTSCENES, 'field', { on: 'boss', spawn: 'other' }, s, ctx)).toBeNull();
    expect(pickCutscene(CUTSCENES, 'hub', { on: 'boss', spawn: 'boss' }, s, ctx)).toBeNull();
  });

  it('matches mid-fight phase triggers by spawn and phase index', () => {
    const s = freshGameForTests();
    const at = (phase: number) =>
      pickCutscene(CUTSCENES, 'field', { on: 'bossPhase', spawn: 'sarn', phase }, s, ctx)?.id;
    expect(at(1)).toBe('sarnTransform');
    expect(at(2)).toBeUndefined();
    expect(pickCutscene(CUTSCENES, 'field', { on: 'boss', spawn: 'sarn' }, s, ctx)?.id).toBe(
      'sarnAnchor',
    );
  });

  it('the arc 1 finale waits for its chapter', () => {
    const s = freshGameForTests();
    expect(pickCutscene(CUTSCENES, 'field', { on: 'enter' }, s, ctx)).toBeNull();
    const ready = { ...s, flags: { okunIntroduced: true } };
    expect(pickCutscene(CUTSCENES, 'field', { on: 'enter' }, ready, ctx)?.id).toBe('sarnArrive');
    const broken = { ...s, flags: { missionAccepted: true, anchorBroken: true } };
    expect(pickCutscene(CUTSCENES, 'hub', { on: 'enter' }, broken, ctx)?.id).toBe('vaultOpening');
  });
});

describe('cutscene content', () => {
  for (const cs of CUTSCENES) {
    it(`${cs.id} only references things that exist`, () => {
      expect(ZONES[cs.zone], cs.zone).toBeDefined();
      const map = mapOf(cs.zone);
      const named = (type: string) =>
        new Set(map.objects.filter((o) => o.type === type).map((o) => o.name));
      const actors = new Set(['player', ...named('npc'), ...named('enemy')]);
      if (cs.trigger.on === 'area') expect(named('cutscene'), cs.id).toContain(cs.trigger.area);
      if (cs.trigger.on === 'boss' || cs.trigger.on === 'bossDefeated')
        expect(named('enemy'), cs.id).toContain(cs.trigger.spawn);
      const enemyAt = (spawn: string) => {
        const obj = map.objects.find((o) => o.type === 'enemy' && o.name === spawn) as
          | (MapObj & { properties?: { name: string; value: unknown }[] })
          | undefined;
        const id = obj?.properties?.find((p) => p.name === 'enemyId')?.value;
        return typeof id === 'string' ? ENEMIES[id] : undefined;
      };
      if (cs.trigger.on === 'bossPhase')
        expect(enemyAt(cs.trigger.spawn)?.phases?.[cs.trigger.phase], cs.id).toBeDefined();
      const inMap = ([x, y]: readonly [number, number]) =>
        x >= 0 && y >= 0 && x < map.width && y < map.height;
      for (const step of flatten(cs.steps)) {
        if (step.do === 'spawn') {
          actors.add(step.id);
          expect(inMap(step.at), `${cs.id} spawn ${step.id}`).toBe(true);
        }
        if (step.do === 'talk') expect(DIALOGUES[step.dialogue], step.dialogue).toBeDefined();
        if ('who' in step) expect(actors, `${cs.id}: ${step.who}`).toContain(step.who);
        if (step.do === 'look') expect(actors, `${cs.id}: ${step.target}`).toContain(step.target);
        if (step.do === 'move') expect(inMap(step.to), `${cs.id} move`).toBe(true);
        if (step.do === 'transform')
          expect(
            enemyAt(step.who)?.phases?.some((p) => p.look),
            `${cs.id} transform`,
          ).toBe(true);
        if (step.do === 'spawn' && 'enemy' in step.actor && step.actor.phase !== undefined)
          expect(ENEMIES[step.actor.enemy]?.phases?.[step.actor.phase]?.look).toBeDefined();
        if (step.do === 'camera' && typeof step.to === 'string')
          expect(actors, `${cs.id}: camera ${step.to}`).toContain(step.to);
      }
    });
  }
});
