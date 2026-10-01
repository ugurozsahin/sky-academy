// y3-money (#1099): add and subtract money and give change, £ and p written separately (never a decimal).
// Every amount is whole pence; every label and every spoken amount is `coinLabel` (#652: no formatter of its own).
import type { Generator, Question } from './types';
import { ri, pick, coinLabel, wordQ } from './util';

const COINS = [1, 2, 5, 10, 20, 50, 100, 200, 500];
const MAX = 995;                                      // £9 and 95p: a single-digit pound, so labels stay short
const digitsOf = (p: number) => coinLabel(p).replace(/[^0-9]/g, '');
const lead = (p: number) => digitsOf(p)[0];
const last = (p: number) => digitsOf(p).slice(-1);

/** Misconception decoys first (#1058): wrong operation, dropped exchange, pence to the next pound only, ±10p; then ±5p, ±20p, ±1p to fill. */
function decoys(answer: number, wrongOp: number | null): number[] {
  const ok = (v: number | null): v is number => v !== null && v > 0 && v <= MAX && v !== answer;
  const slips = [wrongOp, answer + 100, answer - 100, answer >= 100 ? answer % 100 : null, answer + 10, answer - 10];
  const fill = [5, -5, 20, -20, 1, -1, 15, -15, 30, -30].map(x => answer + x);
  const pool = [...new Set([...slips, ...fill].filter(ok))];
  const out: number[] = [];
  // The same last digit and the same leading digit as the answer must each appear among the decoys.
  for (const test of [(v: number) => last(v) === last(answer), (v: number) => lead(v) === lead(answer)]) {
    const hit = out.some(test) ? undefined : pool.find(v => test(v) && !out.includes(v));
    if (hit !== undefined) out.push(hit);
  }
  for (const v of pool) if (out.length < 3 && !out.includes(v)) out.push(v);
  return out;
}

/** Draw `a` and `b` (multiples of 5p) whose sum or difference crosses a pound and stays within £9 and 95p. */
function pair(add: boolean, rng: () => number): { a: number; b: number } {
  for (;;) {
    const a = 5 * ri(rng, 21, 190), b = 5 * ri(rng, 5, 190);
    if (add ? a + b <= MAX && a % 100 + b % 100 >= 100 : a > b && a % 100 < b % 100) return { a, b };
  }
}

export const y3Money: Generator = (d, rng): Question => {
  let prompt: string, say: string, answer: number, wrongOp: number | null = null, visual: Question['visual'];
  if (d === 1) {
    let coins: number[], total: number;
    do { coins = Array.from({ length: ri(rng, 2, 4) }, () => pick(rng, COINS)); total = coins.reduce((s, c) => s + c, 0); } while (total < 10 || total > MAX);
    prompt = 'How much money?'; say = 'How much money is there altogether?'; answer = total; visual = { type: 'coins', coins };
  } else if (d === 2) {
    const add = rng() < 0.5, { a, b } = pair(add, rng);
    answer = add ? a + b : a - b; wrongOp = add ? a - b : a + b;
    prompt = `${coinLabel(a)} ${add ? '+' : '−'} ${coinLabel(b)} = ?`;
    say = `What is ${coinLabel(a)} ${add ? 'plus' : 'take away'} ${coinLabel(b)}?`;
  } else {
    const note = pick(rng, [500, 1000]), price = 5 * ri(rng, 21, (note - 5) / 5);
    answer = note - price; wrongOp = note + price;
    prompt = `Change from ${coinLabel(note)} for ${coinLabel(price)}?`;
    say = `How much change from ${coinLabel(note)} for ${coinLabel(price)}?`;
  }
  const card = wordQ(rng, prompt, coinLabel(answer), decoys(answer, wrongOp).map(coinLabel), { say, visual });
  return d === 3 ? { ...card, slow: true } : card;
};
