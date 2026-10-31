// #2317 (y6-areaperim): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y6-areaperim')!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('y6-areaperim whys (#2317)', () => {
  it('every card has a short why', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
    }
  });
  it('d1 why is the perimeter of the answer rectangle', () => {
    for (const q of draws(1)) {
      const m = /^2 × \((\d+) \+ (\d+)\) = (\d+) cm: the longest$/.exec(q.why!);
      expect(m, q.why).not.toBeNull();
      expect(2 * (Number(m![1]) + Number(m![2]))).toBe(Number(m![3]));
      expect([`${m![1]} × ${m![2]}`, `${m![2]} × ${m![1]}`]).toContain(q.answer);
    }
  });
  it('d2 whys give the answer or the biggest area', () => {
    let per = 0, area = 0;
    for (const q of draws(2)) {
      let m: RegExpExecArray | null;
      if ((m = /^2 × \((\d+) \+ (\d+)\) = (\d+) cm$/.exec(q.why!))) {
        per++;
        expect(2 * (Number(m[1]) + Number(m[2]))).toBe(Number(m[3]));
        expect(q.answer).toBe(m[3]);
      } else if ((m = /^(\d+) × (\d+) = (\d+) cm²: the biggest$/.exec(q.why!))) {
        area++;
        expect(Number(m[1]) * Number(m[2])).toBe(Number(m[3]));
        expect([`${m[1]} × ${m[2]}`, `${m[2]} × ${m[1]}`]).toContain(q.answer);
      } else expect.fail(q.why);
    }
    expect(per).toBeGreaterThan(0); expect(area).toBeGreaterThan(0);
  });
  it('d3 why: the sides add to half the perimeter and multiply to the area', () => {
    for (const q of draws(3)) {
      const m = /^(\d+) \+ (\d+) = (\d+) and (\d+) × (\d+) = (\d+), so (\d+)$/.exec(q.why!);
      expect(m, q.why).not.toBeNull();
      const [w, l, h, w2, l2, A, ans] = m!.slice(1).map(Number);
      expect(w + l).toBe(h); expect([w2, l2]).toEqual([w, l]); expect(w * l).toBe(A);
      expect(q.prompt).toBe(`Rectangle: area ${A} cm², perimeter ${2 * h} cm. Longer side = ? cm`);
      expect(String(ans)).toBe(q.answer); expect(ans).toBe(Math.max(w, l));
    }
  });
});
