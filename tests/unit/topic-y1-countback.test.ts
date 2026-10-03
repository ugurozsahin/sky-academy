import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

// Deterministic RNG (mulberry32), same construction `curriculum.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y1-moreless')!;
const run = (q: { prompt: string }) => q.prompt.match(/^Count back: (\d+), (\d+), (\d+), \?$/);

/** #983: Year 1 counts "backwards … from any given number"; y1-moreless gains a count-back form. */
describe('y1-moreless count back (#983)', () => {
  it('shows a run that falls by 1, answers the next term, and keeps every option in 0-100 with four bubbles', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9830 + d);
      let seen = 0;
      for (let i = 0; i < 300; i++) {
        const q = topic.gen(d, r), m = run(q);
        if (!m) continue;
        seen++;
        const [a, b, c] = [+m[1], +m[2], +m[3]];
        expect(b).toBe(a - 1); expect(c).toBe(b - 1); expect(+q.answer).toBe(c - 1);
        expect(a).toBeLessThanOrEqual(d === 1 ? 30 : d === 2 ? 60 : 100);
        expect(q.options).toHaveLength(4);
        expect(q.options).toContain(q.answer);
        for (const o of q.options) { expect(+o).toBeGreaterThanOrEqual(0); expect(+o).toBeLessThanOrEqual(100); }
      }
      expect(seen).toBeGreaterThan(100);
    }
  });

  it('leaves the one-more / one-less cards asking what they always did', () => {
    const r = rng(9839);
    let plain = 0;
    for (let i = 0; i < 300; i++) {
      const q = topic.gen(3, r);
      const m = q.prompt.match(/^One (more|less) than (\d+)\?$/);
      if (!m) continue;
      plain++;
      expect(+q.answer).toBe(+m[2] + (m[1] === 'more' ? 1 : -1));
    }
    expect(plain).toBeGreaterThan(100);
  });

  it('at d3 at least a quarter of count-back cards cross a tens boundary', () => {
    const r = rng(9838);
    let n = 0, crossing = 0;
    while (n < 300) {
      const m = run(topic.gen(3, r));
      if (!m) continue;
      n++;
      if (Math.floor(+m[1] / 10) !== Math.floor((+m[3] - 1) / 10)) crossing++;
    }
    expect(crossing / n).toBeGreaterThanOrEqual(0.25);
  });
});
