// y4-div10 (#1147): a one- or two-digit number ÷ 10 or ÷ 100, and what each digit is then worth. The quotient is
// built as a scaled integer (`divPow10`, 45 ÷ 100 is `{ v: 45, dp: 2 }`) and printed by `fmt`, so no float artefact
// reaches a bubble. d1 is a one-digit ÷ 10; d2 adds two-digit numbers and ÷ 100; d3 mixes d2 with a digit-value card.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, divPow10, fmt } from './ks2num';
import type { Dec } from './ks2num';
import { ks2Say } from './ks2say';

const lab = (a: Dec) => fmt(a);
const word = (k: 1 | 2) => (k === 1 ? 'ten' : 'one hundred');

/** A number to divide: 1–9 at d1, else 1–99 without a trailing zero (40 ÷ 100 = 0.4 would change the decimal places). */
const num = (rng: Rng, oneDigit: boolean) => { for (;;) { const n = oneDigit ? ri(rng, 1, 9) : ri(rng, 1, 99); if (n % 10) return n; } };

/** Misconception decoys: the wrong power of ten first, then a neighbour with the answer's own decimal places (so the count of places never gives the answer away), then no change, × 10 or swapped digits. */
function decoys(rng: Rng, n: number, k: 1 | 2): string[] {
  const out: string[] = [], answer = lab(divPow10(dec(n, 0), k));
  const add = (a: Dec) => { const s = lab(a); if (a.v > 0 && s !== answer && !out.includes(s)) out.push(s); };
  add(divPow10(dec(n, 0), k === 1 ? 2 : 1));
  const near = [1, -1, 2, -2].map(d => n + d).find(v => v >= 1 && v <= 99 && v % 10 !== 0)!;
  add(divPow10(dec(near, 0), k));
  const swapped = (n % 10) * 10 + Math.floor(n / 10);
  shuffle(rng, [dec(n, 0), dec(n * 10, 0), ...(n > 9 && swapped % 10 ? [divPow10(dec(swapped, 0), k)] : [])]).forEach(add);
  return out;
}

/** "45 ÷ 100 = ?" (answer 0.45). */
function divide(rng: Rng, oneDigit: boolean): Question {
  const n = num(rng, oneDigit), k = (oneDigit || rng() < 0.5 ? 1 : 2) as 1 | 2, a = lab(divPow10(dec(n, 0), k));
  return wordQ(rng, `${n} ÷ ${k === 1 ? 10 : 100} = ?`, a, decoys(rng, n, k),
    { say: `${ks2Say(String(n))} divided by ${word(k)} equals what?`, hint: k === 1 ? 'Dividing by 10 moves every digit one place to the right' : 'Dividing by 100 moves every digit two places to the right', hintIsData: false });
}

/** "36 ÷ 100 = 0.36. The 6 is worth 6 ...?" (answer hundredths): two differing digits, so the asked digit has one place. */
function digitValue(rng: Rng): Question {
  let n = 0;
  while (!n || n % 11 === 0 || n % 10 === 0) n = ri(rng, 12, 99);
  const k = pick(rng, [1, 2] as const), tens = rng() < 0.5, d = tens ? Math.floor(n / 10) : n % 10, a = lab(divPow10(dec(n, 0), k));
  const place = (['ones', 'tenths', 'hundredths'] as const)[(tens ? 0 : 1) + (k - 1)];
  return wordQ(rng, `${n} ÷ ${k === 1 ? 10 : 100} = ${a}. The ${d} is worth ${d} ...?`, place, ['ones', 'tenths', 'hundredths', 'tens'].filter(p => p !== place),
    { say: `${ks2Say(String(n))} divided by ${word(k)} equals ${ks2Say(a)}. The ${ks2Say(String(d))} is worth ${ks2Say(String(d))} what?`, hint: 'The first place after the point is tenths, then hundredths', hintIsData: false });
}

export const y4Div10: Generator = (level: Difficulty, rng) => {
  if (level === 3 && rng() < 0.5) return digitValue(rng);
  return divide(rng, level === 1);
};
