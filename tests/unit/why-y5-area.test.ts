// #2317 (y5-area): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y5-area')!.gen(d, rngOf((s + 1) * 104729 + d)));
const count = (g: string[], ch: string) => g.join('').split(ch).length - 1;
const edges = (g: string[]) => {
  const on = (r: number, c: number) => g[r]?.[c] === '#';
  let n = 0;
  g.forEach((row, r) => [...row].forEach((_, c) => { if (on(r, c)) n += [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([a, b]) => !on(r + a, c + b)).length; }));
  return n;
};

describe('y5-area whys (#2317)', () => {
  it('every card has a short why', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
    }
  });
  it('a product why matches its prompt and the answer', () => {
    let seen = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      const m = /^(\d+) × (\d+) = (\d+) (cm²|m²)$/.exec(q.why!);
      if (!m) continue;
      seen++;
      expect(Number(m[1]) * Number(m[2])).toBe(Number(m[3]));
      expect(q.answer).toBe(m[3]);
      if (q.visual?.type === 'symmetry') expect(Number(m[1]) * Number(m[2])).toBe(count(q.visual.grid, '#'));
      else expect(q.prompt).toContain(`${m[1]} ${m[4] === 'm²' ? 'm' : 'cm'} by ${m[2]}`);
    }
    expect(seen).toBeGreaterThan(100);
  });
  it('a grid perimeter why counts the edges of the shape shown', () => {
    let seen = 0;
    for (const q of draws(2)) {
      const m = /^(\d+) edges of 1 cm round the outside$/.exec(q.why ?? '');
      if (!m || q.visual?.type !== 'symmetry') continue;
      seen++;
      expect(Number(m[1])).toBe(edges(q.visual.grid));
      expect(m[1]).toBe(q.answer);
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('a metre perimeter why doubles the sides in the prompt', () => {
    let seen = 0;
    for (const q of draws(2)) {
      const m = /^2 × \((\d+) \+ (\d+)\) = (\d+) m$/.exec(q.why ?? '');
      if (!m) continue;
      seen++;
      expect(q.prompt).toContain(`${m[1]} m by ${m[2]} m`);
      expect(2 * (Number(m[1]) + Number(m[2]))).toBe(Number(m[3]));
      expect(q.answer).toBe(m[3]);
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('an estimate why counts the whole and half squares shown, or takes the corner off', () => {
    let halves = 0, corner = 0;
    for (const q of draws(3)) {
      const h = /^(\d+) whole \+ (\d+) halves \((\d+)\) = (\d+) cm²$/.exec(q.why!);
      if (h) {
        halves++;
        const g = (q.visual as { grid: string[] }).grid;
        expect(Number(h[1])).toBe(count(g, '#'));
        expect(Number(h[2])).toBe(count(g, 'h'));
        expect(Number(h[1]) + Number(h[3])).toBe(Number(h[4]));
        expect(q.answer).toBe(h[4]);
        continue;
      }
      const c = /^(\d+) × (\d+) − (\d+) × (\d+) = (\d+) cm²$/.exec(q.why!);
      expect(c, q.why).not.toBeNull();
      corner++;
      expect(q.prompt).toContain(`${c![1]} × ${c![2]} cm rectangle, ${c![3]} × ${c![4]} cm corner`);
      expect(Number(c![1]) * Number(c![2]) - Number(c![3]) * Number(c![4])).toBe(Number(c![5]));
      expect(q.answer).toBe(c![5]);
    }
    expect(halves).toBeGreaterThan(0); expect(corner).toBeGreaterThan(0);
  });
});
