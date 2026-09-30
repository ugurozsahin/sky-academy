// The sticker album: which stickers a save qualifies for, from coins and from achievements (#114).
import { listedTopics, shownYears } from '../curriculum';
import { AVATARS, VILLAIN } from '../avatars';
import type { SaveData, TopicProgress } from './shape';
/** Sticker album (#114). Order = avatars then the villain. The first three stay a fast, purely-coin win —
 * a four- or five-year-old needs a visible result in the first session or two. The other eight unlock from
 * achievements instead of more coins, because coins are a pure volume metric: a child could replay one easy
 * topic and empty the album without ever touching a second topic, a boss, or a harder year. */
// Derived from the roster (#113), not a hand-maintained parallel list: a roster rename or reorder used to
// need editing this array too, and nothing caught it if you forgot — the villain always resolves as the
// fallback for any id that has drifted out of step, so a forgotten edit here rendered a child's earned
// sticker as Hammer Man under "New sticker!" instead of failing loudly.
export const STICKER_IDS = [...AVATARS.map(a => a.id), VILLAIN.id];
export const STICKER_COST = [30, 70, 120];
export function stickersFor(coins: number): string[] {
  return STICKER_IDS.slice(0, STICKER_COST.length).filter((_, i) => coins >= STICKER_COST[i]);
}
/** A field that should be a plain `Record<string, …>`, tolerant of a hand-edited or corrupted save (#270
 * review): `importSave()` only checks `v`, so a blob like `{ v: 2, boss: null }` reaches here untouched, and
 * `Object.values()` on that throws. Every coin award now runs every achievement check, so a corruption in any
 * one field used to break only the mode that read it and now broke coin-earning app-wide; this reads as empty
 * instead, matching `wallet()`'s existing tolerance for the same class of blob.
 *
 * Exported for #95: `d.progress` is read the same unguarded way outside this file — `home.ts`'s star tally and
 * topic list, `avatar.ts`'s `masterProgress()`, `game/parents.ts`'s `parentSummary()` — and `d.progress[id]`
 * throws the moment `d.progress` itself is not an object, which a hand-edited or corrupted "Restore" paste can
 * produce (`{ v: 1, progress: null }` passes `importSave()`'s version check and is written straight through).
 * `#270` chose *accept the import, make every reader tolerant* over rejecting the blob at the door — this is
 * that same fix reaching the readers #270 did not touch. */
export const safeRecord = <T>(x: unknown): Record<string, T> => (x && typeof x === 'object' && !Array.isArray(x)) ? x as Record<string, T> : {};
const topicsStarred = (d: SaveData) => Object.values(safeRecord<TopicProgress>(d.progress)).filter(p => (p?.stars ?? 0) > 0).length;
const islandsWithAStar = (d: SaveData) => { const p = safeRecord<TopicProgress>(d.progress); return shownYears().filter(y => listedTopics().some(t => t.year === y.id && (p[t.id]?.stars ?? 0) > 0)).length; };
const islandFullyStarred = (d: SaveData) => {
  const p = safeRecord<TopicProgress>(d.progress);
  return shownYears().some(y => { const ts = listedTopics().filter(t => t.year === y.id); return ts.length > 0 && ts.every(t => (p[t.id]?.stars ?? 0) > 0); });
};
const sumOf = (x: unknown) => Object.values(safeRecord<number>(x)).reduce((n: number, v) => n + (typeof v === 'number' ? v : 0), 0);
const totalBossWins = (d: SaveData) => sumOf(d.boss);
const totalMemoryBoards = (d: SaveData) => sumOf(d.memory);
const bestSprintAnyYear = (d: SaveData) => Object.values(safeRecord<number>(d.sprint)).reduce((best: number, v) => Math.max(best, typeof v === 'number' ? v : 0), 0);
export const TOPICS_STARRED_GOAL = 5;
export const SPRINT_STICKER_SCORE = 150;   // roughly a 3-star sprint (12+ correct) once the combo bonus is in
/** One achievement per non-coin sticker. `progress` is pure over the save, for the rewards screen's hint text
 * and progress bar; the sticker is earned once `done >= goal`. */
export interface Achievement { id: string; title: string; progress: (d: SaveData) => { done: number; goal: number } }
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'terra', title: `Star ${TOPICS_STARRED_GOAL} topics`, progress: d => ({ done: Math.min(topicsStarred(d), TOPICS_STARRED_GOAL), goal: TOPICS_STARRED_GOAL }) },
  { id: 'gust', title: 'Star a topic on three islands', progress: d => ({ done: Math.min(islandsWithAStar(d), 3), goal: 3 }) },
  { id: 'frost', title: '3-day streak', progress: d => ({ done: Math.min(d.streak.days, 3), goal: 3 }) },
  { id: 'sol', title: '7-day streak', progress: d => ({ done: Math.min(d.streak.days, 7), goal: 7 }) },
  { id: 'shadow', title: 'Beat Hammer Man once', progress: d => ({ done: Math.min(totalBossWins(d), 1), goal: 1 }) },
  { id: 'kai', title: 'Finish a Memory Match board', progress: d => ({ done: Math.min(totalMemoryBoards(d), 1), goal: 1 }) },
  { id: 'bolt', title: `Score ${SPRINT_STICKER_SCORE}+ in Ninja Sprint`, progress: d => ({ done: Math.min(bestSprintAnyYear(d), SPRINT_STICKER_SCORE), goal: SPRINT_STICKER_SCORE }) },
  { id: 'hammer', title: 'Star every topic on one island', progress: d => ({ done: islandFullyStarred(d) ? 1 : 0, goal: 1 }) },
];
/** Every sticker the save currently qualifies for, coins and achievements together. A sticker already in
 * `d.stickers` is never dropped even when the stat behind it later falls (a streak resets to zero) — this
 * only ever adds ids on top of what is already recorded, which is what "nothing is ever taken away" means
 * for a save that earned stickers under an earlier version of this rule (#114). */
export function evaluateStickers(d: SaveData): string[] {
  const earned = new Set(d.stickers);
  stickersFor(d.coins).forEach(id => earned.add(id));
  for (const a of ACHIEVEMENTS) if (a.progress(d).done >= a.progress(d).goal) earned.add(a.id);
  return STICKER_IDS.filter(id => earned.has(id));
}
