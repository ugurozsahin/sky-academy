// Year 3: estimate a number on a 0-1,000 number line (#1082). Its own module: year3-number.ts is near its 300-line cap.
// Never imports year2-estimate.ts (a year file does not import another year's), so the gap search is copied.
import type { Generator, Rng } from './types';
import { ri, shuffle } from './util';
import { dec, fmt } from './ks2num';

const fmtN = (n: number) => fmt(dec(n, 0));

/** `count` multiples of `unit` strictly inside `lo..hi`, each at least `gap` from `answer` and from each other. */
function decoys(rng: Rng, answer: number, count: number, gap: number, lo: number, hi: number, unit: number): number[] {
  const all = Array.from({ length: (hi - lo) / unit - 1 }, (_, i) => lo + (i + 1) * unit);
  const far = shuffle(rng, all.filter(v => Math.abs(v - answer) >= gap));
  const grow = (chosen: number[], from: number): number[] | null => {
    if (chosen.length === count) return chosen;
    for (let i = from; i < far.length; i++) {
      if (chosen.every(c => Math.abs(c - far[i]) >= gap)) { const r = grow([...chosen, far[i]], i + 1); if (r) return r; }
    }
    return null;
  };
  return grow([], 0) ?? [];
}

export const y3Line: Generator = (d, rng) => {
  const stretch = d === 3, unit = stretch ? 10 : 100, from = stretch ? 100 * ri(rng, 1, 9) : 0, to = from + (stretch ? 100 : 1000);
  const gap = d === 1 ? 300 : 200, count = d === 1 ? 2 : 3, gapUse = stretch ? 20 : gap;
  const mark = from + unit * ri(rng, 1, 9);
  const ds = decoys(rng, mark, count, gapUse, from, to, unit);
  const labels = Array.from({ length: 11 }, (_, i) => fmtN(from + i * unit));
  const options = shuffle(rng, [mark, ...ds]).map(fmtN);
  return {
    prompt: 'Which number is about here?', answer: fmtN(mark), options,
    visual: { type: 'numberline', from, to, step: unit, mark, ends: true, labels },
    say: `The line goes from ${fmtN(from)} to ${fmtN(to)}. Which number is at the question mark?`,
    hint: 'Slice the number at the ?', hintIsData: false,
  };
};
