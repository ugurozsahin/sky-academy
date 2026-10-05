import { describe, it, expect } from 'vitest';
import { answerableBy, type Surface } from '../../src/game/pools';
import type { Topic } from '../../src/curriculum';

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
  it('a sequence topic leaves the duel at sequenceFrom, but stays in mixed pools', () => {
    const t = topic({ sequenceFrom: 3 });
    expect(answerableBy(t, 'duel', 2)).toBe(true);
    expect(answerableBy(t, 'duel', 3)).toBe(false);
    expect(answerableBy(t, 'mixed', 3)).toBe(true);
    expect(answerableBy(t, 'mission', 3)).toBe(true);
  });
});
