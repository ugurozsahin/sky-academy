// Times-table fact record (#1122): pure, no DOM and no storage import. What the game remembers about each
// × fact a child answers — right, wrong, slow — for the readers that follow (#1123, #1124, #1176).
import type { Question } from './curriculum/types';
import type { Ks2Check, Ks2Fact } from './save-records';

/** `outcome` is the play screen's `Outcome` (`src/ui/hud.ts`), typed as a string: `src/` may not reach into `src/ui/` from here (#557). */
export interface FactEntry { fact: string; outcome: string; ms?: number }

/** STA MTC framework §5.1: six seconds to answer. A right answer slower than this is "slow". */
export const SLOW_MS = 6000;
const MAX_CHECKS = 10, MAX_MISSED = 25;

export function createFactLog() {
  const log: FactEntry[] = [];
  return {
    /** Cards with no `fact` are ignored. `ms` is only measured in a timed `mtc` run; elsewhere it is undefined. */
    note(q: Question, outcome: string, ms?: number) { if (q.fact) log.push({ fact: q.fact, outcome, ms }); },
    entries: (): readonly FactEntry[] => log,
  };
}

/** The new `ks2.facts`: counts, the last three outcomes (`r` right, `s` right but slow, `w` wrong or missed; newest last) and the day. */
export function mergeFacts(tally: Record<string, Ks2Fact>, entries: readonly FactEntry[], day: string): Record<string, Ks2Fact> {
  const out: Record<string, Ks2Fact> = { ...tally };
  for (const e of entries) {
    const f = { ...(out[e.fact] ?? { right: 0, wrong: 0, slow: 0 }) };
    const letter = e.outcome !== 'correct' ? 'w' : e.ms !== undefined && e.ms > SLOW_MS ? 's' : 'r';
    if (letter === 'w') f.wrong++; else if (letter === 's') f.slow++; else f.right++;
    f.last = ((f.last ?? '') + letter).slice(-3); f.day = day;
    out[e.fact] = f;
  }
  return out;
}

/** The newest 10 Tables Check results, newest first. */
export function pushCheck(checks: readonly Ks2Check[], entry: Ks2Check): Ks2Check[] {
  return [{ ...entry, missed: entry.missed.slice(0, MAX_MISSED) }, ...checks].slice(0, MAX_CHECKS);
}

/** Secure (#1176): the last three tries were all right and none was slow. Fewer than three tries is not yet secure. */
export const isSecure = (f: Ks2Fact): boolean => f.last === 'rrr';

/**
 * The child's least secure × facts (#1123), as lines of one or two fact keys: a fact shares its line with its reversed
 * pair when that is listed too (`9×6`, `6×9`); a square fact stands alone. Facts with no tries or that are secure are
 * left out; the rest rank by (wrong + slow) ÷ tries, highest first, then the most recent day, then the fact text.
 */
export function leastSecure(facts: Record<string, Ks2Fact>, n = 8): string[][] {
  const tries = (f: Ks2Fact) => f.right + f.wrong + f.slow;
  const ranked = Object.keys(facts).filter(k => tries(facts[k]) > 0 && !isSecure(facts[k]))
    .sort((a, b) => {
      const fa = facts[a], fb = facts[b];
      return ((fb.wrong + fb.slow) / tries(fb)) - ((fa.wrong + fa.slow) / tries(fa))
        || (fb.day ?? '').localeCompare(fa.day ?? '') || (a < b ? -1 : a > b ? 1 : 0);
    });
  const listed = new Set(ranked), used = new Set<string>(), lines: string[][] = [];
  for (const k of ranked) {
    if (used.has(k)) continue;
    const [a, b] = k.split('×'), rev = `${b}×${a}`;
    const line = rev !== k && listed.has(rev) && !used.has(rev) ? [k, rev] : [k];
    line.forEach(x => used.add(x)); lines.push(line);
    if (lines.length === n) break;
  }
  return lines;
}
