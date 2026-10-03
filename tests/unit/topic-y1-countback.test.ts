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

  it('leaves the one-more / one-less cards asking what they always did, at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9839 + d);
      let plain = 0;
      for (let i = 0; i < 400; i++) {
        const q = topic.gen(d, r);
        const m = q.prompt.match(/^One (more|less) than (\d+)\?$/);
        if (!m) continue;
        plain++;
        expect(+q.answer).toBe(+m[2] + (m[1] === 'more' ? 1 : -1));
      }
      expect(plain / 400, `d${d} plain share`).toBeGreaterThan(0.4);
      expect(plain / 400, `d${d} plain share`).toBeLessThan(0.6);
    }
  });

  it('offers four distinct bubbles and a spoken line that repeats the run', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9837 + d);
      for (let i = 0; i < 300; i++) {
        const q = topic.gen(d, r), m = run(q);
        if (!m) continue;
        expect(new Set(q.options).size).toBe(4);
        expect(q.say).toBe(`Count back: ${m[1]}, ${m[2]}, ${m[3]}. What comes next?`);
      }
    }
  });

  it('d3 starts at 10k, 10k+1 or 10k+2 about half the time (a third forced, plus the uniform ~30%); d1 and d2 stay at the uniform baseline', () => {
    const share = (d: Difficulty) => {
      const r = rng(9838 + d);
      let n = 0, edge = 0;
      while (n < 800) {
        const m = run(topic.gen(d, r));
        if (!m) continue;
        n++;
        if (+m[1] % 10 <= 2) edge++;
      }
      return edge / n;
    };
    // Mutation-checked: with the d3 branch removed the d3 share is ~0.30 and this fails.
    expect(share(3)).toBeGreaterThan(0.45);
    expect(share(1)).toBeLessThan(0.4);
    expect(share(2)).toBeLessThan(0.4);
  });
});
