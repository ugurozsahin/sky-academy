// #2317 (y2-add, y2-sub): each why is a true, non-circular step about its own card, within 8 words.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { addWhy, subWhy } from '../../src/curriculum/year2/number';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === id)!.gen(d, rngOf((s + 1) * 104729 + d)));
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
const noEmpty = (w: string) => {
  const sides = w.split(' = ');
  expect(sides[0], w).not.toBe(sides[1]);           // never "40 + 5 = 40 + 5"
  expect(w, w).not.toMatch(/\+ 0$|− 0$|= 0 \+|\b1 tens\b/);           // never a dangling zero
};

describe('y2-add and y2-sub whys (#2317)', () => {
  it('fixed cases read as a step a child can follow', () => {
    expect(addWhy(47, 35)).toBe('47 + 35 = 70 + 12');
    expect(addWhy(40, 5)).toBe('4 tens + 5 = 45');
    expect(addWhy(40, 30)).toBe('4 + 3 = 7 tens');
    expect(addWhy(47, 30)).toBe('47 + 30 = 70 + 7');
    expect(subWhy(30, 4)).toBe('30 − 4 = 20 + 6');
    expect(subWhy(52, 7)).toBe('52 − 7 = 50 − 5');
    expect(subWhy(57, 4)).toBe('7 − 4 = 3, so 53');
    expect(subWhy(30, 20)).toBe('3 − 2 = 1 ten');
    expect(subWhy(10, 4)).toBe('10 = 6 + 4');
    expect(addWhy(10, 5)).toBe('1 ten + 5 = 15');
    expect(subWhy(50, 20)).toBe('5 − 2 = 3 tens');
    expect(subWhy(47, 20)).toBe('40 − 20 = 20, plus 7');
    expect(subWhy(73, 28)).toBe('73 − 20 = 53, − 8');
    expect(subWhy(83, 27)).toBe('83 − 20 = 63, − 7');
  });
  it('an addition why is true and never restates or ends in zero', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws('y2-add', d)) {
      const [a, b] = nums(q.prompt), w = q.why!;
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      noEmpty(w);
      let m: RegExpExecArray | null;
      if ((m = /^(\d+) \+ (\d+) = (\d+) tens?$/.exec(w))) expect([+m[1] * 10 + +m[2] * 10, +m[3] * 10]).toEqual([a + b, a + b]);
      else if ((m = /^(\d+) tens? \+ (\d+) = (\d+)$/.exec(w))) { expect(+m[1] * 10).toBe(a); expect(+m[2]).toBe(b); expect(+m[3]).toBe(a + b); }
      else { m = /^(\d+) \+ (\d+) = (\d+) \+ (\d+)$/.exec(w); expect(m, w).not.toBeNull(); expect([+m![1], +m![2]]).toEqual([a, b]); expect(+m![3] + +m![4]).toBe(a + b); expect(+m![3] % 10).toBe(0); }
    }
  });
  it('a subtraction why is true, derivable from the card, and never restates', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws('y2-sub', d)) {
      const [a, b] = nums(q.prompt), ans = a - b, w = q.why!;
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      noEmpty(w);
      let m: RegExpExecArray | null;
      if ((m = /^(\d+) − (\d+) = (\d+), so (\d+)$/.exec(w))) { expect([+m[2], +m[3] + +m[2], +m[4]]).toEqual([b, +m[1], ans]); expect(+m[1]).toBe(a % 10); }
      else if ((m = /^(\d+) − (\d+) = (\d+) − (\d+)$/.exec(w))) { expect([+m[1], +m[2]]).toEqual([a, b]); expect(+m[3] - +m[4]).toBe(ans); }
      else if ((m = /^(\d+) − (\d+) = (\d+) \+ (\d+)$/.exec(w))) { expect([+m[1], +m[2]]).toEqual([a, b]); expect(+m[3] + +m[4]).toBe(ans); }
      else if ((m = /^(\d+) − (\d+) = (\d+), plus (\d+)$/.exec(w))) { expect(+m[1] + +m[4]).toBe(a); expect(+m[2]).toBe(b); expect(+m[3] + +m[4]).toBe(ans); }
      else if ((m = /^(\d+) − (\d+) = (\d+), − (\d+)$/.exec(w))) { expect(+m[1]).toBe(a); expect(+m[1] - +m[2]).toBe(+m[3]); expect(+m[2] + +m[4]).toBe(b); expect(+m[3] - +m[4]).toBe(ans); }
      else if ((m = /^10 = (\d+) \+ (\d+)$/.exec(w))) { expect(a).toBe(10); expect([+m[1], +m[2]]).toEqual([ans, b]); }
      else { m = /^(\d+) − (\d+) = (\d+) tens?$/.exec(w); expect(m, w).not.toBeNull(); expect([+m![1] * 10, +m![2] * 10, +m![3] * 10]).toEqual([a, b, ans]); }
    }
  });
});
