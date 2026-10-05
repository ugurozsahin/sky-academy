// y3-fracline (#1093): fractions as numbers on a line. Ticks are whole steps of one denominator (tick k is k/den), so
// the `numberline` visual draws them with integer ticks and written labels — no float ticks. d1: read the hidden tick
// on a 0–1 line; d2: which lettered mark is at a fraction; d3: a 6-tick line that crosses 1, never a mixed number.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, shuffle } from './util';
import { equal, type Frac } from './fractions';
import { ks2Say } from './ks2say';

const NAME: Record<number, string> = { 2: 'halves', 3: 'thirds', 4: 'quarters', 5: 'fifths' };
const lab = (n: number, d: number) => `${n}/${d}`;
/** A tick's written label: whole numbers are written 1 and 2, every other tick as a fraction. */
const tick = (k: number, d: number) => (k === 0 ? '0' : k === d ? '1' : k === 2 * d ? '2' : lab(k, d));

/** Three decoys, none worth the answer or each other: the neighbouring ticks, ticks counted instead of gaps, top and bottom swapped. */
function decoys(t: number, d: number, rng: Rng): string[] {
  const ans: Frac = { n: t, d }, out: Frac[] = [];
  const pool: Frac[] = [{ n: t + 1, d }, { n: t - 1, d }, { n: t, d: d + 1 }, { n: d, d: t }, { n: t + 2, d }, { n: t - 2, d }];
  for (let i = 0; i < 6; i++) pool.push({ n: ri(rng, 1, 2 * d), d });
  for (const f of pool) if (f.n >= 1 && f.d >= 2 && !equal(f, ans) && !out.some(o => equal(o, f))) out.push(f);
  return out.slice(0, 3).map(f => lab(f.n, f.d));
}

function read(d: Difficulty, rng: Rng): Question {
  const den = d === 1 ? ri(rng, 2, 5) : ri(rng, 4, 5);
  let s = 0, t: number;
  if (d === 1) t = ri(rng, 1, den - 1);
  else { s = ri(rng, Math.max(1, den - 4), Math.min(den - 1, 2 * den - 5)); do t = ri(rng, s, s + 5); while (t === den || t === 2 * den); }
  const to = d === 1 ? den : s + 5, labels: string[] = [];
  for (let k = s; k <= to; k++) labels.push(k === t ? '?' : tick(k, den));
  const where = d === 1 ? `from zero to one in ${NAME[den]}` : `in ${NAME[den]}, past one`;
  const answer = lab(t, den), ds = decoys(t, den, rng);
  return {
    prompt: 'Which fraction is at the question mark?', say: `The line goes ${where}. Which fraction is at the question mark?`, answer,
    options: shuffle(rng, [answer, ...ds]), visual: { type: 'numberline', from: s, to, step: 1, mark: t, labels },
    hint: 'Slice the fraction at the ?', hintIsData: false,
  };
}

/** d2: four lettered marks on a 0–1 line, one of them at the asked fraction. */
function lettered(rng: Rng): Question {
  const den = ri(rng, 3, 5), k = ri(rng, 1, den - 1);
  const rest = shuffle(rng, Array.from({ length: den + 1 }, (_, i) => i).filter(i => i !== k)).slice(0, 3);
  const spots = shuffle(rng, [k, ...rest]), letters = ['A', 'B', 'C', 'D'];
  const marks = spots.map((at, i) => ({ label: letters[i], at }));
  const answer = letters[spots.indexOf(k)], f = ks2Say(lab(k, den));
  return {
    prompt: `Which letter is at ${lab(k, den)}?`, say: `The line goes from zero to one in ${NAME[den]}. Which letter is at ${f}?`, answer,
    options: letters, visual: { type: 'numberline', from: 0, to: den, step: 1, labels: Array.from({ length: den + 1 }, (_, i) => tick(i, den)), marks },
    hint: 'Slice the letter', hintIsData: false,
  };
}

export const y3FracLine: Generator = (d: Difficulty, rng) => (d === 2 ? lettered(rng) : read(d, rng));
