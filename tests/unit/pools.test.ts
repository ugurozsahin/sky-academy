import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { answerableBy, type Surface } from '../../src/game/pools';
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
