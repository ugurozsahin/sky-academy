// #2317 (y1-length, y1-mass, y1-capacity): the why states the winning measure against the other, from the same numbers.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('Year 1 measure whys (#2317)', () => {
  for (const id of ['y1-length', 'y1-mass', 'y1-capacity']) {
    it(`${id}: every question has a short why that matches its hint`, () => {
      const t = TOPICS.find(x => x.id === id)!;
      const seen = new Set<string>();
      for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
        const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
        expect(w, q.prompt).toBeTruthy();
        expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
        const vals = new Map((q.hint ?? '').split(' · ').map(p => { const m = /^(\w+) \S+: (\d+) (\S+)$/.exec(p)!; return [m[1], Number(m[2])] as const; }));
        const win = vals.get(q.answer)!;
        const m = /^(\d+) (\S+) (is|holds) (?:the )?(\w+)(?: than (\d+) \S+)?\.$/.exec(w);
        expect(m, w).toBeTruthy();
        expect(Number(m![1])).toBe(win);
        const big = ['longer', 'taller', 'heavier', 'more', 'longest', 'tallest', 'heaviest', 'most'].includes(m![4]);
        const others = [...vals].filter(([c]) => c !== q.answer).map(([, v]) => v);
        expect(big ? others.every(v => v < win) : others.every(v => v > win), w).toBe(true);
        if (m![5]) expect(others).toEqual([Number(m![5])]);
        seen.add(m![5] ? 'pair' : 'superlative');
      }
      expect([...seen].sort()).toEqual(['pair', 'superlative']);
    });
  }
});
