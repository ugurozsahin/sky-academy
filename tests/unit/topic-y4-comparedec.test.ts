import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-comparedec')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1148 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const dpOf = (s: string) => (s.split('.')[1] ?? '').length;
/** Scaled integer from a label, read from the digits (no float). */
const scaled = (s: string, dp: number) => Number(s.replace('.', '')) * 10 ** (dp - dpOf(s));

describe('y4-comparedec (#1148)', () => {
  it('is registered for Year 4 with sequences from d3', () => { expect(topic.year).toBe('year4'); expect(topic.sequenceFrom).toBe(3); });

  it('d1: the answer is the tenths rounded up from .5, and every decoy is a real slip', () => {
    const seen = new Set<string>();
    for (const q of draw(1, 400)) {
      const m = q.prompt.match(/^(\d+)\.(\d) to the nearest whole number\?$/)!;
      const t = Number(m[1]) * 10 + Number(m[2]);
      expect(t).toBeGreaterThanOrEqual(1); expect(t).toBeLessThanOrEqual(194);
      expect(q.answer).toBe(String(Math.floor((t + 5) / 10)));
      expect(Number(q.answer)).toBeLessThan(20);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4);
      if (m[2] === '5') seen.add(q.answer);
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it('d2: the sign is right by exact value; same places and whole part; ≥1 in 3 swapped-digit pairs; some equal', () => {
    let swapped = 0, eq = 0, two = 0; const qs = draw(2, 600);
    for (const q of qs) {
      const [a, b] = q.prompt.split(' ? ');
      expect(dpOf(a)).toBe(dpOf(b)); expect(dpOf(a)).toBeGreaterThanOrEqual(1); expect(dpOf(a)).toBeLessThanOrEqual(2);
      expect(a.split('.')[0]).toBe(b.split('.')[0]);
      const x = scaled(a, 2), y = scaled(b, 2);
      expect(q.answer).toBe(x < y ? '<' : x > y ? '>' : '=');
      expect([...q.options].sort()).toEqual(['<', '=', '>']);
      if (x === y) eq++;
      if (dpOf(a) === 2) { two++; const fa = a.split('.')[1], fb = b.split('.')[1]; if (fa === fb.split('').reverse().join('') && fa !== fb) swapped++; }
    }
    expect(eq).toBeGreaterThan(0);
    expect(swapped / two).toBeGreaterThanOrEqual(1 / 3);
  });

  it('d3: four different numbers with the same places, ascending, answer is the sequence joined by spaces', () => {
    for (const q of draw(3, 400)) {
      const seq = q.sequence!;
      expect(seq).toHaveLength(4); expect(q.answer).toBe(seq.join(' '));
      const dp = dpOf(seq[0]); seq.forEach(s => expect(dpOf(s)).toBe(dp));
      const v = seq.map(s => scaled(s, 2));
      expect(new Set(v).size).toBe(4);
      expect(v).toEqual([...v].sort((a, b) => a - b));
      expect([...q.options].sort()).toEqual([...seq].sort());
      expect(seq[0].split('.')[0]).toBe(seq[3].split('.')[0]);
    }
  });
});
