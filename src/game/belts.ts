// Ninja belts (#951): a long-term goal from the total stars across every topic. Pure — no DOM, no storage.
import { safeRecord, type TopicProgress } from '../storage';
import type { Topic } from '../curriculum';

/** The fixed absolute ladder: thresholds never move, so a new topic can never demote a child. */
export const BELTS = [
  { n: 1, name: 'White', stars: 0 }, { n: 2, name: 'Yellow', stars: 3 }, { n: 3, name: 'Orange', stars: 10 },
  { n: 4, name: 'Green', stars: 20 }, { n: 5, name: 'Blue', stars: 35 }, { n: 6, name: 'Purple', stars: 55 },
  { n: 7, name: 'Brown', stars: 80 }, { n: 8, name: 'Black', stars: 110 },
] as const;

export interface Belt { n: number; name: string }

/** The highest belt whose threshold the total reaches; a negative or non-finite total reads as White. */
export function beltFor(totalStars: number): Belt {
  const t = Number.isFinite(totalStars) ? totalStars : 0;
  const b = [...BELTS].reverse().find(x => t >= x.stars) ?? BELTS[0];
  return { n: b.n, name: b.name };
}

/** Sum of `stars` over `topics`, read as tolerantly as the dashboard does (#95), so the two always agree. */
export function totalStarsOf(progress: unknown, topics: readonly Pick<Topic, 'id'>[]): number {
  const p = safeRecord<TopicProgress>(progress);
  return topics.reduce((n, t) => n + (p[t.id]?.stars ?? 0), 0);
}
