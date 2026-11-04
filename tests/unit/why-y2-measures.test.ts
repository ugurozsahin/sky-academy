// #2317 (y2-length, y2-mass, y2-capacity, y2-measure-compare): the why restates the unit choice or the sum from the card's own numbers.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (id: string) => { const t = TOPICS.find(x => x.id === id)!; return ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d)))); };

describe('Year 2 measure whys (#2317)', () => {
  for (const id of ['y2-length', 'y2-mass', 'y2-capacity']) {
    it(`${id}: a sum's why is its own working; a unit choice's why names the unit answered`, () => {
      const kinds = new Set<string>();
      for (const q of draw(id)) {
        const w = q.why!;
        expect(w, q.prompt).toBeTruthy();
        expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
        const sum = /^(\d+) (\S+) ([+−]) (\d+) \S+ = (\d+) \S+\.$/.exec(w);
        if (sum) {
          const [, a, u, op, b, r] = sum;
          expect(Number(op === '+' ? Number(a) + Number(b) : Number(a) - Number(b))).toBe(Number(r));
          expect(q.answer).toBe(`${r} ${u}`);
          kinds.add('sum');
        } else if (/^A .+ is (small|big), so \S+\.$/.test(w)) {
          expect(w.endsWith(`so ${q.answer}.`), w).toBe(true);
          kinds.add('unit');
        } else kinds.add('compare');
      }
      expect([...kinds].sort()).toEqual(['compare', 'sum', 'unit']);
    });
  }
  it('y2-measure-compare: the why states the sign the answer shows', () => {
    const seen = new Set<string>();
    for (const q of draw('y2-measure-compare')) {
      const m = /^(\d+) (?:is (less|greater) than|equals) (\d+)\.$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      const [a, b] = [Number(m[1]), Number(m[3])];
      expect(q.answer).toBe(a < b ? '<' : a > b ? '>' : '=');
      expect(q.prompt).toBe(`${a} ${q.prompt.split(' ')[1]} ? ${b} ${q.prompt.split(' ')[1]}`);
      seen.add(q.answer);
    }
    expect([...seen].sort()).toEqual(['<', '=', '>']);
  });
});
