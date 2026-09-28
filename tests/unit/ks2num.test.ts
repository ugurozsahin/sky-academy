import { describe, it, expect } from 'vitest';
import { dec, addDec, subDec, mulDecByInt, mulPow10, divPow10, compareDec, fmt, parseNum, roundTo, digitAt, digitValue } from '../../src/curriculum/ks2num';
import type { Place, RoundUnit } from '../../src/curriculum/ks2num';

// Deterministic RNG (mulberry32) — same construction as curriculum.test.ts, kept local so this file has
// no dependency on that one.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const ri = (r: () => number, min: number, max: number) => min + Math.floor(r() * (max - min + 1));

describe('ks2num', () => {
  describe('fmt/parseNum round-trip (#1043)', () => {
    const r = rng(2026);
    const draws: { v: number; dp: number }[] = [];
    for (let i = 0; i < 100_000; i++) {
      const kind = i % 3;
      if (kind === 0) draws.push({ v: ri(r, 0, 10_000_000), dp: 0 });               // integers to 10,000,000
      else if (kind === 1) draws.push({ v: -ri(r, 1, 1000), dp: 0 });                // negatives to -1,000
      else draws.push({ v: ri(r, -1_000_000, 1_000_000), dp: ri(r, 1, 3) });         // decimals to 3 dp

    }

    it('parseNum(fmt(x)) round-trips exactly, for every draw', () => {
      for (const d of draws) {
        const label = fmt(d);
        const back = parseNum(label);
        expect(back, `fmt(${JSON.stringify(d)}) = "${label}" did not parse back`).not.toBeNull();
        expect(compareDec(back!, d), `"${label}" round-tripped to a different value`).toBe(0);
      }
    });

    it('no label has a float artefact or an ASCII hyphen', () => {
      for (const d of draws) {
        const label = fmt(d);
        expect(label, label).not.toMatch(/\d\.\d*0000|9999\d/);
        expect(label, label).not.toContain('-');
      }
    });
  });

  describe('fmt commas', () => {
    it.each([
      [999, '999'],
      [1000, '1,000'],
      [10_000_000, '10,000,000'],
    ])('%i formats as %s', (v, expected) => {
      expect(fmt(dec(v, 0))).toBe(expected);
    });
  });

  describe('fmt sign and trailing zeros', () => {
    it('a negative value uses U+2212, never ASCII "-"', () => {
      expect(fmt(dec(-375, 2))).toBe('−3.75');
    });
    it('trims trailing zeros by default', () => {
      expect(fmt(dec(500, 2))).toBe('5');
      expect(fmt(dec(350, 2))).toBe('3.5');
    });
    it('fixedDp pads and truncates to an exact width (money)', () => {
      expect(fmt(dec(350, 2), { fixedDp: 2 })).toBe('3.50');
      expect(fmt(dec(5, 0), { fixedDp: 2 })).toBe('5.00');
    });
    it('zero is never signed', () => {
      expect(fmt(dec(0, 2))).toBe('0');
    });
  });

  describe('parseNum', () => {
    it('accepts commas, a leading minus sign and a decimal point', () => {
      expect(parseNum('1,000')).toEqual({ v: 1000, dp: 0 });
      expect(parseNum('−3')).toEqual({ v: -3, dp: 0 });
      expect(parseNum('3.75')).toEqual({ v: 375, dp: 2 });
      expect(parseNum('5')).toEqual({ v: 5, dp: 0 });
    });
    it('rejects malformed input', () => {
      expect(parseNum('12,34')).toBeNull();
      expect(parseNum('abc')).toBeNull();
      expect(parseNum('1.2.3')).toBeNull();
      expect(parseNum('')).toBeNull();
    });
    it('rejects a value too large to hold exactly', () => {
      expect(parseNum('99999999999999999999')).toBeNull();
    });
  });

  describe('roundTo', () => {
    it.each([
      [dec(5, 0), 10, dec(10, 0)],       // 5 → 10 (halves round up)
      [dec(45, 0), 10, dec(50, 0)],      // 45 → 50
      [dec(245, 2), 0.1, dec(25, 1)],    // 2.45 → 2.5
      [dec(994, 0), 1000, dec(1000, 0)],
      [dec(500, 0), 1000, dec(1000, 0)], // exactly halfway rounds up
      [dec(499, 0), 1000, dec(0, 0)],
      [dec(150, 0), 100, dec(200, 0)],   // 150 → 200 (halves round up)
      [dec(1234, 0), 1, dec(1234, 0)],
    ] as const)('rounds %o to the nearest %s as %o', (n, unit, expected) => {
      expect(compareDec(roundTo(n, unit), expected)).toBe(0);
    });

    it('throws on a negative input', () => {
      expect(() => roundTo(dec(-5, 0), 10)).toThrow();
    });

    it('rejects a unit the literal union cannot express but a widened caller could still pass', () => {
      expect(() => roundTo(dec(5, 0), 7 as unknown as RoundUnit)).toThrow();
    });

    it('rounding to a finer unit than the input carries (the e < 0 branch)', () => {
      // 5 (dp 0) rounded to the nearest 0.1 is 5.0 — no digit to round, just a finer dp.
      expect(compareDec(roundTo(dec(5, 0), 0.1), dec(50, 1))).toBe(0);
    });
  });

  describe('digit values', () => {
    it.each([
      [345672, 1_000_000, 0],
      [345672, 100000, 3],
      [345672, 10000, 4],
      [345672, 1000, 5],
      [345672, 100, 6],
      [345672, 10, 7],
      [345672, 1, 2],
    ] as const)('digitAt(345672, %i) is %i', (n, place, expected) => {
      expect(digitAt(n, place)).toBe(expected);
    });

    it('digitValue(345672, 1000) is 5,000', () => {
      expect(digitValue(345672, 1000)).toBe(5000);
    });

    it('reads a fractional place from a Dec', () => {
      expect(digitAt(dec(3456, 3), 0.001)).toBe(6);   // 3.456
      expect(digitAt(dec(3456, 3), 0.01)).toBe(5);
      expect(digitAt(dec(3456, 3), 0.1)).toBe(4);
      expect(digitAt(dec(3456, 3), 1)).toBe(3);
    });

    it('asking for a place finer than the value carries is 0 (the e < 0 branch)', () => {
      expect(digitAt(dec(5, 0), 0.1)).toBe(0);   // "5.0"
      expect(digitAt(5, 0.1)).toBe(0);           // same, via the plain-number overload
    });

    it('rejects a non-integer plain number, which would defeat the whole exactness point', () => {
      expect(() => digitAt(3.5, 1)).toThrow();
    });

    it('rejects a place value the literal union cannot express but a widened caller could still pass', () => {
      // RoundUnit/Place are number-literal unions, so a caller that has widened the type to `number`
      // (e.g. from a computed value) is the only way to reach this — `as` simulates that here.
      expect(() => digitAt(5, 7 as unknown as Place)).toThrow();
    });
  });

  describe('exact arithmetic', () => {
    it('addDec/subDec align differing dp exactly', () => {
      expect(compareDec(addDec(dec(375, 2), dec(1, 0)), dec(475, 2))).toBe(0);   // 3.75 + 1 = 4.75
      expect(compareDec(subDec(dec(500, 2), dec(25, 2)), dec(475, 2))).toBe(0);  // 5.00 - 0.25 = 4.75
      expect(compareDec(subDec(dec(5, 0), dec(25, 2)), dec(475, 2))).toBe(0);    // 5 - 0.25 = 4.75 (differing dp)
    });
    it('mulDecByInt scales the integer, keeping dp, for a negative k too', () => {
      expect(compareDec(mulDecByInt(dec(375, 2), 3), dec(1125, 2))).toBe(0);     // 3.75 × 3 = 11.25
      expect(compareDec(mulDecByInt(dec(375, 2), -2), dec(-750, 2))).toBe(0);    // 3.75 × -2 = -7.50
    });
    it('mulDecByInt rejects a non-integer k, which would break the "v is always an integer" invariant', () => {
      expect(() => mulDecByInt(dec(375, 2), 1.5)).toThrow();
    });
    it('mulPow10/divPow10 shift the decimal point exactly', () => {
      expect(compareDec(mulPow10(dec(375, 2), 1), dec(375, 1))).toBe(0);         // 3.75 × 10 = 37.5
      expect(compareDec(mulPow10(dec(5, 0), 2), dec(500, 0))).toBe(0);           // 5 × 100 = 500
      expect(compareDec(mulPow10(dec(5, 0), 3), dec(5000, 0))).toBe(0);          // 5 × 1000 = 5000
      expect(compareDec(divPow10(dec(375, 2), 1), dec(375, 3))).toBe(0);         // 3.75 ÷ 10 = 0.375
    });
    it('compareDec orders unequal values, not only equal ones', () => {
      expect(compareDec(dec(1, 0), dec(2, 0))).toBe(-1);
      expect(compareDec(dec(2, 0), dec(1, 0))).toBe(1);
      expect(compareDec(dec(199, 2), dec(2, 0))).toBe(-1);   // 1.99 < 2
    });
    it('dec rejects a non-integer v or dp', () => {
      expect(() => dec(3.5, 0)).toThrow();
      expect(() => dec(3, -1)).toThrow();
    });
  });

  describe('round-trip boundary values (acceptance criteria, pinned rather than left to chance)', () => {
    it.each([
      [dec(10_000_000, 0), '10,000,000'],
      [dec(-1000, 0), '−1,000'],
      [dec(1234567, 3), '1,234.567'],
    ] as const)('%o formats as %s and parses back exactly', (d, label) => {
      expect(fmt(d)).toBe(label);
      expect(compareDec(parseNum(label)!, d)).toBe(0);
    });
  });
});
