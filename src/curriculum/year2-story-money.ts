// y2-story-money (#996): shop stories in pence, adding two prices or giving change. Every printed amount is
// `coinLabel` (£ and p separate, never a decimal); the answer is the sum or the amount paid minus it, so a
// test can recompute it from the prompt. No mixed £-and-p amount is ever spoken: £1 is "a pound".
import type { Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ, coinLabel } from './util';

export const ITEMS = ['pencil', 'rubber', 'apple', 'sticker', 'ruler', 'banana', 'balloon', 'biscuit', 'lolly', 'comic'];
const a = (item: string) => (/^[aeiou]/.test(item) ? 'an ' : 'a ') + item;
const spoken = (p: number) => (p === 100 ? 'a pound' : p === 1 ? 'a penny' : `${p} pence`);
const cap1 = (s: string) => s.replace(/^./, c => c.toUpperCase());

/** Two different items with prices (each `lo`..`hi` pence, in steps of `step`) that total at most `cap`. */
function basket(rng: Rng, lo: number, hi: number, step: number, cap: number) {
  const [x, y] = shuffle(rng, ITEMS);
  for (;;) {
    const p = step * ri(rng, lo / step, hi / step), q = step * ri(rng, lo / step, hi / step);
    if (p + q <= cap) return { x, y, p, q };
  }
}

export const y2StoryMoney: Generator = (d, rng): Question => {
  let prompt: string, say: string, ans: number, prices: number[];
  if (d === 1) {
    const { x, y, p, q } = basket(rng, 1, 50, 1, 100);
    prompt = cap1(`${a(x)} costs ${coinLabel(p)} and ${a(y)} costs ${coinLabel(q)}. How much altogether?`);
    say = cap1(`${a(x)} costs ${spoken(p)} and ${a(y)} costs ${spoken(q)}. How much altogether?`);
    ans = p + q; prices = [p, q];
  } else if (d === 2) {
    const item = pick(rng, ITEMS), p = 5 * ri(rng, 1, 9);
    prompt = `You pay 50p for ${a(item)} costing ${coinLabel(p)}. How much change?`;
    say = `You pay ${spoken(50)} for ${a(item)} costing ${spoken(p)}. How much change?`;
    ans = 50 - p; prices = [p];
  } else {
    const { x, y, p, q } = basket(rng, 5, 50, 5, 95);
    prompt = `You pay £1 for ${a(x)} at ${coinLabel(p)} and ${a(y)} at ${coinLabel(q)}. How much change?`;
    say = `You pay ${spoken(100)} for ${a(x)} at ${spoken(p)} and ${a(y)} at ${spoken(q)}. How much change?`;
    ans = 100 - p - q; prices = [p, q];
  }
  // d3's main decoy forgets an item (the change from £1 for the dearer one alone); then ±5, ±10 and the prices.
  const forgot = d === 3 ? [100 - Math.max(...prices)] : [];
  const pool = [...forgot, ...shuffle(rng, [ans + 5, ans - 5, ans + 10, ans - 10, ...prices]), ans + 15, ans - 15, ans + 20];
  const ok = pool.filter((n, i) => n > 0 && n <= 100 && n !== ans && pool.indexOf(n) === i);
  return wordQ(rng, prompt, coinLabel(ans), ok.slice(0, 3).map(coinLabel), { say });
};
