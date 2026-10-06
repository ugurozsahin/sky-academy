// y4-story (#1137): two-step adding and subtracting stories to 9,999. Each template names its two operations, so a test
// recomputes the answer from the numbers in the prompt. Decoys come from `mistakes.ts` first (#1058); the first step's
// result (a child who stops early) and the wrong second operation swap in for them without breaking its two guarantees.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ, UNIT_WORD } from './util';
import { dec, fmt } from './ks2num';
import { decoysFor } from './mistakes';

type Op = '+' | '-';
/** [unit, ops, start, first step, second step, question]. Each sentence holds one `#`, where its number (and unit) goes. */
export const BANK: [string, [Op, Op], string, string, string, string][] = [
  ['', ['+', '+'], 'A farm has # eggs.', 'It gets # more.', 'Then # more.', 'How many now?'],
  ['', ['+', '+'], 'A band sold # tickets.', '# more sold Friday.', '# more Saturday.', 'How many in all?'],
  ['', ['+', '-'], 'A library has # books.', 'It buys # more.', 'It lends #.', 'How many left?'],
  ['', ['+', '-'], 'A ground has # fans.', '# more arrive.', '# leave.', 'How many now?'],
  ['', ['-', '+'], 'A shop has # apples.', '# are sold.', '# more arrive.', 'How many now?'],
  ['', ['-', '+'], 'A car park has # cars.', '# leave.', '# arrive.', 'How many now?'],
  ['', ['-', '-'], 'A shop has # pens.', '# are sold.', '# are lost.', 'How many left?'],
  ['', ['-', '-'], 'A stall has # pies.', '# sell by noon.', '# sell by tea.', 'How many left?'],
  ['ml', ['+', '+'], 'A tank has #.', '# is added.', 'Then #.', 'How much now?'],
  ['g', ['+', '-'], 'A bag has #.', '# is added.', '# is used.', 'How much is left?'],
  ['m', ['-', '+'], 'A rope is #.', '# is cut off.', '# is added.', 'How long now?'],
  ['ml', ['-', '-'], 'A jug has #.', '# is poured.', '# is spilt.', 'How much is left?'],
];
const SPOKEN_ASK: Record<string, string> = {
  'How many now?': 'How many are there now?', 'How many in all?': 'How many are there in all?', 'How many left?': 'How many are left over?',
  'How much now?': 'How much is there now?', 'How much is left?': 'How much is left over?', 'How long now?': 'How long is it now?',
};
const COUNTS = BANK.filter(t => !t[0]);

const f = (n: number) => fmt(dec(n, 0));
const amount = (d: Difficulty, rng: Rng) => d === 1 ? ri(rng, 20, 400) : d === 2 ? ri(rng, 100, 999) : ri(rng, 1000, 4999);
const apply = (v: number, op: Op, n: number) => op === '+' ? v + n : v - n;

/** The start, the two changes and the two results, every one 1–9,999 (1–999 at d1). */
function numbers(d: Difficulty, ops: [Op, Op], rng: Rng): { a: number; b: number; c: number; mid: number; answer: number } {
  const max = d === 1 ? 999 : 9999;
  for (;;) {
    const a = d === 1 ? ri(rng, 200, 900) : ri(rng, d === 2 ? 1000 : 2000, 9999), b = amount(d, rng), c = amount(d, rng);
    const mid = apply(a, ops[0], b), answer = apply(mid, ops[1], c);
    if (mid >= 1 && answer >= 1 && mid <= max && answer <= max) return { a, b, c, mid, answer };
  }
}

const sharesDigits = (ds: number[], answer: number) => ds.some(v => v % 10 === answer % 10) && ds.some(v => String(v)[0] === String(answer)[0]);

/** Three whole-number decoys: #1058's first, with the first step's result and the wrong second operation swapped in for them,
 *  never losing the answer's last-digit and leading-digit twins. `null` when the first step's result cannot stay. */
function decoys(d: Difficulty, ops: [Op, Op], n: { b: number; c: number; mid: number; answer: number }, rng: Rng): number[] | null {
  const max = d === 1 ? 999 : 9999, { c, mid, answer } = n;
  const calc = { a: dec(mid, 0), b: dec(c, 0), answer: dec(answer, 0) };
  // ÷10 shifts are decimals: a whole-number card drops them.
  const ds = decoysFor(ops[1] === '+' ? 'add' : 'sub', calc, 6, rng, { min: 1, max }).filter(x => x.dp === 0).map(x => x.v).slice(0, 3);
  if (ds.length < 3 || !sharesDigits(ds, answer)) return null;
  const placed: number[] = [];
  for (const v of [mid, apply(mid, ops[1] === '+' ? '-' : '+', c)]) {
    if (v < 1 || v > max || v === answer || ds.includes(v)) continue;
    const i = ds.findIndex((x, k) => !placed.includes(x) && sharesDigits(ds.map((y, j) => j === k ? v : y), answer));
    if (i >= 0) { ds[i] = v; placed.push(v); }
  }
  return ds.includes(mid) ? ds : null;
}

export const y4Story: Generator = (d, rng): Question => {
  for (;;) {
    const [unit, ops, start, s1, s2, ask] = pick(rng, d === 3 && rng() < 0.5 ? BANK : COUNTS);
    const n = numbers(d, ops, rng);
    const fill = (t: string, v: number, spoken: boolean) => t.replace('#', unit ? `${f(v)} ${spoken ? UNIT_WORD[unit] : unit}` : f(v));
    const story = (spoken: boolean) => [fill(start, n.a, spoken), fill(s1, n.b, spoken), fill(s2, n.c, spoken), spoken ? SPOKEN_ASK[ask] : ask].join(' ');
    if (story(false).length > 72) continue; // three lines at 390 px (#1051)
    const ds = decoys(d, ops, n, rng);
    if (!ds) continue;
    const label = (v: number) => unit ? `${f(v)} ${unit}` : f(v);
    const card = wordQ(rng, story(false), label(n.answer), ds.map(label), { say: story(true) });
    return d === 3 ? { ...card, slow: true } : card;
  }
};
