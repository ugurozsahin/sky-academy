// #2317 (y2-anyorder): the why states the rule for the operation shown and, on swap cards, the shared answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y2-anyorder whys (#2317)', () => {
  it('each why matches the operation and the answer', () => {
    const t = TOPICS.find(x => x.id === 'y2-anyorder')!;
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      const m = /^Which is the same as (\d+) ([+×]) (\d+)\?$/.exec(q.prompt);
      if (m) {
        const v = m[2] === '+' ? +m[1] + +m[3] : +m[1] * +m[3];
        expect(w).toBe(`${m[2] === '+' ? 'Add' : 'Times'} in any order: both make ${v}.`);
        expect(q.answer).toBe(`${m[3]} ${m[2]} ${m[1]}`);
      } else {
        const y = /^(\d+)([+−×÷])(\d+) = /.exec(q.prompt)!;
        expect(y, q.prompt).not.toBeNull();
        const rule = { '+': 'Adding in any order gives the same.', '×': 'Times in any order gives the same.', '−': 'Subtracting in a different order changes it.', '÷': 'Dividing in a different order changes it.' }[y[2]];
        expect(w).toBe(rule);
        expect(q.answer).toBe(y[2] === '+' || y[2] === '×' ? 'Yes' : 'No');
      }
    }
  });
});
