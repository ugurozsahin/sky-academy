import type { Topic } from '../curriculum/types';

/**
 * The topic a Ninja Duel plays on (#956): the pool topic whose id is `chosen`, else a random pool topic — today's
 * behaviour. A `chosen` id the pool does not hold (unknown, or screened out by `duelPool`) warns and falls back
 * to random, so a sequence or tracing topic can never reach a duel.
 */
export function duelTopic(pool: Topic[], chosen: string | undefined, rng: () => number): Topic {
  const hit = chosen === undefined ? undefined : pool.find(t => t.id === chosen);
  if (chosen !== undefined && !hit) console.warn(`Ninja Duel: topic "${chosen}" is not in the duel pool; picking one at random`);
  return hit ?? pool[Math.floor(rng() * pool.length)];
}
