import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y1-half')!;
const WORDS = ['a half', 'a quarter', 'a whole'];

/** #987: y1-half gains a shape form over the existing `fraction` visual. */
describe('y1-half shapes (#987)', () => {
  it('answers the word the (parts, shaded) pair fixes, never draws 2 of 4, offers only Year 1 words', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9870 + d);
      let shapes = 0, whole = 0, quarters = 0;
      for (let i = 0; i < 400; i++) {
        const q = topic.gen(d, r);
        if (/^(Half|A quarter) of/.test(q.prompt)) { expect(q.visual).toMatchObject({ type: 'objects' }); continue; }
        if (q.prompt.startsWith('How many')) {
          expect(d).toBe(3);
          expect(+q.answer).toBe(q.prompt.includes('quarters') ? 4 : 2);
          q.options.forEach(o => { expect(+o).toBeGreaterThanOrEqual(1); expect(+o).toBeLessThanOrEqual(4); });
          quarters++;
          continue;
        }
        shapes++;
        const v = q.visual as { type: string; parts: number; shaded: number; shape?: string };
        expect(v.type).toBe('fraction');
        expect(v.shaded === 1 || v.shaded === v.parts).toBe(true);
        expect(v.parts === 4 && v.shaded === 2).toBe(false);
        const expected = v.shaded === v.parts ? 'a whole' : v.parts === 2 ? 'a half' : 'a quarter';
        expect(q.answer).toBe(expected);
        if (expected === 'a whole') whole++;
        q.options.forEach(o => expect(WORDS).toContain(o));
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.options.length).toBe(d === 1 ? 2 : 3);
        if (d === 1) { expect(v.shape).toBe('circle'); expect(q.options).not.toContain('a quarter'); }
      }
      expect(shapes).toBeGreaterThan(50);
      expect(whole).toBeGreaterThan(0);
      if (d === 3) expect(quarters).toBeGreaterThan(0); else expect(quarters).toBe(0);
    }
  });
});
