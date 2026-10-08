// y5-x10 (#1190): × and ÷ by 10, 100 and 1,000, including decimals (5M17). d1 pick-one, whole numbers with whole answers;
// d2 build, the decimal point a sliced step whenever the answer is not whole (the point is the skill, so it is not pre-printed);
// d3 half build (× and ÷ 1,000) and half pick-one "4.2 × ? = 420". Every sum is on scaled integers (ks2num), never floats.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ, q } from './util';
import { buildQ } from './build';
import { dec, fmt, mulPow10, divPow10, parseNum } from './ks2num';
import type { Dec } from './ks2num';
import { ks2Say } from './ks2say';

type Pow = 1 | 2 | 3;
const TEN = (k: number) => 10 ** k;
const apply = (a: Dec, op: '×' | '÷', k: Pow): Dec => (op === '×' ? mulPow10(a, k) : divPow10(a, k));
const say = (sum: string) => ks2Say(q(sum).say ?? sum);

/** A 1- to 3-decimal-place number with no trailing zero, so it prints as itself. */
function decimal(rng: Rng, dp: 1 | 2 | 3): Dec {
  const lo = TEN(dp - 1) + 1, hi = dp === 3 ? 9999 : TEN(dp + 1) - 1;
  let v = ri(rng, lo, hi);
  if (v % 10 === 0) v += 1;
  return dec(v, dp);
}

/** True for a value a decoy may be: positive, not the answer, at most 3 decimal places, not absurdly large. */
function usable(x: Dec, answer: string): boolean {
  const label = fmt(x), p = parseNum(label);
  return x.v > 0 && label !== answer && !!p && p.dp <= 3 && x.v / TEN(x.dp) <= 10_000_000;
}

/** Place-value shifts (one power of ten out either way) first, then the wrong operation, then wider shifts. */
function decoys(answer: Dec, wrong: Dec | null): string[] {
  const label = fmt(answer), out: string[] = [];
  const candidates = [divPow10(answer, 1), mulPow10(answer, 1), ...(wrong ? [wrong] : []), mulPow10(answer, 2), divPow10(answer, 2), mulPow10(answer, 3)];
  for (const c of candidates) { const l = fmt(c); if (out.length < 3 && usable(c, label) && !out.includes(l)) out.push(l); }
  return out;
}

/** d1: a whole number × a power of ten, or a multiple of it ÷ that power, always with a whole answer. */
function d1(rng: Rng): Question {
  const k = ri(rng, 1, 3) as Pow, op = pick(rng, ['×', '÷'] as const), m = ri(rng, 12, 999);
  const first = op === '×' ? dec(m, 0) : dec(m * TEN(k), 0);
  const answer = op === '×' ? dec(m * TEN(k), 0) : dec(m, 0);
  const sum = `${fmt(first)} ${op} ${fmt(dec(TEN(k), 0))} = ?`;
  return wordQ(rng, sum, fmt(answer), decoys(answer, apply(first, op === '×' ? '÷' : '×', k)), { say: say(sum) });
}

/** A build card: the answer's digits, and its point when it has one, are all sliced (≤ 6 slots, 8 bubbles). */
function build(rng: Rng, sum: string, answer: Dec): Question {
  const label = fmt(answer);
  return buildQ(rng, { prompt: sum, say: `${say(sum)}. Build the answer${label.includes('.') ? ', with the point' : ''}.`, answer: label, total: 8, steps: label.includes('.') ? { point: true } : undefined, hint: 'Slice the digits and the point in order' });
}

/** d2: 1- or 2-dp × 10 or 100 (the answer may be whole), or a whole number ÷ 10 or 100 (never whole). */
function d2(rng: Rng): Question {
  const k = ri(rng, 1, 2) as Pow;
  if (rng() < 0.5) {
    const a = decimal(rng, pick(rng, [1, 2] as const));
    return build(rng, `${fmt(a)} × ${fmt(dec(TEN(k), 0))} = ?`, mulPow10(a, k));
  }
  let n = ri(rng, 11, 999);
  if (n % 10 === 0) n += 1;
  return build(rng, `${fmt(dec(n, 0))} ÷ ${fmt(dec(TEN(k), 0))} = ?`, divPow10(dec(n, 0), k));
}

/** d3 (b): which power of ten makes the sum true? The options are always 10, 100, 1,000 and 10,000. */
function missing(rng: Rng): Question {
  const k = ri(rng, 1, 3) as Pow, op = pick(rng, ['×', '÷'] as const);
  const dp = pick(rng, [0, 1, 2] as const);
  const a = dp === 0 ? dec(ri(rng, 12, 99), 0) : decimal(rng, dp);
  const big = mulPow10(a, k);
  const sum = op === '×' ? `${fmt(a)} × ? = ${fmt(big)}` : `${fmt(big)} ÷ ? = ${fmt(a)}`;
  const label = (j: number) => fmt(dec(TEN(j), 0));
  const wrong = [1, 2, 3, 4].filter(j => j !== k).map(label);
  return wordQ(rng, sum, label(k), wrong, { say: `${say(sum)} Pick the number.` });
}

/** d3 (a): ÷ 1,000 on a 2- to 4-digit whole number, or × 1,000 on a decimal. */
function d3(rng: Rng): Question {
  if (rng() < 0.5) return missing(rng);
  if (rng() < 0.5) {
    const n = ri(rng, 11, 9999);
    return build(rng, `${fmt(dec(n, 0))} ÷ 1,000 = ?`, divPow10(dec(n, 0), 3));
  }
  const a = decimal(rng, pick(rng, [1, 2, 3] as const));
  return build(rng, `${fmt(a)} × 1,000 = ?`, mulPow10(a, 3));
}

export const y5X10: Generator = (d: Difficulty, rng): Question => d === 1 ? d1(rng) : d === 2 ? d2(rng) : d3(rng);
