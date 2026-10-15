// y4-graphs (#1156): read bar charts, time graphs (the `line` chart kind) and tables (NC 4M41, 4M42). d1 one bar or
// "how many more" on a scale of 2, 5 or 10; d2 a time graph (a value, or a difference) or the sum of two bars on a
// scale of 20, 50 or 100; d3 "when was it warmest?", the two smallest bars, a table, or a time graph with a point
// halfway between two gridlines (only on an even scale). Every answer is worked out from the visual's own rows;
// no prompt or `say` states a data value, and a difference is always the larger value take the smaller.
import type { Difficulty, Generator, Question, Rng, ChartRow } from './types';
import { ri, pick, shuffle, numQ, wordQ, numberWord } from './util';
import { ks2Say } from './ks2say';

/** Time-graph banks: the labels run along the x axis, the values up the y axis. `at` is the preposition before a label. */
interface Bank { noun: string; unit: string; say: string; more: string; most: string; at: string; step: number; max: number; labels: (n: number) => string[] }
const hh = (i: number) => `${String(8 + 2 * i).padStart(2, '0')}:00`;
const BANKS: readonly Bank[] = [
  { noun: 'temperature', unit: '°C', say: 'degrees Celsius', more: 'warmer', most: 'warmest', at: 'at', step: 2, max: 20, labels: n => Array.from({ length: n }, (_, i) => hh(i)) },
  { noun: 'height of the plant', unit: 'cm', say: 'centimetres', more: 'taller', most: 'tallest', at: 'in', step: 10, max: 50, labels: n => Array.from({ length: n }, (_, i) => `Wk ${i + 1}`) },
  { noun: 'depth of the water', unit: 'cm', say: 'centimetres', more: 'deeper', most: 'deepest', at: 'on', step: 2, max: 20, labels: n => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].slice(0, n) },
];
/** Bar-chart surveys: plain words of at most 7 letters, narrow enough to sit under one bar of a five-bar chart. */
const THEMES: readonly (readonly string[])[] = [
  ['tennis', 'rugby', 'chess', 'dance', 'judo', 'golf'], ['apples', 'pears', 'plums', 'grapes', 'kiwi', 'mango'],
  ['bus', 'car', 'bike', 'train', 'walk', 'tram'], ['dog', 'cat', 'fish', 'bird', 'horse', 'rabbit'],
];
const TABLES: readonly { head: string; words: readonly string[] }[] = [
  { head: 'Club', words: ['Rugby', 'Chess', 'Drama', 'Tennis', 'Art', 'Choir'] },
  { head: 'Pet', words: ['Dog', 'Cat', 'Fish', 'Rabbit', 'Mouse', 'Bird'] },
  { head: 'Fruit', words: ['Apple', 'Pear', 'Plum', 'Grape', 'Mango', 'Lemon'] },
];

/** `ks2Say` turns a `?` into " what" and reads "08:00" as hours, so only the plain words go through it: each sentence is said without its `?`, which is put back after. */
const sayQ = (text: string) => text.split('?').map((part, i, all) => {
  const t = part.trim();
  return t ? ks2Say(t) + (i < all.length - 1 ? '?' : '') : '';
}).filter(Boolean).join(' ');
/** An x-axis label as it is spoken: "eight o'clock", "week four"; a day name is already words. */
const spoken = (label: string): string => {
  const t = /^(\d\d):00$/.exec(label), w = /^Wk (\d)$/.exec(label);
  return t ? `${numberWord(Number(t[1]))} o'clock` : w ? `week ${numberWord(Number(w[1]))}` : label;
};

/** Named slips first; an answer of 20 or more also gets a decoy sharing its last digit (#1058), then fillers. */
export function decoys(answer: number, named: number[], need: number): number[] {
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v !== answer;
  const near = [1, -1, 2, -2, 3, -3, 5, -5, 10, -10].map(k => answer + k);
  const share = answer >= 20 ? [[10, -10, 20, -20, 50, -50].map(k => answer + k).find(ok)] : [];
  const out: number[] = [];
  for (const v of [...named.slice(0, 1), ...share, ...named, ...near]) if (v !== undefined && ok(v) && !out.includes(v)) out.push(v);
  return out.slice(0, need);
}

/** Count values, distinct enough for the ask: the walk keeps neighbours close, as a real time graph does. */
function series(rng: Rng, b: Bank, count: number, half: boolean): number[] {
  const unit = b.step, top = b.max / unit;
  for (let tries = 0; tries < 200; tries++) {
    const v: number[] = [];
    let cur = ri(rng, 1, top - 1);
    for (let i = 0; i < count; i++) { cur = Math.max(1, Math.min(top, cur + ri(rng, -2, 2))); v.push(cur * unit - (half && rng() < 0.5 ? unit / 2 : 0)); }
    if (new Set(v).size === count) return v;
  }
  // Fallback: distinct levels in a shuffled order, never a ramp.
  return shuffle(rng, Array.from({ length: top }, (_, i) => (i + 1) * unit)).slice(0, count).map(v => v - (half ? unit / 2 : 0));
}

type Finish = (prompt: string, said: string, answer: number, named: number[]) => Question;
const lineCard = (d: Difficulty, rng: Rng, half: boolean): Question => {
  const b = pick(rng, BANKS), count = ri(rng, 4, 5);
  const labels = b.labels(count), n = series(rng, b, count, half);
  const visual: Question['visual'] = { type: 'chart', kind: 'line', rows: labels.map((label, k) => ({ label, n: n[k] })), step: b.step, max: b.max };
  const finish: Finish = (prompt, said, answer, named) =>
    numQ(rng, prompt, answer, { min: 0, max: 999, distractors: decoys(answer, named, 3), visual, say: sayQ(`Look at the graph. ${said}`), slow: d === 3 });
  const [i, j] = shuffle(rng, labels.map((_, k) => k));
  if (d === 2 && rng() < 0.5 || d === 3 && rng() < 0.5) {
    // Difference: the later reading is the larger one, so the answer is never negative.
    const [lo, hi] = n[i] < n[j] ? [i, j] : [j, i], answer = n[hi] - n[lo];
    return finish(`How much ${b.more} was it ${b.at} ${labels[hi]} than ${b.at} ${labels[lo]}? (${b.unit})`,
      `By how many ${b.say} was the ${b.noun} greater ${b.at} ${spoken(labels[hi])} than ${b.at} ${spoken(labels[lo])}?`, answer,
      [n[hi] + n[lo], n[hi], answer / b.step, answer + b.step, answer - b.step]);
  }
  const k = i, nb = n[k + 1] ?? n[k - 1];
  return finish(`What was the ${b.noun} ${b.at} ${labels[k]}? (${b.unit})`, `What was the ${b.noun} ${b.at} ${spoken(labels[k])}? Answer in ${b.say}.`, n[k],
    [nb, n[k] / b.step, n[k] + b.step, n[k] - b.step]);
};

function peakCard(rng: Rng): Question {
  const b = pick(rng, BANKS), count = ri(rng, 4, 5), labels = b.labels(count), n = series(rng, b, count, false);
  const visual: Question['visual'] = { type: 'chart', kind: 'line', rows: labels.map((label, k) => ({ label, n: n[k] })), step: b.step, max: b.max };
  const top = n.indexOf(Math.max(...n));
  // Slips: the point beside the peak, the first point, the last point.
  const others = [labels[top + 1] ?? labels[top - 1], labels[0], labels[count - 1], ...labels].filter(l => l !== labels[top]);
  return wordQ(rng, `When was the ${b.noun} ${b.most}?`, labels[top], others,
    { visual, say: sayQ(`Look at the graph. When was the ${b.noun} ${b.most}?`), slow: true });
}

function barCard(d: Difficulty, rng: Rng): Question {
  const cats = shuffle(rng, [...pick(rng, THEMES)]).slice(0, d === 1 ? ri(rng, 3, 4) : ri(rng, 4, 5));
  const step = pick(rng, d === 1 ? [2, 5, 10] : d === 2 ? [20, 50, 100] : [5, 10, 20]);
  const topN = Math.min(8, Math.floor(400 / step));
  const n = cats.map(() => ri(rng, 1, topN) * step);
  const [a, b] = shuffle(rng, cats.map((_, k) => k));
  if (n[a] === n[b]) n[a] = n[b] < step * topN ? n[b] + step : n[b] - step;
  const rows: ChartRow[] = cats.map((label, k) => ({ label, n: n[k] }));
  const visual: Question['visual'] = { type: 'chart', kind: 'bar', rows, step, max: Math.ceil(Math.max(...n) / step) * step };
  const finish: Finish = (prompt, said, answer, named) =>
    numQ(rng, prompt, answer, { min: 0, max: 999, distractors: decoys(answer, named, 3), visual, say: sayQ(`Look at the bar chart. ${said}`), slow: d === 3 });
  const [hi, lo] = n[a] > n[b] ? [a, b] : [b, a];
  if (d === 1 && rng() < 0.5) return finish(`How many chose ${cats[a]}?`, `How many children chose ${cats[a]}?`, n[a], [n[a] / step, n[b], n[a] + step, n[a] - step]);
  if (d === 1) {
    const answer = n[hi] - n[lo];
    return finish(`How many more chose ${cats[hi]} than ${cats[lo]}?`, `How many more children chose ${cats[hi]} than ${cats[lo]}?`, answer, [n[hi] + n[lo], n[hi], answer / step, answer + step]);
  }
  if (d === 2) {
    const answer = n[a] + n[b];
    return finish(`How many chose ${cats[a]} and ${cats[b]} altogether?`, `How many children chose ${cats[a]} and ${cats[b]} altogether?`, answer, [n[hi] - n[lo], n[a], answer / step, answer + step]);
  }
  const [s1, s2, s3] = [...n].sort((x, y) => x - y), answer = s1 + s2;
  return finish('What is the total of the two smallest bars?', 'What is the total of the two smallest bars?', answer, [s1 + s2 + s3, s1, answer / step, answer + step]);
}

function tableCard(rng: Rng): Question {
  const bank = pick(rng, TABLES), words = shuffle(rng, [...bank.words]).slice(0, ri(rng, 4, 5)), counts: number[] = [];
  while (counts.length < words.length) { const v = ri(rng, 10, 99); if (!counts.includes(v)) counts.push(v); }
  const visual: Question['visual'] = { type: 'chart', kind: 'table', rows: words.map((label, k) => ({ label, n: counts[k] })), head: [bank.head, 'Children'] };
  const [a, b] = shuffle(rng, words.map((_, k) => k)), [hi, lo] = counts[a] > counts[b] ? [a, b] : [b, a], answer = counts[hi] - counts[lo];
  return numQ(rng, `How many more chose ${words[hi]} than ${words[lo]}?`, answer, {
    min: 0, max: 999, distractors: decoys(answer, [counts[hi] + counts[lo], counts[hi], counts[lo]], 3), visual,
    say: sayQ(`Look at the table. How many more children chose ${words[hi]} than ${words[lo]}?`), slow: true,
  });
}

export const y4Graphs: Generator = (d: Difficulty, rng: Rng): Question => {
  if (d === 1) return barCard(1, rng);
  if (d === 2) return rng() < 0.5 ? lineCard(2, rng, false) : barCard(2, rng);
  const r = rng();
  return r < 0.25 ? peakCard(rng) : r < 0.5 ? barCard(3, rng) : r < 0.7 ? tableCard(rng) : lineCard(3, rng, true);
};
