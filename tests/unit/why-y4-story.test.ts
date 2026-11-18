// #2318: y4-story says why: the number sentence of each of the two steps the story tells.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(t => t.id === 'y4-story')!.gen;
const num = (s: string) => Number(s.replace(/,/g, ''));

describe('y4-story says why (#2318)', () => {
  it('gives two true, chained sentences, the second ending in the answer', () => {
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 200; s++) {
      const q = gen(d, rngOf(s));
      const parts = q.why!.split(', then ');
      expect(parts.length, q.why).toBe(2);
      let prev: number | undefined;
      for (const p of parts) {
        const m = p.match(/^([\d,]+) ([+-]) ([\d,]+) = ([\d,]+)$/)!;
        expect(m, p).not.toBeNull();
        const [x, op, y, z] = [num(m[1]), m[2], num(m[3]), num(m[4])];
        expect(z, p).toBe(op === '+' ? x + y : x - y);
        if (prev !== undefined) expect(x, q.why).toBe(prev);
        prev = z;
      }
      expect(prev, q.why).toBe(num(q.answer.replace(/[^\d,]/g, '')));
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});
