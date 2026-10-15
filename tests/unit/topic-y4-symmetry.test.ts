import { describe, it, expect } from 'vitest';
import { topicById, type Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const t = topicById('y4-symmetry')!;
type Grid = string[];
const grid = (q: ReturnType<typeof t.gen>) => (q.visual as { grid: Grid }).grid;

// The test's own oracle, written from the cells: reflect by index and compare.
const at = (g: Grid, r: number, c: number) => g[r][c];
function lines(g: Grid): { v: boolean; h: boolean; d: number; total: number } {
  const n = g.length, idx = [...Array(n).keys()];
  const all = (f: (r: number, c: number) => [number, number]) => idx.every(r => idx.every(c => { const [a, b] = f(r, c); return at(g, r, c) === at(g, a, b); }));
  const v = all((r, c) => [r, n - 1 - c]), h = all((r, c) => [n - 1 - r, c]);
  const d = (all((r, c) => [c, r]) ? 1 : 0) + (all((r, c) => [n - 1 - c, n - 1 - r]) ? 1 : 0);
  return { v, h, d, total: +v + +h + d };
}
const rowPalindrome = (g: Grid) => g.every(r => r === [...r].reverse().join(''));

describe('y4-symmetry (#1155)', () => {
  it('is a Year 4 maths geometry topic', () => {
    expect(t).toMatchObject({ year: 'year4', subject: 'maths', title: 'Lines of Symmetry', strand: 'geometry' });
  });

  it('d1: the answer is one of C D E H I O X, the decoys come from the literal list', () => {
    const r = rng(1), seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const q = t.gen(1, r);
      expect(['C', 'D', 'E', 'H', 'I', 'O', 'X']).toContain(q.answer);
      for (const o of q.options.filter(x => x !== q.answer)) expect(['F', 'G', 'J', 'L', 'N', 'P', 'Q', 'R', 'S', 'Z']).toContain(o);
      expect(q.options).toHaveLength(4);
      seen.add(q.answer);
    }
    expect(seen.size).toBe(7);
  });

  it('d2: the answer equals the independent line count; all of 0, 1, 2, 4 are offered', () => {
    const r = rng(2), answers = new Set<string>(); let diagonalOnly = 0;
    for (let i = 0; i < 300; i++) {
      const q = t.gen(2, r), g = grid(q), l = lines(g);
      expect(q.answer).toBe(String(l.total));
      expect(q.options.slice().sort()).toEqual(['0', '1', '2', '4']);
      expect((q.visual as { mirror?: false }).mirror).toBe(false);
      if (l.total === 1 && l.d === 1) diagonalOnly++;
      if (l.total > 0) {
        expect(g.some(x => x[0] === '#') && g.some(x => x.endsWith('#')) && g[0].includes('#') && g[g.length - 1].includes('#')).toBe(true);
      }
      answers.add(q.answer);
    }
    expect([...answers].sort()).toEqual(['0', '1', '2', '4']);
    expect(diagonalOnly).toBeGreaterThan(0);
  });

  it('d2: the equal-armed L (nine squares, one diagonal line) appears in all four quarter turns', () => {
    const r = rng(3), corners = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const g = grid(t.gen(2, r));
      if (g.join('').split('#').length - 1 !== 9 || lines(g).total !== 1) continue;
      const n = g.length, last = n - 1;
      corners.add([[0, 0], [0, last], [last, 0], [last, last]].filter(([a, b]) => g[a][b] === '#' && g[a][b === 0 ? last : 0] === '#' && g[a === 0 ? last : 0][b] === '#').join(';'));
    }
    corners.delete('');
    expect(corners.size).toBeGreaterThanOrEqual(4);
  });

  it('d3: exactly one lettered cell makes the grid symmetric, and the slid cell is always offered', () => {
    const r = rng(4);
    for (let i = 0; i < 300; i++) {
      const q = t.gen(3, r), g = grid(q), cols = g[0].length;
      expect(cols).toBeLessThanOrEqual(7);
      expect(q.options).toEqual(['A', 'B', 'C', 'D']);
      const fits = ['A', 'B', 'C', 'D'].filter(L => rowPalindrome(g.map(row => [...row].map(ch => ch === L ? '#' : ch === '#' ? '#' : '.').join(''))));
      expect(fits).toEqual([q.answer]);
      // The decoy: the answer's square slid across by half the width, not flipped.
      const find = (L: string): [number, number] => { for (let rr = 0; rr < g.length; rr++) { const c = g[rr].indexOf(L); if (c >= 0) return [rr, c]; } throw new Error('missing'); };
      const [ar, ac] = find(q.answer), mirrorCol = cols - 1 - ac;
      expect(g[ar][mirrorCol]).toBe('#');
      const slid = (mirrorCol + cols / 2) % cols;
      const decoys = ['A', 'B', 'C', 'D'].filter(L => L !== q.answer).map(find);
      expect(decoys.some(([dr, dc]) => dr === ar && dc === slid)).toBe(true);
      // Every lettered cell sits on the right half.
      for (const L of q.options) expect(find(L)[1]).toBeGreaterThanOrEqual(cols / 2);
    }
  });

  it('every difficulty yields a well-formed card', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const q = t.gen(d, rng(9 + d)); expect(q.options).toContain(q.answer); }
  });
});
