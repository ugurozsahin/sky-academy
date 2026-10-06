// y4-negative (#1132): count back through 0. d1 reads a hidden tick on a number line that crosses 0; d2 counts back in
// 1s/2s/5s/10s from a positive start to the first negative; d3 counts back further or finds a missing term. Every
// minus sign is U+2212 (`fmt`) and `say` reads "negative 5": `numQ` and `symSay` would write "-" and "minus".
import type { Difficulty, Generator, Question } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt } from './ks2num';

const MIN = -50;
const f = (n: number) => fmt(dec(n, 0));
const said = (n: number) => n < 0 ? `negative ${-n}` : String(n);

/** Misconception decoys first: the sign flip (5 for −5), a step either side, the zero-counting slip (+1); distinct, in range. */
function decoys(answer: number, step: number, rng: () => number): number[] {
  const ok = (v: number) => v !== answer && v >= MIN && v <= 50;
  const first = answer !== 0 && ok(-answer) ? [-answer] : [];
  const rest = shuffle(rng, [answer + step, answer - step, answer + 1, answer - 1].filter(ok));
  const pool = new Set<number>([...first, ...rest]);
  while (pool.size < 3) { const v = answer + ri(rng, -2 * step - 2, 2 * step + 2); if (ok(v)) pool.add(v); }
  return [...pool].slice(0, 3);
}

function card(rng: () => number, prompt: string, say: string, answer: number, step: number, visual?: Question['visual']): Question {
  return wordQ(rng, prompt, f(answer), decoys(answer, step, rng).map(f), { say, visual });
}

/** d1: six ticks, step 1, holding 0 and at least two negatives; one tick is hidden. */
function line(rng: () => number): Question {
  const from = ri(rng, -5, -2), to = from + 5, mark = ri(rng, from, to);
  const labels = Array.from({ length: 6 }, (_, i) => f(from + i));
  return card(rng, 'Which number is hidden?', 'Which number is hidden on the number line?', mark, 1, { type: 'numberline', from, to, mark, step: 1, labels });
}

/** d2: count back from a multiple of the step, through 0, to the first negative: "15, 10, 5, 0, ?". */
function countBack(rng: () => number): Question {
  const step = pick(rng, [1, 2, 5, 10] as const), m = ri(rng, 2, 4);
  const terms = Array.from({ length: m + 1 }, (_, i) => step * (m - i));
  const answer = -step, shown = terms.map(f).join(', ');
  return card(rng, `Count back in ${step}s: ${shown}, ?`, `Count back in ${step}s. ${terms.join(', ')}, then what?`, answer, step);
}

/** d3: "Start at 6. Count back 10 in 1s", landing below 0. */
function story(rng: () => number): Question {
  const step = pick(rng, [1, 2, 5, 10] as const), start = ri(rng, 3, 9);
  let k = Math.floor(start / step) + 1 + ri(rng, 0, 3);
  while (start - k * step < MIN) k--;
  const answer = start - k * step;
  return card(rng, `Start at ${start}. Count back ${k} in ${step}s. Where do you land?`, `Start at ${start}. Count back ${k} in ${step}s. Where do you land?`, answer, step);
}

/** d3: a count that crosses 0 with a negative term missing: "10, 5, 0, ?, −10". */
function missing(rng: () => number): Question {
  const step = pick(rng, [1, 2, 5, 10] as const), m = ri(rng, 2, 3);
  const terms = Array.from({ length: m + 3 }, (_, i) => step * (m - i));
  const gap = ri(rng, m + 1, m + 2), answer = terms[gap];
  const shown = terms.map((t, i) => i === gap ? '?' : f(t)).join(', ');
  const spoken = terms.map((t, i) => i === gap ? 'what' : said(t)).join(', ');
  return card(rng, shown, `Count back in ${step}s. ${spoken}.`, answer, step);
}

export const y4Negative: Generator = (d: Difficulty, rng) => d === 1 ? line(rng) : d === 2 ? countBack(rng) : rng() < 0.5 ? story(rng) : missing(rng);
