// Year 6 reading strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
import { y6Inference } from './stories-y6';
import { y6Figurative } from './year6-figurative';
import type { Topic } from './types';

export const Y6_READING: Topic[] = [
  { id: 'y6-inference', title: 'Inference', icon: '💭', subject: 'writing', year: 'year6', strand: 'reading', nc: 'Y5–6 Comprehension: inferring feelings, thoughts and motives, justified with evidence', solo: true, gen: y6Inference },
  { id: 'y6-figurative', title: 'Figurative Language', icon: '🎭', subject: 'writing', year: 'year6', strand: 'reading', nc: 'Y5–6 Comprehension: figurative language', gen: y6Figurative },
];
