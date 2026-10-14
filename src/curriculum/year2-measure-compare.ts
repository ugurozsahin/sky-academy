// Year 2: compare two measures and record the result with <, > and = (#1003). A new module, not year2.ts or
// util.ts, which are on the #714 ratchet. Both sides carry the same unit, so the numbers alone decide the sign.
import type { Generator, Rng } from './types';
import { ri, pick, wordQ, UNIT_WORD } from './util';

const LENGTH = ['cm', 'm'], MASS = ['g', 'kg'], CAPACITY = ['ml', 'l'];

type Pair = [number, number];

/** Two numbers 45 against 54 apart only in digit order, in either order. */
function digitSwap(rng: Rng): Pair {
  const x = ri(rng, 1, 9); let y = ri(rng, 1, 9); if (y === x) y = x === 9 ? 1 : x + 1;
  return rng() < 0.5 ? [x * 10 + y, y * 10 + x] : [y * 10 + x, x * 10 + y];
}
function spread(rng: Rng, gap: number, close: boolean): Pair {
  let a: number, b: number;
  do { a = ri(rng, 1, 100); b = ri(rng, 1, 100); } while (Math.abs(a - b) < gap || (close && Math.abs(a - b) > 15));
  return [a, b];
}
function pairFor(d: number, rng: Rng): Pair {
  if (d < 3) return spread(rng, d === 1 ? 10 : 5, false);
  if (rng() < 0.2) { const a = ri(rng, 1, 100); return [a, a]; }
  return rng() < 0.5 ? digitSwap(rng) : spread(rng, 1, true);
}

export const y2MeasureCompare: Generator = (d, rng) => {
  const unit = pick(rng, d === 1 ? LENGTH : [...LENGTH, ...MASS, ...CAPACITY]);
  const [a, b] = pairFor(d, rng);
  const ans = a < b ? '<' : a > b ? '>' : '=';
  const w = UNIT_WORD[unit];
  return wordQ(rng, `${a} ${unit} ? ${b} ${unit}`, ans, ['<', '>', '='], { say: `${a} ${w} compared with ${b} ${w}. Less than, greater than, or equal?`, hint: 'Slice the correct sign', hintIsData: false });
};
