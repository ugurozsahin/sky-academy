// #2317 (simplify family): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y6-simplify')!.gen(d, rngOf((s + 1) * 104729 + d)));
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const lcm = (a: number, b: number) => a / gcd(a, b) * b;
const val = (f: string) => { const m = /^(?:(\d+) )?(\d+)\/(\d+)$/.exec(f)!; return Number(m[1] ?? 0) + Number(m[2]) / Number(m[3]); };

describe('y6-simplify whys (#2317)', () => {
  it('d1 and d2 name the real multiplier, or the real smallest common denominator', () => {
    for (const q of [...draws(1), ...draws(2)]) {
      const m = /both ([×÷]) (\d+): (\d+)\/(\d+) = (\d+)\/(\d+)/.exec(q.why!);
      if (m) {
        const [k, n1, d1, n2, d2] = m.slice(2).map(Number);
        expect(m[1] === '×' ? [n1 * k, d1 * k] : [n1 / k, d1 / k], q.why).toEqual([n2, d2]);
        expect(q.answer, q.why).toMatch(new RegExp(`^${n2}(/${d2})?$`));
      } else {
        const c = /^(\d+) and (\d+) both go into (\d+)/.exec(q.why!)!;
        expect(c, q.why).toBeTruthy();
        expect(lcm(Number(c[1]), Number(c[2])), q.why).toBe(Number(c[3]));
        expect(q.answer).toBe(c[3]);
      }
    }
  });
  it('d3 lists all four fractions in rising order, and the answer sits at the right end', () => {
    for (const q of draws(3)) {
      const list = q.why!.replace('In order: ', '').split(' < ');
      expect(list, q.why).toHaveLength(4);
      const v = list.map(val);
      expect([...v].sort((a, b) => a - b), q.why).toEqual(v);
      expect(q.answer, q.why).toBe(q.prompt.includes('greatest') ? list[3] : list[0]);
    }
  });
});
