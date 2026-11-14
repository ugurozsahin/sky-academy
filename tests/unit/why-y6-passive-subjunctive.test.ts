// #2318 (y6-passive, y6-subjunctive): the why gives the test that settles the card.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { PASSIVES, activeWhy, buildWhy, doerWhy, passiveWhy } from '../../src/curriculum/year6-passive';
import { SUBJUNCTIVES, subjunctiveWhy } from '../../src/curriculum/year6-subjunctive';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y6-passive says why (#2318)', () => {
  it('words each test', () => {
    const r = PASSIVES[0];
    expect(passiveWhy(r)).toBe('"Was chased" is be + a participle: the sentence is passive.');
    expect(activeWhy(r)).toBe('The dog does it, and comes first: the sentence is active.');
    expect(buildWhy(r)).toBe('The past of be, then the participle: was chased.');
    expect(doerWhy(r, false)).toBe('The doer follows "by": the dog.');
    expect(doerWhy(r, true)).toContain('not told');
  });
});

describe('y6-subjunctive says why (#2318)', () => {
  it('words each kind', () => {
    expect(subjunctiveWhy(SUBJUNCTIVES[0])).toBe('It is only imagined, so formal writing says "were", not "was".');
    expect(subjunctiveWhy(SUBJUNCTIVES.find(r => r.kind === 'mandative')!)).toBe('After a demand the plain verb follows: "be".');
    expect(subjunctiveWhy(SUBJUNCTIVES.find(r => r.kind === 'inversion')!)).toContain('"Were"');
  });
});

describe.each(['y6-passive', 'y6-subjunctive'])('%s sets a short why on every question', id => {
  it('is short and is not the bare answer', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(id, d)) {
      expect(q.why).toBeTruthy();
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
      expect(q.why).not.toBe(q.answer);
    }
  });
});
