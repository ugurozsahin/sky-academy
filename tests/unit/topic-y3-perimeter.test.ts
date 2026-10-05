import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-perimeter')!;
const DRAWS = 300;
const draws = (d: Difficulty) => { const r = rng(1098 + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
const grid = (c: Question) => (c.visual?.type === 'symmetry' ? c.visual : undefined);
const num = (s: string) => Number(s.replace(' cm', ''));

/** Independent edge count: for each pair of neighbouring cells (including the outside), a boundary is where they differ. */
function boundary(g: string[]): number {
  const h = g.length, w = g[0].length, at = (r: number, k: number) => (r < 0 || k < 0 || r >= h || k >= w ? '.' : g[r][k]);
  let n = 0;
  for (let r = -1; r < h; r++) for (let k = -1; k < w; k++) {
    if (at(r, k) !== at(r + 1, k)) n++;
    if (at(r, k) !== at(r, k + 1)) n++;
  }
  return n;
}
/** Flood fill from `start` over cells equal to `ch`, with the grid padded by one ring of `.`. */
function reach(g: string[], ch: string, start: [number, number]): number {
  const p = ['.'.repeat(g[0].length + 2), ...g.map(r => `.${r}.`), '.'.repeat(g[0].length + 2)];
  const seen = new Set<string>([start.join()]), todo = [start];
  while (todo.length) {
    const [r, k] = todo.pop()!;
    for (const [a, b] of [[r - 1, k], [r + 1, k], [r, k - 1], [r, k + 1]]) {
      if (p[a]?.[b] === ch && !seen.has(`${a},${b}`)) { seen.add(`${a},${b}`); todo.push([a, b]); }
    }
  }
  return seen.size;
}

describe('y3-perimeter (#1098)', () => {
  it('is registered once, in Year 3', () => {
    expect(TOPICS.filter(t => t.id === 'y3-perimeter')).toHaveLength(1);
    expect(topic.year).toBe('year3');
  });

  it('every grid answer equals an independent count of the boundary edges, written in cm', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const g = grid(c);
      if (!g) continue;
      expect(c.answer, c.prompt).toBe(`${boundary(g.grid)} cm`);
    }
  });

  it('every text answer is 2 × (length + width)', () => {
    let seen = 0;
    for (const c of draws(3)) {
      const m = c.prompt.match(/is (\d+) cm long and (\d+) cm wide/);
      if (!m) continue;
      seen++;
      expect(num(c.answer)).toBe(2 * (Number(m[1]) + Number(m[2])));
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('the area is always a wrong option and never equals the perimeter', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const g = grid(c), m = c.prompt.match(/is (\d+) cm long and (\d+) cm wide/);
      const area = g ? g.grid.join('').split('#').length - 1 : Number(m![1]) * Number(m![2]);
      expect(area, c.prompt).not.toBe(num(c.answer));
      expect(c.options, c.prompt).toContain(`${area} cm`);
    }
  });

  it('every grid is one connected shape with no holes, within 8 × 8, drawn without a mirror line', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const g = grid(c);
      if (!g) { expect(d).toBe(3); continue; }
      const cells = g.grid.join('').split('#').length - 1, first = g.grid.flatMap((r, i) => [...r].flatMap((ch, k) => ch === '#' ? [[i + 1, k + 1] as [number, number]] : []))[0];
      expect(g.mirror).toBe(false);
      expect(g.grid.length).toBeLessThanOrEqual(8);
      for (const r of g.grid) expect(r.length).toBe(g.grid[0].length);
      expect(g.grid[0].length).toBeLessThanOrEqual(8);
      expect(reach(g.grid, '#', first)).toBe(cells);
      const padded = (g.grid[0].length + 2) * (g.grid.length + 2);
      expect(reach(g.grid, '.', [0, 0])).toBe(padded - cells);
    }
  });

  it('d2 draws both rectangles and L-shapes; d3 draws notches and the words form', () => {
    const l = (c: Question) => grid(c)!.grid.some(r => r.includes('.'));
    expect(draws(2).some(l) && draws(2).some(c => !l(c))).toBe(true);
    expect(draws(3).some(c => !grid(c))).toBe(true);
    expect(draws(3).some(c => grid(c) && l(c))).toBe(true);
  });

  it('the decoys keep the last-digit and leading-digit shares inside the #1058 bar', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      expect(s.units).toBeLessThanOrEqual(0.3);
      expect(s.leading).toBeLessThanOrEqual(0.3);
    }
  });
});
