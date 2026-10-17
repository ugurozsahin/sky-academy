// y6-pie (#1239): interpret pie charts (NC 6M48). d1 which slice is the most or least popular (four slices, no ties);
// d2 what fraction chose a slice (a slice built from halves, thirds, quarters, sixths, eighths and tenths, answer in
// its simplest form); d3 "60 children were asked: how many chose it?" with a total that makes every count whole.
// The pie is drawn from the same counts the answer is computed from (`src/ui/vis-pie.ts`).
import type { Difficulty, Generator, Question, Rng, ChartRow } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { simplify, equal, fmtFrac, parseFrac, type Frac } from './fractions';

/** Survey words of at most 7 letters, one theme to a chart, so no two slices of a pie are alike. */
const THEMES: readonly (readonly string[])[] = [
  ['apples', 'pears', 'plums', 'grapes', 'kiwi', 'mango'], ['dogs', 'cats', 'fish', 'birds', 'horses', 'rabbits'],
  ['pizza', 'pasta', 'salad', 'soup', 'rice', 'curry'], ['red', 'blue', 'green', 'pink', 'yellow', 'purple'],
  ['tennis', 'rugby', 'chess', 'dance', 'judo', 'golf'], ['bus', 'car', 'bike', 'train', 'walk', 'tram'],
];

/** Slice sizes over a common denominator `d`: every slice at least a twelfth of the circle, numerators summing to `d`. */
const SPLITS: readonly (readonly [number, readonly number[]])[] = [
  [2, [1, 1]], [3, [1, 1, 1]], [3, [2, 1]], [4, [3, 1]], [4, [2, 1, 1]], [4, [1, 1, 1, 1]],
  [6, [3, 2, 1]], [6, [3, 1, 1, 1]], [6, [2, 2, 1, 1]], [8, [4, 2, 1, 1]], [8, [3, 3, 2]], [8, [4, 3, 1]], [8, [5, 2, 1]],
  [10, [5, 3, 2]], [10, [5, 2, 2, 1]], [10, [4, 3, 2, 1]],
];
const TOTALS = [12, 24, 36, 40, 60, 72, 100, 120];
const FILLER: readonly Frac[] = [[1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 8], [1, 10], [3, 4], [2, 3], [3, 8], [3, 10]].map(([n, d]) => ({ n, d }));

const LOOK = 'Look at the pie chart. ';
const ask = (rng: Rng, split: readonly number[], labels: readonly string[], scale: number): { rows: ChartRow[]; k: number } => {
  const order = shuffle(rng, split.map((n, i) => ({ n: n * scale, i })));
  return { rows: order.map((o, j) => ({ label: labels[j], n: o.n })), k: ri(rng, 0, split.length - 1) };
};

/** d1: the biggest or smallest of four distinct counts; the bubbles are the four slice labels. */
function extreme(rng: Rng): Question {
  for (;;) {
    const ns = shuffle(rng, Array.from({ length: 12 }, (_, i) => i + 3)).slice(0, 4), total = ns.reduce((a, b) => a + b, 0);
    if (Math.min(...ns) * 12 < total) continue;
    const labels = shuffle(rng, pick(rng, THEMES)).slice(0, 4), most = rng() < 0.5;
    const hit = ns.indexOf(most ? Math.max(...ns) : Math.min(...ns));
    const word = most ? 'most' : 'least';
    return wordQ(rng, `Which was chosen ${word}?`, labels[hit], labels, {
      visual: { type: 'pie', slices: ns.map((n, i) => ({ label: labels[i], n })) }, say: `${LOOK}Which was chosen ${word}?`, wide: true,
    });
  }
}

/** d2: the fraction of the pie one slice covers. Slips: the flipped fraction (only when proper), the next unit fractions, the rest of the pie, the other slices; any slip equal in value to the answer, or not below one whole, is dropped. */
function fraction(rng: Rng): Question {
  const [den, split] = pick(rng, SPLITS), labels = shuffle(rng, pick(rng, THEMES)).slice(0, split.length);
  const { rows, k } = ask(rng, split, labels, 1);
  const ans = simplify({ n: rows[k].n, d: den }), text = fmtFrac(ans);
  const named: Frac[] = [
    { n: rows[k].n, d: den }, { n: den, d: rows[k].n }, { n: 1, d: ans.d + 1 }, { n: 1, d: Math.max(2, ans.d - 1) }, { n: ans.d - ans.n, d: ans.d }, ...rows.map(r => ({ n: r.n, d: den })),
  ];
  const ds: string[] = [];
  for (const f of [...named, ...shuffle(rng, FILLER)]) {
    const s = fmtFrac(f);
    if (f.d > 0 && f.n > 0 && f.n < f.d && !equal(f, ans) && !ds.some(x => equal(parseFrac(x)!, f)) && !ds.includes(s)) ds.push(fmtFrac(f, {}));
  }
  return wordQ(rng, `What fraction chose ${labels[k]}?`, text, ds.slice(0, 3), {
    visual: { type: 'pie', slices: rows }, say: `${LOOK}What fraction chose ${labels[k]}?`,
  });
}

/** d3: a count out of a stated total. Slips: the angle in degrees, the denominator, a neighbouring slice, the rest of the pie. */
function count(rng: Rng): Question {
  for (;;) {
    const total = pick(rng, TOTALS), fits = SPLITS.filter(([d]) => total % d === 0);
    const [den, split] = pick(rng, fits), labels = shuffle(rng, pick(rng, THEMES)).slice(0, split.length);
    const { rows, k } = ask(rng, split, labels, total / den), ans = rows[k].n;
    const ok = (v: number) => Number.isInteger(v) && v > 0 && v !== ans;
    const frac = simplify({ n: ans, d: total }), near = rows[(k + 1) % rows.length].n;
    const ds: number[] = [];
    for (const v of [ans * 360 / total, frac.d, near, total - ans, ans + 1, ans - 1, ans + 2, ans * 2]) if (ok(v) && !ds.includes(v)) ds.push(v);
    // #1058: an answer of 20 or more needs one decoy sharing its units digit, or that digit gives it away.
    if (ans >= 20 && !ds.slice(0, 3).some(v => v % 10 === ans % 10)) {
      const swap = [ans + 10, ans - 10].filter(v => ok(v) && !ds.slice(0, 2).includes(v));
      if (swap.length) ds.splice(Math.min(2, ds.length), 1, swap[rng() < 0.5 ? 0 : swap.length - 1]);
    }
    if (ds.slice(0, 3).length < 3 || new Set(ds.slice(0, 3)).size < 3) continue;
    return wordQ(rng, `${total} children were asked. How many chose ${labels[k]}?`, String(ans), ds.slice(0, 3).map(String), {
      visual: { type: 'pie', slices: rows }, say: `${LOOK}${total} children were asked. How many chose ${labels[k]}?`, slow: true,
    });
  }
}

export const y6Pie: Generator = (d: Difficulty, rng: Rng): Question => d === 1 ? extreme(rng) : d === 2 ? fraction(rng) : count(rng);
