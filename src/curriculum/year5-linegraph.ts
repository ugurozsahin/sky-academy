// y5-linegraph (#1215): comparison, sum and difference problems from a line graph (NC 5M48). d1 read one point;
// d2 how much more at one time than another, or "when was it ...est?" (one unique extreme); d3 the total of three
// days in a row, or the highest take away the lowest. Every plotted value is a multiple of the axis step, every
// answer is worked out from the visual's own rows, and no prompt or `say` states a plotted value.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, numQ, wordQ, numberWord } from './util';
import { ks2Say } from './ks2say';

interface Bank {
  noun: string; unit: string; say: string; step: number; max: number; at: string; days: boolean;
  read: (l: string) => string; diff: (hi: string, lo: string) => string; peak: string; low: string;
}
const hh = (i: number) => `${String(8 + 2 * i).padStart(2, '0')}:00`;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BANKS: readonly Bank[] = [
  { noun: 'temperature', unit: '°C', say: 'degrees Celsius', step: 2, max: 20, at: 'at', days: false,
    read: l => `What was the temperature at ${l}?`, diff: (h, l) => `How much warmer at ${h} than at ${l}?`, peak: 'When was it warmest?', low: 'When was it coldest?' },
  { noun: 'rainfall', unit: 'mm', say: 'millimetres', step: 5, max: 40, at: 'on', days: true,
    read: l => `How much rain fell on ${l}?`, diff: (h, l) => `How much more rain fell on ${h} than ${l}?`, peak: 'Which day had the most rain?', low: 'Which day had the least rain?' },
  { noun: 'height', unit: 'cm', say: 'centimetres', step: 10, max: 60, at: 'in', days: false,
    read: l => `How tall was the plant in ${l}?`, diff: (h, l) => `How much taller in ${h} than in ${l}?`, peak: 'When was the plant tallest?', low: 'When was the plant shortest?' },
  { noun: 'visitors', unit: 'people', say: 'people', step: 10, max: 80, at: 'on', days: true,
    read: l => `How many visitors came on ${l}?`, diff: (h, l) => `How many more visitors on ${h} than ${l}?`, peak: 'Which day had the most visitors?', low: 'Which day had the fewest visitors?' },
];
const labelsOf = (b: Bank, n: number): string[] => b.days ? DAYS.slice(0, n) : Array.from({ length: n }, (_, i) => (b.noun === 'height' ? `Wk ${i + 1}` : hh(i)));

/** `ks2Say` turns a `?` into " what" and reads "08:00" as hours, so each sentence is said without its `?`, which is put back after. */
const sayQ = (text: string) => text.split('?').map((part, i, all) => {
  const t = part.trim();
  return t ? ks2Say(t) + (i < all.length - 1 ? '?' : '') : '';
}).filter(Boolean).join(' ');
const spoken = (label: string): string => {
  const t = /^(\d\d):00$/.exec(label), w = /^Wk (\d)$/.exec(label);
  return t ? `${numberWord(Number(t[1]))} o'clock` : w ? `week ${numberWord(Number(w[1]))}` : label;
};

/** Named slips first; an answer of 20 or more also gets a decoy sharing its last digit and one sharing its leading digit (#1058), then fillers. */
function decoys(answer: number, named: number[], need: number, step: number): number[] {
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v !== answer;
  const lead = (v: number) => String(v)[0];
  const share = answer >= 20 ? [[10, -10, 20, -20].map(k => answer + k).find(ok), [step, -step, 1, -1, 2, -2, 3, -3, 5, -5].map(k => answer + k).find(v => ok(v) && lead(v) === lead(answer))] : [];
  const out: number[] = [];
  const first = named.find(ok);
  for (const v of [first, ...share, ...named, ...[1, -1, 2, -2, 3, -3, 5, -5, 10, -10].map(k => answer + k)]) if (v !== undefined && ok(v) && !out.includes(v)) out.push(v);
  return out.slice(0, need);
}

/** Distinct readings on the gridlines; the walk keeps neighbours close, as a real graph does. */
function series(rng: Rng, b: Bank, count: number): number[] {
  const top = b.max / b.step;
  for (let tries = 0; tries < 200; tries++) {
    const v: number[] = [];
    let cur = ri(rng, 1, top);
    for (let i = 0; i < count; i++) { cur = Math.max(1, Math.min(top, cur + ri(rng, -2, 2))); v.push(cur * b.step); }
    if (new Set(v).size === count) return v;
  }
  return shuffle(rng, Array.from({ length: top }, (_, i) => (i + 1) * b.step)).slice(0, count);
}

export const y5LineGraph: Generator = (d: Difficulty, rng: Rng): Question => {
  const b = pick(rng, BANKS), count = ri(rng, 5, 6), labels = labelsOf(b, count), n = series(rng, b, count);
  const visual: Question['visual'] = { type: 'chart', kind: 'line', rows: labels.map((label, k) => ({ label, n: n[k] })), step: b.step, max: b.max };
  const num = (prompt: string, said: string, answer: number, named: number[]) => numQ(rng, `${prompt} (${b.unit})`, answer, {
    min: 0, max: 999, distractors: decoys(answer, named, 3, b.step), visual, say: sayQ(`Look at the graph. ${said} Answer in ${b.say}.`), slow: d === 3,
  });
  const word = (prompt: string, answer: string, others: string[]) =>
    wordQ(rng, prompt, answer, others, { visual, say: sayQ(`Look at the graph. ${prompt}`), slow: true });
  const [i, j] = shuffle(rng, labels.map((_, k) => k));
  const [lo, hi] = n[i] < n[j] ? [i, j] : [j, i];
  const askPeak = rng() < 0.5, ext = askPeak ? n.indexOf(Math.max(...n)) : n.indexOf(Math.min(...n));
  if (d === 1) {
    const nb = n[i + 1] ?? n[i - 1];
    return num(b.read(labels[i]), `${b.read(spoken(labels[i]))}`, n[i], [nb, n[i] / b.step, n[i] + b.step, n[i] - b.step]);
  }
  if (d === 2 && rng() < 0.5) {
    return num(b.diff(labels[hi], labels[lo]), b.diff(spoken(labels[hi]), spoken(labels[lo])), n[hi] - n[lo],
      [n[hi] + n[lo], n[hi], (n[hi] - n[lo]) / b.step, n[hi] - n[lo] + b.step]);
  }
  if (d === 2 || (d === 3 && rng() < 0.4)) {
    const others = [labels[ext + 1] ?? labels[ext - 1], labels[0], labels[count - 1], ...labels].filter(l => l !== labels[ext]);
    return word(askPeak ? b.peak : b.low, labels[ext], others);
  }
  if (b.days && rng() < 0.6) {
    const s = ri(rng, 0, count - 3), sum = n[s] + n[s + 1] + n[s + 2];
    return num(`Total ${b.noun}, ${labels[s]} to ${labels[s + 2]}?`.replace('?', ''), `What is the total ${b.noun} from ${labels[s]} to ${labels[s + 2]}?`, sum,
      [n[s] + n[s + 2], n[s + 1] * 3, sum - b.step, sum + b.step]);
  }
  const answer = Math.max(...n) - Math.min(...n);
  return num(`Highest take lowest ${b.noun}?`.replace('?', ''), `What is the difference between the highest and lowest ${b.noun}?`, answer,
    [Math.max(...n) + Math.min(...n), Math.max(...n), answer / b.step, answer + b.step]);
};
