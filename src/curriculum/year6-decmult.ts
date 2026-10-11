// y6-decmult (#1266): multiply a decimal by a whole number (NC 6M21, 0.4 × 2 = 0.8). d1 one decimal place × 2–9, d2 two decimal
// places × 2–9 (both pick-one), d3 a measures story, 1–2 dp × 11–25, built digit by digit (`buildQ`, the point stays fixed,
// `slow`). Every value is a scaled integer (`ks2num.ts`), never a float, and every label goes through `fmt` (no trailing zero).
// Decoys are the slips: a place-value shift, a neighbouring table fact, the glued whole and decimal parts, a dropped carry.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { buildQ } from './build';
import { dec, fmt, mulDecByInt, mulPow10, divPow10, addDec, subDec, parseNum, type Dec } from './ks2num';
import { ks2Say } from './ks2say';

const MAX = 1000;
const lab = (a: Dec) => fmt(a);
const canon = (a: Dec): Dec => parseNum(fmt(a))!;
const digits = (s: string) => s.replace(/\D/g, '');
const twins = (ds: string[], ans: string) => ds.some(d => digits(d).slice(-1) === digits(ans).slice(-1)) && ds.some(d => digits(d)[0] === digits(ans)[0]);

/** The glued slip: whole × k and decimal digits × k printed side by side (2.35 × 4 → 8.140, printed 8.14). */
function glued(a: Dec, k: number): Dec | null {
  const p = 10 ** a.dp, whole = Math.floor(a.v / p), frac = a.v % p;
  return parseNum(`${whole * k}.${frac * k}`);
}

/** Swap a slip (never the first, a named one) for a fill until the options hold a last- and a leading-digit twin of the answer (#1058). */
function keepTwins(out: string[], fills: string[], ans: string): void {
  for (let i = 1; i < out.length && !twins(out, ans); i++) {
    const swap = fills.find(f => !out.includes(f) && twins(out.map((x, j) => j === i ? f : x), ans));
    if (swap) out[i] = swap;
  }
}

/** Three decoys: the named slips first, then fills of the answer by tens of its last place, keeping the twins. */
function decoys(a: Dec, k: number, ans: Dec, rng: Rng): string[] {
  const named: (Dec | null)[] = [
    rng() < 0.5 ? mulPow10(ans, 1) : divPow10(ans, 1),                       // place-value shift
    mulDecByInt(a, rng() < 0.5 || k === 2 ? k + 1 : k - 1),                  // neighbouring table fact
    glued(a, k),
    rng() < 0.5 ? addDec(ans, dec(10, ans.dp)) : subDec(ans, dec(10, ans.dp)), // dropped carry
    rng() < 0.5 ? divPow10(ans, 1) : mulPow10(ans, 1),
  ];
  const labels = (ds: (Dec | null)[]) => ds.filter((d): d is Dec => !!d && d.v > 0).map(d => lab(canon(d))).filter(l => l !== lab(ans) && Number(l) < MAX);
  const fills = labels(shuffle(rng, [1, 10, 100].flatMap(m => [addDec(ans, dec(m, ans.dp)), subDec(ans, dec(m, ans.dp))])));
  const out = [...new Set([...labels(named), ...fills])].slice(0, 3);
  keepTwins(out, fills, lab(ans));
  return out;
}

function pickOne(rng: Rng, a: Dec): Question {
  const k = ri(rng, 2, 9), ans = canon(mulDecByInt(a, k)), expr = `${lab(a)} × ${k}`;
  return wordQ(rng, `${expr} = ?`, lab(ans), decoys(a, k, ans, rng), { say: `What is ${ks2Say(expr)}?`, hint: 'Multiply as if there were no point, then put the point back', hintIsData: false });
}

/** A decimal with `dp` places, one whole digit 1–9 (or 0 at one place) and a non-zero last digit. */
function randDec(rng: Rng, dp: 1 | 2): Dec {
  for (;;) {
    const v = dp === 1 ? ri(rng, 1, 99) : ri(rng, 101, 999);
    if (v % 10) return dec(v, dp);
  }
}

const stories: ((a: string, k: number) => string)[] = [
  (a, k) => `A ribbon is ${a} m long. How long are ${k} ribbons, in metres?`,
  (a, k) => `A bag of flour weighs ${a} kg. How heavy are ${k} bags, in kilograms?`,
  (a, k) => `A bottle holds ${a} litres. How much do ${k} bottles hold, in litres?`,
  (a, k) => `A rope is ${a} m long. How long are ${k} ropes, in metres?`,
  (a, k) => `One plank is ${a} m long. How long are ${k} planks laid end to end, in metres?`,
  (a, k) => `A box of apples weighs ${a} kg. How heavy are ${k} boxes, in kilograms?`,
];

/** d3: a 1–2 dp number × 11–25 in a measures story; the product is never whole, so the point is always fixed on the card. */
function built(rng: Rng): Question {
  for (;;) {
    const a = randDec(rng, rng() < 0.5 ? 1 : 2), k = ri(rng, 11, 25), ans = canon(mulDecByInt(a, k));
    if (ans.dp === 0) continue;
    const answer = lab(ans), slots = digits(answer).length, prompt = pick(rng, stories)(lab(a), k);
    return { ...buildQ(rng, { prompt, say: `${ks2Say(prompt.slice(0, -1))}. Build the answer.`, answer, total: Math.min(10, slots + 3), hint: 'Slice the digits in order' }), slow: true };
  }
}

export const y6DecMult: Generator = (d: Difficulty, rng: Rng): Question => d === 1 ? pickOne(rng, randDec(rng, 1)) : d === 2 ? pickOne(rng, randDec(rng, 2)) : built(rng);
