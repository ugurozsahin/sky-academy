// y4-fracof (#1144): fractions of amounts whose answer is a whole number. The whole is always den × k, so
// answer = k × num; a "left" story answers whole − that. Plain prompts, no visual (#1041 keeps KS2 cards plain).
// d1 unit fractions to 144; d2 non-unit fractions with denominators 3–12 to 144; d3 tenths and hundredths of
// amounts to 1,000, or a one-step story about a length, a mass or a volume.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';

const num = (n: number) => fmt(dec(n, 0));
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** One step of a story: which part of the whole the question asks for. */
interface Story { readonly text: (w: string, f: string) => string; readonly unit: string; readonly ask: 'part' | 'left'; readonly hint: string }
const STORIES: readonly Story[] = [
  { text: (w, f) => `A ribbon is ${w} cm long. ${f} of it is used. How much is left?`, unit: 'cm', ask: 'left', hint: 'Find the part used, then take it away' },
  { text: (w, f) => `A tank holds ${w} litres. ${f} of the water is used. How much is left?`, unit: 'litres', ask: 'left', hint: 'Find the part used, then take it away' },
  { text: (w, f) => `A path is ${w} m long. ${f} of it is gravel. How long is the gravel part?`, unit: 'm', ask: 'part', hint: 'Divide by the bottom number, then multiply by the top' },
  { text: (w, f) => `A jug holds ${w} ml of juice. ${f} of it is poured out. How much is that?`, unit: 'ml', ask: 'part', hint: 'Divide by the bottom number, then multiply by the top' },
  { text: (w, f) => `A bag holds ${w} kg of flour. ${f} of it is used. How much is left?`, unit: 'kg', ask: 'left', hint: 'Find the part used, then take it away' },
  { text: (w, f) => `A rope is ${w} cm long. ${f} of it is cut off. How long is the piece cut off?`, unit: 'cm', ask: 'part', hint: 'Divide by the bottom number, then multiply by the top' },
  { text: (w, f) => `A pond has ${w} litres of water. ${f} of it drains away. How much is left?`, unit: 'litres', ask: 'left', hint: 'Find the part drained, then take it away' },
];

/** Misconception decoys, whole numbers > 0: the unit-fraction slip (whole ÷ den), the answer ± 10 (it shares the units digit, so the units never give the answer away), a near miss that keeps the leading digit, then the complement, whole ÷ num when exact and a step either side; `own` leads. */
export function decoys(rng: Rng, whole: number, den: number, num_: number, answer: number, own: number[] = []): number[] {
  const out: number[] = [];
  const add = (v: number) => { if (Number.isInteger(v) && v > 0 && v < 1000 && v !== answer && !out.includes(v)) out.push(v); };
  own.forEach(add);
  add(whole / den);
  shuffle(rng, [answer + 10, answer - 10]).filter(v => v > 0).slice(0, 1).forEach(add);
  const lead = (v: number) => String(v)[0];
  shuffle(rng, [1, 2, 3, 4, -1, -2, -3, -4].map(j => answer + j)).filter(v => v > 0 && lead(v) === lead(answer)).slice(0, 1).forEach(add);
  add((whole / den) * (den - num_));
  if (num_ > 1 && whole % num_ === 0) add(whole / num_);
  shuffle(rng, [answer + 1, answer - 1, answer + 2]).forEach(add);
  return out.slice(0, 3);
}

/** A story spoken aloud: units and the fraction in words, the closing question mark left alone (`ks2Say` would turn a trailing "?" into " what"). */
function speakStory(text: string, frac: string): string {
  const spoken = ks2Say(text.replace(/\?$/, '')).replace('FRAC', ks2Say(frac));
  return spoken.replace(/(^|\. )([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase()) + '?';
}

function card(rng: Rng, whole: number, n: number, den: number, opts: { story?: Story; part: number }): Question {
  const w = num(whole), f = `${n}/${den}`;
  const left = opts.story?.ask === 'left';
  const answer = left ? whole - opts.part : opts.part;
  // On a "left" story the used part is the complement decoy: it is the quantity the question tempts a child to give.
  const ds = decoys(rng, whole, den, n, answer, left ? [opts.part] : []);
  const lab = (v: number) => (opts.story ? `${num(v)} ${opts.story.unit}` : num(v));
  const prompt = opts.story ? opts.story.text(w, f) : `${f} of ${w} = ?`;
  const say = opts.story ? speakStory(opts.story.text(w, 'FRAC'), f) : `${ks2Say(f)} of ${w} equals what?`;
  return wordQ(rng, prompt, lab(answer), ds.map(lab),
    { say, hint: opts.story?.hint ?? (n === 1 ? 'Divide by the bottom number' : 'Divide by the bottom number, then multiply by the top'), hintIsData: false });
}

/** d1: a unit fraction 1/2 to 1/12 of an amount to 144. */
function unit(rng: Rng): Question {
  const den = ri(rng, 2, 12), k = ri(rng, 2, Math.floor(144 / den));
  return card(rng, den * k, 1, den, { part: k });
}

/** d2: a non-unit fraction (in lowest terms) with denominator 3 to 12 of an amount to 144. */
function nonUnit(rng: Rng): Question {
  const den = ri(rng, 3, 12);
  const n = pick(rng, Array.from({ length: den - 2 }, (_, i) => i + 2).filter(v => gcd(v, den) === 1));
  const k = ri(rng, 2, Math.floor(144 / den));
  return card(rng, den * k, n, den, { part: n * k });
}

/** d3: tenths or hundredths of an amount to 1,000. */
function tenthsHundredths(rng: Rng): Question {
  const hundredths = rng() < 0.4, den = hundredths ? 100 : 10;
  const k = ri(rng, 2, 1000 / den), n = hundredths ? ri(rng, 2, 99) : ri(rng, 2, 9);
  return card(rng, den * k, n, den, { part: n * k });
}

/** d3: a one-step story with a non-unit fraction (denominator 3 to 10) of a measure to 200. */
function story(rng: Rng): Question {
  const s = pick(rng, STORIES), den = ri(rng, 3, 10);
  const n = pick(rng, Array.from({ length: den - 2 }, (_, i) => i + 2).filter(v => gcd(v, den) === 1));
  const k = ri(rng, 2, Math.floor(200 / den));
  return card(rng, den * k, n, den, { story: s, part: n * k });
}

export const y4FracOf: Generator = (level: Difficulty, rng) => {
  if (level === 1) return unit(rng);
  if (level === 2) return nonUnit(rng);
  return rng() < 0.5 ? tenthsHundredths(rng) : story(rng);
};
