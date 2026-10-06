// y4-mental (#1138): mental multiplying and dividing — × 0, × 1, ÷ 1 (d1), derived facts from a table fact and a power of
// ten (d2), and three numbers with a pair that makes 10, 20 or 100 (d3). Decoys are the slips: "× 0 changes nothing",
// "× 1 is like × 0", the place-value shift, and the product of only two of the three numbers.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ, q } from './util';
import { dec, fmt } from './ks2num';

const f = (n: number) => fmt(dec(n, 0));
const TIMES = '×', DIVIDE = '÷';
/** Pairs (in either order) whose product is 10, 20 or 100. */
const PAIRS: [number, number][] = [[2, 5], [4, 5], [4, 25], [2, 50]];

const card = (rng: Rng, sum: string, answer: number, decoys: number[]): Question => {
  const prompt = `${sum} = ?`;
  const wrong = [...new Set(decoys.filter(v => v !== answer && v >= 0 && Number.isInteger(v)))];
  for (let k = 1; wrong.length < 3; k++) for (const v of [answer + 10 * k, answer - 10 * k]) if (wrong.length < 3 && v !== answer && v >= 0 && !wrong.includes(v)) wrong.push(v);
  return wordQ(rng, prompt, f(answer), wrong.slice(0, 3).map(f), { say: q(prompt).say });
};

/** d1: a number 10–999 times 0, times 1, or divided by 1. */
function ident(rng: Rng): Question {
  const n = ri(rng, 10, 999), form = ri(rng, 0, 2);
  const flip = rng() < 0.5;
  if (form === 0) return card(rng, flip ? `${f(n)} ${TIMES} 0` : `0 ${TIMES} ${f(n)}`, 0, [n, 1, 10, 100]);
  // The number itself is the answer, so the decoys keep its units digit (±10, the side that keeps its leading digit) or slip to 0 and n + 1.
  const lead = (v: number) => String(v)[0];
  const tens = [n + 10, n - 10].sort((a, b) => Number(lead(b) === lead(n)) - Number(lead(a) === lead(n)));
  const sum = form === 1 ? (flip ? `${f(n)} ${TIMES} 1` : `1 ${TIMES} ${f(n)}`) : `${f(n)} ${DIVIDE} 1`;
  return card(rng, sum, n, [tens[0], 0, n + 1]);
}

/** d2: "40 × 7", "8 × 300", "600 ÷ 3" — a table fact and a power of ten; products and dividends ≤ 3,600. */
function derived(rng: Rng): Question {
  for (;;) {
    const a = ri(rng, 2, 9), b = ri(rng, 2, 9), k = pick(rng, [10, 100]);
    if (a * b * k > 3600) continue;
    if (rng() < 0.5) {
      const ans = a * b * k, big = `${f(a * k)}`, sum = rng() < 0.5 ? `${big} ${TIMES} ${b}` : `${b} ${TIMES} ${big}`;
      return card(rng, sum, ans, [ans * 10, ans / 10, a * k + b]);
    }
    const ans = a * k;
    return card(rng, `${f(a * b * k)} ${DIVIDE} ${b}`, ans, [ans * 10, ans / 10, ans + k]);
  }
}

/** d3: three factors, one pair making 10, 20 or 100, in any order; answers ≤ 1,200. */
function three(rng: Rng): Question {
  const [x, y] = pick(rng, PAIRS), z = ri(rng, 2, 12);
  const nums = shuffle(rng, [x, y, z]);
  const ans = x * y * z;
  const twos = [nums[0] * nums[1], nums[0] * nums[2], nums[1] * nums[2]];
  const decoys = [pick(rng, twos), ans * 10, ans / 10, ...twos];
  return card(rng, nums.map(f).join(` ${TIMES} `), ans, decoys);
}

export const y4Mental: Generator = (d: Difficulty, rng): Question => d === 1 ? ident(rng) : d === 2 ? derived(rng) : three(rng);
