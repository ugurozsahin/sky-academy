// y5-3d (#1208): 3-D shapes from 2-D representations (NC 5M41). No 3-D drawing: d1 names a solid from its faces in text; d2 and d3 draw
// a six-square net on the squares grid (`symmetry` visual, `mirror: false`) and ask "Does this net fold into a cube?". d2 uses the
// 11 nets as written against obvious non-nets; d3 turns and flips them, against near misses with no 2 × 2 block and no row of five.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ, SHAPES_3D, sameShape } from './util';

/** The 11 nets of a cube, one per shape up to turning and flipping (the unit test folds each one to check). */
export const CUBE_NETS: readonly (readonly string[])[] = [
  ['#...', '####', '#...'], ['#...', '####', '.#..'], ['#...', '####', '..#.'], ['#...', '####', '...#'], ['.#..', '####', '.#..'], ['.#..', '####', '..#.'],
  ['##..', '.###', '.#..'], ['##..', '.###', '..#.'], ['##..', '.###', '...#'], ['##..', '.##.', '..##'], ['###..', '..###'],
];
/** Six-square shapes that do not fold into a cube, and are not obviously so: no 2 × 2 block and no row of five. */
export const NEAR_MISSES: readonly (readonly string[])[] = [
  ['####', '#.#.'], ['####', '#..#'], ['####', '#...', '#...'], ['####', '.#..', '.#..'], ['###.', '#.##'], ['###.', '..##', '..#.'],
  ['###.', '..##', '...#'], ['###.', '..#.', '..##'], ['###', '#.#', '#..'], ['###', '.#.', '##.'], ['##.', '.##', '##.'], ['####.', '...##'],
];
/** Six-square shapes that plainly cannot fold: a 2 × 3 block, a row of five with one extra, or a 2 × 2 block with a tail. */
export const OBVIOUS: readonly (readonly string[])[] = [
  ['###', '###'], ['##', '##', '##'], ['#####', '#....'], ['#####', '.#...'], ['#####', '..#..'], ['####', '##..'], ['####', '.##.'], ['###.', '.###'],
];

const SIZE = 7;   // a 5 × 5 box plus one empty square all round
type Rows = readonly string[];

const turn = (m: string[]): string[] => Array.from(m[0], (_, j) => m.map(r => r[j]).reverse().join(''));
const flip = (m: string[]): string[] => m.map(r => Array.from(r).reverse().join(''));

/** The shape turned a random number of quarters, maybe flipped, and set on a 7 × 7 grid with a margin of at least one empty square. */
function place(rng: Rng, shape: Rows, spin: boolean): string[] {
  let m = [...shape];
  if (spin) { for (let k = ri(rng, 0, 3); k > 0; k--) m = turn(m); if (rng() < 0.5) m = flip(m); }
  const top = ri(rng, 1, SIZE - 1 - m.length), left = ri(rng, 1, SIZE - 1 - m[0].length);
  return Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => m[r - top]?.[c - left] === '#' ? '#' : '.').join(''));
}

function netCard(rng: Rng, level: Difficulty): Question {
  const yes = rng() < 0.5;
  const shape = yes ? pick(rng, CUBE_NETS) : pick(rng, level === 2 ? OBVIOUS : NEAR_MISSES);
  return wordQ(rng, 'Does this net fold into a cube?', yes ? 'yes' : 'no', [yes ? 'no' : 'yes'], {
    say: 'Does this net fold into a cube?', hint: 'Picture folding it up. A cube has six faces and none may land on another', hintIsData: false,
    visual: { type: 'symmetry', grid: place(rng, shape, level === 3), mirror: false },
  });
}

/** What each solid's faces look like in words. A cuboid has more than one description: it is the only solid with square faces and rectangles. */
const FACES: Record<string, string[]> = {
  cube: ['6 square faces, all the same size'],
  cuboid: ['6 rectangular faces', '2 square faces and 4 rectangular faces'],
  sphere: ['1 curved surface and no flat faces'],
  cylinder: ['2 flat circular faces and 1 curved surface'],
  cone: ['1 flat circular face and 1 curved surface'],
  pyramid: ['1 square face and 4 triangular faces'],
};

function nameCard(rng: Rng): Question {
  const names = SHAPES_3D.map(s => s[1]), name = pick(rng, names), faces = pick(rng, FACES[name]);
  const ds = shuffle(rng, names.filter(n => !sameShape(n, name))).slice(0, 3);
  return wordQ(rng, `Which solid has ${faces}?`, name, ds, { say: `Which solid has ${faces}?`, hint: 'Picture each solid. Count its flat faces and look at their shapes', hintIsData: false });
}

export const y5Solids: Generator = (level: Difficulty, rng) => (level === 1 ? nameCard(rng) : netCard(rng, level));
