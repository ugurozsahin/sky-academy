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
    // a chain of 2+ glued unit codes with nothing else (#1430 round 8) — this used to fall through
    // completely unconverted
    ['kgcm', 'kilograms centimetres'],
    ['5kgcm', '5 kilograms centimetres'],
    // a unit code glued to a digit on both sides at once (#1430 round 3)
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
    // operators still go through symSay
    ['3 × 4 = ?', '3 times 4 equals what'],
    // the National Curriculum "N-D shape" idiom (#1430 round 6): read as the digit then the letter D,
    // never as subtraction — the shape `symSay`'s own hyphen-to-"minus" rule would otherwise produce, and
    // the same reachable NC vocabulary `util.ts`'s own hint text uses
    ['Slice the 3-D shape', 'Slice the 3 D shape'],
    ['Identify the 2-D shape.', 'Identify the 2 D shape.'],
  ] as const)('ks2Say(%j) is %j', (input, expected) => {
    expect(ks2Say(input)).toBe(expected);
  });

  it('negative numbers keep symSay\'s "minus", for subtraction and negatives alike', () => {
    expect(ks2Say('7 − 3 = ?')).toBe('7 minus 3 equals what');
    expect(ks2Say('−3.5')).toBe('minus three point five');
    expect(ks2Say('−1 1/2')).toBe('minus one and one half');
  });

  it('sayIsSafe fails on raw notation and passes on its spoken form (the rail fixtures)', () => {
    const fixtures = ['3/4 of 12', '3.75', '14:35', '4 cm²'];
    for (const raw of fixtures) {
      expect(sayIsSafe(raw), `${JSON.stringify(raw)} should not be safe`).toBe(false);
      expect(sayIsSafe(ks2Say(raw)), `ks2Say(${JSON.stringify(raw)}) should be safe`).toBe(true);
    }
  });

  it('sayIsSafe lets a label colon through and still rejects a digit-both-sides colon', () => {
    for (const t of ['Solve: 3 + 4 = ?', 'Total: 5 apples']) {
      expect(sayIsSafe(ks2Say(t)), t).toBe(true);
    }
    expect(sayIsSafe('3:4')).toBe(false);
    expect(sayIsSafe('3 : 4')).toBe(false);
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

  // Round 6 (#1430): capitalised, ordinary English words are never mistaken for notation — the tokenizer
  // only ever classifies a letter run as a unit (or a glued chain of units) when it actually decomposes
  // that way, so an ordinary word is text from the start.
  it('sayIsSafe does not flag an ordinary capitalised word', () => {
    for (const sentence of [
      'Circle the shapes below.', 'Complete the number sentence.', 'Divide the cake.', 'Count to 10.',
      'Match the picture to the word.',
    ]) {
      expect(sayIsSafe(ks2Say(sentence)), `${JSON.stringify(sentence)} should be safe`).toBe(true);
    }
    expect(sayIsSafe('Xavier likes maths.')).toBe(true);
  });

  // A unit code glued to a digit on *both* sides at once (#1430 round 3) — the tokenizer properly converts
  // every span in the glued run, rather than only flagging the leftover as unsafe.
  it('a unit code glued to a digit on both sides converts and is safe', () => {
    for (const input of ['5kg3', '5kg3cm', '1kg500g', '5m3', '5g3', '5l3']) {
      expect(sayIsSafe(ks2Say(input)), `ks2Say(${JSON.stringify(input)}) = ${JSON.stringify(ks2Say(input))} should be safe`).toBe(true);
    }
    // the raw, unconverted forms are still correctly flagged unsafe
    for (const bad of ['5kg3', '5m3', '5g3', '5l3']) {
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
  // casing an ordinary ruler, packet or KS2 label uses) fell through completely unconverted, and sayIsSafe
  // called the raw, unspoken original safe.
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

  // Round 8 (#1430): a bare chain of 2+ unit codes with nothing else ("kgcm") matched no existing branch and
  // fell all the way through to a `text` token, round-tripping completely unconverted and unflagged.
  it('a bare chain of 2+ unit codes converts, and is flagged raw', () => {
    expect(ks2Say('kgcm')).toBe('kilograms centimetres');
    expect(sayIsSafe(ks2Say('kgcm'))).toBe(true);
    expect(sayIsSafe('kgcm')).toBe(false);
    expect(ks2Say('5kgcm')).toBe('5 kilograms centimetres');
    expect(sayIsSafe(ks2Say('5kgcm'))).toBe(true);
    expect(sayIsSafe('5kgcm')).toBe(false);
    expect(ks2Say('Convert 5kgcm to cm')).toBe('Convert 5 kilograms centimetres to centimetres');
    expect(sayIsSafe(ks2Say('Convert 5kgcm to cm'))).toBe(true);
  });

  // Round 6 (#1430): the National Curriculum's own "N-D shape" idiom ("3-D", "2-D") reads as the digit then
  // the letter D, never as subtraction. Reachable today: util.ts's own hint text uses exactly this shape.
  it('the "N-D shape" idiom reads as the digit and the letter, never subtraction', () => {
    expect(ks2Say('Slice the 3-D shape')).toBe('Slice the 3 D shape');
    expect(sayIsSafe(ks2Say('Slice the 3-D shape'))).toBe(true);
    expect(ks2Say('The cube is a 3-D shape.')).toBe('The cube is a 3 D shape.');
    expect(sayIsSafe(ks2Say('The cube is a 3-D shape.'))).toBe(true);
    // an ordinary hyphenated word starting with "D" is unaffected — not the "N-D" idiom at all
    expect(ks2Say('10-Diego')).toBe('10 minus Diego');
    // NC material is not consistent about case
    expect(ks2Say('Slice the 3-d shape')).toBe('Slice the 3 d shape');
  });

  // Round 9 (#1430) finding 1: `singleLetterUnitOK`'s digit adjacency check used to read the text as it
  // arrived, before `ks2Say`'s own trailing whitespace collapse closed a double space into one — so raw
  // "5  m" (not touching, by that stale reading) and its own output "5 m" (touching) disagreed about
  // whether "m" is the unit or the algebra variable. Both functions now normalise whitespace before
  // tokenizing, so classification never depends on how many spaces the input happened to have.
  it('sayIsSafe classifies a digit/unit adjacency the same way whatever the original spacing', () => {
    for (const raw of ['5  m', '5   m', '5  g', '5  l']) {
      const said = ks2Say(raw);
      expect(sayIsSafe(raw), `${JSON.stringify(raw)} should not be safe`).toBe(false);
      expect(sayIsSafe(said), `ks2Say(${JSON.stringify(raw)}) = ${JSON.stringify(said)} should be safe`).toBe(true);
    }
  });

  // Round 9 (#1430) finding 3: the fraction and 24-hour-time separators required the digits to touch it
  // directly, so "3 / 4" and "3:4" with a space either side tokenised as plain text/digits — outside
  // `NOTATION` — and slipped past both the conversion and the safety check.
  it('sayIsSafe and ks2Say treat a spaced fraction separator the same as a tight one', () => {
    expect(ks2Say('3 / 4')).toBe('three quarters');
    expect(sayIsSafe('3 / 4')).toBe(false);
    expect(ks2Say('Is 3 / 4 bigger than 1 / 2?')).toBe('Is three quarters bigger than one half what');
    expect(sayIsSafe('Is 3 / 4 bigger than 1 / 2?')).toBe(false);
    expect(ks2Say('2 1 / 2 kg')).toBe('two and one half kilograms');
    expect(sayIsSafe('2 1 / 2 kg')).toBe(false);
    // a spaced 24-hour time converts the same way as a tight one
    expect(ks2Say('14 : 35')).toBe('fourteen thirty-five');
    expect(sayIsSafe('14 : 35')).toBe(false);
    // a spaced colon that is not a valid time still trips the digit-adjacent backstop
    expect(sayIsSafe('The ratio is 3 : 4 today')).toBe(false);
  });

  // Round 10 (#1430): Roman numerals are out of scope for this file (see the header comment, #1463) — nine
  // defects across rounds 4-10 were all in Roman-numeral detection, a textual heuristic that kept colliding
  // with real KS2 prose (a genuine sentence like "The Roman numeral V equals which number?" is
  // indistinguishable, by pattern alone, from ks2Say's own rendering of the same words). Bare Roman-numeral
  // text is therefore plain, unconverted text here — never converted, and never flagged either way — until
  // #1463 gives it a proper, structural fix.
  it('Roman-numeral text passes through unconverted and unflagged — out of scope, tracked in #1463', () => {
    expect(ks2Say('What does XIV mean?')).toBe('What does XIV mean what');
    expect(ks2Say('Choose V or X')).toBe('Choose V or X');
    expect(ks2Say('I have 3 apples')).toBe('I have 3 apples');
    expect(sayIsSafe('What does XIV mean?')).toBe(true);
    expect(sayIsSafe('Choose V or X')).toBe(true);
    // the exact round-10 collision: this is real, raw, unconverted KS2 prose that happens to use the same
    // words ks2Say's own (now-removed) Roman-numeral rendering did — both functions treat it as ordinary text
    expect(ks2Say('The Roman numeral V equals which number?')).toBe('The Roman numeral V equals which number what');
    expect(sayIsSafe('The Roman numeral V equals which number?')).toBe(true);
  });

  // The module's own core invariant (its header comment states it): ks2Say never leaves behind what
  // sayIsSafe is built to catch. Checked over a wider table than the official rail fixtures above,
  // including the values that once broke cardinal() past 99 (a one-line regression there reads as
  // "undefined" text, which is safe by sayIsSafe's own rules but wrong — this is what would catch that).
  it('ks2Say\'s output always passes sayIsSafe, over every notation shape this file handles', () => {
    const raw = [
      '3/4', '2 3/4', '300/4', '3.75', '123.5', '1234.56', '14:35', '23:59',
      '4 cm²', '9 m²', '12 km', '5 mm', '200 mg', '−3.5', '7 − 3 = ?',
      '1/20', '1/1000', '1/999', '3.5 kg', '3/4 m', '1 1/2 kg', '12.5cm',
      '1/2 3/4', '3/4 1/2', '1000000.5', '1234567.5',
      '5 mm', '5 m', '5 g', '5 l', '200 ml', '200 mg',
      'kg3/4', 'mg2.5',
      '5kg3', '5kg3cm', '1kg500g',
      'Slice the 3-D shape', 'The cube is a 3-D shape.',
      'Circle the shapes below.', 'Divide 3/4 by 2.', 'The bus leaves at 9.',
      'kgcm', '5kgcm', 'Convert 5kgcm to cm',
      '5  m', '5  g', '5  l',
      '3 / 4', 'Is 3 / 4 bigger than 1 / 2?', '2 1 / 2 kg', '14 : 35',
    ];
    for (const text of raw) expect(sayIsSafe(ks2Say(text)), `ks2Say(${JSON.stringify(text)}) = ${JSON.stringify(ks2Say(text))}`).toBe(true);
  });

  // The tokenizer must not crash or hang on ordinary-shaped-but-unusual input: an empty string, a
  // large-but-finite number. `cardinal(Infinity)` recursing forever on a digit string long enough to
  // overflow `Number` (round 3's own disclosed, declined finding — NC caps KS2 numbers at 10,000,000, so
  // this is not reachable from any real generator) is not this test's concern.
  it('never crashes on ordinary-shaped input, including a large number', () => {
    expect(() => ks2Say('9'.repeat(15) + '.5')).not.toThrow();
    expect(() => ks2Say('')).not.toThrow();
    expect(ks2Say('')).toBe('');
    expect(sayIsSafe('')).toBe(true);
  });

  // The registry sweep ran zero times when this file first landed — no KS2 (`isKs2`) topic existed yet —
  // proven vacuous rather than silently always-passing, per the issue's own framing. #1050's Year 3 shell
  // (merged after this PR opened) shipped the first one (`y3-count`), so the sweep now checks a real topic;
  // the `>= 1` keeps this test itself from quietly going vacuous again if that topic is ever renamed away
  // from KS2, the same way the old `toBe(0)` pinned the previous state.
  it('every KS2 topic\'s say (or prompt) is free of raw notation, 150 draws per difficulty', () => {
    const ks2Topics = TOPICS.filter(t => isKs2(t.year));
    expect(ks2Topics.length).toBeGreaterThanOrEqual(1);
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

describe('ks2say.ts: declared Roman numerals (#1057, #1463)', () => {
  const say = (t: string, ...roman: string[]) => ks2Say(t, { roman });

  it('speaks a declared numeral as letters, never as its value', () => {
    expect(say('XIV', 'XIV')).toBe('Roman numeral X, I, V');
    expect(say('What does XIV mean?', 'XIV')).toBe('What does Roman numeral X, I, V mean what');
    expect(say('What does XIV mean?', 'XIV')).not.toMatch(/fourteen/);
  });

  it('is never guessed: undeclared text is untouched, so prose and variables are safe', () => {
    expect(ks2Say('XIV')).toBe('XIV');
    expect(ks2Say('The Roman numeral V equals which number?')).toBe('The Roman numeral V equals which number what');
    expect(say('Add V and X', 'XIV')).toBe('Add V and X');
    expect(say('Xavier lives in Cambridge', 'X')).toBe('Xavier lives in Cambridge');
  });

  it('a declared numeral made of unit letters is a numeral, not a unit (the CM / MM / L trap)', () => {
    expect(say('CM', 'CM')).toBe('Roman numeral C, M');
    expect(say('MM', 'MM')).toBe('Roman numeral M, M');
    expect(say('L', 'L')).toBe('Roman numeral L');
    expect(ks2Say('CM')).toBe('centimetres');
    expect(say('5 cm', 'CM')).toBe('5 centimetres');
  });

  it('keeps the unit when a declared numeral is glued to one', () => {
    expect(say('Xkg', 'X')).toBe('Roman numeral X kilograms');
    expect(say('kgX', 'X')).toBe('kilograms Roman numeral X');
  });

  it('ignores a declaration that is not a canonical numeral', () => {
    expect(say('IIII', 'IIII')).toBe('IIII');
    expect(say('Xavier', 'Xavier')).toBe('Xavier');
  });

  it('still converts other notation beside a numeral', () => {
    expect(say('XII is 3/4 of 16', 'XII')).toBe('Roman numeral X, I, I is three quarters of 16');
  });
});
