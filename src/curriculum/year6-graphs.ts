// y6-graphs (#1250): line graphs and conversion graphs (NC 6M48). The conversion graph is miles against km at 5 miles = 8 km, drawn with the
// `line` chart: its x labels are km 0, 8, 16 … 40 and its values miles 0, 5 … 25, so every point is on a tick and a gridline. d1 reads km to miles,
// d2 reads miles to km or the distance a cyclist went in one hour on a time graph, d3 uses the graph to solve a problem or to scale past it.
// Every answer is worked out from the plotted data; no prompt or `say` states a plotted value (a km label the question asks about is the given, not a reading).
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ, numberWord } from './util';

export const KM = [0, 8, 16, 24, 32, 40];
const MILES_PER_8KM = 5;
/** Miles for a km value on the graph's line: the ratio 5 miles = 8 km. */
export const miles = (km: number): number => km * MILES_PER_8KM / 8;
export const km = (mi: number): number => mi * 8 / MILES_PER_8KM;

type Line = Extract<NonNullable<Question['visual']>, { type: 'chart'; kind: 'line' }>;
const convGraph = (): Line => ({ type: 'chart', kind: 'line', rows: KM.map(k => ({ label: String(k), n: miles(k) })), step: 5, max: 25 });

/** Four options: the named slips first; for an answer of 20 or more a decoy sharing its last digit and one sharing its leading digit (#1058). */
function numCard(rng: Rng, prompt: string, answer: number, named: number[], extra: Partial<Question>): Question {
  const lead = (v: number) => String(v)[0], ok = (v: number) => Number.isInteger(v) && v >= 1 && v !== answer;
  const ds = [...new Set(named.filter(ok))].slice(0, 3);
  if (answer >= 20) {
    const tens = [answer + 10, answer - 10].filter(ok);
    if (!ds.some(v => v % 10 === answer % 10) && tens.length) ds.splice(Math.min(ds.length, 2), 1, pick(rng, tens));
    if (!ds.some(v => lead(v) === lead(answer))) {
      const near = [1, -1, 2, -2, 3, -3, 4, -4].map(s => answer + s).find(v => ok(v) && lead(v) === lead(answer) && !ds.includes(v) && v % 10 !== answer % 10);
      if (near !== undefined) ds.splice(Math.min(ds.length, 1), 1, near);
    }
  }
  for (let s = 1; ds.length < 3; s++) for (const v of [answer + s, answer - s]) if (ok(v) && !ds.includes(v) && ds.length < 3) ds.push(v);
  return wordQ(rng, prompt, String(answer), ds.slice(0, 3).map(String), { hint: 'Find the number on one axis, then go across to the line', hintIsData: false, ...extra });
}

/** d1: km to miles, read across from the km label to the line. The slips copy the given number, subtract 3, or are one gridline out. */
function kmToMiles(rng: Rng): Question {
  const k = pick(rng, KM.slice(1)), a = miles(k);
  return numCard(rng, `Use the graph. ${k} km ≈ ? miles`, a, [k, k - 3, a + 5, a - 5], {
    visual: convGraph(), say: `Use the graph. About how many miles is ${k} kilometres?` });
}

/** d2: miles to km, read backwards from the value to the x label. The slips copy the given number, add 8, or are one label out. */
function milesToKm(rng: Rng): Question {
  const m = pick(rng, [5, 10, 15, 20, 25]), a = km(m);
  return numCard(rng, `Use the graph. ${m} miles ≈ ? km`, a, [m, m + 8, a + 8, a - 8], {
    visual: convGraph(), say: `Use the graph. About how many kilometres is ${m} miles?` });
}

const hh = (i: number) => `${String(8 + i).padStart(2, '0')}:00`;
const oclock = (i: number) => `${numberWord(8 + i)} o'clock`;
/** d2: a cyclist's distance so far, hourly; how far in one hour. Every reading is a multiple of 5 km. */
function cyclist(rng: Rng): Question {
  const count = ri(rng, 5, 6), picked = shuffle(rng, Array.from({ length: 8 }, (_, i) => (i + 1) * 5)).slice(0, count - 1).sort((a, b) => a - b), n = [0, ...picked];
  const s = ri(rng, 0, count - 2), a = n[s + 1] - n[s], visual: Line = { type: 'chart', kind: 'line', rows: n.map((v, i) => ({ label: hh(i), n: v })), step: 5, max: 40 };
  const from = hh(s), to = hh(s + 1);
  return numCard(rng, `Cyclist: how far from ${from} to ${to}? (km)`, a, [n[s + 1], n[s] + n[s + 1], a + 5, Math.max(5, a - 5)], {
    visual, say: `The graph shows how far a cyclist has gone. How far did the cyclist go from ${oclock(s)} to ${oclock(s + 1)}, in kilometres?`, hint: 'Take the first reading from the second', });
}

/** d3: two people, one measured in miles and one in km; how many km further is the one who is further. The slips forget to convert. */
function furtherCard(rng: Rng): Question {
  for (;;) {
    const m = pick(rng, [10, 15, 20, 25]), k = pick(rng, [10, 20, 30, 35, 40, 45]), c = km(m);
    const who = k > c ? 'Ben' : 'Ali', diff = Math.abs(k - c);
    if (c === k || diff === m || diff === k) continue;   // the answer is never also a number the card states
    return numCard(rng, `Ali: ${m} miles. Ben: ${k} km. How many km further is ${who}?`, diff, [Math.abs(k - m), k, c, diff + 8], {
      visual: convGraph(), say: `Ali walked ${m} miles and Ben walked ${k} kilometres. Use the graph. How many kilometres further did ${who} walk?`,
      hint: 'Change Ali\'s miles into km first' });
  }
}

/** d3: past the end of the graph: the line keeps its shape, so 5 miles is always 8 km. */
function beyondCard(rng: Rng): Question {
  const m = 5 * ri(rng, 6, 20), a = km(m);
  return numCard(rng, `Use the graph. ${m} miles ≈ ? km`, a, [m, a + 8, a - 8, m + 8], {
    visual: convGraph(), say: `Use the graph. About how many kilometres is ${m} miles?`, hint: 'The line carries on: every 5 miles is 8 km' });
}

export const y6Graphs: Generator = (d: Difficulty, rng: Rng): Question =>
  d === 1 ? kmToMiles(rng) : d === 2 ? (rng() < 0.7 ? milesToKm(rng) : cyclist(rng)) : rng() < 0.5 ? furtherCard(rng) : beyondCard(rng);
