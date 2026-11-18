// y5-truefalse (#1231): judge a statement about Year 5 number, True or False (the NC aim to reason mathematically). d1 multiples and
// factors; d2 primes, squares, cubes and the ² notation; d3 general "always" claims from a reviewed bank. Every specific statement's
// truth is computed from its numbers; every bank entry carries the claim as code, run over a bound (true) or broken by a stored
// counter-example (false), so the unit test checks the bank and not just the eye. False draws are near misses (n ± 1, a neighbouring
// table fact, a × 2 for a²). No "sometimes" claims: a two-bubble card has one defensible answer.
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, ri, wordQ } from './util';

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
const LOOK_PRIMES = [1, 9, 51, 57, 87, 91];
export const isPrime = (n: number): boolean => PRIMES.includes(n);
const isSquare = (n: number): boolean => Number.isInteger(Math.sqrt(n));
const isCube = (n: number): boolean => Math.round(Math.cbrt(n)) ** 3 === n;

export interface Bank {
  text: string;
  /** The reason the claim holds, or the example that breaks it. */
  why: string;
  truth: boolean;
  /** The claim as code: over every n (or every pair n, m) from 1 to `bound` when `pairs`. A true entry holds for all of them. */
  claim: (n: number, m: number) => boolean;
  bound: number;
  pairs: boolean;
  /** A false entry's stored counter-example: the claim fails here. */
  counter?: [number, number];
}
const odd = (n: number) => n % 2 === 1, even = (n: number) => n % 2 === 0;

/** The d3 bank. "1 is not a prime" is covered by the d2 near-miss draws (1 and 9 are always false primes). */
export const BANK: Bank[] = [
  { text: 'The sum of two odd numbers is always even.', why: 'Odd + odd pairs up the spare ones: 3 + 5 = 8.', truth: true, pairs: true, bound: 999, claim: (a, b) => !(odd(a) && odd(b)) || even(a + b) },
  { text: 'The sum of two even numbers is always even.', why: 'Even + even leaves no spare one: 4 + 6 = 10.', truth: true, pairs: true, bound: 999, claim: (a, b) => !(even(a) && even(b)) || even(a + b) },
  { text: 'The product of two even numbers is always even.', why: 'One factor of 2 makes the product even: 4 × 6 = 24.', truth: true, pairs: true, bound: 999, claim: (a, b) => !(even(a) && even(b)) || even(a * b) },
  { text: 'Every multiple of 4 is also a multiple of 2.', why: '4 = 2 × 2, so each 4 holds two 2s.', truth: true, pairs: false, bound: 999, claim: n => n % 4 !== 0 || n % 2 === 0 },
  { text: 'Every multiple of 6 is also a multiple of 3.', why: '6 = 2 × 3, so each 6 holds two 3s.', truth: true, pairs: false, bound: 999, claim: n => n % 6 !== 0 || n % 3 === 0 },
  { text: 'A square number never ends in 7.', why: 'Squares end in 0, 1, 4, 5, 6 or 9, never 7.', truth: true, pairs: false, bound: 100, claim: n => (n * n) % 10 !== 7 },
  { text: 'Every number that ends in 5 is a multiple of 5.', why: 'The 5 times table ends in 0 or 5: 35 = 7 × 5.', truth: true, pairs: false, bound: 999, claim: n => n % 10 !== 5 || n % 5 === 0 },
  { text: 'All prime numbers are odd.', why: '2 is prime and even, so not all primes are odd.', truth: false, pairs: false, bound: 100, claim: n => !isPrime(n) || odd(n), counter: [2, 0] },
  { text: 'Every odd number is a prime number.', why: '9 is odd but 3 × 3 = 9, so it is not prime.', truth: false, pairs: false, bound: 100, claim: n => even(n) || isPrime(n), counter: [9, 0] },
  { text: 'The product of two odd numbers is always even.', why: '3 × 5 = 15, which is odd.', truth: false, pairs: true, bound: 999, claim: (a, b) => !(odd(a) && odd(b)) || even(a * b), counter: [3, 5] },
  { text: 'The sum of two odd numbers is always odd.', why: '3 + 5 = 8, which is even.', truth: false, pairs: true, bound: 999, claim: (a, b) => !(odd(a) && odd(b)) || odd(a + b), counter: [3, 5] },
  { text: 'Every multiple of 2 is also a multiple of 4.', why: '6 is a multiple of 2 but 4 does not divide 6.', truth: false, pairs: false, bound: 999, claim: n => n % 2 !== 0 || n % 4 === 0, counter: [6, 0] },
  { text: 'Every multiple of 3 is also a multiple of 6.', why: '9 is a multiple of 3 but 6 does not divide 9.', truth: false, pairs: false, bound: 999, claim: n => n % 3 !== 0 || n % 6 === 0, counter: [9, 0] },
  { text: 'Every square number is even.', why: '3 × 3 = 9 is a square number and it is odd.', truth: false, pairs: false, bound: 100, claim: n => even(n * n), counter: [3, 0] },
  { text: 'Every number that ends in 3 is a multiple of 3.', why: '13 ends in 3, but 13 ÷ 3 leaves 1 left over.', truth: false, pairs: false, bound: 999, claim: n => n % 10 !== 3 || n % 3 === 0, counter: [13, 0] },
];

interface Draw { text: string; say: string; truth: boolean; why: string }

/** Build one statement of the wanted truth; the truth is recomputed from the numbers, so a slip in a near miss cannot ship a wrong card. */
type Maker = (rng: Rng, want: boolean) => Draw;

const word = (text: string, truth: boolean, why: string): Draw => ({ text, say: text, truth, why });
const firstFactor = (n: number): number => { let f = 2; while (f * f <= n && n % f) f++; return f * f <= n ? f : n; };

const multipleOf: Maker = (rng, want) => {
  const k = ri(rng, 2, 12), m = ri(rng, 2, 12);
  const n = want ? k * m : k * m + pick(rng, [-1, 1]);
  const hit = n % k === 0;
  return word(`${n} is a multiple of ${k}.`, hit, hit ? `${k} × ${n / k} = ${n}.` : `${n} is not in the ${k} times table: ${k} × ${Math.floor(n / k)} = ${k * Math.floor(n / k)}.`);
};
const factorOf: Maker = (rng, want) => {
  const k = ri(rng, 2, 12), m = ri(rng, 2, 12);
  const n = want ? k * m : k * m + pick(rng, [-1, 1]);
  const hit = n % k === 0;
  return word(`${k} is a factor of ${n}.`, hit, hit ? `${k} × ${n / k} = ${n}, with none left over.` : `${n} ÷ ${k} leaves ${n % k} left over.`);
};
const primeStmt: Maker = (rng, want) => {
  const n = want ? pick(rng, PRIMES) : pick(rng, [...LOOK_PRIMES, ...PRIMES.map(p => p + pick(rng, [-1, 1])).filter(v => v > 1)]);
  const f = firstFactor(n);
  return word(`${n} is a prime number.`, isPrime(n),
    isPrime(n) ? `Only 1 and ${n} divide ${n} exactly.` : n === 1 ? '1 has just one factor, so it is not prime.' : `${f} × ${n / f} = ${n}, so it has more factors.`);
};
const squareStmt: Maker = (rng, want) => {
  const a = ri(rng, 2, 12), n = want ? a * a : a * a + pick(rng, [-1, 1]);
  const r = Math.round(Math.sqrt(n));
  return word(`${n} is a square number.`, isSquare(n), isSquare(n) ? `${r} × ${r} = ${n}.` : `${r} × ${r} = ${r * r}, not ${n}.`);
};
const cubeStmt: Maker = (rng, want) => {
  const a = ri(rng, 2, 5), n = want ? a ** 3 : a ** 3 + pick(rng, [-1, 1]);
  const r = Math.round(Math.cbrt(n));
  return word(`${n} is a cube number.`, isCube(n), isCube(n) ? `${r} × ${r} × ${r} = ${n}.` : `${r} × ${r} × ${r} = ${r ** 3}, not ${n}.`);
};
const notation: Maker = (rng, want) => {
  const a = ri(rng, 2, 12), b = want ? a * a : pick(rng, [2 * a, a * (a + 1), a * (a - 1), a * a + 1]);
  return { text: `${a}² = ${b}`, say: `${a} squared equals ${b}`, truth: b === a * a, why: `${a}² means ${a} × ${a} = ${a * a}.` };
};

const MAKERS: Record<Difficulty, Maker[]> = { 1: [multipleOf, factorOf], 2: [primeStmt, squareStmt, cubeStmt, notation], 3: [] };

function make(rng: Rng, d: Difficulty): Draw {
  const want = rng() < 0.5;
  if (d === 3) { const b = pick(rng, BANK.filter(e => e.truth === want)); return word(b.text, b.truth, b.why); }
  const makers = MAKERS[d];
  for (let tries = 0; tries < 20; tries++) { const s = pick(rng, makers)(rng, want); if (s.truth === want) return s; }
  return pick(rng, makers)(rng, want);
}

export const y5TrueFalse: Generator = (d: Difficulty, rng: Rng): Question => {
  const s = make(rng, d);
  return wordQ(rng, 'True or false?', s.truth ? 'True' : 'False', [s.truth ? 'False' : 'True'], {
    say: `${s.say} True or false?`, visual: { type: 'sentence', text: s.text },
    hint: d === 3 ? 'One example that breaks it is enough to make it false' : 'Work it out before you slice', hintIsData: false, why: s.why,
  });
};
