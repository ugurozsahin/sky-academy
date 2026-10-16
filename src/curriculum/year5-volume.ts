// y5-volume (#1206): volume as a count of 1 cm³ cubes, and sensible capacity estimates (5M38). No 3-D picture: the card draws ONE layer
// on the squares grid (`symmetry` visual, `mirror: false`) and says in the text how many layers there are. d1 is one layer, d2 a
// rectangular layer repeated, d3 an L-shaped layer repeated or a capacity estimate (every wrong size is at least ×10 away).
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { fill, cells, rows, perimeter, opts, type Grid } from './gridshape';
import { ks2Say } from './ks2say';

const vis = (grid: string[]) => ({ visual: { type: 'symmetry' as const, grid, mirror: false as const } });
const hint = 'Volume counts the cubes: cubes in one layer × the number of layers';

/** Decoys: the named slips first, then (answers of 20 or more) one decoy sharing the leading digit and one sharing the last (#1058). */
function card(rng: Rng, prompt: string, say: string, answer: number, named: number[], grid: Grid): Question {
  const ds = [...new Set(named.filter(v => v >= 1 && v !== answer))].slice(0, answer >= 20 ? 1 : 3);
  if (answer >= 20) {
    const has = (f: (v: number) => boolean) => ds.some(f);
    const lead = (v: number) => String(v)[0], last = (v: number) => v % 10;
    if (!has(v => lead(v) === lead(answer))) { const l = [1, -1, 2, -2, 3, -3].map(k => answer + k).find(c => c >= 1 && lead(c) === lead(answer) && !ds.includes(c)); if (l) ds.push(l); }
    if (!has(v => last(v) === last(answer))) ds.push(answer > 10 && rng() < 0.5 ? answer - 10 : answer + 10);
  }
  for (const v of named) if (ds.length < 3 && v >= 1 && v !== answer && !ds.includes(v)) ds.push(v);
  return opts(rng, prompt, answer, ds, { say: ks2Say(say), hint, ...vis(rows(grid)) });
}

/** An L: a rectangle with a rectangular corner taken out. */
function lShape(rng: Rng): Grid {
  const w = ri(rng, 3, 6), h = ri(rng, 3, 5), g = fill(w, h), nw = ri(rng, 1, w - 2), nh = ri(rng, 1, h - 2);
  const x0 = pick(rng, [0, w - nw]), y0 = pick(rng, [0, h - nh]);
  for (let y = y0; y < y0 + nh; y++) for (let x = x0; x < x0 + nw; x++) g[y][x] = false;
  return g;
}

/** A layer of squares, the layers in it, and the card that asks for the volume. */
function layered(rng: Rng, g: Grid, layers: number): Question {
  const layer = cells(g), v = layer * layers;
  const text = layers === 1 ? 'One layer of 1 cm³ cubes.' : `${layers} layers like this, each cube 1 cm³.`;
  const spoken = layers === 1 ? 'This is one layer of one cubic centimetre cubes.' : `There are ${layers} layers like this, and each cube is one cubic centimetre.`;
  const named = layers === 1 ? [perimeter(g), g[0].length + g.length, layer + 1] : [layer + layers, layer, perimeter(g) * layers];
  return card(rng, `${text} Volume = ? cm³`, `${spoken} What is the volume in cubic centimetres?`, v, named, g);
}

const rect = (rng: Rng, max: number): Grid => { for (;;) { const g = fill(ri(rng, 2, 6), ri(rng, 2, 4)); if (cells(g) <= max) return g; } };

/** Everyday containers and their sensible capacity in ml. Every wrong size offered is at least ×10 or ÷10 away. */
export const CAPACITY: readonly [string, number][] = [
  ['a mug', 300], ['a teaspoon', 5], ['a bucket', 10000], ['a bath', 150000], ['a water bottle', 500], ['a fish tank', 60000],
  ['a kettle', 1500], ['a yoghurt pot', 150], ['a swimming pool', 25000000], ['a bottle of medicine', 100], ['a watering can', 8000], ['a juice carton', 1000],
];
const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+$)/g, ',');   // four digits or more take commas (#1047)
export const capLabel = (ml: number): string => (ml < 1000 ? `${ml} ml` : `${grouped(ml / 1000)} l`);

function capacity(rng: Rng): Question {
  const [thing, ml] = pick(rng, CAPACITY);
  const slips = [ml * 10, ml / 10, ml * 100, ml / 100, ml * 1000].filter(v => Number.isInteger(v) && v >= 1 && (v < 1000 || v % 100 === 0));
  const ds = shuffle(rng, slips).slice(0, 3);
  return wordQ(rng, `About how much does ${thing} hold?`, capLabel(ml), ds.map(capLabel), { say: `About how much does ${thing} hold?`, hint: 'Think of a real one. Is it a sip, a mug, a bucket or a bath?', hintIsData: false });
}

export const y5Volume: Generator = (level: Difficulty, rng) => {
  if (level === 1) return layered(rng, rect(rng, 20), 1);
  if (level === 2) { const g = rect(rng, 20), layers = ri(rng, 2, 5); return layered(rng, g, layers); }
  if (rng() < 0.4) return capacity(rng);
  for (;;) { const g = lShape(rng), layers = ri(rng, 2, 5); if (cells(g) * layers <= 100) return layered(rng, g, layers); }
};
