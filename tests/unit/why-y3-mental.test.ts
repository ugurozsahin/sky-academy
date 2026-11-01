// #2317 (y3-mental): each why is a true, non-circular step about its own card, within 8 words.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { mentalWhy } from '../../src/curriculum/year3-mental';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);

describe('y3-mental whys (#2317)', () => {
  it('fixed cases read as a step a child can follow', () => {
    expect(mentalWhy(342, 5, true)).toBe('2 + 5 = 7, so 347');
    expect(mentalWhy(347, 5, true)).toBe('347 + 3 = 350, + 2');
    expect(mentalWhy(347, 4, false)).toBe('7 − 4 = 3, so 343');
    expect(mentalWhy(342, 5, false)).toBe('342 − 2 = 340, − 3');
    expect(mentalWhy(210, 5, true)).toBe('21 tens + 5 = 215');
    expect(mentalWhy(210, 7, false)).toBe('210 − 7 = 200 + 3');
    expect(mentalWhy(347, 40, true)).toBe('34 tens + 4 tens = 38 tens');
    expect(mentalWhy(310, 10, false)).toBe('31 tens − 1 ten = 30 tens');
    expect(mentalWhy(300, 100, true)).toBe('3 hundreds + 1 hundred = 4 hundreds');
    expect(mentalWhy(250, 100, false)).toBe('2 hundreds − 1 hundred = 1 hundred');
  });
  it('every generated why is short, true and never restates', () => {
    const t = TOPICS.find(x => x.id === 'y3-mental')!;
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d));
      const [a, b] = nums(q.prompt), add = q.prompt.includes('+'), ans = Number(q.answer);
      expect(ans).toBe(add ? a + b : a - b);
      shape(q.why!);
      if (b >= 10) bigStep(q.why!, a, b, add, ans); else onesStep(q.why!, a, b, add, ans);
    }
  });
});

function shape(w: string) {
  expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
  expect(w).not.toMatch(/\b1 (tens|hundreds)\b|\+ 0\b|− 0\b/);
  const sides = w.split(' = ');
  expect(sides[0], w).not.toBe(sides[1]);
}
/** Tens and hundreds: the counts add or subtract, and rebuild the answer. */
function bigStep(w: string, a: number, b: number, add: boolean, ans: number) {
  const m = nums(w), unit = /hundred/.test(w) ? 100 : 10, sign = add ? 1 : -1;
  expect(m[0] + sign * m[1]).toBe(m[2]);
  expect(m[2] * unit + (a % unit)).toBe(ans);
  expect(m[1] * unit).toBe(b);
}
/** Ones: within the ten, across it, or from a ten-number. */
function onesStep(w: string, a: number, b: number, add: boolean, ans: number) {
  const m = nums(w);
  if (/^\d+ tens? \+ \d+ = \d+$/.test(w)) { expect([m[0] * 10, m[1], m[2]]).toEqual([a, b, ans]); return; }
  if (/, so \d+$/.test(w)) { expect([m[0], m[1], m[3]]).toEqual([a % 10, b, ans]); expect(m[2]).toBe(add ? m[0] + b : m[0] - b); return; }
  if (/^\d+ [+−] \d+ = \d+, [+−] \d+$/.test(w)) { expect(m[0]).toBe(a); expect(add ? m[0] + m[1] : m[0] - m[1]).toBe(m[2]); expect(add ? m[2] + m[3] : m[2] - m[3]).toBe(ans); return; }
  expect(w).toMatch(/^\d+ − \d+ = \d+ \+ \d+$/);
  expect([m[0], m[1], m[2] + m[3]]).toEqual([a, b, ans]);
}
