// Recording what a game achieved: stars, accuracy, the per-mode bests, and the daily streak.
import type { AnswerTally } from './shape';
import { load, save } from './store';
/** Records a finished Mission; returns whether it beat a previous best above 0 — a first play is never a "new best" (#933). */
export function recordTopic(topicId: string, stars: number, score: number): boolean {
  const p = load().progress[topicId] ?? { stars: 0, best: 0, plays: 0 };
  const next = { ...p, stars: Math.max(p.stars, stars), best: Math.max(p.best, score), plays: p.plays + 1 };   // keep sprint (#911), hits, tries, last, crown
  save({ progress: { ...load().progress, [topicId]: next } });
  return p.best > 0 && score > p.best;
}
/**
 * Add answered questions to a topic's lifetime tally (Sensei picks the weakest topics from these). Takes an
 * `AnswerTally` rather than two positional numbers a caller could pass in the wrong order (#379) — the two
 * call sites (`ui/play.ts`, `ui/duel.ts`) already build one before this. Clamped to `0 <= hits <= tries`:
 * `accuracy()` divides `hits/tries`, and an out-of-range write is a topic Sensei can rank above 100%.
 * **Warns when the clamp actually changes the value** (review finding, #379) — the same shape `ui/visuals.ts`'s
 * chart clamps and `arena.ts`'s label-fit warning already use: silently repairing a malformed tally would trade
 * one silent failure (an accuracy over 100%) for another (evidence of the bug that produced it, gone without a
 * trace). Both real producers (`session.ts`'s `tally()`, `duel.ts`'s `hit()`) build a well-formed tally today,
 * so this should never fire in play; `Number.isFinite` catches a `NaN` the same way, rather than letting it
 * through a clamp that cannot bound it. `tries` is validated the same way too (#582): non-finite or negative warns and writes nothing; exactly 0 stays a silent no-op.
 */
export function recordAccuracy(topicId: string, t: AnswerTally) {
  if (t.tries === 0) return;
  if (!Number.isFinite(t.tries) || t.tries < 0) { console.warn(`recordAccuracy("${topicId}"): invalid tries (${t.tries}) — ignored`); return; }
  const hits = Number.isFinite(t.hits) ? Math.min(Math.max(t.hits, 0), t.tries) : 0;
  if (hits !== t.hits) console.warn(`recordAccuracy("${topicId}"): tally out of range (hits=${t.hits}, tries=${t.tries}) — clamped to ${hits}`);
  const p = load().progress[topicId] ?? { stars: 0, best: 0, plays: 0 };
  save({ progress: { ...load().progress, [topicId]: { ...p, hits: (p.hits ?? 0) + hits, tries: (p.tries ?? 0) + t.tries, last: today() } } });
}
/** Count a completed Sensei training session for this year. Returns the new total. */
export function recordTraining(year: string): number {
  const t = load().training; const n = (t[year] ?? 0) + 1;
  save({ training: { ...t, [year]: n } }); return n;
}
export function recordEndless(year: string, score: number) {
  const e = load().endless; if ((e[year] ?? 0) < score) save({ endless: { ...e, [year]: score } });
}
/** Ninja Sprint best per year. Returns true when `score` is a new personal best (a score of 0 never is). */
export function recordSprint(year: string, score: number): boolean {
  const s = load().sprint; if (score <= 0 || (s[year] ?? 0) >= score) return false;
  save({ sprint: { ...s, [year]: score } }); return true;
}
/**
 * A topic's own Sprint best, in correct answers (#911) — what the trophy tiers compare against `sprintStars`.
 * Touches only `progress[id].sprint`: `plays`/`stars`/`best` count missions, and the year's `sprint[year]`
 * stays the island's Ninja Sprint best. A score of 0 never is a best. Returns true on a new best.
 */
export function recordTopicSprint(topicId: string, correct: number): boolean {
  const p = load().progress[topicId] ?? { stars: 0, best: 0, plays: 0 };
  if (!Number.isInteger(correct) || correct <= 0 || (p.sprint ?? 0) >= correct) return false;
  save({ progress: { ...load().progress, [topicId]: { ...p, sprint: correct } } }); return true;
}
/** Count a Boss Battle knock-out for this year. Returns the new total. */
export function recordBossWin(year: string): number {
  const b = load().boss; const n = (b[year] ?? 0) + 1;
  save({ boss: { ...b, [year]: n } }); return n;
}
/** Count a completed Memory Match board for this year. Returns the new total. */
export function recordMemory(year: string): number {
  const m = load().memory; const n = (m[year] ?? 0) + 1;
  save({ memory: { ...m, [year]: n } }); return n;
}
export const today = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
/** Update the daily streak for a play today. Returns the streak length. */
export function touchStreak(now = new Date()): number {
  const d = load(); const t = today(now);
  if (d.streak.last === t) return d.streak.days;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const days = d.streak.last === today(y) ? d.streak.days + 1 : 1;
  save({ streak: { last: t, days } });
  return days;
}
