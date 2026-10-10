// y6-factors (#1257): identify common factors, common multiples and prime numbers (6M9). Every card is an any-order
// "Slice every …" card: d1 the primes among seven numbers to 50, d2 the common factors of two numbers, d3 the common
// multiples of two numbers up to 60. Decoys are the misconceptions: 1 and odd composites for "odd means prime", and
// factors or multiples of only one of the two numbers for "a factor of one is a factor of both".
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle } from './util';
import { anyOrderQ } from './any-order';

const isPrime = (k: number): boolean => {
  if (k < 2) return false;
  for (let i = 2; i * i <= k; i++) if (k % i === 0) return false;
  return true;
};
const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const hint = { hint: 'Slice them all', hintIsData: false } as const;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const PRIMES = range(2, 50).filter(isPrime);
const ODD_COMPOSITES = [9, 15, 21, 25, 27, 33, 35, 39, 45, 49];
const COMPOSITES = range(4, 50).filter(x => !isPrime(x));

/** d1: seven numbers from 1–50, two or three primes; 1 and an odd composite are always decoys. */
function primes(rng: Rng): Question {
  const k = ri(rng, 2, 3), targets = shuffle(rng, PRIMES).slice(0, k);
  const odd = pick(rng, ODD_COMPOSITES), decoys = [1, odd];
  for (const x of shuffle(rng, COMPOSITES)) if (decoys.length < 7 - k && !decoys.includes(x)) decoys.push(x);
  return anyOrderQ(rng, 'Slice every prime number', targets.map(String), decoys.map(String), { say: 'Slice every prime number', ...hint });
}

/** d2: common factors of two numbers from 12–60; 3–4 are targets, with factors of only one number as decoys. */
function commonFactors(rng: Rng): Question {
  let a: number, b: number, common: number[], only: number[];
  do {
    a = ri(rng, 12, 60); b = ri(rng, 12, 60);
    common = range(2, 60).filter(x => a % x === 0 && b % x === 0);
    only = range(2, 60).filter(x => (a % x === 0) !== (b % x === 0));
  } while (a === b || common.length < 3 || only.length < 1);
  const targets = shuffle(rng, common).slice(0, ri(rng, 3, Math.min(4, common.length)));
  const total = ri(rng, 6, 7), decoys = shuffle(rng, only).slice(0, ri(rng, 1, 2));
  const none = shuffle(rng, range(2, 40).filter(x => a % x !== 0 && b % x !== 0));
  decoys.push(none[0]);
  for (const x of [...shuffle(rng, only), ...none]) if (targets.length + decoys.length < total && !decoys.includes(x)) decoys.push(x);
  const say = `Slice every common factor of ${a} and ${b} that you can see`;
  return anyOrderQ(rng, say, targets.map(String), decoys.map(String), { say, ...hint });
}

/** d3: every common multiple of two numbers up to 60 (2–4 of them); decoys are multiples of only one of the two. */
function commonMultiples(rng: Rng): Question {
  let a: number, b: number, common: number[], only: number[];
  do {
    a = pick(rng, [2, 3, 4, 5, 6, 8, 9, 10, 12]); b = pick(rng, [2, 3, 4, 5, 6, 8, 9, 10, 12]);
    const l = a * b / gcd(a, b);
    common = range(1, 60).filter(x => x % a === 0 && x % b === 0);
    only = range(1, 60).filter(x => (x % a === 0) !== (x % b === 0));
    if (l !== Math.max(a, b) && l >= 15 && l <= 30 && a !== b) break;
  } while (true);
  const total = ri(rng, 6, 7), decoys = shuffle(rng, only).slice(0, total - common.length);
  return anyOrderQ(rng, `Slice every common multiple of ${a} and ${b} up to 60`, common.map(String), decoys.map(String), { say: `Slice every common multiple of ${a} and ${b} up to 60`, ...hint });
}

export const y6Factors: Generator = (d: Difficulty, rng): Question => (d === 1 ? primes : d === 2 ? commonFactors : commonMultiples)(rng);
