// #2317 (ratio and percentage family): each y6-ratio / y6-percentof why restates the sum its own answer comes from.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === id)!.gen(d, rngOf((s + 1) * 104729 + d)));
const num = (s: string) => Number(s.replace(/,/g, ''));

describe('y6-ratio whys (#2317)', () => {
  it('"for every" multiplies the groups found by the other part', () => {
    for (const q of draws('y6-ratio', 1)) {
      const m = /^(\d+) is (\d+) groups of (\d+), and (\d+) × (\d+) = (\d+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      expect(num(m[1]) / num(m[3]), q.why).toBe(num(m[2]));
      expect(num(m[2]) * num(m[5]), q.why).toBe(num(m[6]));
      expect(m[6], q.why).toBe(q.answer);
    }
  });
  it('sharing names the parts, the part size and the answer', () => {
    for (const q of draws('y6-ratio', 2)) {
      const m = /^(\d+) parts, each (\d+)\. (\d+) × \d+ = (\d+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      expect(num(m[3]) * num(m[2]), q.why).toBe(num(m[4]));
      expect(m[4], q.why).toBe(q.answer);
      expect(Number(q.prompt.match(/^\d+/)![0]) % num(m[1]) === 0 || /of a/.test(q.prompt), q.why).toBe(true);
    }
  });
  it('scale cards show the multiplication or division that gives the answer', () => {
    for (const q of draws('y6-ratio', 3)) {
      const m = /(\d+) (×|÷) (\d+) = (\d+)/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      expect(m[2] === '×' ? num(m[1]) * num(m[3]) : num(m[1]) / num(m[3]), q.why).toBe(num(m[4]));
      expect(m[4], q.why).toBe(q.answer);
    }
  });
});

describe('y6-percentof whys (#2317)', () => {
  it('the 5% step times its count is the answer', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draws('y6-percentof', d)) {
      const m = /^5% of ([\d,]+) is ([\d,]+); (\d+) lots of that is ([\d,]+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      expect(num(m[1]) / 20, q.why).toBe(num(m[2]));
      expect(num(m[2]) * num(m[3]), q.why).toBe(num(m[4]));
      expect(m[4], q.why).toBe(q.answer);
    }
  });
  it('every word problem carries a why that mentions its answer', () => {
    for (const q of draws('y6-percentof', 3)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.includes(q.answer) || /differ by/.test(q.why!), q.why).toBe(true);
    }
  });
});
