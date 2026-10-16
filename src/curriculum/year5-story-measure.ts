// y5-story-measure (#1207): Year 5 measure word problems in decimal notation (5M40). d1 adds or subtracts tenths in one unit, d2 multiplies or
// divides by a whole number (money to 2 dp), d3 takes two steps or scales. Every number is a scaled integer (`ks2num`), so no label carries
// a float artefact. Money is written `£x.yy` on the card and spoken "x pounds yy" (never "x.y pounds", #652). Decoys are named slips, tried in
// order: a decimal place shift (×10), the wrong or missed operation, the other unit; `finish()` fills with a step either side if short.
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, ri, wordQ } from './util';
import { addDec, dec, divPow10, fmt, mulDecByInt, mulPow10, subDec, type Dec } from './ks2num';
import { ks2Say } from './ks2say';

/** How a template writes a number: `q` a plain decimal, `m` a money amount in pence (dp 2). */
interface Fmt { q: (d: Dec) => string; m: (d: Dec) => string }
interface Draw { text: (f: Fmt) => string; answer: Dec; cands: Dec[]; money?: boolean }

const moneyLabel = (d: Dec) => '£' + fmt(d, { fixedDp: 2 });
function moneySay(d: Dec): string {
  const pounds = Math.floor(d.v / 100), pence = d.v % 100, p = pounds === 1 ? 'pound' : 'pounds';
  if (!pounds) return `${pence} pence`;
  return pence === 0 ? `${pounds} ${p}` : pence < 10 ? `${pounds} ${p} and ${pence} pence` : `${pounds} ${p} ${pence}`;
}
const WRITE: Fmt = { q: d => fmt(d), m: moneyLabel };
const SPEAK: Fmt = { q: d => fmt(d), m: moneySay };

const tenths = (v: number) => dec(v, 1);
const whole = (v: number) => dec(v, 0);
/** A price in pence, a multiple of 5 whose pence part is 0 or at least 10, so it can be spoken without a leading zero. */
const price = (rng: Rng, lo: number, hi: number): Dec => { let p = 5 * ri(rng, lo / 5, hi / 5); for (let i = 0; i < 50 && p % 100 !== 0 && p % 100 < 10; i++) p = 5 * ri(rng, lo / 5, hi / 5); return dec(p % 100 !== 0 && p % 100 < 10 ? p + 10 : p, 2); };
const shift = (a: Dec) => mulPow10(a, 1);
const small = (a: Dec) => divPow10(a, 1);

// d1: one step, add or subtract tenths of one unit.
const sub = (name: (a: string, b: string) => string) => (rng: Rng): Draw => {
  const a = ri(rng, 20, 99), b = ri(rng, 3, a - 8), A = tenths(a), B = tenths(b), ans = subDec(A, B);
  return { text: f => name(f.q(A), f.q(B)), answer: ans, cands: [shift(ans), addDec(A, B), small(ans)] };
};
const add = (name: (a: string, b: string) => string) => (rng: Rng): Draw => {
  const a = ri(rng, 6, 59), b = ri(rng, 6, 59), A = tenths(a), B = tenths(b), ans = addDec(A, B);
  return { text: f => name(f.q(A), f.q(B)), answer: ans, cands: [shift(ans), subDec(A.v >= B.v ? A : B, A.v >= B.v ? B : A), small(ans)] };
};

// d2: one step, multiply or divide by a whole number.
const mulQ = (name: (n: number, u: string) => string) => (rng: Rng): Draw => {
  const n = ri(rng, 3, 9), U = tenths(ri(rng, 12, 48)), ans = mulDecByInt(U, n);
  return { text: f => name(n, f.q(U)), answer: ans, cands: [shift(ans), addDec(U, whole(n)), small(ans)] };
};
const mulMoney = (rng: Rng): Draw => {
  const n = ri(rng, 3, 9), P = price(rng, 105, 495), ans = mulDecByInt(P, n);
  return { text: f => `${n} tickets cost ${f.m(P)} each. What is the total cost?`, answer: ans, cands: [shift(ans), addDec(P, dec(n * 100, 2)), small(ans)], money: true };
};
const divQ = (name: (n: number, t: string) => string) => (rng: Rng): Draw => {
  const n = ri(rng, 3, 9), ans = tenths(ri(rng, 12, 48)), T = mulDecByInt(ans, n);
  return { text: f => name(n, f.q(T)), answer: ans, cands: [shift(ans), mulDecByInt(T, n), small(ans)] };
};
const divMoney = (rng: Rng): Draw => {
  const n = ri(rng, 3, 9), ans = price(rng, 55, 295), T = mulDecByInt(ans, n);
  return { text: f => `${n} pens cost ${f.m(T)} in all. What does one pen cost?`, answer: ans, cands: [shift(ans), mulDecByInt(T, n), small(ans)], money: true };
};

// d3: two steps, or scaling.
const recipe = (rng: Rng): Draw => {
  const p = pick(rng, [2, 4, 5]), u = pick(rng, [25, 50, 75, 100]), q = pick(rng, [3, 6, 8, 10, 12].filter(x => x !== p)), amt = p * u, ans = whole(u * q);
  const things = pick(rng, ['flour', 'sugar', 'rice']);
  return { text: () => `A recipe for ${p} uses ${amt} g of ${things}. How many grams for ${q}?`, answer: ans, cands: [shift(ans), whole(u), whole(amt + q - p), small(ans)] };
};
const kgPlusG = (rng: Rng): Draw => {
  const a = pick(rng, [3, 5, 7, 12, 15, 25]), g = pick(rng, [150, 250, 350, 450, 50]), ans = whole(a * 100 + g);
  return { text: f => `How many grams is ${f.q(tenths(a))} kg + ${g} g?`, answer: ans, cands: [small(ans), whole(a + g), shift(ans), whole(a * 10 + g)] };
};
const change = (rng: Rng): Draw => {
  const n = ri(rng, 2, 4), P = price(rng, 120, 290), note = pick(rng, [10, 20].filter(x => x * 100 > n * P.v + 100)), total = mulDecByInt(P, n), N = dec(note * 100, 2), ans = subDec(N, total);
  const what = pick(rng, ['books', 'toys', 'cards']);
  return { text: f => `${n} ${what} cost ${f.m(P)} each. How much change from ${f.m(N)}?`, answer: ans, cands: [shift(ans), total, subDec(N, P), small(ans)], money: true };
};
const jug = (rng: Rng): Draw => {
  const n = ri(rng, 3, 6), b = ri(rng, 2, 4), a = ri(rng, n * b + 5, n * b + 30), A = tenths(a), B = tenths(b), used = mulDecByInt(B, n), ans = subDec(A, used);
  return { text: f => `A jug holds ${f.q(A)} litres. ${n} cups of ${f.q(B)} litres are poured out. Litres left?`, answer: ans, cands: [shift(ans), subDec(A, B), addDec(A, used), small(ans)] };
};
const scaleMoney = (rng: Rng): Draw => {
  const c = ri(rng, 2, 4), q = pick(rng, [5, 6, 8, 10].filter(x => x !== c)), U = price(rng, 25, 95), T = mulDecByInt(U, c), ans = mulDecByInt(U, q);
  return { text: f => `${c} apples cost ${f.m(T)}. How much do ${q} apples cost?`, answer: ans, cands: [shift(ans), U, mulDecByInt(T, q), small(ans)], money: true };
};

const BANK: Array<Array<(rng: Rng) => Draw>> = [
  [
    sub((a, b) => `A ribbon is ${a} m long. ${b} m is cut off. How many metres are left?`),
    sub((a, b) => `A tank has ${a} litres. ${b} litres leak out. How many litres are left?`),
    sub((a, b) => `A bag of ${a} kg has ${b} kg used. How many kg are left?`),
    add((a, b) => `A box is ${a} kg and a tin is ${b} kg. Total mass in kg?`),
    add((a, b) => `A jug has ${a} litres of juice and ${b} litres of water. Litres in all?`),
    add((a, b) => `A path is ${a} km, then ${b} km more. How many km in all?`),
  ],
  [
    mulQ((n, u) => `${n} bags of ${u} kg each. What is the total mass in kg?`),
    mulQ((n, u) => `One stride is ${u} m. How many metres in ${n} strides?`),
    mulMoney,
    divQ((n, t) => `${n} equal bags weigh ${t} kg in all. Mass of one bag in kg?`),
    divQ((n, t) => `${t} litres is shared equally into ${n} bottles. Litres in each?`),
    divMoney,
  ],
  [recipe, kgPlusG, change, jug, scaleMoney],
];
const HINTS = ['Add to put together, take away to find what is left', 'Multiply to find the total, divide to share equally', 'Work out each step in turn, then check the units'];

/** Up to three distinct, positive decoys from the named slips, then a step either side of the answer. */
function finish(rng: Rng, d: Difficulty, w: Draw): Question {
  const lab = (x: Dec) => (w.money ? moneyLabel(x) : fmt(x));
  const ans = lab(w.answer), step = w.money ? dec(10, 2) : w.answer.dp === 0 ? whole(w.answer.v >= 100 ? 10 : 1) : tenths(1);
  const ds: string[] = [];
  for (const c of [...w.cands, addDec(w.answer, step), subDec(w.answer, step), addDec(w.answer, mulDecByInt(step, 2))]) {
    const s = lab(c);
    if (ds.length < 3 && c.v > 0 && s !== ans && !ds.includes(s)) ds.push(s);
  }
  const prompt = w.text(WRITE), say = ks2Say(w.text(SPEAK).replace(/\?/g, '.'));
  const q = wordQ(rng, prompt, ans, ds, { say, hint: HINTS[d - 1], hintIsData: false });
  return d === 3 ? { ...q, slow: true } : q;
}

export const y5StoryMeasure: Generator = (d: Difficulty, rng) => finish(rng, d, pick(rng, BANK[d - 1])(rng));
