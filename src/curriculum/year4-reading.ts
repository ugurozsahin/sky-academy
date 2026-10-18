// Year 4 reading strand (#1069). y4-context (#1131) and y4-retrieve (#1130) have landed.
import type { Topic } from './types';
import { y4Context } from './year4-context';
import { y4Retrieve } from './stories-y4';

export const Y4_READING: Topic[] = [
  { id: 'y4-retrieve', title: 'Retrieving Information', icon: '📰', subject: 'writing', year: 'year4', nc: 'Y3–4 Comprehension: retrieve and record information from non-fiction', solo: true, gen: y4Retrieve },
  { id: 'y4-context', title: 'Words in Context', icon: '🔎', subject: 'writing', year: 'year4', nc: 'Y3–4 Comprehension: explaining the meaning of words in context', gen: y4Context },
];
