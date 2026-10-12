// Daily Sprint (#924): a Ninja Sprint whose deck comes from the date, the way the Daily Dojo picks its challenges.
import type { Topic, YearId } from '../curriculum';
import { answerableBy } from './pools';
import { seeded } from './dojo';

/** Every bubble topic of the island, both subjects. A sequence topic is out (its respawn re-shuffles through the rng, so
 *  two children's decks would drift apart), as are drills (#915); registry order keeps the pool the same on every device. */
export const dailySprintPool = (topics: Topic[]): Topic[] =>
  topics.filter(t => !t.drill && t.sequenceFrom === undefined && answerableBy(t, 'mixed'));

/** The rng seed: the same `date` (the Dojo's own day key) and island give the same deck on every device. */
export const dailySprintSeed = (date: string, year: YearId): string => `sprint:${date}:${year}`;

/** A fresh rng for a seeded start, else none (the Session then uses `Math.random`). One per start, so a replay re-deals the same deck. */
export const seedRng = (seed?: string): (() => number) | undefined => (seed ? seeded(seed) : undefined);
