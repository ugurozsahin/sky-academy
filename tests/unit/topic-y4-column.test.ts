import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';
import { carries, borrows } from '../../src/curriculum/year4-column';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-column')!;
const num = (s: string) => parseNum(s)!.v;
const draw = (d: Difficulty, n: number, seed = 1136) => { const r = rng(seed * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
// Bubbles launched: one per slot plus the decoys (a repeated digit launches again, #481).
const launched = (q: { sequence?: string[]; options: string[] }) => q.sequence!.length + q.options.length - new Set(q.sequence).size;
const CALC = /^([\d,]+) ([+−]) ([\d,]+) = \?$/;
const CHECK = /^([\d,]+) ([+−]) ([\d,]+) = ([\d,]+)\. Check: ([\d,]+) ([+−]) ([\d,]+) = \?$/;

describe('y4-column (#1136)', () => {
  it('is registered for Year 4 and flags its sequence draws from d1', () => {
    expect(topic.year).toBe('year4'); expect(topic.sequenceFrom).toBe(1);
  });

  it.each([[1, 0], [2, 1]] as const)('d%i build cards: oracle, %i exchange(s), 4 slots, 6 bubbles launched', (d, ex) => {
    for (const q of draw(d, 300)) {
      const m = q.prompt.match(CALC)!;
      const a = num(m[1]), b = num(m[3]), r = m[2] === '+' ? a + b : a - b;
      expect(num(q.answer)).toBe(r);
      expect(r).toBeGreaterThanOrEqual(1000); expect(r).toBeLessThanOrEqual(9999);
      expect(m[2] === '+' ? carries(a, b) : borrows(a, b)).toBe(ex);
      expect(q.build!.template).toBe('_,___');
      expect(q.sequence).toEqual(q.answer.replace(',', '').split(''));
      expect(launched(q)).toBe(6);
    }
  });

  it('d3: build cards have two exchanges; check cards answer with the first number', () => {
    let builds = 0, checks = 0;
    for (const q of draw(3, 400)) {
      const c = q.prompt.match(CHECK);
      if (!c) {
        builds++;
        const m = q.prompt.match(CALC)!, a = num(m[1]), b = num(m[3]);
        expect(m[2] === '+' ? carries(a, b) : borrows(a, b)).toBe(2);
        expect(num(q.answer)).toBe(m[2] === '+' ? a + b : a - b);
        expect(launched(q)).toBe(6);
        continue;
      }
      checks++;
      const a = num(c[1]), b = num(c[3]), r = num(c[4]);
      expect(r).toBe(c[2] === '+' ? a + b : a - b);
      expect(c[6]).toBe(c[2] === '+' ? '−' : '+');
      expect(num(c[5])).toBe(r); expect(num(c[7])).toBe(b);
      expect(num(q.answer)).toBe(a);
      expect(q.sequence).toBeUndefined();
      expect(q.options).toHaveLength(4);
      const wrong = q.options.filter(o => o !== q.answer).map(num);
      expect(wrong).toContain(c[2] === '+' ? r + b : Math.abs(r - b));
      expect(wrong.some(w => Math.abs(w - a) === 100 || Math.abs(w - a) === 10)).toBe(true);
    }
    expect(builds).toBeGreaterThan(100); expect(checks).toBeGreaterThan(100);
  });

  it('check cards do not leak the answer by a unique units or leading digit', () => {
    const cards = draw(3, 4000, 7).filter(q => CHECK.test(q.prompt)).slice(0, 2000);
    expect(cards.length).toBeGreaterThan(900);
    const unique = (q: typeof cards[0], pick: (s: string) => string) => q.options.filter(o => pick(o) === pick(q.answer)).length === 1;
    expect(cards.filter(q => unique(q, s => s.slice(-1))).length / cards.length).toBeLessThanOrEqual(0.3);
    expect(cards.filter(q => unique(q, s => s[0])).length / cards.length).toBeLessThanOrEqual(0.3);
  });
});
