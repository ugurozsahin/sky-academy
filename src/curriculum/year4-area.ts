// y4-area (#1151): area by counting squares, and perimeter. Shapes are `#`/`.` grids drawn by the `symmetry` visual
// with `mirror: false`. d1 counts a rectangle's squares; d2 uses rectilinear L, T and U shapes and asks for area or
// perimeter by turns; d3 calculates a rectangle's perimeter from its sides, no grid. Area is in squares, never cm².
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, numQ } from './util';

type Grid = boolean[][];   // [row][col], true = a filled square

const fill = (w: number, h: number): Grid => Array.from({ length: h }, () => Array<boolean>(w).fill(true));
const cells = (g: Grid) => g.flat().filter(Boolean).length;
const rows = (g: Grid) => g.map(r => r.map(c => (c ? '#' : '.')).join(''));
const at = (g: Grid, r: number, c: number) => g[r]?.[c] === true;

/** Cell edges between a filled square and an empty square or the grid border. */
function perimeter(g: Grid): number {
  let n = 0;
  g.forEach((row, r) => row.forEach((on, c) => { if (on) for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (!at(g, r + dr, c + dc)) n++; }));
  return n;
}

/** Squares with at least one edge on the outside — the "count the squares round the edge" slip. */
const edgeSquares = (g: Grid): number => g.flat().filter((on, i) => {
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
function rectilinear(rng: Rng): Grid {
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
function opts(rng: Rng, prompt: string, answer: number, bad: number[], extra: Partial<Question>): Question {
  const ds = [...new Set(bad.filter(v => v >= 1 && v !== answer))].slice(0, 3);
  if (answer >= 20 && !ds.some(v => v % 10 === answer % 10)) {
    const ten = answer > 10 && rng() < 0.5 ? answer - 10 : answer + 10;
    if (ds.length === 3) ds.pop();
    ds.push(ten);
  }
  const max = Math.max(60, answer + 10, ...ds);
  return numQ(rng, prompt, answer, { min: 1, max, distractors: ds, hint: 'Count carefully, one at a time', hintIsData: false, ...extra });
}

const SAY = (g: Grid) => ({ visual: { type: 'symmetry' as const, grid: rows(g), mirror: false as const } });

/** d1: area of a rectangle of at most 24 squares. */
function rectArea(rng: Rng): Question {
  let w: number, h: number;
  do { w = ri(rng, 2, 6); h = ri(rng, 2, 5); } while (w * h > 24);
  const g = fill(w, h), a = w * h;
  return opts(rng, 'What is the area? Count the squares.', a, [perimeter(g), w + h, w * h + w], { say: 'What is the area? Count the squares.', ...SAY(g) });
}

/** d2: area or perimeter of a rectilinear shape, half and half. */
function shape(rng: Rng): Question {
  const g = rectilinear(rng), a = cells(g), p = perimeter(g);
  if (rng() < 0.5) return opts(rng, 'What is the area? Count the squares.', a, [p, edgeSquares(g), a + 1], { say: 'What is the area? Count the squares.', ...SAY(g) });
  const prompt = 'Each square has 1 cm sides. What is the perimeter in cm?';
  return opts(rng, prompt, p, [a, p / 2, edgeSquares(g), p - 2], { say: 'Each square has 1 centimetre sides. What is the perimeter in centimetres?', ...SAY(g) });
}

/** d3: perimeter of a rectangle or square from its sides, in cm or m, no grid. */
function calc(rng: Rng): Question {
  const unit = pick(rng, ['cm', 'm']), word = unit === 'cm' ? 'centimetres' : 'metres';
  if (rng() < 0.3) {
    const s = ri(rng, 2, 15), p = 4 * s;
    return opts(rng, `A square has ${s} ${unit} sides. What is its perimeter in ${unit}?`, p, [s * s, 2 * s, 3 * s],
      { say: `A square has ${s} ${word} sides. What is its perimeter in ${word}?` });
  }
  const l = ri(rng, 3, 15);
  let b = ri(rng, 2, 14); if (b >= l) b = l - 1;
  const p = 2 * (l + b);
  return opts(rng, `A rectangle is ${l} ${unit} long and ${b} ${unit} wide. What is its perimeter in ${unit}?`, p, [l * b, l + b, 2 * l + b],
    { say: `A rectangle is ${l} ${word} long and ${b} ${word} wide. What is its perimeter in ${word}?` });
}

export const y4Area: Generator = (level: Difficulty, rng) => (level === 1 ? rectArea : level === 2 ? shape : calc)(rng);
