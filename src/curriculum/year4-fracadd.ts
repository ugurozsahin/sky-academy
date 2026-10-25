// y4-fracadd (#1145): add and subtract fractions with the same denominator, beyond one whole (3/5 + 4/5 = 7/5).
// Answers keep the card's denominator (5/5, 7/5), never a whole number, a mixed number or a simplified fraction, so
// exactly one label has the answer's value. d1: within one whole; d2: sums beyond one, and subtracting from an improper
// fraction; d3: three fractions, "1 − 3/8", and a missing addend. Addition cards always offer the tops-and-bottoms slip.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, shuffle } from './util';
import { equal, type Frac } from './fractions';
import { ks2Say } from './ks2say';

const f = (n: number, d: number): Frac => ({ n, d });
const lab = (fr: Frac) => `${fr.n}/${fr.d}`;
const say = (n: number, d: number) => ks2Say(`${n}/${d}`);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Three decoys: the tops-and-bottoms slip (addition only), the wrong operation, the answer's top ± 1, then any top on the same bottom. None equals the answer or another in value. */
function decoys(ans: Frac, tb: Frac | null, wrong: Frac | null, rng: Rng): string[] {
  const d = ans.d;
  const pool: Frac[] = [];
  if (tb) pool.push(tb);
  if (wrong) pool.push(wrong);
  pool.push(f(ans.n + 1, d), f(ans.n - 1, d));
  for (let i = 0; i < 12; i++) pool.push(f(ri(rng, 1, 2 * d), d));
  const out: Frac[] = [];
  for (const c of pool) if (c.n >= 1 && !equal(c, ans) && !out.some(o => equal(o, c))) out.push(c);
  return out.slice(0, 3).map(lab); // the tops-and-bottoms slip is first in the pool, so it is always kept
}

const card = (prompt: string, spoken: string, ans: Frac, ds: string[], rng: Rng, why: string): Question =>
  ({ prompt, say: spoken, answer: lab(ans), options: shuffle(rng, [lab(ans), ...ds]), hint: 'Slice the answer', hintIsData: false, why });

function add(d: number, a: number, b: number, rng: Rng): Question {
  const ans = f(a + b, d);
  return card(`${a}/${d} + ${b}/${d} = ?`, `${cap(say(a, d))} plus ${say(b, d)} equals what?`, ans,
    decoys(ans, f(a + b, 2 * d), a === b ? null : f(Math.abs(a - b), d), rng), rng, `Same bottoms, so add the tops: ${a} + ${b} = ${a + b}, so ${lab(ans)}`);
}

function sub(d: number, x: number, y: number, rng: Rng): Question {
  const ans = f(x - y, d);
  return card(`${x}/${d} − ${y}/${d} = ?`, `${cap(say(x, d))} take away ${say(y, d)} equals what?`, ans,
    decoys(ans, null, f(x + y, d), rng), rng, `Same bottoms, so take the tops away: ${x} − ${y} = ${x - y}, so ${lab(ans)}`);
}

function three(d: number, rng: Rng): Question {
  const a = ri(rng, 1, d), c = ri(rng, 1, Math.min(d, 2 * d - a - 1)), b = ri(rng, 1, Math.min(d, 2 * d - a - c)); // the sum stays within 2 × the bottom
  const ans = f(a + b + c, d);
  return card(`${a}/${d} + ${b}/${d} + ${c}/${d} = ?`, `${cap(say(a, d))} plus ${say(b, d)} plus ${say(c, d)} equals what?`, ans,
    decoys(ans, f(a + b + c, 3 * d), f(Math.abs(a - b) + c, d), rng), rng, `Add the tops: ${a} + ${b} + ${c} = ${a + b + c}, so ${lab(ans)}`);
}

function fromOne(d: number, rng: Rng): Question {
  const x = ri(rng, 1, d - 1), ans = f(d - x, d);
  return card(`1 − ${x}/${d} = ?`, `One take away ${say(x, d)} equals what?`, ans, decoys(ans, null, f(x, d), rng), rng, `1 = ${d}/${d}, so ${d} − ${x} = ${d - x} tops: ${lab(ans)}`);
}

function missing(d: number, rng: Rng): Question {
  const a = ri(rng, 1, d), c = ri(rng, a + 1, 2 * d), ans = f(c - a, d);
  return card(`${a}/${d} + ? = ${c}/${d}`, `${cap(say(a, d))} plus what equals ${say(c, d)}?`, ans, decoys(ans, f(c - a, 2 * d), f(c + a, d), rng), rng, `${c} − ${a} = ${c - a} tops, so ${lab(ans)}`);
}

export const y4FracAdd: Generator = (level: Difficulty, rng) => {
  const d = ri(rng, 3, 12);
  if (level === 1) {
    if (rng() < 0.5) { const a = ri(rng, 1, d - 2); return add(d, a, ri(rng, 1, d - a), rng); }
    const x = ri(rng, 2, d); return sub(d, x, ri(rng, 1, x - 1), rng);
  }
  if (level === 2) {
    if (rng() < 0.6) { const a = ri(rng, 1, d); return add(d, a, ri(rng, d - a + 1, d), rng); }
    const x = ri(rng, d + 1, 2 * d - 1); return sub(d, x, ri(rng, 1, Math.min(d, x - 1)), rng);
  }
  const r = rng();
  if (r < 0.35) return three(d, rng);
  if (r < 0.65) return fromOne(d, rng);
  return missing(d, rng);
};
