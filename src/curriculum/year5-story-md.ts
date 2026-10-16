// y5-story-md (#1193): Year 5 scaling and simple-rate word problems (5M21). Each template is one fixed wording, so fractions are
// written in words and the card never carries a raw "3/4" for `say` to misread. A template draws its numbers so every division is
// exact, names its own answer and its one-step slip (the unit rate, or the unit fraction's value), and the wrong-operation slip.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';

interface Draw { nums: number[]; answer: number; oneStep: number; wrongOp: number }
interface Template { text: string; money?: boolean; draw: (rng: Rng) => Draw }

const pickOf = (rng: Rng, xs: number[]) => pick(rng, xs);
/** A scaling problem "p of something is v; how much for q?": numbers [p, p×u, q]. */
function scale(rng: Rng, ps: number[], us: number[], ms: number[]): Draw {
  const p = pickOf(rng, ps), u = pickOf(rng, us), q = p * pickOf(rng, ms), v = p * u;
  return { nums: [p, v, q], answer: u * q, oneStep: u, wrongOp: v + (q - p) };
}
/** "A rate for t units is v; how much for q?" with q not a multiple of t. */
function rate3(rng: Rng, ts: number[], us: number[], qs: number[]): Draw {
  const t = pickOf(rng, ts), u = pickOf(rng, us);
  let q = pickOf(rng, qs); while (q === t) q = pickOf(rng, qs);
  return { nums: [t, t * u, q], answer: u * q, oneStep: u, wrongOp: t * u + (q - t) };
}
/** A fraction k/n of a whole n×m: numbers [n×m]. */
function share(rng: Rng, n: number, k: number, ms: number[]): Draw {
  const m = pickOf(rng, ms), whole = n * m;
  return { nums: [whole], answer: k * m, oneStep: m, wrongOp: whole * n };
}
function unitRate(rng: Rng, ns: number[], us: number[], countFirst = false): Draw {
  const n = pickOf(rng, ns), u = pickOf(rng, us);
  return { nums: countFirst ? [n, n * u] : [n * u, n], answer: u, oneStep: n * u * n, wrongOp: n * u - n };
}

/** [d1 ×4, d2 ×4, d3 ×4]. The prompt is the text with each `#` filled from `nums` in order. */
export const BANK: Template[][] = [
  [
    { text: 'A recipe for # uses # g of flour. How much for #?', draw: r => scale(r, [2, 3, 4, 5, 6], [25, 50, 75, 100, 150], [2, 3, 4, 5]) },
    { text: 'A pump moves # litres a minute. How many litres in # minutes?', draw: r => { const a = ri(r, 12, 90), t = ri(r, 3, 12); return { nums: [a, t], answer: a * t, oneStep: a, wrongOp: a + t }; } },
    { text: '# pens cost £#. How much do # pens cost?', money: true, draw: r => scale(r, [2, 3, 4, 5], [2, 3, 4, 5, 6, 8, 9], [2, 3, 4, 5]) },
    { text: 'A car uses # litres to go # km. How far on # litres?', draw: r => scale(r, [2, 3, 4, 5], [12, 15, 18, 20, 25], [2, 3, 4, 5]) },
  ],
  [
    { text: 'A model is a tenth of the height of a # m tower. How tall is it?', draw: r => share(r, 10, 1, [3, 4, 5, 6, 7, 8, 9, 12, 15, 20, 25]) },
    { text: 'A drawing is a quarter of the width of a # cm poster. How wide is it?', draw: r => share(r, 4, 1, [6, 8, 9, 12, 15, 18, 20, 25, 30, 40]) },
    { text: '# tickets cost £#. What does 1 ticket cost?', money: true, draw: r => unitRate(r, [4, 5, 6, 8, 9], [3, 4, 5, 6, 7, 9, 12], true) },
    { text: 'A runner covers # km in # hours. How far in 1 hour?', draw: r => unitRate(r, [3, 4, 5, 6, 8], [6, 7, 8, 9, 10, 12, 14]) },
  ],
  [
    { text: 'Three quarters of a # km trail has been walked. How far?', draw: r => share(r, 4, 3, [12, 15, 18, 25, 30, 40, 50, 60, 75]) },
    { text: '# kg cost £#. How much do # kg cost?', money: true, draw: r => rate3(r, [2, 3, 4, 5, 6], [2, 3, 4, 5, 6, 8, 9], [7, 8, 9, 10, 12, 15]) },
    { text: 'Three fifths of # sweets are red. How many are red?', draw: r => share(r, 5, 3, [12, 15, 18, 20, 24, 30, 40, 50, 60]) },
    { text: 'A train goes # km in # hours. How far in # hours?', draw: r => rate3(r, [2, 3, 4, 5], [40, 45, 50, 60, 75, 80], [7, 8, 9, 10, 12]) },
  ],
];
export const MAX = 90;
const lab = (v: number, money?: boolean) => (money ? '£' : '') + fmt(dec(v, 0));
const sameLead = (a: number, b: number) => String(a)[0] === String(b)[0];

/** Three whole-number decoys. The one-step slip first (never replaced), then the wrong-operation slip; the answer's last-digit
 *  and leading-digit twins are swapped in over the others when no decoy already holds them (the #1058 leak limit). */
function decoys(d: Draw): number[] {
  const a = d.answer;
  const ok = (v: number, have: number[]) => Number.isInteger(v) && v >= 1 && v <= 10000 && v !== a && !have.includes(v);
  const ds: number[] = [];
  for (const v of [d.oneStep, d.wrongOp, a * 10, a + 10, a - 10, a + 100, a + 20]) if (ds.length < 3 && ok(v, ds)) ds.push(v);
  const kept = new Set<number>([0]);
  const lastHit = (v: number) => v % 10 === a % 10, leadHit = (v: number) => sameLead(v, a);
  for (const hit of [lastHit, leadHit]) { const i = ds.findIndex(hit); if (i >= 0) kept.add(i); }
  const twin = (hit: (v: number) => boolean, cands: number[]) => {
    if (ds.some(hit)) return;
    const v = cands.find(c => ok(c, ds) && hit(c)), slot = [2, 1].find(k => !kept.has(k));
    if (v !== undefined && slot !== undefined) { ds[slot] = v; kept.add(slot); }
  };
  twin(lastHit, [a + 10, a - 10, a + 20, a - 20, a + 100]);
  twin(leadHit, [a + 1, a - 1, a + 2, a - 2, a + 3]);
  return ds;
}

export const y5StoryMd: Generator = (d: Difficulty, rng): Question => {
  const t = pick(rng, BANK[d - 1]);
  const w = t.draw(rng);
  let i = 0;
  const prompt = t.text.replace(/#/g, () => fmt(dec(w.nums[i++], 0)));
  const ds = decoys(w);
  if (ds.length < 3 || prompt.length > MAX) throw new Error(`y5-story-md: no card fits at d${d}`);
  const card = wordQ(rng, prompt, lab(w.answer, t.money), ds.map(v => lab(v, t.money)), { say: ks2Say(prompt) });
  return d === 3 ? { ...card, slow: true } : card;
};
