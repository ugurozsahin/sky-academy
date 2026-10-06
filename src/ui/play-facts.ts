import type { SessionOpts, SessionResult } from '../game/session';
import { mtcCheck } from '../game/mtc';
import type { PlaySession } from './play-session';

/** The fact record of a finished game for `recordGameEnd` (#1122): the answered facts, and the Tables Check result of a complete `mtc` run. */
export const factsOf = (ps: PlaySession, o: Pick<SessionOpts, 'mode' | 'deck'>, r: SessionResult) =>
  ({ facts: ps.facts.entries(), check: o.mode === 'mtc' && o.deck && !r.incomplete ? mtcCheck(o.deck, r.misses) : undefined });
