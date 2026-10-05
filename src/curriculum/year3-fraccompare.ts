// y3-fraccompare (#1096): compare unit and same-denominator fractions with <, > and =; d3 orders three. The
// misconception ("1/5 > 1/3 because 5 > 3") is tested by the pairs themselves, so d1–d2 always offer all three signs.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle } from './util';
import { compare, type Frac } from './fractions';
import { ks2Say } from './ks2say';

const lab = (f: Frac) => `${f.n}/${f.d}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const SIGN = ['>', '=', '<'] as const;   // compare() is −1, 0, 1 when the left is smaller, equal, bigger: SIGN[1 − c] reads it
const EQUAL: [Frac, Frac][] = [[{ n: 1, d: 2 }, { n: 2, d: 4 }], [{ n: 1, d: 3 }, { n: 2, d: 6 }], [{ n: 1, d: 2 }, { n: 3, d: 6 }], [{ n: 1, d: 4 }, { n: 2, d: 8 }], [{ n: 1, d: 5 }, { n: 2, d: 10 }]];

function sign(a: Frac, b: Frac, rng: Rng): Question {
  const ans = SIGN[1 - compare(a, b)];
  return { prompt: `${lab(a)} ? ${lab(b)}`, say: `${cap(ks2Say(lab(a)))} compared with ${ks2Say(lab(b))}. Less than, greater than, or equal?`,
    answer: ans, options: shuffle(rng, ['<', '>', '=']), hint: 'Slice the right sign', hintIsData: false };
}

/** d3: three fractions, smallest to biggest — unit fractions on different bottoms, or one bottom with different tops.
 *  Bottoms stop at 9: the answer joins labels with `,`, and the number-label rail reads `10,1` as a badly grouped number. */
function order(rng: Rng): Question {
  const set: Frac[] = [];
  if (rng() < 0.5) { const bottoms = shuffle(rng, [2, 3, 4, 5, 6, 8, 9]).slice(0, 3); for (const d of bottoms) set.push({ n: 1, d }); }
  else { const d = ri(rng, 4, 9), tops = shuffle(rng, Array.from({ length: d - 1 }, (_, i) => i + 1)).slice(0, 3); for (const n of tops) set.push({ n, d }); }
  const sorted = set.slice().sort(compare).map(lab), shown = shuffle(rng, sorted);
  return { prompt: 'Smallest to biggest!', say: `Slice the fractions from smallest to biggest: ${shown.map(s => ks2Say(s)).join(', ')}`,
    answer: sorted.join(','), sequence: sorted, options: shown, visual: { type: 'word', text: shown.join('  ') }, hint: 'Slice the smallest fraction first', hintIsData: false };
}

export const y3FracCompare: Generator = (level: Difficulty, rng) => {
  if (level === 3) return order(rng);
  const unit = () => { const a = ri(rng, 2, 10); let b = ri(rng, 2, 10); while (b === a) b = ri(rng, 2, 10); return [{ n: 1, d: a }, { n: 1, d: b }]; };
  if (level === 1) { const [a, b] = unit(); return sign(a, b, rng); }
  if (rng() < 0.15) { const [a, b] = pick(rng, EQUAL); return rng() < 0.5 ? sign(a, b, rng) : sign(b, a, rng); }
  if (rng() < 0.5) { const [a, b] = unit(); return sign(a, b, rng); }
  const d = ri(rng, 3, 10), x = ri(rng, 1, d - 1); let y = ri(rng, 1, d - 1); while (y === x) y = ri(rng, 1, d - 1);
  return sign({ n: x, d }, { n: y, d }, rng);
};
