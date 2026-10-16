// Year 5 statistics strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
// import: y5-linegraph
import type { Topic } from './types';
import { y5Timetable } from './year5-timetable';

export const Y5_STATS: Topic[] = [
  // slot: y5-linegraph

  { id: 'y5-timetable', title: 'Timetables', icon: '🕒', subject: 'maths', year: 'year5', nc: 'Y5 Statistics: read, interpret and complete tables and timetables (5M49)', gen: y5Timetable },
];
