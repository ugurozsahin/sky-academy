// #2317 (y6-area): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y6-area')!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('y6-area whys (#2317)', () => {
  it('every card has a short why', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
    }
  });
  it('an area why computes the answer from the base and height', () => {
    let tri = 0, par = 0;
    for (const d of [1, 2] as Difficulty[]) for (const q of draws(d)) {
      const t = /^(\d+) × (\d+) ÷ 2 = (\d+) cm²$/.exec(q.why!);
      const p = /^(\d+) × (\d+) = (\d+) cm²$/.exec(q.why!);
      const m = t ?? p;
      expect(m, q.why).not.toBeNull();
      t ? tri++ : par++;
      expect(Number(m![1]) * Number(m![2]) / (t ? 2 : 1)).toBe(Number(m![3]));
      expect(q.answer).toBe(m![3]);
      expect(q.prompt).toBe(t ? 'Triangle area = ? cm²' : 'Parallelogram area = ? cm²');
    }
    expect(tri).toBeGreaterThan(0); expect(par).toBeGreaterThan(0);
  });
  it('a reasoning why matches the numbers in its prompt and the answer', () => {
    let h = 0, diff = 0, base = 0;
    for (const q of draws(3)) {
      let m: RegExpExecArray | null;
      if ((m = /^(\d+) × 2 ÷ (\d+) = (\d+) cm$/.exec(q.why!))) {
        h++;
        expect(q.prompt).toBe(`Triangle area ${m[1]} cm², base ${m[2]} cm. Height = ? cm`);
        expect(Number(m[1]) * 2 / Number(m[2])).toBe(Number(m[3]));
        expect(q.answer).toBe(m[3]);
      } else if ((m = /^(\d+) − (\d+) = (\d+) cm²$/.exec(q.why!))) {
        diff++;
        expect(Number(m[1]) - Number(m[2])).toBe(Number(m[3]));
        expect(Number(m[1])).toBe(2 * Number(m[2]));
        expect(q.answer).toBe(m[3]);
      } else {
        m = /^(\d+) ÷ (\d+) = (\d+) cm$/.exec(q.why!);
        expect(m, q.why).not.toBeNull();
        base++;
        expect(q.prompt).toBe(`Parallelogram area ${m![1]} cm², height ${m![2]} cm. Base = ? cm`);
        expect(Number(m![1]) / Number(m![2])).toBe(Number(m![3]));
        expect(q.answer).toBe(m![3]);
      }
    }
    expect(h).toBeGreaterThan(0); expect(diff).toBeGreaterThan(0); expect(base).toBeGreaterThan(0);
  });
});
