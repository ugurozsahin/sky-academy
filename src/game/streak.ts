// The kinder streak rule (#950): one missed day in any seven is held, not punished. Pure; days are local ISO keys.
export interface StreakState { last: string; days: number; rest?: string }

const MS_DAY = 86_400_000;
/** Whole days from `a` to `b` (both `YYYY-MM-DD`). */
export const dayGap = (a: string, b: string): number => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / MS_DAY);
const dayBefore = (date: string): string => new Date(Date.parse(date + 'T12:00:00Z') - MS_DAY).toISOString().slice(0, 10);

/** The save streak after a play on `today`. A rest day adds nothing to `days` and is recorded in `rest`. */
export function nextStreak(prev: StreakState, today: string): StreakState {
  if (prev.last === today) return prev;
  const gap = prev.last ? dayGap(prev.last, today) : 0;
  if (gap === 1) return { ...prev, last: today, days: prev.days + 1 };
  const missed = dayBefore(today);
  if (gap === 2 && (!prev.rest || dayGap(prev.rest, missed) >= 7)) return { last: today, days: prev.days + 1, rest: missed };
  return { ...prev, last: today, days: 1 };
}

/** Whole days missed between a streak's last day and `date` (0 when it ended yesterday, today or never). */
export const missedDays = (last: string, date: string): number => (last ? Math.max(0, dayGap(last, date) - 1) : 0);
