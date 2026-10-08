// y5-fracequiv (#1195): Year 5 equivalent fractions, including tenths and hundredths (5M23). d1 a bar with "6 of 8
// parts shaded" and the child names the same fraction in lowest terms; d2 a missing number (2/3 = ?/12); d3 tenths and
// hundredths (7/10 = ?/100) or "which fraction is not equal to 3/4?". Every card is checked by value with `fractions.ts`,
// so no decoy is ever worth the answer. The main slip is adding the same number to top and bottom (2/3 → 11/12).
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ, numberWord } from './util';
import { equal, simplify, type Frac } from './fractions';
import { ks2Say } from './ks2say';

const lab = (f: Frac) => `${f.n}/${f.d}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** Proper fractions in lowest terms with a bottom of at most 6, whose family reaches the 20ths. */
const BASES: Frac[] = [{ n: 1, d: 2 }, { n: 1, d: 3 }, { n: 2, d: 3 }, { n: 1, d: 4 }, { n: 3, d: 4 }, { n: 1, d: 5 }, { n: 2, d: 5 }, { n: 3, d: 5 }, { n: 4, d: 5 }, { n: 5, d: 6 }];

/** d1: a bar of 4–12 parts whose shaded fraction simplifies; the prompt names the counts so two bars never share a repeat key. */
function barCard(rng: Rng): Question {
  let parts: number, shaded: number;
  do { parts = ri(rng, 4, 12); shaded = ri(rng, 2, parts - 2); } while (gcd(shaded, parts) === 1);
  const target = { n: shaded, d: parts }, ans = simplify(target);
  const cands: Frac[] = [
    { n: parts - shaded, d: parts }, simplify({ n: parts - shaded, d: parts }),   // the unshaded fraction
    { n: ans.d, d: ans.n }, { n: parts, d: shaded },                                // top and bottom swapped
    { n: ans.n + 1, d: ans.d + 1 }, { n: ans.n, d: ans.d + 1 }, { n: ans.n + 1, d: ans.d },
  ];
  const decoys = [...new Set(cands.filter(c => c.n >= 1 && c.d >= 1 && !equal(c, target)).map(lab))];
  return wordQ(rng, `${shaded} of ${parts} parts are shaded. Which fraction is the same?`, lab(ans), decoys,
    { visual: { type: 'fraction', parts, shaded, shape: 'bar' }, say: `${numberWord(shaded)} of the ${numberWord(parts)} parts are shaded. Which fraction is the same?`,
      hint: 'Divide the top and bottom by the same number', hintIsData: false });
}

/** Three decoys for a whole-number answer; a big answer whose last digit no decoy shares swaps its last decoy for answer ± 10 (#1058). */
function missingCard(rng: Rng, from: Frac, to: number): Question {
  const k = to / from.d, ans = from.n * k;
  const named = [from.n + (to - from.d), k, from.n, ans * k, to - ans, ans + from.d];
  const pool: number[] = [];
  for (const v of [...named, ...shuffle(rng, [1, -1, 2, -2].map(j => ans + j))]) if (v >= 1 && v !== ans && v <= 100 && !pool.includes(v) && pool.length < 3) pool.push(v);
  if (ans >= 20 && !pool.some(v => v % 10 === ans % 10)) {
    const ten = [ans + 10, ans - 10].find(v => v >= 1 && !pool.includes(v));
    if (ten !== undefined) pool[pool.length - 1] = ten;
  }
  const from_ = lab(from);
  return wordQ(rng, `${from_} = ?/${to}`, String(ans), pool.map(String),
    { say: `${cap(ks2Say(from_))} equals what over ${numberWord(to)}?`, hint: 'Multiply the top by what the bottom was multiplied by', hintIsData: false });
}

/** d2: a bottom of at most 24, reached by multiplying; d3 tenths and hundredths both ways. */
function d2Card(rng: Rng): Question {
  const from = pick(rng, BASES), to = pick(rng, [2, 3, 4, 5, 6].map(k => k * from.d).filter(v => v <= 24 && v !== from.d));
  return missingCard(rng, from, to);
}

function hundredthsCard(rng: Rng): Question {
  if (rng() < 0.5) return missingCard(rng, { n: ri(rng, 1, 9), d: 10 }, 100);
  const tenths = ri(rng, 1, 9), top = tenths * 10, ans = tenths;
  const pool: number[] = [];
  for (const v of [top, ans * 100, ans + 1, ans - 1, ans + 10, ans + 2]) if (v >= 1 && v !== ans && v <= 100 && !pool.includes(v) && pool.length < 3) pool.push(v);
  return wordQ(rng, `${top}/100 = ?/10`, String(ans), pool.map(String),
    { say: `${cap(ks2Say(`${top}/100`))} equals what over ten?`, hint: 'Divide the top and bottom by the same number', hintIsData: false });
}

/** Three equal fractions with a bottom of at most 20, and one that is a near miss. */
function oddCard(rng: Rng): Question {
  const base = pick(rng, BASES.filter(b => b.d * 4 <= 20)), family: Frac[] = [];
  for (let k = 2; base.d * k <= 20; k++) family.push({ n: base.n * k, d: base.d * k });
  const same = shuffle(rng, family).slice(0, 3);
  const slips: Frac[] = [{ n: base.n + 1, d: base.d + 1 }, { n: base.n * 2, d: base.d * 2 + 1 }, { n: base.n * 2 + 1, d: base.d * 2 }, { n: base.n * 3, d: base.d * 3 + 1 }, { n: base.n * 2 + 2, d: base.d * 2 }]
    .filter(c => c.n < c.d && c.d <= 20 && !equal(c, base));
  const odd = pick(rng, slips), nm = lab(base);
  return wordQ(rng, `Which fraction is not equal to ${nm}?`, lab(odd), same.map(lab),
    { say: `Which fraction is not equal to ${ks2Say(nm)}?`, hint: 'Three of them are the same size', hintIsData: false });
}

export const y5FracEquiv: Generator = (level: Difficulty, rng) => {
  if (level === 1) return barCard(rng);
  if (level === 2) return d2Card(rng);
  const r = rng();
  return r < 0.4 ? hundredthsCard(rng) : r < 0.7 ? oddCard(rng) : d2Card(rng);
};
