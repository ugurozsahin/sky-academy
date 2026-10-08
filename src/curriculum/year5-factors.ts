// y5-factors (#1185): multiples, factor pairs and common factors (5M11). d1 a factor-pair partner ("36 = 4 × ?");
// d2–d3 are "Slice every …" cards (any order) with six numbers, 2–4 of them targets: every factor of n, every multiple of
// n (d2), every common factor of two numbers (d3). Only the factors shown in the six bubbles are targets.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { anyOrderQ } from './any-order';

const divisors = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter(x => n % x === 0);
const hint = { hint: 'Slice them all', hintIsData: false } as const;

/** d1: "36 = 4 × ?" with n ≤ 72 and a factor of 2 to 12. Decoys: n − f, the neighbouring answer, f itself; a big answer swaps in answer ± 10 (#1058). */
function pair(rng: Rng): Question {
  let n: number, f: number;
  do { n = ri(rng, 6, 72); f = ri(rng, 2, 12); } while (n % f !== 0 || n / f < 2 || n / f === f);
  const a = n / f, pool: number[] = [];
  for (const v of [n - f, a + 1, f, a - 1, a + 2, a - 2, a + 3]) if (v > 0 && v !== a && !pool.includes(v) && pool.length < 3) pool.push(v);
  if (a >= 20 && !pool.some(v => v % 10 === a % 10)) pool[2] = a + 10 <= 99 && !pool.includes(a + 10) ? a + 10 : a - 10;
  return wordQ(rng, `${n} = ${f} × ?`, `${a}`, pool.map(String), { say: `${n} equals ${f} times what?` });
}

/** Six numbers: `k` targets (2–4) from `yes`, then decoys taken one from each pool in turn, then any number in 2..max that is not a target-type. */
function card(rng: Rng, prompt: string, say: string, yes: number[], pools: number[][], max: number, isYes: (x: number) => boolean): Question {
  const k = Math.min(ri(rng, 2, 4), yes.length), targets = shuffle(rng, yes).slice(0, k), used = new Set(targets), decoys: number[] = [];
  const queues = pools.map(p => shuffle(rng, p).filter(x => !isYes(x) && x >= 2 && x <= max));
  for (let guard = 0; decoys.length < 6 - k && guard < 12; guard++) for (const q of queues) {
    const x = q.shift(); if (x !== undefined && !used.has(x) && decoys.length < 6 - k) { used.add(x); decoys.push(x); }
  }
  while (decoys.length < 6 - k) { const x = ri(rng, 2, max); if (!used.has(x) && !isYes(x)) { used.add(x); decoys.push(x); } }
  return anyOrderQ(rng, prompt, targets.map(String), decoys.map(String), { say, ...hint });
}

/** "Slice every factor of 24": decoys are a multiple of n, a factor ± 1, and a neighbour of n. */
function factors(rng: Rng): Question {
  let n: number;
  do { n = ri(rng, 12, 48); } while (divisors(n).length < 4);
  const fs = divisors(n);
  return card(rng, `Slice every factor of ${n}`, `Slice every factor of ${n}`, fs, [[n * 2, n * 3], fs.flatMap(f => [f + 1, f - 1]), [n + 1, n - 1, n + 2]], 48, x => n % x === 0);
}

/** "Slice every multiple of 7": decoys are a multiple ± 1 and a number ending in the table's digit that is not a multiple. */
function multiples(rng: Rng): Question {
  const n = ri(rng, 3, 12), ms = Array.from({ length: Math.floor(100 / n) }, (_, i) => (i + 1) * n);
  const ends = Array.from({ length: 10 }, (_, i) => i * 10 + (n % 10));
  return card(rng, `Slice every multiple of ${n}`, `Slice every multiple of ${n}`, ms, [ms.flatMap(m => [m + 1, m - 1]), ends], 100, x => x % n === 0);
}

/** "Slice every common factor of 12 and 18": at least one decoy divides exactly one of the two numbers. */
function common(rng: Rng): Question {
  let a: number, b: number, both: number[];
  do { a = ri(rng, 8, 60); b = ri(rng, 8, 60); both = divisors(a).filter(x => b % x === 0); } while (a >= b || both.length < 2 || both.length > 6);
  const only = [...divisors(a).filter(x => b % x !== 0), ...divisors(b).filter(x => a % x !== 0)].filter(x => x > 1);
  return card(rng, `Slice every common factor of ${a} and ${b}`, `Slice every common factor of ${a} and ${b}`, both, [only, both.flatMap(f => [f + 1, f - 1])], 60, x => a % x === 0 && b % x === 0);
}

export const y5Factors: Generator = (d: Difficulty, rng): Question => {
  if (d === 1) return pair(rng);
  if (d === 2) return pick(rng, [factors, multiples])(rng);
  return common(rng);
};
