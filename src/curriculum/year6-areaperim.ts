// y6-areaperim (#1243, #2276): same area with a different perimeter, and the reverse (NC 6M37–38). Text cards only: a rectangle
// is `a × b` (cm). Each card has exactly one option that meets its condition, and the test checks every option (#666).
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { areaCard } from './year6-area';

type Pair = [number, number];
const label = (rng: Rng, [a, b]: Pair) => (rng() < 0.5 ? `${a} × ${b}` : `${b} × ${a}`);
/** Areas with at least two whole-number rectangles, sides 2–12. */
const AREAS = [12, 16, 18, 20, 24, 30, 36];
const pairsOf = (a: number): Pair[] => { const out: Pair[] = []; for (let w = 2; w <= 12; w++) if (a % w === 0 && a / w >= w && a / w <= 12) out.push([w, a / w]); return out; };

/** Areas with at least four whole-number rectangles (1 × n included). */
const MANY = [24, 30, 36, 40, 48];
const allPairs = (a: number): Pair[] => { const out: Pair[] = []; for (let w = 1; w * w <= a; w++) if (a % w === 0) out.push([w, a / w]); return out; };

/** d1 (6M38): four rectangles with one area; the one with the longest perimeter is the longest and thinnest. */
function longestPerimeter(rng: Rng): Question {
  const A = pick(rng, MANY), ps = shuffle(rng, allPairs(A)).slice(0, 4);
  const best = ps.reduce((m, p) => (p[0] + p[1] > m[0] + m[1] ? p : m));
  return wordQ(rng, `All have area ${A} cm². Longest perimeter?`, label(rng, best), ps.filter(p => p !== best).map(p => label(rng, p)), {
    say: `All of these rectangles have an area of ${A} square centimetres. Which one has the longest perimeter?`, hint: 'The longer and thinner, the longer the perimeter', hintIsData: false,
    why: `2 × (${best[0]} + ${best[1]}) = ${2 * (best[0] + best[1])} cm: the longest` });
}

/** d2: two rectangles with the same area; the perimeter of the second. */
function perimeterOfSecond(rng: Rng): Question {
  const A = pick(rng, AREAS.slice(1)), [a, b] = shuffle(rng, pairsOf(A)).slice(0, 2);
  return areaCard(rng, `${a[0]} × ${a[1]} and ${b[0]} × ${b[1]}: same area. Perimeter of ${b[0]} × ${b[1]} = ? cm`, 2 * (b[0] + b[1]),
    [2 * (a[0] + a[1]), b[0] + b[1], 2 * b[0] + b[1], A], {
      say: `A ${a[0]} by ${a[1]} rectangle and a ${b[0]} by ${b[1]} rectangle have the same area. What is the perimeter of the ${b[0]} by ${b[1]} rectangle, in centimetres?`,
      hint: 'Add all four sides', why: `2 × (${b[0]} + ${b[1]}) = ${2 * (b[0] + b[1])} cm` });
}

/** d2: four rectangles with one perimeter; the one closest to a square has the biggest area. */
function biggestArea(rng: Rng): Question {
  const P = 2 * ri(rng, 8, 14), h = P / 2, ws = shuffle(rng, Array.from({ length: Math.floor(h / 2) }, (_, i) => i + 1)).slice(0, 4);
  const best = Math.max(...ws), name = (w: number) => label(rng, [w, h - w]);
  return wordQ(rng, `All have perimeter ${P} cm. Biggest area?`, name(best), ws.filter(w => w !== best).map(name), {
    say: `All of these rectangles have a perimeter of ${P} centimetres. Which one has the biggest area?`, hint: 'The closer to a square, the bigger the area', hintIsData: false,
    why: `${best} × ${h - best} = ${best * (h - best)} cm²: the biggest` });
}

/** d3: the area and the perimeter fix one rectangle; its longer side. */
function longerSide(rng: Rng): Question {
  const w = ri(rng, 2, 9), l = ri(rng, w + 1, 12), A = w * l, P = 2 * (w + l);
  return areaCard(rng, `Rectangle: area ${A} cm², perimeter ${P} cm. Longer side = ? cm`, l, [w, w + l, 2 * l + w], {
    say: `A rectangle has an area of ${A} square centimetres and a perimeter of ${P} centimetres. How long is its longer side, in centimetres?`,
    hint: 'Two sides add up to half the perimeter', why: `${w} + ${l} = ${P / 2} and ${w} × ${l} = ${A}, so ${l}` });
}

export const y6AreaPerim: Generator = (level: Difficulty, rng) =>
  (level === 1 ? longestPerimeter : level === 2 ? (rng() < 0.5 ? perimeterOfSecond : biggestArea) : longerSide)(rng);
