// y4-time (#1152): read and convert time between analogue and digital 12- and 24-hour clocks. Every label comes from `h12`/`h24` on one (hour, minute) pair, so the prompt and the answer cannot disagree. Formats are fixed: 12-hour "2:35 pm"
// (no leading zero, lower-case am/pm, no full stops; the analogue d1 answer drops am/pm) and 24-hour "14:35" (always two digits).
import type { Difficulty, Generator, Question, Rng } from './types';
import { numberWord, pick, ri, shuffle, wordQ } from './util';

const p2 = (n: number) => String(n).padStart(2, '0');
const hour12 = (h24: number) => h24 % 12 || 12;
/** "2:35 pm", or "2:35" without the am/pm for the analogue card. */
const h12 = (h24: number, m: number, ampm = true) => `${hour12(h24)}:${p2(m)}${ampm ? (h24 < 12 ? ' am' : ' pm') : ''}`;
const h24 = (h: number, m: number) => `${p2(((h % 24) + 24) % 24)}:${p2(m)}`;

/** Spoken forms in words only: an engine reads "24-hour" as "24 minus hour" and "2:35 pm" as a ratio. */
const minWord = (m: number) => (m === 0 ? '' : m < 10 ? ` oh ${numberWord(m)}` : ` ${numberWord(m)}`);
const say12 = (t: number, m: number) => `${numberWord(hour12(t))}${m === 0 ? " o'clock" : minWord(m)} ${t < 12 ? 'a m' : 'p m'}`;
const say24 = (t: number, m: number) => `${t === 0 ? 'zero zero' : numberWord(t)}${m === 0 ? ' hundred hours' : minWord(m)}`;

/** Wrong 24-hour answers a child really gives, all with the answer's minutes: the am/pm swapped, am/pm ignored (the 12-hour
 *  number as it stands), +10 instead of +12, then an hour out either side. `t` is the true hour. */
function wrong24(rng: Rng, t: number, m: number, tail: number[]): string[] {
  const named = [t + 12, hour12(t), hour12(t) + 10, t + 1, t - 1].map(h => h24(h, m));
  const extra = shuffle(rng, tail.map(d => h24(t + d, m)));
  return [...new Set([...shuffle(rng, named.slice(0, 3)), ...named.slice(3), ...extra])].filter(o => o !== h24(t, m));
}
/** The same for a 12-hour answer: am/pm swapped, 10 taken off instead of 12, then an hour out either side. */
function wrong12(rng: Rng, t: number, m: number, tail: number[]): string[] {
  const named = [t + 12, t - 10, t + 1, t - 1].map(h => h12(((h % 24) + 24) % 24, m));
  const extra = shuffle(rng, tail.map(d => h12(((t + d) % 24 + 24) % 24, m)));
  return [...new Set([...shuffle(rng, named.slice(0, 2)), ...named.slice(2), ...extra])].filter(o => o !== h12(t, m));
}
const TAIL = [2, -2, 3, -3, 13, -13];

/** d1: an analogue clock at a 5-minute time, read as 12-hour digital. */
function clockCard(rng: Rng): Question {
  const hr = ri(rng, 1, 12), m = ri(rng, 0, 11) * 5, ans = h12(hr, m, false);
  const next = hr % 12 + 1, swapH = m / 5 || 12;
  const named = [`${hr}:${p2(m === 0 ? ri(rng, 1, 11) : m / 5)}`, `${next}:${p2(m)}`, `${swapH}:${p2(hr % 12 * 5)}`, `${(hr + 10) % 12 + 1}:${p2(m)}`,
    `${hr}:${p2((m + 5) % 60)}`, `${hr}:${p2((m + 55) % 60)}`].filter((o, i, a) => o !== ans && a.indexOf(o) === i);
  return wordQ(rng, 'What time does the clock show?', ans, named, { visual: { type: 'clock', h: hr, m }, say: 'What time does the clock show?', hint: 'The short hand shows the hour, the long hand the minutes', hintIsData: false });
}

/** d2/d3 text card: either direction. `t` is the hour of the day, `m` the minute. */
function textCard(rng: Rng, t: number, m: number, to24: boolean, d: Difficulty): Question {
  const prompt = to24 ? `What is ${h12(t, m)} in 24-hour time?` : `What is ${h24(t, m)} in 12-hour time?`;
  const src = to24 ? say12(t, m) : say24(t, m);
  const say = `What is ${src} in ${to24 ? 'twenty-four' : 'twelve'} hour time?`;
  const extra = { say, hint: to24 ? 'Add twelve to the hour for pm times' : 'Take twelve off hours past twelve and write pm', hintIsData: false, ...(d === 3 ? { slow: true } : {}) };
  return to24 ? wordQ(rng, prompt, h24(t, m), wrong24(rng, t, m, TAIL), extra) : wordQ(rng, prompt, h12(t, m), wrong12(rng, t, m, TAIL), extra);
}

const PARTS: [string, number, number][] = [['in the morning', 1, 11], ['in the afternoon', 12, 17], ['in the evening', 18, 23], ['at night', 0, 4]];
/** d3: an analogue clock plus the part of the day, answered on a 24-hour clock. */
function partCard(rng: Rng): Question {
  const [word, lo, hi] = pick(rng, PARTS), t = ri(rng, lo, hi), m = ri(rng, 0, 11) * 5;
  const wrong = wrong24(rng, t, m, TAIL);
  return wordQ(rng, `It is ${word}. What is this time on a 24-hour clock?`, h24(t, m), wrong, { visual: { type: 'clock', h: hour12(t), m }, slow: true,
    say: `It is ${word}. What is this time on a twenty-four hour clock?`, hint: 'Read the clock, then think about the part of the day', hintIsData: false });
}

/** d3 edge cases: 12:xx am is 00:xx and 12:xx pm stays 12:xx, both ways. */
function edgeCard(rng: Rng): Question {
  const t = rng() < 0.5 ? 0 : 12;
  return textCard(rng, t, ri(rng, 1, 59), rng() < 0.5, 3);
}

export const y4Time: Generator = (level: Difficulty, rng: Rng) => {
  if (level === 1) return clockCard(rng);
  const t = ri(rng, 1, 23), m = ri(rng, 1, 59);
  if (level === 2) return textCard(rng, t === 12 ? 13 : t, m, rng() < 0.5, 2);
  const r = rng();
  if (r < 0.4) return partCard(rng);
  if (r < 0.7) return edgeCard(rng);
  return textCard(rng, t, m, rng() < 0.5, 3);
};
