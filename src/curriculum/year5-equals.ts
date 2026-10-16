// y5-equals (#1192): what the equals sign means (5M20), on the balance scales. One pan is a finished calculation, the other has a
// missing number: 36 × 4 = 12 × ?. d1 + and − to 1,000, d2 × and ÷, d3 a different operation on each pan. The answer is a whole
// number 2–999. Decoys are the "answer comes next" slip: the finished pan's total (144) first, then that total ± the number beside
// the gap; the place-value shift and ±10 fills keep a last-digit and leading-digit twin.
import type { Generator, Rng } from './types';
import { ri, pick, shuffle, balanceQ } from './util';
import { dec, fmt } from './ks2num';
import { keepTwins } from './year5-column';

const MAX = 999;
const f = (n: number) => fmt(dec(n, 0));
type Op = '+' | '−' | '×' | '÷';

/** A finished pan `a op c` and its total T (10–999), or null when the draw is out of range. */
function finished(rng: Rng, op: Op): { text: string; T: number } | null {
  if (op === '+') { const a = ri(rng, 20, 700), c = ri(rng, 20, 700); return a + c <= MAX ? { text: `${f(a)} + ${f(c)}`, T: a + c } : null; }
  if (op === '−') { const a = ri(rng, 100, 1000), c = ri(rng, 20, 700); return a - c >= 10 ? { text: `${f(a)} − ${f(c)}`, T: a - c } : null; }
  if (op === '×') { const a = ri(rng, 2, 25), c = ri(rng, 2, 12); return a * c <= MAX ? { text: `${f(a)} × ${f(c)}`, T: a * c } : null; }
  const T = ri(rng, 3, 60), c = ri(rng, 2, 12); return T * c <= MAX ? { text: `${f(T * c)} ÷ ${f(c)}`, T } : null;
}

/** The pan with the gap, balancing T: its text, the answer and the number beside the gap. */
function gap(rng: Rng, op: Op, T: number): { text: string; ans: number; b: number } | null {
  if (op === '+') { const ans = ri(rng, 2, MAX), b = T - ans; return b >= 10 ? { text: rng() < 0.5 ? `${f(b)} + ?` : `? + ${f(b)}`, ans, b } : null; }
  if (op === '−') { const ans = ri(rng, 2, MAX), b = T + ans; return b <= 1000 ? { text: `${f(b)} − ?`, ans, b } : null; }
  if (op === '×') { const b = ri(rng, 2, 12); return T % b === 0 && T / b >= 2 ? { text: rng() < 0.5 ? `${f(b)} × ?` : `? × ${f(b)}`, ans: T / b, b } : null; }
  const b = ri(rng, 2, 12), ans = rng() < 0.5 ? T * b : 0;
  if (ans) return ans <= MAX ? { text: `? ÷ ${f(b)}`, ans, b } : null;
  // b ÷ ? = T: the gap is the divisor.
  return b * T <= MAX ? { text: `${f(b * T)} ÷ ?`, ans: b, b: b * T } : null;
}

const OPS: Record<number, Op[]> = { 1: ['+', '−'], 2: ['×', '÷'], 3: ['+', '−', '×', '÷'] };

function decoys(rng: Rng, ans: number, T: number, b: number): number[] {
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v <= MAX && v !== ans;
  const out: number[] = [];
  for (const v of [T, ...shuffle(rng, [T + b, T - b, ans * 10, ans / 10])]) if (out.length < 3 && ok(v) && !out.includes(v)) out.push(v);
  const fills = shuffle(rng, [10, 100, 1, 20].flatMap(m => [ans + m, ans - m])).filter(ok);
  for (const v of fills) if (out.length < 3 && !out.includes(v)) out.push(v);
  keepTwins(out, fills, ans, 1);
  return out;
}

export const y5Equals: Generator = (d, rng) => {
  const ops = OPS[d];
  for (let i = 0; i < 4000; i++) {
    const fo = pick(rng, ops), go = d === 3 ? pick(rng, ops.filter(o => o !== fo)) : pick(rng, ops);
    const fin = finished(rng, fo); if (!fin) continue;
    const g = gap(rng, go, fin.T); if (!g || g.ans === fin.T || g.text.length > 11 || fin.text.length > 11) continue;
    const finishedLeft = rng() < 0.5;
    const [l, r] = finishedLeft ? [fin.text, g.text] : [g.text, fin.text];
    return balanceQ(rng, l, r, g.ans, MAX, { distractors: decoys(rng, g.ans, fin.T, g.b) });
  }
  return balanceQ(rng, '36 × 4', '12 × ?', 12, MAX, { distractors: [144, 156, 132] });
};
