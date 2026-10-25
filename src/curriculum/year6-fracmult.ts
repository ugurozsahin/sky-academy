// y6-fracmult (#1262): multiply simple pairs of proper fractions, answer in its simplest form (NC Y6 Fractions). d1 unit × unit
// (1/4 × 1/2 = 1/8), d2 proper × proper where the product usually needs simplifying, d3 "a fraction of a fraction" in a short
// story (`slow`). The answer is always a proper fraction in lowest terms. Decoys are the multiplication slips: add the
// denominators, add both parts, cross-multiply, "multiplying makes it bigger" (the larger factor) and, on d2, the unsimplified product.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ } from './util';
import { equal, mul, type Frac } from './fractions';
import { ks2Say } from './ks2say';

const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const lab = (f: Frac) => `${f.n}/${f.d}`;
/** Tops times tops, bottoms times bottoms, then the simplified product. */
const why = (a: Frac, b: Frac, ans: Frac) => `Tops ${a.n}×${b.n}=${a.n * b.n}, bottoms ${a.d}×${b.d}=${a.d * b.d}, so ${lab(ans)}`;
const bigger = (x: Frac, y: Frac) => (x.n * y.d >= y.n * x.d ? x : y);

/** Fills three distinct decoys from the named slips, then from the answer's neighbours. None equals the answer in value, except `unsimplified`
 * (value-equal, but not in lowest terms, so exactly one option is both). A decoy is never a whole number. */
function decoys(ans: Frac, named: Frac[], unsimplified: Frac | null): string[] {
  const out: string[] = [], taken = new Set([lab(ans)]);
  const add = (f: Frac, allowEqual = false) => {
    if (out.length >= 3 || f.d < 2 || f.n < 1 || f.n % f.d === 0 || taken.has(lab(f))) return;
    if (!allowEqual && equal(f, ans)) return;
    taken.add(lab(f)); out.push(lab(f));
  };
  if (unsimplified && unsimplified.d <= 100 && lab(unsimplified) !== lab(ans)) add(unsimplified, true);
  named.forEach(f => add(f));
  for (const f of [{ n: ans.n + 1, d: ans.d }, { n: ans.n, d: ans.d + 1 }, { n: ans.n + 1, d: ans.d + 1 }, { n: ans.n + 2, d: ans.d }, { n: ans.n, d: ans.d + 2 }]) add(f);
  return out;
}

/** The decoys for `a × b` (both proper, `ans` their simplified product). */
function slips(a: Frac, b: Frac, ans: Frac): Frac[] {
  return [
    { n: a.n * b.n, d: a.d + b.d },       // adds the denominators
    { n: a.n + b.n, d: a.d + b.d },       // adds both parts
    { n: a.n * b.d, d: a.d * b.n },       // cross-multiplies
    bigger(a, b),                          // "multiplying makes it bigger"
    { n: ans.n, d: ans.d + 1 },
  ];
}

function card(rng: Rng, a: Frac, b: Frac, expr: string, unsimplify: boolean): Question {
  const raw = { n: a.n * b.n, d: a.d * b.d }, ans = mul(a, b);
  const ds = decoys(ans, slips(a, b, ans), unsimplify ? raw : null);
  return wordQ(rng, `${expr} = ?`, lab(ans), ds, { say: `What is ${ks2Say(expr)}?`, hint: 'Multiply the tops, multiply the bottoms, then simplify', hintIsData: false, why: why(a, b, ans) });
}

/** d1: 1/a × 1/b with both denominators 2–10, product 1/(ab). */
function unitUnit(rng: Rng): Question {
  const a = ri(rng, 2, 10), b = ri(rng, 2, 10);
  return card(rng, { n: 1, d: a }, { n: 1, d: b }, `1/${a} × 1/${b}`, false);
}

/** d2: two proper fractions (denominators 2–10, not both unit); at least ~70 % of cards have a product that needs simplifying. */
function properProper(rng: Rng): Question {
  for (;;) {
    const a = { n: 0, d: ri(rng, 2, 10) }, b = { n: 0, d: ri(rng, 2, 10) };
    const na = { ...a, n: ri(rng, 1, a.d - 1) }, nb = { ...b, n: ri(rng, 1, b.d - 1) };
    if (na.n === 1 && nb.n === 1 || gcd(na.n, na.d) > 1 || gcd(nb.n, nb.d) > 1) continue;
    const needs = gcd(na.n * nb.n, na.d * nb.d) > 1;
    if (!needs && rng() < 0.7) continue;
    return card(rng, na, nb, `${lab(na)} × ${lab(nb)}`, true);
  }
}

/** d3: "a/b of something, then c/d of that": what fraction of the whole? Denominators 2–6. */
const stories: ((a: string, c: string) => string)[] = [
  (a, c) => `${a} of a lawn is grass. ${c} of that is cut. How much of the lawn?`,
  (a, c) => `${a} of a cake is left. Sam eats ${c} of it. How much was eaten?`,
  (a, c) => `${a} of a pizza has veg. ${c} of that is peppers. How much pizza?`,
  (a, c) => `Mia reads ${a} of a book, then ${c} of that. How much of the book?`,
  (a, c) => `${a} of a tank is full. ${c} of that is used. How much of the tank?`,
  (a, c) => `${a} of a ribbon is blue. ${c} of that is cut. How much ribbon?`,
];

function inContext(rng: Rng): Question {
  for (;;) {
    const da = ri(rng, 2, 6), dc = ri(rng, 2, 6);
    const a = { n: ri(rng, 1, da - 1), d: da }, c = { n: ri(rng, 1, dc - 1), d: dc };
    if (a.n === 1 && c.n === 1 || gcd(a.n, a.d) > 1 || gcd(c.n, c.d) > 1) continue;
    const ans = mul(a, c);
    const prompt = pick(rng, stories)(lab(a), lab(c));
    const ds = decoys(ans, slips(a, c, ans), null);
    return { ...wordQ(rng, prompt, lab(ans), ds, { say: ks2Say(prompt), hint: 'Multiply the two fractions', hintIsData: false, why: why(a, c, ans) }), slow: true };
  }
}

export const y6FracMult: Generator = (d: Difficulty, rng: Rng): Question => d === 1 ? unitUnit(rng) : d === 2 ? properProper(rng) : inContext(rng);
