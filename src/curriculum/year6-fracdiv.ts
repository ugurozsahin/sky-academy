// y6-fracdiv (#1263): divide a proper fraction by a whole number (NC Y6 Fractions, 1/3 ÷ 2 = 1/6). d1 unit fraction ÷ 2–6, d2 a
// non-unit proper fraction ÷ 2–6 (half the cards have a numerator the divisor divides exactly, half do not), d3 a sharing story
// (`slow`). The answer is always a fraction in lowest terms. Decoys are the slips: multiply instead of divide, divide the
// denominator, add the divisor to the denominator.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ } from './util';
import { equal, simplify, type Frac } from './fractions';
import { ks2Say } from './ks2say';

const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const lab = (f: Frac) => `${f.n}/${f.d}`;

/** `f ÷ k` in lowest terms. */
export const divide = (f: Frac, k: number): Frac => simplify({ n: f.n, d: f.d * k });

/** Three distinct decoys from the named slips, then the answer's neighbours. None equals the answer in value or is a whole number. */
function decoys(ans: Frac, named: Frac[]): string[] {
  const out: string[] = [], taken = new Set([lab(ans)]);
  const add = (f: Frac) => {
    if (out.length >= 3 || f.d < 2 || f.n < 1 || f.n % f.d === 0 || taken.has(lab(f)) || equal(f, ans)) return;
    taken.add(lab(f)); out.push(lab(f));
  };
  named.forEach(add);
  for (const f of [{ n: ans.n + 1, d: ans.d }, { n: ans.n, d: ans.d + 1 }, { n: ans.n + 1, d: ans.d + 1 }, { n: ans.n + 2, d: ans.d }]) add(f);
  return out;
}

function slips(f: Frac, k: number): Frac[] {
  return [
    simplify({ n: f.n * k, d: f.d }),                        // multiplies instead of dividing
    { n: f.n, d: f.d % k === 0 ? f.d / k : Math.max(2, f.d - k) }, // divides the denominator
    { n: f.n, d: f.d + k },                                  // adds the divisor to the denominator
  ];
}

function card(rng: Rng, f: Frac, k: number, prompt: string, say: string, slow = false): Question {
  const ans = divide(f, k);
  const q = wordQ(rng, prompt, lab(ans), decoys(ans, slips(f, k)), { say, hint: 'Dividing by a whole number makes each part smaller: multiply the bottom, or divide the top', hintIsData: false });
  return slow ? { ...q, slow: true } : q;
}

/** d1: 1/a ÷ k, a in 2–10, k in 2–6. */
function unit(rng: Rng): Question {
  const a = ri(rng, 2, 10), k = ri(rng, 2, 6), expr = `1/${a} ÷ ${k}`;
  return card(rng, { n: 1, d: a }, k, `${expr} = ?`, `What is ${ks2Say(expr)}?`);
}

/** A non-unit proper fraction in lowest terms (denominator 3–10) and a divisor 2–6; `exact` asks for a numerator the divisor divides. */
function nonUnit(rng: Rng, exact: boolean): { f: Frac; k: number } {
  for (;;) {
    const d = ri(rng, 3, 10), n = ri(rng, 2, d - 1), k = ri(rng, 2, 6);
    if (gcd(n, d) > 1 || (n % k === 0) !== exact) continue;
    return { f: { n, d }, k };
  }
}

function proper(rng: Rng): Question {
  const { f, k } = nonUnit(rng, rng() < 0.5), expr = `${lab(f)} ÷ ${k}`;
  return card(rng, f, k, `${expr} = ?`, `What is ${ks2Say(expr)}?`);
}

const stories: ((f: string, k: number) => string)[] = [
  (f, k) => `${f} of a cake is shared equally by ${k} friends. How much of the cake each?`,
  (f, k) => `${f} of a pizza is left for ${k} children to share. How much each?`,
  (f, k) => `${f} of a chocolate bar is cut into ${k} equal pieces. How much is each?`,
  (f, k) => `${f} of a tank is poured into ${k} buckets equally. How much in each?`,
  (f, k) => `${f} of a ribbon is cut into ${k} equal strips. How much is each?`,
  (f, k) => `${f} of a garden is split into ${k} equal beds. How much is each?`,
];

function context(rng: Rng): Question {
  const { f, k } = nonUnit(rng, rng() < 0.5), prompt = pick(rng, stories)(lab(f), k);
  return card(rng, f, k, prompt, ks2Say(prompt), true);
}

export const y6FracDiv: Generator = (d: Difficulty, rng: Rng): Question => d === 1 ? unit(rng) : d === 2 ? proper(rng) : context(rng);
