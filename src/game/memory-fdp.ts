// Fractions, decimals, % (Years 5–6, #1238): pairs two forms of one amount. Pure, no DOM — `memory.ts` deals it.
import type { Rng } from '../curriculum';
import type { Face, Pair } from './memory';
import { fmtFrac, toDecimal, type Frac } from '../curriculum/fractions';
import { fmt } from '../curriculum/ks2num';
import { ks2Say } from '../curriculum/ks2say';
import { numberWord, pick, shuffle } from '../curriculum/util';

/** 5M33 / 6M24 values, each in simplest form. No two are equal, so no board holds a third face of one amount (#372, #476). */
export const FDP_BANK: readonly Frac[] = [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [3, 10], [7, 10], [9, 10], [1, 20], [1, 25], [1, 100]].map(([n, d]) => ({ n, d }));
type Form = 'frac' | 'dec' | 'pct';
const FORM_PAIRS: readonly (readonly [Form, Form])[] = [['frac', 'dec'], ['frac', 'pct'], ['dec', 'pct']];

const face = (f: Frac, form: Form): Face => {
  if (form === 'frac') { const text = fmtFrac(f); return { text, say: ks2Say(text) }; }
  const dec = toDecimal(f)!;   // every bank value terminates within 3 places
  if (form === 'dec') { const text = fmt(dec); return { text, say: ks2Say(text) }; }
  const pct = f.n * 100 / f.d;
  return { text: `${pct}%`, say: `${numberWord(pct)} per cent` };
};

export const fdpPairs = (rng: Rng): Pair[] => shuffle(rng, FDP_BANK).slice(0, 6).map(f => {
  const [x, y] = pick(rng, FORM_PAIRS);
  const flip = rng() < 0.5;
  return { a: face(f, flip ? y : x), b: face(f, flip ? x : y) };
});
