// The grown-ups "Check readiness" numbers (#1286): pure, no DOM. It reports what was practised and where the
// gaps are; it never predicts a score, so no function here returns a grade or a verdict.
import { STRANDS, type Strand } from '../curriculum/strands';
import { YEARS, type Topic } from '../curriculum';
import type { Ks2Check, Ks2Fact } from '../save-records';
import type { TopicProgress } from '../storage';
import { RANK_MIN_TRIES } from './parents';

const TREND = 5, WEAKEST = 3, MIN_ANSWERS = 5;

export interface TablesBlock { scores: number[]; weakTables: number[] }
export interface StrandStat { strand: Strand; pct: number }

/** The last up to five Tables Check practice scores, oldest first (`checks` is newest first), and the three tables (2–12) with the lowest share of right-and-not-slow answers. */
export function tablesBlock(checks: readonly Ks2Check[], facts: Record<string, Ks2Fact>): TablesBlock {
  const tally = new Map<number, { good: number; all: number }>();
  for (const [k, f] of Object.entries(facts)) {
    const [a, b] = k.split('×').map(Number);
    for (const t of new Set([a, b])) {
      if (!(t >= 2 && t <= 12)) continue;
      const c = tally.get(t) ?? { good: 0, all: 0 };
      c.good += f.right; c.all += f.right + f.wrong + f.slow; tally.set(t, c);
    }
  }
  const weakTables = [...tally].filter(([, c]) => c.all >= MIN_ANSWERS)
    .sort((x, y) => (x[1].good / x[1].all) - (y[1].good / y[1].all) || x[0] - y[0])
    .slice(0, WEAKEST).map(([t]) => t);
  return { scores: checks.slice(0, TREND).map(c => c.score).reverse(), weakTables };
}

/** The three weakest strands across the topics of the years after Year 4, by right answers over tries; a strand needs `RANK_MIN_TRIES` tries to be ranked. */
export function sats56Block(progress: Record<string, TopicProgress>, topics: readonly Topic[]): StrandStat[] {
  const from = YEARS.findIndex(y => y.id === 'year4') + 1, later = new Set(YEARS.slice(from).map(y => y.id));
  const sums = new Map<Strand, { hits: number; tries: number }>();
  for (const t of topics) {
    const p = progress[t.id];
    if (!t.strand || !later.has(t.year) || !p) continue;
    const s = sums.get(t.strand) ?? { hits: 0, tries: 0 };
    s.hits += p.hits ?? 0; s.tries += p.tries ?? 0; sums.set(t.strand, s);
  }
  const order = Object.keys(STRANDS);
  return [...sums].filter(([, s]) => s.tries >= RANK_MIN_TRIES)
    .sort((x, y) => (x[1].hits / x[1].tries) - (y[1].hits / y[1].tries) || order.indexOf(x[0]) - order.indexOf(y[0]))
    .slice(0, WEAKEST).map(([strand, s]) => ({ strand, pct: Math.round(100 * s.hits / s.tries) }));
}

/** Whole weeks from `day` (today) to `date` (both `YYYY-MM-DD`), rounded up; null once the date has passed or when either is not a date. */
export function weeksTo(date: string | undefined, day: string): number | null {
  const ms = (s: string) => {
    const t = /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(`${s}T12:00:00Z`) : NaN;   // NaN for 2026-13-45
    return Number.isNaN(t) || !new Date(t).toISOString().startsWith(s) ? NaN : t;       // and for 2026-02-31, which rolls forward
  };
  const d = (ms(date ?? '') - ms(day)) / 86_400_000;
  return Number.isFinite(d) && d >= 0 ? Math.ceil(d / 7) : null;
}
