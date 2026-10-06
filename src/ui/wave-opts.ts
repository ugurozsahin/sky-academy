import type { Question } from '../curriculum';
import type { WaveOpts } from '../game/arena';
import { wideFor } from '../curriculum/util';   // #482: the same wide-vs-narrow rule wordQ uses, not a second one

/**
 * The spawn options for one question's wave, shared between this screen and `tests/unit/sim.test.ts`'s
 * scenarios (#126). Before this, every scenario hand-wrote its own copy of this shape — matched by prose
 * ("the same text as the screen's") rather than by the compiler — and had already drifted: the `wide`
 * derivation below had no test coverage at all, and a hardcoded `wide: true` stayed accidentally correct only
 * because the one scenario using it happens to ask a question where `q.wide` is also true. `labels` is
 * `info.labels` before any villain-mode TNT bubble is mixed in — `onQuestion` below does that itself, since
 * it is specific to the real screen and no scenario exercises it here.
 * `gentle` (#700) — the year's `gentle` flag — is passed separately rather than read off a `year` this
 * function otherwise has no reason to take: it only ever affects a non-sequence question's single
 * `gentleTarget`, so a scenario that does not care about it can go on calling this with three arguments.
 * `remaining` (#919) defaults to the whole sequence: omitted means "nothing sliced yet", not "nothing left". */
export function waveOptsFor(q: Question, info: { labels: string[]; speed: number }, remaining?: readonly string[], gentle?: boolean): WaveOpts {
  return {
    labels: info.labels, speed: info.speed, wide: !!q.wide || wideFor(info.labels),
    ordered: q.sequence ? [...(remaining ?? q.sequence)] : undefined, gentleTarget: gentle && !q.sequence ? q.answer : undefined,
  };
}
