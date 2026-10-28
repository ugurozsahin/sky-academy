// #2317 (y6-fdp): each why shows the division, or runs the conversion through "out of a hundred".
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y6-fdp')!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('y6-fdp whys (#2317)', () => {
  it('difficulty 1: the division and its fraction say the same thing', () => {
    for (const q of draws(1)) {
      const w = /^(\d+) ÷ (\d+) is (\d+)\/(\d+)$|^(\d+)\/(\d+) means (\d+) ÷ (\d+)$/.exec(q.why!);
      expect(w, q.why).toBeTruthy();
      const [n, d] = w![1] ? [w![1], w![2]] : [w![7], w![8]];
      expect(q.answer).toBe(w![1] ? `${n}/${d}` : `${n} ÷ ${d}`);
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
  it('difficulty 2: the hundredths step is arithmetically right and the why ends on the answer', () => {
    let seen = 0;
    for (const q of draws(2)) {
      expect(q.why!.endsWith(q.answer), q.why).toBe(true);
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
      const h = /(\d+)\/100/.exec(q.why!);
      expect(h, q.why).toBeTruthy();
      seen++;
      const p = Number(h![1]);
      const val = (s: string) => s.endsWith('%') ? Number(s.slice(0, -1)) / 100 : s.includes('/') ? Number(s.split('/')[0]) / Number(s.split('/')[1]) : Number(s);
      expect(val(q.answer), q.why).toBeCloseTo(p / 100, 9);
    }
    expect(seen).toBe(200);
  });
  it('difficulty 3: shows the division and its rounded decimal', () => {
    for (const q of draws(3)) {
      const w = /^(\d+) ÷ (\d+)(?: =| is) (\S+)(?: to 3 places)?$/.exec(q.why!);
      expect(w, q.why).toBeTruthy();
      expect(w![3]).toBe(q.answer);
      expect(Math.abs(Number(w![1]) / Number(w![2]) - Number(q.answer))).toBeLessThan(0.0006);
    }
  });
});
