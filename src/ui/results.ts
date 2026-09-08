// Pure results-screen derivations, carved out of the play.ts closure (#36): the medal and the heading are
// decided purely from the finished run, with no DOM or side effects, so they can be unit-tested directly
// instead of only through the e2e results screen. play.ts keeps the recording, speech and overlay wiring.
import { MODES, type Mode } from '../game/modes';

/** How a finished run scored — the fields the medal reads. */
export interface RunOutcome {
  mode: Mode;
  won: boolean;
  score: number;
  stars: number;
}

/**
 * The medal shown on the results screen. Endless grades on score, Sprint on its star tier, and the
 * staged/boss modes on stars when won; a lost run that can be lost (mission/boss) shows the effort medal.
 */
export function resultMedal(r: RunOutcome): string {
  if (r.mode === 'endless') return r.score >= 300 ? '🥇' : r.score >= 150 ? '🥈' : '🥉';
  if (r.mode === 'sprint') return r.stars === 3 ? '🥇' : r.stars === 2 ? '🥈' : r.stars === 1 ? '🥉' : '💪';
  return r.won ? (r.stars === 3 ? '🥇' : r.stars === 2 ? '🥈' : '🥉') : '💪';
}

/**
 * The results heading, taken from the mode table — a won Sensei-training run (staged + training) reads
 * "Training complete!" rather than the mission's own "Mission complete!".
 */
export function resultHeading(mode: Mode, opts: { won: boolean; training: boolean }): string {
  const spec = MODES[mode];
  return spec.staged && opts.won && opts.training ? 'Training complete!'
    : opts.won ? spec.overHeadingWon : spec.overHeadingLost;
}
