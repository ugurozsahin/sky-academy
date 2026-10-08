// y5-mentalmd (#1189): multiply and divide in your head from a known table fact (5M15), pick the answer. d1 a 1-digit number ×
// a multiple of 10 or 100 (6 × 700) and its inverse (4,200 ÷ 6); d2 multiple × multiple (70 × 800) and multiple ÷ multiple
// (3,600 ÷ 90); d3 "use a given fact" (23 × 4 = 92, so 230 × 40), doubling and halving (35 × 4) and missing numbers (? × 60 = 4,800).
// Every answer is a whole number of 20 or more. Decoys: the place-value shift (always first), the neighbouring table fact
// scaled the same way, and the wrong operation on a missing-number card; ±10 fills keep a last-digit and leading-digit twin.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ, q } from './util';
import { dec, fmt } from './ks2num';
import { keepTwins } from './year5-column';

const MAX = 1000000;
const f = (n: number) => fmt(dec(n, 0));

/** The place-value shift first (one zero too many, or too few when that would pass a million), then the named slips, then fills. */
function decoys(answer: number, near: number[], rng: Rng): number[] {
  const ok = (v: number) => Number.isInteger(v) && v > 0 && v < MAX && v !== answer;
  const shift = answer * 10 < MAX ? answer * 10 : answer / 10;
  const out: number[] = [];
  for (const v of [shift, ...shuffle(rng, near)]) if (out.length < 3 && ok(v) && !out.includes(v)) out.push(v);
  const fills = shuffle(rng, [10, 100, 1000].flatMap(m => [answer + m, answer - m])).filter(ok);
  for (const v of fills) if (out.length < 3 && !out.includes(v)) out.push(v);
  keepTwins(out, fills, answer, 1);
  return out;
}

const card = (rng: Rng, prompt: string, answer: number, near: number[], say = q(prompt).say): Question =>
  wordQ(rng, prompt, f(answer), decoys(answer, near, rng).map(f), { say });

/** `a × b` or `b × a`, so the multiple is not always second. */
const times = (rng: Rng, a: number, b: number) => rng() < 0.5 ? `${f(a)} × ${f(b)} = ?` : `${f(b)} × ${f(a)} = ?`;

/** A table fact a × b with both factors 2–9 and the scale (a power of 10) it is multiplied up by. */
function fact(rng: Rng) { return { a: ri(rng, 2, 9), b: ri(rng, 2, 9) }; }

function d1(rng: Rng): Question {
  const { a, b } = fact(rng), s = 10 ** ri(rng, 1, 2), p = a * b;
  if (rng() < 0.5) return card(rng, times(rng, a, b * s), p * s, [(p + a) * s, (p - a) * s, (p + b) * s, (p - b) * s]);
  return card(rng, `${f(p * s)} ÷ ${a} = ?`, b * s, [(b + 1) * s, (b - 1) * s]);
}

function d2(rng: Rng): Question {
  const { a, b } = fact(rng), i = ri(rng, 1, 2), j = ri(rng, 1, 2), p = a * b, s = 10 ** (i + j);
  if (rng() < 0.5) return card(rng, times(rng, a * 10 ** i, b * 10 ** j), p * s, [(p + a) * s, (p - a) * s, (p + b) * s, (p - b) * s]);
  return card(rng, `${f(p * s)} ÷ ${f(a * 10 ** i)} = ?`, b * 10 ** j, [(b + 1) * 10 ** j, (b - 1) * 10 ** j]);
}

/** d3 "use a given fact": x × y = P, then the same fact scaled up, as a product or as the division that undoes it. */
function given(rng: Rng): Question {
  const x = ri(rng, 12, 99), y = ri(rng, 2, 9), i = ri(rng, 1, 2), j = i === 2 ? 1 : ri(rng, 1, 2), p = x * y, head = `${x} × ${y} = ${p}.`;
  const sx = x * 10 ** i, sy = y * 10 ** j, total = p * 10 ** (i + j);
  if (rng() < 0.5) {
    const prompt = `${head} What is ${f(sx)} × ${f(sy)}?`;
    return card(rng, prompt, total, [(p + x) * 10 ** (i + j), (p - y) * 10 ** (i + j)], `${prompt} Pick the answer.`);
  }
  const prompt = `${head} What is ${f(total)} ÷ ${f(sy)}?`;
  return card(rng, prompt, sx, [(x + 1) * 10 ** i, (x - 1) * 10 ** i], `${prompt} Pick the answer.`);
}

/** Double one factor and halve the other: 35 × 4 is 70 × 2. Always an odd multiple of 5 times an even number, so it ends in 0. */
function doubling(rng: Rng): Question {
  const a = pick(rng, [15, 25, 35, 45, 55, 75]), b = pick(rng, [4, 6, 8, 12, 16]), p = a * b;
  return card(rng, times(rng, a, b), p, [p / 2, p + a, p - a]);
}

/** `? × a = c`: the missing number is the multiple; the wrong operation (subtracting, or multiplying) is a named decoy. */
function missing(rng: Rng): Question {
  const { a, b } = fact(rng), i = ri(rng, 1, 2), j = ri(rng, 1, 2), c = a * b * 10 ** (i + j), m = a * 10 ** i, answer = b * 10 ** j;
  const prompt = rng() < 0.5 ? `? × ${f(m)} = ${f(c)}` : `${f(m)} × ? = ${f(c)}`;
  return card(rng, prompt, answer, [c - m, c * m < MAX ? c * m : c + m, (b + 1) * 10 ** j, (b - 1) * 10 ** j], `${prompt.replace('?', 'what')}. Pick the missing number.`);
}

export const y5MentalMd: Generator = (d: Difficulty, rng): Question =>
  d === 1 ? d1(rng) : d === 2 ? d2(rng) : pick(rng, [given, doubling, missing])(rng);
