// Test-only time compression (#32).
//
// The e2e suite used to run in real game time — a single mission test needed ~150 s because the outcome
// holds (1–1.8 s each), the inter-question gap, the launch stagger and the bubble flight time (3.4–5.6 s)
// all play out at the speed a child sees. That made the suite ~12 min per PR run (two thirds of the repo's
// whole Actions bill) and impossible to sit through locally.
//
// The fix is a single multiplier that divides those scheduled waits so the suite runs several times faster.
// The one thing it must NEVER touch is the clock a guard rail reads — the rAF cadence, `performance.now()`,
// and the arena's own `time` accumulator. The "renders at speed" rail measures real frames and compares the
// arena clock to the wall clock; a multiplier that sped the clock up instead of the game's waits would make
// that rail pass on nonsense — the exact mistake this repo has made four times. So: speed up the game's
// waits, not the clock. `spawnWave` scales flight time and stagger; `play.ts` scales the holds and the gap.
//
// Default is 1 (ordinary play). It is enabled only by an explicit `?fast=N` query parameter at boot, the
// `window.__SNA_FAST` global an e2e harness sets before the app loads, or the `__sna.setSpeed()` hook — none
// of which a child can reach by playing, so the game they play is always at speed 1.

declare global {
  interface Window { __SNA_FAST?: number }   // an e2e harness may set this before the app boots (#32)
}

let factor = 1;

/** The current game-speed multiplier (1 = ordinary play). */
export const gameSpeed = () => factor;

/** Set the multiplier. Anything below 1, non-finite or missing falls back to 1 — the game never runs slower. */
export function setGameSpeed(k: number): number {
  factor = Number.isFinite(k) && k >= 1 ? k : 1;
  return factor;
}

/** Divide a game duration (ms or s) by the current speed. */
export const scaled = (ms: number) => ms / factor;

/** Read the boot-time speed from `?fast=N`, else the `window.__SNA_FAST` harness global, else 1. */
export function initGameSpeed(search = typeof location !== 'undefined' ? location.search : ''): number {
  let k = 1;
  try {
    const q = new URLSearchParams(search).get('fast');
    if (q) k = parseFloat(q);
    else if (typeof window !== 'undefined' && typeof window.__SNA_FAST === 'number') k = window.__SNA_FAST;
  } catch { /* no URL/window (unit tests): stay at 1 */ }
  return setGameSpeed(k);
}
