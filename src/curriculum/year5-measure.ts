// Year 5 measurement strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
// import: y5-imperial
// import: y5-area
// import: y5-volume
// import: y5-story-measure
import type { Topic } from './types';
import { y5Convert } from './year5-convert';

export const Y5_MEASURE: Topic[] = [
  { id: 'y5-convert', title: 'Metric Units and Time', icon: '⚖️', subject: 'maths', year: 'year5', strand: 'measure', nc: 'Y5 Measurement: convert metric units and units of time (5M34, 5M39)', gen: y5Convert },

  // slot: y5-imperial

  // slot: y5-area

  // slot: y5-volume

  // slot: y5-story-measure
];
