// y3-fracof (#1092): unit and non-unit fractions of amounts, whole-number answers only. d1 unit fractions of
// 4–20 stars (the topic's one `objects` visual, #1041's exception), d2 any small denominator of up to 60,
// d3 the whole from a part, or a non-unit fraction of up to 80.
import type { Difficulty, Generator, Question } from './types';
import { ri, pick, shuffle, q } from './util';
import { ks2Say } from './ks2say';

const lead = (n: number) => String(n)[0];
/** Decoys for `answer`, in priority order: `named` slips first, then (for in-scope answers, #1058) one sharing the units digit and one the leading digit, then fillers. */
function decoys(answer: number, named: number[], need: number, bar?: number): number[] {
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v !== answer && v !== bar;
  const near = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6].map(k => answer + k);
  const guard = answer >= 20
    ? [[10, -10, 20, -20].map(k => answer + k).find(ok), near.find(v => ok(v) && lead(v) === lead(answer))]
    : [];
  const out: number[] = [];
  for (const v of [...named.slice(0, 1), ...guard, ...named, ...near]) if (v !== undefined && ok(v) && !out.includes(v)) out.push(v);
  return out.slice(0, need);
}

export const y3FracOf: Generator = (d: Difficulty, rng): Question => {
  const say = (t: string) => ks2Say(t);
  if (d === 3 && rng() < 0.5) {
    const den = pick(rng, [2, 3, 4, 5, 6, 8, 10]);
    const part = ri(rng, 2, Math.floor(80 / den));
    const whole = part * den;
    const ds = decoys(whole, [part + den, part * (den - 1)], 3);
    const text = `1/${den} of a number is ${part}. What is the number`;
    return { ...q(`1/${den} of a number is ${part}. What is the number?`), say: say(text), answer: String(whole), options: shuffle(rng, [whole, ...ds].map(String)), slow: true };
  }
  const dens = d === 1 ? [2, 3, 4, 5] : [2, 3, 4, 5, 6, 8, 10];
  const den = pick(rng, dens);
  const num = d === 1 || rng() < 0.4 ? 1 : ri(rng, 2, den - 1);
  const max = d === 1 ? 12 : d === 2 ? 60 : 80;
  const k = d === 1 ? ri(rng, Math.ceil(4 / den), Math.floor(max / den)) : ri(rng, 2, Math.floor(max / den));
  const whole = k * den, answer = k * num;
  const named = [...(num > 1 ? [k] : []), ...(whole % num === 0 ? [whole / num] : []), whole];
  const ds = decoys(answer, named.filter(v => v !== answer), 3);
  const card: Question = { ...q(`${num}/${den} of ${whole} = ?`), say: say(`What is ${num}/${den} of ${whole}`), answer: String(answer), options: shuffle(rng, [answer, ...ds].map(String)) };
  const withVisual = d === 1 ? { ...card, visual: { type: 'objects' as const, emoji: '⭐', n: whole } } : card;
  return d === 3 ? { ...withVisual, slow: true } : withVisual;
};
