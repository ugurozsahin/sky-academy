// #2317 (y2-coincombo): the why adds the right coins up to the target, and the sum is true.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pence = (s: string) => (s.startsWith('£') ? Number(s.slice(1)) * 100 : parseInt(s, 10));

describe('y2-coincombo whys (#2317)', () => {
  it('shows the answer coins adding up to the target', () => {
    const t = TOPICS.find(x => x.id === 'y2-coincombo')!;
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w).toBeTruthy();
      const [lhs, rhs] = w.split(' = ');
      expect(lhs).toBe(q.answer);
      expect(q.prompt).toContain(rhs);
      expect(lhs.split(' + ').reduce((n, c) => n + pence(c), 0)).toBe(pence(rhs));
    }
  });
});
