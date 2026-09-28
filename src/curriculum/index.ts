import { RECEPTION_TOPICS } from './reception';
import { YEAR1_TOPICS } from './year1';
import { YEAR2_TOPICS } from './year2-topics';
import { isKs2 } from './key-stage';
import { meetsShowGate, previewAllYears } from './shown';
import { YEARS, type Topic, type YearId, type YearInfo } from './types';

export * from './types';
export * from './key-stage';
export * from './shown';
export const TOPICS: Topic[] = [...RECEPTION_TOPICS, ...YEAR1_TOPICS, ...YEAR2_TOPICS];
export const topicById = (id: string) => TOPICS.find(t => t.id === id);
export const topicsFor = (year: YearId, subject?: Topic['subject']) => TOPICS.filter(t => t.year === year && (!subject || t.subject === subject));

// #1032: the registry is static, so the gate is computed once here rather than on every map render. The `true`
// is not hardcoded per row — the `||` above already guarantees `isKs2(y.id)` when this branch runs.
const GATED_YEARS: YearInfo[] = YEARS.filter(y =>
  !isKs2(y.id) || meetsShowGate(true, topicsFor(y.id, 'maths').length, topicsFor(y.id, 'writing').length));

/** Every `YEARS` row the map may show right now: every EYFS/KS1 island, always, plus the KS2 islands that
 *  meet the topic-count gate — or, with the preview key set, every row regardless (#1032). */
export const shownYears = (): YearInfo[] => (previewAllYears() ? YEARS : GATED_YEARS);
