// y3-charts (#1076): read scaled bar charts and pictograms (NC 3M32, 3M33). d1 one bar, step 2 or 5, on a
// gridline; d2 "how many more/fewer" on a bar chart or a pictogram, step 2, 5 or 10; d3 two-step questions, where
// a bar can sit halfway between two gridlines. Every answer is read from the rows' counts, the same numbers
// the chart is drawn from.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, numQ } from './util';
import { ks2Say } from './ks2say';

/** Plain words of at most 7 letters, each narrow enough to sit under one bar of a five-bar chart at 240px (`tests/unit/vis-axis-chart.test.ts` measures). */
const THEMES: readonly (readonly string[])[] = [
  ['tennis', 'rugby', 'chess', 'dance', 'judo', 'golf'],
  ['apples', 'pears', 'plums', 'grapes', 'kiwi', 'mango'],
  ['bus', 'car', 'bike', 'train', 'walk', 'tram'],
  ['dog', 'cat', 'fish', 'bird', 'horse', 'rabbit'],
];
const SYMBOL = '⭐';

const lead = (n: number) => String(n)[0];
/** Decoys, in priority order: the first named slip, then (answers of 20 or more, #1058) one sharing the units digit and one the leading digit, then the other slips, then fillers. */
function decoys(answer: number, named: number[], need: number): number[] {
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v !== answer;
  const near = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 10, -10].map(k => answer + k);
  const guard = answer >= 20
    ? [[10, -10, 20, -20].map(k => answer + k).find(ok), near.find(v => ok(v) && lead(v) === lead(answer))]
    : [];
  const out: number[] = [];
  for (const v of [...named.slice(0, 1), ...guard, ...named, ...near]) if (v !== undefined && ok(v) && !out.includes(v)) out.push(v);
  return out.slice(0, need);
}

type Ask = 'one' | 'more' | 'fewer' | 'together' | 'total';
interface Plan { cats: string[]; pictogram: boolean; step: number; ask: Ask; n: number[]; a: number; b: number; c: number }

const stepFor = (d: Difficulty, pictogram: boolean, rng: Rng) =>
  pictogram ? pick(rng, [2, 5, 10]) : pick(rng, d === 1 ? [2, 5] : d === 2 ? [2, 5, 10] : [2, 10]);
const askFor = (d: Difficulty, rng: Rng): Ask => d === 1 ? 'one' : d === 2 ? pick<Ask>(rng, ['one', 'more', 'fewer']) : pick<Ask>(rng, ['together', 'total', 'together']);

function plan(d: Difficulty, rng: Rng): Plan {
  const cats = shuffle(rng, [...pick(rng, THEMES)]).slice(0, d === 1 ? ri(rng, 3, 4) : ri(rng, 3, 5));
  const pictogram = d >= 2 && rng() < (d === 2 ? 0.4 : 0.25);
  const step = stepFor(d, pictogram, rng), ask = askFor(d, rng);
  const top = pictogram ? 6 : Math.min(10, Math.floor(80 / step));
  // d3 bars may sit halfway between two gridlines (an odd count on a step of 2, a multiple of 5 on a step of 10).
  const half = d === 3 && !pictogram;
  const roll = () => cats.map(() => ri(rng, 1, top - 1) * step + (half && rng() < 0.5 ? step / 2 : 0));
  const [a, b, c] = shuffle(rng, cats.map((_, k) => k));
  let n = roll();
  const bad = () => ask === 'together' ? n[c] >= n[a] + n[b] || n[a] === n[b] : (ask === 'more' || ask === 'fewer') && n[a] === n[b];
  for (let tries = 0; tries < 50 && bad(); tries++) n = roll();
  if (bad()) { n[a] = n[b] + step; n[c] = Math.min(n[c], step); }
  return { cats, pictogram, step, ask, n, a, b, c };
}

export const y3Charts: Generator = (d: Difficulty, rng: Rng): Question => {
  const p = plan(d, rng);
  const { cats, step, n } = p;
  const rows = cats.map((label, k) => ({ label, n: n[k] }));
  const visual: Question['visual'] = p.pictogram
    ? { type: 'chart', kind: 'pictogram', rows, each: step, icon: SYMBOL }
    : { type: 'chart', kind: 'bar', rows, step, max: Math.ceil(Math.max(...n) / step) * step };
  const chart = p.pictogram ? 'pictogram' : 'bar chart';
  const finish = (prompt: string, spoken: string, answer: number, named: number[]): Question =>
    numQ(rng, prompt, answer, { min: 0, max: 1000, distractors: decoys(answer, named, 3), visual, say: ks2Say(`Look at the ${chart}. ${spoken}`), slow: d === 3 });
  return ASK[p.ask](p, finish);
};

type Finish = (prompt: string, spoken: string, answer: number, named: number[]) => Question;
// Each slip is a real misreading: the gridline count (the scale read as 1s), a neighbouring bar, the wrong
// operation, or one step off.
const ASK: Record<Ask, (p: Plan, finish: Finish) => Question> = {
  one: ({ cats, n, a, b, step }, finish) =>
    finish(`How many chose ${cats[a]}?`, `How many children chose ${cats[a]}?`, n[a], [n[a] / step, n[b], n[a] + step, n[a] - step]),
  more: (p, finish) => compare(p, finish, true),
  fewer: (p, finish) => compare(p, finish, false),
  together: ({ cats, n, a, b, c, step }, finish) => {
    const answer = n[a] + n[b] - n[c];
    return finish(`How many more chose ${cats[a]} and ${cats[b]} together than ${cats[c]}?`,
      `How many more children chose ${cats[a]} and ${cats[b]} together than ${cats[c]}?`, answer, [answer / step, n[a] + n[b], n[c], answer + step, answer - step]);
  },
  total: ({ n, step }, finish) => {
    const total = n.reduce((s, v) => s + v, 0);
    return finish('How many children were asked altogether?', 'How many children were asked altogether?', total, [total / step, total - Math.min(...n), total + step, total - step]);
  },
};

function compare({ cats, n, a, b, step }: Plan, finish: Finish, more: boolean): Question {
  const [hi, lo] = n[a] > n[b] ? [a, b] : [b, a];
  const [x, y] = more ? [hi, lo] : [lo, hi];
  const answer = n[hi] - n[lo], word = more ? 'more' : 'fewer';
  return finish(`How many ${word} chose ${cats[x]} than ${cats[y]}?`, `How many ${word} children chose ${cats[x]} than ${cats[y]}?`,
    answer, [answer / step, n[hi], n[hi] + n[lo], answer + step, answer - step]);
}
