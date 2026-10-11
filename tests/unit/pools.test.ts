import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { answerableBy, subjectPool, subjectTopics, type Surface } from '../../src/game/pools';
import type { Topic } from '../../src/curriculum';
import { duelPool } from '../../src/game/duel';
import { weakestTopics } from '../../src/game/sensei';
import { chooserEligible } from '../../src/ui/chooser';

const topic = (extra: Partial<Topic>): Topic => ({ id: 't', name: 't', icon: '', gen: () => { throw new Error('unused'); }, ...extra }) as Topic;
const SURFACES: Surface[] = ['mission', 'mixed', 'duel'];

describe('answerableBy (#1065)', () => {
  it('a keypad topic is its own mission only', () => {
    const t = topic({ input: 'keypad' });
    expect(SURFACES.map(s => answerableBy(t, s, 1))).toEqual([true, false, false]);
  });
  it('a tracing topic behaves as before on every surface', () => {
    const t = topic({ input: 'tracing' });
    expect(SURFACES.map(s => answerableBy(t, s, 1))).toEqual([true, false, false]);
  });
  it('a bubble topic is allowed everywhere', () => {
    expect(SURFACES.every(s => answerableBy(topic({}), s, 3))).toBe(true);
    expect(SURFACES.every(s => answerableBy(topic({ input: 'bubbles' }), s))).toBe(true);
  });
  it('a sequence topic asked about without a difficulty is out of the duel (fail closed)', () => {
    expect(answerableBy(topic({ sequenceFrom: 3 }), 'duel')).toBe(false);
    expect(answerableBy(topic({}), 'duel')).toBe(true);
  });
  it('a sequence topic leaves the duel at sequenceFrom, but stays in mixed pools', () => {
    const t = topic({ sequenceFrom: 3 });
    expect(answerableBy(t, 'duel', 2)).toBe(true);
    expect(answerableBy(t, 'duel', 3)).toBe(false);
    expect(answerableBy(t, 'mixed', 3)).toBe(true);
    expect(answerableBy(t, 'mission', 3)).toBe(true);
  });
});

// Each call site is pinned: deleting the `answerableBy` call in any of them lets a keypad topic through.
describe('keypad topics at the call sites (#1065)', () => {
  const pad = topic({ id: 'pad', input: 'keypad', subject: 'maths', year: 'year1', gen: () => ({}) as never });
  const bubbles = topic({ id: 'bub', subject: 'maths', year: 'year1', gen: () => ({ prompt: '1', answer: '1', choices: ['1', '2'] }) as never });
  it('duelPool drops it', () => { expect(duelPool([pad, bubbles], 1).map(t => t.id)).toEqual(['bub']); });
  it('weakestTopics (Sensei) drops it', () => { expect(weakestTopics([pad, bubbles], {}, 3).map(t => t.id)).toEqual(['bub']); });
  it('the Sky Storm / Boss pool in play.ts goes through it', () => { expect(readFileSync('src/ui/play.ts', 'utf8')).toContain("filter(t => answerableBy(t, 'mixed'))"); });
  it('the chooser (Endless, Sprint, Relaxed, Boss) drops it', () => { expect([pad, bubbles].filter(chooserEligible).map(t => t.id)).toEqual(['bub']); });
});

// #908/#1325: the island's Mixed pool for the open subject tab. `curriculum.test.ts` used to pin "never empty" with a
// hand-copied predicate (`input !== 'tracing'`), which had already drifted from the game's (`answerableBy(t, 'mixed')`,
// which drops keypad topics too): a keypad-only subject passed the test and would have reached `Session.pickTopic()`
// as `[]`. The real function is exported and called instead, and the degrade below means an empty subject never
// reaches the Session at all. The stub lists here are the only way to drive the degrade — every shown year has both
// subjects populated, which `curriculum.test.ts` pins.
describe('subjectTopics / subjectPool (#908, #1325)', () => {
  const t = (id: string, subject: Topic['subject'], input?: Topic['input']) => topic({ id, subject, year: 'year1', input });
  const year = [t('m1', 'maths'), t('m-trace', 'maths', 'tracing'), t('w1', 'writing'), t('w-pad', 'writing', 'keypad'), t('m2', 'maths')];
  it('subjectTopics is the subject’s bubble topics in registry order — no tracing, no keypad, no other subject', () => {
    expect(subjectTopics(year, 'maths').map(x => x.id)).toEqual(['m1', 'm2']);
    expect(subjectTopics(year, 'writing').map(x => x.id)).toEqual(['w1']);
  });
  it('subjectPool is subjectTopics while the subject has one', () => {
    expect(subjectPool(year, 'maths')).toEqual(subjectTopics(year, 'maths'));
    expect(subjectPool(year, 'writing')).toEqual(subjectTopics(year, 'writing'));
  });
  it('degrades to the whole year’s bubble topics when the subject has none, with a warning — the hand-copied predicate let this case through', () => {
    const noWriting = [t('m1', 'maths'), t('w-pad', 'writing', 'keypad'), t('m2', 'maths')];
    expect(noWriting.filter(x => x.subject === 'writing' && x.input !== 'tracing')).toHaveLength(1);   // the old test's predicate: "non-empty"
    expect(subjectTopics(noWriting, 'writing')).toEqual([]);                                             // the game's: empty
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(subjectPool(noWriting, 'writing').map(x => x.id)).toEqual(['m1', 'm2']);
    expect(warn).toHaveBeenCalledTimes(1); expect(warn.mock.calls[0][0]).toContain('no writing bubble topic');   // the degrade is never silent
    warn.mockClear(); expect(subjectPool(year, 'writing').map(x => x.id)).toEqual(['w1']); expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
  it('a year with no bubble topic at all stays empty — nothing to degrade to, and Session.pickTopic() throws on it (session-empty-pool.test.ts)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(subjectPool([t('w-pad', 'writing', 'keypad'), t('m-trace', 'maths', 'tracing')], 'writing')).toEqual([]);
    warn.mockRestore();
  });
  it('the island builds its Mixed pool, and the chooser its list, through these — not through a predicate of their own', () => {
    expect(readFileSync('src/ui/home.ts', 'utf8')).toContain('subjectPool(topicsFor(year.id), subject)');
    expect(readFileSync('src/ui/chooser.ts', 'utf8')).toContain('subjectTopics(topicsFor(year), subject)');
    expect(readFileSync('src/ui/home.ts', 'utf8')).not.toContain('filter(chooserEligible)');   // the inline spelling this replaced
  });
});
