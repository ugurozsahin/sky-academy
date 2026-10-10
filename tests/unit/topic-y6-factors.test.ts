import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-factors')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1257 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

/** Independent oracles. */
const prime = (n: number) => { if (n < 2) return false; for (let i = 2; i < n; i++) if (n % i === 0) return false; return true; };
const pair = (q: Question) => /of (\d+) and (\d+)/.exec(q.prompt)!.slice(1).map(Number) as [number, number];
const rule = (d: Difficulty, q: Question): ((x: number) => boolean) => {
  if (d === 1) return prime;
  const [a, b] = pair(q);
  return d === 2 ? x => a % x === 0 && b % x === 0 : x => x % a === 0 && x % b === 0;
};
const oddComposite = (x: number) => x % 2 === 1 && x > 1 && !prime(x);
const oneOnly = (d: Difficulty, q: Question, x: number) => { const [a, b] = pair(q); return d === 2 ? (a % x === 0) !== (b % x === 0) : (x % a === 0) !== (x % b === 0); };

describe('y6-factors (#1257)', () => {
  it('is a Year 6 calc topic and any-order from d1', () => {
    expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'calc', sequenceFrom: 1 });
  });

  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: targets satisfy the rule, decoys fail it, no qualifying option is left out`, () => {
      for (const q of draw(d)) {
        expect(q.anyOrder).toBe(true);
        const ok = rule(d, q), targets = q.sequence!, decoys = q.options.filter(o => !targets.includes(o));
        expect(targets.length).toBeGreaterThanOrEqual(2); expect(targets.length).toBeLessThanOrEqual(4);
        expect(decoys.length).toBeGreaterThanOrEqual(1);
        expect(q.options.length).toBeGreaterThanOrEqual(6); expect(q.options.length).toBeLessThanOrEqual(7);
        expect(new Set(q.options).size).toBe(q.options.length);
        for (const o of q.options) { expect(o.length, o).toBeLessThanOrEqual(2); expect(ok(Number(o)), `${q.prompt}: ${o}`).toBe(targets.includes(o)); }
        expect(q.answer).toBe(targets.join(','));
        expect(sayIsSafe(q.say ?? q.prompt), q.prompt).toBe(true);
      }
    });
  }

  it('d1 cards hold 1 and an odd composite as decoys, and use only 1–50', () => {
    for (const q of draw(1)) {
      expect(q.options).toHaveLength(7);
      expect(q.options).toContain('1');
      expect(q.options.some(o => oddComposite(Number(o)))).toBe(true);
      for (const o of q.options) expect(Number(o)).toBeLessThanOrEqual(50);
    }
  });

  it('d2 cards pick the pair from 12–60 and carry a one-number-only decoy', () => {
    for (const q of draw(2)) {
      const [a, b] = pair(q);
      for (const n of [a, b]) { expect(n).toBeGreaterThanOrEqual(12); expect(n).toBeLessThanOrEqual(60); }
      expect(a).not.toBe(b);
      expect(q.options.some(o => oneOnly(2, q, Number(o))), q.prompt).toBe(true);
    }
  });

  it('d3 cards list every common multiple up to 60 and carry a one-number-only decoy', () => {
    for (const q of draw(3)) {
      const [a, b] = pair(q);
      const all = Array.from({ length: 60 }, (_, i) => i + 1).filter(x => x % a === 0 && x % b === 0).map(String);
      expect(q.sequence!.slice().sort()).toEqual(all.slice().sort());
      expect(q.options.some(o => oneOnly(3, q, Number(o))), q.prompt).toBe(true);
    }
  });
});
