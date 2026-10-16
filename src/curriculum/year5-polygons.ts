// y5-polygons (#1211): regular or irregular? (NC 5M46). A polygon is regular when all its sides AND all its angles are equal.
// d1 a regular triangle, square, pentagon or hexagon against clearly irregular shapes; d2 the traps (a rhombus has equal sides
// but not equal angles, a rectangle equal angles but not equal sides, an isosceles triangle neither) and a regular shape at a
// random turn, with side lengths labelled; d3 the reasoning in text, no drawing. Drawn with the `geometry` polygon part from exact vertices.
import type { Difficulty, GeoPart, Generator, Question, Rng } from './types';
import { ri, pick, shuffle } from './util';

type Poly = Extract<GeoPart, { kind: 'polygon' }>;
type Pt = [number, number];
type Tr = 0 | 1 | 2 | 3;
interface Tpl { pts: Pt[]; ticks?: Tr[]; right?: number[]; lens?: number[] }

/** A regular n-gon with circumradius 1 (so side 2·sin(π/n)); every side ticked once. */
const regular = (n: number, rot: number): Tpl => ({
  pts: Array.from({ length: n }, (_, k): Pt => [Math.sin(rot + 2 * Math.PI * k / n), -Math.cos(rot + 2 * Math.PI * k / n)]),
  ticks: Array.from({ length: n }, () => 1 as Tr),
  ...(n === 4 ? { right: [0, 1, 2, 3] } : {}),
});
const rect = (w: number, h: number): Tpl => ({ pts: [[0, 0], [w, 0], [w, h], [0, h]], ticks: [1, 2, 1, 2], right: [0, 1, 2, 3], lens: [w, h, w, h] });

/** d1: clearly irregular shapes (no label: sides are not measured). */
const CLEAR: Tpl[] = [
  { pts: [[0, 0], [6, 0], [1, 3]] }, { pts: [[0, 0], [7, 0], [2, 4]] },
  { pts: [[0, 2], [2, 0], [6, 2], [2, 4]], ticks: [1, 2, 2, 1] },
  { pts: [[0, 0], [5, 0], [6, 3], [3, 5], [-1, 3]] }, { pts: [[0, 0], [4, 0], [5, 2], [4, 4], [1, 5], [-1, 2]] },
];
/** d2 traps. Side labels are the lengths in cm, drawn at a common scale. */
const RHOMBI: Tpl[] = [
  { pts: [[0, 0], [5, 0], [8, 4], [3, 4]], ticks: [1, 1, 1, 1], lens: [5, 5, 5, 5] },
  { pts: [[0, 3], [4, 0], [8, 3], [4, 6]], ticks: [1, 1, 1, 1], lens: [5, 5, 5, 5] },
];
const RECTS: Tpl[] = [rect(4, 2), rect(5, 3), rect(6, 4), rect(6, 3)];
const OTHERS: Tpl[] = [
  { pts: [[0, 0], [6, 0], [3, 4]], ticks: [0, 1, 1], lens: [6, 5, 5] }, { pts: [[0, 0], [8, 0], [4, 3]], ticks: [0, 1, 1], lens: [8, 5, 5] },
];

/** `tpl` turned to any angle, maybe mirrored, scaled to fill the 100 × 70 frame. `cm` labels the sides. */
function draw(rng: Rng, tpl: Tpl, cm?: number[]): Poly {
  const mirror = rng() < 0.5, a = rng() * 2 * Math.PI;   // every shape, Yes or No, turns the same way: a tilt must not give the answer away
  const pts = tpl.pts.map(([x, y]): Pt => {
    const [mx, my] = [mirror ? -x : x, y];
    return [mx * Math.cos(a) - my * Math.sin(a), mx * Math.sin(a) + my * Math.cos(a)];
  });
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)], [w, h] = [Math.max(...xs) - x0, Math.max(...ys) - y0];
  const s = Math.min(52 / w, 36 / h), r2 = (n: number) => Math.round(n * 100) / 100;
  const [ox, oy] = [50 - w * s / 2, 33 - h * s / 2];
  const out: Poly = { kind: 'polygon', pts: pts.map(([x, y]): Pt => [r2(ox + (x - x0) * s), r2(oy + (y - y0) * s)]) };
  if (tpl.ticks) out.ticks = tpl.ticks;
  if (tpl.right) out.right = tpl.right;
  if (cm) out.sides = cm.map(l => `${l} cm`);
  return out;
}

const card = (rng: Rng, prompt: string, say: string, yes: boolean, extra: Partial<Question>): Question => ({
  prompt, say, answer: yes ? 'Yes' : 'No', options: shuffle(rng, ['Yes', 'No']), wide: true,
  hint: 'Regular means all the sides AND all the angles are equal', hintIsData: false, ...extra,
});

/** d3: statements, each hand-checked. A regular polygon has equal sides and equal angles; either alone is not enough. */
export const STATEMENTS: { text: string; regular: boolean }[] = [
  { text: 'A hexagon has 6 equal sides and 6 equal angles. Regular?', regular: true },
  { text: 'A square has 4 equal sides and 4 equal angles. Regular?', regular: true },
  { text: 'A triangle has 3 equal sides and 3 equal angles. Regular?', regular: true },
  { text: 'A pentagon has 5 equal sides and 5 equal angles. Regular?', regular: true },
  { text: 'A shape has all sides equal and all angles equal. Regular?', regular: true },
  { text: 'An octagon has 8 equal sides and 8 equal angles. Regular?', regular: true },
  { text: 'A shape has 4 equal angles. Must it be regular?', regular: false },
  { text: 'A shape has 4 equal sides. Must it be regular?', regular: false },
  { text: 'A rectangle has 4 right angles. Is it always regular?', regular: false },
  { text: 'A rhombus has 4 equal sides. Is it always regular?', regular: false },
  { text: 'A pentagon has 5 equal sides but unequal angles. Regular?', regular: false },
  { text: 'A hexagon has 6 equal angles but unequal sides. Regular?', regular: false },
];

export const y5Polygons: Generator = (d: Difficulty, rng: Rng): Question => {
  const yes = rng() < 0.5;
  if (d === 3) {
    const s = pick(rng, STATEMENTS.filter(x => x.regular === yes));
    return card(rng, s.text, `${s.text} Yes or no?`, yes, {});
  }
  const prompt = 'Is this polygon regular?', say = 'Is this polygon regular? Yes or no?';
  if (d === 1) {
    const tpl = yes ? regular(pick(rng, [3, 4, 5, 6]), 0) : pick(rng, CLEAR);
    return card(rng, prompt, say, yes, { visual: { type: 'geometry', parts: [draw(rng, tpl)] } });
  }
  if (yes) {
    const n = pick(rng, [3, 4, 5, 6]), cm = ri(rng, 3, 8);
    return card(rng, prompt, say, true, { visual: { type: 'geometry', parts: [draw(rng, regular(n, 0), Array(n).fill(cm))] } });
  }
  const tpl = rng() < 0.8 ? pick(rng, rng() < 0.5 ? RHOMBI : RECTS) : pick(rng, OTHERS);
  return card(rng, prompt, say, false, { visual: { type: 'geometry', parts: [draw(rng, tpl, tpl.lens)] } });
};
