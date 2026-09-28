import { describe, it, expect } from 'vitest';
import { toRoman, fromRoman, isRoman } from '../../src/curriculum/roman';

describe('roman (#1056)', () => {
  it('round-trips every integer from 1 to 3999', () => {
    for (let n = 1; n <= 3999; n++) {
      const s = toRoman(n);
      expect(fromRoman(s), `toRoman(${n}) = "${s}" did not parse back`).toBe(n);
      expect(isRoman(s), `"${s}" should be recognised as Roman`).toBe(true);
    }
  });

  it.each([
    [4, 'IV'], [9, 'IX'], [14, 'XIV'], [40, 'XL'], [90, 'XC'],
    [400, 'CD'], [1000, 'M'], [1999, 'MCMXCIX'], [2026, 'MMXXVI'],
  ] as const)('toRoman(%i) is %s', (n, expected) => {
    expect(toRoman(n)).toBe(expected);
    expect(fromRoman(expected)).toBe(n);
  });

  it.each([
    'IIII',   // a run of four, not the subtractive pair
    'VV',     // a repeated single that has a subtractive pair
    'IC',     // a skipped subtractive pair (should be XCIX)
    'XM',     // a skipped subtractive pair (should be CM after C's worth of numerals)
    'IL',     // a skipped subtractive pair (should be XLIX)
    'iv',     // lower case
    'I V',    // spaces
    '',       // empty string
    'ABC',    // not Roman glyphs at all
  ])('fromRoman(%j) is null (non-canonical or invalid)', (s) => {
    expect(fromRoman(s)).toBeNull();
    expect(isRoman(s)).toBe(false);
  });

  it('toRoman throws outside 1–3999 or on a non-integer', () => {
    expect(() => toRoman(0)).toThrow();
    expect(() => toRoman(4000)).toThrow();
    expect(() => toRoman(2.5)).toThrow();
    expect(() => toRoman(-5)).toThrow();
  });
});
