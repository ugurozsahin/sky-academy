// Daily Ten (#1296): a whiteboard starter of ten maths questions from one island, easy to hard, no lives. Pure: the deck is what
// the Session asks (`SessionOpts.deck`, #878); the island menu offers it only while Whiteboard mode is on (#949).
import type { Difficulty, Rng, Topic } from '../curriculum/types';
import { shuffle } from '../curriculum/util';
import { answerableBy } from './pools';
import { repeatKey, type DeckItem } from './session';

export const DAILY_TEN_SIZE = 10;
/** Difficulty by card: 1 for the first four, 2 for the next four, 3 for the last two. */
export const DAILY_TEN_DIFFS: readonly Difficulty[] = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3];
const REDRAWS = 30;

/** The island's maths topics a bubble can answer, without tracing, drills or topics that deal an ordered sequence. */
export const dailyTenPool = (topics: readonly Topic[]): Topic[] =>
  topics.filter(t => t.subject === 'maths' && !t.drill && t.input !== 'tracing' && t.sequenceFrom === undefined && answerableBy(t, 'mixed'));

/** Ten items: topics shuffled and taken round-robin (so ten different topics from a pool of ten or more, and no two neighbours alike from a pool of two or more); a repeated question is re-drawn. */
export function dailyTenDeck(topics: readonly Topic[], rng: Rng): DeckItem[] {
  const order = shuffle(rng, dailyTenPool(topics)), seen = new Set<string>(), deck: DeckItem[] = [];
  if (!order.length) return deck;
  DAILY_TEN_DIFFS.forEach((d, i) => {
    const topic = order[i % order.length];
    let q = topic.gen(d, rng);
    for (let tries = 0; tries < REDRAWS && seen.has(repeatKey(q)); tries++) q = topic.gen(d, rng);
    seen.add(repeatKey(q)); deck.push({ topic, q });
  });
  return deck;
}
