// y3-roman (#1100): Roman numerals I to XII. d1 reads a numeral for its number, d2 writes a number as a numeral,
// d3 uses only the subtractive and longest forms plus the numerals at the top and bottom of a clock face.
// Every numeral comes from roman.ts (canonical by construction); the voice spells the letters, never the value (#1057).
import type { Generator, Question, Rng } from './types';
import { pick, shuffle, wordQ } from './util';
import { ks2Say } from './ks2say';
import { romanWhy, toRoman } from './roman';

const HARD = [4, 9, 8, 11, 12, 7, 3];
const CLOCK = [['top', 12], ['bottom', 6]] as const;
const inRange = (v: number) => v >= 1 && v <= 12;

/** Three distinct values in 1-12 that are not `n`: the subtractive swap and additive misread (IV/VI, IV as 6, IX/XI), the letter count (IV as 2), ±1, then fill. */
function slips(rng: Rng, n: number): number[] {
  const misread = n === 4 ? [6] : n === 9 ? [11] : n === 6 ? [4] : n === 11 ? [9] : [];
  const near = shuffle(rng, [n - 1, n + 1]), letters = toRoman(n).length;
  const all = [...misread, letters, ...near, ...shuffle(rng, Array.from({ length: 12 }, (_, i) => i + 1))];
  return [...new Set(all)].filter(v => inRange(v) && v !== n).slice(0, 3);
}

function read(rng: Rng, n: number): Question {
  const r = toRoman(n);
  return wordQ(rng, 'Which number is this Roman numeral?', String(n), slips(rng, n).map(String), {
    visual: { type: 'word', text: r }, say: ks2Say(`Which number is ${r}?`, { roman: [r] }), hint: 'Slice the number', hintIsData: false, why: romanWhy(n),
  });
}

function write(rng: Rng, n: number, prompt = `Which Roman numeral is ${n}?`, say = `Which Roman numeral is ${n}?`): Question {
  return wordQ(rng, prompt, toRoman(n), slips(rng, n).map(toRoman), { say, hint: 'Slice the numeral', hintIsData: false, noSayAnswer: true, why: romanWhy(n) });
}

export const y3Roman: Generator = (d, rng) => {
  if (d === 3 && rng() < 0.2) {
    const [where, n] = pick(rng, CLOCK);
    return write(rng, n, `Which Roman numeral is at the ${where} of a clock?`, `Which Roman numeral is at the ${where} of a clock?`);
  }
  const n = d === 3 ? pick(rng, HARD) : 1 + Math.floor(rng() * 12);
  return d === 1 || (d === 3 && rng() < 0.5) ? read(rng, n) : write(rng, n);
};
