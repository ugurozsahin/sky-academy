// Train with Sensei: adaptive practice picks the topics a child finds hardest. Pure so it can be unit-tested.
import type { Topic } from '../curriculum';
import type { TopicProgress } from '../storage';

export const TRAIN_TOPICS = 3;

// #1039 Decision D7. Its own constant, deliberately not `TRAIN_TOPICS` above: the two are unrelated invariants
// that happen to share a value today, and reusing one for the other would silently couple them.
const MASTER_ISLANDS_NEEDED = 3;

/**
 * Master Ninja unlock (#1039, Decision D7): every topic on any three islands (tracing included) has at least
 * one star — fixed at three so a new KS2 island never asks a Reception child to star a Year 6 topic. `islands`
 * is one topic list per island (`shownYears().map(y => topicsFor(y.id))`); `done` counts fully-starred islands,
 * capped at the three needed, so it never grows past 3/3 as more islands appear. `ts.length > 0` is defensive
 * only — every real island has topics — so an all-empty `islands` reads as not yet unlocked rather than a crash.
 */
export function masterProgress(islands: Topic[][], progress: Record<string, TopicProgress>): { done: number; total: number; unlocked: boolean } {
  const done = Math.min(islands.filter(ts => ts.length > 0 && ts.every(t => (progress[t.id]?.stars ?? 0) >= 1)).length, MASTER_ISLANDS_NEEDED);
  return { done, total: MASTER_ISLANDS_NEEDED, unlocked: done >= MASTER_ISLANDS_NEEDED };
}

/** Accuracy so far (0–1) from recorded slices; older saves without tallies fall back to their star rating. */
export function accuracy(p: TopicProgress | undefined): number | null {
  if (!p || !p.plays) return null;
  return p.tries ? (p.hits ?? 0) / p.tries : p.stars / 3;
}

/**
 * The `n` weakest playable topics of a year: lowest accuracy first, then fewest stars, then fewest plays.
 * Topics never played come after the played ones (in curriculum order) so a new player still gets a full set.
 */
export function weakestTopics(topics: Topic[], progress: Record<string, TopicProgress>, n = TRAIN_TOPICS): Topic[] {
  const playable = topics.filter(t => t.input !== 'tracing');
  const played = playable.filter(t => accuracy(progress[t.id]) !== null);
  const key = (t: Topic) => { const p = progress[t.id]; return [accuracy(p)!, p.stars, p.plays]; };
  played.sort((a, b) => { const ka = key(a), kb = key(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]; return 0; });
  const fresh = playable.filter(t => !played.includes(t));
  return [...played, ...fresh].slice(0, Math.min(n, playable.length));
}
