import { describe, it, expect } from 'vitest';
import { y2StoryAdd, BANK } from '../../src/curriculum/year2-story-add';

function mulberry32(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const DRAWS = 300;
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);

describe('y2-story-add (#994)', () => {
  for (const d of [1, 2, 3] as const) {
    it(`d${d}: the answer is the template's operation on the prompt's two numbers`, () => {
      const rng = mulberry32(994 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = y2StoryAdd(d, rng);
        const [a, b] = nums(q.prompt);
        const row = BANK.find(t => q.prompt.startsWith(t[1].split('#')[0]))!;
        const tail = (t: string) => t.split('#')[1].trim().replace(/\.$/, '');
        const isAdd = q.prompt.includes(` ${tail(row[2])}.`) && !q.prompt.includes(` ${tail(row[3])}.`);
        if (!isAdd) expect(q.prompt).toContain(` ${tail(row[3])}.`);
        expect(nums(q.answer)[0]).toBe(isAdd ? a + b : a - b);
        expect(q.prompt.length).toBeLessThanOrEqual(83);
        expect(q.say).toBeTruthy();
        expect(new Set(q.options).size).toBe(4);
        expect(q.options).toContain(q.answer);
        for (const n of [...nums(q.prompt), ...q.options.flatMap(nums)]) expect(n).toBeLessThanOrEqual(100);
        const units = new Set((q.prompt.match(/\d+ (cm|m|ml|g|kg|l)\b/g) ?? []).map(x => x.split(' ')[1]));
        expect(units.size).toBeLessThanOrEqual(1);
        for (const o of q.options) expect(o.replace(/^\d+ ?/, '')).toBe(q.answer.replace(/^\d+ ?/, ''));
      }
    });
  }

  it('follows the ladder: ones, tens, then two 2-digit numbers', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < DRAWS; i++) {
      expect(nums(y2StoryAdd(1, rng).prompt)[1]).toBeLessThan(10);
      expect(nums(y2StoryAdd(2, rng).prompt)[1] % 10).toBe(0);
      expect(nums(y2StoryAdd(3, rng).prompt)[1]).toBeGreaterThanOrEqual(11);
    }
  });

  it('measures appear at d3, are spoken in full words, and the wrong-operation decoy is offered', () => {
    const rng = mulberry32(11);
    let measures = 0;
    for (let i = 0; i < DRAWS; i++) {
      const q = y2StoryAdd(3, rng);
      const [a, b] = nums(q.prompt);
      const row = BANK.find(t => q.prompt.startsWith(t[1].split('#')[0]))!;
      const add = q.prompt.includes(` ${row[2].split('#')[1].trim()}`);
      const other = add ? a - b : a + b;
      if (other >= 0 && other <= 100 && other !== nums(q.answer)[0]) expect(q.options.map(o => nums(o)[0])).toContain(other);
      if (row[0]) { measures++; expect(q.say).not.toMatch(/\d (cm|ml|g|kg|l|m)\b/); }
      else expect(q.say).toContain('How many are there now?');
    }
    expect(measures).toBeGreaterThan(50);
  });
});
