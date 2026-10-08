// y5-primes (#1186): prime numbers, prime factors and composite numbers (5M12–13). d1 recalls the primes to 19 (pick-one);
// d2 is "Slice every prime number" (any order, six numbers to 100) or "Which number is composite?"; d3 is "Slice every prime
// factor of n". 1 is neither prime nor composite, so it is only ever a decoy.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { anyOrderQ } from './any-order';

export const isPrime = (k: number): boolean => {
  if (k < 2) return false;
  for (let i = 2; i * i <= k; i++) if (k % i === 0) return false;
  return true;
};
const hint = { hint: 'Slice them all', hintIsData: false } as const;
const PRIMES = Array.from({ length: 99 }, (_, i) => i + 2).filter(isPrime);
const LOOK_PRIME = [1, 9, 15, 21, 27, 33, 39, 49, 51, 57, 63, 69, 77, 81, 87, 91, 93];
const COMPOSITES = Array.from({ length: 99 }, (_, i) => i + 2).filter(x => !isPrime(x));

/** d1: one prime to 19 and three non-primes from 1–20, always including 1, 9 or 15. */
function recall(rng: Rng): Question {
  const answer = pick(rng, PRIMES.filter(p => p <= 19)), look = pick(rng, [1, 9, 15]);
  const rest = shuffle(rng, Array.from({ length: 20 }, (_, i) => i + 1).filter(x => !isPrime(x) && x !== look)).slice(0, 2);
  return wordQ(rng, 'Which is a prime number?', `${answer}`, [look, ...rest].map(String), { say: 'Which is a prime number?' });
}

/** d2: "Slice every prime number": 2–4 primes, at least one look-prime decoy (51, 57, 91, 1…), the rest composites. */
function primes(rng: Rng): Question {
  const k = ri(rng, 2, 4), targets = shuffle(rng, PRIMES).slice(0, k);
  const decoys = [pick(rng, LOOK_PRIME)];
  for (const x of shuffle(rng, [...LOOK_PRIME, ...COMPOSITES])) if (decoys.length < 6 - k && !decoys.includes(x)) decoys.push(x);
  return anyOrderQ(rng, 'Slice every prime number', targets.map(String), decoys.map(String), { say: 'Slice every prime number', ...hint });
}

/** d2: "Which number is composite?": an odd composite not ending in 5, beside three primes, one sharing its last digit. */
function composite(rng: Rng): Question {
  const c = pick(rng, LOOK_PRIME.filter(x => x > 1 && x % 5 !== 0));
  const same = pick(rng, PRIMES.filter(p => p % 10 === c % 10));
  const others = shuffle(rng, PRIMES.filter(p => p !== same)).slice(0, 2);
  return wordQ(rng, 'Which number is composite?', `${c}`, [same, ...others].map(String), { say: 'Which number is composite?' });
}

/** d3: "Slice every prime factor of 60" (n ≤ 100, 2–3 distinct prime factors). Decoys: composite factors of n, then primes that are not factors. */
function primeFactors(rng: Rng): Question {
  let n: number, pf: number[];
  do { n = ri(rng, 12, 100); pf = PRIMES.filter(p => n % p === 0); } while (pf.length < 2 || pf.length > 3 || !COMPOSITES.some(x => n % x === 0 && x < n));
  const k = pf.length, targets = shuffle(rng, pf);
  const compFactors = shuffle(rng, COMPOSITES.filter(x => n % x === 0 && x < n));
  const others = shuffle(rng, PRIMES.filter(p => n % p !== 0 && p < 30));
  const decoys = [...compFactors.slice(0, 3), ...others].slice(0, 6 - k);
  if (decoys.length === 6 - k && !decoys.some(isPrime)) decoys[decoys.length - 1] = others[0];
  return anyOrderQ(rng, `Slice every prime factor of ${n}`, targets.map(String), decoys.map(String), { say: `Slice every prime factor of ${n}`, ...hint });
}

export const y5Primes: Generator = (d: Difficulty, rng): Question => {
  if (d === 1) return recall(rng);
  if (d === 2) return pick(rng, [primes, primes, composite])(rng);
  return primeFactors(rng);
};
