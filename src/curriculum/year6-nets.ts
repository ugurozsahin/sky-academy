// y6-nets (#1246): 3-D shapes and their nets (NC 6M42). Nothing is drawn in 3-D. d1 counts the faces, edges or vertices of a prism or pyramid,
// d2 shows a list of net faces and asks whether it makes a named solid (yes/no), d3 folds a lettered cube net and asks which letter is opposite another.
// Solid names are too wide for a bubble (R-LBL), so they sit on the card and the bubbles are numbers, yes/no or letters.
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, ri, shuffle, wordQ, sameShape } from './util';

/** The 11 nets of a cube, one per shape up to turning and flipping (the unit test checks each is a net and no two are the same). */
export const CUBE_NETS: readonly (readonly string[])[] = [
  ['#...', '####', '#...'], ['#...', '####', '.#..'], ['#...', '####', '..#.'], ['#...', '####', '...#'], ['.#..', '####', '.#..'], ['.#..', '####', '..#.'],
  ['##..', '.###', '.#..'], ['##..', '.###', '..#.'], ['##..', '.###', '...#'], ['##..', '.##.', '..##'], ['###..', '..###'],
];
const SIZE = 7;   // a 5 × 5 box plus one empty square all round; a lettered grid is at most 7 columns wide
const turn = (m: string[]): string[] => Array.from(m[0], (_, j) => m.map(r => r[j]).reverse().join(''));
const flip = (m: string[]): string[] => m.map(r => Array.from(r).reverse().join(''));
/** The net turned a random number of quarters, maybe flipped, and set on a 7 × 7 grid with an empty margin. */
function place(rng: Rng, shape: readonly string[]): string[] {
  let m = [...shape];
  for (let k = ri(rng, 0, 3); k > 0; k--) m = turn(m);
  if (rng() < 0.5) m = flip(m);
  const top = ri(rng, 1, SIZE - 1 - m.length), left = ri(rng, 1, SIZE - 1 - m[0].length);
  return Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => m[r - top]?.[c - left] === '#' ? '#' : '.').join(''));
}

export interface Solid { name: string; faces: number; edges: number; vertices: number; net: string; near: string }
/** Counts are faces / edges / vertices. `net` lists the faces of the net; `near` is the neighbouring solid whose counts make the confusing decoy. */
export const SOLIDS: readonly Solid[] = [
  { name: 'triangular prism', faces: 5, edges: 9, vertices: 6, net: '2 triangles, 3 rectangles', near: 'triangular-based pyramid' },
  { name: 'pentagonal prism', faces: 7, edges: 15, vertices: 10, net: '2 pentagons, 5 rectangles', near: 'pentagonal-based pyramid' },
  { name: 'hexagonal prism', faces: 8, edges: 18, vertices: 12, net: '2 hexagons, 6 rectangles', near: 'pentagonal prism' },
  { name: 'triangular-based pyramid', faces: 4, edges: 6, vertices: 4, net: '4 triangles', near: 'triangular prism' },
  { name: 'square-based pyramid', faces: 5, edges: 8, vertices: 5, net: '1 square, 4 triangles', near: 'cube' },
  { name: 'pentagonal-based pyramid', faces: 6, edges: 10, vertices: 6, net: '1 pentagon, 5 triangles', near: 'pentagonal prism' },
  { name: 'cube', faces: 6, edges: 12, vertices: 8, net: '6 squares', near: 'square-based pyramid' },
  { name: 'cuboid', faces: 6, edges: 12, vertices: 8, net: '6 rectangles', near: 'square-based pyramid' },
];
const byName = (n: string): Solid => SOLIDS.find(s => s.name === n)!;
const PROPS = ['faces', 'edges', 'vertices'] as const;

/** Up to three distinct positive counts other than the answer, the named slips first and then the nearest numbers. */
function countDecoys(rng: Rng, answer: number, named: number[]): string[] {
  const ds: number[] = [];
  for (const v of shuffle(rng, named)) if (v !== answer && v >= 1 && !ds.includes(v)) ds.push(v);
  for (let s = 1; ds.length < 3; s++) for (const v of [answer + s, answer - s]) if (v >= 1 && v !== answer && !ds.includes(v) && ds.length < 3) ds.push(v);
  return ds.map(String);
}

function countCard(rng: Rng): Question {
  const s = pick(rng, SOLIDS), prop = pick(rng, PROPS), others = PROPS.filter(p => p !== prop);
  const prompt = `How many ${prop} does a ${s.name} have?`;
  return wordQ(rng, prompt, String(s[prop]), countDecoys(rng, s[prop], [...others.map(p => s[p]), byName(s.near)[prop]]), {
    say: prompt, hint: 'Picture the solid. Count the flat faces, the edges where they meet and the corners', hintIsData: false,
  });
}

function netCard(rng: Rng): Question {
  const s = pick(rng, SOLIDS), yes = rng() < 0.5;
  let asked = s;
  if (!yes) {
    const others = SOLIDS.filter(o => !sameShape(o.name, s.name) && o.net !== s.net);
    const alike = others.filter(o => o.faces === s.faces);
    asked = pick(rng, alike.length ? alike : others);
  }
  return wordQ(rng, `Is it a ${asked.name}?`, yes ? 'yes' : 'no', [yes ? 'no' : 'yes'], {
    visual: { type: 'sentence', text: `Net: ${s.net}.` }, say: `A net has ${s.net}. Does it fold into a ${asked.name}?`, hint: 'Count the faces and look at their shapes', hintIsData: false,
  });
}


interface Cube { bottom: number; top: number; north: number; south: number; east: number; west: number }
/** Roll the cube one square (dr rows, dc columns): the face it lands on is the new bottom. Opposite faces sum to 5. */
function roll(c: Cube, dr: number, dc: number): Cube {
  if (dc === 1) return { ...c, bottom: c.east, east: c.top, top: c.west, west: c.bottom };
  if (dc === -1) return { ...c, bottom: c.west, west: c.top, top: c.east, east: c.bottom };
  if (dr === 1) return { ...c, bottom: c.south, south: c.top, top: c.north, north: c.bottom };
  return { ...c, bottom: c.north, north: c.top, top: c.south, south: c.bottom };
}
interface FoldCell { r: number; c: number; face: number }
/** The six `#` cells of a cube net, each with the face (0–5) it folds to, found by rolling a cube over them (a net has no 2 × 2 block, so no cell is reached by two routes). */
export function foldCells(grid: string[]): FoldCell[] {
  const on = (r: number, c: number) => grid[r]?.[c] === '#';
  const start = grid.flatMap((row, r) => Array.from(row, (_, c) => (on(r, c) ? [r, c] : null))).find(x => x)!;
  const out: FoldCell[] = [], seen = new Set<string>();
  const stack: [number, number, Cube][] = [[start[0], start[1], { bottom: 0, top: 5, north: 1, south: 4, east: 2, west: 3 }]];
  while (stack.length) {
    const [r, c, cube] = stack.pop()!;
    if (seen.has(`${r},${c}`)) continue;
    seen.add(`${r},${c}`); out.push({ r, c, face: cube.bottom });
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (on(r + dr, c + dc)) stack.push([r + dr, c + dc, roll(cube, dr, dc)]);
  }
  if (out.length !== 6) throw new Error(`y6-nets: a cube net has six squares, found ${out.length}`);
  return out;
}

const LETTERS = ['A', 'B', 'C', 'D'];
/** d3: a cube net with one opposite pair shaded and the other four faces lettered; which letter is opposite the asked one? */
function oppositeCard(rng: Rng): Question {
  const grid = place(rng, pick(rng, CUBE_NETS));
  const cells = foldCells(grid), pair = pick(rng, [0, 1, 2]);
  const letters = shuffle(rng, LETTERS), lettered = cells.filter(c => c.face !== pair && c.face !== 5 - pair);
  const letterAt = new Map<number, string>(lettered.map((c, i) => [c.face, letters[i]]));
  const out = grid.map((row, r) => Array.from(row, (ch, c) => {
    const cell = cells.find(x => x.r === r && x.c === c);
    return !cell ? ch : letterAt.get(cell.face) ?? '#';
  }).join(''));
  const asked = pick(rng, LETTERS), answer = letterAt.get(5 - [...letterAt].find(([, l]) => l === asked)![0])!;
  const prompt = `Fold it into a cube. Which letter is opposite ${asked}?`;
  return wordQ(rng, prompt, answer, LETTERS.filter(l => l !== asked && l !== answer), {
    visual: { type: 'symmetry', grid: out, mirror: false },
    say: `${prompt} The net is the shaded and lettered squares.`, hint: 'Opposite faces never touch when the cube is folded', hintIsData: false,
  });
}

export const y6Nets: Generator = (d: Difficulty, rng: Rng): Question => d === 1 ? countCard(rng) : d === 2 ? netCard(rng) : oppositeCard(rng);
