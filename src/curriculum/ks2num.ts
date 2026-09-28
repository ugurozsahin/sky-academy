// Exact decimal, comma and rounding helpers for KS2 (#1043). JS floats print artefacts —
// `String(0.1 + 0.2)` is `"0.30000000000000004"` — so every value here is an integer `v` scaled by
// `10^dp` (3.75 is `{ v: 375, dp: 2 }`), and every operation stays on integers: aligning two `dp`s
// or scaling by a power of ten only ever multiplies (exact), never divides a float. `fmt`/`parseNum`
// read and write the integer digits directly rather than going through a JS number division.
export interface Dec { readonly v: number; readonly dp: number }

/** Build a Dec directly from its scaled integer, e.g. `dec(375, 2)` is 3.75. */
export function dec(v: number, dp: number): Dec {
  if (!Number.isInteger(v) || !Number.isInteger(dp) || dp < 0) throw new Error(`dec: v and dp must be non-negative integers (got v=${v}, dp=${dp})`);
  return { v, dp };
}

/** `a`'s integer at `dp` decimal places — always a multiplication (dp only ever rises here). */
function rescale(a: Dec, dp: number): number {
  return a.v * 10 ** (dp - a.dp);
}

export function addDec(a: Dec, b: Dec): Dec {
  const dp = Math.max(a.dp, b.dp);
  return { v: rescale(a, dp) + rescale(b, dp), dp };
}

export function subDec(a: Dec, b: Dec): Dec {
  const dp = Math.max(a.dp, b.dp);
  return { v: rescale(a, dp) - rescale(b, dp), dp };
}

export function mulDecByInt(a: Dec, k: number): Dec {
  return { v: a.v * k, dp: a.dp };
}

/** Multiply by 10^n (n = 1, 2 or 3 → ×10, ×100, ×1,000). Renormalises so `dp` never goes negative. */
export function mulPow10(a: Dec, n: 1 | 2 | 3): Dec {
  const dp = a.dp - n;
  return dp >= 0 ? { v: a.v, dp } : { v: a.v * 10 ** -dp, dp: 0 };
}

/** Divide by 10^n (n = 1, 2 or 3 → ÷10, ÷100, ÷1,000). Exact: the same `v`, more decimal places. */
export function divPow10(a: Dec, n: 1 | 2 | 3): Dec {
  return { v: a.v, dp: a.dp + n };
}

export function compareDec(a: Dec, b: Dec): -1 | 0 | 1 {
  const dp = Math.max(a.dp, b.dp);
  const av = rescale(a, dp), bv = rescale(b, dp);
  return av < bv ? -1 : av > bv ? 1 : 0;
}

export interface FmtOpts {
  /** Pad/trim the fraction to exactly this many places (money: "3.50"). Omit for "no trailing zeros". */
  fixedDp?: number;
}

/** Commas from four digits, U+2212 for negatives (never ASCII "-"), no trailing zeros unless `fixedDp`. */
export function fmt(a: Dec, opts: FmtOpts = {}): string {
  const negative = a.v < 0;
  const digits = String(Math.abs(a.v)).padStart(a.dp + 1, '0');
  const intDigits = a.dp > 0 ? digits.slice(0, digits.length - a.dp) : digits;
  let fracDigits = a.dp > 0 ? digits.slice(digits.length - a.dp) : '';
  fracDigits = opts.fixedDp !== undefined ? fracDigits.padEnd(opts.fixedDp, '0').slice(0, opts.fixedDp) : fracDigits.replace(/0+$/, '');
  const grouped = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (negative && a.v !== 0 ? '−' : '') + grouped + (fracDigits ? '.' + fracDigits : '');
}

const NUM_RE = /^([-−]?)(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d+))?$/;

/** The inverse of `fmt`: "1,000", "−3", "3.75" and plain "5". `null` for anything else. */
export function parseNum(label: string): Dec | null {
  const m = NUM_RE.exec(label.trim());
  if (!m) return null;
  const [, sign, intPart, fracPart = ''] = m;
  const v = Number(intPart.replace(/,/g, '') + fracPart);
  if (!Number.isSafeInteger(v)) return null;
  return { v: sign ? -v : v, dp: fracPart.length };
}

const ROUND_UNITS = { 1: 0, 10: 1, 100: 2, 1000: 3, 10000: 4, 100000: 5, 0.1: -1 } as const;
export type RoundUnit = keyof typeof ROUND_UNITS;

/** Round to the nearest `unit` (10 … 100,000, or 0.1). Halves round up. Non-negative inputs only. */
export function roundTo(n: Dec, unit: RoundUnit): Dec {
  if (n.v < 0) throw new Error('roundTo: negative input');
  const k = ROUND_UNITS[unit];
  const e = n.dp + k;
  if (e < 0) return { v: n.v * 10 ** -e, dp: k < 0 ? -k : 0 };
  const divisor = 10 ** e;
  const q = Math.floor(n.v / divisor);
  const r = n.v - q * divisor;
  const rounded = r * 2 >= divisor ? q + 1 : q;
  return k >= 0 ? { v: rounded * 10 ** k, dp: 0 } : { v: rounded, dp: -k };
}

const PLACES = { 1000000: 6, 100000: 5, 10000: 4, 1000: 3, 100: 2, 10: 1, 1: 0, 0.1: -1, 0.01: -2, 0.001: -3 } as const;
export type Place = keyof typeof PLACES;

function toDec(n: Dec | number): Dec {
  if (typeof n !== 'number') return n;
  if (!Number.isInteger(n)) throw new Error(`digitAt/digitValue: a plain number must be an integer (got ${n}); pass a Dec for a fractional value`);
  return { v: n, dp: 0 };
}

/** The single digit (0–9) at `place` (millions to thousandths) — magnitude only, sign ignored. */
export function digitAt(n: Dec | number, place: Place): number {
  const d = toDec(n);
  const e = d.dp + PLACES[place];
  const scaled = e >= 0 ? Math.floor(Math.abs(d.v) / 10 ** e) : Math.abs(d.v) * 10 ** -e;
  return scaled % 10;
}

/** `digitAt(n, place) * place` — e.g. `digitValue(345672, 1000)` is 5,000. */
export function digitValue(n: Dec | number, place: Place): number {
  return digitAt(n, place) * place;
}
