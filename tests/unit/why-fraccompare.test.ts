// #2317 (comparing fractions): each why names the rule the pair or set rests on and agrees with the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === id)!.gen(d, rngOf((s + 1) * 104729 + d)));
const val = (f: string) => { const [n, d] = f.split('/').map(Number); return n / d; };

describe('y3-fraccompare whys (#2317)', () => {
  it('sign cards name the rule and the relation matches the answer', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draws('y3-fraccompare', d)) {
      const [a, b] = q.prompt.split(' ? ');
      const rel = val(a) < val(b) ? 'less than' : val(a) > val(b) ? 'more than' : 'same amount';
      expect(q.answer, q.prompt).toBe(val(a) < val(b) ? '<' : val(a) > val(b) ? '>' : '=');
      expect(q.why, q.prompt).toContain(rel);
      expect(q.why, q.prompt).toMatch(/^(Same bottom|Bigger bottom|\d+\/\d+ and)/);
    }
  });
  it('order cards state the rule', () => {
    for (const q of draws('y3-fraccompare', 3)) expect(q.why, q.prompt).toMatch(/^(Same bottom, so order the tops: \d+(, \d+){2}|Bigger bottom means smaller pieces: (\d+\/\d+)(, \d+\/\d+){2})$/);
  });
});

describe('y5-fraccompare whys (#2317)', () => {
  it('pairs say which of top or bottom decides, and the answer has it', () => {
    for (const q of draws('y5-fraccompare', 1)) {
      const [x, y] = q.options!.map(o => o.split('/').map(Number));
      const big = q.prompt.includes('larger');
      if (x[1] === y[1]) expect(q.why, q.prompt).toBe(`Same bottom: ${q.answer} has the ${big ? 'bigger' : 'smaller'} top`);
      else { expect(x[0], q.prompt).toBe(y[0]); expect(q.why, q.prompt).toBe(`Same top: ${q.answer} has the ${big ? 'smaller' : 'bigger'} bottom`); }
    }
  });
  it('crowds and orders list the tops over one common bottom, in order', () => {
    for (const d of [2, 3] as Difficulty[]) for (const q of draws('y5-fraccompare', d)) {
      const m = /^Over (\d+)(?:, smallest to largest)?: ([\d, ]+?)(?:; (biggest|smallest) is (\S+))?$/.exec(q.why!);
      expect(m, q.why).not.toBeNull();
      const L = Number(m![1]), tops = m![2].split(', ').map(Number);
      expect([...tops].sort((p, r) => p - r), q.why).toEqual(tops);
      const mine = (d === 3 ? q.options! : q.options!).map(o => { const [n, dd] = o.split('/').map(Number); return n * (L / dd); }).sort((p, r) => p - r);
      expect(mine, q.why).toEqual(tops);
      if (d === 2) expect(m![4], q.why).toBe(q.answer);
    }
  });
});
