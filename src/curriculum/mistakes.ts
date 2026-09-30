// Standard written-method wrong answers a KS2 child would actually produce (#1058), so a card's wrong
// options read as real misconceptions instead of nearby noise. Builds on #1043's exact `Dec` arithmetic and
// #1044's `Frac`. `decoysFor`/`fracDecoys` are the two entry points a topic calls; the rule functions below
// are exported too, for their own fixed-case tests. Nothing calls this yet — every KS2 number topic that
// will (#1050 onward) is still behind #1050's Year 3 shell.
import type { Rng } from './types';
import { nearby, shuffle } from './util';
import { addDec, dec, digitAt, divPow10, fmt, mulDecByInt, mulPow10, subDec, type Dec, type Place } from './ks2num';
import { add as fracAdd, equal as fracEqual, simplify as fracSimplify, type Frac } from './fractions';

export type MistakeKind = 'add' | 'sub' | 'mul';

const decValue = (a: Dec): number => a.v / 10 ** a.dp;
/** How a caller will actually show a `Dec` on a card — bare `fmt` (trims trailing fractional zeros) by
 *  default, but a topic that always pads to a fixed width (money, "£3.10" never "£3.1") must pass its own,
 *  since "the last printed digit" only means what a child will see when it matches that real convention. */
export type Display = (d: Dec) => string;
// Printed digits (sign/comma/point/£/p ignored, same as the leak-scope rule) — never the raw scaled
// integer, which two candidates can share at different `dp` for unrelated values.
const printedDigits = (a: Dec, display: Display): string => display(a).replace(/[^0-9]/g, '');
const leadDigit = (a: Dec, display: Display): string => printedDigits(a, display)[0] ?? '';
const lastDigit = (a: Dec, display: Display): string => printedDigits(a, display).slice(-1);
// How many decimal places `display` actually prints — never the raw `dp`, which overstates it whenever the
// value has trailing zero fractional digits (`dec(500, 2)` is internally 2dp but bare `fmt` prints "5").
const printedFracLen = (a: Dec, display: Display): number => { const s = display(a), i = s.indexOf('.'); return i === -1 ? 0 : s.length - i - 1; };

/** ×10 and ÷10 of the answer — the place-value shift a child makes reading the wrong column. */
export const placeValueShift = (answer: Dec): Dec[] => [mulPow10(answer, 1), divPow10(answer, 1)];

const WHOLE_PLACES = [1000000, 100000, 10000, 1000, 100, 10, 1] as const;
const DECIMAL_PLACES = [0.1, 0.01, 0.001] as const;

/** ±10^k at every column k where `a + b` would carry, or `a − b` would borrow — whole-number columns always,
 *  plus the decimal columns `a`/`b` actually use (so a money answer also gets the pence-into-pounds slip).
 *  The borrow model only holds for `a ≥ b`: below that, `a`'s magnitude-only digits (`digitAt` ignores sign)
 *  are all `0` against `b`'s, so every remaining column re-triggers a borrow and the candidates run away —
 *  empty in that case, since sign flip already covers "answer's sign mishandled". */
export function carrySlip(a: Dec, b: Dec, op: 'add' | 'sub', answer: Dec): Dec[] {
  if (op === 'sub' && decValue(a) < decValue(b)) return [];
  const places: Place[] = [...WHOLE_PLACES, ...DECIMAL_PLACES.slice(0, Math.max(a.dp, b.dp))];
  const out: Dec[] = [];
  let carry = 0;
  for (let i = places.length - 1; i >= 0; i--) {
    const p = places[i];
    const da = digitAt(a, p), db = digitAt(b, p);
    const carried = op === 'add' ? da + db + carry >= 10 : da - carry < db;
    // Mishandled, a carry/borrow at column `p` shows up one column higher (never bumped or reduced).
    if (carried && i > 0) {
      const step = dec(Math.round(places[i - 1] * 10 ** answer.dp), answer.dp);
      out.push(addDec(answer, step), subDec(answer, step));
    }
    carry = carried ? 1 : 0;
  }
  return out;
}

/** Two adjacent printed digits of the answer's magnitude exchanged (282 → 228, swapping the tens and units,
 *  or £10.34 → £13.04/£10.43). A swap is dropped only when it turns a genuine, non-zero leading digit into a
 *  zero (`052` reads as the shorter `52`; `1034` at dp 2, "£10.34", swapping its first two digits the same
 *  way reads as the shorter "£1.34") — never when the leading digit already was `0` (money and decimals under
 *  one whole unit, "£0.45", are unaffected: that `0` was always genuine, dp aside). */
export function swappedDigits(answer: Dec): Dec[] {
  const negative = answer.v < 0;
  const digits = String(Math.abs(answer.v)).padStart(answer.dp + 1, '0').split('');
  const out: Dec[] = [];
  for (let i = 0; i < digits.length - 1; i++) {
    if (digits[i] === digits[i + 1]) continue;
    const swapped = digits.slice();
    [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    if (digits[0] !== '0' && swapped[0] === '0') continue;
    out.push(dec(Number(swapped.join('')) * (negative ? -1 : 1), answer.dp));
  }
  return out;
}

/** A neighbouring times-table fact: one factor one more or one less (47 × 6 → 47 × 5, 47 × 7, 46 × 6, 48 × 6).
 *  Only the whole-number factor is ever shifted — a decimal factor (4.5 × 3) has no "times table" to misread
 *  by one, and shifting it by a bare ±1 is not itself a plausible slip, so that side is skipped rather than
 *  producing a non-integer product `dec()` would reject. */
export function neighbourFact(a: Dec, b: Dec): Dec[] {
  const out: Dec[] = [];
  const add = (x: Dec) => { if (decValue(x) > 0) out.push(x); };
  if (b.dp === 0) { add(mulDecByInt(a, b.v + 1)); add(mulDecByInt(a, b.v - 1)); }
  if (a.dp === 0) { add(mulDecByInt(b, a.v + 1)); add(mulDecByInt(b, a.v - 1)); }
  return out;
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
  if (kind === 'mul') out.push(...neighbourFact(a, b), ...wrongOperation(a, b, 'mul'));
  return out;
}

// Keyed on the printed value, not the raw (v, dp) pair: placeValueShift's ÷10 candidate carries a different
// `dp` than every add/sub/swap-based candidate, so two decoys can represent the same number at different
// scales (410 at dp 2 and 41 at dp 1 both print "4.1") and must still be recognised as the one duplicate.
const key = (d: Dec) => fmt(d);
function tryAdd(picked: Dec[], seen: Set<string>, d: Dec, range: Range): boolean {
  const k = key(d);
  if (seen.has(k) || decValue(d) < range.min || decValue(d) > range.max) return false;
  seen.add(k); picked.push(d); return true;
}

const inRange = (d: Dec, range: Range) => { const v = decValue(d); return v >= range.min && v <= range.max; };

/** A decoy sharing `answer`'s last printed digit: a rule candidate if one qualifies, else a fill of ±10 units
 *  of the last place `display` actually prints (never raw `dp`, which overstates it past a trailing zero — a
 *  £5.00 answer prints "5", so its fill steps by 10, not by the 0.01 `dp` alone would suggest), preferring
 *  whichever sign stays in `range` (and, of those, whichever also keeps the leading digit) — `null`, like
 *  `fillLead`, when neither sign keeps the range and the shared last digit both, and no rule candidate does. */
function fillLast(pool: Dec[], seen: Set<string>, answer: Dec, range: Range, display: Display): Dec | null {
  const match = pool.find(d => !seen.has(key(d)) && lastDigit(d, display) === lastDigit(answer, display));
  if (match) return match;
  const fracLen = printedFracLen(answer, display);
  const fillStep = fracLen === 0 ? dec(10, 0) : dec(1, fracLen - 1);
  const plus = addDec(answer, fillStep), minus = subDec(answer, fillStep);
  const keepsLeading = (d: Dec) => leadDigit(d, display) === leadDigit(answer, display);
  const inR = [plus, minus].filter(d => inRange(d, range) && lastDigit(d, display) === lastDigit(answer, display));
  return inR.find(keepsLeading) ?? inR[0] ?? null;
}

/** A decoy sharing `answer`'s leading digit: a rule candidate if one qualifies, else a ±`step` fill that
 *  both keeps the leading digit and stays in `range` — `null` when neither sign manages both, which is every
 *  time for a whole-number-zero answer (`leadDigit` is `'0'` only for `0` itself, so nothing else can ever
 *  share it — not a range-width case like every other `null` here, but a permanent one; `decoysFor` does not
 *  special-case it further, since a caller asking for the guarantee on a zero answer is asking the
 *  unaskable, the same way `range.min > range.max` is). */
function fillLead(pool: Dec[], seen: Set<string>, answer: Dec, step: number, range: Range, display: Display): Dec | null {
  const match = pool.find(d => !seen.has(key(d)) && leadDigit(d, display) === leadDigit(answer, display));
  if (match) return match;
  const fracLen = printedFracLen(answer, display);
  const plus = addDec(answer, dec(step, fracLen)), minus = subDec(answer, dec(step, fracLen));
  const keepsLeading = (d: Dec) => leadDigit(d, display) === leadDigit(answer, display) && inRange(d, range);
  return keepsLeading(plus) ? plus : keepsLeading(minus) ? minus : null;
}

/**
 * Misconception-first decoys for a whole-number/decimal/money calculation: the rules above for `kind`,
 * deduped and range-filtered, then guaranteed at least one decoy sharing the answer's last printed digit and
 * one sharing its leading digit (a fill of `answer ± 10 units of its last printed place`, or `± step` inside
 * the leading digit when no such fill keeps it), topped up with `nearby()` only once both are met.
 *
 * "Printed" means whatever `display` renders (bare `fmt` by default) — pass the same fixed-width renderer a
 * money/decimal topic actually shows on the card (e.g. `d => fmt(d, {fixedDp: 2})`) so the guarantee is about
 * the digit a child actually sees, not an internal trimmed form nobody renders. The leading-digit guarantee
 * is unmeetable, always, when `answer` itself is a whole-number `0` — `'0'` is `0`'s own leading digit and no
 * other integer's, a permanent limit of place-value notation, not a range-width case; `fillLead` returns
 * `null` for it like any other unmeetable case, and this is not special-cased further.
 *
 * Returns up to `n`, never fewer than the distinct values `range` actually has room for once the answer and
 * any dp-scale duplicates are excluded — the same bound `nearby()` itself already has for a narrow `range`,
 * inherited here rather than worked around: asking for `n` decoys from a range too small to hold them is not
 * a defect in the fill, it is a range chosen too tight for `n`, and a caller passes one no wider than a real
 * card's answer range in practice. Unlike `fracDecoys`' own numerator walk, there is no unbounded direction
 * to extend into here — `range` is the only source of new whole-number/decimal values.
 */
export function decoysFor(kind: MistakeKind, calc: NumCalc, n: number, rng: Rng, range: Range, step = 1, display: Display = fmt): Dec[] {
  const { answer } = calc;
  const seen = new Set<string>([key(answer)]);
  const picked: Dec[] = [];
  const pool = shuffle(rng, rulesFor(kind, calc)).filter(d => key(d) !== key(answer) && decValue(d) >= range.min && decValue(d) <= range.max);

  // The two guarantees are reserved first, so a later slice-to-`n` never cuts them.
  const last = fillLast(pool, seen, answer, range, display);
  if (last) tryAdd(picked, seen, last, range);
  if (!picked.some(d => leadDigit(d, display) === leadDigit(answer, display))) {
    const lead = fillLead(pool, seen, answer, step, range, display);
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

const fracKey = (f: Frac) => { const s = fracSimplify(f); return `${s.n}/${s.d}`; };

/** `a/b + c/d`'s misconception decoys, plus fills over simplified fraction values at `answer`'s own
 *  denominator. The fill walks `answer.n ± 1, ± 2, ± 3, ...` in order (never a random one-draw-per-iteration
 *  guess, which could exhaust its guard before finding `n` distinct positive values) — for any `n`, the
 *  positive-numerator direction alone supplies `n` new values well before the walk's own bound is reached, so
 *  this cannot silently fall short the way a fixed ±1/±2 range, or a capped random search, both could. */
export function fracDecoys(a: Frac, b: Frac, n: number, rng: Rng): Frac[] {
  const answer = fracAdd(a, b);
  const seen = new Set<string>([fracKey(answer)]);
  const picked: Frac[] = [];
  for (const d of shuffle(rng, topsAndBottoms(a, b))) {
    if (picked.length >= n) break;
    const k = fracKey(d);
    if (!seen.has(k)) { seen.add(k); picked.push(d); }
  }
  // `Math.abs`, not `Math.max(..., 0)`: a negative `answer.n` needs the walk to first cross zero before its
  // positive direction produces any valid candidate at all, which `Math.max(answer.n, 0)` gave no slack for.
  for (let delta = 1; picked.length < n && delta <= n + Math.abs(answer.n) + 5; delta++) {
    for (const sign of [1, -1] as const) {
      if (picked.length >= n) break;
      const cand: Frac = { n: answer.n + sign * delta, d: answer.d };
      const k = fracKey(cand);
      if (cand.n > 0 && !seen.has(k)) { seen.add(k); picked.push(cand); }
    }
  }
  return shuffle(rng, picked).slice(0, n);
}
