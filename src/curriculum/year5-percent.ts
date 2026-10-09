// y5-percent (#1202): Year 5 per cent (5M32–33). d1 a hundred square with k squares shaded ("What percentage is shaded?");
// d2 per cent as a fraction of 100 and as a decimal (37% = ?/100, 0.6 = ?%); d3 the NC equivalents (4/5 = ?%, 1/4 as a
// decimal), from 1/2, 1/4, 1/5, 2/5, 4/5 and tenths, twentieths, twenty-fifths and fiftieths. Values are whole numbers of
// hundredths, so there is no float; decoys are the usual slips (the unshaded share, full rows only, one row off, a place
// slip, "4/5 is 45%") and none is worth the answer.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ, numberWord } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';

const pc = (n: number) => `${n}%`;
const says = (n: number) => `${numberWord(n)} per cent`;
/** Three distinct labels from `cands` (never the answer); a whole answer of 20+ that no decoy shares a last digit with swaps its last decoy for answer ± 10 (#1058). */
function three(answer: string, cands: string[], fill: string[], tens?: string[]): string[] {
  const out: string[] = [];
  for (const c of [...cands, ...fill]) if (out.length < 3 && c !== answer && !out.includes(c)) out.push(c);
  const num = parseFloat(answer), last = answer.replace('%', '').slice(-1);
  if (tens && (answer.includes('.') || num >= 20) && !out.some(o => o.replace('%', '').slice(-1) === last)) {
    const t = tens.find(c => c !== answer && !out.includes(c));
    if (t) out[2] = t;
  }
  return out;
}

/** d1: a 10 × 10 grid with k squares shaded, row by row; the prompt gives the shaded count */
function squareCard(rng: Rng): Question {
  const k = ri(rng, 5, 95), full = Math.floor(k / 10), rest = k % 10;
  const grid = Array.from({ length: 10 }, (_, r) => '#'.repeat(r < full ? 10 : r === full ? rest : 0).padEnd(10, '.'));
  const ans = pc(k);
  const rows = full * 10;
  const cands = [k + 10 <= 99 ? k + 10 : k - 10, 100 - k, rows, k - 10, k + 10].filter(v => v >= 1 && v <= 99).map(pc);
  return wordQ(rng, 'What percentage of the hundred square is shaded?', ans, three(ans, cands, ['25%', '50%', '75%', '10%'], [pc(k + 10), pc(k - 10)]),
    { visual: { type: 'symmetry', grid, mirror: false }, say: 'What percentage of the hundred square is shaded?', hint: 'Count the shaded squares: each one is one per cent', hintIsData: false });
}

/** d2: three kinds of card, picked by the caller. */
function overHundred(rng: Rng): Question {
  const p = ri(rng, 2, 98), swap = p >= 10 ? (p % 10) * 10 + Math.floor(p / 10) : p + 1;
  const ans = String(p);
  const cands = [p + 10, 100 - p, swap, p - 10, p + 1].filter(v => v >= 1 && v <= 99 && v !== p).map(String);
  return wordQ(rng, `${pc(p)} = ?/100`, ans, three(ans, cands, ['1', '99', '10', '50'], [String(p + 10), String(p - 10)].filter(s => +s >= 1)),
    { say: `${says(p)} is how many out of one hundred?`, hint: 'Per cent means out of one hundred', hintIsData: false });
}
function asDecimal(rng: Rng): Question {
  const p = ri(rng, 2, 98), ans = fmt(dec(p, 2));
  const slips = [fmt(dec(p, 1)), fmt(dec(p, 3)), String(p)];
  return wordQ(rng, `Write ${pc(p)} as a decimal.`, ans, three(ans, slips, [fmt(dec(p + 10, 2))], [fmt(dec(p + 10, 2)), fmt(dec(p - 10, 2))]),
    { say: `Write ${says(p)} as a decimal.`, hint: 'Divide by one hundred: move each digit two places right', hintIsData: false });
}
function decimalToPc(rng: Rng): Question {
  const p = rng() < 0.5 ? ri(rng, 1, 9) * 10 : ri(rng, 2, 98), ans = pc(p);
  const slips = [`${fmt(dec(p, 1))}%`, `${p * 10}%`, `${fmt(dec(p, 2))}%`];
  const cands = [...new Set(slips)].filter(c => c !== ans);
  return wordQ(rng, `${fmt(dec(p, 2))} = ?%`, ans, three(ans, cands, [pc(p + 10), pc(p - 10 > 0 ? p - 10 : p + 20)], [pc(p + 10), pc(p - 10)]),
    { say: `${ks2Say(fmt(dec(p, 2)))} equals what per cent?`, hint: 'Multiply by one hundred', hintIsData: false });
}

/** The fractions Year 5 knows by heart, and the tenths/twentieths/twenty-fifths/fiftieths that scale to hundredths. */
const NC: [number, number][] = [[1, 2], [1, 4], [1, 5], [2, 5], [4, 5]];
function ncFraction(rng: Rng): [number, number] {
  if (rng() < 0.4) return pick(rng, NC);
  const d = pick(rng, [10, 20, 25, 50]);
  return [ri(rng, 1, d - 1), d];
}
function fractionToPc(rng: Rng): Question {
  const [n, d] = ncFraction(rng), p = n * 100 / d, ans = pc(p);
  const slips = [...(`${n}${d}`.length < 4 ? [`${n}${d}%`] : []), pc(n), pc(100 - p), `${p / 10}%`].filter(c => c !== ans && Number.isFinite(parseFloat(c)));
  return wordQ(rng, `${n}/${d} = ?%`, ans, three(ans, slips, [pc(p + 10), pc(p - 10 > 0 ? p - 10 : p + 20), '1%', '99%'], [pc(p + 10), pc(p - 10)]),
    { say: `${ks2Say(`${n}/${d}`)} equals what per cent?`, hint: 'Make the bottom number a hundred', hintIsData: false });
}
function fractionToDecimal(rng: Rng): Question {
  const [n, d] = ncFraction(rng), p = n * 100 / d, ans = fmt(dec(p, 2));
  const slips = [fmt(dec(p, 1)), fmt(dec(p, 3)), ...(`${n}${d}`.length < 4 ? [`0.${n}${d}`.replace(/0+$/, '')] : [])];
  return wordQ(rng, `${n}/${d} = ? Give it as a decimal.`, ans, three(ans, slips, [fmt(dec(p + 10, 2))], [fmt(dec(p + 10, 2)), fmt(dec(p - 10, 2))]),
    { say: `${ks2Say(`${n}/${d}`)} equals what decimal?`, hint: 'Make the bottom number a hundred, then write it as a decimal', hintIsData: false });
}

export const y5Percent: Generator = (level: Difficulty, rng) => {
  if (level === 1) return squareCard(rng);
  if (level === 2) return pick(rng, [overHundred, asDecimal, decimalToPc])(rng);
  return pick(rng, [fractionToPc, fractionToPc, fractionToDecimal, overHundred, decimalToPc])(rng);
};
