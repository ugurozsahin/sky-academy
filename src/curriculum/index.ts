import { RECEPTION_TOPICS } from './reception';
import { YEAR1_TOPICS } from './year1';
import { YEAR2_TOPICS } from './year2-topics';
import { YEAR3_TOPICS } from './year3-topics';
import { YEAR4_TOPICS } from './year4-topics';
import { YEAR5_TOPICS } from './year5-topics';
import { YEAR6_TOPICS } from './year6-topics';
import { gameOn, islandShown, type Visibility } from './catalogue-shown';
import { previewAllYears } from './shown';
import { activeCatalogue } from '../config/active';
import { YEARS, type Topic, type YearId, type YearInfo } from './types';

export * from './types';
export * from './key-stage';
export * from './shown';
export * from './strands';
export const TOPICS: Topic[] = [...RECEPTION_TOPICS, ...YEAR1_TOPICS, ...YEAR2_TOPICS, ...YEAR3_TOPICS, ...YEAR4_TOPICS, ...YEAR5_TOPICS, ...YEAR6_TOPICS];
/** The registry minus drill topics (#915). `TOPICS` and `CORE_TOPICS` stay whole whatever the catalogue hides (#2196):
 *  a save, a challenge code (`TOPICS` by position) and `topicById` must still find a hidden game. A list a player
 *  picks from, or that picks for them, reads `topicsFor`/`drillsFor`/`listedTopics` or applies `isGameShown`. */
export const CORE_TOPICS: Topic[] = TOPICS.filter(t => !t.drill);
export const topicById = (id: string) => TOPICS.find(t => t.id === id);

// Visibility is read from `activeCatalogue()` (#2195, #2196): the committed file with the active profile's patch laid over it (#2199).

/**
 * Every `YEARS` row the map may show right now, in `YEARS` order (#2195): each island's `years.<id>.visible` in
 * the catalogue, through `islandShown`, the one rule — `false` hides it, `true` shows it, `"auto"` is the
 * topic-count gate (#1032). The preview key shows every row regardless. `cat` defaults to `activeCatalogue()`.
 */
export const shownYears = (cat: Visibility = activeCatalogue()): YearInfo[] =>
  previewAllYears() ? YEARS : YEARS.filter(y => islandShown(cat, y.id, TOPICS));

/** `year`'s island is on the map: `shownYears` for one row. */
const islandOn = (year: YearId, cat: Visibility): boolean => previewAllYears() || islandShown(cat, year, TOPICS);

/**
 * #2196: game `id` can be picked on `year`, or picked for the player there, right now — the catalogue switches it
 * on for that year (`gameOn`) and the year's island is on the map. Hiding is never deleting: progress, stars and
 * stickers stay in the save, and the game comes back as it was when it is shown again.
 */
export const isGameShown = (id: string, year: YearId, cat: Visibility = activeCatalogue()): boolean => gameOn(cat, id, year) && islandOn(year, cat);

/** The rows of `list` (all on `year`) that `isGameShown` keeps: the same two checks, the island's made once. */
const shownOn = (year: YearId, list: Topic[], cat: Visibility): Topic[] => (islandOn(year, cat) ? list.filter(t => gameOn(cat, t.id, year)) : []);

/** A year's shown non-drill topics, in registry order: the island list, its totals, and every mixed pool (#2196). */
export const topicsFor = (year: YearId, subject?: Topic['subject'], cat: Visibility = activeCatalogue()) => shownOn(year, CORE_TOPICS.filter(t => t.year === year && (!subject || t.subject === subject)), cat);
/** Drill topics for a year, offered after the regular ones in the Sprint chooser (#915); shown ones only (#2196). */
export const drillsFor = (year: YearId, subject?: Topic['subject'], cat: Visibility = activeCatalogue()) => shownOn(year, TOPICS.filter(t => t.drill && t.year === year && (!subject || t.subject === subject)), cat);

/** #1039, #2196: the shown non-drill topics of every island the map shows — what a reward or a dashboard total
 *  counts, so a hidden game, or a topic on a hidden island, never moves a star tally, a sticker or the Master
 *  Ninja unlock. */
export const listedTopics = (cat: Visibility = activeCatalogue()): Topic[] => shownYears(cat).flatMap(y => topicsFor(y.id, undefined, cat));
