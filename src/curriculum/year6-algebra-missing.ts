// y6-algebra (#1272): express and solve missing-number problems algebraically (NC 6M31). d1 one step (n + 17 = 42, 7 × n = 56),
// d2 two steps (3n + 5 = 26, 4n − 6 = 30), d3 a missing angle or length written with a letter (triangle, straight line,
// rectangle perimeter), marked `slow`. The first decoy is always the slip: the inverse not applied, or one step only.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { ks2Say } from './ks2say';
import { degCard } from './year6-missingangles';

const digits = (n: number) => String(n).replace(/\D/g, '');
const lastOf = (n: number) => digits(n).slice(-1), leadOf = (n: number) => digits(n)[0];
const SAY: Record<string, string> = { '×': ' times ', '÷': ' divided by ', '+': ' plus ', '−': ' minus ', '=': ' equals ' };
/** An equation read aloud: operators as words, an implied product "3n" as "3 n". */
const sayEq = (s: string) => s.replace(/(\d)([a-z])/g, '$1 $2').replace(/[×÷+−=]/g, c => SAY[c]).replace(/\s+/g, ' ').trim();

/** A card: the equation, the answer n and its slips (the one every card must offer comes first). */
interface Card { eq: string; ans: number; slips: number[]; }
const card = (eq: string, ans: number, slips: number[]): Card => ({ eq, ans, slips });

const d1Forms: ((r: Rng) => Card)[] = [
  r => { const n = ri(r, 2, 150), b = ri(r, 3, 50); return card(`n + ${b} = ${n + b}`, n, [n + 2 * b, n + b]); },
  r => { const c = ri(r, 2, 100), b = ri(r, 3, 60); return card(`n − ${b} = ${c}`, c + b, [c - b, c, c + 2 * b]); },
  r => { const a = ri(r, 2, 12), n = ri(r, 2, 20); return card(`${a} × n = ${a * n}`, n, [a * n - a, a * n + a, a * n * a < 1000 ? a * n * a : n + a]); },
  r => { const a = ri(r, 2, 10), c = ri(r, 2, 20); return card(`n ÷ ${a} = ${c}`, a * c, [a + c, c, a * c + a]); },
];

const d2Forms: ((r: Rng) => Card)[] = [
  r => { const a = ri(r, 2, 9), n = ri(r, 1, 25), b = ri(r, 1, 20), c = a * n + b; return card(`${a}n + ${b} = ${c}`, n, [c - b, (c + b) / a, n + 1, n - 1]); },
  r => { const a = ri(r, 2, 9), n = ri(r, 2, 25), b = ri(r, 1, Math.min(20, a * n - 1)), c = a * n - b; return card(`${a}n − ${b} = ${c}`, n, [c + b, (c - b) / a, n + 1, n - 1]); },
];

/** Three distinct decoys: the card's first slip, then last- and leading-digit twins of the answer (#1058), then its other slips. */
function decoys(c: Card, rng: Rng): number[] {
  const { ans } = c, out = [c.slips[0]];
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v !== ans && !out.includes(v);
  const add = (cands: number[]) => { const v = cands.find(ok); if (v !== undefined && out.length < 3) out.push(v); };
  const near = [1, -1, 2, -2, 3, -3, 4, -4].map(m => ans + m), tens = [10, -10, 20, -20].map(m => ans + m);
  const rest = c.slips.slice(1);
  if (ans >= 20) {
    if (!out.some(v => lastOf(v) === lastOf(ans))) add(shuffle(rng, [...rest, ...tens]).filter(v => lastOf(v) === lastOf(ans)));
    if (!out.some(v => leadOf(v) === leadOf(ans))) add(shuffle(rng, [...rest, ...near]).filter(v => leadOf(v) === leadOf(ans)));
  }
  add(rest); add(rest); add(shuffle(rng, near)); add(shuffle(rng, tens)); add(near); add(tens);
  return out.slice(0, 3);
}

/** d3: a missing angle or length written with a letter. */
const d3Forms: ((r: Rng) => Question)[] = [
  rng => {
    const b = 5 * ri(rng, 4, 28), c = 5 * ri(rng, 4, 28), a = 180 - b - c;
    if (a < 10 || a === b || a === c) return d3Forms[0](rng);
    const prompt = `The angles in a triangle are ${b}°, ${c}° and a. What is a?`;
    return degCard(rng, prompt, a, [360 - (b + c), 180 - c, b + c], { say: ks2Say(prompt), slow: true });
  },
  rng => {
    const k = 5 * ri(rng, 4, 32), prompt = `Angles on a straight line: ${k}° and x. What is x?`;
    return degCard(rng, prompt, 180 - k, [360 - k, k, 180 + k], { say: ks2Say(prompt), slow: true });
  },
  rng => {
    const l = ri(rng, 4, 20), w = ri(rng, 2, l - 1), p = 2 * (l + w), c = { eq: '', ans: w, slips: [p - l, p / 2, p - 2 * l] };
    const prompt = `Rectangle: perimeter ${p} cm, length ${l} cm, width w. What is w?`;
    return { ...wordQ(rng, prompt, `${w} cm`, decoys(c, rng).map(v => `${v} cm`), { say: ks2Say(prompt) }), slow: true };
  },
];

export const y6Algebra: Generator = (d: Difficulty, rng): Question => {
  if (d === 3) return pick(rng, d3Forms)(rng);
  for (let i = 0; i < 200; i++) {
    const c = pick(rng, d === 1 ? d1Forms : d2Forms)(rng);
    if (!Number.isInteger(c.slips[0]) || c.slips[0] < 0 || c.slips[0] === c.ans) continue;
    const prompt = `${c.eq}. What is n?`;
    return wordQ(rng, prompt, String(c.ans), decoys(c, rng).map(String), { say: `${sayEq(c.eq)}. What is n?` });
  }
  throw new Error('y6-algebra: no card drawn');
};
