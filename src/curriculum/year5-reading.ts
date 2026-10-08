// Year 5 reading strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
// import: y5-factopinion
import { y5FactOpinion } from './year5-factopinion';
import type { Topic } from './types';

export const Y5_READING: Topic[] = [
  { id: 'y5-factopinion', title: 'Fact or Opinion?', icon: '🧐', subject: 'writing', year: 'year5', nc: 'Y5–6 Comprehension: distinguish between statements of fact and opinion', sequenceFrom: 3, gen: y5FactOpinion },
];
