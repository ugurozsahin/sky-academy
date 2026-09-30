import { describe, expect, it } from 'vitest';
import {
  add, compare, divWhole, equal, fmtFrac, fromMixed, mul, mulWhole, ofAmount, parseFrac, simplify,
  sub, toDecimal, toMixed, type Frac,
} from '../../src/curriculum/fractions';
import { fmt } from '../../src/curriculum/ks2num';

/** Deterministic RNG (mulberry32) — the same generator `tests/unit/helpers/ks2-naming.ts` uses, so a seeded
 *  draw here is reproducible without pulling in a curriculum-topic dependency this pure-maths module has none of. */
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const draw = rng(1);
/** A fraction with a denominator in 1–12 and a numerator that keeps `a`/`b`'s cross products within safe-integer range. */
const fracIn12 = (): Frac => ({ n: Math.floor(draw() * 41) - 20, d: Math.floor(draw() * 12) + 1 });

describe('fractions.ts: exact arithmetic for KS2 (#1044)', () => {
  it('simplify reduces to lowest terms and carries the sign on n', () => {
    expect(simplify({ n: 2, d: 4 })).toEqual({ n: 1, d: 2 });
    expect(simplify({ n: 3, d: -4 })).toEqual({ n: -3, d: 4 });
    expect(simplify({ n: -6, d: -8 })).toEqual({ n: 3, d: 4 });
    expect(() => simplify({ n: 1, d: 0 })).toThrow(RangeError);
  });

  it('equal and compare simplify first, so a raw negative denominator neither mis-orders nor bypasses the d=0 throw', () => {
    // -1/2 (as {n:1,d:-2}) really is less than 1/3 — a bare cross-multiply without simplifying first flips
    // this, since it needs b.d*a.d > 0 to hold and this pair does not.
    expect(compare({ n: 1, d: -2 }, { n: 1, d: 3 })).toBe(-1);
    expect(compare({ n: 1, d: 3 }, { n: 1, d: -2 })).toBe(1);
    expect(equal({ n: 1, d: -2 }, { n: -1, d: 2 })).toBe(true);
    expect(() => equal({ n: 1, d: 0 }, { n: 1, d: 2 })).toThrow(RangeError);
    expect(() => compare({ n: 1, d: 0 }, { n: 1, d: 2 })).toThrow(RangeError);
  });

  it('equal agrees with Year 2\'s own cross-multiplication rule, over every n/d pair in 1–5 (#296, year2.ts:92)', () => {
    for (let a = 1; a <= 5; a++) for (let b = 1; b <= 5; b++) for (let num = 1; num <= 5; num++) for (let den = 1; den <= 5; den++) {
      expect(equal({ n: a, d: b }, { n: num, d: den })).toBe(a * den === num * b);
    }
  });
  it('the framework\'s own worked cases: 2/4 = 1/2, 7/4 -> "1 3/4", 1/4 x 1/2 = 1/8, 1/3 / 2 = 1/6, 3/8 -> 0.375', () => {
    expect(equal({ n: 2, d: 4 }, { n: 1, d: 2 })).toBe(true);
    expect(fmtFrac({ n: 7, d: 4 }, { mixed: true })).toBe('1 3/4');
    expect(mul({ n: 1, d: 4 }, { n: 1, d: 2 })).toEqual({ n: 1, d: 8 });
    expect(divWhole({ n: 1, d: 3 }, 2)).toEqual({ n: 1, d: 6 });
    expect(fmt(toDecimal({ n: 3, d: 8 })!)).toBe('0.375');
  });

  it('compare agrees with equal at 0, and orders by value, not by spelling', () => {
    expect(compare({ n: 2, d: 4 }, { n: 1, d: 2 })).toBe(0);
    expect(compare({ n: 1, d: 4 }, { n: 1, d: 2 })).toBe(-1);
    expect(compare({ n: 3, d: 4 }, { n: 1, d: 2 })).toBe(1);
  });

  it('toMixed/fromMixed round-trip a simplified fraction, whole numbers included', () => {
    for (const f of [{ n: 7, d: 4 }, { n: 3, d: 4 }, { n: 8, d: 4 }, { n: -7, d: 4 }]) {
      const { whole, frac } = toMixed(f);
      expect(fromMixed(whole, frac)).toEqual(simplify(f));
    }
    expect(toMixed({ n: 8, d: 4 })).toEqual({ whole: 2, frac: { n: 0, d: 1 } });
  });

  it('ofAmount is exact, or null when the amount does not divide evenly', () => {
    expect(ofAmount({ n: 3, d: 4 }, 8)).toBe(6);
    expect(ofAmount({ n: 1, d: 3 }, 10)).toBeNull();
  });

  it('toDecimal is exact within 3dp, or null when the fraction does not terminate there', () => {
    expect(fmt(toDecimal({ n: 1, d: 4 })!)).toBe('0.25');
    expect(toDecimal({ n: 1, d: 3 })).toBeNull();
  });

  it('fmtFrac/parseFrac round-trip a proper fraction, an improper one, a whole number and a negative one', () => {
    for (const f of [{ n: 3, d: 4 }, { n: 7, d: 4 }, { n: 8, d: 4 }, { n: 0, d: 5 }, { n: -7, d: 4 }, { n: -3, d: 4 }]) {
      expect(parseFrac(fmtFrac(simplify(f), { mixed: true }))).toEqual(simplify(f));
      expect(parseFrac(fmtFrac(simplify(f)))).toEqual(simplify(f));
    }
    expect(parseFrac('3/0')).toBeNull();
    expect(parseFrac('not a fraction')).toBeNull();
  });

  // #1423 review round 4: fmtFrac itself never emits U+2212 (template-literal number-to-string only ever
  // gives an ASCII '-'), but ks2num.ts's own fmt() deliberately does for every negative KS2 number — so a
  // negative fraction/mixed-number KS2 answer built the way this codebase's own convention formats numbers
  // must still parse, not just fmtFrac's own round-trip.
  it('parseFrac reads a plain or mixed fraction signed with U+2212, same as a hyphen', () => {
    expect(parseFrac('−3/4')).toEqual({ n: -3, d: 4 });
    expect(parseFrac('-3/4')).toEqual({ n: -3, d: 4 });
    expect(parseFrac('−1 1/2')).toEqual({ n: -3, d: 2 });
    expect(parseFrac('-1 1/2')).toEqual({ n: -3, d: 2 });
  });

  it('divWhole throws on a 0 divisor, the same as simplify does on a 0 denominator', () => {
    expect(() => divWhole({ n: 1, d: 2 }, 0)).toThrow(RangeError);
  });

  // Property tests over 10,000 seeded pairs, denominators 1-12, per the issue's own bar (#1044).
  it('add then sub the same fraction back is the identity, over 10,000 seeded pairs', () => {
    for (let i = 0; i < 10000; i++) {
      const a = fracIn12(), b = fracIn12();
      expect(sub(add(a, b), b)).toEqual(simplify(a));
    }
  });
  it('simplify is idempotent, over 10,000 seeded pairs', () => {
    for (let i = 0; i < 10000; i++) { const f = fracIn12(); expect(simplify(simplify(f))).toEqual(simplify(f)); }
  });
  it('equal agrees with compare(a, b) === 0, over 10,000 seeded pairs', () => {
    for (let i = 0; i < 10000; i++) {
      const a = fracIn12(), b = fracIn12();
      expect(equal(a, b)).toBe(compare(a, b) === 0);
    }
  });
  it('parseFrac(fmtFrac(f)) round-trips, plain and mixed, over 10,000 seeded pairs', () => {
    for (let i = 0; i < 10000; i++) {
      const f = fracIn12();
      expect(parseFrac(fmtFrac(f))).toEqual(simplify(f));
      expect(parseFrac(fmtFrac(f, { mixed: true }))).toEqual(simplify(f));
    }
  });

  it('mulWhole and mul agree on a whole number expressed as n/1', () => {
    for (let i = 0; i < 500; i++) {
      const f = fracIn12(), k = Math.floor(draw() * 11) - 5;
      expect(mulWhole(f, k)).toEqual(mul(f, { n: k, d: 1 }));
    }
  });
});
