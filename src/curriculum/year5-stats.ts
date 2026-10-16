// Year 5 statistics strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
import { y5LineGraph } from './year5-linegraph';
// import: y5-timetable
import type { Topic } from './types';

export const Y5_STATS: Topic[] = [
  { id: 'y5-linegraph', title: 'Line Graphs', icon: '📈', subject: 'maths', year: 'year5', strand: 'stats', nc: 'Y5 Statistics: comparison, sum and difference from a line graph (5M48)', gen: y5LineGraph },

  // slot: y5-timetable
];
