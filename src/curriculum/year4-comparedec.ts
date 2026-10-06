// y4-comparedec (#1148): round, compare and order decimals. Every number is held as a whole count of tenths or
// hundredths (`v` with `dp`) and written through `fmt` at the card's own number of places, so no float reaches a bubble.
// d1 rounds a 1-dp number to the nearest whole; d2 compares two numbers with the same places (< > =); d3 orders four.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, shuffle, wordQ } from './util';
import { dec, fmt, roundTo, compareDec } from './ks2num';
import { ks2Say } from './ks2say';

const lab = (v: number, dp: number) => fmt(dec(v, dp), { fixedDp: dp });

/** d1: "3.6 to the nearest whole number?" — 0.1 to 19.4, halves round up. */
function round(rng: Rng): Question {
  const t = ri(rng, 1, 194), a = roundTo(dec(t, 1), 1).v;
  const wrong = a === Math.floor(t / 10) ? a + 1 : a - 1;   // rounded the wrong way
  const ds = [wrong, t % 10, t];                              // …the tenths digit, the number without its point
  const opts = [...new Set(ds.filter(v => v >= 0 && v !== a))];
  for (let v = a + 1; opts.length < 3; v++) if (v !== a && !opts.includes(v)) opts.push(v);
  const s = lab(t, 1);
  return wordQ(rng, `${s} to the nearest whole number?`, String(a), opts.map(String),
    { say: `${ks2Say(s)} to the nearest whole number?`, hint: 'Look at the tenths digit: halfway or more rounds up', hintIsData: false });
}

/** d2: "3.45 ? 3.54" — same whole part, same places; one card in five equal, two in five a swapped-digit pair (2 dp). */
function compare(rng: Rng): Question {
  const r = rng(), swap = r >= 0.2 && r < 0.6, dp = swap || rng() < 0.5 ? 2 : 1, w = ri(rng, 0, 9), top = 10 ** dp;
  let x: number, y: number;
  if (r < 0.2) { x = y = ri(rng, 1, top - 1); }
  else if (swap) { const h = ri(rng, 1, 9), l = ri(rng, 0, 9); x = h * 10 + l; y = l * 10 + h; if (x === y) y = x + 10 > 99 ? x - 10 : x + 10; }
  else { x = ri(rng, 0, top - 1); y = ri(rng, 0, top - 1); }
  const [a, b] = [dec(w * top + x, dp), dec(w * top + y, dp)];
  const c = compareDec(a, b), ans = c < 0 ? '<' : c > 0 ? '>' : '=';
  const sa = fmt(a, { fixedDp: dp }), sb = fmt(b, { fixedDp: dp });
  return wordQ(rng, `${sa} ? ${sb}`, ans, ['<', '>', '='],
    { say: `${ks2Say(sa)} compared with ${ks2Say(sb)}. Less than, greater than, or equal?`, hint: 'Slice the correct sign', hintIsData: false });
}

/** d3: four different numbers with the same places, smallest to biggest. */
function order(rng: Rng): Question {
  const dp = rng() < 0.5 ? 1 : 2, w = ri(rng, 0, 9), top = 10 ** dp, set = new Set<number>();
  while (set.size < 4) set.add(ri(rng, 0, top - 1));
  const sorted = [...set].sort((p, q) => p - q).map(f => lab(w * top + f, dp)), shown = shuffle(rng, sorted);
  return { prompt: 'Smallest to biggest!', say: `Slice the numbers from smallest to biggest: ${shown.map(s => ks2Say(s)).join(', ')}`,
    answer: sorted.join(' '), sequence: sorted, options: shown, visual: { type: 'word', text: shown.join('  ') },
    hint: 'Slice the smallest number first', hintIsData: false };
}

export const y4CompareDec: Generator = (level: Difficulty, rng) => (level === 1 ? round : level === 2 ? compare : order)(rng);
