// #2317 (y1-moreless): the why is true of the numbers in the question, in few words.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y1-moreless whys (#2317)', () => {
  it('every question has a short why that matches its numbers', () => {
    const t = TOPICS.find(x => x.id === 'y1-moreless')!;
    const seen = new Set<string>();
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      let m: RegExpExecArray | null;
      if ((m = /^(\d+) is one (more|less) than (\d+)\.$/.exec(w))) {
        const n = Number(m[3]);
        expect(q.answer).toBe(m[1]);
        expect(Number(m[1])).toBe(m[2] === 'more' ? n + 1 : n - 1);
        expect(q.prompt).toBe(`One ${m[2]} than ${n}?`); seen.add('one');
      } else if ((m = /^One less each time: (\d+), (\d+), (\d+), (\d+)\.$/.exec(w))) {
        const [a, b, c, e] = m.slice(1).map(Number);
        expect([a - b, b - c, c - e]).toEqual([1, 1, 1]);
        expect(q.answer).toBe(String(e)); expect(q.prompt).toBe(`Count back: ${a}, ${b}, ${c}, ?`); seen.add('back');
      } else throw new Error(`unexpected why: ${w}`);
    }
    expect([...seen].sort()).toEqual(['back', 'one']);
  });
});
