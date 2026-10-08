// y5-story (#1184): multi-step adding and subtracting stories to 999,999. Each template names its operations, so a test recomputes
// the answer from the numbers in the prompt. Decoys come from `mistakes.ts` first (#1058); the result one step early (the child
// who stops short) and the wrong last operation swap in for them without breaking its two guarantees (last and leading digit).
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ } from './util';
import { dec, fmt } from './ks2num';
import { decoysFor } from './mistakes';

type Op = '+' | '-';
/** [ops, text, question]. The text holds one `#` per number; the first is the start, each `op` then applies in turn. */
export const BANK: [Op[], string, string][] = [
  [['-', '-'], 'A hall holds #. # sit, # more sit.', 'Seats left?'],
  [['+', '-'], 'A shelf has #. # added, # taken.', 'Books now?'],
  [['+', '+'], 'A school had # stickers, then # and #.', 'In all?'],
  [['-', '+'], 'A shop had # tins. # sold, # added.', 'Tins now?'],
  [['-', '-'], 'A lorry held # boxes. # then # left.', 'Boxes left?'],
  [['+', '+'], 'A choir sold # tickets, then # and #.', 'In all?'],
  [['+', '-'], 'A park had #. # came, # left.', 'People now?'],
  [['-', '+'], 'A bakery made #. # sold, # more baked.', 'Buns now?'],
  [['+', '-'], 'A club has #. # join, # leave.', 'Members now?'],
  [['+', '-', '-'], 'A shelf has #. # added, # and # taken.', 'Books left?'],
  [['-', '+', '-'], 'A shop had #. # sold, # added, # sold.', 'Left?'],
  [['+', '+', '-'], 'A hall has #. # in, # in, # out.', 'Now?'],
  [['-', '+', '+'], 'A depot has #. # go, # and # arrive.', 'Now?'],
  [['-', '-', '+'], 'A depot had #. # went, # went, # came.', 'Now?'],
  [['+', '+', '+'], 'A band sold #, #, # and # tickets.', 'In all?'],
];
/** The two-step stories (three numbers); d3 is the three-step ones. */
const TWO = BANK.slice(0, 9);
const THREE = BANK.slice(9);

const f = (n: number) => fmt(dec(n, 0));
const apply = (v: number, op: Op, n: number) => op === '+' ? v + n : v - n;
/** [start range, change range, ceiling] */
const LADDER: Record<Difficulty, [[number, number], [number, number], number]> = {
  1: [[2000, 9000], [300, 4000], 10000],
  2: [[10000, 90000], [1000, 30000], 99999],
  3: [[100000, 800000], [10000, 90000], 999999],
};

/** The start, the changes and every running result, all 1 to the ceiling. */
function numbers(d: Difficulty, ops: Op[], rng: Rng): { vals: number[]; runs: number[] } {
  const [[s0, s1], [c0, c1], max] = LADDER[d];
  for (;;) {
    const vals = [ri(rng, s0, s1), ...ops.map(() => ri(rng, c0, c1))];
    const runs = [vals[0]];
    ops.forEach((op, i) => runs.push(apply(runs[i], op, vals[i + 1])));
    if (runs.every(v => v >= 1 && v <= max)) return { vals, runs };
  }
}

const sharesDigits = (ds: number[], answer: number) => ds.some(v => v % 10 === answer % 10) && ds.some(v => String(v)[0] === String(answer)[0]);

/** Three whole-number decoys: #1058's first, with the result one step early and the wrong last operation swapped in for them,
 *  never losing the answer's last-digit and leading-digit twins. `null` when the early result cannot stay. */
function decoys(d: Difficulty, ops: Op[], n: { vals: number[]; runs: number[] }, rng: Rng): number[] | null {
  const max = LADDER[d][2], last = ops[ops.length - 1], c = n.vals[n.vals.length - 1];
  const early = n.runs[n.runs.length - 2], answer = n.runs[n.runs.length - 1];
  const calc = { a: dec(early, 0), b: dec(c, 0), answer: dec(answer, 0) };
  // ÷10 shifts are decimals: a whole-number card drops them.
  const ds = decoysFor(last === '+' ? 'add' : 'sub', calc, 6, rng, { min: 1, max }).filter(x => x.dp === 0).map(x => x.v).slice(0, 3);
  if (ds.length < 3 || !sharesDigits(ds, answer)) return null;
  const placed: number[] = [];
  for (const v of [early, apply(early, last === '+' ? '-' : '+', c)]) {
    if (v < 1 || v > max || v === answer || ds.includes(v)) continue;
    const i = ds.findIndex((x, k) => !placed.includes(x) && sharesDigits(ds.map((y, j) => j === k ? v : y), answer));
    if (i >= 0) { ds[i] = v; placed.push(v); }
  }
  return ds.includes(early) ? ds : null;
}

export const y5Story: Generator = (d, rng): Question => {
  for (;;) {
    const [ops, text, ask] = pick(rng, d < 3 ? TWO : THREE);
    const n = numbers(d, ops, rng);
    let i = 0;
    const prompt = text.replace(/#/g, () => f(n.vals[i++])) + ' ' + ask;
    if (prompt.length > 60) continue; // three lines at 390 px (#1051; the test measures it)
    const ds = decoys(d, ops, n, rng);
    if (!ds) continue;
    const card = wordQ(rng, prompt, f(n.runs[n.runs.length - 1]), ds.map(f), { say: prompt });
    return d === 3 ? { ...card, slow: true } : card;
  }
};
