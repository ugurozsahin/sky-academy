// Year 4 reading strand (#1069). Each slot below is a future PR's own ticket; y4-context has landed (#1131).
// import: y4-retrieve
import type { Topic } from './types';
import { y4Context } from './year4-context';

export const Y4_READING: Topic[] = [
  // slot: y4-retrieve
  { id: 'y4-context', title: 'Words in Context', icon: '🔎', subject: 'writing', year: 'year4', nc: 'Y3–4 Comprehension: explaining the meaning of words in context', gen: y4Context },
];
