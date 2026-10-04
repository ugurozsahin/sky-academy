// y2-coincombo (#1002): "Which coins make 20p?" — each bubble is a set of coins, largest first, joined by " + ".
// Largest-first makes one multiset one label, so "distinct options" and "distinct coin sets" are the same check.
// Every coin is printed through `coinLabel` and no amount is ever a decimal or a mixed £-and-p one.
import type { Generator, Question } from './types';
import { pick, shuffle, wordQ, coinLabel } from './util';

type Combo = number[]; // coin values, largest first

const COINS: Record<1 | 2 | 3, { coins: number[]; sizes: number[]; max: number; min: number }> = {
  1: { coins: [1, 2, 5, 10], sizes: [2], min: 2, max: 20 },
  2: { coins: [1, 2, 5, 10, 20], sizes: [2], min: 2, max: 50 },
  3: { coins: [5, 10, 20, 50], sizes: [2, 3], min: 10, max: 100 },
};

/** Every multiset of `size` coins, each listed largest first. */
function combos(coins: number[], size: number): Combo[] {
  const desc = [...coins].sort((a, b) => b - a);
  const out: Combo[] = [];
  const walk = (start: number, left: number, cur: Combo) => {
    if (left === 0) { out.push(cur); return; }
    for (let i = start; i < desc.length; i++) walk(i, left - 1, [...cur, desc[i]]);
  };
  walk(0, size, []);
  return out;
}

const sum = (c: Combo) => c.reduce((s, n) => s + n, 0);
export const comboLabel = (c: Combo) => c.map(coinLabel).join(' + ');
const spoken = (p: number) => (p === 100 ? 'a pound' : `${p} pence`);

export const y2CoinCombo: Generator = (d, rng): Question => {
  const { coins, sizes, min, max } = COINS[d as 1 | 2 | 3];
  const all = sizes.flatMap(s => combos(coins, s)).filter(c => sum(c) <= max);
  const answers = all.filter(c => sum(c) >= min);
  const ans = pick(rng, answers);
  const target = sum(ans);
  // Near misses: a different coin set whose total is 1p–10p off, never the target itself. A target with fewer
  // than three of those (90p from 5p/10p/20p/50p) is topped up with the nearest other totals.
  const gap = (c: Combo) => Math.abs(sum(c) - target);
  const others = all.filter(c => gap(c) >= 1);
  const near = [...shuffle(rng, others.filter(c => gap(c) <= 10)), ...others.filter(c => gap(c) > 10).sort((x, y) => gap(x) - gap(y))];
  return wordQ(rng, `Which coins make ${coinLabel(target)}?`, comboLabel(ans), near.slice(0, 3).map(comboLabel), { say: `Which coins make ${spoken(target)}?` });
};
