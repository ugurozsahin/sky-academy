// y6-order-ops (#1258): order of operations and brackets (NC 6M10). Every card carries the precedence slip as a decoy: the
// left-to-right result on a card without brackets, the result with the brackets ignored on a bracketed one. d1 three terms,
// d2 one pair of brackets, d3 four numbers (marked `slow`). Each form is built backwards from its quotients, so every ÷ is exact.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ, symSay } from './util';
import { dec, fmt } from './ks2num';

const f = (n: number) => fmt(dec(n, 0));
const digits = (n: number) => String(n).replace(/\D/g, '');
const lastOf = (n: number) => digits(n).slice(-1), leadOf = (n: number) => digits(n)[0];

/** A card: its prompt text, the answer and the precedence slip. `slip` is the left-to-right or brackets-ignored result. */
interface Card { text: string; ans: number; slip: number; }

/** The sum with its brackets read aloud: "bracket 2 plus 1 close bracket times 3 equals what". */
const say = (text: string) => symSay(text.replace(/\(/g, ' bracket ').replace(/\)/g, ' close bracket '));

/** d1: the higher-rank operation second, so doing it first (precedence) differs from reading order. */
const d1Forms: ((r: Rng) => Card)[] = [
  r => { const a = ri(r, 1, 50), b = ri(r, 2, 12), c = ri(r, 2, 12); return { text: `${a} + ${b} × ${c}`, ans: a + b * c, slip: (a + b) * c }; },
  r => { const b = ri(r, 2, 12), c = ri(r, 2, 12), a = ri(r, b * c, 50 + b * c); return { text: `${a} − ${b} × ${c}`, ans: a - b * c, slip: (a - b) * c }; },
  r => { const c = ri(r, 2, 12), a = c * ri(r, 1, Math.floor(50 / c)), k = ri(r, 2, 12); return { text: `${a} + ${c * k} ÷ ${c}`, ans: a + k, slip: a / c + k }; },
  r => { const c = ri(r, 2, 12), m = ri(r, 2, Math.floor(50 / c)), k = ri(r, 1, m); return { text: `${c * m} − ${c * k} ÷ ${c}`, ans: c * m - k, slip: m - k }; },
];

/** d2: brackets that change the answer; the slip drops the brackets and lets precedence run. */
const d2Forms: ((r: Rng) => Card)[] = [
  r => { const a = ri(r, 1, 50), b = ri(r, 1, 50), c = ri(r, 2, 12); return { text: `(${a} + ${b}) × ${c}`, ans: (a + b) * c, slip: a + b * c }; },
  r => { const a = ri(r, 2, 12), c = ri(r, 1, 30), b = c + ri(r, 1, 30); return { text: `${a} × (${b} − ${c})`, ans: a * (b - c), slip: a * b - c }; },
  r => { const c = ri(r, 2, 12), i = ri(r, 1, Math.floor(30 / c)), j = ri(r, 1, 12); return { text: `(${c * i} + ${c * j}) ÷ ${c}`, ans: i + j, slip: c * i + j }; },
  r => { const b = ri(r, 1, 30), c = ri(r, 1, 30), a = b + c + ri(r, 0, 20); return { text: `${a} − (${b} + ${c})`, ans: a - b - c, slip: a - b + c }; },
];

/** d3: four numbers on two levels, answer at most 1,000. */
const d3Forms: ((r: Rng) => Card)[] = [
  r => { const a = ri(r, 1, 50), b = ri(r, 2, 12), c = ri(r, 2, 12), d = ri(r, 1, a + b * c); return { text: `${a} + ${b} × ${c} − ${d}`, ans: a + b * c - d, slip: (a + b) * c - d }; },
  r => { const b = ri(r, 2, 12), c = ri(r, 2, 12), a = ri(r, b * c, 60 + b * c), d = ri(r, 1, 50); return { text: `${a} − ${b} × ${c} + ${d}`, ans: a - b * c + d, slip: (a - b) * c + d }; },
  r => { const a = ri(r, 1, 50), b = ri(r, 2, 12), d = ri(r, 1, 20), c = d + ri(r, 1, 12); return { text: `${a} + ${b} × (${c} − ${d})`, ans: a + b * (c - d), slip: a + b * c - d }; },
  r => { const a = ri(r, 1, 30), b = ri(r, 1, 30), c = ri(r, 2, 12), d = ri(r, 1, 50); return { text: `(${a} + ${b}) × ${c} − ${d}`, ans: (a + b) * c - d, slip: a + b * c - d }; },
];

/** Three distinct decoys: the slip first, then a last-digit twin and a leading-digit twin of the answer, then neighbours. */
function decoys(card: Card, rng: Rng): number[] {
  const { ans } = card, out = [card.slip];
  const ok = (v: number) => v >= 0 && v !== ans && !out.includes(v);
  const add = (cands: number[]) => { const v = cands.find(ok); if (v !== undefined && out.length < 3) out.push(v); };
  const near = [1, -1, 2, -2, 3, -3, 4, -4].map(m => ans + m), tens = [10, -10, 20, -20].map(m => ans + m);
  if (!out.some(v => lastOf(v) === lastOf(ans))) add(shuffle(rng, tens));
  if (!out.some(v => leadOf(v) === leadOf(ans))) add(shuffle(rng, near).filter(v => leadOf(v) === leadOf(ans)));
  add(shuffle(rng, near)); add(shuffle(rng, tens)); add(near); add(tens);
  return out.slice(0, 3);
}

function make(forms: ((r: Rng) => Card)[], rng: Rng): Question {
  for (let i = 0; i < 200; i++) {
    const card = pick(rng, forms)(rng);
    if (!Number.isInteger(card.slip) || card.slip < 0 || card.ans < 0 || card.ans > 1000 || card.slip === card.ans) continue;
    const prompt = `${card.text} = ?`;
    return wordQ(rng, prompt, f(card.ans), decoys(card, rng).map(f), { say: say(prompt) });
  }
  throw new Error('y6-order-ops: no card drawn');
}

export const y6OrderOps: Generator = (d: Difficulty, rng): Question => {
  const q = make(d === 1 ? d1Forms : d === 2 ? d2Forms : d3Forms, rng);
  return d === 3 ? { ...q, slow: true } : q;
};
