// y6-mean (#1251): calculate and interpret the mean as an average (NC 6M49). d1 the mean of three numbers up to 20, d2 four to
// six values up to 100 in a context, d3 either a mean to one decimal place or a missing value worked back from a mean. The data
// sits in the hint (`hintIsData`); every sum is scaled to an integer, so a mean such as 4.5 never meets a float.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt } from './ks2num';

const CONTEXTS: { label: string; ask: string; say: string }[] = [
  { label: 'Scores', ask: 'Mean score?', say: 'scores' },
  { label: 'Heights in cm', ask: 'Mean height in cm?', say: 'heights in centimetres' },
  { label: 'Goals', ask: 'Mean goals?', say: 'goals' },
  { label: 'Books read', ask: 'Mean books read?', say: 'numbers of books read' },
];

const list = (xs: number[]) => xs.join(', ');
const spoken = (xs: number[]) => xs.length < 2 ? String(xs[0]) : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const lead = (s: string) => s.replace(/\D/g, '')[0];
const last = (s: string) => s.replace(/\D/g, '').slice(-1);

/**
 * One card. `ans` and every candidate are scaled by `10 ** dp`. The first candidate is the named total slip and is always kept;
 * an answer in #1058's leak scope (20 or more, or a decimal) also gets one decoy sharing its last digit and one its leading digit.
 */
function card(rng: Rng, dp: number, ans: number, named: number[], extra: Pick<Question, 'prompt' | 'say'> & { hint: string }): Question {
  const label = (v: number) => fmt(dec(v, dp));
  const ok = (v: number) => Number.isInteger(v) && v >= 1 && v !== ans;
  const ds = [...new Set([named[0], ...shuffle(rng, named.slice(1))].filter(ok))].slice(0, 3);
  if (ans >= 20 * 10 ** dp || dp > 0) {
    const al = label(ans), swap = (i: number, v: number) => { if (ok(v) && !ds.includes(v)) ds.splice(Math.min(i, ds.length), ds.length > i ? 1 : 0, v); };
    if (!ds.some(v => last(label(v)) === last(al))) swap(2, [ans + 10, ans - 10].filter(v => ok(v) && !ds.includes(v))[rng() < 0.5 ? 0 : 1] ?? ans + 10);
    if (!ds.some(v => lead(label(v)) === lead(al)))
      swap(1, [1, -1, 2, -2, 3, -3, 4, -4].map(s => ans + s).find(v => ok(v) && !ds.includes(v) && lead(label(v)) === lead(al) && last(label(v)) !== last(al)) ?? 0);
  }
  for (let s = 2; ds.length < 3; s++) for (const v of [ans + s, ans - s]) if (ok(v) && !ds.includes(v) && ds.length < 3) ds.push(v);
  return wordQ(rng, extra.prompt, label(ans), ds.map(label), { say: extra.say, hint: extra.hint, hintIsData: true });
}

/** `n` values in 1..max whose sum is exactly `total`, smallest first, so one set of numbers is one card; null when the draw does not fit. */
function split(rng: Rng, n: number, total: number, lo: number, hi: number): number[] | null {
  const xs: number[] = [];
  for (let i = 0; i < n - 1; i++) xs.push(ri(rng, lo, hi));
  const rest = total - xs.reduce((a, b) => a + b, 0);
  return rest >= lo && rest <= hi ? [...xs, rest].sort((a, b) => a - b) : null;
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

/** Mean of `xs` (scaled by `10 ** dp`) with the named slips: the total, ÷ (n − 1), the median, the range, the largest value. */
function meanCard(rng: Rng, xs: number[], dp: number, ctx: { label: string; ask: string; say: string }, small: boolean): Question {
  const n = xs.length, total = xs.reduce((a, b) => a + b, 0), k = 10 ** dp;
  const named = [total * k, total * k / (n - 1), median(xs) * k, (Math.max(...xs) - Math.min(...xs)) * k, Math.max(...xs) * k];
  return card(rng, dp, total * k / n, named, {
    prompt: small ? 'Mean of the numbers?' : ctx.ask,
    hint: `${small ? 'Numbers' : ctx.label}: ${list(xs)}`,
    say: `${small ? 'The numbers are' : `The ${ctx.say} are`} ${spoken(xs)}. What is the mean?`,
  });
}

/** d3: n numbers have a mean m; n − 1 are known, find the last. */
function missing(rng: Rng): Question {
  for (;;) {
    const n = ri(rng, 3, 5), m = ri(rng, 4, 20), x = ri(rng, 1, 2 * m), known = split(rng, n - 1, n * m - x, 1, 3 * m);
    if (!known || x === m) continue;
    const ks = known.reduce((a, b) => a + b, 0);
    return card(rng, 0, x, [n * m, m, ks, ks / (n - 1)], {
      prompt: 'The missing number?',
      hint: `Mean ${m} of ${n} numbers. Known: ${list(known)}`,
      say: `The mean of ${n} numbers is ${m}. ${spoken(known)} are three of them. What is the other number?`.replace('three', ['', '', 'two', 'three', 'four'][n - 1]),
    });
  }
}

export const y6Mean: Generator = (d: Difficulty, rng: Rng): Question => {
  if (d === 1) {
    for (;;) {
      const m = ri(rng, 3, 12), xs = split(rng, 3, 3 * m, 1, 20);
      if (xs && new Set(xs).size > 1) return meanCard(rng, xs, 0, CONTEXTS[0], true);
    }
  }
  const ctx = pick(rng, CONTEXTS);
  if (d === 2) {
    for (;;) {
      const n = ri(rng, 4, 6), m = ri(rng, 8, 60), xs = split(rng, n, n * m, Math.max(1, m - 20), Math.min(100, m + 25));
      if (xs && new Set(xs).size > 2) return meanCard(rng, xs, 0, ctx, false);
    }
  }
  if (rng() < 0.5) return missing(rng);
  for (;;) {
    const n = pick(rng, [2, 4, 5]), xs = Array.from({ length: n }, () => ri(rng, 2, 30)), s = xs.reduce((a, b) => a + b, 0);
    if (s % n !== 0 && (s * 10) % n === 0 && new Set(xs).size > 1) return meanCard(rng, xs, 1, ctx, false);
  }
};
