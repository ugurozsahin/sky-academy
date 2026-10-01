// Year 3 calculation strand (#1050). No topic lands here yet — each slot below is a future PR's own ticket.
// import: y3-column
// import: y3-check
// import: y3-missing
// import: y3-story-as
// import: y3-tables
// import: y3-tables-3
// import: y3-tables-4
// import: y3-tables-8
// import: y3-multiply
// import: y3-story
import { y3Mental } from './year3-mental';
import { y3Column } from './year3-column';
import { y3Check } from './year3-check';
import type { Difficulty, Generator, Question, Topic } from './types';
import { ri, pick, shuffle, numQ, q } from './util';

/** y3-tables (#1087): the 3, 4 and 8 times tables, × and ÷. `table` fixes the table (the 3×/4×/8× drills, #1125). */
export function y3TablesQ(d: Difficulty, rng: () => number, table?: 3 | 4 | 8): Question {
  const t = table ?? pick(rng, d === 1 ? [4, 8] : [3, 4, 8]);
  const n = ri(rng, d === 1 ? 2 : 1, 12), p = n * t;
  const half = t / 2, known = half * n; // d1: 4× and 8× are built by doubling the 2× / 4× fact
  const ask = (prompt: string, ans: number, slips: number[], extra: Pick<Question, 'visual' | 'say'> = {}): Question => {
    // #1058: one place slip (±10, shares the units digit), then the neighbouring facts, those sharing the leading digit first
    const max = ans > 12 ? 144 : 15, lead = (v: number) => String(v)[0];
    const slip = [ans + 10, ans - 10].filter(v => v >= 0 && v <= max), near = shuffle(rng, slips).filter(v => v >= 0 && v <= max);
    const cands = [...slip.slice(0, 1), ...near.filter(v => lead(v) === lead(ans)), ...near, ...slip.slice(1)];
    return numQ(rng, prompt, ans, { min: 0, max, distractors: cands, ...q(prompt), ...extra });
  };
  const prod = [(n - 1) * t, (n + 1) * t, n * (t - 1), n * (t + 1)];
  if (d === 1) {
    if (t === 3) return ask(`${n} × 3 = ?`, p, prod);
    const prompt = `${t} × ${n} = ?`, fact = `${half} × ${n} = ${known}`;
    return ask(prompt, p, [...prod, known], { visual: { type: 'word', text: fact }, say: `${half} times ${n} is ${known}. So ${q(prompt).say}` });
  }
  const kind = d === 2 ? ri(rng, 0, 2) : ri(rng, 3, 5);
  const fac = [n - 1, n + 1, t].filter(v => v > 0);
  if (kind === 0) return ask(`${n} × ${t} = ?`, p, prod);
  if (kind === 1) return ask(`${t} × ${n} = ?`, p, prod);
  if (kind === 2) return ask(`${p} ÷ ${t} = ?`, n, fac);
  return ask(kind === 3 ? `? × ${t} = ${p}` : kind === 4 ? `${t} × ? = ${p}` : `${p} ÷ ? = ${t}`, n, fac);
}
export const y3Tables: Generator = (d, rng) => y3TablesQ(d, rng);

export const Y3_CALC: Topic[] = [
  { id: 'y3-mental', title: 'Mental Adding and Subtracting', icon: '➕', subject: 'maths', year: 'year3', nc: 'Y3 A&S: 3-digit number and 1s, 10s, 100s mentally (3M7)', gen: y3Mental },
  { id: 'y3-column', title: 'Column Adding and Subtracting', icon: '✏️', subject: 'maths', year: 'year3', nc: 'Y3 A&S: columnar addition and subtraction to 3 digits (3M8)', sequenceFrom: 1, gen: y3Column },
  { id: 'y3-check', title: 'Estimate and Check', icon: '✅', subject: 'maths', year: 'year3', nc: 'Y3 A&S: estimate, and check with inverse operations (3M9)', gen: y3Check },
  // slot: y3-missing
  // slot: y3-story-as
  { id: 'y3-tables', title: '3, 4 and 8 Times Tables', icon: '✖️', subject: 'maths', year: 'year3', nc: 'Y3 M&D: 3, 4 and 8 tables, × and ÷ (3M11)', gen: y3Tables },
  // slot: y3-tables-3
  // slot: y3-tables-4
  // slot: y3-tables-8
  // slot: y3-multiply
  // slot: y3-story
];
