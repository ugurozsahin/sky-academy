import { RECEPTION_TOPICS } from './reception';
import { YEAR1_TOPICS } from './year1';
import { YEAR2_TOPICS } from './year2-topics';
import { YEAR3_TOPICS } from './year3-topics';
import { YEAR4_TOPICS } from './year4-topics';
import { YEAR5_TOPICS } from './year5-topics';
import { YEAR6_TOPICS } from './year6-topics';
import { isKs2 } from './key-stage';
import { meetsShowGate, previewAllYears } from './shown';
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

// #1032: the registry is static, so the gate is computed once here rather than on every map render. The `true`
// is not hardcoded per row — the `||` above already guarantees `isKs2(y.id)` when this branch runs.
const GATED_YEARS: YearInfo[] = YEARS.filter(y =>
  !isKs2(y.id) || meetsShowGate(true, topicsFor(y.id, 'maths').length, topicsFor(y.id, 'writing').length));

/** Every `YEARS` row the map may show right now: every EYFS/KS1 island, always, plus the KS2 islands that
 *  meet the topic-count gate — or, with the preview key set, every row regardless (#1032). */
export const shownYears = (): YearInfo[] => (previewAllYears() ? YEARS : GATED_YEARS);

/** #1039: `TOPICS` rows on an island the map is showing right now — what a reward or a dashboard total should
 *  count, so a topic added to a hidden KS2 year (below `shownYears()`'s gate) never moves a star tally, a
 *  sticker or the Master Ninja unlock until its island actually appears. */
export const listedTopics = (): Topic[] => { const shown = new Set(shownYears().map(y => y.id)); return CORE_TOPICS.filter(t => shown.has(t.year)); };
