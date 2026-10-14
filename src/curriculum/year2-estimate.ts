// Year 2: estimate a number on a number line (#1004). A new module, not year2.ts or util.ts, which are on the #714
// ratchet. The line prints only its two ends (`ends`), so the answer is estimated from where the `?` sits.
import type { Generator, Rng } from './types';
import { ri, shuffle, numQ } from './util';

/** `count` values from 1..9 (units of `unit`), each at least `gap` from `answer` and from each other. */
function decoys(rng: Rng, answer: number, count: number, gap: number): number[] {
  const far = shuffle(rng, Array.from({ length: 9 }, (_, i) => i + 1).filter(k => Math.abs(k - answer) >= gap));
  const grow = (chosen: number[], from: number): number[] | null => {
    if (chosen.length === count) return chosen;
    for (let i = from; i < far.length; i++) {
      if (chosen.every(c => Math.abs(c - far[i]) >= gap)) { const r = grow([...chosen, far[i]], i + 1); if (r) return r; }
    }
    return null;
  };
  return grow([], 0) ?? [];
}

export const y2Estimate: Generator = (d, rng) => {
  const unit = d === 1 ? 1 : 10, to = unit * 10, gap = d === 1 ? 3 : d === 2 ? 3 : 2, count = d === 3 ? 3 : 2;
  const k = ri(rng, 1, 9), mark = k * unit;
  const ds = decoys(rng, k, count, gap).map(x => x * unit);
  return numQ(rng, 'Which number is about here?', mark, {
    min: 0, max: to, n: count, distractors: ds,
    visual: { type: 'numberline', from: 0, to, step: unit, mark, ends: true },
    say: `The line goes from 0 to ${to}. Which number is at the question mark?`,
    hint: 'Slice the number at the ?', hintIsData: false,
  });
};
