// #2317 (y2-add, y2-sub): each why is a true equation about its own card, within 8 words.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === id)!.gen(d, rngOf((s + 1) * 104729 + d)));
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);

describe('y2-add and y2-sub whys (#2317)', () => {
  it('an addition why splits the tens and the ones and both sums are right', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws('y2-add', d)) {
      const [a, b] = nums(q.prompt);
      const m = /^(\d+) \+ (\d+) = (\d+) \+ (\d+)$/.exec(q.why!);
      expect(m, q.why).not.toBeNull();
      expect([+m![1], +m![2]]).toEqual([a, b]);
      expect(+m![3] + +m![4], q.why).toBe(a + b);
      expect(+m![3] % 10).toBe(0);
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(8);
    }
  });
  it('every subtraction why is a true step to the answer, within 8 words', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws('y2-sub', d)) {
      const [a, b] = nums(q.prompt);
      const ans = a - b, w = q.why!;
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      let m: RegExpExecArray | null;
      if ((m = /^(\d+) − (\d+) = (\d+), so (\d+)$/.exec(w))) { expect([+m[2], +m[3] + +m[2], +m[4]]).toEqual([b, +m[1], ans]); expect(+m[1]).toBe(a % 10); }
      else if ((m = /^(\d+) − (\d+) = (\d+) − (\d+)$/.exec(w))) { expect([+m[1], +m[2]]).toEqual([a, b]); expect(+m[3] - +m[4]).toBe(ans); }
      else if ((m = /^(\d+) − (\d+) = (\d+) \+ (\d+)$/.exec(w))) { expect([+m[1], +m[2]]).toEqual([a, b]); expect(+m[3] + +m[4]).toBe(ans); }
      else if ((m = /^(\d+) − (\d+) = (\d+), plus (\d+)$/.exec(w))) { expect(+m[3] + +m[4]).toBe(ans); expect(+m[1] - +m[2]).toBe(+m[3]); expect(+m[4]).toBe(a % 10); }
      else { m = /^(\d+) − (\d+) = (\d+)$/.exec(w); expect(m, w).not.toBeNull(); expect([+m![1], +m![2], +m![3]]).toEqual([a, b, ans]); }
    }
  });
});
