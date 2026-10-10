// y5-convert (#1203): Year 5 metric conversions and units of time (5M34, 5M39). d1 is whole-number metric (km, m, cm, mm, kg, g,
// l, ml), at most 10 of the larger unit. d2 adds one or two decimal places and single-unit time (h, min, s, days, weeks, years,
// months). d3 mixes units: "2 h 15 min", "1.5 hours", "1 m 35 cm", "150 min = 2 h and ? min". Values are scaled integers
// (`ks2num.ts`), never floats. The slips are a power-of-ten shift (the wrong factor, or × for ÷) and, for time, decimal time:
// 1.5 hours read as 150 minutes, 2 h 15 min as 215, and a 100-minute hour.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick } from './util';
import { dec, fmt, mulPow10, divPow10, type Dec } from './ks2num';
import { u, show, say, finish, type Unit } from './unitcard';

interface Pair { big: Unit; small: Unit; f: number; pow: 1 | 2 | 3 | 0; time: boolean }
const KM = u('km', 'kilometre'), M = u('m', 'metre'), CM = u('cm', 'centimetre'), MM = u('mm', 'millimetre'), KG = u('kg', 'kilogram'), G = u('g', 'gram');
const L = u('l', 'litre'), ML = u('ml', 'millilitre'), H = u('h', 'hour'), MIN = u('min', 'minute'), S = u('s', 'second');
const DAY = u('days', 'day'), WEEK = u('weeks', 'week'), YEAR = u('years', 'year'), MONTH = u('months', 'month');
const m = (big: Unit, small: Unit, f: number, pow: 1 | 2 | 3): Pair => ({ big, small, f, pow, time: false });
const t = (big: Unit, small: Unit, f: number): Pair => ({ big, small, f, pow: 0, time: true });
const METRIC = [m(KM, M, 1000, 3), m(M, CM, 100, 2), m(CM, MM, 10, 1), m(KG, G, 1000, 3), m(L, ML, 1000, 3)];
const TIME = [t(H, MIN, 60), t(MIN, S, 60), t(DAY, H, 24), t(WEEK, DAY, 7), t(YEAR, MONTH, 12)];
const MIXED = [METRIC[0], METRIC[1], METRIC[3], METRIC[4]];

const HINT_METRIC = 'Going to a smaller unit, multiply. Going to a bigger unit, divide';
const HINT_TIME = 'Check how many of the small unit make one of the big unit';
const HINT_MIXED = 'Change the bigger unit first, then add the rest';

/** Both directions of one pair. `big` is the larger-unit amount and `small` the same amount in the smaller unit. */
function card(rng: Rng, p: Pair, big: Dec, small: Dec, hint: string, extra: Dec[] = []): Question {
  const down = rng() < 0.5; // larger → smaller (multiply)
  const from = down ? big : small, to = down ? small : big, fu = down ? p.big : p.small, tu = down ? p.small : p.big;
  const prompt = `${show(from, fu)} = ? ${tu.sym}`, spoken = `${say(from, fu)} is how many ${tu.many}?`;
  const shifts = [mulPow10(to, 1), divPow10(to, 1)];
  const wrongFactor = down ? [mulPow10(small, 1), divPow10(small, 1)] : [mulPow10(big, 1), divPow10(big, 1)];
  return finish(rng, prompt, spoken, to, [...extra, ...shifts, ...wrongFactor, from], hint);
}

/** A metric amount of the larger unit as a Dec: `n` is its integer at `dp` places. */
function metric(p: Pair, n: number, dp: number): { big: Dec; small: Dec } {
  return { big: dec(n, dp), small: dec(n * 10 ** (p.pow - dp), 0) };
}

function wholeMetric(rng: Rng): Question {
  const p = pick(rng, METRIC), n = ri(rng, 2, 10), { big, small } = metric(p, n, 0);
  return card(rng, p, big, small, HINT_METRIC);
}

function decimalMetric(rng: Rng): Question {
  const p = pick(rng, METRIC.slice(0, 2).concat(METRIC.slice(3))), dp = ri(rng, 1, Math.min(2, p.pow));
  let n = ri(rng, 11, dp === 1 ? 99 : 999);
  while (n % 10 === 0) n++;
  const { big, small } = metric(p, n, dp);
  return card(rng, p, big, small, HINT_METRIC);
}

function singleTime(rng: Rng): Question {
  const p = pick(rng, TIME), n = ri(rng, 2, p.f === 24 ? 5 : p.f === 7 ? 9 : 12);
  const decimalTime = p.f === 60 ? [dec(n * 100, 0)] : [];
  return card(rng, p, dec(n, 0), dec(n * p.f, 0), HINT_TIME, decimalTime);
}

/** "2 h 15 min = ? min": the hours-and-minutes slip is 215, and the 100-minute hour is the same digits. */
function hoursMinutes(rng: Rng): Question {
  const h = ri(rng, 1, 5), min = ri(rng, 1, 11) * 5, answer = h * 60 + min;
  const prompt = `${h} h ${min} min = ? min`, spoken = `${h} ${h === 1 ? 'hour' : 'hours'} ${min} minutes is how many minutes?`;
  return finish(rng, prompt, spoken, dec(answer, 0), [dec(h * 100 + min, 0), dec(h * 60, 0), dec(h + min, 0), dec(h * 600 + min, 0)], HINT_TIME);
}

/** "1.5 hours = ? minutes": a quarter, half or three quarters. The slips are 150 and 60 + 50. */
function decimalHours(rng: Rng): Question {
  const h = ri(rng, 1, 4), q = pick(rng, [25, 50, 75]), hours = dec(h * 100 + q, 2), answer = h * 60 + (q * 60) / 100;
  const prompt = `${fmt(hours)} hours = ? minutes`, spoken = `${fmt(hours)} hours is how many minutes?`;
  return finish(rng, prompt, spoken, dec(answer, 0), [dec(h * 100 + q, 0), dec(h * 60 + q, 0), dec(h * 60 + q / 5, 0), dec(h * 60, 0)], HINT_TIME);
}

/** "150 min = 2 h and ? min": the remainder. The slips are the digits after the hundreds and 60 minus the answer. */
function remainder(rng: Rng): Question {
  const h = ri(rng, 1, 5), min = ri(rng, 1, 11) * 5, total = h * 60 + min;
  const prompt = `${total} min = ${h} h and ? min`, spoken = `${total} minutes is ${h} ${h === 1 ? 'hour' : 'hours'} and how many minutes?`;
  return finish(rng, prompt, spoken, dec(min, 0), [dec(total % 100, 0), dec(60 - min, 0), dec(total - h * 100, 0), dec(h, 0)], HINT_TIME);
}

/** "1 m 35 cm = ? cm": the bigger unit first, then the rest. The slips are 1 + 35 style joins and a shifted tens. */
function mixedMetric(rng: Rng): Question {
  const p = pick(rng, MIXED), a = ri(rng, 1, 9), b = ri(rng, 1, p.f / 5 - 1) * 5, answer = a * p.f + b;
  const prompt = `${a} ${p.big.sym} ${b} ${p.small.sym} = ? ${p.small.sym}`;
  const spoken = `${a} ${a === 1 ? p.big.one : p.big.many} ${b} ${p.small.many} is how many ${p.small.many}?`;
  return finish(rng, prompt, spoken, dec(answer, 0), [dec(a * p.f * 10 + b, 0), dec(a * 10 + b, 0), dec(a * p.f + b * 10, 0), dec(a + b, 0)], HINT_MIXED);
}

export const y5Convert: Generator = (level: Difficulty, rng) => {
  if (level === 1) return wholeMetric(rng);
  if (level === 2) return rng() < 0.55 ? decimalMetric(rng) : singleTime(rng);
  const r = rng();
  return r < 0.25 ? hoursMinutes(rng) : r < 0.5 ? decimalHours(rng) : r < 0.75 ? mixedMetric(rng) : remainder(rng);
};

