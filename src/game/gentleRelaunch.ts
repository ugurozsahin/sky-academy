// #742: which bubbles come back together when a gentle year's answer bubble falls un-hit. Before this, the
// answer was the only bubble that ever returned — a child who never guessed could win by waiting for the
// wave to fall and slicing whichever bubble came back. Pure and arena-free (no Bubble, no canvas) so the
// randomisation itself is unit-tested directly, without driving a whole wave through the sim harness.
import type { Rng } from '../curriculum/types';
import { ri, shuffle } from '../curriculum/util';

/**
 * `target` is always in the result. `decoys` is every other bubble that also fell this wave and is still
 * eligible; when at least one exists, a randomised run of them — from one to every one of them — joins the
 * target, so the set never identifies the answer by itself. The whole result is shuffled: neither membership
 * nor order points at the answer. `decoys` empty (nothing else fell) returns the target alone, the only case
 * a "no lone tell" guarantee cannot reach.
 */
export function gentleRelaunchSet<T>(target: T, decoys: readonly T[], rng: Rng): T[] {
  const chosen = decoys.length ? shuffle(rng, decoys).slice(0, ri(rng, 1, decoys.length)) : [];
  return shuffle(rng, [target, ...chosen]);
}
