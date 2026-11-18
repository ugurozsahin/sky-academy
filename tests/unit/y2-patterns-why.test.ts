import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { PATTERN_OBJECTS } from '../../src/curriculum/patterns';
import type { Difficulty, Rng } from '../../src/curriculum';

// A small deterministic generator, so the test does not lean on curriculum.test.ts (a frozen file).
const rng = (seed: number): Rng => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

describe('y2-patterns why (#2318)', () => {
  const t = TOPICS.find(x => x.id === 'y2-patterns')!;
  const nameOf = new Map(PATTERN_OBJECTS);
  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: the spoken why names the repeating unit and holds no emoji`, () => {
      const r = rng(2318 + d);
      for (let i = 0; i < 100; i++) {
        const q = t.gen(d, r);
        expect(q.why, 'a spoken reason').toBeTruthy();
        expect(q.why, `no emoji in the spoken why: ${q.why}`).not.toMatch(/\p{Extended_Pictographic}/u);
        const items = (q.visual as { text: string }).text.split(' ').filter(x => x !== '_');
        const names = [...nameOf.values()].filter(n => q.why!.includes(n));
        expect(names.length, `at least one object named: ${q.why}`).toBeGreaterThan(0);
        expect(items.some(o => names.includes(nameOf.get(o) ?? '')), 'a named object is in the strip').toBe(true);
        expect(q.why!.split(' ').length, 'KS1 limit of eight words').toBeLessThanOrEqual(8);
      }
    });
  }
});
