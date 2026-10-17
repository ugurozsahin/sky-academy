import { describe, expect, it } from 'vitest';
import { ks2Say, sayIsSafe, tokenize, NOTATION, type TokKind } from '../../src/curriculum/ks2say';
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
    ['3/4 m', 'three quarters of a metre'],
    ['1/2 kg', 'one half of a kilogram'],
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
    ['00:07', 'seven minutes past midnight'],   // #1465: not "zero oh seven"
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
    // #1465: a decimal chain is now refused outright (raw, and unsafe), no longer half-converted
    expect(ks2Say('1.2.3.4')).toBe('1.2.3.4');
    expect(sayIsSafe('1.2.3.4')).toBe(false);
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
      // #1465
      '£3.50', '1,234.5', '10 cm³', '60 km/h', '1 kg', '2:30-3:15', '24:00', '00:07', '1:30pm', '3-digit number', '5²', '5kgs', '5 m2', '12 / 3 = ?',
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
          // #1465: the sweep above reads the raw text, so it cannot see a wrong `ks2Say` output; this does
          expect(sayIsSafe(ks2Say(spoken)), `${topic.id} d${d}: ks2Say("${spoken}") is not safe to speak`).toBe(true);
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

// #1465: the misreadings a #1430 review swept, queued while no card called `ks2Say`. Each string below either
// reads as its intended spoken form or is refused: left raw, so `sayIsSafe(ks2Say(x))` is false and a card
// author has to rewrite it.
describe('ks2say.ts: misreadings swept from the #1430 review (#1465)', () => {
  it.each([
    // numbers with a thousands separator, and money
    ['1,234.5', 'one thousand two hundred and thirty-four point five'],
    ['£3.50', 'three pounds fifty'],
    ['£3.5', 'three pounds fifty'],
    ['£3.05', 'three pounds five'],
    ['£0.50', 'fifty pence'],
    ['£0.01', 'one penny'],
    ['£1', 'one pound'],
    ['£1,250.50', 'one thousand two hundred and fifty pounds fifty'],
    // units: cubic, area, speed, plural s, the superscript typed as a digit, a thousands separator before one
    ['10 cm³', '10 cubic centimetres'],
    ['2 m³', '2 cubic metres'],
    ['4 km²', '4 square kilometres'],
    ['60 km/h', '60 kilometres per hour'],
    ['km/h', 'kilometres per hour'],
    ['5 m/s', '5 metres per second'],
    ['5kgs', '5 kilograms'],
    ['20 cms', '20 centimetres'],
    ['5 m2', '5 square metres'],
    ['9 cm3', '9 cubic centimetres'],
    ['1,000 m', '1,000 metres'],
    ['5²', '5 squared'],
    ['2³', '2 cubed'],
    // exactly one of a unit is singular
    ['1 kg', '1 kilogram'],
    ['1 cm²', '1 square centimetre'],
    ['1 km/h', '1 kilometre per hour'],
    ['1 l', '1 litre'],
    ['1.5 kg', 'one point five kilograms'],
    ['11 kg', '11 kilograms'],
    // a spaced slash after a number that is not smaller is division; a proper spaced fraction is still a fraction
    ['12 / 3 = ?', '12 divided by 3 equals what'],
    ['3 / 4', 'three quarters'],
    // times: a range, midnight, a 12-hour time
    ['2:30-3:15', 'two thirty to three fifteen'],
    ['24:00', 'midnight'],
    ['00:00', 'midnight'],
    ['00:01', 'one minute past midnight'],
    ['1:30pm', 'one thirty p m'],
    ['12:00 am', "twelve o'clock a m"],
    ['9:05pm', 'nine oh five p m'],
    // a digit joined to a lower-case word is a compound modifier, never subtraction
    ['3-digit number', '3 digit number'],
    ['a 5-minute walk', 'a 5 minute walk'],
    // not a unit chain, and not notation either
    ['Mmm, nice', 'Mmm, nice'],
    // zero is a perfectly good numerator
    ['0/4', 'zero quarters'],
    // the comparison signs, and an area in mm² / km² (neither had a spoken form)
    ['3 > 2', '3 greater than 2'],
    ['Is 3 < 5?', 'Is 3 less than 5 what'],
    ['12 mm²', '12 square millimetres'],
  ] as const)('ks2Say(%j) is %j, and that is safe to speak', (input, expected) => {
    expect(ks2Say(input)).toBe(expected);
    expect(sayIsSafe(ks2Say(input))).toBe(true);
  });

  // Refused: there is no spoken form to be had without guessing, so the notation is left raw and `sayIsSafe` says
  // no. A card that prints one of these fails the registry sweep until it is rewritten.
  it.each([
    '1/1', '1/0', '5/1', '2 3/1',                  // a denominator of 0 or 1 is no fraction ("one first", "one zeroth")
    '25:10', '7:5', '14:30pm', '0:30am', '3:4',     // not a time (a ratio has no spoken form here: write it in words)
    '1.5.2', '1.2.3.4', '3/4.5', '£3.505',         // not a number, not a fraction, not a price
    'Solve 2 m = 6', '3 g = 9', 'Solve 3m + 1 = 7',  // the only unit in a sentence with an "=" is a single letter: an equation in m
    '4/ 3', '4 /3',                                // a slash spaced on one side only
  ])('ks2Say(%j) leaves it raw and sayIsSafe refuses the result', (input) => {
    expect(sayIsSafe(ks2Say(input))).toBe(false);
  });

  it('a single-letter unit beside a unit across the "=" is still a unit', () => {
    expect(ks2Say('3 m = ? cm')).toBe('3 metres equals what centimetres');
    expect(ks2Say('2 l = 2000 ml')).toBe('2 litres equals 2000 millilitres');
  });

  // A fraction right before a unit is a part of one of it. An improper fraction is written tight ("7/4"); spaced
  // after a number that is not smaller, the slash is division ("7 / 4"), which cannot be told from a fraction.
  it.each([
    ['3/4 m', 'three quarters of a metre'],
    ['1/2 kg', 'one half of a kilogram'],
    ['7/4 l', 'seven quarters of a litre'],
    ['7 / 4', '7 divided by 4'],
    ['5 m + 3 m = 8 m', '5 metres plus 3 metres equals 8 metres'],
    ['12:30pm', 'twelve thirty p m'],
  ] as const)('ks2Say(%j) is %j', (input, expected) => {
    expect(ks2Say(input)).toBe(expected);
    expect(sayIsSafe(ks2Say(input))).toBe(true);
  });

  // The module's tokens must tile its (whitespace-normalised) input exactly: no gap, no overlap, whatever the
  // text. A span lost here is a span `sayIsSafe` could never see.
  const FRAGMENTS = [
    '3/4', '2 3/4', '12 / 3', '1/1', '3.75', '1,234.5', '£3.50', '£3.505', '1.5.2', '3/4.5', '14:35', '24:00', '25:10',
    '1:30pm', '2:30-3:15', '5 kg', '1 kg', '5kgs', '10 cm³', '5 m2', '5²', '60 km/h', '3-D', '3-digit', 'Mmm', 'Solve 2 m = 6',
    '347', '+', '=', '?', ' ', ',', '.', ':', '/', '-', 'and', 'the cube',
  ];
  /** The fragments above that are refused or ambiguous by design, so the "always safe" invariant leaves them out. */
  const REFUSED_FRAGMENTS = new Set(['1/1', '£3.505', '1.5.2', '3/4.5', '25:10', 'Solve 2 m = 6', '=', '?', ':', '.', '/', '-', ',', '+']);
  const seeded = (seed: number, n: number): string => {
    const r = rng(seed);
    return Array.from({ length: n }, () => FRAGMENTS[Math.floor(r() * FRAGMENTS.length)]).join(r() < 0.5 ? ' ' : '');
  };

  it('the tokens tile the input exactly, raw or whitespace-normalised, with or without declared numerals', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const raw = seeded(seed, 1 + (seed % 6));
      for (const text of [raw, raw.replace(/\s+/g, ' ')]) {
        for (const roman of [new Set<string>(), new Set(['X', 'XIV'])]) {
          let at = 0;
          for (const t of tokenize(text, roman)) {
            expect(t.start, `seed ${seed}: ${JSON.stringify(text)}`).toBe(at);
            expect(t.raw).toBe(text.slice(t.start, t.end));
            at = t.end;
          }
          expect(at, `seed ${seed}: ${JSON.stringify(text)}`).toBe(text.length);
        }
      }
    }
  });

  it('never throws, and never speaks a broken number, over the same fuzz', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const text = seeded(seed, 1 + (seed % 6));
      const out = ks2Say(text);
      expect(out, JSON.stringify(text)).not.toMatch(/undefined|NaN|Infinity|\[object/);
      expect(typeof sayIsSafe(text)).toBe('boolean');
    }
  });

  // The invariant the issue asked a fuzz for (it would have found the 24:00 hole): whatever supported
  // fragments are put side by side, what `ks2Say` says is safe to speak.
  const SUPPORTED = FRAGMENTS.filter(f => !REFUSED_FRAGMENTS.has(f));
  it('ks2Say of supported fragments laid side by side is always safe to speak', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const r = rng(seed * 31);
      const text = Array.from({ length: 2 + (seed % 4) }, () => SUPPORTED[Math.floor(r() * SUPPORTED.length)]).join(' ');
      expect(sayIsSafe(ks2Say(text)), `ks2Say(${JSON.stringify(text)}) = ${JSON.stringify(ks2Say(text))}`).toBe(true);
    }
  });

  // Which rule claims a span is order-sensitive (`RULES` in ks2say.ts); each pair that shares a prefix is pinned.
  it.each([
    ['2 3/4', ['mixedFraction']],                       // not a digit, a space and a fraction
    ['3/4', ['fraction']],
    ['1.5.2', ['malformed']],                           // not a decimal followed by ".2"
    ['3/4.5', ['malformed']],                           // not a fraction followed by ".5"
    ['£3.505', ['malformed']],                          // not a price followed by "5"
    ['£3.50', ['money']],                               // not a decimal after a "£" text
    ['£1,250.50', ['money']],
    ['1,234.5', ['decimal']],
    ['12 / 3', ['digit', 'text', 'text', 'text', 'digit']],   // division: no fraction claims it
    ['4/ 3', ['malformed']],
    ['3-D', ['dimension']],
    ['3-digit', ['compound']],
    ['14:35', ['time']],
    ['60 km/h', ['digit', 'text', 'unit']],
    ['5²', ['power']],
  ] as const)('tokenize(%j) is %j', (text, kinds) => {
    expect(tokenize(text).map(t => t.kind)).toEqual(kinds);
  });

  // Every notation kind is flagged when raw, and the kinds that are not notation are not. `NOTATION` is a
  // `Record<TokKind, boolean>`, so a kind added without a decision does not compile; the second test below holds
  // each kind to what `sayIsSafe` actually does with a raw sample of it.
  it.each([
    ['3/4', false], ['2 3/4', false], ['3.75', false], ['14:35', false], ['5 kg', false], ['3-D', false], ['1.5.2', false],
    ['£3.50', true], ['3-digit', true], ['347', true], ['plain words', true],
  ] as const)('sayIsSafe(%j) is %j', (raw, safe) => {
    expect(sayIsSafe(raw)).toBe(safe);
  });
  it('sayIsSafe agrees with NOTATION for a raw sample of every kind that can appear in raw text', () => {
    // (`power` is left out: a raw "5²" is refused by the superscript backstop, tested below, not by its kind)
    const samples: Partial<Record<TokKind, string>> = {
      text: 'plain words', digit: '347', compound: '3-digit', money: '£3.50',
      dimension: '3-D', mixedFraction: '2 3/4', fraction: '3/4', time: '14:35', decimal: '3.75', malformed: '1.5.2', unit: '5 kg',
    };
    for (const [kind, sample] of Object.entries(samples) as [TokKind, string][]) {
      expect(tokenize(sample).some(t => t.kind === kind), `${sample} holds a ${kind}`).toBe(true);
      expect(sayIsSafe(sample), `${kind}: ${sample}`).toBe(!NOTATION(kind));
    }
  });
  it('a raw superscript is refused whether or not ks2Say would rewrite it', () => {
    expect(sayIsSafe('5²')).toBe(false);
    expect(sayIsSafe('10 cm³')).toBe(false);
    expect(sayIsSafe('5³')).toBe(false);   // a power is rewritten, but only the backstop flags it raw
  });
});
