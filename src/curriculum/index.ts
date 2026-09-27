import { RECEPTION_TOPICS } from './reception';
import { YEAR1_TOPICS } from './year1';
import { YEAR2_TOPICS } from './year2';
import type { Topic, YearId } from './types';

export * from './types';
export const TOPICS: Topic[] = [...RECEPTION_TOPICS, ...YEAR1_TOPICS, ...YEAR2_TOPICS];
export const topicById = (id: string) => TOPICS.find(t => t.id === id);
export const topicsFor = (year: YearId, subject?: Topic['subject']) => TOPICS.filter(t => t.year === year && (!subject || t.subject === subject));
