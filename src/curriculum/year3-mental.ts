// y3-mental (#1083): a 3-digit number ± ones, tens or hundreds, in the head. Every number on the card and
// every answer is 100–999. Decoys come from `mistakes.ts` first (#1058); the place-value slip is added here.
import type { Difficulty, Generator, Question } from './types';
import { ri, pick, shuffle, q } from './util';
import { dec } from './ks2num';
import { decoysFor } from './mistakes';

type Form = 'ones' | 'tens' | 'hundreds';
const MINUS = '−';
const hundreds = (n: number) => Math.floor(n / 100);

/** A base and amount for `form` that fit the difficulty: d1 never crosses a ten (ones), d2 crosses a hundred about half the time. */
function draw(d: Difficulty, form: Form, add: boolean, rng: () => number): { a: number; b: number } {
  const wantCross = rng() < 0.5;
  for (let i = 0; i < 300; i++) {
    const a = ri(rng, 100, 999);
    const b = form === 'ones' ? ri(rng, 1, 9) : form === 'tens' ? 10 * ri(rng, 1, 9) : 100 * ri(rng, 1, 8);
    const ans = add ? a + b : a - b;
    if (ans < 100 || ans > 999) continue;
    if (d === 1 && form === 'ones' && (add ? a % 10 + b > 9 : a % 10 < b)) continue;
    if (d === 2 && (hundreds(a) !== hundreds(ans)) !== wantCross) continue;
    return { a, b };
  }
  return { a: 500, b: form === 'ones' ? 4 : form === 'tens' ? 40 : 100 };
}

/** The place-value slip: the amount read one column over (the 5 added as 5 tens), kept only if it lands in range. */
const columnSlip = (a: number, b: number, add: boolean): number[] =>
  [b * 10, b / 10].filter(x => Number.isInteger(x) && x >= 1).map(x => add ? a + x : a - x).filter(v => v >= 100 && v <= 999);

export const y3Mental: Generator = (d, rng): Question => {
  const form: Form = d === 1 ? pick(rng, ['ones', 'hundreds'] as const) : d === 2 ? 'tens' : pick(rng, ['ones', 'tens', 'hundreds'] as const);
  const add = rng() < 0.5;
  const { a, b } = draw(d, form, add, rng);
  const answer = add ? a + b : a - b;
  const calc = { a: dec(a, 0), b: dec(b, 0), answer: dec(answer, 0) };
  const decoys = decoysFor(add ? 'add' : 'sub', calc, 3, rng, { min: 100, max: 999 }).map(x => x.v);
  // The slip, and a subtraction's wrong operation, swap in for a decoy whose loss keeps #1058's two guarantees
  // (a decoy sharing the answer's last digit, one sharing its first).
  const extra = [...(add ? [] : [a + b]), ...columnSlip(a, b, add)].filter(v => v >= 100 && v <= 999 && v !== answer && !decoys.includes(v));
  const keeps = (rest: number[]) => rest.some(v => v % 10 === answer % 10) && rest.some(v => hundreds(v) === hundreds(answer));
  const spare = decoys.findIndex((_, i) => keeps(decoys.filter((_, j) => j !== i)));
  if (extra.length && spare >= 0) decoys[spare] = extra[0];
  const prompt = `${a} ${add ? '+' : MINUS} ${b} = ?`;
  const options = shuffle(rng, [answer, ...decoys].map(String));
  const card: Question = { ...q(prompt), answer: String(answer), options };
  return d === 3 ? { ...card, slow: true } : card;
};
