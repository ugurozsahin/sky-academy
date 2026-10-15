// y4-roman (#1135): Roman numerals to 100 (C), both ways, plus the place-value cards of d3 (zero, tens and ones).
// Numerals come from roman.ts (canonical by construction); the voice spells the letters, never the value (#1057).
// Bubble rule: a numeral over 6 letters is never an option, answer or decoy — LXXXVIII is 4.08 em in a phone
// bubble, past the 4.0 em register; it, XXXVIII, LXXVIII and LXXXVII stay on the card only.
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, ri, shuffle, wordQ } from './util';
import { ks2Say } from './ks2say';
import { toRoman } from './roman';

const GLYPH: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
const fitsBubble = (n: number) => n >= 1 && n <= 100 && toRoman(n).length <= 6;

/** The additive misread: every letter counted as a plus (IV as 6, XL as 60). Equals `n` when there is no subtractive pair. */
const misread = (n: number) => [...toRoman(n)].reduce((s, c) => s + GLYPH[c], 0);

/** Three distinct wrong values in 1-100: the additive misread, ±10 (same units digit), ±1, then fill. `bubble` keeps only those whose numeral fits a bubble. */
function slips(rng: Rng, n: number, bubble: boolean): number[] {
  const ok = (v: number) => v !== n && v >= 1 && v <= 100 && (!bubble || fitsBubble(v));
  const tens = shuffle(rng, [n - 10, n + 10]).filter(ok), ones = shuffle(rng, [n - 1, n + 1]).filter(ok);
  const m = misread(n);
  const fill = shuffle(rng, Array.from({ length: 100 }, (_, i) => i + 1).filter(v => Math.abs(v - n) <= 12));
  const first = [...(m !== n && ok(m) ? [m] : []), ...tens.slice(0, 1), ...ones.slice(0, 1)];
  return [...new Set([...first, ...tens, ...ones, ...fill])].filter(ok).slice(0, 3);
}

const read = (rng: Rng, n: number): Question => {
  const r = toRoman(n);
  return wordQ(rng, 'Which number is this Roman numeral?', String(n), slips(rng, n, false).map(String), {
    visual: { type: 'word', text: r }, say: ks2Say(`Which number is ${r}?`, { roman: [r] }), hint: 'Slice the number', hintIsData: false,
  });
};

const write = (rng: Rng, n: number): Question => wordQ(rng, `Which Roman numeral is ${n}?`, toRoman(n), slips(rng, n, true).map(toRoman), {
  say: `Which Roman numeral is ${n}?`, hint: 'Slice the numeral', hintIsData: false, noSayAnswer: true,
});

/** "Which one needs a 0 in our digits?": exactly one of three numerals is a multiple of 10 (XL beside XLV and XLIX). */
function needsZero(rng: Rng): Question {
  const m = pick(rng, [10, 20, 30, 40, 50, 60, 70, 90]);
  const others = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => m + k).filter(fitsBubble)).slice(0, 2);
  return wordQ(rng, 'Which one needs a 0 in our digits?', toRoman(m), others.map(toRoman), {
    say: 'Which Roman numeral needs a zero when we write it with our digits?', hint: 'Slice the numeral', hintIsData: false, noSayAnswer: true,
  });
}

const BANK: readonly (readonly [string, boolean])[] = [
  ['The Romans had no numeral for zero.', true],
  ['In 305, the 0 shows there are no tens.', true],
  ['In 505, both 5s are worth the same.', false],
  ['In 250, the 0 can be left out without changing the number.', false],
];

function trueFalse(rng: Rng): Question {
  const [text, truth] = pick(rng, BANK);
  return { prompt: text, answer: truth ? 'True' : 'False', options: shuffle(rng, ['True', 'False']), say: `True or false? ${text}`, hint: 'Slice true or false', hintIsData: false };
}

export const y4Roman: Generator = (d: Difficulty, rng: Rng) => {
  if (d === 1) return read(rng, ri(rng, 1, 39));
  if (d === 3 && rng() < 0.25) return rng() < 0.5 ? needsZero(rng) : trueFalse(rng);
  if (rng() < 0.5) return read(rng, ri(rng, 1, 100));
  let n = ri(rng, 1, 100);
  while (!fitsBubble(n)) n = ri(rng, 1, 100);
  return write(rng, n);
};
