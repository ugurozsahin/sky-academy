// y6-longdiv (#1255): long and short division, and what a remainder means (NC 6M6–7). d1 pick-one, an exact quotient; d2 build
// "34 r 7" digit by digit (the ` r ` is pre-printed); d3 pick-one, the remainder as a mixed number in its simplest form or
// rounded up or down to suit a story. All sums are whole numbers, so the oracle is q × d + r = n with 0 ≤ r < d.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ, q } from './util';
import { buildQ } from './build';
import { dec, fmt } from './ks2num';
import { simplify } from './fractions';

export const f = (n: number) => fmt(dec(n, 0));
const digits = (s: string) => s.replace(/\D/g, '');
const twins = (ds: string[], a: string) => ds.some(v => digits(v).slice(-1) === digits(a).slice(-1)) && ds.some(v => digits(v)[0] === digits(a)[0]);

/** Swap a filler (never the first `keep`, the named slips) for a fill so the answer shares its last and leading digit with a decoy. */
function keepTwins(out: string[], fills: string[], answer: string, keep: number): void {
  for (let i = keep; i < out.length && !twins(out, answer); i++) {
    const swap = fills.find(v => v !== answer && !out.includes(v) && twins(out.map((x, j) => j === i ? v : x), answer));
    if (swap !== undefined) out[i] = swap;
  }
}

/** Three distinct decoys: `named` first, then `fills`, with twins of the answer's last and leading digit kept. */
export function decoys(named: string[], fills: string[], answer: string): string[] {
  const out: string[] = [];
  for (const v of [...named, ...fills]) if (out.length < 3 && v !== answer && !out.includes(v)) out.push(v);
  keepTwins(out, fills, answer, 1);
  return out;
}

/** d1: a short-division-friendly divisor and a whole quotient. */
function d1(rng: Rng): Question {
  const d = pick(rng, [11, 12, 15, 20, 25]), quotient = ri(rng, Math.ceil(110 / d), Math.floor(9999 / d));
  const sum = `${f(quotient * d)} ÷ ${d} = ?`;
  const ok = (v: number) => Number.isInteger(v) && v > 0;
  // A place-value shift, a lost exchange, then the quotient out by one.
  const named = [quotient * 10, quotient % 10 === 0 ? quotient / 10 : quotient - 10, quotient + pick(rng, [1, -1])];
  const fills = shuffle(rng, [10, 100, 1, 2].flatMap(m => [quotient + m, quotient - m]));
  const ds = decoys(named.filter(ok).map(f), fills.filter(ok).map(f), f(quotient));
  return wordQ(rng, sum, f(quotient), ds, { say: q(sum).say });
}

/** d2: a two-digit divisor, a remainder that is not 0 and at most 5 digits in all. */
function d2(rng: Rng): Question {
  const d = ri(rng, 11, 99), r = ri(rng, 1, d - 1);
  const quotient = ri(rng, Math.max(8, Math.ceil((100 - r) / d)), Math.floor((9999 - r) / d));
  const sum = `${f(quotient * d + r)} ÷ ${d} = ?`;
  return buildQ(rng, { prompt: sum, say: `${q(sum).say}. Build the answer with the remainder.`, answer: `${quotient} r ${r}`, total: 8, hint: 'Slice the digits in order' });
}

/** [text with `#` for the dividend then the divisor, the question, whether the answer rounds up]. */
export const BANK: [string, string, boolean][] = [
  ['# children go in minibuses of #.', 'How many are needed?', true],
  ['# pencils go in boxes of #.', 'How many full boxes?', false],
  ['# guests sit at tables of #.', 'How many tables are needed?', true],
  ['# eggs go in trays of #.', 'How many full trays?', false],
  ['# books go on shelves of #.', 'How many shelves are needed?', true],
  ['# stickers go in packs of #.', 'How many full packs?', false],
  ['# fans ride in coaches of #.', 'How many are needed?', true],
  ['# buns go in bags of #.', 'How many full bags?', false],
];

/** d3, rounding in context: round up for "needed", down for "full". */
function context(rng: Rng): Question {
  const [text, ask, up] = pick(rng, BANK), d = ri(rng, 11, 45), r = ri(rng, 1, d - 1);
  const quotient = ri(rng, 12, Math.floor((9999 - r) / d) > 200 ? 200 : Math.floor((9999 - r) / d));
  const prompt = `${text.replace('#', f(quotient * d + r)).replace('#', String(d))} ${ask}`;
  const answer = up ? quotient + 1 : quotient;
  const named = [up ? quotient : quotient + 1, `${quotient} r ${r}`, r].map(v => typeof v === 'number' ? f(v) : v);
  const fills = shuffle(rng, [10, 1, 2, 20].flatMap(m => [answer + m, answer - m])).filter(v => v > 0).map(f);
  return wordQ(rng, prompt, f(answer), decoys(named, fills, f(answer)), { say: `${prompt} Pick the answer.` });
}

/** d3, the remainder as a fraction: a mixed number in its simplest form. */
function mixed(rng: Rng): Question {
  const d = ri(rng, 11, 48), r = ri(rng, 1, d - 1);
  const quotient = ri(rng, 10, Math.min(300, Math.floor((9999 - r) / d)));
  const n = quotient * d + r, frac = simplify({ n: r, d });
  const show = (w: number, part = `${frac.n}/${frac.d}`) => `${w} ${part}`;
  const answer = show(quotient), plain = `${r}/${d}`;
  const prompt = `${f(n)} ÷ ${d} as a mixed number in its simplest form`;
  // The unsimplified form (when there is one) and the remainder read as a decimal, then the quotient out by one.
  const named = [frac.d === d ? '' : show(quotient, plain), r % 10 === 0 ? '' : `${quotient}.${r}`, show(quotient + pick(rng, [1, -1]))].filter(Boolean);
  const fills = shuffle(rng, [1, -1, 2, -2, 10, -10].map(m => quotient + m).filter(v => v > 0).map(v => show(v)));
  return wordQ(rng, prompt, answer, decoys(named, fills, answer), { say: `${n} divided by ${d} as a mixed number in its simplest form. Pick the answer.` });
}

export const y6LongDiv: Generator = (d: Difficulty, rng): Question => d === 1 ? d1(rng) : d === 2 ? d2(rng) : rng() < 0.5 ? mixed(rng) : context(rng);
