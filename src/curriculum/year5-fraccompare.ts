// y5-fraccompare (#1194): compare and order fractions whose denominators are multiples of one base (5M22). d1 pick-one
// between two fractions on one bottom or one top; d2 pick the biggest or smallest of three or four on related bottoms;
// d3 slice three in order. The "bigger bottom, bigger fraction" mistake is tested at d2: the fraction with the unique
// biggest denominator is always on the card and never the answer.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle } from './util';
import { compare, type Frac } from './fractions';
import { ks2Say } from './ks2say';

const lab = (f: Frac) => `${f.n}/${f.d}`;
const BASES = [2, 3, 4, 5, 6];
const distinct = (fs: Frac[]) => fs.every((f, i) => fs.every((g, j) => i === j || compare(f, g) !== 0));
/** A proper fraction on a bottom drawn from the multiples of `base` up to 12 (so 3/6/12, 2/4/8, 5/10 …). */
const onBase = (rng: Rng, base: number): Frac => {
  const ds: number[] = []; for (let d = base; d <= 12; d += base) ds.push(d);
  const d = pick(rng, ds), n = ri(rng, 1, d - 1);
  return { n, d };
};
const unique = <T>(make: () => T, ok: (t: T) => boolean): T => {
  for (let i = 0; i < 200; i++) { const t = make(); if (ok(t)) return t; }
  throw new Error('y5-fraccompare: no card found');
};

function ask(fs: Frac[], big: boolean, rng: Rng, hint: string): Question {
  const ans = fs.slice().sort(compare)[big ? fs.length - 1 : 0];
  const word = big ? 'larger' : 'smaller', shown = shuffle(rng, fs.map(lab));
  return { prompt: fs.length === 2 ? `Which is ${word}? ${shown.join(' or ')}` : `Which is the ${big ? 'largest' : 'smallest'}?`,
    say: `Which is the ${fs.length === 2 ? word : big ? 'largest' : 'smallest'}? ${shown.map(s => ks2Say(s)).join(', or ')}`,
    answer: lab(ans), options: shown, visual: fs.length === 2 ? undefined : { type: 'word', text: shown.join('  ') }, hint, hintIsData: false };
}

function pair(rng: Rng): Frac[] {
  return unique((): Frac[] => {
    if (rng() < 0.5) { const d = ri(rng, 3, 12); return [{ n: ri(rng, 1, d - 1), d }, { n: ri(rng, 1, d - 1), d }]; }
    const n = ri(rng, 1, 5); return [{ n, d: ri(rng, n + 1, 12) }, { n, d: ri(rng, n + 1, 12) }];
  }, distinct);
}

/** Three or four fractions on one base, the unique biggest bottom among them — and never the answer. */
function crowd(rng: Rng, big: boolean): Frac[] {
  const base = pick(rng, BASES.filter(b => b * 2 <= 12));
  return unique(() => Array.from({ length: ri(rng, 3, 4) }, () => onBase(rng, base)), fs => {
    if (!distinct(fs)) return false;
    const top = Math.max(...fs.map(f => f.d)), widest = fs.filter(f => f.d === top);
    const sorted = fs.slice().sort(compare), ans = sorted[big ? fs.length - 1 : 0];
    return widest.length === 1 && widest[0] !== ans;
  });
}

function order(rng: Rng): Question {
  const set = unique(() => { const base = pick(rng, BASES); return [onBase(rng, base), onBase(rng, base), onBase(rng, base)]; },
    fs => distinct(fs) && new Set(fs.map(f => f.d)).size >= 2);
  const sorted = set.slice().sort(compare).map(lab), shown = shuffle(rng, sorted);
  return { prompt: 'Smallest to largest!', say: `Slice the fractions from smallest to largest: ${shown.map(s => ks2Say(s)).join(', ')}`,
    answer: sorted.join(' '), sequence: sorted, options: shown, visual: { type: 'word', text: shown.join('  ') }, hint: 'Slice the smallest fraction first', hintIsData: false };
}

export const y5FracCompare: Generator = (level: Difficulty, rng) => {
  if (level === 3) return order(rng);
  if (level === 1) return ask(pair(rng), rng() < 0.5, rng, 'Same bottom? The bigger top is bigger');
  const big = rng() < 0.5;
  return ask(crowd(rng, big), big, rng, 'Do not trust the biggest bottom number');
};
