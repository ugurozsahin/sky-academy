// Roman numeral converter, I to MMMCMXCIX (#1056). No imports: three KS2 topics (#1100, #1135, #1181)
// build on this alone, and it must never accept a malformed numeral as an answer or a decoy.
const PAIRS: readonly [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** Integers 1–3999 only ("recognise years" reaches MCMXCIX = 1999, past the statutory M). Throws outside it. */
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) throw new Error(`toRoman: n must be an integer from 1 to 3999 (got ${n})`);
  let rest = n, out = '';
  for (const [value, glyph] of PAIRS) {
    while (rest >= value) { out += glyph; rest -= value; }
  }
  return out;
}

/** The value of a *canonical* numeral (`toRoman(fromRoman(s)) === s`) — `null` for anything else. */
export function fromRoman(s: string): number | null {
  let rest = s, total = 0;
  for (const [value, glyph] of PAIRS) {
    while (rest.startsWith(glyph)) { total += value; rest = rest.slice(glyph.length); }
  }
  if (rest !== '' || total < 1 || total > 3999) return null;
  // Greedy matching alone accepts only the canonical form: a run of four ("IIII"), a repeated single
  // that has a subtractive pair ("VV"), or a skipped subtractive pair ("IC", "XM", "IL") never matches
  // the greedy pair list at all, so `rest` never fully empties for them.
  return toRoman(total) === s ? total : null;
}

export const isRoman = (s: string): boolean => fromRoman(s) !== null;
