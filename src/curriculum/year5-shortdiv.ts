// y5-shortdiv (#1188): short division of up to 4 digits by 1 digit, and what a remainder means (5M16). d1 pick-one, a 3-digit
// number with no remainder; d2 build "246 r 4" digit by digit (the quotient is always 3 digits, the ` r ` pre-printed; a
// remainder of 0 drops it); d3 pick-one, one of three readings of the same remainder: round down, round up or the remainder.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ, q } from './util';
import { buildQ } from './build';
import { dec, fmt } from './ks2num';
import { keepTwins } from './year5-column';

const f = (n: number) => fmt(dec(n, 0));

/** [text with `#` for the number then the divisor, the container the child counts]. */
export const BANK: [string, string][] = [
  ['# buns go in boxes of #.', 'boxes'],
  ['# pencils go in pots of #.', 'pots'],
  ['# stickers go in packs of #.', 'packs'],
  ['# eggs go in trays of #.', 'trays'],
  ['# apples go in bags of #.', 'bags'],
  ['# children fill vans of #.', 'vans'],
  ['# books go on shelves of #.', 'shelves'],
  ['# plants go in rows of #.', 'rows'],
];

export type Reading = 'down' | 'up' | 'left';
export const ASK: Record<Reading, (units: string) => string> = {
  down: u => `How many full ${u}?`,
  up: u => `How many ${u} are needed for all?`,
  left: () => 'How many are left over?',
};

/** d1 decoys: place-value shift, a group out, a lost exchange; then ±10^k fills that keep a last-digit and a leading-digit twin. */
function d1Decoys(answer: number, rng: Rng): number[] {
  const ok = (v: number) => Number.isInteger(v) && v > 0 && v !== answer;
  const named = [answer * 10, answer + pick(rng, [1, -1]), answer - 10];
  const out: number[] = [];
  for (const v of named) if (out.length < 3 && ok(v) && !out.includes(v)) out.push(v);
  const fills = shuffle(rng, [10, 100, 1, 2].flatMap(m => [answer + m, answer - m])).filter(ok);
  for (const v of fills) if (out.length < 3 && !out.includes(v)) out.push(v);
  keepTwins(out, fills, answer, 1);
  return out;
}

function d1(rng: Rng): Question {
  const d = ri(rng, 3, 9), quotient = ri(rng, Math.ceil(100 / d), Math.floor(999 / d));
  const sum = `${f(quotient * d)} ÷ ${d} = ?`;
  return wordQ(rng, sum, f(quotient), d1Decoys(quotient, rng).map(f), { say: q(sum).say });
}

/** d2: a 4-digit number whose first digit is smaller than the divisor, so the quotient has 3 digits; a quarter divide exactly. */
function d2(rng: Rng): Question {
  const d = ri(rng, 3, 9), exact = rng() < 0.25;
  const quotient = ri(rng, Math.ceil(1000 / d), 999);
  const n = exact ? quotient * d : quotient * d + ri(rng, 1, d - 1);
  const sum = `${f(n)} ÷ ${d} = ?`;
  const answer = exact ? String(quotient) : `${quotient} r ${n % d}`;
  return buildQ(rng, { prompt: sum, say: `${q(sum).say}. Build the answer with the remainder.`, answer, total: 6, hint: 'Slice the digits in order' });
}

function d3(rng: Rng): Question {
  const [text, units] = pick(rng, BANK), d = ri(rng, 3, 9);
  const quotient = ri(rng, Math.ceil(200 / d), Math.floor(990 / d)), r = ri(rng, 1, d - 1), n = quotient * d + r;
  const reading = pick(rng, ['down', 'up', 'left'] as Reading[]);
  const value: Record<Reading, number> = { down: quotient, up: quotient + 1, left: r };
  const prompt = `${text.replace('#', String(n)).replace('#', String(d))} ${ASK[reading](units)}`;
  const others = (['down', 'up', 'left'] as Reading[]).filter(k => k !== reading).map(k => value[k]);
  // Under the leak limit a round-down or round-up answer needs a last-digit twin, so the run-together decoy gives way to ± 10.
  const third = reading === 'left' ? Number(`${quotient}${r}`) : value[reading] + pick(rng, [10, -10]);
  return wordQ(rng, prompt, f(value[reading]), [...others, third].map(f), { say: `${prompt} Pick the answer.` });
}

export const y5ShortDiv: Generator = (d: Difficulty, rng): Question => d === 1 ? d1(rng) : d === 2 ? d2(rng) : d3(rng);
