// y6-fracadd (#1261): add and subtract fractions with different denominators and mixed numbers (NC Y6 Fractions, 6M16). d1 one
// denominator is a multiple of the other (1/2 + 1/8), d2 unrelated denominators (2/3 + 1/4), d3 mixed numbers (2 1/3 + 1 3/4).
// The answer is in simplest form, a mixed number above 1. All arithmetic is exact, through `fractions.ts`.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ } from './util';
import { add, fmtFrac, fromMixed, parseFrac, simplify, sub, type Frac } from './fractions';
import { ks2Say } from './ks2say';

const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const lcm = (a: number, b: number) => a / gcd(a, b) * b;
/** An operand: a proper fraction in lowest terms, with a whole part for mixed numbers. */
interface Op { whole: number; f: Frac }
const value = (o: Op) => fromMixed(o.whole, o.f);
const label = (o: Op) => o.whole ? `${o.whole} ${o.f.n}/${o.f.d}` : `${o.f.n}/${o.f.d}`;
const ans = (f: Frac) => fmtFrac(f, { mixed: true });
/** A decoy as the pupil would write it: left unreduced when proper (2/10), a mixed number once it passes 1. */
const raw = (n: number, d: number) => n < d ? `${n}/${d}` : ans({ n, d });

function properFrac(rng: Rng, d: number): Frac {
  return { n: pick(rng, Array.from({ length: d - 1 }, (_, i) => i + 1).filter(n => gcd(n, d) === 1)), d };
}

/** Two denominators in 2–12 that are related (one a multiple of the other) or not, with a lowest common multiple of at most 60. */
function denominators(rng: Rng, related: boolean): [number, number] {
  for (;;) {
    const p = ri(rng, 2, 12), q = ri(rng, 2, 12);
    if (p === q || lcm(p, q) > 60 || (p % q === 0 || q % p === 0) !== related) continue;
    return [p, q];
  }
}

function card(rng: Rng, a: Op, b: Op, plus: boolean, answer: Frac, named: string[], hint: string, why: string): Question {
  const sym = plus ? '+' : '−', word = plus ? 'plus' : 'minus';
  const right = ans(answer), seen = new Set([simplify(answer)].map(f => `${f.n}/${f.d}`)), ds: string[] = [];
  const take = (label: string, f: Frac) => {
    const s = simplify(f), k = `${s.n}/${s.d}`;
    if (s.n > 0 && !seen.has(k) && !ds.includes(label)) { seen.add(k); ds.push(label); }
  };
  for (const s of named) { const f = parseFrac(s); if (f) take(s, f); }
  for (let k = 1; ds.length < 3; k++) {
    take(ans({ n: answer.n + k, d: answer.d }), { n: answer.n + k, d: answer.d });
    take(ans({ n: answer.n - k, d: answer.d }), { n: answer.n - k, d: answer.d });
  }
  return wordQ(rng, `${label(a)} ${sym} ${label(b)} = ?`, right, ds.slice(0, 3),
    { say: `What is ${ks2Say(label(a))} ${word} ${ks2Say(label(b))}.`, hint, hintIsData: false, why });
}

/** d1 and d2: proper fractions, result positive (and below 1 when the denominators are related). */
function proper(rng: Rng, related: boolean): Question {
  for (;;) {
    const [p, q] = denominators(rng, related), a = properFrac(rng, p), b = properFrac(rng, q), plus = rng() < 0.5;
    const total = add(a, b), answer = plus ? total : sub(a, b);
    if (answer.n <= 0 || answer.d === 1 || (related && answer.n >= answer.d)) continue;
    const L = lcm(p, q), named: string[] = [], top = a.n * (L / p) + (plus ? 1 : -1) * b.n * (L / q);
    // tops-and-bottoms (#1058): across the top and across the bottom, whenever that is a proper fraction
    if (plus) named.push(raw(a.n + b.n, p + q));
    else if (p > q && a.n > b.n) named.push(raw(a.n - b.n, p - q));
    // the numerators left as they were while only the denominators were converted
    named.push(raw(plus ? a.n + b.n : Math.abs(a.n - b.n), L));
    return card(rng, { whole: 0, f: a }, { whole: 0, f: b }, plus, answer, named,
      'Make the bottoms the same first, then add or subtract the tops',
      `Bottoms to ${L}: ${a.n * (L / p)}/${L} ${plus ? '+' : '−'} ${b.n * (L / q)}/${L} = ${top}/${L}${ans(answer) === `${top}/${L}` ? '' : ` = ${ans(answer)}`}`);
  }
}

/** d3: mixed numbers (whole parts 1–5). Decoys: the dropped carry, the fractional parts taken the wrong way round. */
function mixed(rng: Rng): Question {
  for (;;) {
    const [p, q] = denominators(rng, rng() < 0.4), plus = rng() < 0.5;
    const a: Op = { whole: ri(rng, 1, 5), f: properFrac(rng, p) }, b: Op = { whole: ri(rng, 1, 5), f: properFrac(rng, q) };
    const answer = plus ? add(value(a), value(b)) : sub(value(a), value(b));
    if (answer.n <= 0) continue;
    const named: string[] = [], L = lcm(p, q), x = a.f.n * (L / p), y = b.f.n * (L / q);
    let why: string;
    if (plus) {
      const f = add(a.f, b.f);
      if (f.n >= f.d) named.push(ans({ n: answer.n - answer.d, d: answer.d }));
      why = `Fractions: ${x}/${L} + ${y}/${L} = ${x + y}/${L}${x + y >= L ? ', carry the 1' : ''}`;
    } else {
      const f = sub(a.f, b.f);
      if (f.n < 0) named.push(ans(fromMixed(a.whole - b.whole, { n: -f.n, d: f.d })));
      why = x < y ? `Swap a whole for ${L}/${L}: ${x + L}/${L} − ${y}/${L} = ${x + L - y}/${L}` : `Fractions: ${x}/${L} − ${y}/${L} = ${x - y}/${L}`;
    }
    return card(rng, a, b, plus, answer, named,
      plus ? 'Add the wholes, add the fractions, then carry' : 'Take the wholes, then the fractions: swap a whole for fractions if you need to', why);
  }
}

export const y6FracAdd: Generator = (d: Difficulty, rng: Rng): Question => d === 1 ? proper(rng, true) : d === 2 ? proper(rng, false) : mixed(rng);
