// y3-fracadd (#1095): add and subtract fractions with the same denominator, within one whole. Answers are shown as
// computed (never simplified, which is Year 6); a whole is the digit 1. d1: add; d2: add or subtract; d3: the missing
// part, or two parts that make one whole. The "add the bottoms too" mistake is always among the decoys.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, shuffle } from './util';
import { equal, type Frac } from './fractions';
import { ks2Say } from './ks2say';

const lab = (f: Frac) => (f.n === f.d ? '1' : `${f.n}/${f.d}`);
const f = (n: number, d: number): Frac => ({ n, d });
const say = (n: number, d: number) => ks2Say(`${n}/${d}`);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Three decoys: add the bottoms too, the other operation, a top one out, then any fraction on the same bottom, then on another. None is worth the answer or each other. */
function decoys(ans: Frac, d: number, tb: Frac, other: Frac, rng: Rng): string[] {
  const pool: Frac[] = [tb, other, f(ans.n + 1, d), f(ans.n - 1, d)];
  for (let i = 0; i < 8; i++) pool.push(f(ri(rng, 1, d - 1), d));
  for (let i = 0; i < 12; i++) { const e = ri(rng, 3, 10); pool.push(f(ri(rng, 1, e - 1), e)); } // few on a small bottom: borrow another
  const out: Frac[] = [];
  for (const c of pool) if (c.n >= 1 && c.d >= 2 && !equal(c, ans) && !out.some(o => equal(o, c))) out.push(c);
  return out.slice(0, 3).map(lab);
}

const card = (prompt: string, spoken: string, ans: Frac, ds: string[], rng: Rng): Question =>
  ({ prompt, say: spoken, answer: lab(ans), options: shuffle(rng, [lab(ans), ...ds]), hint: 'Slice the answer', hintIsData: false });

function add(d: number, a: number, b: number, rng: Rng): Question {
  const ans = f(a + b, d);
  return card(`${a}/${d} + ${b}/${d} = ?`, `${cap(say(a, d))} plus ${say(b, d)} equals what?`, ans,
    decoys(ans, d, f(a + b, 2 * d), f(Math.abs(a - b) || a + 1, d), rng), rng);
}

function sub(d: number, x: number, y: number, rng: Rng): Question {
  const ans = f(x - y, d);
  return card(`${x}/${d} − ${y}/${d} = ?`, `${cap(say(x, d))} take away ${say(y, d)} equals what?`, ans,
    decoys(ans, d, f(x - y, 2 * d), f(x + y > d ? x : x + y, d), rng), rng);
}

/** d3: `a/d + ? = c/d` or `? − a/d = c/d`, answered with the missing fraction. */
function missing(rng: Rng): Question {
  const d = ri(rng, 4, 10);
  if (rng() < 0.5) {
    const c = ri(rng, 2, d), a = ri(rng, 1, c - 1), ans = f(c - a, d);
    return card(`${a}/${d} + ? = ${lab(f(c, d))}`, `${cap(say(a, d))} plus what equals ${c === d ? 'one whole' : say(c, d)}?`, ans,
      decoys(ans, d, f(c, d - a), f(a + c > d ? c : a + c, d), rng), rng);
  }
  const a = ri(rng, 1, d - 2), c = ri(rng, 1, d - a), ans = f(a + c, d);
  return card(`? − ${a}/${d} = ${c}/${d}`, `What minus ${say(a, d)} equals ${say(c, d)}?`, ans, decoys(ans, d, f(c, d - a), f(Math.abs(c - a) || c + 1, d), rng), rng);
}

/** d3: two parts that make exactly one whole, answer `1`. */
function whole(rng: Rng): Question {
  const d = ri(rng, 3, 10), a = ri(rng, 1, d - 1), b = d - a, ans = f(d, d);
  return card(`${a}/${d} + ${b}/${d} = ?`, `${cap(say(a, d))} plus ${say(b, d)} equals what?`, ans, decoys(ans, d, f(d, 2 * d), f(Math.abs(a - b) || 1, d), rng), rng);
}

export const y3FracAdd: Generator = (level: Difficulty, rng) => {
  if (level === 1) { const d = ri(rng, 3, 8), a = ri(rng, 1, d - 2); return add(d, a, ri(rng, 1, d - 1 - a), rng); }
  if (level === 2) {
    const d = ri(rng, 3, 10);
    if (rng() < 0.5) { const a = ri(rng, 1, d - 2); return add(d, a, ri(rng, 1, d - 1 - a), rng); }
    const x = ri(rng, 2, d - 1); return sub(d, x, ri(rng, 1, x - 1), rng);
  }
  const r = rng();
  if (r < 0.4) return missing(rng);
  if (r < 0.7) return whole(rng);
  const d = ri(rng, 4, 10), x = ri(rng, 2, d - 1), y = ri(rng, 1, x - 1);
  return sub(d, x, y, rng);
};
