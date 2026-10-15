// y3-calendar (#1101): the time facts (seconds, days in a month or year), which duration is longest or shortest, and how long an
// event took. Durations sit in the prompt and the bubbles carry letters, so no bubble is wider than a letter (R-LBL).
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, ri, shuffle } from './util';
import { ks2Say } from './ks2say';

const MONTHS: [string, number][] = [['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30],
  ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31]];
const lead = (v: number) => String(v)[0];
const last = (v: number) => String(v)[String(v).length - 1];
const speak = (text: string) => ks2Say(text).replace(/\b(am|pm)\b/g, (_, s: string) => `${s[0]} m`);

/** Four distinct numeric labels: the answer, a `must` decoy first, named decoys (each turns up in turn), then spares. Answers of 20 or more get a digit-sharing decoy (#1058). */
function options(rng: Rng, answer: number, named: number[], spare: number[], must?: number): string[] {
  const ok = (v: number) => v > 0 && v !== answer;
  const out: number[] = [];
  const add = (v: number) => { if (ok(v) && !out.includes(v) && out.length < 3) out.push(v); };
  const pool = [...shuffle(rng, [...new Set(named)]), ...shuffle(rng, [...new Set(spare)])].filter(ok);
  if (must !== undefined) add(must);
  if (answer >= 20) {
    const l = pool.find(v => lead(v) === lead(answer)), u = pool.find(v => last(v) === last(answer) && v !== l);
    if (l !== undefined) add(l);
    if (u !== undefined) add(u);
    else add(answer + 10 * (rng() < 0.5 ? 1 : -1));
  }
  pool.forEach(add);
  return shuffle(rng, [answer, ...out].map(String));
}

function fact(rng: Rng): Question {
  const k = ri(rng, 0, 3);
  if (k === 0) return card(rng, 'How many seconds in a minute?', 60, [100, 50, 30, 24]);
  if (k === 1) return card(rng, 'How many days in a year?', 365, [366, 360, 355, 12, 52]);
  if (k === 2) return card(rng, 'How many days in a leap year?', 366, [365, 360, 367, 52, 12]);
  const [name, days] = pick(rng, MONTHS.filter(m => m[0] !== 'February'));
  return card(rng, `How many days in ${name}?`, days, [28, 29, 30, 31, 32, 21, 41]);
}

function card(rng: Rng, prompt: string, answer: number, named: number[], extra: Partial<Question> = {}, must?: number): Question {
  const opts = options(rng, answer, named, [answer + 1, answer - 1, answer + 10, answer - 10, answer + 5, answer - 5], must);
  return { prompt, say: speak(prompt), answer: String(answer), options: opts, hint: 'Slice the right number', hintIsData: false, ...extra };
}

const len = (s: number) => s % 60 === 0 && s >= 60 ? `${s / 60} minute${s === 60 ? '' : 's'}` : `${s} seconds`;

function compare(rng: Rng): Question {
  const secs = new Set<number>();
  while (secs.size < 4) secs.add(pick(rng, [30, 45, 60, 90, 100, 120, 150, 180, 240, 300]));
  const list = shuffle(rng, [...secs]), longest = rng() < 0.5, target = longest ? Math.max(...list) : Math.min(...list);
  const letters = ['A', 'B', 'C', 'D'], body = list.map((s, i) => `${letters[i]} ${len(s)}`).join(', ');
  const prompt = `${longest ? 'Longest' : 'Shortest'}? ${body}`;
  return { prompt, say: speak(`Which is the ${longest ? 'longest' : 'shortest'} time? ${body.replace(/, /g, '. ')}`), answer: letters[list.indexOf(target)], options: letters, optionsAreContent: true, hint: 'Slice the letter', hintIsData: false };
}

function convert(rng: Rng): Question {
  if (rng() < 0.25) return card(rng, 'How many seconds in half a minute?', 30, [60, 15, 20, 50, 45]);
  const m = ri(rng, 2, 5);
  return card(rng, `How many seconds in ${m} minutes?`, m * 60, [m * 100, m * 10, m * 60 + 60, m * 60 - 60, m * 60 + 10]);
}

const clock = (mins: number) => { const h = Math.floor(mins / 60), m = mins % 60; return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
const THINGS = ['film', 'lesson', 'match', 'class', 'party', 'trip'];

function duration(rng: Rng): Question {
  const start = ri(rng, 8 * 60, 15 * 60 + 55), long = ri(rng, 4, 36) * 5, end = start + long;
  const sh = Math.floor(start / 60), sm = start % 60, eh = Math.floor(end / 60), em = end % 60;
  const hundred = (eh * 100 + em) - (sh * 100 + sm);
  const named = [hundred, Math.abs(em - sm), long + 5, long - 5, long + 60, long - 60];
  const thing = pick(rng, THINGS), prompt = `A ${thing} starts at ${clock(start)} and ends at ${clock(end)}. How many minutes?`;
  return card(rng, prompt, long, named, { say: speak(prompt) }, hundred);
}

export const y3Calendar: Generator = (d: Difficulty, rng) => d === 1 ? fact(rng) : d === 2 ? (rng() < 0.6 ? compare(rng) : convert(rng)) : duration(rng);
