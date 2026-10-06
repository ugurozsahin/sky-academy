// y4-factorpairs (#1139): Year 4 uses factor pairs and commutativity to calculate mentally. The bubbles are pairs
// such as "3 × 8" and exactly one makes the target; d3 adds "4 × 7 × 25 = 7 × ?", where swapping pairs 4 with 25.
import type { Difficulty, Question, Rng } from './types';
import { pick, shuffle, wordQ, numberWord } from './util';

type Pair = [number, number];
const key = ([a, b]: Pair) => (a < b ? `${a}×${b}` : `${b}×${a}`);
const label = (rng: Rng, p: Pair) => (pick(rng, [true, false]) ? `${p[0]} × ${p[1]}` : `${p[1]} × ${p[0]}`);
const MAX_TARGET: Record<Difficulty, number> = { 1: 36, 2: 72, 3: 144 };

/** Unordered factor pairs of `t` whose factors are at least `lo`; `hi` caps each factor. */
function pairsOf(t: number, lo: number, hi: number): Pair[] {
  const out: Pair[] = [];
  for (let a = lo; a * a <= t; a++) if (t % a === 0 && t / a <= hi) out.push([a, t / a]);
  return out;
}

/** Targets with at least two factor pairs inside 2–12 × 2–12 (so a decoy can borrow a real table fact). */
const TARGETS: number[] = Array.from({ length: 143 }, (_, i) => i + 2).filter(t => pairsOf(t, 2, 12).length >= 2);

function pairCard(d: Difficulty, rng: Rng): Question {
  const t = pick(rng, TARGETS.filter(v => v <= MAX_TARGET[d]));
  const lo = d === 3 ? 1 : 2;
  const [a, b] = pick(rng, pairsOf(t, lo, d === 3 ? t : 12));
  const taken = new Set([key([a, b])]);
  const decoys: Pair[] = [];
  const add = (p: Pair | undefined) => {
    if (!p || p[0] < lo || p[1] < lo || (d < 3 && (p[0] > 12 || p[1] > 12)) || p[0] * p[1] === t || taken.has(key(p)) || decoys.length >= 3) return;
    taken.add(key(p)); decoys.push(p);
  };
  // Off-by-one factor, which keeps one of the answer's own factors.
  add(pick(rng, [[a, b + 1], [a, b - 1], [a + 1, b], [a - 1, b]] as Pair[]));
  // Halving slip: one factor of a true pair halved, the other left alone.
  add(a % 2 === 0 ? [a / 2, b] : b % 2 === 0 ? [a, b / 2] : undefined);
  // A pair from a neighbouring target.
  for (const n of shuffle(rng, [-3, -2, -1, 1, 2, 3])) add(pick(rng, [...pairsOf(t + n, 2, 12), [a + 1, b + 1] as Pair]));
  for (const p of [[a + 1, b + 1], [a, b + 2], [a + 2, b]] as Pair[]) add(p);
  const hi = d === 3 ? 144 : 12;
  for (const dx of shuffle(rng, [-2, -1, 1, 2])) for (const dy of shuffle(rng, [-2, -1, 1, 2])) add([Math.min(a + dx, hi), Math.min(b + dy, hi)]);
  return wordQ(rng, `Which is a factor pair of ${t}?`, label(rng, [a, b]), decoys.map(p => label(rng, p)),
    { say: `Which pair of numbers multiplies to make ${t}?` });
}

/** "x × y × z = y × ?": the outer two make 10, 20 or 100, so swapping the order lets the child pair them. */
function swapCard(rng: Rng): Question {
  const [x, z] = pick(rng, [[2, 5], [5, 2], [4, 5], [5, 4], [2, 10], [10, 2], [4, 25], [25, 4], [5, 20], [20, 5]] as Pair[]);
  const y = pick(rng, [3, 6, 7, 8, 9]);
  const ans = x * z;
  const taken = new Set<number>([ans]);
  const pool: number[] = [];
  const add = (v: number) => { if (v > 0 && !taken.has(v)) { taken.add(v); pool.push(v); } };
  [x + z, x * y, ans - 10, ans + 10].forEach(add);
  for (const k of shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9])) add(ans + k);
  const lead = (v: number) => String(v)[0];
  const chosen: number[] = [];
  const take = (v: number | undefined) => { if (v !== undefined && !chosen.includes(v) && chosen.length < 3) chosen.push(v); };
  if (ans >= 20) { take(pool.find(v => lead(v) === lead(ans))); take(pool.find(v => v % 10 === ans % 10)); }
  for (const v of pool) take(v);
  return wordQ(rng, `${x} × ${y} × ${z} = ${y} × ?`, String(ans), chosen.map(String),
    { say: `${numberWord(x)} times ${numberWord(y)} times ${numberWord(z)} equals ${numberWord(y)} times what?` });
}

export function y4FactorPairs(d: Difficulty, rng: Rng): Question {
  return d === 3 && pick(rng, [true, false]) ? swapCard(rng) : pairCard(d, rng);
}
