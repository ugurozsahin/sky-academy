// Tables speed record (#1174): pure, no DOM and no storage import. The mean seconds per correct answer of a
// Tables Check practice run, and the one results line that compares it with the child's own best.
import type { FactEntry } from './fact-record';

/** Fewer correct answers than this make a mean too noisy to call a speed. */
export const MIN_TIMED = 10;

/** Mean seconds per correct answer, one decimal place; `null` unless this is an `mtc` run with enough timed correct answers. */
export function tablesSpeed(mode: string, entries: readonly FactEntry[]): number | null {
  if (mode !== 'mtc') return null;
  const ms = entries.filter(e => e.outcome === 'correct' && e.ms !== undefined).map(e => e.ms!);
  if (ms.length < MIN_TIMED) return null;
  return Math.max(0.1, Math.round(ms.reduce((a, b) => a + b, 0) / ms.length / 100) / 10);
}

/** True when `best` is unset or `speed` is lower. */
export const isNewBest = (speed: number, best: number | undefined): boolean => best === undefined || speed < best;

/** The lower of the stored best and this run's speed — a slower run never raises it. */
export const keepBest = (speed: number | null, best: number | undefined): number | undefined =>
  speed === null ? best : isNewBest(speed, best) ? speed : best;

/** The results line (shown and spoken — "seconds" is written out), or `null` for a run with no speed. */
export function speedLine(speed: number | null, best: number | undefined): string | null {
  if (speed === null) return null;
  const head = `${speed.toFixed(1)} seconds per answer`;
  return best === undefined ? `${head} · your first tables speed`
    : speed < best ? `${head} · a new personal best!`
    : `${head} · your best ${best.toFixed(1)}`;
}
