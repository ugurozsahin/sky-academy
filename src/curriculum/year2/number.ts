// Year 2 number: place value, the four operations, tables, fractions, money, clocks, skip counting. Split out of year2.ts (#1416); index.ts re-exports every name.
import { type Difficulty, type Generator, type Question } from '../types';
import { ri, pick, shuffle, numQ, wordQ, q, numberWord, coinLabel, orderQ, lineQ, unitQ } from '../util';

// ---------- Year 2 maths ----------
/**
 * Mark a question as taking several mental steps, so the bubbles fly one speed step slower (#297).
 *
 * The rule the code applies is **the d3 draws of `y2Add`, `y2Sub` and `y2Inverse` — all of them**, not only
 * the ones that cross a ten, which is how this was first written and is narrower than what ships: about
 * three in five d3 draws need no regrouping at all (59% `y2-add`, 58% `y2-sub` — a share fixed by the two
 * `ri(...)` ranges, so it can be re-derived without a seed: `45 + 44`, `78 − 62`, `99 − 34`). That is
 * #297's decision, not an oversight — a bubble speed that flickered question by question inside one stage
 * would read to a child as a glitch, so the whole of d3 eases. The sum stays as the year asks; only the
 * clock does.
 *
 * **It is opt-in per generator, not a property of Year 2 difficulty 3** — `tests/unit/curriculum.test.ts`
 * pins that ("no other topic sets slow"). `y2-length` d3 draws `50 cm − 29 cm`, two-digit and crossing a
 * ten, and flies at full speed. Set at d3 alone, which is why it is a flag on the question, not the topic.
 *
 * For one of the three it is a *stage* split rather than a difficulty one: `y2Inverse`'s `kind` never
 * reads `d`, and its d2 and d3 ranges coincide — 500/500 byte-identical prompts on the same seed (#311) —
 * so `70 − ? = 26` flies at speed 3 at stage 3 of a Year 2 mission and at speed 2 at stage 4. Harmless to
 * the child, stage 4 being the gentler one; giving `y2-inverse` a real d3 form is a curriculum change and
 * belongs in its own issue.
 */
const slowAtD3 = (d: Difficulty, question: Question): Question => d === 3 ? { ...question, slow: true } : question;
export const y2PlaceValue: Generator = (d, rng) => {
  const n = ri(rng, 10, 99);
  const t = Math.floor(n / 10), o = n % 10;
  const kind = d === 1 ? 0 : ri(rng, 0, 2);
  if (kind === 0) return numQ(rng, `${n}: how many tens?`, t, { min: 0, max: 9, say: `In ${n}, how many tens?`, distractors: [o, t + 1, t - 1] });
  if (kind === 1) return numQ(rng, `${n}: how many ones?`, o, { min: 0, max: 9, say: `In ${n}, how many ones?`, distractors: [t, o + 1, o - 1] });
  const tw = t === 1 ? '1 ten' : `${t} tens`, ow = o === 1 ? '1 one' : `${o} ones`; return numQ(rng, `${tw} and ${ow} = ?`, n, { min: 10, max: 99, say: `${tw} and ${ow}. What number is that?`, distractors: [t + o * 10, n + 10, n - 1] });
};
export const y2Compare: Generator = (d, rng) => {
  const max = d === 1 ? 20 : 100;
  const a = ri(rng, 0, max), b = d === 3 && rng() < 0.2 ? a : ri(rng, 0, max);
  const ans = a < b ? '<' : a > b ? '>' : '=';
  return wordQ(rng, `${a} ? ${b}`, ans, ['<', '>', '='], { say: `${a} compared with ${b}. Less than, greater than, or equal?`, hint: 'Slice the correct sign', hintIsData: false });
};
export const y2Add: Generator = (d, rng) => {
  let a: number, b: number;
  if (d === 1) { a = ri(rng, 10, 89); b = ri(rng, 1, 9); }          // 2-digit + ones
  else if (d === 2) { a = ri(rng, 10, 79); b = 10 * ri(rng, 1, 5); } // 2-digit + tens
  else { a = ri(rng, 10, 60); b = ri(rng, 10, 99 - a); }             // 2-digit + 2-digit
  if (a + b > 100) return y2Add(d, rng);
  const p = `${a} + ${b} = ?`;
  return slowAtD3(d, numQ(rng, p, a + b, { min: 0, max: 100, ...q(p) }));
};
export const y2Sub: Generator = (d, rng) => {
  let a: number, b: number;
  if (d === 1) { a = ri(rng, 10, 99); b = ri(rng, 1, 9); }
  else if (d === 2) { a = ri(rng, 30, 99); b = 10 * ri(rng, 1, 2); }
  else { a = ri(rng, 30, 99); b = ri(rng, 10, a - 1); }
  const p = `${a} − ${b} = ?`;
  return slowAtD3(d, numQ(rng, p, a - b, { min: 0, max: 100, ...q(p) }));
};
export const y2Three: Generator = (d, rng) => {
  const max = d === 1 ? 5 : 9;
  const a = ri(rng, 1, max), b = ri(rng, 1, max), c = ri(rng, 1, max);
  const p = `${a} + ${b} + ${c} = ?`;
  return numQ(rng, p, a + b + c, { min: 3, max: 27, ...q(p) });
};
export { y2Tables } from '../tables';
export const y2Inverse: Generator = (d, rng) => {
  const a = ri(rng, 10, d === 1 ? 30 : 99), b = ri(rng, 1, d === 1 ? 9 : Math.min(30, a - 1));
  const kind = ri(rng, 0, 2);
  const p = kind === 0 ? `? − ${b} = ${a - b}` : kind === 1 ? `${a - b} + ? = ${a}` : `${a} − ? = ${b}`;
  const ans = kind === 0 ? a : kind === 1 ? b : a - b;
  return slowAtD3(d, numQ(rng, p, ans, { min: 0, max: 100, ...q(p) }));
};
/** `a/b` written as text has the same value as num/den (cross-multiplied, so 2/4 and 1/2 are equal). */
export const sameFraction = (text: string, num: number, den: number) => { const [a, b] = text.split('/').map(Number); return a * den === num * b; };
export const y2Fractions: Generator = (d, rng) => {
  const fr = d === 1 ? pick(rng, [[1, 2], [1, 4]]) : d === 2 ? pick(rng, [[1, 2], [1, 3], [1, 4]]) : pick(rng, [[1, 3], [1, 4], [2, 4], [3, 4]]);
  const [num, den] = fr;
  if (rng() < 0.4) {
    const shaded = num, parts = den;
    // #296: a decoy is never worth the answer — 2/4 shaded is 1/2 too ("recognise the equivalence of 2/4 and
    // 1/2", Y2 programme of study), so the child who slices 1/2 was right. Compare by value, not by spelling.
    // `wordQ` keeps the first three, so the order is what reaches the card: `1/2` sits second so the natural
    // misconception is offered on the 1/4, 1/3 and 3/4 cards; for 1/2 and 2/4 it is filtered and the spare
    // decoy at the end takes its place.
    const ds = [`${den}/${num}`, '1/2', `${num}/${den + 1}`, `${den - num}/${den}`, `${num + 1}/${den}`].filter(x => !sameFraction(x, num, den));
    return wordQ(rng, 'What fraction is shaded?', `${num}/${den}`, ds, { visual: { type: 'fraction', parts, shaded }, say: 'What fraction of the shape is shaded?' });
  }
  const whole = den * ri(rng, 1, d === 3 ? 6 : 3);
  const ans = whole / den * num;
  return numQ(rng, `${num}/${den} of ${whole} = ?`, ans, { min: 0, max: 24, say: `What is ${num} ${den === 2 ? 'half' : den === 3 ? 'third' : 'quarter'}${num > 1 ? 's' : ''} of ${whole}?`, visual: { type: 'objects', emoji: '⭐', n: whole } });
};
export const y2Money: Generator = (d, rng) => {
  if (d === 1) { const coins = Array.from({ length: 3 }, () => pick(rng, [2, 5, 10, 20, 50])); return unitQ(rng, coins.reduce((s, c) => s + c, 0), coins); }
  // £ and p recorded separately, never `£1.50` — decimal money is Year 4 (#298 slice 2). `coinLabel` is the
  // one source for the label, so the distractors are filtered as amounts before they are ever formatted.
  if (d === 2) { const coins = Array.from({ length: 2 }, () => pick(rng, [50, 100, 200])); const total = coins.reduce((s, c) => s + c, 0); const ds = [total + 50, total - 50, total + 100].filter(p => p > 0 && p !== total); return wordQ(rng, 'How much money?', coinLabel(total), ds.map(coinLabel), { visual: { type: 'coins', coins }, say: 'How much money altogether?' }); }
  const price = 5 * ri(rng, 1, 19);
  const change = 100 - price;
  // At exactly one price (50p), `price` as a decoy equals `change` (the answer) — wordQ's own de-dup then
  // drops it, one card in nineteen shipping three bubbles instead of four (#462 rail). `change + 15` is the
  // fourth candidate that takes its place: since `price` is always a multiple of 5, `change + k` (= 100 −
  // price + k) can only ever equal `price` when k is itself a multiple of 10 (an earlier `+10` draft missed
  // this — it collided with `price` at 55p too, silently saved only by wordQ's own dedup, with no margin
  // left). 15 is not a multiple of 10 and not ±5, so this candidate can never equal `price`, `change` or
  // either of the other two decoys, at any price in range.
  return wordQ(rng, `Change from £1 for ${price}p?`, `${change}p`, [`${change + 5}p`, `${change - 5}p`, `${price}p`, `${change + 15}p`], { say: `You pay with £1 for something costing ${price} pence. How much change?` });
};
/**
 * The clock phrase for `h:mm` on a 12-hour dial — `3 o'clock`, `quarter past 3`, `half past 3`, `quarter to 4`,
 * `20 past 3`, `10 to 4`. One source, because `y2-time` reads a clock face and `y2-duration` answers an end
 * time with the same words (#298 slice 3); two copies would be free to disagree about `quarter to`, which is
 * the only phrase that names the *next* hour.
 */
export const clockPhrase = (hh: number, mm: number): string =>
  mm === 0 ? `${hh} o'clock` : mm === 15 ? `quarter past ${hh}` : mm === 30 ? `half past ${hh}` : mm === 45 ? `quarter to ${hh % 12 + 1}` : mm < 30 ? `${mm} past ${hh}` : `${60 - mm} to ${hh % 12 + 1}`;
export const y2Time: Generator = (d, rng) => {
  const h = ri(rng, 1, 12);
  const m = d === 1 ? pick(rng, [0, 15, 30, 45]) : d === 2 ? pick(rng, [0, 5, 10, 15, 30, 45]) : 5 * ri(rng, 0, 11);
  const ans = clockPhrase(h, m);
  const ds = new Set<string>();
  let guard = 0;
  while (ds.size < 3 && guard++ < 30) { const mm = 5 * ri(rng, 0, 11); const hh = rng() < 0.5 ? h : ri(rng, 1, 12); const l = clockPhrase(hh, mm); if (l !== ans) ds.add(l); }
  return wordQ(rng, 'What time is it?', ans, [...ds], { visual: { type: 'clock', h, m } });
};
export const y2Words: Generator = (d, rng) => {
  const n = ri(rng, d === 1 ? 10 : 21, d === 1 ? 20 : d === 2 ? 60 : 100);
  if (rng() < 0.5) return numQ(rng, numberWord(n), n, { min: 0, max: 100, say: `Which number is ${numberWord(n)}?`, visual: { type: 'word', text: numberWord(n) }, distractors: [n + 10, n - 10, n + 1] });
  // At n = 100 (the top of the range, only reachable at d3) both n+10 and n+1 fall outside [0,100], leaving
  // only two neighbours — a card with three bubbles instead of four (#462 rail). n-2 is there as a fourth
  // candidate for that boundary; unreachable everywhere else in the range, where the first four already
  // give three or more.
  const ds = shuffle(rng, [n + 10, n - 10, n + 1, n - 1, n - 2].filter(x => x >= 0 && x <= 100)).slice(0, 3).map(numberWord);
  return wordQ(rng, `${n}`, numberWord(n), ds, { say: `Which words say ${n}?` });
};
export const y2Skip: Generator = (d, rng) => {
  const step = d === 1 ? pick(rng, [2, 5, 10]) : pick(rng, [2, 3, 5, 10]);
  const back = d === 3 && rng() < 0.4;
  const start = back ? step * ri(rng, 5, 10) : step * ri(rng, 0, 6) + (step === 10 ? ri(rng, 0, 9) : 0);
  const s = back ? -step : step;
  const seq = [start, start + s, start + 2 * s];
  return numQ(rng, `${seq.join(', ')}, ?`, start + 3 * s, { min: 0, max: 120, say: `${seq.join(', ')}. What comes next?`, distractors: [start + 3 * s + 1, start + 3 * s - 1, start + 4 * s] });
};
export const y2Order: Generator = (d, rng) => orderQ(rng, d === 1 ? 30 : 100, d === 1 ? 3 : 4);
export const y2Line: Generator = (d, rng) => { const step = d === 1 ? 1 : d === 2 ? pick(rng, [2, 5, 10]) : pick(rng, [2, 3, 5, 10]); return lineQ(rng, step * ri(rng, 0, d === 1 ? 90 : 6), step, 6); };
