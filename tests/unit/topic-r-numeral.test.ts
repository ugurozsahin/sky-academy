import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'r-numeral')!;
const DRAWS = 150;
const dots = (s: string) => [...s].length;

/** #973: numeral on the card, the child slices the group of dots that matches it. */
describe('r-numeral (#973)', () => {
  it('the answer holds exactly as many dots as the numeral on the card, and every bubble is all dots, at most 5', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9730 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const v = q.visual as { type: 'word'; text: string };
        expect(v.type).toBe('word');
        expect(dots(q.answer), `d${d} draw ${i}`).toBe(Number(v.text));
        for (const o of q.options) { expect(o).toMatch(/^●+$/); expect(dots(o)).toBeLessThanOrEqual(5); }
        expect(new Set(q.options).size).toBe(q.options.length);
      }
    }
  });
  it('speaks the instruction only, never the number', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9740 + d);
      for (let i = 0; i < DRAWS; i++) {
        const say = topic.gen(d, r).say ?? '';
        expect(say).not.toMatch(/\d|\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
      }
    }
  });
  it('follows the ladder: d1 numerals 1–4 with 3 bubbles, d2 1–5 with 3, d3 1–5 with 4 including n−1 and n+1', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9750 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const n = dots(q.answer);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(d === 1 ? 4 : 5);
        expect(q.options.length).toBe(d === 3 ? 4 : 3);
        if (d === 3) {
          const counts = q.options.map(dots);
          for (const k of [n - 1, n + 1]) if (k >= 1 && k <= 5) expect(counts, `n=${n}`).toContain(k);
        }
      }
    }
  });
});
