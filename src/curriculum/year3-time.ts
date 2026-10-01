// y3-time (#1077): time to the minute, am and pm, noon and midnight, 12- and 24-hour. Answers are digital
// ("4:37 pm", "14:35"), never `clockPhrase` words — own helpers, nothing imported from year2.
import type { Difficulty, Generator, Question } from './types';
import { ri, pick, shuffle } from './util';
import { ks2Say } from './ks2say';

const two = (n: number) => String(n).padStart(2, '0');
const mod12 = (h: number) => ((h - 1) % 12 + 12) % 12 + 1; // any integer -> 1..12
const t12 = (h: number, m: number, sfx?: 'am' | 'pm') => `${h}:${two(m)}${sfx ? ` ${sfx}` : ''}`;
/** 24-hour label, total over 0–23 (and wraps any other integer into it). */
export const t24 = (h: number, m: number) => `${two(((h % 24) + 24) % 24)}:${two(m)}`;
/** 12-hour label of a 24-hour time: 0 → 12:mm am, 12 → 12:mm pm. */
const from24 = (h: number, m: number) => t12(h % 12 || 12, m, h < 12 ? 'am' : 'pm');

/** am/pm read as letters, hyphens out of "24-hour" so the speech never says "minus". */
const speak = (text: string) => ks2Say(text.replace(/-/g, ' ')).replace(/\b(am|pm)\b/g, (_, s: string) => `${s[0]} m`);

/** Three distinct labels from the shuffled misconception list (each named error turns up in turn), topped up by `spare`. */
function build(answer: string, named: string[], spare: string[], rng: () => number): string[] {
  const pool = [...new Set([...shuffle(rng, named), ...spare])].filter(o => o !== answer);
  return shuffle(rng, [answer, ...pool.slice(0, 3)]);
}

type Sfx = 'am' | 'pm';
const partOfDay = (h: number, sfx: Sfx) => sfx === 'am' ? (h >= 6 ? 'morning' : 'night') : h >= 6 ? 'evening' : 'afternoon';

/** The named clock-reading mistakes for h:m (hour 1–12), each a different label from the answer where valid. */
function clockDecoys(h: number, m: number, sfx?: Sfx): { named: string[]; spare: string[] } {
  const dm = m + 5 <= 59 ? m + 5 : m - 5, early = m > 30 ? mod12(h - 1) : mod12(h + 1);
  const named = [
    t12(Math.floor(m / 5) || 12, (h * 5) % 60, sfx), // the hands swapped
    t12(h, dm, sfx),                                  // one numeral mark out
    t12(early, m, sfx),                               // the hour hand read as the neighbouring number
    t12(h, Math.floor(m / 5), sfx),                   // the minute read as the numeral it points to
  ];
  if (sfx) named.unshift(t12(h, m, sfx === 'am' ? 'pm' : 'am'));
  return { named, spare: [t12(h, m === 59 ? 58 : m + 1, sfx), t12(mod12(h + 1), m, sfx), t12(h, m === 0 ? 55 : m - 1, sfx)] };
}

/** d1/d2 clock cards: the visual shows h:m; d2 also names the part of the day and adds am/pm. */
function clockCard(d: Difficulty, rng: () => number): Question {
  const h = d === 1 ? ri(rng, 1, 12) : ri(rng, 1, 11); // d2 keeps off 12, where am/pm is noon or midnight
  const m = ri(rng, 0, 59);
  const sfx: Sfx | undefined = d === 2 ? pick(rng, ['am', 'pm'] as const) : undefined;
  const answer = t12(h, m, sfx), { named, spare } = clockDecoys(h, m, sfx);
  const prompt = sfx ? `It is the ${partOfDay(h, sfx)}. What time is it?` : 'What time is it?';
  return { prompt, say: speak(prompt), answer, options: build(answer, named, spare, rng), visual: { type: 'clock', h, m } };
}

/** d2 vocabulary: "Which time is just after noon?" — the same four labels, so the answer is the whole question. */
function vocabCard(rng: () => number): Question {
  const noon = rng() < 0.5, after = rng() < 0.5, k = pick(rng, [5, 10, 15, 20] as const);
  const afterL = (s: 'am' | 'pm') => t12(12, k, s), beforeL = (s: 'am' | 'pm') => t12(11, 60 - k, s);
  // just after noon is pm, just before noon is am; midnight is the other way round
  const answer = after ? afterL(noon ? 'pm' : 'am') : beforeL(noon ? 'am' : 'pm');
  const options = shuffle(rng, [afterL('am'), afterL('pm'), beforeL('am'), beforeL('pm')]);
  const prompt = `Which time is just ${after ? 'after' : 'before'} ${noon ? 'noon' : 'midnight'}?`;
  return { prompt, say: speak(prompt), answer, options, optionsAreContent: true };
}

/** d3: 12-hour ↔ 24-hour with no clock, plus the noon and midnight cards. */
function convertCard(rng: () => number): Question {
  const kind = pick(rng, ['to24', 'to12', 'to24', 'to12', 'word'] as const);
  if (kind === 'word') {
    const noon = rng() < 0.5, h = noon ? 12 : 0, answer = t24(h, 0);
    const prompt = `${noon ? 'Noon' : 'Midnight'} on a 24-hour clock?`;
    const named = noon ? ['00:00', '11:00', '01:00', '22:00'] : ['12:00', '01:00', '02:00', '10:00'];
    return { prompt, say: speak(prompt), answer, options: build(answer, named, [], rng) };
  }
  const h = ri(rng, 0, 23), m = ri(rng, 0, 59), h12 = h % 12 || 12;
  const spare = [1, 23, 2, 22].map(s => (h + s) % 24);
  if (kind === 'to24') {
    const prompt = `${from24(h, m)} on a 24-hour clock?`, answer = t24(h, m);
    const named = [(h + 12) % 24, (h12 + 10) % 24, (h + 10) % 24, (h + 14) % 24].map(x => t24(x, m));
    return { prompt, say: speak(prompt), answer, options: build(answer, named, spare.map(x => t24(x, m)), rng) };
  }
  const prompt = `${t24(h, m)} in 12-hour time?`, answer = from24(h, m);
  const named = [(h + 12) % 24, (h + 14) % 24, (h + 10) % 24].map(x => from24(x, m));
  return { prompt, say: speak(prompt), answer, options: build(answer, named, spare.map(x => from24(x, m)), rng) };
}

export const y3Time: Generator = (d, rng) =>
  d === 3 ? convertCard(rng) : d === 2 && rng() < 0.4 ? vocabCard(rng) : clockCard(d, rng);
