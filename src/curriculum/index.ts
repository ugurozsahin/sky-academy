import { RECEPTION_TOPICS } from './reception';
import { YEAR1_TOPICS } from './year1';
import { YEAR2_TOPICS } from './year2-topics';
import { YEAR3_TOPICS } from './year3-topics';
import { YEAR4_TOPICS } from './year4-topics';
import { YEAR5_TOPICS } from './year5-topics';
import { YEAR6_TOPICS } from './year6-topics';
import { islandShown } from './catalogue-shown';
import { previewAllYears } from './shown';
import { RUNTIME } from '../config/resolve';
import type { RuntimeCatalogue } from '../config/catalogue';
import { YEARS, type Topic, type YearId, type YearInfo } from './types';

export * from './types';
export * from './key-stage';
export * from './shown';
export * from './strands';
export const TOPICS: Topic[] = [...RECEPTION_TOPICS, ...YEAR1_TOPICS, ...YEAR2_TOPICS, ...YEAR3_TOPICS, ...YEAR4_TOPICS, ...YEAR5_TOPICS, ...YEAR6_TOPICS];
/** The registry minus drill topics (#915): what every star total, pool and unlock reads. `TOPICS` stays whole so `topicById` finds a drill. */
export const CORE_TOPICS: Topic[] = TOPICS.filter(t => !t.drill);
export const topicById = (id: string) => TOPICS.find(t => t.id === id);
export const topicsFor = (year: YearId, subject?: Topic['subject']) => CORE_TOPICS.filter(t => t.year === year && (!subject || t.subject === subject));
/** Drill topics for a year, offered after the regular ones in the Sprint chooser (#915). */
export const drillsFor = (year: YearId, subject?: Topic['subject']) => TOPICS.filter(t => t.drill && t.year === year && (!subject || t.subject === subject));

/**
 * Every `YEARS` row the map may show right now, in `YEARS` order (#2195): each island's `years.<id>.visible` in
 * the catalogue, through `islandShown`, the one rule — `false` hides it, `true` shows it, `"auto"` is the
 * topic-count gate (#1032). The preview key shows every row regardless. `cat` is the seam a user's patched
 * catalogue comes through (#2199). Every caller, `listedTopics` included, passes nothing, so the default decides:
 * the committed file today; swap the default for the active profile's patched copy and every map, reward and
 * dashboard total follows at once. A whole catalogue, never a bare patch: a year or game it leaves out is hidden.
 */
export const shownYears = (cat: Pick<RuntimeCatalogue, 'years' | 'games'> = RUNTIME): YearInfo[] =>
  previewAllYears() ? YEARS : YEARS.filter(y => islandShown(cat, y.id, TOPICS));

/** #1039: `TOPICS` rows on an island the map is showing right now — what a reward or a dashboard total should
 *  count, so a topic added to a hidden KS2 year (below `shownYears()`'s gate) never moves a star tally, a
 *  sticker or the Master Ninja unlock until its island actually appears. */
export const listedTopics = (): Topic[] => { const shown = new Set(shownYears().map(y => y.id)); return CORE_TOPICS.filter(t => shown.has(t.year)); };
