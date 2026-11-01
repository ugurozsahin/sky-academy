import type { Generator } from './types';
import { ri, shuffle, numQ, wordQ, OBJECTS } from './util';

/** #985 form B: which of 3 (d2) or 4 (d3) distinct numbers ≤ 20 is the most or the least. */
const mostLeast = (d: number, rng: () => number) => {
  const most = rng() < 0.5;
  const set = new Set<number>();
  while (set.size < (d === 3 ? 4 : 3)) set.add(ri(rng, 0, 20));
  const nums = [...set], ans = most ? Math.max(...nums) : Math.min(...nums);
  const word = most ? 'most' : 'least';
  return numQ(rng, `Which number is the ${word}?`, ans, { min: 0, max: 20, n: nums.length - 1, say: `Which number is the ${word}?`, distractors: nums.filter(x => x !== ans) });
};

/** #985 form A: two groups of 1–10 — "more", "fewer" (never when equal) or "equal". */
const groups = (d: number, rng: () => number) => {
  const [e1, e2] = shuffle(rng, OBJECTS);
  const equal = rng() < 1 / 3;
  const a = ri(rng, 1, 10);
  let b = a;
  // #2320: groups a child has to count, not two heaps far apart — never more than 3 apart at d1, 2 beyond.
  const reach = d === 1 ? 3 : 2;
  while (!equal && (b === a || Math.abs(b - a) > reach)) b = ri(rng, Math.max(1, a - reach), Math.min(10, a + reach));
  const fewer = !equal && rng() < 0.5;
  const prompt = fewer ? 'Which group has fewer?' : `Are there more ${e1} or more ${e2}, or are they equal?`;
  const ans = a === b ? 'equal' : (a < b) === fewer ? e1 : e2;
  return wordQ(rng, prompt, ans, [e1, e2, 'equal'], {
    say: fewer ? 'Which group has fewer?' : 'Are there more in the first group or the second group, or are they equal?',
    visual: { type: 'objects', emoji: e1, n: a, emoji2: e2, n2: b },
  });
};

/** #985: the Year 1 comparison words — d1 groups only, d2/d3 half groups, half most/least. */
export const y1Compare: Generator = (d, rng) => (d >= 2 && rng() < 0.5 ? mostLeast(d, rng) : groups(d, rng));
