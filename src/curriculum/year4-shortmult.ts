// y4-shortmult (#1140): 2- and 3-digit × 1-digit with the formal written method. d1 is pick-one; d2 mixes pick-one and
// build; d3 is build only (the sum stays on the card, the child slices the answer's digits, at most four slots).
// Pick-one decoys are the slips a written method invites: a dropped carry, the tens digit multiplied as ones, adding
// instead of multiplying; ±10 / ±1 fills guarantee one decoy shares the answer's last and leading digit (#1058).
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, shuffle, wordQ, q } from './util';
import { buildQ } from './build';
import { dec, fmt } from './ks2num';

const f = (n: number) => fmt(dec(n, 0));

/** Columns (units upward) whose product plus the incoming carry reaches 10, so a carry moves on. */
export function shortCarries(a: number, m: number): number[] {
  const out: number[] = [];
  let carry = 0;
  for (let p = 1; p <= a; p *= 10) {
    const t = Math.floor(a / p) % 10 * m + carry;
    carry = Math.floor(t / 10);
    out.push(carry);
  }
  return out;
}
export const carryCount = (a: number, m: number) => shortCarries(a, m).filter(c => c > 0).length;

/** A multiplication whose digit count and carry count fit; `exact` pins the count, else it is a minimum. */
function draw(digits: 2 | 3, carries: number, exact: boolean, rng: Rng): { a: number; m: number } {
  const lo = digits === 2 ? 10 : 100, hi = digits === 2 ? 99 : 999;
  for (let i = 0; i < 2000; i++) {
    const a = ri(rng, lo, hi), m = ri(rng, 2, 9), c = carryCount(a, m);
    if (exact ? c === carries : c >= carries) return { a, m };
  }
  return digits === 2 ? { a: 24, m: 3 } : { a: 346, m: 7 };
}

/** The answers a child gets by dropping one carry (the carry out of a column is never added to the next). */
export function droppedCarries(a: number, m: number): number[] {
  const ans = a * m;
  return shortCarries(a, m).map((c, i) => ans - c * 10 ** (i + 1)).filter(v => v >= 10 && v !== ans);
}

/** A pick-one draw: the same as `draw`, but only a sum whose dropped-carry slip is a real number (never 0). */
function drawPick(carries: number, exact: boolean, rng: Rng): { a: number; m: number } {
  for (let i = 0; i < 50; i++) { const r = draw(2, carries, exact, rng); if (droppedCarries(r.a, r.m).length) return r; }
  return { a: 24, m: 3 };
}

function pickOne(a: number, m: number, rng: Rng): Question {
  const ans = a * m, max = 99 * 9;
  const ok = (v: number) => Number.isInteger(v) && v >= 10 && v <= max && v !== ans;
  const dropped = droppedCarries(a, m).filter(ok);
  const digitsum = String(a).split('').reduce((s, d) => s + Number(d), 0) * m;
  const rules = [digitsum, a + m].filter(ok);
  const picked: number[] = [];
  const add = (v: number | undefined) => { if (v !== undefined && ok(v) && !picked.includes(v) && picked.length < 3) picked.push(v); };
  const fill = (same: (v: number) => boolean) => {
    for (let d = 1; d <= 40; d++) for (const s of shuffle(rng, [1, -1])) { const v = ans + s * d * (same === sameLast ? 10 : 1); if (ok(v) && same(v) && !picked.includes(v)) return v; }
    return undefined;
  };
  const sameLast = (v: number) => v % 10 === ans % 10;
  const sameLead = (v: number) => String(v)[0] === String(ans)[0];
  add(shuffle(rng, dropped)[0]);
  if (!picked.some(sameLast)) add(fill(sameLast));
  if (!picked.some(sameLead)) add(fill(sameLead));
  for (const v of shuffle(rng, rules)) add(v);
  for (const v of shuffle(rng, dropped)) add(v);
  for (let d = 1; picked.length < 3 && d < 100; d++) add(ans + (rng() < 0.5 ? d : -d));
  const sum = `${f(a)} × ${m} = ?`;
  return wordQ(rng, sum, f(ans), picked.map(f), { say: q(sum).say });
}

function build(a: number, m: number, rng: Rng): Question {
  const sum = `${f(a)} × ${m} = ?`;
  return buildQ(rng, { prompt: sum, say: `${q(sum).say}. Slice the digits of the answer.`, answer: f(a * m), total: 6, hint: 'Slice the digits in order' });
}

export const y4ShortMult: Generator = (d: Difficulty, rng): Question => {
  if (d === 1) { const { a, m } = drawPick(1, true, rng); return pickOne(a, m, rng); }
  if (d === 2) {
    if (rng() < 0.5) { const { a, m } = drawPick(1, false, rng); return pickOne(a, m, rng); }
    const { a, m } = draw(3, 1, true, rng); return build(a, m, rng);
  }
  const { a, m } = draw(3, 2, false, rng); return build(a, m, rng);
};
