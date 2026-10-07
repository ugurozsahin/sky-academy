// y4-convert (#1150): convert between units of measure. Every value is a count of tenths (`dec(t, 1)`) written by `fmt`,
// so no float reaches a card or a bubble. d1 goes from the larger unit to the smaller (5 km = ? m); d2 goes both ways with
// whole-number answers; d3 adds decimals (2.5 km), compound values (3 m 40 cm) and one-sentence time problems.
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, ri, shuffle, wordQ } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';

/** One conversion: `big` = `factor` × `small`. Metric units keep their symbols on the card; time units are words. */
interface Row { readonly big: string; readonly small: string; readonly factor: number; readonly time: boolean; readonly max: number }
const ROWS: readonly Row[] = [
  { big: 'km', small: 'm', factor: 1000, time: false, max: 20 }, { big: 'm', small: 'cm', factor: 100, time: false, max: 20 },
  { big: 'cm', small: 'mm', factor: 10, time: false, max: 20 }, { big: 'kg', small: 'g', factor: 1000, time: false, max: 20 },
  { big: 'l', small: 'ml', factor: 1000, time: false, max: 20 }, { big: 'hours', small: 'minutes', factor: 60, time: true, max: 12 },
  { big: 'minutes', small: 'seconds', factor: 60, time: true, max: 12 }, { big: 'years', small: 'months', factor: 12, time: true, max: 12 },
  { big: 'weeks', small: 'days', factor: 7, time: true, max: 12 },
];
const WORD: Record<string, string> = { km: 'kilometres', m: 'metres', cm: 'centimetres', mm: 'millimetres', kg: 'kilograms', g: 'grams', l: 'litres', ml: 'millilitres' };
const ONE: Record<string, string> = { hours: 'hour', minutes: 'minute', seconds: 'second', years: 'year', months: 'month', weeks: 'week', days: 'day' };
const MAX = 20000;

/** A unit as printed after a count of tenths: "1 hour" but "1.5 hours". */
const unitFor = (unit: string, t: number) => (t === 10 && ONE[unit] ? ONE[unit] : unit);
const num = (t: number) => fmt(dec(t, 1));
const spoken = (t: number, unit: string) => `${ks2Say(num(t))} ${t === 10 && ONE[unit] ? ONE[unit] : WORD[unit] ?? unit}`;

/** Wrong answers a child really gives, as tenths: the answer a power of ten out (the place-value slip, "3 hours = 300"), then the
 *  number unconverted. Anything not a whole count of tenths, zero, negative or above Year 4's ceiling is dropped. */
function decoys(rng: Rng, answerT: number, sourceT: number): string[] {
  const ok = (t: number) => Number.isInteger(t) && t > 0 && t <= MAX * 10 && t !== answerT;
  const shifts = [10, 100, 1000, 0.1, 0.01, 0.001].map(k => answerT * k).filter(ok);
  const out = [...new Set(shuffle(rng, [...new Set(shifts)]).slice(0, 2).concat(ok(sourceT) ? [sourceT] : [], shuffle(rng, shifts)))];
  const near = [1, -1, 10, -10, 100, -100].map(d => answerT + d);
  for (const t of near) if (out.length < 3 && ok(t) && !out.includes(t)) out.push(t);
  return out.slice(0, 3).map(num);
}

function card(rng: Rng, prompt: string, say: string, answerT: number, sourceT: number, hint: string, slow = false): Question {
  return wordQ(rng, prompt, num(answerT), decoys(rng, answerT, sourceT),
    { say, hint, hintIsData: false, ...(slow ? { slow: true } : {}) });
}

/** "5 km = ? m" — the bare count is the answer; both units sit on the card, one in words when it is a time. */
function plain(rng: Rng, row: Row, down: boolean, t: number, slow = false): Question {
  const [from, to] = down ? [row.big, row.small] : [row.small, row.big];
  const a = down ? t * row.factor : t / row.factor;
  return card(rng, `${num(t)} ${unitFor(from, t)} = ? ${to}`, `${spoken(t, from)} is how many ${WORD[to] ?? to}?`, a, t,
    down ? 'Multiply to go to the smaller unit' : 'Divide to go to the bigger unit', slow);
}

const whole = (rng: Rng, row: Row, down: boolean, upTo: number, slow = false) => {
  const k = ri(rng, 1, upTo);
  return plain(rng, row, down, down ? k * 10 : k * row.factor * 10, slow);
};

/** d3 compound: "3 m 40 cm = ? cm" (metric) or "1 hour 15 minutes = ? minutes". */
function compound(rng: Rng, row: Row): Question {
  const rest = row.factor === 7 || row.factor === 12 ? ri(rng, 1, row.factor - 1) : pick(rng, row.factor === 10 ? [2, 5, 7] : [5, 10, 15, 20, 25, 30, 40, 45, 50].filter(n => n < row.factor));
  const k = ri(rng, 1, row.time ? 5 : 9), total = k * row.factor + rest;
  const left = `${k} ${unitFor(row.big, k * 10)}`, right = `${rest} ${unitFor(row.small, rest * 10)}`;
  const say = (n: number, u: string) => `${ks2Say(String(n))} ${n === 1 && ONE[u] ? ONE[u] : WORD[u] ?? u}`;
  return card(rng, `${left} ${right} = ? ${row.small}`, `${say(k, row.big)} ${say(rest, row.small)} is how many ${WORD[row.small] ?? row.small}?`,
    total * 10, k * 10, 'Change the bigger unit first, then add the rest', true);
}

/** d3 decimal: "2.5 km = ? m" (tenths of a bigger unit that make a whole smaller one) or the answer as a one-place decimal ("400 m = ? km"). */
function decimal(rng: Rng, row: Row, down: boolean): Question {
  const usable = row.factor % 10 === 0;
  if (!usable) return whole(rng, row, down, row.max, true);
  if (down) return plain(rng, row, true, ri(rng, 1, 9) * 10 + 5, true);
  return plain(rng, row, false, ri(rng, 1, 9) * row.factor, true);
}

/** d3 sentence: "A film lasts 2 hours. How many minutes?" */
function sentence(rng: Rng): Question {
  const row = pick(rng, ROWS.filter(r => r.time)), k = ri(rng, 2, 9);
  const what: Record<string, string> = { hours: 'A film lasts', minutes: 'A song lasts', years: 'A tree is', weeks: 'A trip lasts' };
  const unit = row.big, from = `${k} ${unit}`;
  return card(rng, `${what[unit]} ${from}${unit === 'years' ? ' old' : ''}. How many ${row.small}?`, `${what[unit]} ${ks2Say(String(k))} ${unit}${unit === 'years' ? ' old' : ''}. How many ${row.small}?`,
    k * row.factor * 10, k * 10, 'Multiply to go to the smaller unit', true);
}

function d3(rng: Rng): Question {
  const r = rng(), row = pick(rng, ROWS);
  if (r < 0.25) return sentence(rng);
  if (r < 0.55) return compound(rng, row);
  return decimal(rng, row, rng() < 0.5);
}

export const y4Convert: Generator = (level: Difficulty, rng: Rng) => {
  if (level === 1) return whole(rng, pick(rng, ROWS), true, 9);
  if (level === 2) { const row = pick(rng, ROWS); return whole(rng, row, rng() < 0.5, row.max); }
  return d3(rng);
};
