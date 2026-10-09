// y5-fracadd (#1197): Year 5 adding and subtracting fractions, same and related denominators (5M25). d1 the same bottom
// (3/7 + 2/7); d2 one bottom a multiple of the other (3/8 + 1/4, answer under 1); d3 a sum between 1 and 2 written as a
// mixed number (3/4 + 5/8 = 1 3/8) or 1 1/5 − 3/5. The answer keeps the larger bottom and is never simplified, so no option
// equals it by value. The main slip is adding the tops and the bottoms (3/8 + 1/4 = 4/12), a bubble whenever it is a fraction worth a different value.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { equal, type Frac } from './fractions';
import { ks2Say } from './ks2say';

const f = (n: number, d: number): Frac => ({ n, d });
/** `7/4` → `1 3/4`; a whole number is just the number. */
const lab = ({ n, d }: Frac) => (n < d ? `${n}/${d}` : n % d === 0 ? String(n / d) : `${Math.floor(n / d)} ${n % d}/${d}`);
type Op = '+' | '−';

/** Candidates in the order a child is most likely to slip, the tops-and-bottoms one first; value-equal, whole-number and malformed ones dropped, and no two decoys share a value. */
function pickDecoys(rng: Rng, answer: Frac, first: Frac[], rest: Frac[]): string[] {
  const ok = (c: Frac) => c.n >= 1 && c.d >= 2 && c.d <= 24 && c.n % c.d !== 0 && !equal(c, answer);
  const chosen: Frac[] = [];
  for (const c of [...first.slice(0, 1), ...shuffle(rng, [...first.slice(1), ...rest])]) if (ok(c) && !chosen.some(o => equal(o, c))) chosen.push(c);
  return chosen.slice(0, 3).map(lab);
}

function card(rng: Rng, op: Op, a: Frac, b: Frac, answer: Frac, extra: Frac[], hint: string, prefix = ''): Question {
  const sum = `${prefix}${lab(a)} ${op} ${lab(b)}`;
  const tb = op === '+' ? f(a.n + b.n, a.d + b.d) : f(Math.abs(a.n - b.n), Math.abs(a.d - b.d));
  const D = answer.d, other = op === '+' ? Math.abs(a.n * (D / a.d) - b.n * (D / b.d)) : a.n * (D / a.d) + b.n * (D / b.d);
  const rest = [f(op === '+' ? a.n + b.n : Math.abs(a.n - b.n), D), f(other, D), f(answer.n + 1, D), f(answer.n - 1, D), f(answer.n, D + 1), f(answer.n + 2, D), f(answer.n - 2, D), f(answer.n, D - 1), f(answer.n + 1, D + 1), ...extra];
  const decoys = pickDecoys(rng, answer, [tb], rest);
  return wordQ(rng, `${sum} = ?`, lab(answer), decoys, { say: ks2Say(`${sum} = ?`).replace(/^./, c => c.toUpperCase()), hint, hintIsData: false });
}

/** Two fractions over bottoms `b` and `d`, and their sum or difference over the larger one, kept when `inRange(top, bottom)` says so. */
function pair(rng: Rng, bottoms: () => [number, number], inRange: (top: number, bottom: number) => boolean, op: Op): [Frac, Frac, Frac] {
  for (;;) {
    const [b, d] = bottoms(), D = Math.max(b, d);
    const x = ri(rng, 1, b - 1), y = ri(rng, 1, d - 1), xs = x * (D / b), ys = y * (D / d);
    const top = op === '+' ? xs + ys : xs - ys;
    if (!inRange(top, D) || (op === '−' && xs <= ys)) continue;
    const swap = op === '+' && rng() < 0.5;
    return [swap ? f(y, d) : f(x, b), swap ? f(x, b) : f(y, d), f(top, D)];
  }
}
const sameBottom = (rng: Rng) => (): [number, number] => { const d = ri(rng, 3, 12); return [d, d]; };
const relatedBottoms = (rng: Rng) => (): [number, number] => {
  const b = ri(rng, 2, 6), D = b * pick(rng, [2, 3, 4]);
  return D > 12 ? [b, b * 2] : rng() < 0.5 ? [b, D] : [D, b];
};
const underOne = (top: number, bottom: number) => top >= 1 && top < bottom;
const betweenOneAndTwo = (top: number, bottom: number) => top > bottom && top < 2 * bottom;

function simple(rng: Rng, level: 1 | 2): Question {
  const op: Op = rng() < 0.5 ? '+' : '−';
  const [a, b, ans] = pair(rng, level === 1 ? sameBottom(rng) : relatedBottoms(rng), underOne, op);
  return card(rng, op, a, b, ans, [], level === 1 ? 'Same bottom: add or take away the tops only' : 'Make the bottoms the same first');
}

/** d3 sum: related bottoms, the answer a mixed number; the wrong-whole slip is `2 r/D`. */
function sumOverOne(rng: Rng): Question {
  const [a, b, ans] = pair(rng, relatedBottoms(rng), (t, D) => betweenOneAndTwo(t, D), '+');
  return card(rng, '+', a, b, ans, [f(ans.n + ans.d, ans.d)], 'Make the bottoms the same, add, then write the whole ones');
}

/** d3 take-away: `1 a/d − c/d` with c bigger than a, so the answer drops below 1. */
function mixedTakeAway(rng: Rng): Question {
  const d = ri(rng, 3, 12), a = ri(rng, 1, d - 2), c = ri(rng, a + 1, d - 1), ans = f(d + a - c, d);
  const sum = `1 ${a}/${d} − ${c}/${d}`;
  const decoys = pickDecoys(rng, ans, [], [f(c - a, d), f(a + c, d), f(d - c, d), f(d + a + c, d), f(ans.n + 1, d), f(ans.n - 1, d), f(c, d), f(ans.n + 2, d), f(ans.n, d + 1)]);
  return wordQ(rng, `${sum} = ?`, lab(ans), decoys, { say: ks2Say(`${sum} = ?`).replace(/^./, ch => ch.toUpperCase()), hint: 'Write 1 as a fraction with the same bottom first', hintIsData: false });
}

export const y5FracAdd: Generator = (level: Difficulty, rng) =>
  level === 3 ? (rng() < 0.65 ? sumOverOne(rng) : mixedTakeAway(rng)) : simple(rng, level);
