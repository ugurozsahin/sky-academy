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
import { y3Missing } from './year3-missing';
import { y3StoryAs } from './year3-story-as';
import type { Difficulty, Generator, Question, Topic } from './types';
import { ri, pick, shuffle, numQ, wordQ, nearby, q, UNIT_WORD, numberWord } from './util';
import { buildQ } from './build';

/** y3-tables (#1087): the 3, 4 and 8 times tables, × and ÷. `table` fixes the table (the 3×/4×/8× drills, #1125). */
export function y3TablesQ(d: Difficulty, rng: () => number, table?: 3 | 4 | 8): Question {
  const t = table ?? pick(rng, d === 1 ? [4, 8] : [3, 4, 8]);
  const n = ri(rng, d === 1 ? 2 : 1, 12), p = n * t;
  const half = t / 2, known = half * n; // d1: 4× and 8× are built by doubling the 2× / 4× fact
  const ask = (prompt: string, ans: number, slips: number[], max: number, extra: Pick<Question, 'visual' | 'say' | 'fact'> = {}): Question => {
    // #1058: one place slip (±10, shares the units digit), then the neighbouring facts, those sharing the leading digit first
    const lead = (v: number) => String(v)[0];
    const slip = [ans + 10, ans - 10].filter(v => v >= 0 && v <= max), near = shuffle(rng, slips).filter(v => v >= 0 && v <= max);
    const cands = [...slip.slice(0, 1), ...near.filter(v => lead(v) === lead(ans)), ...near, ...slip.slice(1)];
    return numQ(rng, prompt, ans, { min: 0, max, distractors: cands, ...q(prompt), ...extra });
  };
  const fact = (a: number, b: number): Pick<Question, 'fact'> => a >= 2 && b >= 2 ? { fact: `${a}×${b}` } : {};   // #1122
  const prod = [(n - 1) * t, (n + 1) * t, n * (t - 1), n * (t + 1)];
  if (d === 1) {
    if (t === 3) return ask(`${n} × 3 = ?`, p, prod, 144, fact(n, 3));
    const prompt = `${t} × ${n} = ?`, shown = `${half} × ${n} = ${known}`;
    return ask(prompt, p, [...prod, known], 144, { ...fact(t, n), visual: { type: 'word', text: shown }, say: `${half} times ${n} is ${known}. So ${q(prompt).say}` });
  }
  const kind = d === 2 ? ri(rng, 0, 2) : ri(rng, 3, 5);
  const fac = [n - 1, n + 1, t].filter(v => v > 0);
  if (kind === 0) return ask(`${n} × ${t} = ?`, p, prod, 144, fact(n, t));
  if (kind === 1) return ask(`${t} × ${n} = ?`, p, prod, 144, fact(t, n));
  if (kind === 2) return ask(`${p} ÷ ${t} = ?`, n, fac, 12);
  const missing = kind === 3 ? fact(n, t) : kind === 4 ? fact(t, n) : {};
  return ask(kind === 3 ? `? × ${t} = ${p}` : kind === 4 ? `${t} × ? = ${p}` : `${p} ÷ ? = ${t}`, n, fac, 12, missing);
}
export const y3Tables: Generator = (d, rng) => y3TablesQ(d, rng);

/** y3-multiply (#1088): d1 related facts (30 × 4 from 3 × 4), d2 2-digit × 1-digit, d3 builds the same product digit by digit. */
export const y3Multiply: Generator = (d, rng) => {
  const m = pick(rng, [2, 3, 4, 5, 8]);
  if (d === 1) {
    const tens = ri(rng, 1, 9), f = tens * m, div = rng() < 0.4;
    const prompt = div ? `${f * 10} ÷ ${m} = ?` : `${tens * 10} × ${m} = ?`, ans = div ? tens * 10 : f * 10;
    const fact = div ? `${f} ÷ ${m} = ${tens}` : `${tens} × ${m} = ${f}`;
    const slips = [div ? tens : f, div ? tens * 100 : f * 100, ans + 10, ans - 10, (tens + 1) * (div ? 10 : m * 10), (tens - 1) * (div ? 10 : m * 10)];
    const say = `${q(fact).say}. So ${q(prompt).say}`;
    const card = numQ(rng, prompt, ans, { min: 1, max: 100000, distractors: shuffle(rng, slips), visual: { type: 'word', text: fact }, say });
    return { ...card, options: card.options.map(o => Number(o).toLocaleString('en-GB')) }; // #1047: 1,200 not 1200
  }
  const a = ri(rng, 11, 49), p = a * m, prompt = `${a} × ${m} = ?`;
  if (d === 3) return buildQ(rng, { prompt, say: `${q(prompt).say} Build the answer.`, answer: String(p), total: 6, hint: 'Slice the digits in order' });
  // #1058: a place slip (±10) shares the units digit; then ones not multiplied, a dropped carry, the neighbouring multipliers
  const slips = [p + (rng() < 0.5 ? 10 : -10), Math.floor(a / 10) * m * 10 + a % 10, Math.floor(a / 10) * m * 10 + a % 10 * m % 10, a * (m - 1), a * (m + 1)];
  return numQ(rng, prompt, p, { min: 1, max: 500, distractors: slips, ...q(prompt) });
};

/** y3-story (#1089): the hand-written bank. scale [unit, one, times, ask] · pairs [x, y, z] · share [thing, who, ask]. */
export const Y3_STORY = {
  scale: [['cm', 'A plant is # tall.', 'A tree is # times as tall.', 'How tall is it?'], ['cm', 'A ribbon is # long.', 'A rope is # times as long.', 'How long is it?'],
    ['m', 'A shed is # high.', 'A tower is # times as high.', 'How high is it?'], ['g', 'A pear weighs #.', 'A melon is # times as heavy.', 'How heavy is it?'],
    ['', 'Mia has # stickers.', 'Sam has # times as many.', 'How many has Sam?']] as [string, string, string, string][],
  pairs: [['hats', 'coats', 'outfits'], ['tops', 'skirts', 'outfits'], ['buns', 'fillings', 'sandwiches']] as [string, string, string][],
  share: [['sweets', 'children', 'How many each?'], ['apples', 'boxes', 'How many in each?'], ['pencils', 'pots', 'How many in each?']] as [string, string, string][],
};

/** y3-story (#1089): d1 scaling ×2–×10, d2 correspondence and sharing, d3 ×8 and the inverse "how many coats?". The adding slip is always a decoy (#1058). */
export const y3Story: Generator = (d, rng) => {
  const kind = pick(rng, d === 1 ? ['scale'] : d === 2 ? ['pairs', 'share'] : ['scale', 'pairs']);
  const w = (n: number, spoken: boolean) => spoken ? numberWord(n) : `${n}`; // the spoken form says the numbers in words
  let unit = '', ans: number, add: number, near: number[], text: (spoken: boolean) => string;
  if (kind === 'scale') {
    const [u, s1, s2, ask] = pick(rng, Y3_STORY.scale), k = d === 3 ? 8 : pick(rng, [2, 3, 4, 5, 10]), a = ri(rng, 2, Math.floor(100 / k));
    unit = u; ans = a * k; add = a + k; near = [ans + k, ans - k, ans + a, ans - a, k];
    text = sp => [s1.replace('#', u ? `${w(a, sp)} ${sp ? UNIT_WORD[u] : u}` : w(a, sp)), s2.replace('#', w(k, sp)), ask].join(' ');
  } else if (kind === 'pairs') {
    const [x, y, z] = pick(rng, Y3_STORY.pairs), n = ri(rng, 2, 6), m = ri(rng, 2, 6);
    ans = d === 3 ? m : n * m; add = d === 3 ? n * m - n : n + m; near = d === 3 ? [m + n, m - n, n, m + 1, m - 1] : [ans + n, ans - n, ans + m, ans - m];
    text = sp => d === 3 ? `${w(n * m, sp)} ${z} from ${w(n, sp)} ${x}. How many ${y}?` : `${w(n, sp)} ${x} and ${w(m, sp)} ${y}. How many ${z}?`;
  } else {
    const [thing, who, ask] = pick(rng, Y3_STORY.share), g = pick(rng, [3, 4, 8]), e = ri(rng, 2, 12);
    ans = e; add = g * e - g; near = [e + g, e - g, g, e + 1, e - 1];
    text = sp => `${w(g * e, sp)} ${thing} shared equally between ${w(g, sp)} ${who}. ${ask}`;
  }
  // #1058: the adding slip first, then one decoy sharing the answer's units digit and one its leading digit, then the rest of `near`
  const ok = (v: number, out: number[]) => v >= 0 && v <= 100 && v !== ans && !out.includes(v), out = ok(add, []) ? [add] : [];
  const need = (same: (v: number) => boolean, cands: number[]) => { const c = out.some(same) ? undefined : cands.find(v => ok(v, out) && same(v)); if (c !== undefined) out.push(c); };
  need(v => v % 10 === ans % 10, [ans + 10, ans - 10, ans + 20, ans - 20]);
  need(v => String(v)[0] === String(ans)[0], [...near, ans + 1, ans - 1, ans + 2, ans - 2, ans / 10]);
  for (const v of [...near, ...nearby(rng, ans, 6, 0, 100)]) if (out.length < 3 && ok(v, out)) out.push(v);
  const label = (v: number) => unit ? `${v} ${unit}` : `${v}`;
  return wordQ(rng, text(false), label(ans), out.slice(0, 3).map(label), { say: text(true) });
};

export const Y3_CALC: Topic[] = [
  { id: 'y3-mental', title: 'Mental Adding and Subtracting', icon: '➕', subject: 'maths', year: 'year3', nc: 'Y3 A&S: 3-digit number and 1s, 10s, 100s mentally (3M7)', gen: y3Mental },
  { id: 'y3-column', title: 'Column Adding and Subtracting', icon: '✏️', subject: 'maths', year: 'year3', nc: 'Y3 A&S: columnar addition and subtraction to 3 digits (3M8)', sequenceFrom: 1, gen: y3Column },
  { id: 'y3-check', title: 'Estimate and Check', icon: '✅', subject: 'maths', year: 'year3', nc: 'Y3 A&S: estimate, and check with inverse operations (3M9)', gen: y3Check },
  { id: 'y3-missing', title: 'Missing Numbers to 1,000', icon: '❓', subject: 'maths', year: 'year3', nc: 'Y3 A&S: missing number problems (3M10)', gen: y3Missing },
  { id: 'y3-story-as', title: 'Adding and Subtracting Problems', icon: '📚', subject: 'maths', year: 'year3', nc: 'Y3 A&S: one- and two-step problems within 1,000 (3M10)', gen: y3StoryAs },
  { id: 'y3-tables', title: '3, 4 and 8 Times Tables', icon: '✖️', subject: 'maths', year: 'year3', nc: 'Y3 M&D: 3, 4 and 8 tables, × and ÷ (3M11)', gen: y3Tables },
  // slot: y3-tables-3
  // slot: y3-tables-4
  // slot: y3-tables-8
  { id: 'y3-multiply', title: '2-Digit × 1-Digit', icon: '✖️', subject: 'maths', year: 'year3', nc: 'Y3 M&D: 2-digit × 1-digit, related facts (3M12)', sequenceFrom: 3, gen: y3Multiply },
  { id: 'y3-story', title: 'Times-as-Many Problems', icon: '📖', subject: 'maths', year: 'year3', nc: 'Y3 M&D: scaling and correspondence problems (3M13)', gen: y3Story },
];
