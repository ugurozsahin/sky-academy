import { MATHS_TOPICS } from './maths';
import { WRITING_TOPICS } from './writing';
import type { Topic, YearId } from './types';

export * from './types';
export const TOPICS: Topic[] = [...MATHS_TOPICS, ...WRITING_TOPICS];
export const topicById = (id: string) => TOPICS.find(t => t.id === id);
export const topicsFor = (year: YearId, subject?: Topic['subject']) => TOPICS.filter(t => t.year === year && (!subject || t.subject === subject));
