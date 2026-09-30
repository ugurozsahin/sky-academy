import { describe, expect, it } from 'vitest';
import { ks2Say, sayIsSafe } from '../../src/curriculum/ks2say';
import { TOPICS } from '../../src/curriculum';
import { isKs2 } from '../../src/curriculum/key-stage';
import type { Difficulty } from '../../src/curriculum/types';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

describe('ks2say.ts: spoken forms for KS2 notation (#1057)', () => {
  it.each([
    // fractions
    ['3/4', 'three quarters'],
    ['1/2', 'one half'],
    ['2/3', 'two thirds'],
    ['5/8', 'five eighths'],
    ['2 3/4', 'two and three quarters'],
    ['1/3', 'one third'],
    ['1/5', 'one fifth'],
    ['3/10', 'three tenths'],
    ['5/12', 'five twelfths'],
    ['7/100', 'seven hundredths'],
    ['1 1/2', 'one and one half'],
    ['4/5', 'four fifths'],
    // decimals
    ['3.75', 'three point seven five'],
    ['0.05', 'zero point zero five'],
    ['0.375', 'zero point three seven five'],
    ['12.5', 'twelve point five'],
    ['1.234', 'one point two three four'],
    ['123.5', 'one hundred and twenty-three point five'],
    ['1234.56', 'one thousand two hundred and thirty-four point five six'],
    ['125 1/2', 'one hundred and twenty-five and one half'],
    ['300/4', 'three hundred quarters'],
    // fraction denominators outside the hand-written table (percentage-equivalence and place-value
    // work, Y5-6) — the general ordinal fallback, not a bare cardinal+"th"
    ['1/20', 'one twentieth'],
    ['1/30', 'one thirtieth'],
    ['1/21', 'one twenty-first'],
    ['3/40', 'three fortieths'],
    ['1/1000', 'one thousandth'],
    ['3/1000', 'three thousandths'],
    ['1/999', 'one nine hundred and ninety-ninth'],
    // round 7 (#1430): ordinalWord's hundreds branch dropped the leading digit at exactly n·100
    // ("hundredth" not "one hundredth") on the reasoning that it reads more naturally alone — correct in
    // isolation, but that branch is only ever reached composed under a larger denominator (denomWord's own
    // table intercepts exactly 100), where the dropped digit silently went missing: "3/1100" read as
    // "...thousand hundredths" instead of "...thousand one hundredths". Not reachable from any current
    // generator (KS2 fraction work tops out around thousandths), fixed anyway since it was cheap and correct.
    ['3/1100', 'three one thousand one hundredths'],
    ['1/2100', 'one two thousand one hundredth'],
    // a unit right after a fraction or a decimal — the digit the unit substitution needs has to survive
    // long enough to be seen, before the fraction/decimal passes turn it into words
    ['3.5 kg', 'three point five kilograms'],
    ['3/4 m', 'three quarters metres'],
    ['1/2 kg', 'one half kilograms'],
    ['1 1/2 kg', 'one and one half kilograms'],
    // a unit with no space at all — the tokenizer's own gluing rule inserts exactly one
    ['12.5cm', 'twelve point five centimetres'],
    ['5cm', '5 centimetres'],
    // adjacent, separate fractions — a left-to-right scan never reads across a fraction's own "/" into
    // the next one, so no lookbehind hack is needed for this (#1430 round 1)
    ['1/2 3/4', 'one half three quarters'],
    ['3/4 1/2', 'three quarters one half'],
    ['1/2 3/4 5/6', 'one half three quarters five sixths'],
    // a million and above (NC Y5-6: numbers to 1,000,000/10,000,000)
    ['1000000.5', 'one million point five'],
    ['2000000.25', 'two million point two five'],
    ['1234567.5', 'one million two hundred and thirty-four thousand five hundred and sixty-seven point five'],
    // a Roman numeral directly beside a unit, spaced and unspaced
    ['X cm', 'Roman numeral X centimetres'],
    ['IIkg', 'Roman numeral I, I kilograms'],
    // a Roman numeral glued to a chain of two units, and the mirror image — a chain of units glued to a
    // Roman numeral (#1430 round 3/6/7: this exact asymmetry — `unitThenRoman` originally stripped only a
    // single unit code before requiring a Roman suffix, unlike `romanThenUnits`'s full chain — was itself
    // a self-review finding on the round-7 tokenizer rewrite, caught before it ever reached a reviewer):
    // the tokenizer converts every span in a glued run, not just one, whichever side the chain is on.
    ['Xkgcm', 'Roman numeral X kilograms centimetres'],
    ['kgX', 'kilograms Roman numeral X'],
    ['kgcmX', 'kilograms centimetres Roman numeral X'],
    // the "longest code first" tie-break inside a glued chain — "cm²" must not be cut short as "cm" with
    // a bare "²" left over
    ['Xkgcm²', 'Roman numeral X kilograms square centimetres'],
    // a Roman numeral or a unit glued directly to a digit, either order — different token classes in the
    // tokenizer (a letter run and a digit run), so no `\b`-boundary trick is needed (#1430 round 4)
    ['X5cm', 'Roman numeral X 5 centimetres'],
    ['5Xcm', '5 Roman numeral X centimetres'],
    ['IV12kg', 'Roman numeral I, V 12 kilograms'],
    // a unit code glued to a digit or Roman letter on both sides at once (#1430 round 3)
    ['5kg3', '5 kilograms 3'],
    ['5kg3cm', '5 kilograms 3 centimetres'],
    // 24-hour times
    ['14:35', 'fourteen thirty-five'],
    ['14:05', 'fourteen oh five'],
    ['09:00', 'nine hundred hours'],
    ['23:59', 'twenty-three fifty-nine'],
    ['00:07', 'zero oh seven'],
    // units — the number itself stays a numeral; only the unit code is spelled out
    ['4 cm²', '4 square centimetres'],
    ['9 m²', '9 square metres'],
    ['12 km', '12 kilometres'],
    ['200 ml', '200 millilitres'],
    ['3 kg', '3 kilograms'],
    ['5 cm', '5 centimetres'],
    ['2 m', '2 metres'],
    ['7 g', '7 grams'],
    ['2 l', '2 litres'],
    ['5 mm', '5 millimetres'],
    ['200 mg', '200 milligrams'],
    // Roman numerals — spelled letter by letter, never read as their value
    ['What does XIV mean?', 'What does Roman numeral X, I, V mean what'],
    ['MCMXCIX', 'Roman numeral M, C, M, X, C, I, X'],
    // operators still go through symSay
    ['3 × 4 = ?', '3 times 4 equals what'],
    // the National Curriculum "N-D shape" idiom (#1430 round 6): read as the digit then the letter D,
    // never as subtraction into a bare Roman numeral D (500) — the shape `symSay`'s own hyphen-to-"minus"
    // rule would otherwise produce, and the same reachable NC vocabulary `util.ts`'s own hint text uses
    ['Slice the 3-D shape', 'Slice the 3 D shape'],
    ['Identify the 2-D shape.', 'Identify the 2 D shape.'],
  ] as const)('ks2Say(%j) is %j', (input, expected) => {
    expect(ks2Say(input)).toBe(expected);
  });

  it('a lone "I" is the pronoun, not the numeral, in an ordinary sentence — but is read as one in bare notation', () => {
    expect(ks2Say('I have 3 apples')).toBe('I have 3 apples');
    expect(ks2Say('What is I in Roman numerals?')).toBe('What is I in Roman numerals what');
    expect(ks2Say('I')).toBe('Roman numeral I');
    expect(ks2Say('I + II = ?')).toBe('Roman numeral I plus Roman numeral I, I equals what');
  });

  it('negative numbers keep symSay\'s "minus", for subtraction and negatives alike', () => {
    expect(ks2Say('7 − 3 = ?')).toBe('7 minus 3 equals what');
    expect(ks2Say('−3.5')).toBe('minus three point five');
    expect(ks2Say('−1 1/2')).toBe('minus one and one half');
  });

  it('sayIsSafe fails on raw notation and passes on its spoken form (the five rail fixtures)', () => {
    const fixtures = ['3/4 of 12', '3.75', '14:35', '4 cm²', 'XIV'];
    for (const raw of fixtures) {
      expect(sayIsSafe(raw), `${JSON.stringify(raw)} should not be safe`).toBe(false);
      expect(sayIsSafe(ks2Say(raw)), `ks2Say(${JSON.stringify(raw)}) should be safe`).toBe(true);
    }
  });

  it('sayIsSafe treats a lone "I" as safe (the pronoun, not a flagged numeral)', () => {
    expect(sayIsSafe('I have 3 apples')).toBe(true);
  });

  it('sayIsSafe is true for ordinary spoken-word sentences with no leftover notation', () => {
    expect(sayIsSafe('three quarters of the pizza')).toBe(true);
    expect(sayIsSafe('fourteen thirty-five')).toBe(true);
    expect(sayIsSafe('three point five kilograms')).toBe(true);
  });

  // Rail completeness, independent of what ks2Say currently produces: a table of known-bad spoken forms
  // that must fail sayIsSafe on their own. The "ks2Say's output passes sayIsSafe" test below can only ever
  // catch sayIsSafe being too strict; it cannot catch sayIsSafe being too lenient, which is the shape every
  // bug found in review had (a leftover unit code with no digit left beside it, once its number is spelled
  // out). This is the test that would have caught them.
  it('sayIsSafe fails a unit code left raw, with or without a digit still beside it', () => {
    for (const bad of ['4 kg', '12 km', '5 mm', 'three point five kg', 'three quarters cm', 'a length in mm']) {
      expect(sayIsSafe(bad), `${JSON.stringify(bad)} should not be safe`).toBe(false);
    }
    // a bare algebra letter is not a unit code and must not be flagged
    expect(sayIsSafe('solve for m')).toBe(true);
  });

  // A three-or-more fraction/decimal chain with no digit beside its middle delimiter ("1/2/3/4") tokenizes
  // as two converted fractions either side of one leftover "/" or "." — the same shape as the ordinary
  // punctuation this codebase already ships (a sentence-ending period, a label colon), so sayIsSafe cannot
  // tell them apart without a false positive against real spoken text (see the punctuation test below).
  // Documented, narrow, and not reachable from any real card today.
  it('a three-or-more fraction/decimal chain leaves one bare delimiter, undetected — a disclosed, narrow gap', () => {
    expect(ks2Say('1/2/3/4')).toBe('one half/three quarters');
    expect(ks2Say('1.2.3.4')).toBe('one point two.three point four');
  });

  // Two independently-reachable narrow gaps from round 1's own review: a Roman numerator glued straight
  // to a following "/", and a decimal glued straight to a following 24-hour time with no separator.
  it('sayIsSafe fails a digit orphaned on only one side of "/" or ":" by an adjacent conversion', () => {
    for (const bad of [ks2Say('XIV/2'), ks2Say('1.5:30'), ks2Say('1:2/3'), ks2Say('IV:30')]) {
      expect(sayIsSafe(bad), `${JSON.stringify(bad)} should not be safe`).toBe(false);
    }
  });

  // The obvious broader fix for the gap above — drop the digit requirement on "."/":" entirely — was
  // tried and rejected: this codebase's own real spoken text uses both for ordinary punctuation, not just
  // KS2 notation, and an unconditional check would reject it. Pinning that these stay safe.
  it('sayIsSafe does not flag ordinary punctuation this codebase already uses in spoken text', () => {
    expect(sayIsSafe('Read the word. Slice its picture.')).toBe(true); // reception.ts's own say field
    expect(sayIsSafe('Find the word: cat')).toBe(true); // year1.ts's own say field shape
    expect(sayIsSafe('Hammer the ninja')).toBe(true); // avatars.ts's own avatar name, contains "mm"
    // a sentence that simply ends in a plain number has nothing to convert (#1430 round 6) — the digit
    // stays a bare digit (out of this module's scope on its own) and the following "." is ordinary
    expect(sayIsSafe(ks2Say('The bus leaves at 9.'))).toBe(true);
    expect(sayIsSafe(ks2Say('There were 10.'))).toBe(true);
    expect(sayIsSafe(ks2Say('Divide 3/4 by 2.'))).toBe(true);
  });

  // Round 6 (#1430): the previous round's "a Roman letter glued to a lower-case letter" rail check had no
  // digit/notation anchor at all, so it fired on the first two letters of any capitalised word starting
  // with I/V/X/L/C/D/M — most of the National Curriculum's own instruction verbs, and any name starting
  // with one of those letters. The tokenizer only ever classifies a run as a Roman numeral (or a Roman
  // numeral spliced with a unit code) when the whole run actually decomposes that way, so an ordinary
  // word is text from the start, never something a rail check has to specially exempt.
  it('sayIsSafe does not flag an ordinary capitalised word starting with a Roman-numeral letter', () => {
    for (const sentence of [
      'Circle the shapes below.', 'Complete the number sentence.', 'Divide the cake.', 'Count to 10.',
      'Match the picture to the word.', 'List the Roman numerals I, V, X, L, C, D, M.',
    ]) {
      expect(sayIsSafe(ks2Say(sentence)), `${JSON.stringify(sentence)} should be safe`).toBe(true);
    }
    expect(sayIsSafe('Xavier likes maths.')).toBe(true);
  });

  // A unit code glued to a digit or Roman letter on *both* sides at once (#1430 round 3) — the tokenizer
  // properly converts every span in the glued run, rather than only flagging the leftover as unsafe.
  it('a unit code glued to a digit or Roman letter on both sides converts and is safe', () => {
    for (const input of ['5kg3', '5kg3cm', '1kg500g', 'Xkg5', 'Xkgcm', 'kgcmX', '5m3', '5g3', '5l3']) {
      expect(sayIsSafe(ks2Say(input)), `ks2Say(${JSON.stringify(input)}) = ${JSON.stringify(ks2Say(input))} should be safe`).toBe(true);
    }
    // the raw, unconverted forms are still correctly flagged unsafe
    for (const bad of ['5kg3', 'Xkg5', 'Xkgcm', 'kgcmX', '5m3', '5g3', '5l3']) {
      expect(sayIsSafe(bad), `${JSON.stringify(bad)} should not be safe`).toBe(false);
    }
  });

  // Regression on the fix above: "m"/"g"/"l" alone are also the first letter of their own fully-converted
  // word ("metres", "grams", "litres"), so a digit immediately before one of *those* words — exactly what
  // ks2Say's own unit substitution produces — must never be misread as a raw single-letter code glued on.
  it('sayIsSafe does not mistake a digit-prefixed unit word for a glued single-letter code', () => {
    for (const good of ['5 metres', '5 grams', '5 litres', '5 millimetres', '5 milligrams', '5 millilitres']) {
      expect(sayIsSafe(good), `${JSON.stringify(good)} should be safe`).toBe(true);
    }
  });

  // Round 7 (#1430): unit-code matching was case-sensitive, so a capitalised unit code ("KG", "5 CM" — the
  // casing an ordinary ruler, packet or KS2 label uses) either mis-read as a Roman numeral (when every
  // letter happened to be one — "5 M", "2 L", "5 CM") or fell through completely unconverted (when it
  // didn't — "KG", "5 MG", "5 G"), and sayIsSafe called the raw, unspoken original safe either way.
  it('a unit code matches case-insensitively, whatever case the source text uses', () => {
    const cases: [string, string][] = [
      ['5 KG', '5 kilograms'], ['KG', 'kilograms'], ['5 MG', '5 milligrams'], ['5 G', '5 grams'],
      ['5 M', '5 metres'], ['2 L', '2 litres'], ['5 CM', '5 centimetres'], ['5 MM', '5 millimetres'],
      ['500 ML', '500 millilitres'],
    ];
    for (const [input, expected] of cases) {
      expect(ks2Say(input), `ks2Say(${JSON.stringify(input)})`).toBe(expected);
      expect(sayIsSafe(input), `${JSON.stringify(input)} should not be safe raw`).toBe(false);
      expect(sayIsSafe(ks2Say(input)), `ks2Say(${JSON.stringify(input)}) should be safe`).toBe(true);
    }
    // a standalone upper-case Roman numeral with no digit/unit context is unaffected — the Roman check
    // itself stays case-sensitive on purpose, so this still reads as the numeral, not a unit
    expect(ks2Say('M')).toBe('Roman numeral M');
  });

  // A Roman numeral glued directly to a digit, either order (#1430 round 4), and a unit code glued to a
  // Roman-numeral suffix (#1430 round 6) — the tokenizer converts these properly (a digit run and a
  // letter run are different token classes, so no `\b`-boundary trick is needed), rather than leaving them
  // raw and only flagging the leftover.
  it('a Roman numeral glued directly to a digit, either order, converts and is safe', () => {
    for (const input of ['X5cm', '5Xcm', 'IV12kg', 'X5', 'kgX']) {
      expect(sayIsSafe(ks2Say(input)), `ks2Say(${JSON.stringify(input)}) = ${JSON.stringify(ks2Say(input))} should be safe`).toBe(true);
    }
  });

  // Two bare Roman numerals either side of a colon ("V:I") never reach the digit-only 24-hour-time pass —
  // each numeral converts on its own, but the colon between them survives raw, glued straight to a letter
  // on both sides. Every real label colon in this codebase is followed by a space, so this is always safe
  // to flag.
  it('sayIsSafe fails a colon left between two converted Roman numerals', () => {
    expect(ks2Say('V:I')).toBe('Roman numeral V:Roman numeral I');
    expect(sayIsSafe(ks2Say('V:I'))).toBe(false);
    expect(sayIsSafe(ks2Say('the ratio is V:X exactly'))).toBe(false);
  });

  // A bare "I" next to a raw unit code is bare notation (a numeral, not a sentence) even though the unit's
  // own spelling supplies a lower-case letter — "kg" must not trip the pronoun heuristic.
  it('a lone "I" next to a unit code is read as the numeral, not mistaken for the pronoun', () => {
    expect(ks2Say('I kg')).toBe('Roman numeral I kilograms');
    expect(sayIsSafe(ks2Say('I kg'))).toBe(true);
    // a real sentence with other lower-case words nearby still keeps "I" as the pronoun
    expect(ks2Say('I weigh 5 kg, I think')).toBe('I weigh 5 kilograms, I think');
  });

  // Round 5 (#1430): a bare "I" glued with no space to a unit code fooled the pronoun heuristic the same
  // way the spaced case above once did.
  it('a lone "I" glued directly to a unit code is read as the numeral too', () => {
    expect(ks2Say('Icm')).toBe('Roman numeral I centimetres');
    expect(sayIsSafe(ks2Say('Icm'))).toBe(true);
    // glued still means glued inside real surrounding prose too — no real sentence glues "I" straight
    // onto the next word either way, so this is never a false positive against real spoken text
    expect(ks2Say('the length is Icm')).toBe('the length is Roman numeral I centimetres');
  });

  // Round 7 (#1430): the pronoun heuristic used one flag for the *whole* input ("does this text have any
  // ordinary prose in it anywhere"), applied to *every* bare "I" regardless of that occurrence's own
  // neighbours — so a genuinely separate, glued leftover elsewhere in the same sentence hid behind an
  // unrelated, genuine pronoun earlier in it. A self-review finding on the round-7 rewrite, caught before
  // it ever reached a reviewer.
  it('a genuine pronoun "I" earlier in a sentence does not exempt a separately glued "I" later in it', () => {
    const sentence = 'I think the ratio is I/2 to check.';
    expect(sayIsSafe(sentence)).toBe(false);
    expect(sayIsSafe(ks2Say(sentence))).toBe(false);
    expect(ks2Say(sentence)).toBe('I think the ratio is Roman numeral I/2 to check.');
    expect(sayIsSafe('I have I5 apples')).toBe(false);
  });

  // Round 5 (#1430): a bare unit code with nothing before it at all — the tokenizer converts a multi-letter
  // unit code unconditionally, wherever its own isolated letter run turns up.
  it('a bare unit code glued to a following fraction or decimal converts, and is flagged raw', () => {
    expect(ks2Say('kg3/4')).toBe('kilograms three quarters');
    expect(sayIsSafe(ks2Say('kg3/4'))).toBe(true);
    expect(sayIsSafe('kg3/4')).toBe(false);
    expect(ks2Say('mg2.5')).toBe('milligrams two point five');
    expect(sayIsSafe(ks2Say('mg2.5'))).toBe(true);
    expect(sayIsSafe('mg2.5')).toBe(false);
  });

  // Round 8 (#1430): a bare chain of 2+ unit codes with no Roman-numeral anchor on either side ("kgcm")
  // matched no existing branch — `romanThenUnits`/`unitThenRoman` both require a Roman numeral next to the
  // chain, which this doesn't have — and fell all the way through to a `text` token, round-tripping
  // completely unconverted and unflagged. Also covers the same round's mirror finding: the two Roman-anchor
  // checks were themselves still upper-case-only, so a lower-case anchor next to a correctly-decomposed
  // chain ("xkg", "kgx") fell through the same way.
  it('a bare chain of 2+ unit codes with no Roman anchor converts, and is flagged raw', () => {
    expect(ks2Say('kgcm')).toBe('kilograms centimetres');
    expect(sayIsSafe(ks2Say('kgcm'))).toBe(true);
    expect(sayIsSafe('kgcm')).toBe(false);
    expect(ks2Say('5kgcm')).toBe('5 kilograms centimetres');
    expect(sayIsSafe(ks2Say('5kgcm'))).toBe(true);
    expect(sayIsSafe('5kgcm')).toBe(false);
    expect(ks2Say('Convert 5kgcm to cm')).toBe('Convert 5 kilograms centimetres to centimetres');
    expect(sayIsSafe(ks2Say('Convert 5kgcm to cm'))).toBe(true);
    for (const input of ['xkg', 'kgx', '5kgv']) {
      expect(sayIsSafe(ks2Say(input)), `ks2Say(${JSON.stringify(input)}) = ${JSON.stringify(ks2Say(input))} should be safe`).toBe(true);
      expect(sayIsSafe(input), `${JSON.stringify(input)} should not be safe raw`).toBe(false);
    }
  });

  // Round 5 (#1430): a Roman numeral glued with no space to a fraction or decimal shares no word boundary
  // with the *spelled-out word* its neighbour becomes, on either side — the tokenizer converts both spans
  // and spaces them apart, rather than leaving the Roman numeral raw.
  it('a Roman numeral glued directly to an already-spelled-out word, either order, converts and is safe', () => {
    for (const input of ['3/4X', '1.5XIV', 'X1.5']) {
      expect(sayIsSafe(ks2Say(input)), `ks2Say(${JSON.stringify(input)}) = ${JSON.stringify(ks2Say(input))} should be safe`).toBe(true);
    }
  });

  // Round 6 (#1430): the National Curriculum's own "N-D shape" idiom ("3-D", "2-D") — `symSay`'s hyphen
  // rule would otherwise free the bare "D" to be read as the Roman numeral 500 the moment the hyphen
  // splits it off from its digit. Reachable today: util.ts's own hint text uses exactly this shape.
  it('the "N-D shape" idiom reads as the digit and the letter, never subtraction into a Roman numeral', () => {
    expect(ks2Say('Slice the 3-D shape')).toBe('Slice the 3 D shape');
    expect(sayIsSafe(ks2Say('Slice the 3-D shape'))).toBe(true);
    expect(ks2Say('The cube is a 3-D shape.')).toBe('The cube is a 3 D shape.');
    expect(sayIsSafe(ks2Say('The cube is a 3-D shape.'))).toBe(true);
    // an ordinary hyphenated word starting with "D" is unaffected — not the "N-D" idiom at all
    expect(ks2Say('10-Diego')).toBe('10 minus Diego');
    // NC material is not consistent about case
    expect(ks2Say('Slice the 3-d shape')).toBe('Slice the 3 d shape');
  });

  // The module's own core invariant (its header comment states it): ks2Say never leaves behind what
  // sayIsSafe is built to catch. Checked over a wider table than the five official rail fixtures above,
  // including the values that once broke cardinal() past 99 (a one-line regression there reads as
  // "undefined" text, which is safe by sayIsSafe's own rules but wrong — this is what would catch that).
  it('ks2Say\'s output always passes sayIsSafe, over every notation shape this file handles', () => {
    const raw = [
      '3/4', '2 3/4', '300/4', '3.75', '123.5', '1234.56', '14:35', '23:59',
      '4 cm²', '9 m²', '12 km', '5 mm', '200 mg', 'XIV', 'MCMXCIX', '−3.5', '7 − 3 = ?',
      '1/20', '1/1000', '1/999', '3.5 kg', '3/4 m', '1 1/2 kg', '12.5cm',
      '1/2 3/4', '3/4 1/2', '1000000.5', '1234567.5', 'X cm', 'IIkg',
      '5 mm', '5 m', '5 g', '5 l', '200 ml', '200 mg',
      'Icm', 'the length is Icm', 'kg3/4', 'mg2.5', 'I kg',
      '5kg3', '5kg3cm', '1kg500g', 'Xkg5', 'Xkgcm', 'kgX', 'kgcmX', 'Xkgcm²', 'X5cm', '5Xcm', 'IV12kg', 'X5',
      '3/4X', '1.5XIV', 'X1.5', 'Slice the 3-D shape', 'The cube is a 3-D shape.',
      'Circle the shapes below.', 'Divide 3/4 by 2.', 'The bus leaves at 9.',
      'kgcm', '5kgcm', 'Convert 5kgcm to cm', 'xkg', 'kgx', '5kgv',
    ];
    for (const text of raw) expect(sayIsSafe(ks2Say(text)), `ks2Say(${JSON.stringify(text)}) = ${JSON.stringify(ks2Say(text))}`).toBe(true);
  });

  // The tokenizer must not crash or hang on ordinary-shaped-but-unusual input: a non-canonical Roman run,
  // an empty string, a large-but-finite number. `cardinal(Infinity)` recursing forever on a digit string
  // long enough to overflow `Number` (round 3's own disclosed, declined finding — NC caps KS2 numbers at
  // 10,000,000, so this is not reachable from any real generator) is not this test's concern.
  it('never crashes on ordinary-shaped input, including a large number', () => {
    expect(() => ks2Say('9'.repeat(15) + '.5')).not.toThrow();
    expect(() => ks2Say('')).not.toThrow();
    expect(() => ks2Say('IIII')).not.toThrow();
    expect(ks2Say('')).toBe('');
    expect(sayIsSafe('')).toBe(true);
  });

  // The registry sweep runs zero times today — no KS2 (`isKs2`) topic exists yet — so this loop is proven
  // vacuous rather than silently always-passing, per the issue's own framing. It starts checking real cards
  // the moment the first KS2 topic lands, with no test to write then.
  it('every KS2 topic\'s say (or prompt) is free of raw notation, 150 draws per difficulty', () => {
    const ks2Topics = TOPICS.filter(t => isKs2(t.year));
    expect(ks2Topics.length).toBe(0); // update this once a KS2 topic ships (#1050 is blocked)
    for (const topic of ks2Topics) {
      for (const d of [1, 2, 3] as Difficulty[]) {
        const draw = rng(d * 1000 + topic.id.length);
        for (let i = 0; i < 150; i++) {
          const q = topic.gen(d, draw);
          const spoken = q.say ?? q.prompt;
          expect(sayIsSafe(spoken), `${topic.id} d${d}: "${spoken}" is not safe to speak`).toBe(true);
        }
      }
    }
  });
});
