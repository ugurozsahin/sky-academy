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
    // a unit right after a fraction or a decimal — the digit the unit substitution needs has to survive
    // long enough to be seen, before the fraction/decimal passes turn it into words
    ['3.5 kg', 'three point five kilograms'],
    ['3/4 m', 'three quarters metres'],
    ['1/2 kg', 'one half kilograms'],
    ['1 1/2 kg', 'one and one half kilograms'],
    // a unit with no space at all — the substituted space must not fuse into the spelled-out number
    ['12.5cm', 'twelve point five centimetres'],
    ['5cm', '5 centimetres'],
    // adjacent, separate fractions — never read as one fraction's whole part plus the next one's own
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

  // A conversion pass can consume a token boundary belonging to adjacent, separate notation — a scan
  // reaching past where it should stop leaves a raw digit with only *one* side of its delimiter converted
  // ("1/two", "V/2"), which the plain digit-delimiter-digit checks above cannot see. These four inputs are
  // not fully converted by ks2Say (documented, narrow shapes — a Roman numerator, a three-fraction run with
  // no separator, a bare decimal glued to a time), so this checks the rail catches the raw leftover on its
  // own, independent of ks2Say ever fixing the conversion itself.
  it('sayIsSafe fails a digit orphaned on only one side of "/" or "." by an adjacent conversion', () => {
    for (const bad of [ks2Say('XIV/2'), ks2Say('1/23/4'), ks2Say('3.4.5'), ks2Say('1.5:30')]) {
      expect(sayIsSafe(bad), `${JSON.stringify(bad)} should not be safe`).toBe(false);
    }
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
    ];
    for (const text of raw) expect(sayIsSafe(ks2Say(text)), `ks2Say(${JSON.stringify(text)}) = ${JSON.stringify(ks2Say(text))}`).toBe(true);
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
