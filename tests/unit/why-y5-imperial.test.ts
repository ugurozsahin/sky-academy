// #2317 (y5-imperial): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y5-imperial')!.gen(d, rngOf((s + 1) * 104729 + d)));
const n = (s: string) => Number(s.replace(/,/g, ''));

describe('y5-imperial whys (#2317)', () => {
  it('conversion whys state the table factor and do the sum to the answer', () => {
    let seen = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      const m = /^1 [a-z]+ ≈ ([\d,.]+) [a-z]+: ([\d,.]+) ([×÷]) \1 = ([\d,.]+)$/.exec(q.why!);
      if (!m) continue;
      seen++;
      const f = n(m[1]), from = n(m[2]);
      expect(m[3] === '×' ? from * f : from / f, q.why).toBeCloseTo(n(m[4]), 1);
      expect(m[4], q.why).toBe(q.answer);
      expect(q.prompt.startsWith(`${m[2]} `), q.prompt).toBe(true);
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('comparison whys convert the imperial amount and name the bigger one', () => {
    let seen = 0;
    for (const q of draws(3)) {
      const m = /^(\d+) (in|feet|foot|lb|pints?) is about ([\d,.]+) (cm|kg|ml), so (.+) is (longer|heavier|more)$/.exec(q.why!);
      if (!m) continue;
      seen++;
      expect(q.answer, q.why).toBe(m[5]);
      const exact = n(m[1]) * ({ in: 2.54, foot: 30.48, feet: 30.48, lb: 1 / 2.2046, pint: 568.26, pints: 568.26 } as Record<string, number>)[m[2]];
      expect(Math.abs(n(m[3]) - exact) / exact, q.why).toBeLessThan(0.1);
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('every question at every level has a why', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) expect(q.why, q.prompt).toBeTruthy();
  });
});
