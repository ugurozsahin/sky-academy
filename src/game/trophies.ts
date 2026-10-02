// Topic trophies (#912): a bronze, silver or gold trophy per topic, derived from its Sprint best (#911) against
// the year's `sprintStars` — the same thresholds `MODES.sprint.stars` grades a Sprint on, so a trophy and the
// Sprint medal for the same number of correct answers always agree. Pure and in src/game/ so `parents.ts`
// (#913) can call it without `src/game/` ever importing `src/ui/` (the #557 rail). Nothing stores a trophy.
import type { YearInfo } from '../curriculum';

export type Trophy = '🥇' | '🥈' | '🥉';

/** The trophy a topic's Sprint best (correct answers) earns in `year`, or null below one correct answer. */
export function trophyFor(best: number, year: YearInfo): Trophy | null {
  const { threeStar, twoStar } = year.sprintStars;
  return best >= threeStar ? '🥇' : best >= twoStar ? '🥈' : best >= 1 ? '🥉' : null;
}

/** The metal as a word — a speech engine reads 🥈 aloud as "second place medal". */
export const TROPHY_WORD: Record<Trophy, string> = { '🥇': 'gold', '🥈': 'silver', '🥉': 'bronze' };

const RANK: Record<Trophy, number> = { '🥉': 1, '🥈': 2, '🥇': 3 };

/** True when a Sprint best moving from `before` to `after` correct answers raises the topic's tier. */
export const raisesTrophy = (before: number, after: number, year: YearInfo): boolean => {
  const a = trophyFor(after, year);
  return a !== null && RANK[a] > (trophyFor(before, year) ? RANK[trophyFor(before, year)!] : 0);
};
