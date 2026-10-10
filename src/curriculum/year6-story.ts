// y6-story (#1259): multi-step word problems with all four operations (NC 6M11–13), and estimating to check. d1 two steps of adding
// and subtracting, d2 two steps with × or ÷, d3 "398 × 21 is about …?" after rounding each number. Each template names its
// operations, so a test recomputes the answer from the numbers in the prompt. The result after the first step (the child who
// stops early) is always a decoy at d1–d2; at d3 the estimate ×10 and ÷10 are.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ, shuffle, q } from './util';
import { f, decoys } from './year6-longdiv';

export type Op = '+' | '-' | '×' | '÷';
type Range = [number, number];
/** [ops, text, question, ranges]. One `#` per number in the text: the start, then the operand of each op in turn, applied left to right. */
export type Template = [Op[], string, string, [Range, Range, Range]];
const BIG: [Range, Range, Range] = [[1000, 6000], [150, 3500], [150, 3500]];
export const BANK: Template[] = [
  [['+', '-'], 'A library had #. It got #, gave away #.', 'Books now?', BIG],
  [['-', '+'], 'A shop had #. # sold, # delivered.', 'Tins now?', BIG],
  [['-', '-'], 'A hall has #. # taken, then # more.', 'Seats left?', BIG],
  [['+', '+'], 'A club had #. # joined, then # more.', 'Members now?', BIG],
  [['×', '-'], '# rows of # seats. # seats are empty.', 'Seats full?', [[12, 40], [15, 60], [20, 300]]],
  [['×', '+'], '# boxes of # pens. # more pens arrive.', 'Pens now?', [[12, 40], [12, 48], [50, 900]]],
  [['÷', '+'], '# pens shared by # pupils. Each gets # more.', 'Pens each?', [[600, 4800], [12, 36], [15, 200]]],
  [['÷', '-'], '# apples in bags of #. # bags are sold.', 'Bags left?', [[600, 4800], [12, 30], [5, 30]]],
  [['+', '÷'], '# red, # blue beads, shared by # pupils.', 'Each gets?', [[200, 2500], [200, 2500], [6, 12]]],
  [['-', '÷'], '# pens, # lost. The rest go in boxes of #.', 'Boxes?', [[600, 3000], [40, 400], [6, 12]]],
  [['+', '×'], '# adults and # children carry # bags each.', 'Bags?', [[120, 900], [120, 900], [3, 9]]],
  [['-', '×'], '# pupils, # away. Each pupil here has # pens.', 'Pens?', [[120, 900], [20, 100], [3, 9]]],
];
const D1 = BANK.slice(0, 4), D2 = BANK.slice(4);
/** The card holds three lines at 390 px (#1051); a test measures every prompt. */
export const MAX = 60;
const CEILING: Record<Difficulty, number> = { 1: 10000, 2: 100000, 3: 100000 };

export const apply = (v: number, op: Op, n: number) => op === '+' ? v + n : op === '-' ? v - n : op === '×' ? v * n : v / n;
/** The start and every running result of `ops` over `vals`. */
export const runs = (ops: Op[], vals: number[]): number[] => ops.reduce((r, op, i) => [...r, apply(r[i], op, vals[i + 1])], [vals[0]]);

/** Operands from the template's ranges, nudged so each ÷ is exact; every running result a whole number from 1 to the ceiling. */
function numbers(t: Template, d: Difficulty, rng: Rng): { vals: number[]; runs: number[] } {
  const [ops, , , ranges] = t;
  for (let tries = 0; tries < 10000; tries++) {
    const vals = ranges.map(([lo, hi]) => ri(rng, lo, hi));
    if (ops[0] === '÷') vals[0] -= vals[0] % vals[1];
    else if (ops[1] === '÷') { const r = apply(vals[0], ops[0], vals[1]) % vals[2]; vals[1] += ops[0] === '+' ? -r : r; }
    const rs = runs(ops, vals);
    if (vals.every(v => v >= 1 && v <= CEILING[d]) && rs.every(v => Number.isInteger(v) && v >= 1 && v <= CEILING[d])) return { vals, runs: rs };
  }
  throw new Error(`y6-story: no numbers fit at d${d}`);
}

const inverse: Record<Op, Op> = { '+': '-', '-': '+', '×': '÷', '÷': '×' };
function story(d: Difficulty, rng: Rng): Question {
  for (let tries = 0; tries < 1000; tries++) {
    const t = pick(rng, d === 1 ? D1 : D2), [ops, text, ask] = t, n = numbers(t, d, rng);
    let i = 0;
    const prompt = text.replace(/#/g, () => f(n.vals[i++])) + ' ' + ask;
    if (prompt.length > MAX) continue;
    const answer = n.runs[2], early = n.runs[1], c = n.vals[2], max = CEILING[d];
    // The dropped step, the last operation turned round, then a place-value shift.
    const named = [early, apply(early, inverse[ops[1]], c), answer * 10 <= max ? answer * 10 : answer / 10];
    const fills = shuffle(rng, [10, 100, 1, 2, 20, 1000].flatMap(m => [answer + m, answer - m]));
    const ok = (v: number) => Number.isInteger(v) && v >= 1 && v <= max;
    const ds = decoys(named.filter(ok).map(f), fills.filter(ok).map(f), f(answer));
    if (ds.length < 3 || !ds.includes(f(early))) continue;
    return wordQ(rng, prompt, f(answer), ds, { say: q(prompt).say });
  }
  throw new Error(`y6-story: no card fits at d${d}`);
}

export const round = (v: number, to: number) => Math.round(v / to) * to;
const tie = (v: number, to: number) => v % to === to / 2;
const digits3 = (rng: Rng) => { for (;;) { const v = ri(rng, 101, 999); if (!tie(v, 100)) return v; } };
const digits2 = (rng: Rng) => { for (;;) { const v = ri(rng, 12, 98); if (!tie(v, 10)) return v; } };
const digits4 = (rng: Rng) => { for (;;) { const v = ri(rng, 1001, 9999); if (!tie(v, 1000)) return v; } };
/** [a, b, place of a, place of b, op]: three-digit by two-digit, two by two, then four-digit sums and differences. */
function pair(rng: Rng): [number, number, number, number, Op] {
  const k = ri(rng, 0, 3);
  if (k === 0) return [digits3(rng), digits2(rng), 100, 10, '×'];
  if (k === 1) return [digits2(rng), digits2(rng), 10, 10, '×'];
  const a = digits4(rng), b = digits4(rng);
  return k === 2 ? [a, b, 1000, 1000, '+'] : [Math.max(a, b), Math.min(a, b), 1000, 1000, '-'];
}

/** d3: the answer combines the rounded numbers; the decoys are the estimate ×10 and ÷10 and an estimate with one number rounded. */
function estimate(rng: Rng): Question {
  for (;;) {
    const [a, b, pa, pb, op] = pair(rng), est = apply(round(a, pa), op, round(b, pb));
    if (est < 1000 || round(a, pa) === round(b, pb)) continue;
    const prompt = `${f(a)} ${op === '-' ? '−' : op} ${f(b)} is about …? Round each number first.`;
    const named = [est * 10, est / 10, apply(round(a, pa), op, b), apply(a, op, round(b, pb))];
    const fills = shuffle(rng, [100, 1000, 200, 500].flatMap(m => [est + m, est - m]));
    const ds = decoys(named.filter(v => v > 0 && v !== est).map(f), fills.filter(v => v > 0).map(f), f(est));
    return { ...wordQ(rng, prompt, f(est), ds, { say: q(prompt).say }), slow: true };
  }
}

export const y6Story: Generator = (d, rng): Question => d === 3 ? estimate(rng) : story(d, rng);
