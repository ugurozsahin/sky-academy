// y5-squares (#1191): square and cube numbers and the ² and ³ notation (5M18–19), pick the answer. d1 n² for n 2–12 and "Which
// is a square number?"; d2 n³ for n in 2–5 and 10 and "Which is a cube number?"; d3 problems: a² + b², "What number squared is
// 81?", the side of a square from its area, and the one number that is both a square and a cube (64). Decoys: the doubling or
// tripling mistake (6² → 12, 4³ → 12), square for cube, the neighbouring square or cube; a ±10 fill keeps the answer's last digit shared.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt } from './ks2num';

const f = (n: number) => fmt(dec(n, 0));
export const SQUARES = Array.from({ length: 12 }, (_, i) => (i + 1) ** 2);
export const CUBES = [1, 8, 27, 64, 125, 1000];
const isSquare = (v: number) => Number.isInteger(Math.sqrt(v));
const isCube = (v: number) => Math.round(Math.cbrt(v)) ** 3 === v;

/** The named slips first (a membership card may only offer non-members), then ±10 and small fills so the answer keeps a twin. */
function decoys(answer: number, near: number[], rng: Rng, valid: (v: number) => boolean = () => true, first?: number): number[] {
  const ok = (v: number) => Number.isInteger(v) && v > 0 && v !== answer && valid(v);
  const out: number[] = [];
  for (const v of [...(first === undefined ? [] : [first]), ...shuffle(rng, near)]) if (out.length < 3 && ok(v) && !out.includes(v)) out.push(v);
  const fills = shuffle(rng, [10, -10, 20, -20, 1, -1, 2, -2, 3, -3]).map(m => answer + m).filter(ok);
  for (const v of fills) if (out.length < 3 && !out.includes(v)) out.push(v);
  // A whole answer of 20 or more must not stand alone by its last digit: the last slip becomes answer ± 10 (36 → 26 or 46).
  const last = (v: number) => v % 10;
  if (answer >= 20 && out.length === 3 && !out.some(v => last(v) === last(answer))) {
    const swap = fills.find(v => !out.includes(v) && last(v) === last(answer));
    if (swap !== undefined) out[2] = swap;
  }
  return out;
}

const card = (rng: Rng, prompt: string, answer: number, near: number[], say: string, valid?: (v: number) => boolean, unit = '', first?: number): Question =>
  wordQ(rng, prompt, f(answer) + unit, decoys(answer, near, rng, valid, first).map(v => f(v) + unit), { say });

const sq = (n: number) => ({ text: `${n}²`, say: `${n} squared` });
const cu = (n: number) => ({ text: `${n}³`, say: `${n} cubed` });

function d1(rng: Rng): Question {
  if (rng() < 0.3) {
    const s = pick(rng, SQUARES.slice(2)), n = Math.sqrt(s);
    return card(rng, 'Which is a square number?', s, [s - 1, s + 1, s - 2, s + 2, n * (n + 2), n * (n - 2)], 'Which is a square number? Pick the answer.', v => !isSquare(v));
  }
  const n = ri(rng, 2, 12), { text, say } = sq(n);
  return card(rng, `${text} = ?`, n * n, [(n + 1) ** 2, (n - 1) ** 2, n * n * n], `${say} equals what?`, undefined, '', 2 * n);
}

function d2(rng: Rng): Question {
  if (rng() < 0.4) {
    const c = pick(rng, CUBES), n = Math.round(Math.cbrt(c));
    return card(rng, 'Which is a cube number?', c, [c - 1, c + 1, n * n, c - 2, c + 2, (n + 1) ** 2], 'Which is a cube number? Pick the answer.', v => !isCube(v));
  }
  const n = pick(rng, [2, 3, 4, 5, 10]), { text, say } = cu(n);
  return card(rng, `${text} = ?`, n ** 3, [n * n, (n + 1) ** 3, (n - 1) ** 3], `${say} equals what?`, undefined, '', 3 * n);
}

function sumOfSquares(rng: Rng): Question {
  const a = ri(rng, 2, 9), b = ri(rng, 2, 9), p = `${sq(a).text} + ${sq(b).text} = ?`;
  return card(rng, p, a * a + b * b, [2 * a + 2 * b, (a + b) ** 2, a * a + 2 * b, 2 * a + b * b], `${sq(a).say} plus ${sq(b).say} equals what?`);
}

function root(rng: Rng): Question {
  const n = ri(rng, 3, 12), s = n * n;
  return card(rng, `What number squared is ${s}?`, n, [Math.floor(s / 2), n + 1, n - 1, s / n + 1], `What number, squared, makes ${s}? Pick the answer.`);
}

function side(rng: Rng): Question {
  const n = ri(rng, 3, 12), s = n * n;
  return card(rng, `A square has an area of ${s} cm². How long is each side?`, n, [Math.floor(s / 2), Math.floor(s / 4), n + 1, n - 1], `A square has an area of ${s} square centimetres. How long is each side?`, undefined, ' cm');
}

/** 64 is the only number below 1,000 that is a square and a cube among these; the rest are squares only or cubes only. */
function both(rng: Rng): Question {
  const squareOnly = SQUARES.filter(v => !isCube(v) && v >= 25), cubeOnly = CUBES.filter(v => !isSquare(v) && v > 8);
  const out = [144, pick(rng, cubeOnly), pick(rng, squareOnly.filter(v => v !== 144))];
  return wordQ(rng, 'Which number is both a square and a cube?', '64', out.map(f), { say: 'Which number is both a square number and a cube number? Pick the answer.' });
}

export const y5Squares: Generator = (d: Difficulty, rng): Question =>
  d === 1 ? d1(rng) : d === 2 ? d2(rng) : pick(rng, [sumOfSquares, root, side, both])(rng);
