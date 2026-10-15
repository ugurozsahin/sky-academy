// y4-mistake (#1173): a worked column sum with exactly one wrong column. The child slices that column's letter (Th, H, T, O).
// The wrong answer is made by one of two real slips from #1058: the dropped carry (or, taking away, the exchanged ten
// not taken from the next column), or a one-off fact slip inside a single column. Each moves the true result by ±10^k,
// so a draw is kept only if the shown answer differs from the true one in exactly one printed digit.
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, ri, wordQ } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';
import { borrows, carries } from './year4-column';

export type Kind = 'carry' | 'slip';
export interface Wrong { kind: Kind; col: number; value: number }
export const MINUS = '−';
/** Column letters from the ones up: column 0 is O, column 3 is Th. */
export const LETTERS = ['O', 'T', 'H', 'Th'] as const;
const SAY = ['ones', 'tens', 'hundreds', 'thousands'];
const f = (n: number) => fmt(dec(n, 0));
const len = (n: number) => String(n).length;

/** Columns (0 = ones) whose addition passes a carry up, or whose subtraction takes an exchange from the next column. */
export function carryColumns(a: number, b: number, add: boolean): number[] {
  const out: number[] = [];
  let c = 0;
  for (let k = 0; k < 3; k++) {
    const da = Math.floor(a / 10 ** k) % 10, db = Math.floor(b / 10 ** k) % 10;
    const up = add ? da + db + c >= 10 : da - c < db;
    if (up) out.push(k);
    c = up ? 1 : 0;
  }
  return out;
}

/** Every wrong answer the two slips can make for `a ± b`, kept only if it differs from the true result in exactly one digit of the same length. */
export function wrongAnswers(a: number, b: number, add: boolean): Wrong[] {
  const r = add ? a + b : a - b, out: Wrong[] = [];
  const keep = (kind: Kind, col: number, value: number) => {
    if (value < 0 || len(value) !== len(r)) return;
    const x = String(r), y = String(value);
    if ([...x].filter((ch, i) => ch !== y[i]).length === 1) out.push({ kind, col, value });
  };
  // The carry (exchange) from column k is dropped in column k + 1: one too few when adding, one too many when taking away.
  for (const k of carryColumns(a, b, add)) keep('carry', k + 1, add ? r - 10 ** (k + 1) : r + 10 ** (k + 1));
  for (let k = 0; k < len(r); k++) { keep('slip', k, r + 10 ** k); keep('slip', k, r - 10 ** k); }
  return out;
}

const ok = (a: number, b: number, add: boolean, d: Difficulty): boolean => {
  const r = add ? a + b : a - b;
  if (d === 1) return r < 1000 && r >= 100 && carries(a, b) === 1;
  if (r < 1000 || r > 9999) return false;
  if (d === 2) return (add ? carries(a, b) : borrows(a, b)) === 1;
  return a % 1000 !== 0 && /0/.test(String(a).slice(1));
};

function operands(d: Difficulty, rng: Rng): { a: number; b: number; add: boolean } {
  for (let i = 0; i < 5000; i++) {
    const add = d === 1 || rng() < 0.5;
    const a = d === 1 ? ri(rng, 100, 899) : ri(rng, 1000, 9999), b = d === 1 ? ri(rng, 100, 899) : ri(rng, 100, 8999);
    if (ok(a, b, add, d)) return { a, b, add };
  }
  throw new Error(`y4-mistake: no operands for d${d}`);
}

export const y4Mistake: Generator = (d: Difficulty, rng): Question => {
  for (let i = 0; i < 500; i++) {
    const { a, b, add } = operands(d, rng);
    const all = wrongAnswers(a, b, add), slips = all.filter(w => w.kind === 'slip'), carry = all.filter(w => w.kind === 'carry');
    const pool = carry.length && rng() < 0.4 ? carry : slips;
    if (!pool.length) continue;
    const w = pick(rng, pool);
    const sum = `${f(a)} ${add ? '+' : MINUS} ${f(b)} = ${f(w.value)}`;
    const cols = d === 1 ? 3 : 4, options = LETTERS.slice(0, cols).reverse();
    const names = SAY.slice(0, cols).reverse();
    const say = `${ks2Say(sum)}. Which column has the mistake: ${names.slice(0, -1).join(', ')} or ${names[cols - 1]}?`;
    const card = wordQ(rng, 'Which column has the mistake?', LETTERS[w.col], options.filter(o => o !== LETTERS[w.col]), { visual: { type: 'sentence', text: sum }, say, hint: 'Check each column, ones first', hintIsData: false });
    return { ...card, options, wide: false };
  }
  throw new Error(`y4-mistake: no card for d${d}`);
};
