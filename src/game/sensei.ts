// Train with Sensei: adaptive practice picks the topics a child finds hardest. Pure so it can be unit-tested.
import type { Topic } from '../curriculum';
import type { TopicProgress } from '../storage';

export const TRAIN_TOPICS = 3;

/**
 * Master Ninja unlock: every topic (all islands, tracing included) has at least one star.
 * Returns how many topics are starred out of the total, so the locked card can show progress.
 */
export function masterProgress(topics: Topic[], progress: Record<string, TopicProgress>): { done: number; total: number; unlocked: boolean } {
  const done = topics.filter(t => (progress[t.id]?.stars ?? 0) >= 1).length;
  return { done, total: topics.length, unlocked: topics.length > 0 && done === topics.length };
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
  const playable = topics.filter(t => t.mode !== 'tracing');
  const played = playable.filter(t => accuracy(progress[t.id]) !== null);
  const key = (t: Topic) => { const p = progress[t.id]; return [accuracy(p)!, p.stars, p.plays]; };
  played.sort((a, b) => { const ka = key(a), kb = key(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]; return 0; });
  const fresh = playable.filter(t => !played.includes(t));
  return [...played, ...fresh].slice(0, Math.min(n, playable.length));
}
