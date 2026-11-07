// #2317 (y6-coords): the why walks from the origin — across x, then up or down y — or names the corner's source.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y6-coords')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('y6-coords why (#2317)', () => {
  it('every question has a short why', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
    }
  });
  it('d1 walks across then up or down and ends in the answer pair', () => {
    for (const q of draw(1)) expect(q.why, q.prompt).toMatch(/^Across −?\d, (up|down) \d: /), expect(q.why!.endsWith(`${q.answer}.`)).toBe(true);
  });
  it('d2 walks to the pair in the prompt and names the lettered point', () => {
    for (const q of draw(2)) {
      const m = q.prompt.match(/at \((−?)(\d), (−?)(\d)\)/)!;
      expect(q.why).toBe(`Across ${m[1]}${m[2]}, ${m[3] ? 'down' : 'up'} ${m[4]} is point ${q.answer}.`);
    }
  });
  it('d3 says the fourth corner takes B\'s x and C\'s y', () => {
    for (const q of draw(3)) expect(q.why).toBe(`The fourth corner takes B's x and C's y: ${q.answer}.`);
  });
});
