// Year 6 statistics strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
// import: y6-pie
// import: y6-graphs
// import: y6-mean
import { y6Mean } from './year6-mean';
import type { Topic } from './types';

export const Y6_STATS: Topic[] = [
  // slot: y6-pie

  // slot: y6-graphs

  // slot: y6-mean
  { id: 'y6-mean', title: 'The Mean', icon: '📊', subject: 'maths', year: 'year6', strand: 'stats', nc: 'Y6 Statistics: calculate and interpret the mean as an average (6M49)', gen: y6Mean },
];
