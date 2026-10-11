// y6-formulae (#1270): substitute into simple formulae (NC 6M29). d1 one operation (y = 4 × n, y = n + 17), d2 two operations in
// algebraic notation (y = 3n + 2), d3 a formula from maths (P = 2(l + w), A = l × w, d = 2 × r, a = 180 − (b + c), V = l × w × h),
// marked `slow`. Decoys are the slips: "3n" read as 35, the order slip, a dropped bracket, the wrong formula.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt } from './ks2num';

const f = (n: number) => fmt(dec(n, 0));
const digits = (n: number) => String(n).replace(/\D/g, '');
const lastOf = (n: number) => digits(n).slice(-1), leadOf = (n: number) => digits(n)[0];

/** A card: the formula text, the lines asked, the answer and its slips (the one every card must offer first). */
interface Card { formula: string; ask: string; given: string; say: string; ans: number; slips: number[]; }

const WORDS: Record<string, string> = { '×': ' times ', '+': ' plus ', '−': ' minus ', '=': ' equals ', '(': ' bracket ', ')': ' close bracket ' };
/** A formula read aloud: operators as words, an implied product "3n" as "3 n". */
const say = (s: string) => s.replace(/(\d)([a-z])/g, '$1 $2').replace(/[×+−=()]/g, c => WORDS[c]).replace(/\s+/g, ' ').trim();

const card = (formula: string, v: string, given: string, ans: number, slips: number[]): Card => {
  const ask = `What is ${v} when ${given}?`;
  return { formula, ask, given, ans, slips, say: `${say(formula)}. ${say(ask)}` };
};

const d1Forms: ((r: Rng) => Card)[] = [
  r => { const k = ri(r, 2, 12), n = ri(r, 2, 12); return card(`y = ${k} × n`, 'y', `n = ${n}`, k * n, [k + n, Number(`${k}${n}`)]); },
  r => { const c = ri(r, 1, 50), n = ri(r, 1, 50); return card(`y = n + ${c}`, 'y', `n = ${n}`, n + c, [Math.abs(n - c), Number(`${n}${c}`)]); },
  r => { const c = ri(r, 1, 25), n = ri(r, c, 50); return card(`y = n − ${c}`, 'y', `n = ${n}`, n - c, [n + c, c - n]); },
];

const d2Forms: ((r: Rng) => Card)[] = [
  r => { const a = ri(r, 2, 9), n = ri(r, 2, 12), b = ri(r, 1, 20); return card(`y = ${a}n + ${b}`, 'y', `n = ${n}`, a * n + b, [Number(`${a}${n}`) + b, a * (n + b), a + n + b]); },
  r => { const a = ri(r, 2, 9), n = ri(r, 2, 12), b = ri(r, 1, a * n); return card(`y = ${a}n − ${b}`, 'y', `n = ${n}`, a * n - b, [Number(`${a}${n}`) - b, a * (n - b), a + n - b]); },
];

const d3Forms: ((r: Rng) => Card)[] = [
  r => { const l = ri(r, 2, 20), w = ri(r, 2, 15); return card('P = 2(l + w)', 'P', `l = ${l} and w = ${w}`, 2 * (l + w), [2 * l + w, l * w, l + w]); },
  r => { const l = ri(r, 2, 20), w = ri(r, 2, 15); return card('A = l × w', 'A', `l = ${l} and w = ${w}`, l * w, [2 * (l + w), l + w, 2 * l + w]); },
  r => { const x = ri(r, 3, 50); return card('d = 2 × r', 'd', `r = ${x}`, 2 * x, [x + 2, x * x, Number(`2${x}`)]); },
  r => { const b = ri(r, 10, 90), c = ri(r, 10, 80); return card('a = 180 − (b + c)', 'a', `b = ${b} and c = ${c}`, 180 - b - c, [180 - b + c, b + c, 180 - b]); },
  r => { const l = ri(r, 2, 10), w = ri(r, 2, 10), h = ri(r, 2, 10); return card('V = l × w × h', 'V', `l = ${l}, w = ${w} and h = ${h}`, l * w * h, [l + w + h, l * w, l * w + h]); },
];

/** Three distinct decoys: the card's first slip, then last- and leading-digit twins of the answer (#1058), then its other slips. */
function decoys(c: Card, rng: Rng): number[] {
  const { ans } = c, out = [c.slips[0]];
  const ok = (v: number) => v >= 0 && v !== ans && !out.includes(v);
  const add = (cands: number[]) => { const v = cands.find(ok); if (v !== undefined && out.length < 3) out.push(v); };
  const near = [1, -1, 2, -2, 3, -3, 4, -4].map(m => ans + m), tens = [10, -10, 20, -20].map(m => ans + m);
  if (ans >= 20) {
    if (!out.some(v => lastOf(v) === lastOf(ans))) add(shuffle(rng, [...c.slips.slice(1), ...tens]).filter(v => lastOf(v) === lastOf(ans)));
    if (!out.some(v => leadOf(v) === leadOf(ans))) add(shuffle(rng, [...c.slips.slice(1), ...near]).filter(v => leadOf(v) === leadOf(ans)));
  }
  add(c.slips.slice(1)); add(c.slips.slice(1)); add(shuffle(rng, near)); add(shuffle(rng, tens)); add(near); add(tens);
  return out.slice(0, 3);
}

export const y6Formulae: Generator = (d: Difficulty, rng): Question => {
  const forms = d === 1 ? d1Forms : d === 2 ? d2Forms : d3Forms;
  for (let i = 0; i < 200; i++) {
    const c = pick(rng, forms)(rng);
    if (c.ans < 0 || c.slips[0] < 0 || c.slips[0] === c.ans) continue;
    const q = wordQ(rng, `${c.formula}. ${c.ask}`, f(c.ans), decoys(c, rng).map(f), { say: c.say });
    return d === 3 ? { ...q, slow: true } : q;
  }
  throw new Error('y6-formulae: no card drawn');
};
