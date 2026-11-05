// #2317 (y3-fracline): the why counts the gaps from 0, each worth one 1/den, to the asked fraction.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = () => { const t = TOPICS.find(x => x.id === 'y3-fracline')!; return ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d)))); };

describe('y3-fracline why (#2317)', () => {
  it('names the gaps counted and the fraction they make, on every question', () => {
    for (const q of draw()) {
      const w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(14);
      const m = /^(?:[A-D]: )?(\d+) gaps? of 1\/(\d+) from 0 is (\d+)\/(\d+)\.$/.exec(w);
      expect(m, w).toBeTruthy();
      expect(m![3]).toBe(m![1]); expect(m![4]).toBe(m![2]);
      if (/^\d+\/\d+$/.test(q.answer)) expect(`${m![3]}/${m![4]}`).toBe(q.answer);
      else expect(q.prompt).toContain(`${m![3]}/${m![4]}`);
    }
  });
});
