// Year 2: odd and even numbers (#890). Split out of year2.ts by the #714 ratchet, the same move #889 made
// for the registry — see year2-topics.ts's header for the import direction rule this file follows.
import type { Generator, Rng } from './types';
import { ri, numQ, wordQ, shuffle } from './util';
import { anyOrderQ } from './any-order';

/**
 * `n`'s opposite-parity neighbours within 1–100 — `±1, ±3, ±5` — so the ones digit alone decides. Always at
 * least 3 long: the fewest valid offsets are at `n`'s own extremes (`n = 1` or `n = 100`), where exactly 3 of
 * the 6 fall in range — exported so that boundary is pinned directly rather than only landed on by a seed.
 */
export const nearOppositeParity = (n: number): number[] => [n - 5, n - 3, n - 1, n + 1, n + 3, n + 5].filter(x => x >= 1 && x <= 100);

/**
 * Three distinct numbers of the opposite parity to `wantEven`, drawn from anywhere in 1–100 — a rejection
 * sample, unlike `nearOppositeParity`'s proven-≥3 neighbourhood. Throws rather than under-filling: the pool
 * is ~49 of 99 candidates, so 200 tries never actually falls short, but `numQ`'s own `nearby()` top-up is
 * parity-blind — silently handing it a short list could pad in a same-parity decoy, an ambiguous card with a
 * second "correct" bubble (`unitQ`'s equivalent guard throws the same way, `util.ts`).
 */
function anyOppositeParity(rng: Rng, ans: number, wantEven: boolean): number[] {
  const ds = new Set<number>();
  let guard = 0;
  while (ds.size < 3 && guard++ < 200) {
    const v = ri(rng, 1, 100);
    if (v !== ans && (v % 2 === 0) !== wantEven) ds.add(v);
  }
  if (ds.size < 3) throw new Error(`y2OddEven: only ${ds.size} opposite-parity decoy(s) found for ${ans}`);
  return [...ds];
}

/**
 * `count` distinct 1–100 numbers of `isWant`'s parity, none already in `used` — a plain rejection sample.
 * Throws rather than looping forever on a caller error (`used` covering an entire parity's ~50 candidates):
 * the same "fail where the mistake was made" precedent `anyOppositeParity` above and `gapQ` (`util.ts`) set.
 */
function distinctWanted(rng: Rng, count: number, used: Set<number>, isWant: (n: number) => boolean): number[] {
  const found: number[] = [];
  let guard = 0;
  while (found.length < count && guard++ < 200) {
    const v = ri(rng, 1, 100);
    if (isWant(v) && !used.has(v)) { used.add(v); found.push(v); }
  }
  if (found.length < count) throw new Error(`y2OddEven: only ${found.length}/${count} candidate(s) found`);
  return found;
}

/**
 * `count` opposite-parity decoys for `targets`, biased towards each target's own `±1` neighbour first, so the
 * ones digit alone decides as many cards as possible — never guaranteed, since a target's two neighbours can
 * already be taken (by another target, or a decoy already placed next to a different target). Throws rather
 * than under-filling for the same reason `anyOppositeParity` above does: a short list would silently ship an
 * any-order card with a same-parity bubble left off it.
 */
function nearOppositeDecoys(rng: Rng, targets: number[], count: number, used: Set<number>, isWant: (n: number) => boolean): number[] {
  const decoys: number[] = [];
  for (const t of shuffle(rng, targets)) {
    if (decoys.length >= count) break;
    for (const cand of [t - 1, t + 1]) {
      if (decoys.length >= count) break;
      if (cand >= 1 && cand <= 100 && !isWant(cand) && !used.has(cand)) { used.add(cand); decoys.push(cand); }
    }
  }
  if (decoys.length < count) decoys.push(...distinctWanted(rng, count - decoys.length, used, n => !isWant(n)));
  return decoys;
}

/**
 * The "Slice Them All" form (#926): "Slice every even/odd number" over six distinct 1–100 numbers, 2–4 of
 * them targets.
 */
function y2OddEvenAnyOrder(rng: Rng): ReturnType<typeof anyOrderQ> {
  const wantEven = rng() < 0.5;
  const isWant = (n: number) => (n % 2 === 0) === wantEven;
  const targetCount = ri(rng, 2, 4);
  const used = new Set<number>();
  const targets = distinctWanted(rng, targetCount, used, isWant);
  const decoys = nearOppositeDecoys(rng, targets, 6 - targetCount, used, isWant);
  const word = wantEven ? 'even' : 'odd';
  return anyOrderQ(rng, `Slice every ${word} number`, targets.map(String), decoys.map(String), {
    say: `Slice every ${word} number`, hint: `Which numbers are ${word}?`, hintIsData: false,
  });
}

/**
 * Every Odd or Even card used to have two bubbles, so a guess scored 50% at every stage (#890). d1 keeps that
 * form. From d2, the any-order form above draws about one card in three (#926); otherwise, half the
 * remaining cards show 4 number bubbles and ask which one is odd/even — d2 decoys come from anywhere in
 * 1–100, d3 decoys are the answer's own `±1, ±3, ±5` neighbours, so only the ones digit decides.
 */
export const y2OddEven: Generator = (d, rng) => {
  const n = ri(rng, 1, d === 1 ? 20 : 100);
  if (d === 1) return wordQ(rng, `Is ${n} odd or even?`, n % 2 ? 'odd' : 'even', ['odd', 'even']);
  if (rng() < 1 / 3) return y2OddEvenAnyOrder(rng);
  if (rng() < 0.5) return wordQ(rng, `Is ${n} odd or even?`, n % 2 ? 'odd' : 'even', ['odd', 'even']);
  const wantEven = rng() < 0.5;
  let ans = ri(rng, 1, 100);
  if ((ans % 2 === 0) !== wantEven) ans = ans === 100 ? ans - 1 : ans + 1;
  const ds = d === 3 ? shuffle(rng, nearOppositeParity(ans)).slice(0, 3) : anyOppositeParity(rng, ans, wantEven);
  return numQ(rng, `Which number is ${wantEven ? 'even' : 'odd'}?`, ans, {
    min: 1, max: 100, distractors: ds,
    say: `Which of these numbers is ${wantEven ? 'even' : 'odd'}?`, hint: `Slice the ${wantEven ? 'even' : 'odd'} number`, hintIsData: false,
  });
};
