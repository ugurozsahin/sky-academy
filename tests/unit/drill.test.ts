// #915: a `drill: true` topic is a registry row that only the Sprint chooser lists. The fixture drill is appended
// to Year 2's list with a `vi.mock` of the module `curriculum/index.ts` imports it from, so the real barrel,
// `topicsFor`, `listedTopics`, `masterProgress`, `parentSummary`, `weakestTopics` and `duelPool` all run unmocked.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/curriculum/year2-topics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/curriculum/year2-topics')>();
  const drill = { id: 'fx-drill', title: 'Fixture drill', icon: '🧪', subject: 'maths' as const, year: 'year2' as const, nc: 'fixture', drill: true as const,
    gen: () => ({ prompt: '1 + 1', answer: '2', options: ['2', '3', '4'] }) };
  return { ...actual, YEAR2_TOPICS: [...actual.YEAR2_TOPICS, drill] };
});

import { CORE_TOPICS, TOPICS, drillsFor, listedTopics, shownYears, topicById, topicsFor } from '../../src/curriculum';
import { chooserTopics } from '../../src/ui/chooser';
import { duelPool } from '../../src/game/duel';
import { masterProgress, weakestTopics } from '../../src/game/sensei';
import { parentSummary } from '../../src/game/parents';
import { load } from '../../src/storage';

const mem: Record<string, string> = {};   // minimal localStorage shim for node, as in parents.test.ts
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => {} };

const FX = 'fx-drill';
const ids = (ts: { id: string }[]) => ts.map(t => t.id);

describe('a drill topic stays out of everything but the chooser (#915)', () => {
  it('is found by topicById and drillsFor, and by no other listing', () => {
    expect(topicById(FX)?.drill).toBe(true);
    expect(ids(TOPICS)).toContain(FX);
    expect(ids(drillsFor('year2')).filter(i => !i.startsWith('y2-tables-'))).toEqual([FX]);   // the real tables drills (#916) sit beside it
    expect(drillsFor('year2', 'writing')).toEqual([]);
    expect(drillsFor('year1')).toEqual([]);
    for (const l of [CORE_TOPICS, topicsFor('year2'), topicsFor('year2', 'maths'), listedTopics()]) expect(ids(l)).not.toContain(FX);
  });

  it('star totals, the Master Ninja unlock and the grown-ups summary ignore it', () => {
    const islands = shownYears().map(y => topicsFor(y.id));
    const starred = Object.fromEntries(CORE_TOPICS.map(t => [t.id, { stars: 3, best: 1, plays: 1 }])) as never;
    expect(masterProgress(islands, starred).unlocked).toBe(true);   // every core topic starred, the unstarred drill does not block it
    const sm = parentSummary(load(), listedTopics(), shownYears(), 1);
    expect(sm.topicsTotal).toBe(listedTopics().length);
    expect(listedTopics().length).toBe(shownYears().flatMap(y => topicsFor(y.id)).length);
  });

  it('Sensei and the Duel pool never draw it, even with progress recorded on it', () => {
    const progress = { [FX]: { stars: 0, best: 0, plays: 9 } } as never;
    expect(ids(weakestTopics(topicsFor('year2'), progress, 99))).not.toContain(FX);
    expect(ids(duelPool(topicsFor('year2'), 1))).not.toContain(FX);
  });

  it('the chooser lists it after the open subject\'s regular topics, in that subject only', () => {
    const maths = chooserTopics('year2', 'maths');
    expect(maths[maths.length - 1].id).toBe(FX);
    expect(ids(maths.filter(t => !t.drill))).toEqual(ids(topicsFor('year2', 'maths').filter(t => t.input !== 'tracing')));
    expect(ids(chooserTopics('year2', 'writing'))).not.toContain(FX);
  });
});
