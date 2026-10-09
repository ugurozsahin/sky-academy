// Squares-grid helpers shared by the area and perimeter topics (y4-area #1151, y5-area #1205). A `Grid` is [row][col], true = a filled square.
import type { Question, Rng } from './types';
import { ri, pick, numQ } from './util';

export type Grid = boolean[][];   // [row][col], true = a filled square

export const fill = (w: number, h: number): Grid => Array.from({ length: h }, () => Array<boolean>(w).fill(true));
export const cells = (g: Grid) => g.flat().filter(Boolean).length;
export const rows = (g: Grid) => g.map(r => r.map(c => (c ? '#' : '.')).join(''));
const at = (g: Grid, r: number, c: number) => g[r]?.[c] === true;

/** Cell edges between a filled square and an empty square or the grid border. */
export function perimeter(g: Grid): number {
  let n = 0;
  g.forEach((row, r) => row.forEach((on, c) => { if (on) for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (!at(g, r + dr, c + dc)) n++; }));
  return n;
}

/** Squares with at least one edge on the outside — the "count the squares round the edge" slip. */
export const edgeSquares = (g: Grid): number => g.flat().filter((on, i) => {
  const w = g[0].length, r = Math.floor(i / w), c = i % w;
  return on && [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => !at(g, r + dr, c + dc));
}).length;

/** Squares reachable from (r, c) by 4-neighbour steps through squares where `on(r, c)` holds. */
function reach(g: Grid, r: number, c: number, on: (r: number, c: number) => boolean): number {
  const seen = new Set<string>(), stack = [[r, c]];
  while (stack.length) {
    const [y, x] = stack.pop()!, k = `${y},${x}`;
    if (y < -1 || x < -1 || y > g.length || x > g[0].length || seen.has(k) || !on(y, x)) continue;
    seen.add(k);
    stack.push([y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]);
  }
  return seen.size;
}

/** One 4-connected piece, and no empty square walled in (every empty square reaches the margin round the grid). */
function sound(g: Grid): boolean {
  const first = g.flatMap((row, r) => row.map((on, c) => (on ? [r, c] : null))).find(Boolean)!;
  if (reach(g, first[0], first[1], (y, x) => at(g, y, x)) !== cells(g)) return false;
  const all = (g.length + 2) * (g[0].length + 2);   // the grid and its one-square margin
  return reach(g, -1, -1, (y, x) => !at(g, y, x)) === all - cells(g);
}

/** A rectangle with one or two rectangular notches cut from a corner or a side: L, T and U shapes only. */
export function rectilinear(rng: Rng): Grid {
  for (;;) {
    const w = ri(rng, 3, 6), h = ri(rng, 3, 5), g = fill(w, h);
    for (let k = ri(rng, 1, 2); k > 0; k--) {
      const nw = ri(rng, 1, Math.max(1, w - 2)), nh = ri(rng, 1, Math.max(1, h - 2));
      const side = rng() < 0.5;   // a side notch sits on the top or bottom edge, away from the corners
      const x0 = side ? ri(rng, 1, Math.max(1, w - nw - 1)) : pick(rng, [0, w - nw]);
      const y0 = pick(rng, [0, h - nh]);
      for (let y = y0; y < y0 + nh; y++) for (let x = x0; x < x0 + nw; x++) g[y][x] = false;
    }
    if (cells(g) >= 4 && cells(g) < w * h && sound(g)) return g;
  }
}

/** Misconception decoys first; a ±10 decoy when none shares the answer's units digit (#1058, answers ≥ 20). */
export function opts(rng: Rng, prompt: string, answer: number, bad: number[], extra: Partial<Question>): Question {
  const ds = [...new Set(bad.filter(v => v >= 1 && v !== answer))].slice(0, 3);
  if (answer >= 20 && !ds.some(v => v % 10 === answer % 10)) {
    const ten = answer > 10 && rng() < 0.5 ? answer - 10 : answer + 10;
    if (ds.length === 3) ds.pop();
    ds.push(ten);
  }
  const max = Math.max(60, answer + 10, ...ds);
  return numQ(rng, prompt, answer, { min: 1, max, distractors: ds, hint: 'Count carefully, one at a time', hintIsData: false, ...extra });
}
