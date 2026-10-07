import type { SessionOpts, SessionResult } from '../game/session';
import { mtcCheck } from '../game/mtc';
import type { PlaySession } from './play-session';
import type { ResultCandidate } from './results';
import { speedLine, tablesSpeed } from '../speed-record';

/** The fact record of a finished game for `recordGameEnd` (#1122): the answered facts, and the Tables Check result of a complete `mtc` run. */
export const factsOf = (ps: PlaySession, o: Pick<SessionOpts, 'mode' | 'deck'>, r: SessionResult) =>
  ({ facts: ps.facts.entries(), check: o.mode === 'mtc' && o.deck && !r.incomplete ? mtcCheck(o.deck, r.misses) : undefined, speed: speedOf(ps, o, r) });

/** The run's tables speed (#1174): only a complete Tables Check run has one. */
const speedOf = (ps: PlaySession, o: Pick<SessionOpts, 'mode'>, r: SessionResult) => r.incomplete ? null : tablesSpeed(o.mode, ps.facts.entries());

/** The results-screen speed line (#1174) against the best stored before this run's save (`prevSpeed`, from `recordGameEnd`). */
export function speedCandidates(ps: PlaySession, o: Pick<SessionOpts, 'mode'>, r: SessionResult, prevSpeed: number | undefined): ResultCandidate[] {
  const text = speedLine(speedOf(ps, o, r), prevSpeed);
  return text ? [{ kind: 'best', text }] : [];
}
