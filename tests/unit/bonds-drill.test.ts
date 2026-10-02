// #917: the "Bonds to 10" / "Bonds to 20" drills fix the total, and y1-bonds is unchanged.
import { describe, it, expect } from 'vitest';
import { drillsFor, topicById } from '../../src/curriculum';
import { ri, pick, numQ, q } from '../../src/curriculum/util';
import type { Difficulty, Generator } from '../../src/curriculum/types';

const rngOf = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const DS: Difficulty[] = [1, 2, 3];

// y1Bonds exactly as it stood before #917: the reference for the byte-identical criterion.
const before: Generator = (d, rng) => {
  const total = d === 1 ? 10 : d === 2 ? pick(rng, [10, 12, 15]) : 20;
  const a = ri(rng, 0, total);
  const missingLeft = rng() < 0.4;
  const p = missingLeft ? `? + ${a} = ${total}` : `${a} + ? = ${total}`;
  return numQ(rng, p, total - a, { min: 0, max: 20, ...q(p), visual: total <= 10 ? { type: 'tenframe', n: a } : undefined });
};

describe('number-bond drills (#917)', () => {
  it('are the two Year 1 drills, in the chooser list only', () => {
    expect(drillsFor('year1', 'maths').map(t => t.id)).toEqual(['y1-bonds-10', 'y1-bonds-20']);
  });
  it.each([10, 20])('y1-bonds-%i always totals %i and its answer satisfies the oracle', (T) => {
    const gen = topicById(`y1-bonds-${T}`)!.gen;
    for (const d of DS) for (let seed = 1; seed <= 300; seed++) {
      const c = gen(d, rngOf(seed * 7 + d));
      const m = /^(\d+) \+ \? = (\d+)$/.exec(c.prompt) ?? /^\? \+ (\d+) = (\d+)$/.exec(c.prompt);
      expect(m, c.prompt).not.toBeNull();
      expect(+m![2]).toBe(T);
      expect(+m![1]).toBeGreaterThanOrEqual(0); expect(+m![1]).toBeLessThanOrEqual(T);
      expect(+c.answer).toBe(T - +m![1]);
      expect(c.options).toContain(c.answer);
    }
  });
  it('y1-bonds gives byte-identical cards to before for the same seed', () => {
    const gen = topicById('y1-bonds')!.gen;
    for (const d of DS) for (let seed = 1; seed <= 300; seed++) expect(gen(d, rngOf(seed))).toEqual(before(d, rngOf(seed)));
  });
});
