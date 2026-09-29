// Year 2: odd and even numbers (#890). Split out of year2.ts by the #714 ratchet, the same move #889 made
// for the registry — see year2-topics.ts's header for the import direction rule this file follows.
import type { Generator, Rng } from './types';
import { ri, numQ, wordQ, shuffle } from './util';

/** `n`'s opposite-parity neighbours within 1–100 — `±1, ±3, ±5` — so the ones digit alone decides. */
const nearOppositeParity = (n: number): number[] => [n - 5, n - 3, n - 1, n + 1, n + 3, n + 5].filter(x => x >= 1 && x <= 100);

/** Three distinct numbers of the opposite parity to `wantEven`, drawn from anywhere in 1–100. */
function anyOppositeParity(rng: Rng, ans: number, wantEven: boolean): number[] {
  const ds = new Set<number>();
  let guard = 0;
  while (ds.size < 3 && guard++ < 200) {
    const v = ri(rng, 1, 100);
    if (v !== ans && (v % 2 === 0) !== wantEven) ds.add(v);
  }
  return [...ds];
}

/**
 * Every Odd or Even card used to have two bubbles, so a guess scored 50% at every stage (#890). d1 keeps that
 * form. From d2, half the cards instead show 4 number bubbles and ask which one is odd/even — d2 decoys come
 * from anywhere in 1–100, d3 decoys are the answer's own `±1, ±3, ±5` neighbours, so only the ones digit
 * decides.
 */
export const y2OddEven: Generator = (d, rng) => {
  const n = ri(rng, 1, d === 1 ? 20 : 100);
  if (d === 1 || rng() < 0.5) return wordQ(rng, `Is ${n} odd or even?`, n % 2 ? 'odd' : 'even', ['odd', 'even']);
  const wantEven = rng() < 0.5;
  let ans = ri(rng, 1, 100);
  if ((ans % 2 === 0) !== wantEven) ans = ans === 100 ? ans - 1 : ans + 1;
  const ds = d === 3 ? shuffle(rng, nearOppositeParity(ans)).slice(0, 3) : anyOppositeParity(rng, ans, wantEven);
  return numQ(rng, `Which number is ${wantEven ? 'even' : 'odd'}?`, ans, {
    min: 1, max: 100, distractors: ds,
    say: `Which of these numbers is ${wantEven ? 'even' : 'odd'}?`, hint: `Slice the ${wantEven ? 'even' : 'odd'} number`, hintIsData: false,
  });
};
