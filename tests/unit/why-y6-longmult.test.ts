// #2317 (y6-longmult): each why splits the multiplication into true partial products that add up to the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const nums = (s: string) => (s.match(/\d[\d,]*/g) ?? []).map(x => Number(x.replace(/,/g, '')));
const t = TOPICS.find(x => x.id === 'y6-longmult')!;

describe('y6-longmult whys (#2317)', () => {
  it('every card has a short why whose partial products are true and sum to the answer', () => {
    const seen = { split: 0, lead: 0 };
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(14);
      const [a, b] = nums(q.prompt), ans = nums(q.answer)[0], m = nums(w);
      if (/then ×/.test(w)) {
        seen.lead++;
        expect(m[1]).toBe(b); expect(m[0] * m[1], w).toBe(m[2]); expect(m[2] * m[3], w).toBe(ans); expect(m[0] * m[3], w).toBe(a);
      } else {
        seen.split++;
        const [x1, y1, p1, x2, y2, p2] = m;
        expect(x1 * y1, w).toBe(p1); expect(x2 * y2, w).toBe(p2);
        expect(p1 + p2, w).toBe(ans);
        b >= 10 ? (expect(x1).toBe(a), expect(x2).toBe(a), expect(y1 + y2).toBe(b)) : (expect(x1 + x2).toBe(a), expect(y1).toBe(b), expect(y2).toBe(b));
      }
    }
    expect(seen.split).toBeGreaterThan(0);
  });
});
