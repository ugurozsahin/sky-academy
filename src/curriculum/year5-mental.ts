// y5-mental (#1183): add and subtract large numbers in your head (5M8), pick the answer. d1 multiples of 1,000 within
// 100,000, or ±10/100/1,000 on a 5-digit number; d2 multiples of 1,000/10,000 across a boundary, to 1,000,000; d3 compensation
// with a near multiple (46,735 + 9,999) or a missing number (? − 30,000 = 125,400). Decoys are the slips: the wrong place,
// a lost exchange, a compensation off by one, the inverse operation. Answers stay in 0..999,999.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';

const MAX = 999999;
const f = (n: number) => fmt(dec(n, 0));
const first = (s: string) => s[0];

interface Card { prompt: string; spoken: string; answer: number; named: number[]; }

/** The card text for `a ± b = ?`, with the place, exchange and (optionally) compensation decoys. */
function calc(a: number, b: number, add: boolean, diff = 0): Card {
  const answer = add ? a + b : a - b, sign = add ? '+' : '−';
  const tz = String(b).length - String(b).replace(/0+$/, '').length, step = 10 ** tz;
  const shift = (x: number) => (add ? a + x : a - x);
  const named = diff ? [answer + diff, answer - diff, shift(b * 10), shift(b / 10)] : [answer + step, shift(b * 10), answer - step, shift(b / 10), answer + step * 10, answer - step * 10];
  return { prompt: `${f(a)} ${sign} ${f(b)} = ?`, spoken: `${f(a)} ${add ? 'plus' : 'minus'} ${f(b)}`, answer, named };
}

/** A missing-number card: `? ± b = c` or `a ± ? = c`. The inverse-operation slip is the first decoy. */
function missing(a: number, b: number, add: boolean, rng: Rng): Card {
  const c = add ? a + b : a - b, sign = add ? '+' : '−';
  if (pick(rng, [true, false])) {
    // ? ± b = c, so the answer is a; the slip is to apply the same operation to c.
    return { prompt: `? ${sign} ${f(b)} = ${f(c)}`, spoken: `What number ${add ? 'plus' : 'minus'} ${f(b)} makes ${f(c)}`, answer: a, named: [add ? c + b : c - b, add ? a + b * 10 : a - b * 10, a + 10 ** (String(b).length - String(b).replace(/0+$/, '').length)] };
  }
  // a ± ? = c, so the answer is b; the slip is to add where it should subtract (or the reverse).
  return { prompt: `${f(a)} ${sign} ? = ${f(c)}`, spoken: `${f(a)} ${add ? 'plus' : 'minus'} what number makes ${f(c)}`, answer: b, named: [a + c, c - b, b * 10, b / 10] };
}

function draw(d: Difficulty, rng: Rng): Card {
  if (d === 1) {
    if (pick(rng, [true, false])) {
      const add = pick(rng, [true, false]), b = ri(rng, 1, 9) * 1000;
      return add ? calc(ri(rng, 1, 90) * 1000, b, true) : calc(ri(rng, 10, 99) * 1000, b, false);
    }
    const add = pick(rng, [true, false]), b = pick(rng, [10, 100, 1000]), n = ri(rng, 10001, 98999);
    return calc(n, b, add);
  }
  if (d === 2) {
    const u = pick(rng, [1000, 10000]), add = pick(rng, [true, false]);
    if (add) { const a = ri(rng, 2, 900000 / u) * u, b = ri(rng, 2, Math.floor((MAX - a) / u)) * u; return calc(a, b, true); }
    const a = ri(rng, 20, 99) * 10000 + ri(rng, 0, 9) * 1000, b = ri(rng, 2, Math.floor(a / u) - 1) * u;
    return calc(a, b, false);
  }
  const kind = pick(rng, ['comp', 'comp', 'missing'] as const), add = pick(rng, [true, false]);
  if (kind === 'missing') {
    if (add) { const total = pick(rng, [100000, 200000, 500000, 1000000]), b = ri(rng, 1, total / 10000 - 1) * 10000 + pick(rng, [0, 5000, 2500]); return missing(total - b, b, true, rng); }
    const b = ri(rng, 2, 80) * 1000, a = ri(rng, 100000, 900000) + b; return missing(a - (a % 100), b, false, rng);
  }
  const near = pick(rng, [{ b: 9999, diff: 1 }, { b: 4998, diff: 2 }, { b: 1999, diff: 1 }, { b: 99999, diff: 1 }, { b: 19998, diff: 2 }, { b: 2997, diff: 3 }]);
  const a = add ? ri(rng, near.b + 100, MAX - near.b - 1) : ri(rng, near.b + 1000, MAX);
  return calc(a, near.b, add, near.diff);
}

/** Misconception decoys first; then one that shares the answer's last digit, and one its leading digit, so neither gives it away. */
function options(c: Card, rng: Rng): number[] {
  const ok = (v: number, out: number[]) => Number.isInteger(v) && v >= 0 && v <= MAX && v !== c.answer && !out.includes(v);
  const out: number[] = [];
  for (const v of c.named) if (out.length < 3 && ok(v, out)) out.push(v);
  const share = (v: number, g: (s: string) => string) => g(String(v)) === g(String(c.answer));
  const last = (s: string) => s.slice(-1);
  const slot = () => out.length < 3 ? out.length : 2;
  if (!out.some(v => share(v, last))) { const v = [c.answer + 10, c.answer - 10].find(x => ok(x, out)); if (v !== undefined) out[slot()] = v; }
  if (!out.some(v => share(v, first))) {
    const step = 10 ** Math.max(1, String(c.answer).length - 2);
    const v = shuffle(rng, [c.answer + step, c.answer - step, c.answer + 2 * step, c.answer - 2 * step]).find(x => ok(x, out) && share(x, first));
    if (v !== undefined) { const i = out.length < 3 ? out.length : out.findIndex(o => !share(o, last)); out[i < 0 ? 2 : i] = v; }
  }
  for (let k = 1; out.length < 3; k++) for (const v of [c.answer + k * 10, c.answer - k * 10, c.answer + k * 100, c.answer - k * 100]) if (out.length < 3 && ok(v, out)) out.push(v);
  return out;
}

export const y5Mental: Generator = (d, rng): Question => {
  const c = draw(d, rng);
  return wordQ(rng, c.prompt, f(c.answer), options(c, rng).map(f), { say: ks2Say(`${c.spoken}?`) });
};
