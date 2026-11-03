// #2317 (y1-skip): the why is true of the numbers in the question, in few words.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y1-skip whys (#2317)', () => {
  it('every question has a short why that matches its numbers', () => {
    const t = TOPICS.find(x => x.id === 'y1-skip')!;
    const steps = new Set<number>(), seen = new Set<string>();
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      const am = /^Multiples of (5|10) end in (0 or 5|0)\.$/.exec(w);
      if (am) {
        const k = Number(am[1]);
        expect(am[2]).toBe(k === 5 ? '0 or 5' : '0');
        expect(q.prompt).toBe(`Slice every multiple of ${k}`);
        for (const n of q.sequence!) expect(Number(n) % k).toBe(0);
        seen.add('any'); continue;
      }
      const m = /^Add (\d+) each time: (\d+), (\d+), (\d+), (\d+)\.$/.exec(w);
      expect(m, w).not.toBeNull();
      const [step, a, b, c, e] = m!.slice(1).map(Number);
      expect([b - a, c - b, e - c]).toEqual([step, step, step]);
      expect(q.answer).toBe(String(e));
      expect(q.prompt).toBe(`${a}, ${b}, ${c}, ?`);
      steps.add(step);
    }
    expect([...seen]).toEqual(['any']);
    expect([...steps].sort((x, y) => x - y)).toEqual([2, 5, 10]);
  });
});
