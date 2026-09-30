// Standard written-method wrong answers a KS2 child would actually produce (#1058), so a card's wrong
// options read as real misconceptions instead of nearby noise. Builds on #1043's exact `Dec` arithmetic and
// #1044's `Frac`. `decoysFor`/`fracDecoys` are the two entry points a topic calls; the rule functions below
// are exported too, for their own fixed-case tests. Nothing calls this yet — every KS2 number topic that
// will (#1050 onward) is still behind #1050's Year 3 shell.
import type { Rng } from './types';
import { nearby, shuffle } from './util';
import { addDec, dec, digitAt, divPow10, fmt, mulPow10, subDec, type Dec } from './ks2num';
import { add as fracAdd, equal as fracEqual, type Frac } from './fractions';

export type MistakeKind = 'add' | 'sub' | 'mul';

const decValue = (a: Dec): number => a.v / 10 ** a.dp;
// Printed digits (sign/comma/point/£/p ignored, same as the leak-scope rule) — never the raw scaled
// integer, which two candidates can share at different `dp` for unrelated values.
const printedDigits = (a: Dec): string => fmt(a).replace(/[^0-9]/g, '');
const leadDigit = (a: Dec): string => printedDigits(a)[0] ?? '';
const lastDigit = (a: Dec): string => printedDigits(a).slice(-1);

/** ×10 and ÷10 of the answer — the place-value shift a child makes reading the wrong column. */
export const placeValueShift = (answer: Dec): Dec[] => [mulPow10(answer, 1), divPow10(answer, 1)];

const CARRY_PLACES = [1000000, 100000, 10000, 1000, 100, 10, 1] as const;

/** ±10^k at every whole-number column k where `a + b` would carry, or `a − b` would borrow. */
export function carrySlip(a: Dec, b: Dec, op: 'add' | 'sub', answer: Dec): Dec[] {
  const out: Dec[] = [];
  let carry = 0;
  for (let i = CARRY_PLACES.length - 1; i >= 0; i--) {
    const p = CARRY_PLACES[i];
    const da = digitAt(a, p), db = digitAt(b, p);
    const carried = op === 'add' ? da + db + carry >= 10 : da - carry < db;
    // Mishandled, a carry/borrow at column `p` shows up one column higher (never bumped or reduced).
    if (carried && i > 0) { const step = dec(CARRY_PLACES[i - 1], 0); out.push(addDec(answer, step), subDec(answer, step)); }
    carry = carried ? 1 : 0;
  }
  return out;
}

/** Two adjacent printed digits of the answer's magnitude exchanged (282 → 228, swapping the tens and units). */
export function swappedDigits(answer: Dec): Dec[] {
  const negative = answer.v < 0;
  const digits = String(Math.abs(answer.v)).padStart(answer.dp + 1, '0').split('');
  const out: Dec[] = [];
  for (let i = 0; i < digits.length - 1; i++) {
    if (digits[i] === digits[i + 1]) continue;
    const swapped = digits.slice();
    [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    if (swapped[0] === '0' && swapped.length > 1) continue;
    out.push(dec(Number(swapped.join('')) * (negative ? -1 : 1), answer.dp));
  }
  return out;
}

/** A neighbouring times-table fact: one factor one more or one less (47 × 6 → 47 × 5, 47 × 7, 46 × 6, 48 × 6). */
export function neighbourFact(a: number, b: number): Dec[] {
  return [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b].filter(v => v > 0).map(v => dec(v, 0));
}

/** The other formal method entirely: `a + b` read for `a × b`, or `a − b` read for `a + b`. */
export const wrongOperation = (a: Dec, b: Dec, forOp: 'mul' | 'add'): Dec[] => [forOp === 'mul' ? addDec(a, b) : subDec(a, b)];

/** The answer's sign dropped or flipped: `b − a` written for `a − b`, or a positive misread as negative. */
export const signFlip = (answer: Dec): Dec[] => [dec(-answer.v, answer.dp)];

/** `a/b + c/d` misread as `(a+c)/(b+d)` — adding the tops and the bottoms straight across, unreduced. */
export function topsAndBottoms(a: Frac, b: Frac): Frac[] {
  const bad: Frac = { n: a.n + b.n, d: a.d + b.d };
  return fracEqual(bad, fracAdd(a, b)) ? [] : [bad];
}

export interface NumCalc { a: Dec; b: Dec; answer: Dec }
export interface Range { min: number; max: number }

function rulesFor(kind: MistakeKind, { a, b, answer }: NumCalc): Dec[] {
  const out = [...placeValueShift(answer), ...swappedDigits(answer), ...signFlip(answer)];
  if (kind === 'add') out.push(...carrySlip(a, b, 'add', answer), ...wrongOperation(a, b, 'add'));
  if (kind === 'sub') out.push(...carrySlip(a, b, 'sub', answer));
  if (kind === 'mul') out.push(...neighbourFact(decValue(a), decValue(b)), ...wrongOperation(a, b, 'mul'));
  return out;
}

const key = (d: Dec) => `${d.v}:${d.dp}`;
function tryAdd(picked: Dec[], seen: Set<string>, d: Dec, range: Range): boolean {
  const k = key(d);
  if (seen.has(k) || decValue(d) < range.min || decValue(d) > range.max) return false;
  seen.add(k); picked.push(d); return true;
}

const inRange = (d: Dec, range: Range) => { const v = decValue(d); return v >= range.min && v <= range.max; };

/** A decoy sharing `answer`'s last printed digit: a rule candidate if one qualifies, else a ±10-units fill,
 *  preferring whichever sign stays in `range` (and, of those, whichever also keeps the leading digit). */
function fillLast(pool: Dec[], seen: Set<string>, answer: Dec, range: Range): Dec {
  const match = pool.find(d => !seen.has(key(d)) && lastDigit(d) === lastDigit(answer));
  if (match) return match;
  const fillStep = dec(10, answer.dp);
  const plus = addDec(answer, fillStep), minus = subDec(answer, fillStep);
  const keepsLeading = (d: Dec) => leadDigit(d) === leadDigit(answer);
  const inR = [plus, minus].filter(d => inRange(d, range));
  return inR.find(keepsLeading) ?? inR[0] ?? plus;
}

/** A decoy sharing `answer`'s leading digit: a rule candidate if one qualifies, else a ±`step` fill that
 *  both keeps the leading digit and stays in `range` — `null` when neither sign manages both. */
function fillLead(pool: Dec[], seen: Set<string>, answer: Dec, step: number, range: Range): Dec | null {
  const match = pool.find(d => !seen.has(key(d)) && leadDigit(d) === leadDigit(answer));
  if (match) return match;
  const plus = addDec(answer, dec(step, answer.dp)), minus = subDec(answer, dec(step, answer.dp));
  const keepsLeading = (d: Dec) => leadDigit(d) === leadDigit(answer) && inRange(d, range);
  return keepsLeading(plus) ? plus : keepsLeading(minus) ? minus : null;
}

/**
 * Misconception-first decoys for a whole-number/decimal/money calculation: the rules above for `kind`,
 * deduped and range-filtered, then guaranteed at least one decoy sharing the answer's last printed digit and
 * one sharing its leading digit (a fill of `answer ± 10 units of its last printed place`, or `± step` inside
 * the leading digit when no such fill keeps it), topped up with `nearby()` only once both are met.
 */
export function decoysFor(kind: MistakeKind, calc: NumCalc, n: number, rng: Rng, range: Range, step = 1): Dec[] {
  const { answer } = calc;
  const seen = new Set<string>([key(answer)]);
  const picked: Dec[] = [];
  const pool = shuffle(rng, rulesFor(kind, calc)).filter(d => key(d) !== key(answer) && decValue(d) >= range.min && decValue(d) <= range.max);

  // The two guarantees are reserved first, so a later slice-to-`n` never cuts them.
  tryAdd(picked, seen, fillLast(pool, seen, answer, range), range);
  if (!picked.some(d => leadDigit(d) === leadDigit(answer))) {
    const lead = fillLead(pool, seen, answer, step, range);
    if (lead) tryAdd(picked, seen, lead, range);
  }

  for (const d of pool) { if (picked.length >= n) break; tryAdd(picked, seen, d, range); }

  let guard = 0;
  while (picked.length < n && guard++ < 20) {
    const extra = nearby(rng, decValue(answer), n - picked.length, range.min, range.max, new Set(picked.map(decValue)));
    if (extra.length === 0) break;
    for (const v of extra) tryAdd(picked, seen, dec(Math.round(v * 10 ** answer.dp), answer.dp), range);
  }
  return picked.slice(0, n);
}

/** `a/b + c/d`'s misconception decoys, plus `nearby()`-style fills over simplified fraction values. */
export function fracDecoys(a: Frac, b: Frac, n: number, rng: Rng): Frac[] {
  const answer = fracAdd(a, b);
  const seen = new Set<string>([`${answer.n}/${answer.d}`]);
  const picked: Frac[] = [];
  for (const d of shuffle(rng, topsAndBottoms(a, b))) {
    if (picked.length >= n) break;
    const k = `${d.n}/${d.d}`;
    if (!seen.has(k)) { seen.add(k); picked.push(d); }
  }
  let guard = 0;
  while (picked.length < n && guard++ < 20) {
    const cand: Frac = { n: answer.n + (Math.floor(rng() * 5) - 2 || 1), d: answer.d };
    const k = `${cand.n}/${cand.d}`;
    if (cand.n > 0 && !seen.has(k)) { seen.add(k); picked.push(cand); }
  }
  return picked.slice(0, n);
}
