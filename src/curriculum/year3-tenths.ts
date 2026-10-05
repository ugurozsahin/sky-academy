// y3-tenths (#1091): counting up and down in tenths, and tenths as ÷ 10 of a one-digit number. d1 counts on a
// line in fractions (n/10), d2 in decimals (a line, or one tenth more or less), d3 divides by 10 (the card
// names the notation) or asks how many tenths make a whole. Values are integer tenths; labels come from `fmt`.
import type { Difficulty, Generator, Question } from './types';
import { ri, shuffle } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';

const dl = (t: number) => fmt(dec(t, 1));
const nonNeg = (v: string | undefined) => (v?.startsWith('−') ? undefined : v);
const fr = (t: number, d = 10) => `${t}/${d}`;
const firstDistinct = (answer: string, pool: (string | undefined)[], k = 3) =>
  [...new Set(pool.filter((s): s is string => !!s && s !== answer))].slice(0, k);
const done = (rng: Parameters<Generator>[1], q: Omit<Question, 'options' | 'hint' | 'hintIsData'>, ds: string[]): Question =>
  ({ ...q, options: shuffle(rng, [q.answer, ...ds]), hint: 'Slice the number that fits', hintIsData: false });

/** A six-tick line of consecutive tenths from `s`, one tick hidden; `fmtTick` writes the labels. */
function line(rng: Parameters<Generator>[1], s: number, h: number, fmtTick: (t: number) => string, ds: (t: number) => (string | undefined)[]): Question {
  const t = s + h, labels = Array.from({ length: 6 }, (_, i) => (i === h ? '?' : fmtTick(s + i)));
  const at = (k: number) => Number((k / 10).toFixed(1));
  return done(rng, {
    prompt: 'Count in tenths. Which number is hidden?', say: 'Count in tenths. Which number is hidden?', answer: fmtTick(t),
    visual: { type: 'numberline', from: at(s), to: at(s + 5), step: 0.1, mark: at(t), labels },
  }, firstDistinct(fmtTick(t), ds(t)));
}

export const y3Tenths: Generator = (d: Difficulty, rng): Question => {
  if (d === 1) {
    const s = ri(rng, 1, 5), h = ri(rng, 0, 5), t = s + h;
    const near = [t + 1, t - 1, t + 2, t - 2].filter(k => k >= 1 && k <= 10).map(k => fr(k));
    return line(rng, s, h, k => fr(k), k => [...near.slice(0, 2), fr(k, 9)]);
  }
  if (d === 2) {
    if (rng() < 0.5) {
      const s = ri(rng, 5, 25), h = ri(rng, 0, 5), t = s + h;
      const misread = t % 10 === 0 ? `${t / 10 - 1}.10` : undefined; // "0.9, 0.10": counting tenths like whole numbers
      return line(rng, s, h, dl, k => [misread, dl(k + 1), dl(k + 10), dl(k - 1), dl(k - 10), dl(k + 2)].map(nonNeg));
    }
    const t = ri(rng, 1, 39), more = rng() < 0.5, a = more ? t + 1 : t - 1;
    return done(rng, { prompt: `What is one tenth ${more ? 'more' : 'less'} than ${dl(t)}?`, say: ks2Say(`What is one tenth ${more ? 'more' : 'less'} than ${dl(t)}`), answer: dl(a) },
      firstDistinct(dl(a), [dl(t + (more ? 2 : -2)), dl(a + 10), dl(t), dl(a - 10 < 0 ? a + 20 : a - 10)].map(nonNeg)));
  }
  if (rng() < 0.25) {
    const n = ri(rng, 1, 3);
    return { ...done(rng, { prompt: `How many tenths make ${n}?`, say: `How many tenths make ${ks2Say(String(n))}?`, answer: String(10 * n) }, firstDistinct(String(10 * n), [String(n), String(10 * n + 10), String(100 * n), String(10 * n - 1)])), slow: true };
  }
  const n = ri(rng, 1, 9), frac = rng() < 0.5, ans = frac ? fr(n) : dl(n), form = frac ? 'fraction' : 'decimal';
  const nb = [n + 1, n - 1].filter(k => k >= 1 && k <= 9).map(k => (frac ? fr(k) : dl(k)));
  return { ...done(rng, { prompt: `${n} ÷ 10 = ? (as a ${form})`, say: `What is ${n} divided by 10, as a ${form}?`, answer: ans }, firstDistinct(ans, [String(n * 10), String(n), nb[0], nb[1]])), slow: true };
};
