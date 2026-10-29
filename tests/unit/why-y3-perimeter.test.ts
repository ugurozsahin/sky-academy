// #2317 (y3-perimeter): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { perimeterOf } from '../../src/curriculum/year3-perimeter';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y3-perimeter')!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('y3-perimeter whys (#2317)', () => {
  it('a grid why counts the edges of the very shape shown, and matches the answer', () => {
    let seen = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      const m = /^(\d+) edges of 1 cm round the outside$/.exec(q.why!);
      if (!m || q.visual?.type !== 'symmetry') continue;
      seen++;
      expect(Number(m[1]), q.why).toBe(perimeterOf(q.visual.grid));
      expect(`${m[1]} cm`, q.why).toBe(q.answer);
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('a rectangle why doubles the length plus the width given in the prompt', () => {
    let seen = 0;
    for (const q of draws(3)) {
      const m = /^2 × \((\d+) \+ (\d+)\) = (\d+) cm$/.exec(q.why!);
      if (!m) continue;
      seen++;
      expect(q.prompt, q.prompt).toContain(`${m[1]} cm long and ${m[2]} cm wide`);
      expect(2 * (Number(m[1]) + Number(m[2])), q.why).toBe(Number(m[3]));
      expect(`${m[3]} cm`).toBe(q.answer);
    }
    expect(seen).toBeGreaterThan(0);
  });
});
