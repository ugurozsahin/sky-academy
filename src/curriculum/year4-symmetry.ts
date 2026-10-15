// y4-symmetry (#1155): lines of symmetry in any orientation, and completing a symmetric figure (NC 4M36–37).
// d1 which capital letter has a horizontal line of symmetry; d2 how many lines of symmetry a grid shape has,
// shown in one of its four quarter turns so a line may be vertical, horizontal or diagonal; d3 which lettered
// square completes a pattern across the dashed vertical line. The d2 answer is counted from the drawn grid
// (`symmetryLines`), so the picture and the key cannot disagree. A d3 card always offers the cell a child gets by
// copying the square across without flipping it (the "slide, not flip" slip).
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';

// Letters that look the same folded top to bottom; B and K are left out because their halves differ in the game font.
const HORIZONTAL = ['C', 'D', 'E', 'H', 'I', 'O', 'X'];
const NOT_HORIZONTAL = ['F', 'G', 'J', 'L', 'N', 'P', 'Q', 'R', 'S', 'Z'];

// Every shape with a line of symmetry touches all four edges of its square grid, so the grid's own reflections are
// the shape's and an off-centre shape can never lose a line it really has. S, F and N have none and may sit anywhere.
const SHAPES: string[][] = [
  ['..#..', '..#..', '#####', '..#..', '..#..'],     // plus: 4
  ['#####', '#...#', '#...#', '#...#', '#####'],     // ring: 4
  ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],     // X: 4
  ['..#..', '.#.#.', '#...#', '.#.#.', '..#..'],     // diamond: 4
  ['#...#', '#...#', '#####', '#...#', '#...#'],     // H: 2
  ['#####', '..#..', '..#..', '..#..', '#####'],     // I-beam: 2
  ['#####', '..#..', '..#..', '..#..', '..#..'],     // T: 1
  ['#....', '#....', '#....', '#....', '#####'],     // equal-armed L: 1, diagonal
  ['#....', '##...', '###..', '####.', '#####'],     // staircase triangle: 1, diagonal
  ['..#..', '.###.', '#.#.#', '..#..', '..#..'],     // arrow: 1
  ['.....', '..##.', '.##..', '.....', '.....'],     // S tetromino: 0
  ['.....', '..##.', '.##..', '..#..', '.....'],     // F pentomino: 0
  ['#...#', '##..#', '#.#.#', '#..##', '#...#'],     // N: 0 (turns onto itself, never flips)
];

type Grid = string[];
const rotate = (g: Grid): Grid => g[0].split('').map((_, c) => g.map(row => row[c]).reverse().join(''));
const same = (a: Grid, b: Grid) => a.every((row, i) => row === b[i]);
const flipV = (g: Grid) => g.map(r => [...r].reverse().join(''));
const flipH = (g: Grid) => g.slice().reverse();
const transpose = (g: Grid) => g[0].split('').map((_, c) => g.map(row => row[c]).join(''));
const antiTranspose = (g: Grid) => flipH(flipV(transpose(g)));

/** The lines of symmetry of a square grid shape: vertical, horizontal and both diagonals, each checked by reflecting it. */
export function symmetryLines(g: Grid): { vertical: boolean; horizontal: boolean; diagonals: number; total: number } {
  const vertical = same(g, flipV(g)), horizontal = same(g, flipH(g));
  const diagonals = (same(g, transpose(g)) ? 1 : 0) + (same(g, antiTranspose(g)) ? 1 : 0);
  return { vertical, horizontal, diagonals, total: (vertical ? 1 : 0) + (horizontal ? 1 : 0) + diagonals };
}

const COUNTS = ['0', '1', '2', '4'];
const LETTERS = ['A', 'B', 'C', 'D'];

function letterCard(rng: Rng): Question {
  return wordQ(rng, 'Which letter has a horizontal line of symmetry?', pick(rng, HORIZONTAL), shuffle(rng, NOT_HORIZONTAL),
    { say: 'Which letter looks the same when you fold it top to bottom?', hint: 'Slice the letter that folds top to bottom', hintIsData: false });
}

function countCard(rng: Rng): Question {
  let g = pick(rng, SHAPES);
  for (let i = ri(rng, 0, 3); i > 0; i--) g = rotate(g);
  return {
    ...wordQ(rng, 'How many lines of symmetry does this shape have?', String(symmetryLines(g).total), COUNTS),
    options: shuffle(rng, COUNTS), visual: { type: 'symmetry', grid: g, mirror: false }, wide: false,
    hint: 'Slice how many ways it folds onto itself', hintIsData: false,
  };
}

const ROWS = 5, HALF = 3;
function completeCard(rng: Rng): Question {
  for (;;) {
    // A random left half, mirrored to make a symmetric figure of ROWS × 2·HALF squares.
    const left: string[][] = Array.from({ length: ROWS }, () => Array.from({ length: HALF }, () => (rng() < 0.5 ? '#' : '.')));
    if (left.flat().filter(x => x === '#').length < 5) continue;
    const full = left.map(row => [...row, ...[...row].reverse()]);
    const W = 2 * HALF;
    // The missing square: its copy slid across (column c + HALF) differs from its mirror image (W − 1 − c) and is empty.
    const spots: [number, number][] = [];
    for (let r = 0; r < ROWS; r++) for (const c of [0, HALF - 1]) if (left[r][c] === '#' && full[r][c + HALF] === '.') spots.push([r, c]);
    if (!spots.length) continue;
    const [r, c] = pick(rng, spots);
    const answerCell: [number, number] = [r, W - 1 - c], slideCell: [number, number] = [r, c + HALF];
    const empties: [number, number][] = [];
    for (let rr = 0; rr < ROWS; rr++) for (let cc = HALF; cc < W; cc++)
      if (full[rr][cc] === '.' && !(rr === slideCell[0] && cc === slideCell[1])) empties.push([rr, cc]);
    if (empties.length < 2) continue;
    const cells = [answerCell, slideCell, ...shuffle(rng, empties).slice(0, 2)];
    const order = shuffle(rng, cells);
    const grid = full.map(row => row.slice());
    grid[answerCell[0]][answerCell[1]] = '.';
    order.forEach((cell, i) => { grid[cell[0]][cell[1]] = LETTERS[i]; });
    return {
      prompt: 'Which square makes the pattern symmetrical?', say: 'Which lettered square makes the pattern the same on both sides of the dashed line?',
      answer: LETTERS[order.indexOf(answerCell)], options: LETTERS.slice(), wide: false,
      visual: { type: 'symmetry', grid: grid.map(row => row.join('')) }, hint: 'Slice the square that mirrors across the line', hintIsData: false,
    };
  }
}

export const y4Symmetry: Generator = (d: Difficulty, rng: Rng): Question => d === 1 ? letterCard(rng) : d === 2 ? countCard(rng) : completeCard(rng);
