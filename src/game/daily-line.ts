// The Daily Sprint's one-line result (#925): what a grown-up may copy from the grown-ups dashboard. It carries no name,
// avatar or profile id, and it is kept in memory only (the save's field list is closed, #903), so closing the app loses it.
import type { ProfileId } from '../storage';

const STAR = '⭐';

/** `Sky Ninja Academy · Daily Sprint · Year 1 · 2026-09-28 · 14 correct · ⭐⭐` (the stars only when 1–3 were earned). */
export const dailyLine = (r: { correct: number; stars: number }, yearTitle: string, date: string): string =>
  `Sky Ninja Academy · Daily Sprint · ${yearTitle} · ${date} · ${r.correct} correct${r.stars > 0 ? ` · ${STAR.repeat(Math.min(3, r.stars))}` : ''}`;

let kept: { profile: ProfileId; date: string; line: string } | null = null;

/** Keep the line of the Daily Sprint just finished, for this profile and day; a later one replaces it. */
export const keepDailyLine = (profile: ProfileId, date: string, line: string) => { kept = { profile, date, line }; };

/** Today's line for this profile, or null (none played, another day, another profile). */
export const dailyLineFor = (profile: ProfileId, date: string): string | null =>
  kept && kept.profile === profile && kept.date === date ? kept.line : null;
