import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y1-compare')!;
type Vis = { type: 'objects'; emoji: string; n: number; emoji2: string; n2: number };

/** #985: the oracle is re-derived from the visual (form A) or the option set (form B), never from the generator's own variables. */
describe('y1-compare (#985)', () => {
  it('form A: equal iff the groups match; otherwise the more/fewer group; sizes 1–10', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9850 + d);
      let equals = 0, forms = 0;
      for (let i = 0; i < 200; i++) {
        const q = topic.gen(d, r);
        if (!q.visual) continue;
        forms++;
        const v = q.visual as Vis;
        expect(v.n).toBeGreaterThanOrEqual(1); expect(v.n).toBeLessThanOrEqual(10);
        expect(v.n2).toBeGreaterThanOrEqual(1); expect(v.n2).toBeLessThanOrEqual(10);
        expect(v.emoji).not.toBe(v.emoji2);
        expect([...q.options].sort()).toEqual([v.emoji, v.emoji2, 'equal'].sort());
        if (v.n === v.n2) { expect(q.answer).toBe('equal'); equals++; expect(q.prompt).toContain('equal'); continue; }
        expect(q.answer).not.toBe('equal');
        const bigger = v.n > v.n2 ? v.emoji : v.emoji2, smaller = v.n > v.n2 ? v.emoji2 : v.emoji;
        expect(q.answer).toBe(q.prompt.includes('fewer') ? smaller : bigger);
      }
      expect(forms).toBeGreaterThan(0);
      if (d === 1) expect(equals).toBeGreaterThan(0);
    }
  });
  it('form B: most/least over 3 (d2) or 4 (d3) distinct numbers ≤ 20, one answer', () => {
    for (const d of [2, 3] as Difficulty[]) {
      const r = rng(9860 + d);
      let seen = 0;
      for (let i = 0; i < 200; i++) {
        const q = topic.gen(d, r);
        if (q.visual) continue;
        seen++;
        const nums = q.options.map(Number);
        expect(nums).toHaveLength(d === 3 ? 4 : 3);
        expect(new Set(nums).size).toBe(nums.length);
        nums.forEach(n => { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(20); });
        expect(Number(q.answer)).toBe(q.prompt.includes('most') ? Math.max(...nums) : Math.min(...nums));
      }
      expect(seen).toBeGreaterThan(0);
    }
  });
  it('d1 is form A only', () => {
    const r = rng(9871);
    for (let i = 0; i < 100; i++) expect(topic.gen(1, r).visual).toBeTruthy();
  });
});
