// "Slice Them All" (#869/#918): the builder every any-order topic child (#920, #926, #927, #928) draws its
// card from, so the invariants below are enforced once rather than re-checked by each of them.
import type { HintOpt, Question, Rng } from './types';
import { shuffle } from './util';

/**
 * A card whose `targets` can be sliced in any order — correct once every one of them is sliced, wrong on any
 * `decoys` bubble. `Session.hit()`/`fall()`/`labelsFor()` (`src/game/session.ts`) read `anyOrder` to track
 * sliced targets by label rather than by position, which is why every label here must be unique: two targets
 * (or a target and a decoy) sharing a label would make one bubble's slice ambiguous between them.
 *
 * Sorted with `localeCompare(…, 'en', { numeric: true })` before it becomes `sequence`/`answer`, here rather
 * than left to each caller, so the four topic children all get the same canonical order for free and cannot
 * ship it inconsistently — the same reason `starsForAccuracy` (`session.ts`) is one function, not a copy per
 * caller. `answer` is that sorted list joined by comma, matching the join form `tests/unit/curriculum.test.ts`
 * already accepts for an ordered `sequence`'s canonical answer.
 *
 * Throws a `RangeError` on a malformed call — fewer than 2 targets, no decoys, a target repeated, a decoy
 * repeated, or a target/decoy overlap — the same "fail where the mistake was made" precedent `gapQ`
 * (`util.ts`) sets for its own decoy-count guard, rather than shipping a degenerate card a rail only catches
 * later. The generic per-topic rail in `tests/unit/curriculum.test.ts` still checks every topic's actual
 * draws independently, since a future generator could build an `anyOrder` question by hand instead of
 * through this function.
 */
export function anyOrderQ(rng: Rng, prompt: string, targets: string[], decoys: string[], opts: Partial<Omit<Question, 'prompt' | 'sequence' | 'answer' | 'options' | 'anyOrder'>> & HintOpt = {}): Question {
  if (targets.length < 2) throw new RangeError(`anyOrderQ("${prompt}") needs at least 2 targets, got ${targets.length}`);
  if (decoys.length < 1) throw new RangeError(`anyOrderQ("${prompt}") needs at least 1 decoy, got 0`);
  const all = [...targets, ...decoys];
  if (new Set(all).size !== all.length) throw new RangeError(`anyOrderQ("${prompt}") has a repeated or overlapping label: ${all.join(', ')}`);
  const sequence = [...targets].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return { prompt, answer: sequence.join(','), sequence, anyOrder: true, options: shuffle(rng, all), ...opts };
}
