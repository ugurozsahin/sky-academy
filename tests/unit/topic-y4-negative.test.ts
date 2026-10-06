import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-negative')!;
const num = (s: string) => parseNum(s)!.v;
const draw = (d: Difficulty, n: number, seed = 1132) => { const r = rng(seed * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

describe('y4-negative (#1132)', () => {
  it('is registered for Year 4', () => { expect(topic.year).toBe('year4'); });

  it('d1: the line holds 0 and two negatives, and the answer is the hidden tick', () => {
    for (const q of draw(1, 300)) {
      const v = q.visual as Extract<NonNullable<typeof q.visual>, { type: 'numberline' }>;
      expect(v.type).toBe('numberline');
      expect(v.from).toBeLessThanOrEqual(-2); expect(v.to).toBeGreaterThanOrEqual(0);
      expect(v.labels).toHaveLength(v.to - v.from + 1);
      expect(num(q.answer)).toBe(v.mark);
      expect(num(q.answer)).toBeGreaterThanOrEqual(-5); expect(num(q.answer)).toBeLessThanOrEqual(5);
    }
  });

  it('d2: the oracle recomputes the answer from the shown terms, which cross 0 to a negative', () => {
    for (const q of draw(2, 300)) {
      const m = q.prompt.match(/^Count back in (\d+)s: (.+), \?$/)!;
      const terms = m[2].split(', ').map(num), step = Number(m[1]);
      expect(terms[0]).toBeGreaterThan(0); expect(terms).toContain(0);
      terms.forEach((t, i) => expect(t).toBe(terms[0] - i * step));
      expect(num(q.answer)).toBe(terms[0] - terms.length * step);
      expect(num(q.answer)).toBeLessThan(0);
    }
  });

  it('d3: the story and the missing-term cards both land on the oracle answer', () => {
    let stories = 0, gaps = 0;
    for (const q of draw(3, 400)) {
      const s = q.prompt.match(/^Start at (\d+)\. Count back (\d+) in (\d+)s\./);
      if (s) { stories++; expect(num(q.answer)).toBe(Number(s[1]) - Number(s[2]) * Number(s[3])); expect(num(q.answer)).toBeLessThan(0); continue; }
      gaps++;
      const terms = q.prompt.split(', '), g = terms.indexOf('?'), known = terms.map((t, i) => i === g ? NaN : num(t));
      const step = (known[0] - known[g - 1]) / (g - 1);
      known.forEach((v, i) => { if (i !== g) expect(v).toBe(known[0] - i * step); });
      expect(known[0]).toBeGreaterThan(0);
      expect(num(q.answer)).toBe(known[0] - g * step);
      expect(num(q.answer)).toBeLessThan(0);
    }
    expect(stories).toBeGreaterThan(50); expect(gaps).toBeGreaterThan(50);
  });

  it('every option is ≥ −50, no ASCII hyphen anywhere, and the sign-flip decoy is on every non-zero card', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 400)) {
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.options).toContain(q.answer);
      for (const o of q.options) { if (num(o) < 0) expect(o.startsWith('−')).toBe(true); expect(num(o)).toBeGreaterThanOrEqual(-50); expect(o).not.toContain('-'); }
      const text = q.prompt + (q.visual && 'labels' in q.visual ? (q.visual.labels ?? []).join() : '');
      expect(text).not.toContain('-');
      if (num(q.answer) !== 0) expect(q.options.map(num)).toContain(-num(q.answer));
    }
  });

  it('say reads a negative as "negative", never "minus"', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 200)) {
      expect(q.say).not.toMatch(/minus|−|-/);
      if (d === 3 && !q.prompt.startsWith('Start') && q.prompt.includes('−')) expect(q.say).toContain('negative');
    }
  });

  it('leaks: at most 30% of cards have a units digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const qs = draw(d, 2000, 7);
      const leaks = qs.filter(q => {
        const digit = (s: string) => Math.abs(num(s)) % 10;
        return !q.options.filter(o => o !== q.answer).some(o => digit(o) === digit(q.answer));
      }).length;
      expect(leaks / qs.length, `d${d}`).toBeLessThanOrEqual(0.3);
    }
  });
});
