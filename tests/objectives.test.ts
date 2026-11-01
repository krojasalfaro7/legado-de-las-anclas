import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/data/characters';
import { COLLECTIBLE_IDS } from '../src/data/collectibles';
import { CUTSCENES } from '../src/data/cutscenes';
import { NPCS } from '../src/data/npcs';
import { OBJECTIVES } from '../src/data/objectives';
import { type CutStep, seenFlag } from '../src/systems/cutscene';
import type { GameState } from '../src/systems/gameState';
import type { NpcCondition } from '../src/systems/npcRules';
import { objectiveProgress, visibleObjectives } from '../src/systems/objectives';
import { freshGameForTests } from './helpers';

const ctx = { allCollectibles: COLLECTIBLE_IDS };
const flag = (s: GameState, f: string): GameState => ({ ...s, flags: { ...s.flags, [f]: true } });
const main = OBJECTIVES.find((o) => o.id === 'valleyAnchor');
const side = OBJECTIVES.find((o) => o.id === 'mistRelics');

describe('objectives', () => {
  it('the main story walks Iolé → Grell → report', () => {
    if (!main) throw new Error('missing main objective');
    let s = freshGameForTests();
    expect(objectiveProgress(main, s, ctx)).toEqual({ visible: true, step: 0, complete: false });
    s = flag(s, 'missionAccepted');
    expect(objectiveProgress(main, s, ctx).step).toBe(1);
    s = { ...s, defeatedBosses: ['field:boss'] };
    expect(objectiveProgress(main, s, ctx).step).toBe(2);
    s = flag(s, 'missionReported');
    expect(objectiveProgress(main, s, ctx).complete).toBe(true);
  });

  it('the relic quest appears after meeting Pim and needs every relic', () => {
    if (!side) throw new Error('missing side objective');
    let s = freshGameForTests();
    expect(objectiveProgress(side, s, ctx).visible).toBe(false);
    s = { ...flag(s, 'pimMet'), collectiblesFound: COLLECTIBLE_IDS.slice(0, 1) };
    expect(objectiveProgress(side, s, ctx)).toEqual({ visible: true, step: 0, complete: false });
    s = { ...s, collectiblesFound: [...COLLECTIBLE_IDS] };
    expect(objectiveProgress(side, s, ctx).step).toBe(1);
  });

  it('the arc 1 finale goes valley → Sarn → Iolé → vault chest', () => {
    const hunt = OBJECTIVES.find((o) => o.id === 'sarnHunt');
    if (!hunt) throw new Error('missing sarnHunt');
    let s = freshGameForTests();
    expect(objectiveProgress(hunt, s, ctx).visible).toBe(false);
    s = flag(s, 'okunIntroduced');
    expect(objectiveProgress(hunt, s, ctx).step).toBe(0);
    s = flag(s, seenFlag('sarnArrive'));
    s = { ...s, defeatedBosses: ['field:sarn'] };
    s = flag(s, 'vaultOpened');
    expect(objectiveProgress(hunt, s, ctx).step).toBe(3);
    s = { ...s, openedChests: ['hub:chestVault'] };
    expect(objectiveProgress(hunt, s, ctx).complete).toBe(true);
  });

  it('lists open story objectives first and finished ones last', () => {
    let s = flag(freshGameForTests(), 'pimMet');
    expect(visibleObjectives(OBJECTIVES, s, ctx).map((o) => o.def.id)).toEqual([
      'valleyAnchor',
      'mistRelics',
    ]);
    s = flag(flag(s, 'missionAccepted'), 'missionReported');
    s = { ...s, defeatedBosses: ['field:boss'] };
    expect(visibleObjectives(OBJECTIVES, s, ctx).map((o) => o.def.id)).toEqual([
      'copperHollow',
      'mistRelics',
      'valleyAnchor',
    ]);
  });

  it('every flag an objective waits for is set somewhere (NPCs, cutscenes)', () => {
    const steps = (list: CutStep[]): CutStep[] =>
      list.flatMap((st) => (st.do === 'together' ? steps(st.steps) : [st]));
    const setFlags = new Set([
      ...Object.values(NPCS).flatMap((n) =>
        n.rules.flatMap((r) => r.effects ?? []).map((e) => e.setFlag),
      ),
      ...CUTSCENES.map((c) => seenFlag(c.id)),
      ...CUTSCENES.flatMap((c) =>
        steps(c.steps).flatMap((st) =>
          st.do === 'flag'
            ? [st.flag]
            : st.do === 'join'
              ? [CHARACTERS[st.character]?.joinFlag]
              : [],
        ),
      ),
    ]);
    const conditions: NpcCondition[] = OBJECTIVES.flatMap((o) => [
      o.start,
      ...o.steps.map((s) => s.done),
    ]);
    for (const c of conditions) {
      for (const f of [c.flag, c.notFlag]) if (f) expect(setFlags, f).toContain(f);
    }
  });
});
