// #2317 (y4-area): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y4-area')!.gen(d, rngOf((s + 1) * 104729 + d)));
const squares = (g: string[]) => g.join('').split('#').length - 1;
const edges = (g: string[]) => {
  const on = (r: number, c: number) => g[r]?.[c] === '#';
  let n = 0;
  g.forEach((row, r) => [...row].forEach((_, c) => { if (on(r, c)) n += [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([a, b]) => !on(r + a, c + b)).length; }));
  return n;
};

describe('y4-area whys (#2317)', () => {
  it('a counting why gives the squares in the grid shown, and matches the answer', () => {
    let seen = 0;
    for (const d of [1, 2] as Difficulty[]) for (const q of draws(d)) {
      if (q.visual?.type !== 'symmetry' || !/area/.test(q.prompt)) continue;
      const m = /^(?:(\d+) × (\d+) = )?(\d+) squares(?: in the shape)?$/.exec(q.why!);
      expect(m, q.why).not.toBeNull();
      seen++;
      expect(Number(m![3]), q.why).toBe(squares(q.visual.grid));
      expect(m![3], q.why).toBe(q.answer);
      if (m![1]) expect(Number(m![1]) * Number(m![2])).toBe(Number(m![3]));
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('a grid perimeter why counts the edges round the shape shown', () => {
    let seen = 0;
    for (const q of draws(2)) {
      const m = /^(\d+) edges of 1 cm round the outside$/.exec(q.why ?? '');
      if (!m || q.visual?.type !== 'symmetry') continue;
      seen++;
      expect(Number(m[1]), q.why).toBe(edges(q.visual.grid));
      expect(m[1], q.why).toBe(q.answer);
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('a calculated why uses the sides in the prompt', () => {
    let sq = 0, rect = 0;
    for (const q of draws(3)) {
      const a = /^4 × (\d+) = (\d+) (cm|m)$/.exec(q.why!);
      const b = /^2 × \((\d+) \+ (\d+)\) = (\d+) (cm|m)$/.exec(q.why!);
      if (a) { sq++; expect(q.prompt).toContain(`A square has ${a[1]} ${a[3]} sides`); expect(4 * Number(a[1])).toBe(Number(a[2])); expect(q.answer).toBe(a[2]); }
      else { expect(b, q.why).not.toBeNull(); rect++; expect(q.prompt).toContain(`${b![1]} ${b![4]} long and ${b![2]} ${b![4]} wide`); expect(2 * (Number(b![1]) + Number(b![2]))).toBe(Number(b![3])); expect(q.answer).toBe(b![3]); }
    }
    expect(sq).toBeGreaterThan(0); expect(rect).toBeGreaterThan(0);
  });
});
