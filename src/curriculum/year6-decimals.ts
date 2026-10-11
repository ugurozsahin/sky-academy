// y6-decimals (#1265): the value of a digit to 3 decimal places, and × / ÷ by 10, 100 and 1,000 (NC 6M20). d1 the value
// of one digit in a number with 3 decimal places (the asked digit appears once), d2 "0.72 × 1,000" / "45.6 ÷ 100" with
// answers of at most 3 decimal places, d3 the missing power of ten or the missing start. Every value is a scaled integer
// (`ks2num.ts`), never a float, and every label goes through `fmt` (no trailing zeros, commas from four digits).
// Decoys are the place-value shifts first (one and two places each way), then the wrong operation, then the face value.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ } from './util';
import { dec, fmt, mulPow10, divPow10, compareDec, parseNum, type Dec } from './ks2num';
import { ks2Say } from './ks2say';

type N = 1 | 2 | 3;
const lab = (a: Dec) => fmt(a);
const canon = (a: Dec): Dec => parseNum(fmt(a))!;
const LIMIT = dec(1000000, 0);

/** A positive decimal with `dp` places, a whole part in [lo, hi] and a non-zero last digit (so it prints with all `dp` places). */
function randDec(rng: Rng, lo: number, hi: number, dp: number): Dec {
  const whole = ri(rng, lo, hi);
  if (dp === 0) return dec(whole, 0);
  const top = 10 ** dp - 1;
  let frac = ri(rng, 1, top);
  while (frac % 10 === 0) frac = ri(rng, 1, top);
  return dec(whole * 10 ** dp + frac, dp);
}

/** Distinct decoys from `cands` in order: positive, at most 3 decimal places, below a million, never equal to `ans` in value. */
function pickDecoys(ans: Dec, cands: Dec[]): string[] {
  const out: string[] = [];
  for (const c of cands) {
    const x = canon(c);
    if (out.length >= 3 || x.dp > 3 || x.v <= 0 || compareDec(x, LIMIT) >= 0 || compareDec(x, ans) === 0 || out.includes(lab(x))) continue;
    out.push(lab(x));
  }
  return out;
}

/** The answer's place-value shifts: one place each way first, then two. */
const shifts = (a: Dec): Dec[] => [mulPow10(a, 1), divPow10(a, 1), mulPow10(a, 2), divPow10(a, 2), mulPow10(a, 3), divPow10(a, 3)];


/** d1: the value of one digit in `w.xyz` (1–2 whole digits). */
function digitValue(rng: Rng): Question {
  const whole = ri(rng, 1, 2), len = whole + 3, at = ri(rng, 0, len - 1);
  const asked = ri(rng, 1, 9);
  const digits: number[] = [];
  for (let i = 0; i < len; i++) {
    if (i === at) { digits.push(asked); continue; }
    let x = ri(rng, i === 0 || i === len - 1 ? 1 : 0, 9);
    while (x === asked) x = ri(rng, i === 0 || i === len - 1 ? 1 : 0, 9);
    digits.push(x);
  }
  const num = dec(Number(digits.join('')), 3);
  const ans = dec(asked * 10 ** (len - 1 - at), 3);
  const prompt = `What is the value of the ${asked} in ${lab(num)}?`;
  const ds = pickDecoys(ans, [mulPow10(ans, 1), divPow10(ans, 1), dec(asked, 0), mulPow10(ans, 2), divPow10(ans, 2), mulPow10(ans, 3)]);
  return wordQ(rng, prompt, lab(ans), ds, { say: `${ks2Say(prompt.slice(0, -1))}?`, hint: 'Which column is the digit in?', hintIsData: false });
}

/** One `start op 10^n` sum whose answer has at most 3 decimal places. */
function sum(rng: Rng): { start: Dec; op: '×' | '÷'; n: N; ans: Dec } {
  const op = pick(rng, ['×', '÷'] as const), n = pick(rng, [1, 2, 3] as N[]);
  if (op === '×') {
    const start = randDec(rng, 0, 99, ri(rng, 1, 2));
    return { start, op, n, ans: mulPow10(start, n) };
  }
  const maxDp = 3 - n, start = randDec(rng, 1, 999, maxDp ? ri(rng, 1, maxDp) : 0);
  return { start, op, n, ans: divPow10(start, n) };
}

/** d2: "0.72 × 1,000 = ?". Decoys: the shifts, then the other operation. */
function shiftSum(rng: Rng): Question {
  const { start, op, n, ans } = sum(rng);
  const other = op === '×' ? divPow10(start, n) : mulPow10(start, n);
  const pow = lab(dec(10 ** n, 0));
  const prompt = `${lab(start)} ${op} ${pow} = ?`;
  const ds = pickDecoys(ans, [...shifts(ans).slice(0, 2), other, ...shifts(ans).slice(2)]);
  return wordQ(rng, prompt, lab(ans), ds, { say: `What is ${ks2Say(`${lab(start)} ${op} ${pow}`)}?`, hint: `Each digit moves ${n === 1 ? 'one place' : n === 2 ? 'two places' : 'three places'}`, hintIsData: false });
}

/** d3: the missing power of ten ("3.6 × ? = 3,600") or the missing start ("? ÷ 100 = 0.045"). */
function missing(rng: Rng): Question {
  const { start, op, n, ans } = sum(rng);
  if (rng() < 0.5) {
    const prompt = `${lab(start)} ${op} ? = ${lab(ans)}`;
    const powers = [10, 100, 1000, 10000].map(p => dec(p, 0));
    const right = dec(10 ** n, 0);
    return wordQ(rng, prompt, lab(right), powers.filter(p => p.v !== right.v).map(lab), { say: ks2Say(prompt), hint: `Count the places the digits moved`, hintIsData: false });
  }
  const prompt = `? ${op} ${lab(dec(10 ** n, 0))} = ${lab(ans)}`;
  const wrongWay = op === '×' ? divPow10(ans, n) : mulPow10(ans, n);
  const ds = pickDecoys(start, [...shifts(start).slice(0, 2), ...shifts(start).slice(2, 4), wrongWay]);
  return wordQ(rng, prompt, lab(start), ds, { say: ks2Say(prompt), hint: 'Work backwards: do the opposite', hintIsData: false });
}

export const y6Decimals: Generator = (d: Difficulty, rng: Rng): Question => d === 1 ? digitValue(rng) : d === 2 ? shiftSum(rng) : missing(rng);
