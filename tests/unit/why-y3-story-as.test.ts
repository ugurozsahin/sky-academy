// #2318: y3-story-as says why: the number sentence of each step the story tells.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(t => t.id === 'y3-story-as')!.gen;

describe('y3-story-as says why (#2318)', () => {
  it('gives one true sentence per step, chained, the last one ending in the answer', () => {
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 200; s++) {
      const q = gen(d, rngOf(s));
      const parts = q.why!.split(', then ');
      expect(parts.length).toBe(d === 3 ? 2 : 1);
      let prev: number | undefined;
      for (const p of parts) {
        const m = p.match(/^(\d+) ([+-]) (\d+) = (\d+)$/)!;
        const [x, op, y, z] = [Number(m[1]), m[2], Number(m[3]), Number(m[4])];
        expect(z, p).toBe(op === '+' ? x + y : x - y); // the arithmetic holds
        if (prev !== undefined) expect(x, q.why).toBe(prev); // step 2 starts where step 1 ended
        // the story names both numbers (the answer's unit is stripped; a card's prompt holds the story)
        expect(q.prompt, p).toContain(String(y));
        prev = z;
      }
      expect(prev, q.why).toBe(Number(q.answer.replace(/\D/g, '')));
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});
