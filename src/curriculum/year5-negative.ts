// y5-negative (#1180): negative numbers in context and counting through zero (5M3). Every answer is a whole number from
// −30 to 30, written with `fmt()` so the minus is U+2212. d1 a number line crossing zero with a lettered marker, and
// counting back or on through zero; d2 a temperature change and "how many degrees warmer"; d3 a sequence counted through
// zero in steps of 2, 5, 10 or 25, and "which is the coldest?". Decoys are the slips a child makes: the sign flipped, zero
// counted as a step (or skipped), the wrong direction, and the magnitudes subtracted.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt } from './ks2num';

export const NEG_MIN = -30, NEG_MAX = 30;
const f = (n: number) => fmt(dec(n, 0));
const word = (n: number) => (n < 0 ? `minus ${-n}` : `${n}`);
const ok = (v: number) => v >= NEG_MIN && v <= NEG_MAX;

/** Three decoys: the named misconceptions first, then a one-to-three-step fill; a big answer whose last digit no decoy shares swaps its last decoy for answer ± 10 (#1058). */
function finish(rng: Rng, prompt: string, answer: number, named: number[], extra: Partial<Omit<Question, 'hint' | 'hintIsData'>> = {}): Question {
  const pool: number[] = [];
  for (const v of [...named, ...shuffle(rng, [1, -1, 2, -2, 3, -3].map(k => answer + k))]) if (v !== answer && ok(v) && !pool.includes(v) && pool.length < 3) pool.push(v);
  const last = (n: number) => Math.abs(n) % 10;
  if (Math.abs(answer) >= 20 && !pool.some(v => last(v) === last(answer))) {
    const ten = [answer + 10, answer - 10].find(v => ok(v) && !pool.includes(v));
    if (ten !== undefined) pool[pool.length - 1] = ten;
  }
  return wordQ(rng, prompt, f(answer), pool.map(f), extra);
}

/** A number line of 5 or 6 ticks, in steps of 1, 2 or 5, that crosses zero; marker A on an inner tick. */
function line(rng: Rng): Question {
  const step = pick(rng, [1, 2, 5]), count = pick(rng, [5, 6]), k = ri(rng, 1, count - 2), from = -k * step;
  const ticks = Array.from({ length: count }, (_, i) => from + i * step), at = ticks[ri(rng, 1, count - 2)];
  const visual = { type: 'numberline' as const, from, to: ticks[count - 1], step, labels: ticks.map(f), marks: [{ label: 'A', at }] };
  return finish(rng, 'What number is at A?', at, [-at, at + step, at - step], { visual, say: 'What number is at A?' });
}

/** Count back from a start, or on from a negative start, so the move crosses zero. */
function count(rng: Rng): Question {
  if (rng() < 0.5) {
    const start = ri(rng, 1, 9), n = start + ri(rng, 1, 8), answer = start - n;
    return finish(rng, `Start at ${start} and count back ${n}. Where do you land?`, answer, [-answer, answer - 1, start + n],
      { say: `Start at ${start} and count back ${n}. Where do you land?` });
  }
  const start = -ri(rng, 1, 9), n = -start + ri(rng, 1, 8), answer = start + n;
  return finish(rng, `Start at ${f(start)} and count on ${n}. Where do you land?`, answer, [-answer, answer + 1, start - n],
    { say: `Start at ${word(start)} and count on ${n}. Where do you land?` });
}

function change(rng: Rng): Question {
  const warmer = rng() < 0.5, start = warmer ? -ri(rng, 1, 15) : ri(rng, 1, 15), by = ri(rng, 2, 18);
  const answer = warmer ? start + by : start - by;
  if (!ok(answer)) return change(rng);
  const dir = warmer ? 1 : -1, crosses = Math.sign(start) !== Math.sign(answer) && answer !== 0;
  const named = [-answer, warmer ? start - by : start + by, crosses ? answer + dir : answer - dir, Math.abs(by) - Math.abs(start)];
  const way = warmer ? 'warmer' : 'colder';
  return finish(rng, `It is ${f(start)} °C. It gets ${by} degrees ${way}. What is the temperature now?`, answer, named,
    { say: `It is ${word(start)} degrees. It gets ${by} degrees ${way}. What is the temperature now?` });
}

function gap(rng: Rng): Question {
  const high = ri(rng, 1, 15), low = -ri(rng, 1, 15), answer = high - low;
  return finish(rng, `How many degrees warmer is ${high} °C than ${f(low)} °C?`, answer, [high - Math.abs(low), -answer, answer + 1, answer - 1],
    { say: `How many degrees warmer is ${high} degrees than ${word(low)} degrees?` });
}

/** Three terms counted down (or up) in one step, the next term on the other side of zero. */
function sequence(rng: Rng): Question {
  const down = rng() < 0.5, step = pick(rng, [2, 5, 10, 25]), answer = down ? -ri(rng, 1, 30) : ri(rng, 1, 30);
  if (down ? answer + 3 * step <= 0 : answer - 3 * step >= 0) return sequence(rng);
  const dir = down ? 1 : -1, shown = [3, 2, 1].map(k => answer + dir * k * step);
  return finish(rng, `${shown.map(f).join(', ')}, … what comes next?`, answer, [-answer, answer - dir, answer + 2 * dir * step, answer + dir],
    { say: `${shown.map(word).join(', ')}, … what comes next?` });
}

function coldest(rng: Rng): Question {
  const vals = new Set<number>();
  while (vals.size < 4) vals.add(vals.size < 2 ? -ri(rng, 1, 19) : ri(rng, -19, 19));
  const all = [...vals], answer = Math.min(...all);
  return wordQ(rng, 'Which temperature is the coldest?', f(answer), all.filter(v => v !== answer).map(f), { say: 'Which temperature is the coldest? Minus numbers are below zero.' });
}

export const y5Negative: Generator = (d: Difficulty, rng): Question => {
  if (d === 1) return pick(rng, [line, line, count])(rng);
  if (d === 2) return pick(rng, [change, change, gap])(rng);
  return pick(rng, [sequence, sequence, coldest])(rng);
};
