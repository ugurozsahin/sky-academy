// y4-shapes (#1154): classify triangles and quadrilaterals by their properties (NC 4M34).
// d1 a property in words, "is it an X?" (Yes / No), beside a drawing of the shape described; d2 three lettered triangles, "Which is the isosceles triangle?";
// d3 three lettered quadrilaterals. The picture is the `geometry` visual's `polygon` part, drawn from exact vertices.
// `IS_A` keeps definition disputes off every card (inclusive v exclusive: a square is a rectangle in some schools and not
// in others): the answer is always the shape of exactly the asked class, and a decoy is never a member of it.
import type { Difficulty, GeoPart, Generator, Question, Rng } from './types';
import { pick, shuffle, q } from './util';

type Poly = Extract<GeoPart, { kind: 'polygon' }>;
type Pt = [number, number];
export type Cls = 'equilateral' | 'isosceles' | 'scalene' | 'right-angled'
  | 'square' | 'rectangle' | 'rhombus' | 'parallelogram' | 'trapezium' | 'kite' | 'irregular';
interface Tpl { pts: Pt[]; ticks?: (0 | 1 | 2 | 3)[]; right?: number[] }

const R4 = [0, 1, 2, 3];
const rect = (w: number, h: number): Tpl => ({ pts: [[0, 0], [w, 0], [w, h], [0, h]], ticks: [1, 2, 1, 2], right: R4 });

/** Vertex templates per class. Every class has more than one variant, so the same picture does not come round each time. */
export const SHAPES: Record<Cls, Tpl[]> = {
  equilateral: [{ pts: [[0, 0], [4, 0], [2, 2 * Math.sqrt(3)]], ticks: [1, 1, 1] }],
  isosceles: [3, 4, 5].map(h => ({ pts: [[0, 0], [4, 0], [2, h]] as Pt[], ticks: [0, 1, 1] as (0 | 1)[] })),
  scalene: [{ pts: [[0, 0], [6, 0], [1, 3]] }, { pts: [[0, 0], [7, 0], [2, 4]] }],
  'right-angled': [{ pts: [[0, 0], [4, 0], [0, 3]], right: [0] }, { pts: [[0, 0], [6, 0], [0, 4]], right: [0] }],
  square: [{ pts: [[0, 0], [3, 0], [3, 3], [0, 3]], ticks: [1, 1, 1, 1], right: R4 }, { pts: [[1.5, 0], [3, 1.5], [1.5, 3], [0, 1.5]], ticks: [1, 1, 1, 1], right: R4 }],
  rectangle: [rect(4, 2), rect(5, 3), rect(5, 2), rect(4, 3)],
  rhombus: [{ pts: [[0, 0], [5, 0], [8, 4], [3, 4]], ticks: [1, 1, 1, 1] }, { pts: [[0, 2], [3, 0], [6, 2], [3, 4]], ticks: [1, 1, 1, 1] }],
  parallelogram: [{ pts: [[0, 0], [5, 0], [7, 3], [2, 3]], ticks: [1, 2, 1, 2] }, { pts: [[0, 0], [4, 0], [6, 2], [2, 2]], ticks: [1, 2, 1, 2] }],
  trapezium: [{ pts: [[0, 0], [6, 0], [4, 3], [1, 3]] }, { pts: [[0, 0], [6, 0], [5, 3], [1, 3]], ticks: [0, 1, 0, 1] }],
  kite: [{ pts: [[0, 2], [2, 0], [6, 2], [2, 4]], ticks: [1, 2, 2, 1] }, { pts: [[0, 3], [2, 0], [4, 3], [2, 7]], ticks: [1, 1, 2, 2] }],
  irregular: [{ pts: [[0, 0], [5, 0], [4, 3], [-1, 4]] }],   // decoy only: no parallel sides, no equal sides, no right angle
};

/** The classes a shape of class `c` also belongs to under the inclusive definitions (so none may be a decoy for them). */
export const IS_A: Partial<Record<Cls, Cls[]>> = {
  equilateral: ['isosceles'], 'right-angled': ['scalene'],
  square: ['rectangle', 'rhombus', 'parallelogram', 'kite'], rectangle: ['parallelogram'], rhombus: ['parallelogram', 'kite'],
};
const PARALLEL_FAMILY: Cls[] = ['square', 'rectangle', 'rhombus', 'parallelogram'];
const TRIANGLES: Cls[] = ['equilateral', 'isosceles', 'scalene', 'right-angled'];
const QUADS: Cls[] = ['square', 'rectangle', 'rhombus', 'parallelogram', 'trapezium', 'kite'];

/** May a shape of class `d` sit on a card that asks for `asked`? Never a member of it, and a trapezium never beside the parallelogram family. */
export function decoyOk(asked: Cls, d: Cls): boolean {
  if (d === asked || IS_A[d]?.includes(asked)) return false;
  if (asked === 'isosceles' && d === 'equilateral') return false;   // some schools count it, some do not
  const fam = (c: Cls) => PARALLEL_FAMILY.includes(c);
  return !((asked === 'trapezium' && fam(d)) || (d === 'trapezium' && fam(asked)));
}

/** The trapezium rule, both ways round: a trapezium and a parallelogram-family shape never share a card. */
const trapClash = (a: Cls, b: Cls) => (a === 'trapezium' && PARALLEL_FAMILY.includes(b)) || (b === 'trapezium' && PARALLEL_FAMILY.includes(a));

const TERM: Record<Cls, string> = {
  equilateral: 'an equilateral triangle', isosceles: 'an isosceles triangle', scalene: 'a scalene triangle', 'right-angled': 'a right-angled triangle',
  square: 'a square', rectangle: 'a rectangle', rhombus: 'a rhombus', parallelogram: 'a parallelogram', trapezium: 'a trapezium', kite: 'a kite', irregular: 'an irregular shape',
};
const THE: Record<Cls, string> = { ...TERM, equilateral: 'the equilateral triangle', isosceles: 'the isosceles triangle', scalene: 'the scalene triangle', 'right-angled': 'the right-angled triangle' };

const LETTERS = ['A', 'B', 'C'], CELLS = [2, 35, 68], W = 29, TOP = 6, H = 48;

/** `tpl` turned a random multiple of 90°, maybe mirrored, scaled to fit cell `i` (exact coordinates, 2 decimals) and lettered. */
function draw(rng: Rng, tpl: Tpl, i: number, lettered = true): Poly {
  const turns = Math.floor(rng() * 4), mirror = rng() < 0.5;
  let pts = tpl.pts.map(([x, y]): Pt => mirror ? [-x, y] : [x, y]);
  for (let k = 0; k < turns; k++) pts = pts.map(([x, y]): Pt => [-y, x]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)], [w, h] = [Math.max(...xs) - x0, Math.max(...ys) - y0];
  const s = Math.min(W / w, H / h) * (0.75 + 0.25 * rng()), r2 = (n: number) => Math.round(n * 100) / 100;
  const [ox, oy] = [CELLS[i] + (W - w * s) / 2, TOP + (H - h * s) / 2];
  const out: Poly = { kind: 'polygon', pts: pts.map(([x, y]): Pt => [r2(ox + (x - x0) * s), r2(oy + (y - y0) * s)]) };
  if (lettered) out.label = LETTERS[i];
  if (tpl.ticks) out.ticks = tpl.ticks;
  if (tpl.right) out.right = tpl.right;
  return out;
}

/** d1 statements: each property is true of exactly the `yes` term, and false of every `no` term. None turns on a definition dispute. */
const STATEMENTS: { noun: 'triangle' | 'shape'; has: string; yes: Cls; no: Cls[] }[] = [
  { noun: 'triangle', has: '3 equal sides', yes: 'equilateral', no: ['scalene', 'right-angled'] },
  { noun: 'triangle', has: '2 equal sides only', yes: 'isosceles', no: ['scalene'] },
  { noun: 'triangle', has: 'no equal sides', yes: 'scalene', no: ['equilateral', 'isosceles'] },
  { noun: 'triangle', has: 'one 90° angle', yes: 'right-angled', no: ['equilateral'] },
  { noun: 'shape', has: '4 right angles, unequal sides', yes: 'rectangle', no: ['square', 'rhombus'] },
  { noun: 'shape', has: '4 equal sides, no right angle', yes: 'rhombus', no: ['square', 'rectangle'] },
  { noun: 'shape', has: '2 parallel pairs, no right angle', yes: 'parallelogram', no: ['rectangle'] },
  { noun: 'shape', has: 'exactly 1 pair of parallel sides', yes: 'trapezium', no: ['parallelogram', 'rectangle', 'kite'] },
];
export { STATEMENTS };

/** A card of three shapes of `pool`'s kind: every shape has the same number of sides, so the irregular decoy is a quadrilateral and joins only the quadrilateral pool. */
function cardOf(rng: Rng, pool: Cls[], d: number): Question {
  const asked = pick(rng, pool);
  const decoys: Cls[] = [];
  for (const c of shuffle(rng, pool === QUADS ? [...pool, 'irregular' as Cls] : pool).filter(c => decoyOk(asked, c)))
    if (decoys.length < 2 && decoys.every(o => !trapClash(o, c))) decoys.push(c);   // the decoys keep the trapezium rule between themselves too
  if (decoys.length < 2) throw new Error(`y4-shapes: too few decoys for ${asked}`);
  const classes = shuffle(rng, [asked, ...decoys]);
  const parts = classes.map((c, i) => draw(rng, pick(rng, SHAPES[c]), i));
  return {
    ...q(`Which is ${d === 2 ? THE[asked] : TERM[asked]}?`), answer: LETTERS[classes.indexOf(asked)], options: shuffle(rng, LETTERS.slice()),
    visual: { type: 'geometry', parts }, hint: 'Slice the right letter', hintIsData: false,
  };
}

/** The card for one statement. Triangles say the adjective ("Is it scalene?"), shapes the noun; a long one is spoken with its own "Yes or no". */
function statement(s: typeof STATEMENTS[number], term: Cls) {
  const prompt = `A ${s.noun} has ${s.has}. Is it ${s.noun === 'triangle' ? term : TERM[term]}?`;
  return { prompt, say: `${prompt} Yes or no?` };
}

export const y4Shapes: Generator = (d: Difficulty, rng: Rng): Question => {
  if (d === 1) {
    const s = pick(rng, STATEMENTS), yes = rng() < 0.5, term = yes ? s.yes : pick(rng, s.no);
    return {
      ...statement(s, term), answer: yes ? 'Yes' : 'No', options: shuffle(rng, ['Yes', 'No']), wide: true,
      // the shape the statement describes, drawn in the middle cell with no letter: the child checks the property against a picture (#2271).
      // Drawn the same way every time (first template, upright): the repeat key reads a polygon's points, so a re-rolled turn would make one statement look new.
      visual: { type: 'geometry', parts: [draw(() => 0.2, SHAPES[s.yes][0], 1, false)] },
      hint: 'Check each property', hintIsData: false,
    };
  }
  return cardOf(rng, d === 2 ? TRIANGLES : QUADS, d);
};
