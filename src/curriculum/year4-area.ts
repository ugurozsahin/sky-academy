// y4-area (#1151): area by counting squares, and perimeter. Shapes are `#`/`.` grids drawn by the `symmetry` visual
// with `mirror: false`. d1 counts a rectangle's squares; d2 uses rectilinear L, T and U shapes and asks for area or
// perimeter by turns; d3 calculates a rectangle's perimeter from its sides, no grid. Area is in squares, never cm².
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick } from './util';
import { fill, cells, rows, perimeter, edgeSquares, rectilinear, opts, type Grid } from './gridshape';

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
