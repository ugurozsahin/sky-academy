// Multiplication Tables Check form builder (#1116): 25 questions drawn under the STA's published rules
// (MTC assessment framework §5.1–5.2). Pure: no DOM, no `src/ui` import.
import type { Question, Rng } from '../curriculum/types';
import { topicById } from '../curriculum';
import { productDecoys } from '../curriculum/year4-tables';
import { q, shuffle } from '../curriculum/util';
import type { DeckItem } from './session';

export type MtcItem = { a: number; b: number };

export const MTC_TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
/** Table 1: min/max items per form for each multiplication table (the first factor, footnote 5). */
export const MTC_LIMITS: Record<number, { min: number; max: number }> = {
  2: { min: 0, max: 2 }, 3: { min: 1, max: 3 }, 4: { min: 1, max: 3 }, 5: { min: 1, max: 3 },
  6: { min: 2, max: 4 }, 7: { min: 2, max: 4 }, 8: { min: 2, max: 4 }, 9: { min: 2, max: 4 },
  10: { min: 0, max: 2 }, 11: { min: 1, max: 3 }, 12: { min: 2, max: 4 },
};
/** Table 2: the Key Stage 1 tables (2, 5, 10) number 3–7 items a form; the rest of the 25 are KS2. */
export const KS1_TABLES = [2, 5, 10] as const;
export const KS1_LIMIT = { min: 3, max: 7 };
export const MTC_SIZE = 25;
const MAX_ATTEMPTS = 100;

const pick = <T>(xs: T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)];

/** Per-table counts for the first factor: Table 1 limits, sum 25, KS1 total 3–7. */
function drawCounts(rng: Rng): Record<number, number> {
  for (;;) {
    const n: Record<number, number> = {};
    let left = MTC_SIZE;
    for (const t of MTC_TABLES) { n[t] = MTC_LIMITS[t].min; left -= n[t]; }
    while (left-- > 0) n[pick(MTC_TABLES.filter(t => n[t] < MTC_LIMITS[t].max), rng)]++;
    const ks1 = KS1_TABLES.reduce((s, t) => s + n[t], 0);
    if (ks1 >= KS1_LIMIT.min && ks1 <= KS1_LIMIT.max) return n;
  }
}

/** The second factor's count for a table may stray ±1 beyond Table 1's limits (footnote 5). */
const bLow = (t: number) => Math.max(0, MTC_LIMITS[t].min - 1);
const bHigh = (t: number) => MTC_LIMITS[t].max + 1;

function attempt(rng: Rng): MtcItem[] | null {
  const counts = drawCounts(rng);
  const as: number[] = [];
  for (const t of MTC_TABLES) for (let i = 0; i < counts[t]; i++) as.push(t);
  const bCount: Record<number, number> = {};
  for (const t of MTC_TABLES) bCount[t] = 0;
  const used = new Set<string>();
  const items: MtcItem[] = [];
  for (const a of as) {
    const ok = MTC_TABLES.filter(b => bCount[b] < bHigh(b) && !used.has(`${a}x${b}`) && !used.has(`${b}x${a}`));
    if (!ok.length) return null;
    const b = pick(ok, rng);
    bCount[b]++; used.add(`${a}x${b}`); items.push({ a, b });
  }
  if (MTC_TABLES.some(b => bCount[b] < bLow(b))) return null;
  return items;
}

/** 25 distinct, non-reversed `a × b` items (both 2–12) in a random order, or throws after 100 dead ends. */
export function mtcForm(rng: Rng): readonly MtcItem[] {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const items = attempt(rng);
    if (!items) continue;
    for (let j = items.length - 1; j > 0; j--) { const k = Math.floor(rng() * (j + 1)); [items[j], items[k]] = [items[k], items[j]]; }
    return items;
  }
  throw new Error(`mtcForm: no valid form in ${MAX_ATTEMPTS} attempts (next rng draw ${rng()})`);
}

/** The three practice questions of the real check: `1 × n`, n in 2–12, all different. */
export function mtcPractice(rng: Rng): readonly MtcItem[] {
  const ns: number[] = [...MTC_TABLES];
  return [0, 1, 2].map(() => ({ a: 1, b: ns.splice(Math.floor(rng() * ns.length), 1)[0] }));
}

/** The practice cards come first and are never scored (#1118). */
export const MTC_PRACTICE = 3;

const practiceCard = (b: number, rng: Rng): Question => {
  const pool = [b - 2, b - 1, b + 1, b + 2].filter(v => v >= 1);
  const options = [b, ...shuffle(rng, pool).slice(0, 3)].map(String);
  return { ...q(`1 × ${b} = ?`), answer: String(b), options: shuffle(rng, options) };
};
const checkCard = (a: number, b: number, rng: Rng): Question => {
  const options = [a * b, ...productDecoys(a, b, rng)].map(String);
  return { ...q(`${a} × ${b} = ?`), answer: String(a * b), options: shuffle(rng, options) };
};

/** One Tables Check practice run: 3 untimed practice cards, then the 25 of `mtcForm` — `a × b = ?`, four bubbles each. */
export function mtcDeck(rng: Rng): DeckItem[] {
  const topic = topicById('y4-tables')!;
  const practice = mtcPractice(rng), form = mtcForm(rng);   // the same two draws, in this order, as a test replays
  return [...practice.map(i => practiceCard(i.b, rng)), ...form.map(i => checkCard(i.a, i.b, rng))].map(q => ({ topic, q }));
}

/** The result: check cards missed (practice ignored), as the facts, in deck order. */
export function mtcScore(deck: readonly DeckItem[], misses: readonly { q: Question }[]): { score: number; missed: { prompt: string; answer: string }[] } {
  const gone = new Set(misses.map(m => m.q.prompt));
  const missed = deck.slice(MTC_PRACTICE).filter(d => gone.has(d.q.prompt)).map(d => ({ prompt: d.q.prompt.replace(' = ?', ''), answer: d.q.answer }));
  return { score: MTC_SIZE - missed.length, missed };
}

/** Ms after the wave starts before the 6 s clock is armed: `null` for the practice cards (no clock), else the last bubble's launch. */
export const mtcArmDelay = (index: number, lastLaunchMs: number): number | null => index < MTC_PRACTICE ? null : lastLaunchMs;
