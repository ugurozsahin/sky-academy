// Year 3 number strand (#1050). One topic today (`y3-count`); every other row is a future PR's own slot —
// see the `// slot:`/`// import:` comments below. Keep this file ≤300 lines (#1050): a generator that would
// push it past that moves to its own `year3-<slug>.ts` and this file keeps only its row/import.
import type { Difficulty, Generator, Question, Topic } from './types';
import { ri, pick, shuffle } from './util';
import { dec, fmt } from './ks2num';
import { swappedDigits } from './mistakes';

// #1050: this topic hand-builds its `Question`s instead of using `numQ()` because its options must be
// comma-formatted via `fmt()` ("1,005"), never `numQ`'s bare `String(answer)`.
const fmtN = (n: number) => fmt(dec(n, 0));

const STEPS = [4, 8, 50, 100] as const;
type Step = typeof STEPS[number];

/** The run's four terms and which index is the "?" (#1050 y3-count). Never crosses below 0 or above 1099. */
function runTerms(d: Difficulty, step: Step, rng: () => number): { terms: number[]; gapIndex: number; localStep: number } {
  const direction = d === 3 ? pick(rng, [1, -1] as const) : 1;
  const localStep = step * direction;
  const fromZeroOnly = d === 1 || step === 4 || step === 8; // 4s/8s always count from 0; 50s/100s at d2/d3 may start from any multiple
  const start = localStep > 0
    ? (fromZeroOnly ? 0 : step * ri(rng, 0, Math.floor((1099 - 3 * localStep) / step)))
    : step * ri(rng, Math.ceil(3 * step / step), Math.floor(1099 / step)); // never crosses below 0 counting back
  const terms = [0, 1, 2, 3].map(i => start + i * localStep);
  const gapIndex = d === 3 ? pick(rng, [1, 2, 3] as const) : 3; // d1/d2 always ask the next term
  return { terms, gapIndex, localStep };
}

/** Misconception decoys first (#1050 KS2 rule): the term after next (a skipped term), and a column slip that
 *  keeps the units digit (±10 for 4s/8s, ±100 for 50s/100s); `nearby`-style fill only tops up the rest. */
function runDecoys(answer: number, step: Step, localStep: number, rng: () => number): number[] {
  const skipTerm = answer + localStep;
  const slipAmount = step === 50 || step === 100 ? 100 : 10;
  const slipTerm = rng() < 0.5 ? answer + slipAmount : answer - slipAmount;
  const pool = new Set<number>([skipTerm, slipTerm].filter(v => v !== answer && v >= 0 && v <= 1099));
  while (pool.size < 3) {
    const v = answer + ri(rng, -Math.max(step, 10), Math.max(step, 10));
    if (v !== answer && v >= 0 && v <= 1099 && !pool.has(v)) pool.add(v);
  }
  return [...pool].slice(0, 3);
}

function countRun(d: Difficulty, rng: () => number): Question {
  const step: Step = d === 1 ? pick(rng, [50, 100] as const) : pick(rng, STEPS);
  const { terms, gapIndex, localStep } = runTerms(d, step, rng);
  const answer = terms[gapIndex];
  const prompt = terms.map((t, i) => i === gapIndex ? '?' : fmtN(t)).join(', ');
  const options = shuffle(rng, [answer, ...runDecoys(answer, step, localStep, rng)]).map(fmtN);
  return { prompt: `${prompt} = ?`, say: `Count in ${step}s. ${prompt.replace(/,(?=[^,]*$)/, ' then')} = what?`, answer: fmtN(answer), options };
}

/** A decoy sharing the answer's leading (hundreds) digit, the same way `mistakes.ts`'s `fillLead` guarantees
 *  one for its sibling module (#1448 review). Only needed for `amt === 100`: adding/subtracting exactly 100
 *  is precisely the operation that changes the leading digit, so none of `moreOrLess`'s other three named
 *  decoys ever land in the answer's own hundred there (measured 46-89% leak, past the KS2 ≤30% ceiling).
 *  `amt === 10`'s crossing case needs no such fix: its `otherPower` decoy already lands in the answer's own
 *  hundred there, by construction. `null` when no same-hundred candidate exists (an extreme range edge). */
function sameLeadDecoy(answer: number, rng: () => number): number | null {
  const lo = Math.max(0, Math.floor(answer / 100) * 100), hi = Math.min(1099, lo + 99);
  const candidates = [answer - 20, answer - 10, answer + 10, answer + 20].filter(v => v !== answer && v >= lo && v <= hi);
  return candidates.length ? pick(rng, candidates) : null;
}

/** A base whose crossing behaviour matches the difficulty (#1050 y3-count): d1 never crosses a hundred, d3
 *  always does, d2 doesn't care. Rejection-sampled, capped at 200 tries either way. */
function pickBase(d: Difficulty, amt: 10 | 100, sign: 1 | -1, rng: () => number): number {
  const crosses = (base: number) => Math.floor(base / 100) !== Math.floor((base + amt * sign) / 100);
  let base: number;
  let guard = 0;
  do {
    base = ri(rng, 100, 999);
    guard++;
  } while (guard < 200 && (d === 1 ? crosses(base) : d === 3 ? !crosses(base) : false));
  return base;
}

/** 10 or 100 more/less than a given number (#1050 y3-count). */
function moreOrLess(d: Difficulty, rng: () => number): Question {
  const amt: 10 | 100 = d === 2 ? 100 : d === 3 ? pick(rng, [10, 100] as const) : 10;
  const otherAmt: 10 | 100 = amt === 10 ? 100 : 10;
  const more = rng() < 0.5;
  const sign = more ? 1 : -1;
  const base = pickBase(d, amt, sign, rng);
  const answer = base + amt * sign;
  const prompt = `${amt} ${more ? 'more' : 'less'} than ${fmtN(base)} = ?`;
  const otherPower = base + otherAmt * sign;
  const wrongDirection = base - amt * sign;
  const both = base - otherAmt * sign;
  const sameLead = amt === 100 ? sameLeadDecoy(answer, rng) : null;
  const named = sameLead !== null ? [sameLead, wrongDirection, both] : [otherPower, wrongDirection, both];
  const pool = new Set<number>(named.filter(v => v !== answer && v >= 0 && v <= 1099));
  while (pool.size < 3) {
    const v = answer + ri(rng, -Math.max(amt, 10), Math.max(amt, 10));
    if (v !== answer && v >= 0 && v <= 1099 && !pool.has(v)) pool.add(v);
  }
  const options = shuffle(rng, [answer, ...[...pool].slice(0, 3)]).map(fmtN);
  return { prompt, say: prompt, answer: fmtN(answer), options };
}

export const y3Count: Generator = (d, rng) => rng() < 0.5 ? countRun(d, rng) : moreOrLess(d, rng);

// ---- y3-pv (#1079): place value of each digit in a 3-digit number, building it, partitioning it ----
const COLS = [100, 10, 1] as const;
const plural = (n: number, word: string) => n === 1 ? `1 ${word}` : `${n} ${word}s`;
const join = (xs: string[]) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const digitsOf3 = (n: number) => [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10];

/** Distinct, in-range decoys: the named misconceptions first, a column slip of the answer only tops up. */
function pvOptions(answer: number, named: number[], slip: number, rng: () => number): string[] {
  const pool = new Set<number>(named.filter(v => v !== answer && v > 0 && v <= 999));
  for (const v of shuffle(rng, [answer + slip, answer - slip, answer + 10, answer - 10, answer + 100, answer - 100])) {
    if (pool.size >= 3) break;
    if (v !== answer && v > 0 && v <= 999) pool.add(v);
  }
  return shuffle(rng, [answer, ...[...pool].slice(0, 3)]).map(fmtN);
}

/** d1: "What is the 4 worth in 346?" Every digit of the number is different, so the 4 can only be one column. */
function pvDigit(rng: () => number): Question {
  let n: number, ds: number[];
  do { n = ri(rng, 123, 987); ds = digitsOf3(n); } while (new Set(ds).size < 3 || ds.includes(0));
  const col = ri(rng, 0, 2), digit = ds[col], answer = digit * COLS[col];
  const shifts = COLS.filter(c => c !== COLS[col]).map(c => digit * c); // the right digit, the wrong column
  const others = ds.map((x, i) => x * COLS[i]).filter((_, i) => i !== col); // another digit's value
  const options = pvOptions(answer, [digit, shifts[0], others[0], shifts[1]], COLS[col], rng);
  return { prompt: `What is the ${digit} worth in ${n}?`, say: `In ${n}, what is the ${digit} worth`, answer: fmtN(answer), options };
}

/** d2/d3: "3 hundreds, 4 tens and 6 ones = ?", sometimes out of order, a quarter with no tens (306). */
function pvBuild(d: Difficulty, rng: () => number): Question {
  const h = ri(rng, 1, 9), o = ri(rng, 1, 9), t = rng() < 0.25 ? 0 : ri(rng, 1, 9);
  const answer = h * 100 + t * 10 + o;
  let parts = [plural(h, 'hundred'), ...(t ? [plural(t, 'ten')] : []), plural(o, 'one')];
  if (d === 3 || rng() < 0.4) parts = shuffle(rng, parts);
  const text = join(parts);
  const named = [...swappedDigits(dec(answer, 0)).map(x => x.v), t ? h * 100 + t * 10 : h * 10 + o, t ? h * 10 + t : h * 100 + o * 10];
  return { prompt: `${text} = ?`, say: `${text}. What number is that`, answer: fmtN(answer), options: pvOptions(answer, named, 100, rng) };
}

/** d3: partition as the NC does: "146 = 130 + ?" (16) and "146 = 100 + ? + 6" (40). */
function pvPartition(rng: () => number): Question {
  const h = ri(rng, 1, 9), t = ri(rng, 1, 9), o = ri(rng, 1, 9), n = h * 100 + t * 10 + o;
  if (t >= 2 && rng() < 0.5) {
    const shown = h * 100 + ri(rng, 1, t - 1) * 10, answer = n - shown;
    const options = pvOptions(answer, [o, n - h * 100, answer - o], 10, rng);
    return { prompt: `${n} = ${shown} + ?`, say: `${n} is ${shown} plus what`, answer: fmtN(answer), options };
  }
  const answer = t * 10;
  const options = pvOptions(answer, [t, t * 100, n - h * 100, n - o], 10, rng);
  return { prompt: `${n} = ${h * 100} + ? + ${o}`, say: `${n} is ${h * 100} plus what, plus ${o}`, answer: fmtN(answer), options };
}

export const y3PlaceValue: Generator = (d, rng) => d === 1 ? pvDigit(rng) : d === 2 || rng() < 0.5 ? pvBuild(d, rng) : pvPartition(rng);

export const Y3_NUMBER: Topic[] = [
  { id: 'y3-count', title: 'Count in 4s, 8s, 50s and 100s', icon: '🔢', subject: 'maths', year: 'year3', nc: 'Y3 NPV: count in 4s, 8s, 50s, 100s; 10 or 100 more or less', gen: y3Count },
  { id: 'y3-pv', title: 'Hundreds, Tens and Ones', icon: '💯', subject: 'maths', year: 'year3', nc: 'Y3 NPV: place value of each digit, partitioning (3M2)', gen: y3PlaceValue },
  // slot: y3-compare
  // slot: y3-line
  // slot: y3-words
];
