// Year 3 number strand (#1050). One topic today (`y3-count`); every other row is a future PR's own slot —
// see the `// slot:`/`// import:` comments below. Keep this file ≤300 lines (#1050): a generator that would
// push it past that moves to its own `year3-<slug>.ts` and this file keeps only its row/import.
import type { Difficulty, Generator, Question, Topic } from './types';
import { ri, pick, shuffle, wordQ, numberWord, NUM_WORDS } from './util';
import { dec, fmt } from './ks2num';
import { swappedDigits } from './mistakes';
import { y3Line } from './year3-line';

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

/** Misconception decoys first (#1050 KS2 rule): the term after next (a skipped term; at an interior gap it is printed,
 *  so it is dropped for further multiples of the step, #1767), and a column slip that
 *  keeps the units digit (±10 for 4s/8s, ±100 for 50s/100s); `nearby`-style fill only tops up the rest.
 *  Two shapes leaked the leading digit past the KS2 ≤30% ceiling per step (#1454): in 100s both named decoys
 *  are ±100 and so always leave the answer's hundred (measured 36-38% at d1-d3), and a two-digit answer
 *  (8s count 0, 8, 16, 24 at d2) has its leading digit in the tens column, which ±8 and ±10 both leave
 *  (51% at d2). Those two shapes get a `sameLeadDecoy` guaranteed in the pool, as `moreOrLess` does. Only
 *  those: the rule counts answers ≥20, and a ±1/±2 decoy on a 50s/100s card (answer 0 or 50) or beside 4, 8
 *  or 12 would be a non-multiple a child never reaches by counting (silent-failure-hunter, round 1). */
function runDecoys(answer: number, step: Step, localStep: number, printed: ReadonlySet<number>, rng: () => number): number[] {
  const skipTerm = answer + localStep;
  const slipAmount = step === 50 || step === 100 ? 100 : 10;
  const slipTerm = rng() < 0.5 ? answer + slipAmount : answer - slipAmount;
  const needsLead = step === 100 ? answer >= 100 : (step === 4 || step === 8) && answer >= 20 && answer < 100;
  const sameLead = needsLead ? sameLeadDecoy(answer, rng) : null;
  // #1767: nothing the prompt already prints may be offered — it is a free elimination. With an interior gap
  // (d3) `skipTerm` is the next printed term, so it drops out. Each named shape lost that way is replaced by a
  // further multiple of the step (counted two or three steps too far, or too few), which a child can still fall
  // for, before any random neighbour is drawn. Only the ones lost: when nothing printed is dropped the pool is
  // exactly what it was, so #1454's leading-digit rail still sees the random top-up it was measured with.
  const named = sameLead !== null ? [sameLead, skipTerm, slipTerm] : [skipTerm, slipTerm];
  const inRange = (v: number) => v !== answer && v >= 0 && v <= 1099;
  const ok = (v: number) => inRange(v) && !printed.has(v);
  const pool = new Set<number>(named.filter(ok));
  const lost = new Set(named.filter(v => inRange(v) && printed.has(v))).size;
  // Nearest first: two steps on, two back, three on, three back.
  [2, -2, 3, -3].map(k => answer + k * localStep).filter(v => ok(v) && !pool.has(v)).slice(0, lost).forEach(v => pool.add(v));
  while (pool.size < 3) {
    const v = answer + ri(rng, -Math.max(step, 10), Math.max(step, 10));
    if (ok(v) && !pool.has(v)) pool.add(v);
  }
  return [...pool].slice(0, 3);
}

function countRun(d: Difficulty, rng: () => number): Question {
  const step: Step = d === 1 ? pick(rng, [50, 100] as const) : pick(rng, STEPS);
  const { terms, gapIndex, localStep } = runTerms(d, step, rng);
  const answer = terms[gapIndex];
  const prompt = terms.map((t, i) => i === gapIndex ? '?' : fmtN(t)).join(', ');
  const printed = new Set(terms.filter((_, i) => i !== gapIndex));
  const options = shuffle(rng, [answer, ...runDecoys(answer, step, localStep, printed, rng)]).map(fmtN);
  return { prompt: `${prompt} = ?`, say: `Count in ${step}s. ${prompt.replace(/,(?=[^,]*$)/, ' then')} = what?`, answer: fmtN(answer), options };
}

/** A decoy sharing the answer's leading digit, the same way `mistakes.ts`'s `fillLead` guarantees one for its
 *  sibling module (#1448 review): ±10/±20 inside the answer's own hundred (1,000-1,099 is the tenth hundred and
 *  its leading digit is that 1), or ±1/±2 inside its own ten for a two-digit answer, whose leading digit is the
 *  tens digit (#1454). `moreOrLess` needs it for `amt === 100`: adding/subtracting exactly 100 is precisely
 *  the operation that changes the leading digit, so none of its other three named decoys ever land in the
 *  answer's own hundred there (measured 46-89% leak, past the KS2 ≤30% ceiling) — and for a two-digit answer at
 *  `amt === 10` (d3's crossing case, 88% leak, #1766).
 *  `runDecoys` says which of its shapes need it. `null` when no candidate exists — defensive: every answer in
 *  0-1,099 has at least two candidates, so no caller reaches it today. */
function sameLeadDecoy(answer: number, rng: () => number): number | null {
  const width = answer < 100 ? 10 : 100, unit = width / 10;
  const lo = Math.max(0, Math.floor(answer / width) * width), hi = Math.min(1099, lo + width - 1);
  const candidates = [answer - 2 * unit, answer - unit, answer + unit, answer + 2 * unit].filter(v => v !== answer && v >= lo && v <= hi);
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
  // A guaranteed same-leading-digit decoy where the named three would all leave the answer's leading digit: every
  // `amt === 100` card, and `amt === 10` with a two-digit answer (#1766). That second case is d3's crossing case only,
  // "10 less than 100..109" asking for 90..99, where `otherPower` is 0..9 and `wrongDirection` and `both` are in other
  // hundreds, so the card loses the "used 100 instead of 10" slip (a child rejects 0..9 on size alone) and keeps
  // "more instead of less". A three-digit `amt === 10` answer needs none: `otherPower` lands in its own hundred.
  const needsSameLead = amt === 100 || (amt === 10 && answer < 100);
  const sameLead = needsSameLead ? sameLeadDecoy(answer, rng) : null;
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

// ---- y3-compare (#1080): < > = between numbers up to 1,000, then ordering three ----
type Pair = [number, number];

/** Same three digits, a different number ("473 ? 437"): the misconception is reading digits, not columns. */
function reordered(rng: () => number): Pair {
  for (;;) {
    const a = ri(rng, 100, 999), b = Number(shuffle(rng, String(a).split('')).join(''));
    if (b >= 100 && b !== a) return [a, b];
  }
}

/** One d2 pair: the digits reordered, a shared hundreds digit, 2-digit against 3-digit, or 1,000; 15% equal. */
function comparePair(d: Difficulty, rng: () => number): Pair {
  if (d === 1) { // different hundreds digit in half the pairs, never equal
    const a = ri(rng, 100, 999), h = Math.floor(a / 100) * 100;
    const b = rng() < 0.5 ? ri(rng, 100, 999) : h + ri(rng, 0, 99);
    return b === a ? comparePair(d, rng) : [a, b];
  }
  const kind = rng(), a = ri(rng, 100, 999);
  if (kind < 0.15) return [a, a];
  if (kind < 0.4) return reordered(rng);
  if (kind < 0.65) { const b = Math.floor(a / 100) * 100 + ri(rng, 0, 99); return b === a ? [a, a % 100 === 99 ? a - 1 : a + 1] : [a, b]; }
  if (kind < 0.85) return [ri(rng, 10, 99), ri(rng, 100, 199)];
  return [1000, ri(rng, 900, 999)];
}

/** d3: three numbers sharing a hundreds digit, sliced smallest to biggest (every number is under 1,000, so a comma join is never a thousands group). */
function orderThree(rng: () => number): Question {
  const h = ri(rng, 1, 9) * 100, set = new Set<number>();
  while (set.size < 3) set.add(h + ri(rng, 0, 99));
  const sorted = [...set].sort((x, y) => x - y).map(fmtN), shown = shuffle(rng, sorted);
  return { prompt: 'Smallest to biggest!', say: `Slice the numbers from smallest to biggest: ${shown.join(', ')}`, answer: sorted.join(','), sequence: sorted, options: shown, visual: { type: 'word', text: shown.join('  ') }, hint: 'Slice the smallest number first', hintIsData: false };
}

export const y3Compare: Generator = (d, rng) => {
  if (d === 3 && rng() < 0.4) return orderThree(rng);
  const [x, y] = comparePair(d, rng), [a, b] = rng() < 0.5 ? [x, y] : [y, x];
  return wordQ(rng, `${fmtN(a)} ? ${fmtN(b)}`, a < b ? '<' : a > b ? '>' : '=', ['<', '>', '='], { say: `${fmtN(a)} compared with ${fmtN(b)}. Less than, greater than, or equal?`, hint: 'Slice the correct sign', hintIsData: false });
};

// ---- y3-words (#1081): numbers to 1,000 in words. Long words stay on the card; bubbles are numerals ----
const TENS_WORDS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** British words for 100-1,000: "three hundred and forty-six", "one thousand". Below 100 is `numberWord`'s. */
export function wordsTo1000(n: number): string {
  if (n === 1000) return 'one thousand';
  const h = Math.floor(n / 100), r = n % 100;
  return r ? `${NUM_WORDS[h]} hundred and ${numberWord(r)}` : `${NUM_WORDS[h]} hundred`;
}

/** Misconceptions first: written as heard (215 -> 20,015, always sharing the answer's lead and last digit), the
 *  teen/ty swap, then swapped digits. Never a misspelling: every decoy is a numeral. `nearby`-style fill tops up. */
function wordsDecoys(n: number, rng: () => number): number[] {
  if (n === 1000) return [10000, 100, 1100, 1010];
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10, r = n % 100;
  const heard = r ? Number(`${h * 100}${r}`) : h * 1000;
  const teenSwap = t === 1 ? h * 100 + o * 10 : h * 100 + 10 + o;
  const named = [heard, teenSwap, h * 100 + o * 10 + t, o * 100 + t * 10 + h];
  const pool = new Set(named.filter(v => v !== n && v > 0));
  while (pool.size < 3) { const v = n + 10 * ri(rng, -9, 9); if (v !== n && v > 99) pool.add(v); }
  return [...pool].slice(0, 3);
}

/** d1: no zero digit. d2: a zero in the tens or ones place, or 1,000. */
function wordsNumber(d: Difficulty, rng: () => number): number {
  const h = ri(rng, 1, 9), t = ri(rng, 1, 9), o = ri(rng, 1, 9);
  if (d === 1) return h * 100 + t * 10 + o;
  const form = rng();
  return form < 0.12 ? 1000 : form < 0.4 ? h * 100 + t * 10 : form < 0.8 ? h * 100 + o : h * 100;
}

/** d3: the tens word of "346 is three hundred and ___-six". Options are single words of 8 letters or fewer. */
function tensGap(rng: () => number): Question {
  const t = ri(rng, 2, 9), o = ri(rng, 0, 9), h = ri(rng, 1, 9), n = h * 100 + t * 10 + o;
  const answer = TENS_WORDS[t - 2];
  const teen = NUM_WORDS[10 + t], short = (w: string) => w.length <= 8;
  const named = [teen, NUM_WORDS[t], TENS_WORDS[t - 1] ?? TENS_WORDS[t - 3]].filter(w => short(w) && w !== answer && w !== 'zero');
  const fill = shuffle(rng, [...NUM_WORDS.slice(11, 20), ...TENS_WORDS].filter(short));
  const ds = [...new Set([...named, ...fill.filter(w => w !== answer)])].slice(0, 3);
  const prompt = `${n} is ${NUM_WORDS[h]} hundred and ___${o ? `-${NUM_WORDS[o]}` : ''}`;
  return wordQ(rng, prompt, answer, ds, { say: `${n} is ${NUM_WORDS[h]} hundred and what${o ? `, ${NUM_WORDS[o]}` : ''}?`, hint: 'Slice the tens word', hintIsData: false });
}

export const y3Words: Generator = (d, rng) => {
  if (d === 3) return tensGap(rng);
  const n = wordsNumber(d, rng), words = wordsTo1000(n);
  return wordQ(rng, words, fmtN(n), wordsDecoys(n, rng).map(fmtN), { say: `Which number is ${words}?`, visual: { type: 'word', text: words } });
};

export const Y3_NUMBER: Topic[] = [
  { id: 'y3-count', title: 'Count in 4s, 8s, 50s and 100s', icon: '🔢', subject: 'maths', year: 'year3', nc: 'Y3 NPV: count in 4s, 8s, 50s, 100s; 10 or 100 more or less', gen: y3Count },
  { id: 'y3-pv', title: 'Hundreds, Tens and Ones', icon: '💯', subject: 'maths', year: 'year3', nc: 'Y3 NPV: place value of each digit, partitioning (3M2)', parent: 'What each digit is worth, and splitting a number into hundreds, tens and ones', gen: y3PlaceValue },
  { id: 'y3-compare', title: 'Compare and Order to 1,000', icon: '⚖️', subject: 'maths', year: 'year3', nc: 'Y3 NPV: compare and order numbers to 1,000 (3M3)', sequenceFrom: 3, gen: y3Compare },
  { id: 'y3-line', title: 'Number Line to 1,000', icon: '📏', subject: 'maths', year: 'year3', nc: 'Y3 NPV: identify, represent and estimate numbers (3M4)', gen: y3Line },
  { id: 'y3-words', title: 'Numbers to 1,000 in Words', icon: '🔤', subject: 'maths', year: 'year3', nc: 'Y3 NPV: read and write numbers to 1,000 in numerals and words (3M5)', gen: y3Words },
];
