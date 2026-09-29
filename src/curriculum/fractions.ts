// Exact fraction arithmetic for KS2 (#1044). Fractions run through every KS2 year, from "unit and non-unit
// fractions" in Year 3 to "multiply simple pairs of proper fractions" in Year 6, and each topic needs the
// same arithmetic and the same rule that a decoy is never worth the answer (#296's `sameFraction`,
// `year2.ts:92`, cross-multiplied so 2/4 and 1/2 compare equal). This module is that rule, generalised and
// tested once here instead of re-derived per topic. `year2.ts` is untouched — migrating its private
// `sameFraction` onto this module is a separate ticket's job, not this one's ("what this deliberately does
// not do").
import { dec, type Dec } from './ks2num';

/** `n/d`, sign carried on `n`; `d` is never 0 and, once simplified, never negative. */
export interface Frac { readonly n: number; readonly d: number }

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** `f` reduced to its lowest terms, with the sign moved onto `n` and `d` always positive. */
export function simplify(f: Frac): Frac {
  if (f.d === 0) throw new RangeError('simplify: denominator is 0');
  const sign = f.d < 0 ? -1 : 1;
  const n = f.n * sign, d = Math.abs(f.d);
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

/**
 * By value, cross-multiplied — the same rule `sameFraction` (`year2.ts:92`) uses, generalised to any two
 * fractions. `simplify` first, same as every other function here: a raw `d < 0` flips the sign of a cross
 * product but not the other, which silently mis-orders `compare` (not `equal`, whose product is sign-safe
 * either way) — simplifying first is one fix for both, and the same `d === 0` throw as everywhere else.
 */
export function equal(a: Frac, b: Frac): boolean { const x = simplify(a), y = simplify(b); return x.n * y.d === y.n * x.d; }

export function compare(a: Frac, b: Frac): -1 | 0 | 1 {
  const x = simplify(a), y = simplify(b);
  const l = x.n * y.d, r = y.n * x.d;
  return l < r ? -1 : l > r ? 1 : 0;
}

export function add(a: Frac, b: Frac): Frac { return simplify({ n: a.n * b.d + b.n * a.d, d: a.d * b.d }); }
export function sub(a: Frac, b: Frac): Frac { return simplify({ n: a.n * b.d - b.n * a.d, d: a.d * b.d }); }
export function mul(a: Frac, b: Frac): Frac { return simplify({ n: a.n * b.n, d: a.d * b.d }); }
export function mulWhole(a: Frac, k: number): Frac { return simplify({ n: a.n * k, d: a.d }); }
export function divWhole(a: Frac, k: number): Frac {
  if (k === 0) throw new RangeError('divWhole: cannot divide by 0');
  return simplify({ n: a.n, d: a.d * k });
}

/** 7/4 → `{ whole: 1, frac: 3/4 }`. `frac.n` carries the same sign as `f` (or is 0 for a whole number). */
export function toMixed(f: Frac): { whole: number; frac: Frac } {
  const s = simplify(f);
  const whole = Math.trunc(s.n / s.d);
  return { whole, frac: { n: s.n - whole * s.d, d: s.d } };
}
/** The inverse of `toMixed`: `whole` and `frac` (same sign) combine into one simplified fraction. */
export function fromMixed(whole: number, frac: Frac): Frac { return simplify({ n: whole * frac.d + frac.n, d: frac.d }); }

/** `f` of `whole`, exactly — `null` when `whole` does not divide evenly (KS2 "fraction of an amount" cards only ever offer a whole answer). */
export function ofAmount(f: Frac, whole: number): number | null {
  const s = simplify(f);
  const result = whole * s.n / s.d;
  return Number.isInteger(result) ? result : null;
}

/** `f` as a `ks2num` `Dec`, exact — `null` if it does not terminate within 3 decimal places (KS2's own cap). */
export function toDecimal(f: Frac): Dec | null {
  const s = simplify(f);
  for (let dp = 0; dp <= 3; dp++) {
    const scaled = s.n * 10 ** dp;
    if (scaled % s.d === 0) return dec(scaled / s.d, dp);
  }
  return null;
}

/** "3/4", or with `mixed` an improper fraction as "1 3/4" (whole part only) / "2" (no remainder). */
export function fmtFrac(f: Frac, opts: { mixed?: boolean } = {}): string {
  const s = simplify(f);
  if (!opts.mixed || Math.abs(s.n) < s.d) return `${s.n}/${s.d}`;
  const { whole, frac } = toMixed(s);
  return frac.n === 0 ? `${whole}` : `${whole} ${Math.abs(frac.n)}/${frac.d}`;
}

const FRAC_RE = /^(-?\d+)\/(\d+)$/;
const MIXED_RE = /^(-?\d+) (\d+)\/(\d+)$/;

/** The inverse of `fmtFrac`: "3/4", "1 3/4" or a bare integer. `null` for anything else, including a `/0`. */
export function parseFrac(label: string): Frac | null {
  const trimmed = label.trim();
  const mixed = MIXED_RE.exec(trimmed);
  if (mixed) {
    const [, whole, n, d] = mixed;
    const dd = Number(d); if (dd === 0) return null;
    // Not `fromMixed(Number(whole), { n: Number(n), d: dd })`: fromMixed expects `frac.n` signed the way
    // toMixed's own output is (matching `whole`'s sign, e.g. -1 and {n:-3,d:4} for -7/4), but the regex
    // only ever captures a positive `n` — the sign in the text belongs to `whole` alone ("-1 3/4" means
    // -(1 3/4), not -1 + 3/4). Building the value directly from that convention instead.
    const w = Number(whole), sign = w < 0 ? -1 : 1;
    return simplify({ n: sign * (Math.abs(w) * dd + Number(n)), d: dd });
  }
  const plain = FRAC_RE.exec(trimmed);
  if (plain) {
    const [, n, d] = plain;
    const dd = Number(d); if (dd === 0) return null;
    return simplify({ n: Number(n), d: dd });
  }
  return /^-?\d+$/.test(trimmed) ? { n: Number(trimmed), d: 1 } : null;
}
