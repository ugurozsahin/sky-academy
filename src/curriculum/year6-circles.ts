// y6-circles (#1248): the parts of a circle, and diameter = 2 × radius (NC 6M44). d1 names a lettered part in a drawing (the bubbles are the
// letters, "circumference" is too wide for one, R-LBL), d2 converts a radius to a diameter or back, d3 reasons with two circles side by side,
// a radius with a half, or a circle that just fits a square. Drawn with the `geometry` parts, the radius and diameter exact to the data.
import type { Difficulty, GeoPart, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';

export const C: [number, number] = [50, 36];
export const R = 26;
type Pt = [number, number];
const round = (n: number) => Math.round(n * 100) / 100;
/** The point `r` from `from` at `deg` (anticlockwise from the right; the page's y runs down), to 0.01. */
export const polar = (from: Pt, deg: number, r: number): Pt => [round(from[0] + r * Math.cos(deg * Math.PI / 180)), round(from[1] - r * Math.sin(deg * Math.PI / 180))];

const radiusSeg = (c: Pt, r: number, deg: number, label?: string): GeoPart => ({ kind: 'segment', a: c, b: polar(c, deg, r), label, labelAt: polar(c, deg, r + 6) });
const diameterSeg = (c: Pt, r: number, deg: number, label?: string): GeoPart => ({ kind: 'segment', a: polar(c, deg + 180, r), b: polar(c, deg, r), label, labelAt: polar(c, deg, r + 6) });

const PARTS = ['radius', 'diameter', 'circumference'] as const;
type Part = typeof PARTS[number];

/** d1: A, B and C name the radius, the diameter and the circumference in a shuffled order; the card asks for one. */
function partCard(rng: Rng): Question {
  const ask = pick(rng, PARTS), letters = shuffle(rng, ['A', 'B', 'C']), at = Object.fromEntries(PARTS.map((p, i) => [p, letters[i]])) as Record<Part, string>;
  const dDeg = pick(rng, [0, 10, -10]), rDeg = pick(rng, [135, 225, 315]) + pick(rng, [-10, 0, 10]);
  const parts: GeoPart[] = [{ kind: 'circle', at: C, r: R, label: at.circumference }, diameterSeg(C, R, dDeg, at.diameter), radiusSeg(C, R, rDeg, at.radius)];
  const prompt = `Which letter shows the ${ask}?`;
  return wordQ(rng, prompt, at[ask], letters.filter(l => l !== at[ask]), {
    visual: { type: 'geometry', parts }, say: prompt, hint: ask === 'circumference' ? 'The circumference is the distance all the way round' : 'The diameter goes through the centre; the radius stops there', hintIsData: false,
  });
}

/** Four options: the named slips, then for an answer of 20 or more a decoy sharing its last digit and one sharing its leading digit (#1058). */
function numCard(rng: Rng, prompt: string, answer: number, named: number[], extra: Partial<Question>): Question {
  const lead = (v: number) => String(v)[0], ok = (v: number) => Number.isInteger(v) && v >= 1 && v !== answer;
  const ds = [...new Set(named.filter(ok))].slice(0, 3);
  if (answer >= 20) {
    const tens = [answer + 10, answer - 10].filter(ok);
    if (!ds.some(v => v % 10 === answer % 10) && tens.length) ds.splice(Math.min(ds.length, 2), 1, pick(rng, tens));
    if (!ds.some(v => lead(v) === lead(answer))) {
      const near = [1, -1, 2, -2, 3, -3, 4, -4].map(s => answer + s).find(v => ok(v) && lead(v) === lead(answer) && !ds.includes(v) && v % 10 !== answer % 10);
      if (near !== undefined) ds.splice(Math.min(ds.length, 1), 1, near);
    }
  }
  for (let s = 2; ds.length < 3; s++) for (const v of [answer + s, answer - s]) if (ok(v) && !ds.includes(v) && ds.length < 3) ds.push(v);
  return wordQ(rng, prompt, String(answer), ds.slice(0, 3).map(String), { hint: 'The diameter is twice the radius', hintIsData: false, ...extra });
}

const cm = (n: number | string) => `${n} cm`;

/** d2: a radius to a diameter, or a diameter to a radius, with the drawing labelled. */
function convertCard(rng: Rng): Question {
  const r = ri(rng, 2, 15), rDeg = pick(rng, [135, 225, 315]) + pick(rng, [-10, 0, 10]), dDeg = pick(rng, [0, 10, -10]);
  if (rng() < 0.5) {
    return numCard(rng, `Radius ${cm(r)}. Diameter = ? cm`, 2 * r, [r % 2 ? 0 : r / 2, r + 2, r * r, 3 * r], {
      visual: { type: 'geometry', parts: [{ kind: 'circle', at: C, r: R }, radiusSeg(C, R, rDeg, cm(r))] }, say: `A circle has a radius of ${r} centimetres. What is its diameter, in centimetres?` });
  }
  return numCard(rng, `Diameter ${cm(2 * r)}. Radius = ? cm`, r, [4 * r, 2 * r - 2, r * r, 2 * r + 2], {
    visual: { type: 'geometry', parts: [{ kind: 'circle', at: C, r: R }, diameterSeg(C, R, dDeg, cm(2 * r))] }, say: `A circle has a diameter of ${2 * r} centimetres. What is its radius, in centimetres?` });
}

/** d3: reasoning, every prompt at most 60 characters. */
function reasoning(rng: Rng): Question {
  const k = rng();
  if (k < 0.34) {
    const r = ri(rng, 2, 9), c1: Pt = [30, 36], c2: Pt = [70, 36];
    return numCard(rng, `Two circles, radius ${cm(r)}, side by side. Width = ? cm`, 4 * r, [2 * r, 3 * r, r * r, 4 * r + 2], {
      visual: { type: 'geometry', parts: [{ kind: 'circle', at: c1, r: 20 }, { kind: 'circle', at: c2, r: 20 }, radiusSeg(c1, 20, 135, cm(r))] },
      say: `Two circles, each with a radius of ${r} centimetres, sit side by side and touch. How wide are they together, in centimetres?` });
  }
  if (k < 0.67) {
    const r = ri(rng, 1, 9);
    return numCard(rng, `Radius ${cm(`${r}.5`)}. Diameter = ? cm`, 2 * r + 1, [2 * r, 2 * r + 2, r + 1, r + 3], {
      visual: { type: 'geometry', parts: [{ kind: 'circle', at: C, r: R }, radiusSeg(C, R, 135, cm(`${r}.5`))] }, say: `A circle has a radius of ${r} and a half centimetres. What is its diameter, in centimetres?` });
  }
  const r = ri(rng, 4, 12), s = 2 * r, [x0, x1, y0, y1] = [C[0] - R, C[0] + R, C[1] - R, C[1] + R];
  return numCard(rng, `A circle just fits in a ${cm(s)} square. Radius = ? cm`, r, [s, 2 * s, r - 2, s - 2], {
    visual: { type: 'geometry', parts: [{ kind: 'polygon', pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], sides: [cm(s)] }, { kind: 'circle', at: C, r: R }] },
    say: `A circle just fits inside a square with sides of ${s} centimetres. What is the radius of the circle, in centimetres?` });
}

export const y6Circles: Generator = (d: Difficulty, rng: Rng): Question => (d === 1 ? partCard : d === 2 ? convertCard : reasoning)(rng);
