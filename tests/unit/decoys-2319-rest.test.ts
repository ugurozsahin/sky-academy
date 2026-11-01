import { describe, expect, it } from 'vitest';
import { y2Estimate } from '../../src/curriculum/year2-estimate';
import { y4Mental } from '../../src/curriculum/year4-mental';
import { y5Factors } from '../../src/curriculum/year5-factors';
import { y6Mental } from '../../src/curriculum/year6-mental';
import { y6Sequences } from '../../src/curriculum/year6-sequences';
import type { Difficulty, Question } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const n = (s: string) => Number(s.replace(/,/g, '').replace('−', '-'));
const SEEDS = 250;
const each = (gen: (d: Difficulty, r: () => number) => Question, f: (q: Question, d: Difficulty) => void) => {
  for (const d of [1, 2, 3] as Difficulty[]) for (let s = 1; s <= SEEDS; s++) f(gen(d, rngOf(s * 7 + d)), d);
};
const wrong = (q: Question) => q.options!.filter(o => o !== q.answer);

describe('the last five #2319 games keep their decoy rule (200+ seeds per difficulty)', () => {
  it('y2-estimate: no decoy sits next to the answer or to another decoy on the line', () => {
    each(y2Estimate, (q, d) => {
      const unit = d === 1 ? 1 : 10, gap = (d === 3 ? 2 : 3) * unit, vals = q.options!.map(n);
      expect(new Set(vals).size).toBe(vals.length);
      for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++) expect(Math.abs(vals[i] - vals[j]), q.options!.join()).toBeGreaterThanOrEqual(gap);
    });
  });

  it('y4-mental: d1 × 0 is 0; d2 and d3 offer a place-value shift; d3 offers a two-factor product', () => {
    each(y4Mental, (q, d) => {
      const ans = n(q.answer), ws = wrong(q).map(n);
      expect(ws.every(v => Number.isInteger(v) && v >= 0 && v !== ans), q.prompt).toBe(true);
      if (d === 1 && / × 0|^0 × /.test(q.prompt)) expect(q.answer).toBe('0');
      if (d >= 2) expect(ws.some(v => v === ans * 10 || v === ans / 10), q.prompt).toBe(true);
      if (d === 3) {
        const f = q.prompt.replace(' = ?', '').split(' × ').map(n);
        const twos = [f[0] * f[1], f[0] * f[2], f[1] * f[2]];
        expect(ws.some(v => twos.includes(v)), q.prompt).toBe(true);
      }
    });
  });

  it('y5-factors: d1 decoys are positive and never the answer; d3 offers a factor of only one number', () => {
    each(y5Factors, (q, d) => {
      if (d === 1) {
        const ws = wrong(q).map(n);
        expect(ws.every(v => v > 0), q.prompt).toBe(true);
        expect(ws).not.toContain(n(q.answer));
      }
      if (d === 3) {
        const [a, b] = /common factor of (\d+) and (\d+)/.exec(q.prompt)!.slice(1).map(Number);
        const targets = new Set(q.sequence!);
        const decoys = q.options!.filter(o => !targets.has(o)).map(Number);
        expect(decoys.some(v => (a % v === 0) !== (b % v === 0)), q.prompt).toBe(true);
      }
    });
  });

  it('y6-mental: a place-value shift is among the decoys whenever one is a valid answer', () => {
    each(y6Mental, q => {
      const ans = n(q.answer), ws = wrong(q).map(n);
      const shifts = [ans * 10, ans / 10].filter(v => Number.isInteger(v) && v >= 1 && v <= 10_000_000);
      if (shifts.length) expect(ws.some(v => shifts.includes(v)), q.prompt).toBe(true);
      expect(ws).not.toContain(ans);
    });
  });

  it('y6-sequences: decoys are distinct from the answer, and d3 has exactly one rule that fits every pair', () => {
    each(y6Sequences, (q, d) => {
      expect(new Set(q.options).size).toBe(q.options!.length);
      expect(q.options).toContain(q.answer);
      if (d === 3) {
        const t = (/makes (.+)\?/.exec(q.prompt)![1]).split(', ').map(n);
        const fits = (r: string) => { const [op, k] = r.split(' '), v = n(k); return t.slice(1).every((x, i) => op === '+' ? x - t[i] === v : op === '−' ? t[i] - x === v : x === t[i] * v); };
        expect(q.options!.filter(fits), q.prompt).toEqual([q.answer]);
      }
    });
  });
});
