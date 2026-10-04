// y2-anyorder (#999): does swapping the two numbers change the answer? + and × do not mind; − and ÷ do.
// Yes/no cards show the swapped − or ÷ expression but never work it out; which-is-the-same cards use + and ×
// only, so no option is ever a negative or a remainder.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ, symSay } from './util';

const TABLES = [2, 5, 10];

/** Four options for "Which is the same as <prompt>?": `answer` (the operands swapped) and three decoys. */
function sameQ(rng: Rng, prompt: string, value: number, answer: string, spares: [string, number][]): Question {
  // A decoy whose value equals the prompt's (`2 + 2` against `2 × 2`) is dropped, so the next spare takes its place.
  const ds = spares.filter(([s, v], i) => v !== value && v <= 100 && s !== answer && spares.findIndex(x => x[0] === s) === i).slice(0, 3).map(x => x[0]);
  if (ds.length < 3) throw new Error(`y2AnyOrder: only ${ds.length} decoy(s) for ${prompt}`);
  return wordQ(rng, `Which is the same as ${prompt}?`, answer, ds, { say: `Which is the same as ${symSay(prompt)}`, hint: 'Swap the two numbers', hintIsData: false });
}

function sameAdd(rng: Rng): Question {
  let a: number, b: number;
  do { a = ri(rng, 2, 98); b = ri(rng, 1, 98); } while (a === b || a + b > 99);
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return sameQ(rng, `${a} + ${b}`, a + b, `${b} + ${a}`, [
    [`${b} + ${a + 1}`, a + b + 1], [`${b} + ${a - 1}`, a + b - 1], [`${hi} − ${lo}`, hi - lo],
  ]);
}

function sameTimes(rng: Rng): Question {
  const t = pick(rng, TABLES);
  let n: number;
  do { n = ri(rng, 1, 10); } while (n === t);
  const hi = n === 10 ? n - 2 : n + 1, lo = n === 1 ? n + 2 : n - 1;
  return sameQ(rng, `${t} × ${n}`, t * n, `${n} × ${t}`, [
    [`${hi} × ${t}`, hi * t], [`${lo} × ${t}`, lo * t], [`${n} + ${t}`, n + t],
    [`${n >= 9 ? n - 3 : n + 2} × ${t}`, (n >= 9 ? n - 3 : n + 2) * t],
  ]);
}

/** "Is 4 + 9 the same as 9 + 4?" — yes for + and ×, no for − and ÷. */
function yesNo(rng: Rng, op: '+' | '−' | '×' | '÷', d: Difficulty): Question {
  let a: number, b: number;
  if (op === '×' || op === '÷') {
    const t = pick(rng, TABLES);
    let n: number;
    do { n = ri(rng, op === '÷' ? 2 : 1, 10); } while (n === t);
    [a, b] = op === '÷' ? [n * t, t] : rng() < 0.5 ? [t, n] : [n, t];
  } else {
    const max = d === 1 ? 20 : 99;
    do { a = ri(rng, 1, max); b = ri(rng, 1, max); } while (a === b || (op === '+' && a + b > max));
    if (op === '−' && a < b) [a, b] = [b, a];
  }
  const prompt = `Is ${a} ${op} ${b} the same as ${b} ${op} ${a}?`;
  return wordQ(rng, prompt, op === '+' || op === '×' ? 'Yes' : 'No', ['Yes', 'No'], { say: symSay(prompt), hint: 'Swap the two numbers', hintIsData: false });
}

export const y2AnyOrder: Generator = (d, rng) => {
  if (d === 1) return yesNo(rng, rng() < 0.5 ? '+' : '−', d);
  if (d === 2) return rng() < 0.5 ? yesNo(rng, rng() < 0.5 ? '×' : '÷', d) : sameAdd(rng);
  return rng() < 0.5 ? sameTimes(rng) : sameAdd(rng);
};
