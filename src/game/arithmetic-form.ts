// The arithmetic paper form (#1232): a short run of context-free calculations tagged with STA content-domain
// codes and ordered the way KS2 Paper 1 orders them (framework §6.2: "an approximate order of difficulty").
// Pure logic — no screen, timer or mode (those are #1233 and #1235). Every number goes through `ks2num` and
// `fractions`, so no float ever reaches a prompt or an answer.
import { dec, fmt, mulDecByInt, mulPow10, divPow10, type Dec } from '../curriculum/ks2num';
import { type Frac, add, sub, mul, divWhole, fmtFrac } from '../curriculum/fractions';

type Rng = () => number;
export interface ArithQuestion { prompt: string; answer: string; /** A maker that covers two codes tags each item with the one it drew. */ code?: string }
export interface ArithItem { code: string; year: 3 | 4 | 5 | 6; rank: number; marks: 1 | 2; make(rng: Rng): ArithQuestion }
export interface ArithFormItem { code: string; rank: number; marks: 1 | 2; prompt: string; answer: string }

const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
const n = (x: number) => fmt(dec(x, 0));
const d = (x: Dec) => fmt(x);
const fr = (f: Frac) => fmtFrac(f);
const frM = (f: Frac) => fmtFrac(f, { mixed: true });
const eq = (prompt: string, answer: string): ArithQuestion => ({ prompt: `${prompt} =`, answer });

function mixed(rng: Rng, den: number): Frac { return { n: int(rng, 1, den - 1) + den * int(rng, 1, 3), d: den }; }

export const ARITH_ITEMS: readonly ArithItem[] = [
  { code: '3C1', year: 3, rank: 1, marks: 1, make: rng => {
    const a = int(rng, 100, 899), k = pick(rng, [int(rng, 1, 9), int(rng, 1, 9) * 10, int(rng, 1, 9) * 100]);
    return rng() < 0.5 ? eq(`${n(a)} + ${n(k)}`, n(a + k)) : eq(`${n(a)} − ${n(Math.min(k, a - 1))}`, n(a - Math.min(k, a - 1)));
  } },
  { code: '4C6a', year: 4, rank: 2, marks: 1, make: rng => {
    const a = int(rng, 2, 12), b = int(rng, 2, 12);
    return rng() < 0.5 ? eq(`${a} × ${b}`, n(a * b)) : eq(`${n(a * b)} ÷ ${b}`, n(a));
  } },
  { code: '4C6b', year: 4, rank: 3, marks: 1, make: rng => {
    const a = int(rng, 11, 99), v = int(rng, 0, 3);
    if (v === 0) return eq(`${a} × 1`, n(a));
    if (v === 1) return eq(`${a} × 0`, '0');
    if (v === 2) return eq(`${a} ÷ 1`, n(a));
    const x = int(rng, 2, 9), y = int(rng, 2, 9), z = int(rng, 2, 9);
    return eq(`${x} × ${y} × ${z}`, n(x * y * z));
  } },
  { code: '5C6b', year: 5, rank: 4, marks: 1, make: rng => {
    const p = pick(rng, [1, 2, 3] as const), sym = p === 1 ? '10' : p === 2 ? '100' : '1,000';
    if (rng() < 0.5) { const x = dec(int(rng, 2, 999), pick(rng, [0, 1, 2])); return eq(`${d(x)} × ${sym}`, d(mulPow10(x, p))); }
    const x = dec(int(rng, 2, 999), int(rng, 0, 3 - p));   // a quotient never runs past 3 decimal places (KS2's own cap)
    return eq(`${d(x)} ÷ ${sym}`, d(divPow10(x, p)));
  } },
  { code: '5C5d', year: 5, rank: 5, marks: 1, make: rng => {
    if (rng() < 0.6) { const a = int(rng, 2, 12); return eq(`${a}²`, n(a * a)); }
    const c = int(rng, 2, 6);
    return eq(`${c}³`, n(c ** 3));
  } },
  { code: '5C2', year: 5, rank: 6, marks: 1, make: rng => {
    const a = int(rng, 10000, 79999), b = int(rng, 10000, 79999);
    return rng() < 0.5 ? eq(`${n(a)} + ${n(b)}`, n(a + b)) : eq(`${n(Math.max(a, b))} − ${n(Math.min(a, b))}`, n(Math.abs(a - b)));
  } },
  { code: '5C7a', year: 5, rank: 7, marks: 1, make: rng => {
    const a = int(rng, 1000, 9999), b = int(rng, 2, 9);
    return eq(`${n(a)} × ${b}`, n(a * b));
  } },
  { code: '5C7b', year: 5, rank: 8, marks: 1, make: rng => {
    const b = int(rng, 2, 9), q = int(rng, 100, 999);
    return eq(`${n(q * b)} ÷ ${b}`, n(q));
  } },
  { code: '5F4', year: 5, rank: 9, marks: 1, make: rng => {
    const den = pick(rng, [2, 3, 4, 5]), k = int(rng, 2, 3), a: Frac = { n: int(rng, 1, den - 1), d: den }, b: Frac = { n: int(rng, 1, den * k - 1), d: den * k };
    if (rng() < 0.5) return eq(`${fr(a)} + ${fr(b)}`, frM(add(a, b)));
    const hi = a.n * b.d > b.n * a.d ? [a, b] : [b, a];
    return hi[0].n * hi[1].d === hi[1].n * hi[0].d ? eq(`${fr(a)} + ${fr(b)}`, frM(add(a, b))) : eq(`${fr(hi[0])} − ${fr(hi[1])}`, frM(sub(hi[0], hi[1])));
  } },
  { code: '6F9b', year: 6, rank: 10, marks: 1, make: rng => {
    const x = dec(int(rng, 101, 999), 2), k = int(rng, 2, 9);
    return eq(`${d(x)} × ${k}`, d(mulDecByInt(x, k)));
  } },
  { code: '6R2', year: 6, rank: 11, marks: 1, make: rng => {
    for (;;) {
      const pct = pick(rng, [5, 10, 15, 20, 25, 30, 40, 50, 60, 75]), amount = int(rng, 2, 100) * 10;
      if ((pct * amount) % 100 === 0) return eq(`${pct}% of ${n(amount)}`, n(pct * amount / 100));
    }
  } },
  { code: '6C9', year: 6, rank: 12, marks: 1, make: rng => {
    if (rng() < 0.5) {
      const dv = int(rng, 2, 9), q = int(rng, 2, 9), a = int(rng, 3, 20), b = int(rng, q + 1, 30);
      return eq(`(${a} + ${b}) − ${dv * q} ÷ ${dv}`, n(a + b - q));
    }
    const a = int(rng, 2, 20), b = int(rng, 2, 9), c = int(rng, 10, 20), e = int(rng, 1, 9);
    return eq(`${a} + ${b} × (${c} − ${e})`, n(a + b * (c - e)));
  } },
  { code: '6F4', year: 6, rank: 13, marks: 1, make: rng => {
    const [d1, d2] = pick(rng, [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [3, 2]] as const), a = mixed(rng, d1), b = mixed(rng, d2);
    return rng() < 0.5 || a.n * d2 === b.n * d1 ? eq(`${frM(a)} + ${frM(b)}`, frM(add(a, b))) : (a.n * d2 > b.n * d1 ? eq(`${frM(a)} − ${frM(b)}`, frM(sub(a, b))) : eq(`${frM(b)} − ${frM(a)}`, frM(sub(b, a))));
  } },
  { code: '6F5', year: 6, rank: 14, marks: 1, make: rng => {
    const proper = (): Frac => { const den = int(rng, 3, 9); return { n: int(rng, 1, den - 1), d: den }; };
    if (rng() < 0.5) { const x = proper(), y = proper(); return { ...eq(`${fr(x)} × ${fr(y)}`, fr(mul(x, y))), code: '6F5a' }; }
    const x = proper(), k = int(rng, 2, 9);
    return { ...eq(`${fr(x)} ÷ ${k}`, fr(divWhole(x, k))), code: '6F5b' };
  } },
  { code: '6C7a', year: 6, rank: 15, marks: 2, make: rng => {
    const a = int(rng, 1000, 9999), b = int(rng, 11, 99);
    return eq(`${n(a)} × ${b}`, n(a * b));
  } },
  { code: '6C7b', year: 6, rank: 16, marks: 2, make: rng => {
    const b = int(rng, 11, 99), q = int(rng, Math.ceil(1000 / b), Math.floor(9999 / b));
    return eq(`${n(q * b)} ÷ ${b}`, n(q));
  } },
];

/** `count` context-free items, no code twice while unused codes remain, sorted by rank. Year 5 never draws a 6xx code. */
export function arithmeticForm(rng: Rng, year: 'year5' | 'year6', count: number): ArithFormItem[] {
  const pool = ARITH_ITEMS.filter(it => year === 'year6' || it.year <= 5);
  const chosen: ArithItem[] = [];
  while (chosen.length < count) {
    const deck = [...pool];
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    chosen.push(...deck.slice(0, count - chosen.length));
  }
  return chosen.sort((a, b) => a.rank - b.rank).map(it => { const q = it.make(rng); return { code: q.code ?? it.code, rank: it.rank, marks: it.marks, prompt: q.prompt, answer: q.answer }; });
}
