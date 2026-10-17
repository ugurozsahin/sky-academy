// y6-areaperim (#1243): same area with a different perimeter, and the reverse (NC 6M37–38). Text cards only: a rectangle
// is `a × b` (cm). Each card has exactly one option that meets its condition, and the test checks every option (#666).
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { areaCard } from './year6-area';

type Pair = [number, number];
const label = (rng: Rng, [a, b]: Pair) => (rng() < 0.5 ? `${a} × ${b}` : `${b} × ${a}`);
const key = ([a, b]: Pair) => (a < b ? `${a}x${b}` : `${b}x${a}`);
const area = ([a, b]: Pair) => a * b;
/** Areas with at least two whole-number rectangles, sides 2–12. */
const AREAS = [12, 16, 18, 20, 24, 30, 36];
const pairsOf = (a: number): Pair[] => { const out: Pair[] = []; for (let w = 2; w <= 12; w++) if (a % w === 0 && a / w >= w && a / w <= 12) out.push([w, a / w]); return out; };

/** d1: which rectangle has the same area as the one shown? The same-perimeter rectangle is always among the decoys. */
function sameArea(rng: Rng): Question {
  const A = pick(rng, AREAS), [shown, other] = shuffle(rng, pairsOf(A)).slice(0, 2);
  const s = shown[0] + shown[1], seen = new Set([key(shown), key(other)]);
  const lookalike = shuffle(rng, Array.from({ length: s - 1 }, (_, i): Pair => [i + 1, s - i - 1])).find(p => !seen.has(key(p)) && area(p) !== A)!;
  seen.add(key(lookalike));
  const decoys: Pair[] = [lookalike];
  while (decoys.length < 3) {
    const p: Pair = [ri(rng, 2, 9), ri(rng, 2, 9)];
    if (!seen.has(key(p)) && area(p) !== A) { seen.add(key(p)); decoys.push(p); }
  }
  const text = `${shown[0]} × ${shown[1]}`;
  return wordQ(rng, `Same area as ${text}?`, label(rng, other), decoys.map(p => label(rng, p)), {
    say: `Which rectangle has the same area as ${shown[0]} times ${shown[1]}?`, hint: 'Multiply to find each area', hintIsData: false });
}

/** d2: two rectangles with the same area; the perimeter of the second. */
function perimeterOfSecond(rng: Rng): Question {
  const A = pick(rng, AREAS.slice(1)), [a, b] = shuffle(rng, pairsOf(A)).slice(0, 2);
  return areaCard(rng, `${a[0]} × ${a[1]} and ${b[0]} × ${b[1]}: same area. Perimeter of ${b[0]} × ${b[1]} = ? cm`, 2 * (b[0] + b[1]),
    [2 * (a[0] + a[1]), b[0] + b[1], 2 * b[0] + b[1], A], {
      say: `A ${a[0]} by ${a[1]} rectangle and a ${b[0]} by ${b[1]} rectangle have the same area. What is the perimeter of the ${b[0]} by ${b[1]} rectangle, in centimetres?`,
      hint: 'Add all four sides' });
}

/** d2: four rectangles with one perimeter; the one closest to a square has the biggest area. */
function biggestArea(rng: Rng): Question {
  const P = 2 * ri(rng, 8, 14), h = P / 2, ws = shuffle(rng, Array.from({ length: Math.floor(h / 2) }, (_, i) => i + 1)).slice(0, 4);
  const best = Math.max(...ws), name = (w: number) => label(rng, [w, h - w]);
  return wordQ(rng, `All have perimeter ${P} cm. Biggest area?`, name(best), ws.filter(w => w !== best).map(name), {
    say: `All of these rectangles have a perimeter of ${P} centimetres. Which one has the biggest area?`, hint: 'The closer to a square, the bigger the area', hintIsData: false });
}

/** d3: the area and the perimeter fix one rectangle; its longer side. */
function longerSide(rng: Rng): Question {
  const w = ri(rng, 2, 9), l = ri(rng, w + 1, 12), A = w * l, P = 2 * (w + l);
  return areaCard(rng, `Rectangle: area ${A} cm², perimeter ${P} cm. Longer side = ? cm`, l, [w, w + l, 2 * l + w], {
    say: `A rectangle has an area of ${A} square centimetres and a perimeter of ${P} centimetres. How long is its longer side, in centimetres?`,
    hint: 'Two sides add up to half the perimeter' });
}

export const y6AreaPerim: Generator = (level: Difficulty, rng) =>
  (level === 1 ? sameArea : level === 2 ? (rng() < 0.5 ? perimeterOfSecond : biggestArea) : longerSide)(rng);
