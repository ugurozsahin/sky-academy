// #2317 (y2-story-money): each why is the money sum the story tells, true and consistent with the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pence = (s: string) => (s.startsWith('£') ? 100 : 0) + (/(\d+)p$/.exec(s) ? Number(/(\d+)p$/.exec(s)![1]) : 0);

describe('y2-story-money whys (#2317)', () => {
  it('every why is a + or − sentence on the printed prices, ending in the answer', () => {
    const t = TOPICS.find(x => x.id === 'y2-story-money')!;
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      const [lhs, rhs] = w.split(' = ');
      const parts = lhs.split(/ ([+−]) /);
      let v = pence(parts[0]);
      for (let i = 1; i < parts.length; i += 2) v += (parts[i] === '+' ? 1 : -1) * pence(parts[i + 1]);
      expect(v, w).toBe(pence(rhs));
      expect(rhs, w).toBe(q.answer);
      for (const n of parts.filter((_, i) => i % 2 === 0).slice(d === 1 ? 0 : 1)) expect(q.prompt, w).toContain(n);
    }
  });
});
