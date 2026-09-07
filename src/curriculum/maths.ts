// Maths topics for Reception (EYFS ELGs), Year 1 and Year 2 (National Curriculum KS1).
import type { Difficulty, Generator, Question, Rng, Topic } from './types';
import { ri, pick, shuffle, numQ, wordQ, numberWord, OBJECTS, symSay, coinLabel, SHAPES_2D, SHAPES_3D } from './util';

const q = (prompt: string) => ({ prompt, say: symSay(prompt) });

// ---------- Reception ----------
const rCount: Generator = (d, rng) => {
  const max = d === 1 ? 5 : d === 2 ? 8 : 10;
  const n = ri(rng, 1, max);
  const emoji = pick(rng, OBJECTS);
  return numQ(rng, 'How many?', n, { min: 1, max, visual: { type: 'objects', emoji, n }, say: 'How many can you count?' });
};
const rSubitise: Generator = (d, rng) => {
  const n = ri(rng, 1, d === 1 ? 4 : d === 2 ? 5 : 6);
  return numQ(rng, 'How many dots?', n, { min: 1, max: 6, visual: { type: 'dots', n } });
};
const rOneMore: Generator = (d, rng) => {
  const n = ri(rng, d === 1 ? 1 : 0, d === 3 ? 19 : 9);
  const more = rng() < 0.5;
  const ans = more ? n + 1 : n - 1;
  if (ans < 0) return rOneMore(d, rng);
  return numQ(rng, `One ${more ? 'more' : 'less'} than ${n}?`, ans, { min: 0, max: 20, visual: d < 3 ? { type: 'tenframe', n } : undefined });
};
const rBonds: Generator = (d, rng) => {
  const total = d === 1 ? 5 : d === 2 ? pick(rng, [5, 6, 7, 8]) : 10;
  const a = ri(rng, 0, total);
  return numQ(rng, `${a} + ? = ${total}`, total - a, { min: 0, max: 10, visual: { type: 'tenframe', n: a }, say: `${a} and how many more make ${total}?` });
};
const rAdd: Generator = (d, rng) => {
  const max = d === 1 ? 5 : d === 2 ? 8 : 10;
  const a = ri(rng, 1, max - 1), b = ri(rng, 1, max - a);
  const e1 = pick(rng, OBJECTS);
  return numQ(rng, `${a} + ${b} = ?`, a + b, { min: 0, max: 10, visual: { type: 'objects', emoji: e1, n: a, n2: b, emoji2: e1 }, say: `${a} plus ${b}?` });
};
const rSub: Generator = (d, rng) => {
  const max = d === 1 ? 5 : d === 2 ? 8 : 10;
  const a = ri(rng, 2, max), b = ri(rng, 1, a);
  return numQ(rng, `${a} − ${b} = ?`, a - b, { min: 0, max: 10, visual: { type: 'objects', emoji: pick(rng, OBJECTS), n: a, n2: -b }, say: `${a} take away ${b}?` });
};
const rCompare: Generator = (d, rng) => {
  const max = d === 1 ? 5 : 10;
  let a = ri(rng, 1, max), b = ri(rng, 1, max);
  while (b === a) b = ri(rng, 1, max);
  const wantMore = rng() < 0.5;
  const ans = wantMore ? Math.max(a, b) : Math.min(a, b);
  return numQ(rng, `Which is ${wantMore ? 'more' : 'fewer'}?`, ans, { distractors: [wantMore ? Math.min(a, b) : Math.max(a, b)], n: 1, visual: { type: 'objects', emoji: '🍎', n: a, emoji2: '🍌', n2: b }, say: `Which number is ${wantMore ? 'more' : 'fewer'}, ${a} or ${b}?` });
};
const rCountOn: Generator = (d, rng) => {
  const start = ri(rng, 1, d === 3 ? 25 : d === 2 ? 15 : 8);
  return numQ(rng, `${start}, ${start + 1}, ${start + 2}, ?`, start + 3, { min: 0, max: 30, say: `What comes next? ${start}, ${start + 1}, ${start + 2}…` });
};

// ---------- Year 1 ----------
const y1Bonds: Generator = (d, rng) => {
  const total = d === 1 ? 10 : d === 2 ? pick(rng, [10, 12, 15]) : 20;
  const a = ri(rng, 0, total);
  const missingLeft = rng() < 0.4;
  const p = missingLeft ? `? + ${a} = ${total}` : `${a} + ? = ${total}`;
  return numQ(rng, p, total - a, { min: 0, max: 20, ...q(p), visual: total <= 10 ? { type: 'tenframe', n: a } : undefined });
};
const y1Add: Generator = (d, rng) => {
  const max = d === 1 ? 10 : d === 2 ? 15 : 20;
  const a = ri(rng, 0, max), b = ri(rng, 0, max - a);
  const p = `${a} + ${b} = ?`;
  return numQ(rng, p, a + b, { min: 0, max: 20, ...q(p) });
};
const y1Sub: Generator = (d, rng) => {
  const max = d === 1 ? 10 : d === 2 ? 15 : 20;
  const a = ri(rng, 1, max), b = ri(rng, 0, a);
  const p = `${a} − ${b} = ?`;
  return numQ(rng, p, a - b, { min: 0, max: 20, ...q(p) });
};
const y1Missing: Generator = (d, rng) => {
  const max = d === 1 ? 10 : 20;
  const a = ri(rng, 1, max), b = ri(rng, 0, a);
  const kind = ri(rng, 0, 2);
  const p = kind === 0 ? `${b} + ? = ${a}` : kind === 1 ? `${a} − ? = ${b}` : `? − ${b} = ${a - b}`;
  const ans = kind === 0 ? a - b : kind === 1 ? a - b : a;
  return numQ(rng, p, ans, { min: 0, max: 20, ...q(p) });
};
const y1Skip: Generator = (d, rng) => {
  const step = d === 1 ? 2 : d === 2 ? pick(rng, [2, 5, 10]) : pick(rng, [2, 5, 10]);
  const start = step * ri(rng, 0, d === 3 ? 8 : 4);
  const seq = [start, start + step, start + step * 2];
  const p = `${seq.join(', ')}, ?`;
  return numQ(rng, p, start + step * 3, { min: 0, max: 100, say: `Counting in ${step}s: ${seq.join(', ')}, what comes next?`, distractors: [start + step * 3 + 1, start + step * 3 - 1, start + step * 4] });
};
const y1MoreLess: Generator = (d, rng) => {
  const n = ri(rng, 1, d === 1 ? 30 : d === 2 ? 60 : 99);
  const more = rng() < 0.5;
  return numQ(rng, `One ${more ? 'more' : 'less'} than ${n}?`, more ? n + 1 : n - 1, { min: 0, max: 100 });
};
const y1Words: Generator = (d, rng) => {
  const n = ri(rng, d === 1 ? 1 : 10, d === 3 ? 20 : d === 2 ? 15 : 10);
  if (rng() < 0.5) return numQ(rng, numberWord(n), n, { min: 0, max: 20, say: `Which number is ${numberWord(n)}?`, visual: { type: 'word', text: numberWord(n) } });
  const ds = shuffle(rng, [n - 1, n + 1, n + 2, n - 2].filter(x => x >= 0 && x <= 20)).slice(0, 3).map(numberWord);
  return wordQ(rng, `${n}`, numberWord(n), ds, { say: `Which word says ${n}?`, hint: 'Slice the word' });
};
const y1Half: Generator = (d, rng) => {
  const quarter = d >= 2 && rng() < 0.5;
  const n = quarter ? 4 * ri(rng, 1, d === 3 ? 5 : 3) : 2 * ri(rng, 1, d === 1 ? 5 : 10);
  const ans = quarter ? n / 4 : n / 2;
  return numQ(rng, `${quarter ? 'A quarter' : 'Half'} of ${n} = ?`, ans, { min: 0, max: 20, visual: { type: 'objects', emoji: '🍪', n }, say: `What is ${quarter ? 'a quarter' : 'half'} of ${n}?` });
};
const y1Doubles: Generator = (d, rng) => {
  const n = ri(rng, 1, d === 1 ? 5 : d === 2 ? 10 : 12);
  return numQ(rng, `Double ${n} = ?`, n * 2, { min: 0, max: 24, visual: d === 1 ? { type: 'tenframe', n, n2: n } : undefined });
};
const COINS = [1, 2, 5, 10, 20, 50, 100, 200];
const y1Coins: Generator = (d, rng) => {
  if (d === 1) {
    const c = pick(rng, COINS.slice(0, 6));
    return wordQ(rng, 'Which coin is this?', coinLabel(c), shuffle(rng, COINS.filter(x => x !== c)).slice(0, 3).map(coinLabel), { visual: { type: 'coins', coins: [c] }, say: 'How much is this coin worth?' });
  }
  const count = d === 2 ? 2 : 3;
  const coins = Array.from({ length: count }, () => pick(rng, [1, 2, 5, 10, 20]));
  return unitQ(rng, coins.reduce((s, c) => s + c, 0), coins);
};
function unitQ(rng: Rng, total: number, coins: number[]) {
  const ds = shuffle(rng, [total + 1, total - 1, total + 5, total + 10].filter(x => x > 0 && x !== total)).slice(0, 3);
  return wordQ(rng, 'How much money?', `${total}p`, ds.map(x => `${x}p`), { visual: { type: 'coins', coins }, say: 'How many pence altogether?' });
}
const y1Time: Generator = (d, rng) => {
  const h = ri(rng, 1, 12);
  const half = d >= 2 && rng() < 0.5;
  const ans = half ? `half past ${h}` : `${h} o'clock`;
  const others = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(x => x !== h)).slice(0, 3).map(x => (half ? `half past ${x}` : `${x} o'clock`));
  if (d === 3 && rng() < 0.5) others[0] = half ? `${h} o'clock` : `half past ${h}`;
  return wordQ(rng, 'What time is it?', ans, others, { visual: { type: 'clock', h, m: half ? 30 : 0 } });
};
const y1Arrays: Generator = (d, rng) => {
  const rows = ri(rng, 2, d === 1 ? 2 : 3), cols = ri(rng, 2, d === 1 ? 5 : d === 3 ? 5 : 4);
  return numQ(rng, `${rows} rows of ${cols} = ?`, rows * cols, { min: 2, max: 20, visual: { type: 'array', rows, cols }, say: `${rows} rows of ${cols}. How many altogether?` });
};

// ---------- Year 2 ----------
const y2PlaceValue: Generator = (d, rng) => {
  const n = ri(rng, 10, 99);
  const t = Math.floor(n / 10), o = n % 10;
  const kind = d === 1 ? 0 : ri(rng, 0, 2);
  if (kind === 0) return numQ(rng, `${n}: how many tens?`, t, { min: 0, max: 9, say: `In ${n}, how many tens?`, distractors: [o, t + 1, t - 1] });
  if (kind === 1) return numQ(rng, `${n}: how many ones?`, o, { min: 0, max: 9, say: `In ${n}, how many ones?`, distractors: [t, o + 1, o - 1] });
  return numQ(rng, `${t} tens and ${o} ones = ?`, n, { min: 10, max: 99, distractors: [t + o * 10, n + 10, n - 1] });
};
const y2Compare: Generator = (d, rng) => {
  const max = d === 1 ? 20 : 100;
  const a = ri(rng, 0, max), b = d === 3 && rng() < 0.2 ? a : ri(rng, 0, max);
  const ans = a < b ? '<' : a > b ? '>' : '=';
  return wordQ(rng, `${a} ? ${b}`, ans, ['<', '>', '='], { say: `${a} compared with ${b}. Less than, greater than, or equal?`, hint: 'Slice the correct sign' });
};
const y2Add: Generator = (d, rng) => {
  let a: number, b: number;
  if (d === 1) { a = ri(rng, 10, 89); b = ri(rng, 1, 9); }          // 2-digit + ones
  else if (d === 2) { a = ri(rng, 10, 79); b = 10 * ri(rng, 1, 5); } // 2-digit + tens
  else { a = ri(rng, 10, 60); b = ri(rng, 10, 99 - a); }             // 2-digit + 2-digit
  if (a + b > 100) return y2Add(d, rng);
  const p = `${a} + ${b} = ?`;
  return numQ(rng, p, a + b, { min: 0, max: 100, ...q(p) });
};
const y2Sub: Generator = (d, rng) => {
  let a: number, b: number;
  if (d === 1) { a = ri(rng, 10, 99); b = ri(rng, 1, 9); }
  else if (d === 2) { a = ri(rng, 30, 99); b = 10 * ri(rng, 1, 2); }
  else { a = ri(rng, 30, 99); b = ri(rng, 10, a - 1); }
  const p = `${a} − ${b} = ?`;
  return numQ(rng, p, a - b, { min: 0, max: 100, ...q(p) });
};
const y2Three: Generator = (d, rng) => {
  const max = d === 1 ? 5 : 9;
  const a = ri(rng, 1, max), b = ri(rng, 1, max), c = ri(rng, 1, max);
  const p = `${a} + ${b} + ${c} = ?`;
  return numQ(rng, p, a + b + c, { min: 3, max: 27, ...q(p) });
};
const y2Tables: Generator = (d, rng) => {
  const table = d === 1 ? pick(rng, [2, 10]) : pick(rng, [2, 5, 10]);
  const n = ri(rng, 1, 12);
  const kind = d === 3 ? ri(rng, 0, 2) : d === 2 ? ri(rng, 0, 1) : 0;
  if (kind === 0) { const p = rng() < 0.5 ? `${n} × ${table} = ?` : `${table} × ${n} = ?`; return numQ(rng, p, n * table, { min: 0, max: 120, ...q(p), distractors: [n * table + table, n * table - table, n * table + 1] }); }
  if (kind === 1) { const p = `${n * table} ÷ ${table} = ?`; return numQ(rng, p, n, { min: 0, max: 12, ...q(p) }); }
  const p = `? × ${table} = ${n * table}`; return numQ(rng, p, n, { min: 0, max: 12, ...q(p) });
};
const y2OddEven: Generator = (d, rng) => {
  const n = ri(rng, 1, d === 1 ? 20 : 100);
  return wordQ(rng, `Is ${n} odd or even?`, n % 2 ? 'odd' : 'even', ['odd', 'even']);
};
const y2Inverse: Generator = (d, rng) => {
  const a = ri(rng, 10, d === 1 ? 30 : 99), b = ri(rng, 1, d === 1 ? 9 : Math.min(30, a - 1));
  const kind = ri(rng, 0, 2);
  const p = kind === 0 ? `? − ${b} = ${a - b}` : kind === 1 ? `${a - b} + ? = ${a}` : `${a} − ? = ${b}`;
  const ans = kind === 0 ? a : kind === 1 ? b : a - b;
  return numQ(rng, p, ans, { min: 0, max: 100, ...q(p) });
};
const y2Fractions: Generator = (d, rng) => {
  const fr = d === 1 ? pick(rng, [[1, 2], [1, 4]]) : d === 2 ? pick(rng, [[1, 2], [1, 3], [1, 4]]) : pick(rng, [[1, 3], [1, 4], [2, 4], [3, 4]]);
  const [num, den] = fr;
  if (rng() < 0.4) {
    const shaded = num, parts = den;
    return wordQ(rng, 'What fraction is shaded?', `${num}/${den}`, [`${den}/${num}`, `${num}/${den + 1}`, `${den - num}/${den}`, '1/2'].filter(x => x !== `${num}/${den}`), { visual: { type: 'fraction', parts, shaded }, say: 'What fraction of the shape is shaded?' });
  }
  const whole = den * ri(rng, 1, d === 3 ? 6 : 3);
  const ans = whole / den * num;
  return numQ(rng, `${num}/${den} of ${whole} = ?`, ans, { min: 0, max: 24, say: `What is ${num} ${den === 2 ? 'half' : den === 3 ? 'third' : 'quarter'}${num > 1 ? 's' : ''} of ${whole}?`, visual: { type: 'objects', emoji: '⭐', n: whole } });
};
const y2Money: Generator = (d, rng) => {
  if (d === 1) { const coins = Array.from({ length: 3 }, () => pick(rng, [2, 5, 10, 20, 50])); return unitQ(rng, coins.reduce((s, c) => s + c, 0), coins); }
  if (d === 2) { const coins = Array.from({ length: 2 }, () => pick(rng, [50, 100, 200])); const total = coins.reduce((s, c) => s + c, 0); const fmt = (p: number) => `£${(p / 100).toFixed(2)}`; return wordQ(rng, 'How much money?', fmt(total), [fmt(total + 50), fmt(total - 50), fmt(total + 100)].filter(x => !x.includes('-')), { visual: { type: 'coins', coins }, say: 'How much money altogether?' }); }
  const price = 5 * ri(rng, 1, 19);
  return wordQ(rng, `Change from £1 for ${price}p?`, `${100 - price}p`, [`${100 - price + 5}p`, `${100 - price - 5}p`, `${price}p`], { say: `You pay with £1 for something costing ${price} pence. How much change?` });
};
const y2Time: Generator = (d, rng) => {
  const h = ri(rng, 1, 12);
  const m = d === 1 ? pick(rng, [0, 15, 30, 45]) : d === 2 ? pick(rng, [0, 5, 10, 15, 30, 45]) : 5 * ri(rng, 0, 11);
  const label = (hh: number, mm: number) => mm === 0 ? `${hh} o'clock` : mm === 15 ? `quarter past ${hh}` : mm === 30 ? `half past ${hh}` : mm === 45 ? `quarter to ${hh % 12 + 1}` : mm < 30 ? `${mm} past ${hh}` : `${60 - mm} to ${hh % 12 + 1}`;
  const ans = label(h, m);
  const ds = new Set<string>();
  let guard = 0;
  while (ds.size < 3 && guard++ < 30) { const mm = 5 * ri(rng, 0, 11); const hh = rng() < 0.5 ? h : ri(rng, 1, 12); const l = label(hh, mm); if (l !== ans) ds.add(l); }
  return wordQ(rng, 'What time is it?', ans, [...ds], { visual: { type: 'clock', h, m } });
};
const y2Words: Generator = (d, rng) => {
  const n = ri(rng, d === 1 ? 10 : 21, d === 1 ? 20 : d === 2 ? 60 : 100);
  if (rng() < 0.5) return numQ(rng, numberWord(n), n, { min: 0, max: 100, say: `Which number is ${numberWord(n)}?`, visual: { type: 'word', text: numberWord(n) }, distractors: [n + 10, n - 10, n + 1] });
  const ds = shuffle(rng, [n + 10, n - 10, n + 1, n - 1].filter(x => x >= 0 && x <= 100)).slice(0, 3).map(numberWord);
  return wordQ(rng, `${n}`, numberWord(n), ds, { say: `Which words say ${n}?` });
};
const y2Skip: Generator = (d, rng) => {
  const step = d === 1 ? pick(rng, [2, 5, 10]) : pick(rng, [2, 3, 5, 10]);
  const back = d === 3 && rng() < 0.4;
  const start = back ? step * ri(rng, 5, 10) : step * ri(rng, 0, 6) + (step === 10 ? ri(rng, 0, 9) : 0);
  const s = back ? -step : step;
  const seq = [start, start + s, start + 2 * s];
  return numQ(rng, `${seq.join(', ')}, ?`, start + 3 * s, { min: 0, max: 120, say: `${seq.join(', ')}. What comes next?`, distractors: [start + 3 * s + 1, start + 3 * s - 1, start + 4 * s] });
};

// ---------- Mini-games shared across years ----------
/** Order Up: slice the numbers from smallest to biggest (sequence mode with numbers). */
function orderQ(rng: Rng, max: number, count: number): Question {
  const set = new Set<number>(); let guard = 0;
  while (set.size < count && guard++ < 100) set.add(ri(rng, 0, max));
  const nums = [...set]; const sorted = nums.slice().sort((a, b) => a - b).map(String);
  const shown = shuffle(rng, sorted);
  return { prompt: 'Smallest to biggest!', say: `Slice the numbers from smallest to biggest: ${shown.join(', ')}`, answer: sorted.join(','), sequence: sorted, options: shown, visual: { type: 'word', text: shown.join('  ') }, hint: 'Slice the smallest number first' };
}
const rOrder: Generator = (d, rng) => orderQ(rng, d === 1 ? 5 : 10, 3);
const y1Order: Generator = (d, rng) => orderQ(rng, d === 1 ? 10 : 20, d === 3 ? 4 : 3);
const y2Order: Generator = (d, rng) => orderQ(rng, d === 1 ? 30 : 100, d === 1 ? 3 : 4);

/** Number line: one label is hidden. */
function lineQ(rng: Rng, from: number, step: number, len: number): Question {
  const to = from + step * (len - 1);
  const idx = ri(rng, 1, len - 1); const mark = from + step * idx;
  return numQ(rng, 'Which number is hidden?', mark, { min: 0, max: 120, visual: { type: 'numberline', from, to, mark, step }, say: `Which number is hidden on the number line?`, distractors: [mark + step, mark - step, mark + 1] });
}
const y1Line: Generator = (d, rng) => lineQ(rng, d === 1 ? 0 : ri(rng, 0, d === 2 ? 10 : 90), 1, 6);
const y2Line: Generator = (d, rng) => { const step = d === 1 ? 1 : d === 2 ? pick(rng, [2, 5, 10]) : pick(rng, [2, 3, 5, 10]); return lineQ(rng, step * ri(rng, 0, d === 1 ? 90 : 6), step, 6); };

/** Shapes (Y1 2-D, Y2 3-D) — properties and recognition. Tables live in util.ts (SHAPES_2D/SHAPES_3D). */
const y1Shapes: Generator = (d, rng) => {
  const [g, name, sides] = pick(rng, SHAPES_2D);
  if (d === 1 || (d === 2 && rng() < 0.5)) return wordQ(rng, `Which is a ${name}?`, g, shuffle(rng, SHAPES_2D.filter(x => x[1] !== name)).slice(0, 3).map(x => x[0]), { hint: 'Slice the shape' });
  if (sides === 0) return y1Shapes(d, rng);
  return numQ(rng, `How many sides has a ${name}?`, sides, { min: 0, max: 8, visual: { type: 'word', text: g }, distractors: [sides + 1, sides - 1, sides + 2] });
};
const y2Shapes: Generator = (d, rng) => {
  const [g, name, fact] = pick(rng, SHAPES_3D);
  if (d === 1 || rng() < 0.5) return wordQ(rng, `Which is a ${name}?`, g, shuffle(rng, SHAPES_3D.filter(x => x[1] !== name)).slice(0, 3).map(x => x[0]), { hint: 'Slice the 3-D shape' });
  return wordQ(rng, `A ${name} has…`, fact, shuffle(rng, SHAPES_3D.filter(x => x[2] !== fact)).slice(0, 3).map(x => x[2]), { visual: { type: 'word', text: g }, say: `A ${name} has how many faces?` });
};

/** Balance the Scales: both pans must weigh the same — find the number that makes them equal (= as balance). */
function balanceQ(rng: Rng, left: string, right: string, answer: number, max: number, extra: { say?: string; distractors?: number[]; pans?: [string, string] } = {}): Question {
  const p = `${left} = ${right}`;
  const [pl, pr] = extra.pans ?? [left, right];
  return numQ(rng, p, answer, { min: 0, max, visual: { type: 'scales', left: pl, right: pr }, say: extra.say ?? `Balance the scales! ${symSay(p)}`, hint: 'Make both sides the same', distractors: extra.distractors });
}
const rBalance: Generator = (d, rng) => {
  const emoji = pick(rng, OBJECTS);
  if (d < 3) {
    const n = ri(rng, 1, d === 1 ? 5 : 10);
    return balanceQ(rng, `${n}`, '?', n, 10, { pans: [emoji.repeat(n), '?'], say: `Count the objects. How many make the scales balance?` });
  }
  const a = ri(rng, 3, 10), b = ri(rng, 1, a - 1);
  return balanceQ(rng, `${a}`, `${b} + ?`, a - b, 10, { pans: [emoji.repeat(a), `${emoji.repeat(b)} + ?`], say: `${a} on the left, ${b} on the right. How many more make it balance?`, distractors: [a, b] });
};
const y1Balance: Generator = (d, rng) => {
  if (d === 1) { const a = ri(rng, 1, 9), b = ri(rng, 1, 10 - a); return rng() < 0.5 ? balanceQ(rng, `${a} + ${b}`, '?', a + b, 20) : balanceQ(rng, '?', `${a} + ${b}`, a + b, 20); }
  const a = ri(rng, 1, 15), b = ri(rng, 1, 20 - a), total = a + b;
  const kind = d === 2 ? ri(rng, 0, 1) : ri(rng, 0, 3);
  if (kind === 0) { const c = ri(rng, 1, total - 1); return balanceQ(rng, `${a} + ${b}`, `${c} + ?`, total - c, 20, { distractors: [total, c] }); }
  if (kind === 1) { const c = ri(rng, 1, total - 1); return balanceQ(rng, `${a} + ${b}`, `? + ${c}`, total - c, 20, { distractors: [total, c] }); }
  if (kind === 2 && total < 20) { const c = ri(rng, 1, 20 - total); return balanceQ(rng, `${a} + ${b}`, `? − ${c}`, total + c, 20, { distractors: [total, total - c] }); }
  const big = ri(rng, 5, 20), small = ri(rng, 1, big - 1), c = ri(rng, 1, big - small);
  return balanceQ(rng, `${big} − ${small}`, `? + ${c}`, big - small - c, 20, { distractors: [big - small, big] });
};
const y2Balance: Generator = (d, rng) => {
  if (d === 1) { const a = ri(rng, 1, 15), b = ri(rng, 1, 20 - a), c = ri(rng, 1, a + b - 1); return balanceQ(rng, `${a} + ${b}`, rng() < 0.5 ? `${c} + ?` : `? + ${c}`, a + b - c, 20, { distractors: [a + b, c] }); }
  const kind = d === 2 ? ri(rng, 0, 1) : ri(rng, 0, 3);
  if (kind === 0) { const a = ri(rng, 10, 80), b = ri(rng, 1, 9), c = 10 * ri(rng, 1, Math.floor((a + b) / 10)); return balanceQ(rng, `${a} + ${b}`, `${c} + ?`, a + b - c, 100, { distractors: [a + b, c] }); }
  if (kind === 1) { const a = ri(rng, 10, 80), b = 10 * ri(rng, 1, Math.floor((99 - a) / 10)), c = ri(rng, 1, 9); return balanceQ(rng, `${a} + ${b}`, `? + ${c}`, a + b - c, 100, { distractors: [a + b, a + b + c] }); }
  if (kind === 2) { const t = pick(rng, [2, 5, 10]), n = ri(rng, 2, 10), c = ri(rng, 1, t * n - 1); return balanceQ(rng, `${n} × ${t}`, rng() < 0.5 ? `${c} + ?` : `? + ${c}`, t * n - c, 100, { distractors: [t * n, c] }); }
  const a = ri(rng, 10, 70), b = ri(rng, 1, 20), c = ri(rng, 1, Math.max(1, 99 - a - b));
  return balanceQ(rng, `${a} + ${b}`, `? − ${c}`, a + b + c, 100, { distractors: [a + b, a + b - c] });
};

// ---------- Measurement & time (Y1/Y2 Measurement) — issue #8 ----------
// All text/spoken questions (no new visuals): the value is read aloud and shown in the hint, the child slices the answer.
const COLOURS = ['red', 'blue', 'green', 'yellow', 'purple'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const UNIT_WORD: Record<string, string> = { cm: 'centimetres', m: 'metres', g: 'grams', kg: 'kilograms', ml: 'millilitres', l: 'litres' };

function uniqVals(rng: Rng, n: number, lo: number, hi: number): number[] {
  const s = new Set<number>(); let guard = 0;
  while (s.size < n && guard++ < 200) s.add(ri(rng, lo, hi));
  return [...s];
}
/** Slice the coloured thing that is the biggest/smallest by a measured value (d1 = 2 things comparative, d2/3 = 3 things superlative). */
function measureCompare(rng: Rng, d: Difficulty, noun: string, unit: string, forms: [string, string, string, string], lo: number, hi: number): Question {
  const n = d === 1 ? 2 : 3;                                   // forms = [compBig, compSmall, superBig, superSmall]
  const cols = shuffle(rng, COLOURS).slice(0, n);
  const vals = uniqVals(rng, n, lo, hi);
  const big = rng() < 0.5;
  const idx = vals.indexOf(big ? Math.max(...vals) : Math.min(...vals));
  const adj = n === 2 ? (big ? forms[0] : forms[1]) : (big ? forms[2] : forms[3]);
  const spoken = cols.map((c, i) => `the ${c} ${noun} is ${vals[i]} ${UNIT_WORD[unit]}`).join(', ');
  return wordQ(rng, n === 2 ? `Which is ${adj}?` : `Which is the ${adj}?`, cols[idx], cols.filter((_, i) => i !== idx), {
    hint: cols.map((c, i) => `${c} ${noun}: ${vals[i]} ${unit}`).join(' · '),
    say: `${spoken}. Which one is ${n === 2 ? adj : 'the ' + adj}?`,
  });
}
/** "Best unit" question: measure a familiar object in the smaller or larger standard unit. */
function unitChoice(rng: Rng, things: [string, string][], small: string, large: string, verb: string): Question {
  const [thing, unit] = pick(rng, things);
  return wordQ(rng, `Best unit for a ${thing}?`, unit, [unit === small ? large : small], {
    say: `Would you ${verb} a ${thing} in ${UNIT_WORD[small]} or ${UNIT_WORD[large]}?`, hint: `${UNIT_WORD[small]} (${small}) or ${UNIT_WORD[large]} (${large})?`,
  });
}

const y1Length: Generator = (d, rng) => rng() < 0.5
  ? measureCompare(rng, d, pick(rng, ['pencil', 'ribbon', 'snake', 'straw', 'scarf']), 'cm', ['longer', 'shorter', 'longest', 'shortest'], d === 1 ? 3 : 5, d === 1 ? 12 : 40)
  : measureCompare(rng, d, pick(rng, ['sunflower', 'tower', 'ladder', 'plant']), 'cm', ['taller', 'shorter', 'tallest', 'shortest'], d === 1 ? 5 : 10, d === 1 ? 20 : 60);
const y1Mass: Generator = (d, rng) =>
  measureCompare(rng, d, pick(rng, ['bag', 'parcel', 'box', 'basket']), 'g', ['heavier', 'lighter', 'heaviest', 'lightest'], d === 1 ? 5 : 20, d === 1 ? 30 : 100);
const y1Capacity: Generator = (d, rng) =>
  measureCompare(rng, d, pick(rng, ['jug', 'cup', 'bottle', 'bucket']), 'ml', ['fuller', 'emptier', 'fullest', 'emptiest'], d === 1 ? 10 : 50, d === 1 ? 90 : 500);
const y1Months: Generator = (d, rng) => {
  const kind = d === 1 ? ri(rng, 0, 1) : ri(rng, 0, 2);
  if (kind === 0) { const i = ri(rng, 0, 6), after = rng() < 0.5, ans = DAYS[(i + (after ? 1 : 6)) % 7]; return wordQ(rng, `Which day comes ${after ? 'after' : 'before'} ${DAYS[i]}?`, ans, shuffle(rng, DAYS.filter(x => x !== ans)).slice(0, 3), { say: `Which day comes ${after ? 'after' : 'before'} ${DAYS[i]}?` }); }
  if (kind === 1) { const [phrase, n] = pick(rng, [['days in a week', 7], ['months in a year', 12], ['seasons in a year', 4], ['days in a weekend', 2]] as [string, number][]); return numQ(rng, `How many ${phrase}?`, n, { min: 0, max: 20, say: `How many ${phrase}?`, distractors: [n + 1, n - 1, n + 2] }); }
  const i = ri(rng, 0, 11), after = rng() < 0.5, ans = MONTHS[(i + (after ? 1 : 11)) % 12];
  return wordQ(rng, `Which month comes ${after ? 'after' : 'before'} ${MONTHS[i]}?`, ans, shuffle(rng, MONTHS.filter(x => x !== ans)).slice(0, 3), { say: `Which month comes ${after ? 'after' : 'before'} ${MONTHS[i]}?` });
};

const y2Length: Generator = (d, rng) => {
  const kind = d === 1 ? ri(rng, 0, 1) : ri(rng, 0, 3);
  if (kind === 0) return measureCompare(rng, d, pick(rng, ['rope', 'ribbon', 'plank', 'path']), 'cm', ['longer', 'shorter', 'longest', 'shortest'], 10, 99);
  if (kind === 1) return unitChoice(rng, [['pencil', 'cm'], ['finger', 'cm'], ['book', 'cm'], ['door', 'm'], ['room', 'm'], ['garden', 'm'], ['playground', 'm']], 'cm', 'm', 'measure');
  if (kind === 2) { const [phrase, ans, ds] = pick(rng, [['1 metre', '100 cm', ['10 cm', '1000 cm', '50 cm']], ['half a metre', '50 cm', ['5 cm', '500 cm', '15 cm']], ['2 metres', '200 cm', ['20 cm', '2000 cm', '120 cm']]] as [string, string, string[]][]); return wordQ(rng, `${phrase} = ?`, ans, ds, { say: `How many centimetres is ${phrase}?` }); }
  const a = ri(rng, 10, 50), b = ri(rng, 10, 50);
  return wordQ(rng, `${a} cm + ${b} cm = ?`, `${a + b} cm`, [`${a + b + 10} cm`, `${a + b - 10} cm`, `${Math.abs(a - b)} cm`], { say: `${a} centimetres plus ${b} centimetres. How long altogether?` });
};
const y2Mass: Generator = (d, rng) => {
  const kind = d === 1 ? ri(rng, 0, 1) : ri(rng, 0, 2);
  if (kind === 0) return measureCompare(rng, d, pick(rng, ['sack', 'box', 'parcel', 'melon']), 'g', ['heavier', 'lighter', 'heaviest', 'lightest'], 50, 900);
  if (kind === 1) return unitChoice(rng, [['feather', 'g'], ['apple', 'g'], ['coin', 'g'], ['cat', 'kg'], ['dog', 'kg'], ['bag of flour', 'kg']], 'g', 'kg', 'weigh');
  const [phrase, ans, ds] = pick(rng, [['1 kilogram', '1000 g', ['100 g', '10 g', '500 g']], ['half a kilogram', '500 g', ['50 g', '5000 g', '250 g']], ['2 kilograms', '2000 g', ['200 g', '20 g', '1200 g']]] as [string, string, string[]][]);
  return wordQ(rng, `${phrase} = ?`, ans, ds, { say: `How many grams is ${phrase}?` });
};
const y2Capacity: Generator = (d, rng) => {
  const kind = d === 1 ? ri(rng, 0, 1) : ri(rng, 0, 2);
  if (kind === 0) return measureCompare(rng, d, pick(rng, ['bottle', 'jug', 'tank', 'flask']), 'ml', ['fuller', 'emptier', 'fullest', 'emptiest'], 50, 900);
  if (kind === 1) return unitChoice(rng, [['teaspoon', 'ml'], ['cup', 'ml'], ['mug', 'ml'], ['bath', 'l'], ['bucket', 'l'], ['paddling pool', 'l']], 'ml', 'l', 'measure');
  const [phrase, ans, ds] = pick(rng, [['1 litre', '1000 ml', ['100 ml', '10 ml', '500 ml']], ['half a litre', '500 ml', ['50 ml', '5000 ml', '250 ml']], ['2 litres', '2000 ml', ['200 ml', '20 ml', '1200 ml']]] as [string, string, string[]][]);
  return wordQ(rng, `${phrase} = ?`, ans, ds, { say: `How many millilitres is ${phrase}?` });
};
const y2Temp: Generator = (d, rng) => {
  if (d >= 2 && rng() < 0.4) {
    const [thing, t] = pick(rng, [['ice', 0], ['a cold morning', 5], ['a warm room', 20], ['a hot bath', 40], ['a summer day', 28], ['inside a fridge', 4]] as [string, number][]);
    const ds = uniqVals(rng, 4, Math.max(0, t - 8), t + 12).filter(x => x !== t).slice(0, 3).map(x => `${x}°C`);
    return wordQ(rng, `Temperature of ${thing}?`, `${t}°C`, ds, { say: `About what temperature is ${thing}?` });
  }
  const warmer = rng() < 0.5;
  const [ca, cb] = shuffle(rng, ['the town', 'the hill', 'the beach', 'the park', 'the wood', 'the lake']).slice(0, 2);
  let a = ri(rng, 0, 35), b = a; while (b === a) b = ri(rng, 0, 35);
  const first = warmer ? a > b : a < b;
  return wordQ(rng, `Which was ${warmer ? 'warmer' : 'colder'}?`, first ? ca : cb, [first ? cb : ca], { hint: `${ca}: ${a}°C · ${cb}: ${b}°C`, say: `${ca} was ${a} degrees. ${cb} was ${b} degrees. Which was ${warmer ? 'warmer' : 'colder'}?` });
};
const DURATIONS: [string, number][] = [['minutes in an hour', 60], ['seconds in a minute', 60], ['hours in a day', 24], ['days in a week', 7], ['days in a fortnight', 14], ['weeks in a year', 52], ['months in a year', 12], ['minutes in half an hour', 30], ['minutes in a quarter of an hour', 15], ['days in September', 30], ['days in July', 31]];
const y2Duration: Generator = (d, rng) => {
  if (rng() < 0.35) { const i = ri(rng, 0, 11), after = rng() < 0.5, ans = MONTHS[(i + (after ? 1 : 11)) % 12]; return wordQ(rng, `Which month comes ${after ? 'after' : 'before'} ${MONTHS[i]}?`, ans, shuffle(rng, MONTHS.filter(x => x !== ans)).slice(0, 3), { say: `Which month comes ${after ? 'after' : 'before'} ${MONTHS[i]}?` }); }
  const [phrase, n] = pick(rng, d === 1 ? DURATIONS.slice(0, 8) : DURATIONS);
  return numQ(rng, `How many ${phrase}?`, n, { min: 0, max: 120, say: `How many ${phrase}?`, distractors: [n + 1, n - 1, n === 60 ? 30 : n * 2] });
};

// ---------- Position & direction (#8 Phase 2) ----------
// Four compass directions in clockwise order, each with its arrow; a turn moves that many quarter-steps round the ring.
const DIRS: [string, string][] = [['up', '⬆️'], ['right', '➡️'], ['down', '⬇️'], ['left', '⬅️']];
const ARROWS = DIRS.map(d => d[1]);
const TURNS_Y1: [string, number][] = [['a quarter turn', 1], ['a half turn', 2], ['a whole turn', 4]];
const TURNS_ALL: [string, number][] = [['a quarter turn', 1], ['a half turn', 2], ['a three-quarter turn', 3], ['a whole turn', 4]];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Direction faced after turning `steps` quarter-turns clockwise (or anti-clockwise) from `start` (indices into DIRS). */
export const turnEnd = (start: number, steps: number, clockwise: boolean): number => (((start + (clockwise ? steps : -steps)) % 4) + 4) % 4;

const y1Position: Generator = (d, rng) => {
  const kind = d === 1 ? ri(rng, 0, 1) : ri(rng, 0, 2);
  if (kind === 0) {                                              // name the way an arrow points
    const [word, arrow] = pick(rng, DIRS);
    return wordQ(rng, `Which way does ${arrow} point?`, word, DIRS.map(x => x[0]).filter(w => w !== word), { say: 'Which way does the arrow point? Up, down, left or right?', hint: 'Slice the word' });
  }
  if (kind === 1) {                                              // pick the arrow for a direction
    const [word, arrow] = pick(rng, DIRS);
    return wordQ(rng, `Which arrow points ${word}?`, arrow, ARROWS.filter(a => a !== arrow), { say: `Which arrow points ${word}?`, hint: 'Slice the arrow' });
  }
  const [name, steps] = pick(rng, d === 3 ? TURNS_ALL : TURNS_Y1);   // where do you face after a turn?
  const cw = rng() < 0.5, start = ri(rng, 0, 3), end = turnEnd(start, steps, cw);
  return wordQ(rng, `Face ${DIRS[start][1]}, then ${name} ${cw ? 'clockwise' : 'anti-clockwise'}. Which way now?`, DIRS[end][1], ARROWS.filter(a => a !== DIRS[end][1]), {
    say: `You are facing ${DIRS[start][0]}. Make ${name} ${cw ? 'clockwise' : 'anti-clockwise'}. Which way are you facing now?`, hint: 'Slice the arrow',
  });
};

const y2Position: Generator = (d, rng) => {
  const kind = d === 1 ? ri(rng, 0, 1) : ri(rng, 0, 2);
  if (kind === 0) {                                              // where do you face after a turn (all four turns, both directions)
    const [name, steps] = pick(rng, TURNS_ALL);
    const cw = rng() < 0.5, start = ri(rng, 0, 3), end = turnEnd(start, steps, cw);
    return wordQ(rng, `Face ${DIRS[start][1]}, then ${name} ${cw ? 'clockwise' : 'anti-clockwise'}. Which way now?`, DIRS[end][1], ARROWS.filter(a => a !== DIRS[end][1]), {
      say: `You are facing ${DIRS[start][0]}. Turn ${name} ${cw ? 'clockwise' : 'anti-clockwise'}. Which way are you facing now?`, hint: 'Slice the arrow',
    });
  }
  if (kind === 1) {                                              // rotation as right angles
    const [name, steps] = pick(rng, TURNS_ALL);
    if (rng() < 0.5) return numQ(rng, `${cap(name)} = how many right angles?`, steps, { min: 0, max: 8, say: `How many right angles are the same as ${name}?`, distractors: [steps + 1, steps - 1, steps + 2] });
    return wordQ(rng, `${steps} right angle${steps === 1 ? '' : 's'} = ?`, name, TURNS_ALL.filter(t => t[0] !== name).map(t => t[0]), { say: `Which turn is the same as ${steps} right angle${steps === 1 ? '' : 's'}?`, hint: 'Slice the turn' });
  }
  const cw = rng() < 0.5, steps = pick(rng, [1, 2, 3]), start = ri(rng, 0, 3), end = turnEnd(start, steps, cw), name = TURNS_ALL[steps - 1][0];
  return wordQ(rng, `Face ${DIRS[start][1]}, turn ${cw ? 'clockwise' : 'anti-clockwise'} to face ${DIRS[end][1]}. Which turn?`, name, TURNS_ALL.filter(t => t[0] !== name).map(t => t[0]), {
    say: `You turn ${cw ? 'clockwise' : 'anti-clockwise'} from ${DIRS[start][0]} to ${DIRS[end][0]}. Which turn was it?`, hint: 'Slice the turn',
  });
};

export const MATHS_TOPICS: Topic[] = [
  // Reception — EYFS Early Learning Goals: Number, Numerical Patterns
  { id: 'r-count', title: 'Count It', icon: '🍎', subject: 'maths', year: 'reception', nc: 'ELG Number: count objects to 10', gen: rCount },
  { id: 'r-subitise', title: 'Quick Dots', icon: '🎲', subject: 'maths', year: 'reception', nc: 'ELG Number: subitise to 5', gen: rSubitise },
  { id: 'r-compare', title: 'More or Fewer', icon: '⚖️', subject: 'maths', year: 'reception', nc: 'ELG Patterns: compare quantities', gen: rCompare },
  { id: 'r-onemore', title: 'One More, One Less', icon: '➕', subject: 'maths', year: 'reception', nc: 'ELG Number: composition to 10', gen: rOneMore },
  { id: 'r-bonds', title: 'Number Bonds', icon: '🔗', subject: 'maths', year: 'reception', nc: 'ELG Number: bonds to 5 and 10', gen: rBonds },
  { id: 'r-add', title: 'Adding', icon: '🧮', subject: 'maths', year: 'reception', nc: 'ELG Number: composition, addition to 10', gen: rAdd },
  { id: 'r-sub', title: 'Taking Away', icon: '✂️', subject: 'maths', year: 'reception', nc: 'ELG Number: subtraction facts', gen: rSub },
  { id: 'r-counton', title: 'What Comes Next?', icon: '🔢', subject: 'maths', year: 'reception', nc: 'ELG Patterns: count beyond 20', gen: rCountOn },
  { id: 'r-order', title: 'Order Up!', icon: '📶', subject: 'maths', year: 'reception', nc: 'ELG Patterns: compare and order to 10', gen: rOrder },
  { id: 'r-balance', title: 'Balance the Scales', icon: '⚖️', subject: 'maths', year: 'reception', nc: 'ELG Number: composition, equal amounts', gen: rBalance },
  // Year 1
  { id: 'y1-bonds', title: 'Number Bonds', icon: '🔗', subject: 'maths', year: 'year1', nc: 'Y1 A&S: bonds within 20', gen: y1Bonds },
  { id: 'y1-add', title: 'Adding to 20', icon: '➕', subject: 'maths', year: 'year1', nc: 'Y1 A&S: add within 20', gen: y1Add },
  { id: 'y1-sub', title: 'Subtracting', icon: '➖', subject: 'maths', year: 'year1', nc: 'Y1 A&S: subtract within 20', gen: y1Sub },
  { id: 'y1-missing', title: 'Missing Number', icon: '❓', subject: 'maths', year: 'year1', nc: 'Y1 A&S: missing number problems', gen: y1Missing },
  { id: 'y1-doubles', title: 'Doubles', icon: '👯', subject: 'maths', year: 'year1', nc: 'Y1 A&S: doubles', gen: y1Doubles },
  { id: 'y1-skip', title: 'Count in 2s, 5s, 10s', icon: '🦘', subject: 'maths', year: 'year1', nc: 'Y1 NPV: count in multiples', gen: y1Skip },
  { id: 'y1-moreless', title: 'One More, One Less', icon: '🔼', subject: 'maths', year: 'year1', nc: 'Y1 NPV: one more/less to 100', gen: y1MoreLess },
  { id: 'y1-words', title: 'Number Words', icon: '🔤', subject: 'maths', year: 'year1', nc: 'Y1 NPV: numbers to 20 in words', gen: y1Words },
  { id: 'y1-half', title: 'Halves & Quarters', icon: '🍕', subject: 'maths', year: 'year1', nc: 'Y1 Fractions: half, quarter', gen: y1Half },
  { id: 'y1-arrays', title: 'Arrays', icon: '🟦', subject: 'maths', year: 'year1', nc: 'Y1 M&D: arrays, grouping', gen: y1Arrays },
  { id: 'y1-coins', title: 'Coins', icon: '🪙', subject: 'maths', year: 'year1', nc: 'Y1 Measurement: coins', gen: y1Coins },
  { id: 'y1-time', title: "O'clock & Half Past", icon: '🕐', subject: 'maths', year: 'year1', nc: 'Y1 Measurement: time', gen: y1Time },
  { id: 'y1-order', title: 'Order Up!', icon: '📶', subject: 'maths', year: 'year1', nc: 'Y1 NPV: order numbers to 20', gen: y1Order },
  { id: 'y1-line', title: 'Number Line', icon: '📏', subject: 'maths', year: 'year1', nc: 'Y1 NPV: number line', gen: y1Line },
  { id: 'y1-shapes', title: '2-D Shapes', icon: '🔷', subject: 'maths', year: 'year1', nc: 'Y1 Geometry: 2-D shapes', gen: y1Shapes },
  { id: 'y1-position', title: 'Left, Right & Turns', icon: '🧭', subject: 'maths', year: 'year1', nc: 'Y1 Geometry: position, direction, turns', gen: y1Position },
  { id: 'y1-length', title: 'Long & Tall', icon: '📏', subject: 'maths', year: 'year1', nc: 'Y1 Measurement: length & height', gen: y1Length },
  { id: 'y1-mass', title: 'Heavy & Light', icon: '🏋️', subject: 'maths', year: 'year1', nc: 'Y1 Measurement: mass/weight', gen: y1Mass },
  { id: 'y1-capacity', title: 'Full & Empty', icon: '🥤', subject: 'maths', year: 'year1', nc: 'Y1 Measurement: capacity & volume', gen: y1Capacity },
  { id: 'y1-months', title: 'Days & Months', icon: '📅', subject: 'maths', year: 'year1', nc: 'Y1 Measurement: time (days, weeks, months)', gen: y1Months },
  { id: 'y1-balance', title: 'Balance the Scales', icon: '⚖️', subject: 'maths', year: 'year1', nc: 'Y1 A&S: equals sign, missing number', gen: y1Balance },
  // Year 2
  { id: 'y2-pv', title: 'Tens & Ones', icon: '🔟', subject: 'maths', year: 'year2', nc: 'Y2 NPV: place value', gen: y2PlaceValue },
  { id: 'y2-compare', title: 'Compare < > =', icon: '⚖️', subject: 'maths', year: 'year2', nc: 'Y2 NPV: compare to 100', gen: y2Compare },
  { id: 'y2-skip', title: 'Count in 2s, 3s, 5s, 10s', icon: '🦘', subject: 'maths', year: 'year2', nc: 'Y2 NPV: count in steps', gen: y2Skip },
  { id: 'y2-add', title: 'Adding to 100', icon: '➕', subject: 'maths', year: 'year2', nc: 'Y2 A&S: 2-digit addition', gen: y2Add },
  { id: 'y2-sub', title: 'Subtracting', icon: '➖', subject: 'maths', year: 'year2', nc: 'Y2 A&S: 2-digit subtraction', gen: y2Sub },
  { id: 'y2-three', title: 'Three Numbers', icon: '🎯', subject: 'maths', year: 'year2', nc: 'Y2 A&S: add three 1-digit', gen: y2Three },
  { id: 'y2-inverse', title: 'Missing Number', icon: '❓', subject: 'maths', year: 'year2', nc: 'Y2 A&S: inverse, missing number', gen: y2Inverse },
  { id: 'y2-tables', title: '2, 5, 10 Times Tables', icon: '✖️', subject: 'maths', year: 'year2', nc: 'Y2 M&D: 2, 5, 10 tables ×÷', gen: y2Tables },
  { id: 'y2-oddeven', title: 'Odd or Even', icon: '🐾', subject: 'maths', year: 'year2', nc: 'Y2 M&D: odd and even', gen: y2OddEven },
  { id: 'y2-fractions', title: 'Fractions', icon: '🍕', subject: 'maths', year: 'year2', nc: 'Y2 Fractions: 1/3 1/4 2/4 3/4', gen: y2Fractions },
  { id: 'y2-money', title: 'Money £ and p', icon: '💷', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: money, change', gen: y2Money },
  { id: 'y2-time', title: 'Telling Time', icon: '🕔', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: time to 5 min', gen: y2Time },
  { id: 'y2-words', title: 'Number Words', icon: '🔤', subject: 'maths', year: 'year2', nc: 'Y2 NPV: numbers to 100 in words', gen: y2Words },
  { id: 'y2-order', title: 'Order Up!', icon: '📶', subject: 'maths', year: 'year2', nc: 'Y2 NPV: order numbers to 100', gen: y2Order },
  { id: 'y2-line', title: 'Number Line', icon: '📏', subject: 'maths', year: 'year2', nc: 'Y2 NPV: number line, steps', gen: y2Line },
  { id: 'y2-shapes', title: '3-D Shapes', icon: '🎲', subject: 'maths', year: 'year2', nc: 'Y2 Geometry: 3-D shapes, faces', gen: y2Shapes },
  { id: 'y2-position', title: 'Turns & Right Angles', icon: '🧭', subject: 'maths', year: 'year2', nc: 'Y2 Geometry: position, direction, rotation as right angles', gen: y2Position },
  { id: 'y2-length', title: 'Length: cm & m', icon: '📏', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: length (cm/m)', gen: y2Length },
  { id: 'y2-mass', title: 'Mass: g & kg', icon: '🏋️', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: mass (g/kg)', gen: y2Mass },
  { id: 'y2-capacity', title: 'Capacity: ml & l', icon: '🥤', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: capacity (ml/l)', gen: y2Capacity },
  { id: 'y2-temp', title: 'Temperature', icon: '🌡️', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: temperature (°C)', gen: y2Temp },
  { id: 'y2-duration', title: 'Time & Durations', icon: '⏳', subject: 'maths', year: 'year2', nc: 'Y2 Measurement: time, durations, months', gen: y2Duration },
  { id: 'y2-balance', title: 'Balance the Scales', icon: '⚖️', subject: 'maths', year: 'year2', nc: 'Y2 A&S: equivalence, inverse, tables', gen: y2Balance },
];

export type { Difficulty };
