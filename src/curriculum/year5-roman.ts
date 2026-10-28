// y5-roman (#1181): read Roman numerals to M and recognise years written in them (5M6). The numeral is on the card and the
// Arabic number is in the bubbles, since a long numeral is too small to read in a bubble. d1 numerals to C (a Year 4 recap);
// d2 numerals to M, about one card in four reversed ("Which numeral is 40?", short Roman labels only); d3 years 1066 to 2030.
// Decoys are misreadings that keep the units digit: a subtractive pair read as adding (XIX as 21), a dropped letter, a pair
// read the wrong way round (XL as LX). The voice spells the letters, never the value (#1057); a year carries no comma (#1047).
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, ri, shuffle, wordQ } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';
import { romanWhy, toRoman } from './roman';

const GLYPH: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
const vals = (r: string) => [...r].map(c => GLYPH[c]);
const num = (n: number, year: boolean) => fmt(dec(n, 0), { year });
// Fredoka 700 advance widths (em). A Roman bubble label must stay within MMXXVI's 3.96 em, the widest still readable on a phone.
const EM: Record<string, number> = { I: 0.239, V: 0.728, X: 0.689, L: 0.569, C: 0.631, D: 0.655, M: 0.809 };
const fitsBubble = (n: number) => n >= 1 && n <= 3999 && [...toRoman(n)].reduce((w, c) => w + EM[c], 0) <= 3.96;

/** Misreadings of numeral `r` (value `n`): additive, one letter dropped, a subtractive pair reversed. */
function misreads(rng: Rng, r: string, n: number): number[] {
  const v = vals(r), sum = v.reduce((a, b) => a + b, 0), out: number[] = [];
  const pairs = v.flatMap((x, i) => (i + 1 < v.length && x < v[i + 1] ? [x] : []));
  if (sum !== n) out.push(sum);
  if (pairs.length) out.push(n + 2 * pick(rng, pairs));
  out.push(sum - pick(rng, v));
  return out;
}

const lead = (x: number) => String(x)[0], units = (x: number) => x % 10;

/** Keep a decoy that shares the answer's units digit (n ± 10, the same leading digit if it can) and one that shares its leading digit (#1058); `pool[0]` is the additive misreading and stays. */
function share(rng: Rng, n: number, pool: number[], free: (x: number) => boolean): void {
  const put = (x: number | undefined, slot: number) => { if (x === undefined) return; if (slot < 0 || slot >= 3) pool.length < 3 && pool.push(x); else pool[slot] = x; };
  if (!pool.some(x => units(x) === units(n))) {
    const ten = [n + 10, n - 10].filter(free);
    put(ten.find(y => lead(y) === lead(n)) ?? ten[0], Math.min(pool.length, 2));
  }
  if (!pool.some(x => lead(x) === lead(n))) {
    const near = shuffle(rng, [1, -1, 2, -2, 3, -3, 20, -20]).map(k => n + k).find(y => free(y) && lead(y) === lead(n) && units(y) !== units(n));
    put(near, [2, 1].find(i => i < pool.length && units(pool[i]) !== units(n)) ?? -1);
  }
}

/** Three distinct wrong values in lo..hi: the misreadings, then the shared-digit decoys of the KS2 rule, then fill. */
function wrong(rng: Rng, r: string, n: number, lo: number, hi: number): number[] {
  const pool: number[] = [];
  const free = (x: number) => x !== n && x >= lo && x <= hi && !pool.includes(x);
  for (const x of misreads(rng, r, n)) if (free(x) && pool.length < 3) pool.push(x);
  if (n >= 20) share(rng, n, pool, free);
  for (const k of shuffle(rng, [10, -10, 20, -20, 1, -1, 2, -2, 3, -3, 100, -100])) if (pool.length < 3 && free(n + k)) pool.push(n + k);
  return pool;
}

function read(rng: Rng, n: number, hi: number, year: boolean, lo = 1): Question {
  const r = toRoman(n);
  const prompt = year ? 'The end credits show this year. What year is it?' : 'Which number is this Roman numeral?';
  return wordQ(rng, prompt, num(n, year), wrong(rng, r, n, lo, hi).map(x => num(x, year)), {
    visual: { type: 'word', text: r }, say: ks2Say(`${year ? 'Which year is' : 'Which number is'} ${r}?`, { roman: [r] }),
    hint: year ? 'Slice the year' : 'Slice the number', hintIsData: false, why: romanWhy(n),
  });
}

/** "Which numeral is n?": only numerals short enough for a bubble, as answer and as decoy. */
function write(rng: Rng): Question {
  let n = ri(rng, 4, 999);
  while (!fitsBubble(n)) n = ri(rng, 4, 999);
  const r = toRoman(n);
  const cand = wrong(rng, r, n, 1, 999).concat(shuffle(rng, [n + 10, n - 10, n + 100, n - 100, n + 1, n - 1, n + 2, n - 2, n + 3, n - 3, n + 20, n - 20, n + 50, n - 50]));
  const opts = [...new Set(cand.filter(x => x !== n && fitsBubble(x)))].slice(0, 3);
  return wordQ(rng, `Which Roman numeral is ${n}?`, r, opts.map(toRoman), { say: `Which Roman numeral is ${n}?`, hint: 'Slice the numeral', hintIsData: false, noSayAnswer: true, why: romanWhy(n) });
}

export const y5Roman: Generator = (d: Difficulty, rng: Rng) => {
  if (d === 1) return read(rng, ri(rng, 1, 100), 100, false);
  if (d === 2) return rng() < 0.25 ? write(rng) : read(rng, ri(rng, 100, 1000), 1000, false);
  return read(rng, ri(rng, 1066, 2030), 3000, true, 1000);
};
