// #2317 (y6-missingangles, y6-circles): the why shows the equal angle, the total taken away, or the doubling or halving.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (id: string, d: Difficulty) => { const t = TOPICS.find(x => x.id === id)!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };
const num = (s: string) => Number(s.replace(/[,°]/g, ''));

describe('y6-missingangles why (#2317)', () => {
  it('every question has a why of at most 14 words that ends on the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw('y6-missingangles', d)) {
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      expect(q.why!.endsWith(`${q.answer}.`), q.why).toBe(true);
    }
  });
  it('d1 either says opposite angles are equal or subtracts from 180 or 360 to the answer', () => {
    for (const q of draw('y6-missingangles', 1)) {
      if (/^Opposite/.test(q.why!)) expect(q.why).toBe(`Opposite angles are equal: ${q.answer}.`);
      else {
        const m = q.why!.match(/(180|360)° (?:− |.*; 360° − )?/)!;
        expect(m, q.why).toBeTruthy();
        const nums = q.why!.match(/[\d,]+°/g)!.map(num), total = /^180/.test(q.why!) ? 180 : 360;
        expect(nums[nums.length - 2] + nums[nums.length - 1], q.why).toBe(total);
      }
    }
  });
  it('d2 sums add up and the subtraction lands on the answer', () => {
    for (const q of draw('y6-missingangles', 2)) {
      const n = q.why!.match(/[\d,]+°/g)!.map(num);
      if (/^Isosceles/.test(q.prompt)) { expect(n[0] - n[1]).toBe(n[2]); expect(n[2] / 2).toBe(num(q.answer)); continue; }
      const total = /^Triangle/.test(q.prompt) ? 180 : 360, [head, tail] = q.why!.split('; '), parts = head.match(/[\d,]+°/g)!.map(num);
      const sum = parts.pop()!;
      expect(parts.reduce((x, y) => x + y, 0), q.why).toBe(sum);
      expect(tail.startsWith(`${total}° − ${sum}°`), q.why).toBe(true);
      expect(total - sum).toBe(num(q.answer));
    }
  });
  it('d3 works out the polygon total or share', () => {
    for (const q of draw('y6-missingangles', 3)) {
      const w = q.why!;
      if (/^\d+ triangles/.test(w)) { const [, t, tot, n, each] = w.match(/^(\d+) triangles = ([\d,]+)°; ÷ (\d+) = (\d+)°\.$/)!; expect(180 * +t).toBe(num(tot)); expect(+t + 2).toBe(+n); expect(num(tot) / +n).toBe(+each); }
      else if (/ sides make /.test(w)) { const m = w.match(/^(\d+) sides make (\d+) triangles: \d+ × 180° = ([\d,]+)°\.$/)!; expect(+m[1] - 2).toBe(+m[2]); expect(num(m[3])).toBe(180 * +m[2]); }
      else { const n = w.match(/[\d,]+°/g)!.map(num); expect(n.slice(0, 4).reduce((a, b) => a + b, 0)).toBe(n[4]); expect(540 - n[4]).toBe(num(q.answer)); }
    }
  });
});

describe('y6-circles why (#2317)', () => {
  it('d1 names the part asked for', () => {
    for (const q of draw('y6-circles', 1)) expect(q.why, q.prompt).toContain(q.prompt.match(/the (\w+)\?/)![1]);
  });
  it('d2 doubles or halves to the answer', () => {
    for (const q of draw('y6-circles', 2)) {
      const [, x, y, z] = q.why!.match(/: (\d+) [×÷] (\d+) = (\d+) cm\.$/)!.map(Number);
      expect(q.why!.includes('×') ? x * y : x / y, q.why).toBe(z);
      expect(z).toBe(+q.answer);
    }
  });
  it('d3 stays within 14 words and lands on the answer', () => {
    for (const q of draw('y6-circles', 3)) {
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      expect(q.why!.endsWith(`${q.answer} cm.`), q.why).toBe(true);
    }
  });
});
