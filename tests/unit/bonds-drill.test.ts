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

// #922: the original card for a fixed total, continuing from the rng state after the total and the reverse-form draw.
const originalFrom = (rng: () => number, total: number) => {
  const a = ri(rng, 0, total);
  const missingLeft = rng() < 0.4;
  const p = missingLeft ? `? + ${a} = ${total}` : `${a} + ? = ${total}`;
  return numQ(rng, p, total - a, { min: 0, max: 20, ...q(p), visual: total <= 10 ? { type: 'tenframe', n: a } : undefined });
};

/** #2316: a card gained a `why`; everything else about it must be the bytes it had. */
const noWhy = <T extends object>(c: T): Omit<T, 'why'> => { const { why: _why, ...rest } = c as T & { why?: string }; return rest; };

describe('number-bond drills (#917)', () => {
  it('are the two Year 1 drills, in the chooser list only', () => {
    expect(drillsFor('year1', 'maths').map(t => t.id)).toEqual(['y1-bonds-10', 'y1-bonds-20', 'y1-doubles-halves']);
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
  it('y1-bonds gives byte-identical cards to before at d1 (#922 adds a reverse form at d2–d3 only)', () => {
    const gen = topicById('y1-bonds')!.gen;
    for (let seed = 1; seed <= 300; seed++) expect(noWhy(gen(1, rngOf(seed)))).toEqual(before(1, rngOf(seed)));
  });
  it('y1-bonds d2–d3: the original cards keep their totals (10/12/15 at d2, 20 at d3) and bytes (#922)', () => {
    const gen = topicById('y1-bonds')!.gen;
    for (const d of [2, 3] as Difficulty[]) {
      let kept = 0;
      for (let seed = 1; seed <= 600; seed++) {
        const r = rngOf(seed);
        const total = d === 2 ? pick(r, [10, 12, 15]) : 20;
        if (r() < 1 / 3) continue;
        kept++;
        expect(noWhy(gen(d, rngOf(seed)))).toEqual(originalFrom(r, total));
      }
      expect(kept).toBeGreaterThan(300);
    }
  });
  it('y1-bonds d2–d3: about one card in three is "Which makes T?" and satisfies the oracle (#922)', () => {
    const gen = topicById('y1-bonds')!.gen;
    for (const d of [2, 3] as Difficulty[]) {
      let rev = 0; const N = 1500;
      for (let seed = 1; seed <= N; seed++) {
        const c = gen(d, rngOf(seed));
        const m = /^Which makes (\d+)\?$/.exec(c.prompt);
        if (!m) continue;
        rev++;
        const T = +m[1];
        expect(d === 2 ? [10, 12, 15] : [20]).toContain(T);
        const val = (o: string) => { const [x, y] = o.split(' + ').map(Number); expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0); expect(x + y).toBeLessThanOrEqual(20); return x + y; };
        expect(c.options).toHaveLength(4);
        expect(c.options.filter(o => val(o) === T)).toEqual([c.answer]);
        for (const o of c.options) if (o !== c.answer) expect(T === 20 ? [1, 2, 3] : [1, 2]).toContain(Math.abs(val(o) - T));
        expect(new Set(c.options.map(val)).size).toBe(4);
        expect(c.say).toBe(`Which two numbers make ${T}?`);
      }
      expect(rev / N).toBeGreaterThan(0.28); expect(rev / N).toBeLessThan(0.39);
    }
  });
});
