// Daily Ten (#1296): a whiteboard starter of ten maths questions from one island, easy to hard, no lives. Pure: the deck is what
// the Session asks (`SessionOpts.deck`, #878); the island menu offers it only while Whiteboard mode is on (#949).
import type { Difficulty, Rng, Topic } from '../curriculum/types';
import { shuffle } from '../curriculum/util';
import { answerableBy } from './pools';
import { repeatKey, type DeckItem } from './session';

export const DAILY_TEN_SIZE = 10;
/** The run's title, which is also how "Play again" (`main.ts`) knows to deal a fresh deck. */
export const DAILY_TEN_TITLE = 'Daily Ten';
/** Difficulty by card: 1 for the first four, 2 for the next four, 3 for the last two. */
export const DAILY_TEN_DIFFS: readonly Difficulty[] = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3];
const REDRAWS = 30;

/** The year's maths topics a bubble can answer, without tracing, drills or topics that deal an ordered sequence. */
export const dailyTenPool = (topics: readonly Topic[]): Topic[] =>
  topics.filter(t => t.subject === 'maths' && !t.drill && t.input !== 'tracing' && t.sequenceFrom === undefined && answerableBy(t, 'mixed'));

/** One card from `topic` at difficulty `d`, re-drawn while its question was already dealt; `null` (logged) when the generator throws, so one broken topic cannot stop the deck. */
function draw(topic: Topic, d: Difficulty, rng: Rng, seen: ReadonlySet<string>): DeckItem | null {
  try {
    let q = topic.gen(d, rng);
    for (let tries = 0; tries < REDRAWS && seen.has(repeatKey(q)); tries++) q = topic.gen(d, rng);
    if (seen.has(repeatKey(q))) console.warn(`daily ten: ${topic.id} d${d} dealt a repeated question after ${REDRAWS} draws`);
    return { topic, q };
  } catch (e) {
    console.error(`daily ten: ${topic.id} d${d} could not deal a question — the card is taken from another topic`, e);
    return null;
  }
}

/** Ten items: topics shuffled and taken round-robin (so ten different topics from a pool of ten or more, and no two neighbours alike from a pool of two or more); a repeated question is re-drawn. */
export function dailyTenDeck(topics: readonly Topic[], rng: Rng): DeckItem[] {
  const order = shuffle(rng, dailyTenPool(topics)), seen = new Set<string>(), deck: DeckItem[] = [];
  if (!order.length) { console.warn('daily ten: no maths topic can deal a card — an empty deck'); return deck; }
  DAILY_TEN_DIFFS.forEach((d, i) => {
    for (let k = 0; k < order.length; k++) {   // the next topic in turn, or the one after it if it threw
      const item = draw(order[(i + k) % order.length], d, rng, seen);
      if (item) { seen.add(repeatKey(item.q)); deck.push(item); return; }
    }
  });
  return deck;
}
