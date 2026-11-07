// #2317 (y6-twounknowns): the why is the check of the offered pair against the equation, or the pairs listed and counted.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y6-twounknowns')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('y6-twounknowns why (#2317)', () => {
  it('d1/d2: the working uses the answer pair and reaches the total in the prompt', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d)) {
      const w = q.why!, [a, b] = q.answer.split(' and ').map(Number);
      let m: RegExpExecArray | null;
      if ((m = /^(\d+) × (\d+) \+ (\d+) = (\d+)\.$/.exec(w))) { expect(+m[1] * a + b, w).toBe(+m[4]); expect([+m[2], +m[3]]).toEqual([a, b]); expect(q.prompt).toContain(`= ${m[4]}.`); }
      else if ((m = /^(\d+) \+ (\d+) = (\d+)\.$/.exec(w))) { expect([+m[1], +m[2]]).toEqual([a, b]); expect(a + b).toBe(+m[3]); expect(q.prompt).toContain(`= ${m[3]}.`); }
      else { m = /^(\d+) × (\d+) = (\d+), and (\d+) < (\d+)\.$/.exec(w); expect(m, w).toBeTruthy(); expect([+m![1], +m![2]]).toEqual([a, b]); expect(a * b).toBe(+m![3]); expect(a).toBeLessThan(b); }
    }
  });
  it('d3: lists pairs summing to the prompt total and the count is the answer', () => {
    for (const q of draw(3)) {
      const m = /^(.+): (\d+) pairs\.$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      const ps = m[1].split(', ').map(p => p.split('+').map(Number));
      const t = +/a \+ b = (\d+)/.exec(q.prompt)![1];
      for (const [a, b] of ps) expect(a + b).toBe(t);
      expect(String(ps.length)).toBe(q.answer); expect(m[2]).toBe(q.answer);
    }
  });
});
