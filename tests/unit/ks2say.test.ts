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
