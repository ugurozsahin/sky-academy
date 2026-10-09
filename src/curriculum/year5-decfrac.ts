// y5-decfrac (#1199): Year 5 reading and writing decimals as fractions and back (5M27). d1 tenths (0.3 = 3/10); d2 hundredths,
// often with a zero in the tenths place (0.07 = 7/100); d3 hundredths above 1 (1.25 = 125/100) and the common equivalents in
// their simplest form (0.25 = 1/4). Half the cards go each way. Values are scaled integers (`ks2num.ts`), never floats, and every
// decoy is checked by value, so exactly one option is worth the answer. The slips are place slips: 0.07 read as 7/10, 71/100
// read as 7.1, a digit pair swapped.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ } from './util';
import { addDec, dec, fmt, parseNum, type Dec } from './ks2num';
import { parseFrac } from './fractions';
import { ks2Say } from './ks2say';

/** True when `label` (a decimal or a fraction) is worth exactly `v`: cross-multiplied, so no division. */
function worth(label: string, v: Dec): boolean {
  const f = parseFrac(label);
  if (f) return f.n * 10 ** v.dp === v.v * f.d;
  const n = parseNum(label);
  return !!n && n.v * 10 ** v.dp === v.v * 10 ** n.dp;
}

/** Three distinct decoys not worth `v`, from `slips` then `fill`, tried in order. */
function three(v: Dec, answer: string, slips: string[], fill: string[]): string[] {
  const out: string[] = [];
  for (const c of [...slips, ...fill]) if (out.length < 3 && c !== answer && !out.includes(c) && !worth(c, v) && (parseFrac(c) || parseNum(c))) out.push(c);
  return out;
}

/** A decimal answer must share its last printed digit with a decoy, else the odd one out is the answer (#1058). */
function noLeak(v: Dec, answer: string, decoys: string[]): string[] {
  if (decoys.some(d => d.slice(-1) === answer.slice(-1))) return decoys;
  const up = fmt(addDec(v, dec(10, v.dp)));
  return up !== answer && !decoys.includes(up) ? [...decoys.slice(0, 2), up] : decoys;
}

interface Item { v: Dec; frac: string; asFrac: string[]; asDec: string[] }
const TENTHS = (t: number): Item => ({ v: dec(t, 1), frac: `${t}/10`, asFrac: [`${t}/100`, `10/${t}`], asDec: [fmt(dec(t, 2)), fmt(dec(t, 3)), String(t), fmt(dec(t * 10 + 1, 2))] });
const HUNDREDTHS = (h: number): Item => {
  const swap = h >= 10 ? (h % 10) * 10 + Math.floor(h / 10) : h;
  return { v: dec(h, 2), frac: `${h}/100`, asFrac: [`${h}/10`, `${swap}/100`, `${h}/1`], asDec: [fmt(dec(h, 3)), fmt(dec(h, 1)), fmt(dec(swap, 2)), fmt(dec(h, 0))] };
};
const ABOVE_ONE = (w: number, h: number): Item => {
  const t = w * 100 + h;
  return { v: dec(t, 2), frac: `${t}/100`, asFrac: [`${t}/10`, `${h}/100`, `${w}${h}/10`], asDec: [fmt(dec(t, 3)), fmt(dec(t, 1)), fmt(dec(h, 2)), fmt(dec(t + 10, 2))] };
};
const SIMPLE: Item[] = [
  { v: dec(5, 1), frac: '1/2', asFrac: ['1/5', '5/100', '2/5'], asDec: ['0.2', '0.12', '0.05', '1.2'] },
  { v: dec(25, 2), frac: '1/4', asFrac: ['2/5', '1/25', '4/10'], asDec: ['0.14', '0.025', '2.5', '0.52'] },
  { v: dec(75, 2), frac: '3/4', asFrac: ['7/5', '3/75', '7/50'], asDec: ['0.34', '0.075', '7.5', '0.57'] },
  { v: dec(2, 1), frac: '1/5', asFrac: ['1/2', '2/100', '1/20'], asDec: ['0.15', '0.02', '2', '0.5'] },
];

const HINT_FD = 'Count the digits after the point: tenths, then hundredths';

function card(rng: Rng, it: Item): Question {
  const decimal = fmt(it.v);
  if (rng() < 0.5) {
    return wordQ(rng, `${decimal} = ? Give it as a fraction.`, it.frac, three(it.v, it.frac, it.asFrac, ['1/10', '9/10', '1/100', '3/100']),
      { say: `${ks2Say(decimal)} equals what fraction?`, hint: HINT_FD, hintIsData: false });
  }
  const decoys = noLeak(it.v, decimal, three(it.v, decimal, it.asDec, ['0.1', '0.01', '0.9', '0.99']));
  return wordQ(rng, `${it.frac} = ? Give it as a decimal.`, decimal, decoys,
    { say: `${ks2Say(it.frac)} equals what decimal?`, hint: HINT_FD, hintIsData: false });
}

export const y5DecFrac: Generator = (level: Difficulty, rng) => {
  if (level === 1) return card(rng, TENTHS(ri(rng, 1, 9)));
  if (level === 2) {
    const zeroTenths = rng() < 0.4;
    return card(rng, HUNDREDTHS(zeroTenths ? ri(rng, 1, 9) : pick(rng, Array.from({ length: 89 }, (_, i) => i + 10).filter(n => n % 10 !== 0))));
  }
  return rng() < 0.5 ? card(rng, ABOVE_ONE(ri(rng, 1, 3), pick(rng, [5, 25, 75, 4, 36, 71, 8, 49]))) : card(rng, pick(rng, SIMPLE));
};
