// y3-perimeter (#1098): perimeter by counting the unit edges round a shape on squared paper. The answer is counted from the
// grid itself, never from a formula, and the area (counting squares) is always among the decoys — it is the misconception.
// d1: small rectangles · d2: rectangles up to 6 × 4 and L-shapes · d3: two corner notches on up to 8 × 8, or a length and width in words.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, shuffle, wordQ } from './util';

const cm = (n: number) => `${n} cm`;
const lead = (n: number) => String(n)[0];

/** Unit edges on the boundary: every `#` side that touches a `.` or the edge of the grid. */
export function perimeterOf(grid: readonly string[]): number {
  let edges = 0;
  grid.forEach((row, r) => [...row].forEach((c, k) => {
    if (c !== '#') return;
    for (const [dr, dk] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if ((grid[r + dr]?.[k + dk] ?? '.') !== '#') edges++;
  }));
  return edges;
}
export const areaOf = (grid: readonly string[]) => grid.join('').split('#').length - 1;

/** A w × h block of squares with the given corner blocks (bw × bh) cut away: corner 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right. */
function shape(w: number, h: number, cuts: [number, number, number][]): string[] {
  const grid = Array.from({ length: h }, () => Array<string>(w).fill('#'));
  for (const [corner, bw, bh] of cuts) {
    for (let r = 0; r < bh; r++) for (let k = 0; k < bw; k++) grid[corner < 2 ? r : h - 1 - r][corner % 2 === 0 ? k : w - 1 - k] = '.';
  }
  return grid.map(r => r.join(''));
}

function gridShape(d: Difficulty, rng: Rng): string[] {
  if (d === 1) return shape(ri(rng, 2, 4), ri(rng, 1, 3), []);
  if (d === 2 && rng() < 0.5) return shape(ri(rng, 2, 6), ri(rng, 1, 4), []);
  if (d === 2) { const w = ri(rng, 3, 6), h = ri(rng, 2, 4); return shape(w, h, [[ri(rng, 0, 3), ri(rng, 1, w - 1), ri(rng, 1, h - 1)]]); }
  const w = ri(rng, 5, 8), h = ri(rng, 4, 8), [a, b] = shuffle(rng, [0, 1, 2, 3]);
  return shape(w, h, [[a, ri(rng, 1, 2), ri(rng, 1, 2)], [b, ri(rng, 1, 2), ri(rng, 1, 2)]]);
}

/** Three decoys, the area first: half the perimeter, one edge missed or doubled, corners counted twice; from 20 up, a ten out too. */
function decoys(p: number, area: number, rng: Rng): number[] {
  const named = shuffle(rng, [p / 2, p - 2, p + 2, p + 4]);
  const first = [area];
  if (p >= 20) {
    first.push(rng() < 0.5 ? p - 10 : p + 10);
    const share = [p - 2, p + 2, p + 4, p - 4].find(v => lead(v) === lead(p));
    if (share !== undefined) first.push(share);
  }
  const out: number[] = [];
  for (const v of [...first, ...named, p - 4, p + 6]) if (v > 0 && v !== p && !out.includes(v)) out.push(v);
  return out.slice(0, 3);
}

function card(rng: Rng, p: number, area: number, prompt: string, say: string, extra: Partial<Question>): Question {
  return wordQ(rng, prompt, cm(p), decoys(p, area, rng).map(cm), { say, hint: 'Count the edges round the outside', hintIsData: false, ...extra });
}

export const y3Perimeter: Generator = (d: Difficulty, rng) => {
  if (d === 3 && rng() < 0.35) {
    let l: number, w: number;
    do { l = ri(rng, 4, 9); w = ri(rng, 2, 6); } while (l <= w || l * w === 2 * (l + w));
    return card(rng, 2 * (l + w), l * w, `A rectangle is ${l} cm long and ${w} cm wide. What is its perimeter?`,
      `A rectangle is ${l} centimetres long and ${w} centimetres wide. What is its perimeter?`, {});
  }
  let grid: string[];
  do grid = gridShape(d, rng); while (areaOf(grid) === perimeterOf(grid));
  return card(rng, perimeterOf(grid), areaOf(grid), 'Each square is 1 cm. What is the perimeter?',
    'Each square is 1 centimetre. What is the perimeter of the shape?', { visual: { type: 'symmetry', grid, mirror: false } });
};
