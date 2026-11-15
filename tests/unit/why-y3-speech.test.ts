// #2318 (y3-speech): the why says what the inverted commas wrap, and shows the right version, in 14 words or fewer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y3-speech')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('y3-speech why (#2318)', () => {
  it('every question has a short why that shows the right version, not the bare letter', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const w = q.why!;
      expect(w, q.prompt).toMatch(/^Wrap only the spoken words: /);
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(14);
      const shown = String((q.visual as { text: string }).text).split('\n').find(l => l.startsWith(`${q.answer}  `))!.slice(3);
      expect(w.endsWith(shown), `${w} / ${shown}`).toBe(true);
    }
  });
});
