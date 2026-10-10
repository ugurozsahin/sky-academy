// y6-negative (#1253): negative numbers in context and intervals across zero (6M3). Every answer is a whole number from
// −30 to 30, written with `fmt()` so the minus is U+2212. d1 the interval between a temperature below zero and one above;
// d2 a sum that crosses zero (4 − 9, −6 + 10, −3 − 5); d3 a short story from a small template bank (temperature, lift,
// submarine, freezer). Decoys are the slips a child makes: the sign flipped, the operation applied to the magnitudes,
// the ends subtracted ignoring the sign, and one out when counting marks instead of steps.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt } from './ks2num';

const f = (n: number) => fmt(dec(n, 0));
const word = (n: number) => (n < 0 ? `negative ${-n}` : `${n}`);

/** Three decoys: the named slips first (kept when in `lo`..`hi`), then a one-to-three-step fill; a big answer whose last digit no decoy shares swaps its last decoy for answer ± 10 (#1058). */
function finish(rng: Rng, prompt: string, answer: number, named: number[], say: string, lo = -30, hi = 30): Question {
  const ok = (v: number) => v >= lo && v <= hi;
  const pool: number[] = [];
  for (const v of [...named, ...shuffle(rng, [1, -1, 2, -2, 3, -3].map(k => answer + k))]) if (v !== answer && ok(v) && !pool.includes(v) && pool.length < 3) pool.push(v);
  const last = (n: number) => Math.abs(n) % 10;
  if (Math.abs(answer) >= 20 && !pool.some(v => last(v) === last(answer))) {
    const ten = [answer + 10, answer - 10].find(v => ok(v) && !pool.includes(v));
    if (ten !== undefined) pool[pool.length - 1] = ten;
  }
  return wordQ(rng, prompt, f(answer), pool.map(f), { say });
}

/** One story template: `make` builds the card text from a start value and a size; `pickArgs` draws arguments whose answer crosses zero. */
export interface Story { readonly id: string; readonly make: (s: number, c: number) => { prompt: string; say: string; answer: number }; readonly pickArgs: (rng: Rng) => [number, number] }

export const STORIES: readonly Story[] = [
  { id: 'fall', pickArgs: rng => { const s = ri(rng, 2, 15); return [s, s + ri(rng, 1, 12)]; },
    make: (s, c) => ({ answer: s - c, prompt: `It is ${s} °C. It falls ${c} degrees. What is the temperature now?`,
      say: `It is ${s} degrees. It falls ${c} degrees. What is the temperature now?` }) },
  { id: 'rise', pickArgs: rng => { const s = -ri(rng, 2, 15); return [s, -s + ri(rng, 1, 12)]; },
    make: (s, c) => ({ answer: s + c, prompt: `It is ${f(s)} °C. It rises ${c} degrees. What is the temperature now?`,
      say: `It is ${word(s)} degrees. It rises ${c} degrees. What is the temperature now?` }) },
  { id: 'lift-down', pickArgs: rng => { const s = ri(rng, 1, 8); return [s, s + ri(rng, 1, 8)]; },
    make: (s, c) => ({ answer: s - c, prompt: `A lift is at floor ${s}. It goes down ${c} floors. Which floor now?`,
      say: `A lift is at floor ${s}. It goes down ${c} floors. Which floor is it at now? Below the ground is a minus number.` }) },
  { id: 'lift-up', pickArgs: rng => { const s = -ri(rng, 1, 6); return [s, -s + ri(rng, 1, 8)]; },
    make: (s, c) => ({ answer: s + c, prompt: `A lift is at floor ${f(s)}. It goes up ${c} floors. Which floor now?`,
      say: `A lift is at floor ${word(s)}, below the ground. It goes up ${c} floors. Which floor is it at now?` }) },
  { id: 'submarine', pickArgs: rng => { const s = -ri(rng, 5, 25); return [s, -s + ri(rng, 1, 5)]; },
    make: (s, c) => ({ answer: s + c, prompt: `A submarine is at ${f(s)} m. It rises ${c} m. What height now?`,
      say: `A submarine is at ${word(s)} metres, below sea level. It rises ${c} metres. What height is it at now?` }) },
  { id: 'freezer', pickArgs: rng => [-ri(rng, 2, 15), ri(rng, 1, 15)],
    make: (s, r) => ({ answer: r - s, prompt: `Freezer: ${f(s)} °C. Room: ${r} °C. How many degrees warmer is the room?`,
      say: `A freezer is at ${word(s)} degrees. The room is ${r} degrees. How many degrees warmer is the room?` }) },
];

/** d1: the interval from a temperature below zero to one above it. */
function interval(rng: Rng): Question {
  const a = -ri(rng, 1, 10), b = ri(rng, 1, 10), answer = b - a;
  return finish(rng, `How many degrees from ${f(a)} °C to ${b} °C?`, answer, [Math.abs(b - Math.abs(a)), answer + 1, answer - 1].filter(v => v >= 1),
    `How many degrees from ${word(a)} degrees to ${b} degrees?`, 1, 30);
}

/** d2: a sum that crosses zero, or goes further below it, with both ends within −20..20. */
function sum(rng: Rng): Question {
  const kind = pick(rng, [0, 1, 2]);
  let a: number, b: number, op: '+' | '−';
  if (kind === 0) { a = ri(rng, 1, 12); b = a + ri(rng, 1, 8); op = '−'; }
  else if (kind === 1) { a = -ri(rng, 1, 10); b = -a + ri(rng, 1, 10); op = '+'; }
  else { a = -ri(rng, 1, 10); b = ri(rng, 1, 10); op = '−'; }
  const answer = op === '+' ? a + b : a - b;
  const mag = kind === 0 ? a + b : kind === 1 ? Math.abs(a) + b : Math.abs(a) - b;   // the operation applied to the magnitudes
  const named = [-answer, mag, answer + 1, answer - 1];
  return finish(rng, `${f(a)} ${op} ${b} = ?`, answer, named, `${word(a)} ${op === '+' ? 'plus' : 'minus'} ${b} equals what?`, -20, 20);
}

function story(rng: Rng): Question {
  const t = pick(rng, STORIES), [s, c] = t.pickArgs(rng), m = t.make(s, c);
  const named = [-m.answer, m.answer + 1, m.answer - 1];
  if (t.id === 'freezer') named.splice(1, 0, Math.abs(c - Math.abs(s)));   // the ends subtracted ignoring the sign
  return finish(rng, m.prompt, m.answer, named, m.say);
}

export const y6Negative: Generator = (d: Difficulty, rng): Question => {
  if (d === 1) return interval(rng);
  if (d === 2) return sum(rng);
  return story(rng);
};
