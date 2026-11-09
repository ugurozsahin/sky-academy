// #2317 (y3-time): the why names the hour and minutes read, the am/pm rule, or the 12-hour sum.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y3-time')!; return Array.from({ length: 300 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('y3-time why (#2317)', () => {
  it('every question has a why of at most 14 words that ends on the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      expect(q.why!.endsWith(`${q.answer}.`), q.why).toBe(true);
    }
  });
  it('clock cards name the hour and the minutes the answer shows', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d).filter(x => x.visual)) {
      const [h, m] = q.answer.split(' ')[0].split(':').map(Number);
      expect(q.why!.startsWith(`Hour ${h}, `), q.why).toBe(true);
      expect(q.why, q.why).toContain(m === 0 ? 'no minutes' : `${m} minute`);
    }
  });
  it('the vocabulary cards give the right am/pm rule', () => {
    for (const q of draw(2).filter(x => /^Which time/.test(x.prompt))) {
      expect(q.why!.includes(' is pm: ') ? q.answer.endsWith('pm') : q.answer.endsWith('am'), q.why).toBe(true);
    }
  });
  it('the 24-hour sums add up', () => {
    for (const q of draw(3)) {
      const sum = q.why!.match(/^(\d+) ([+−]) 12 = (\d+)/) ?? q.why!.match(/pm: (\d+) \+ 12 = (\d+)/);
      if (!sum) continue;
      const nums = sum.slice(1).filter(x => /^\d+$/.test(x)).map(Number);
      expect(sum[0].includes('+') ? nums[0] + 12 : nums[0] - 12, q.why).toBe(nums[1]);
    }
  });
});
