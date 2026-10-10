// Year 6 measurement strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
// import: y6-convert
// import: y6-areaperim
// import: y6-area
// import: y6-volume
import type { Topic } from './types';
import { y6Convert } from './year6-convert';

export const Y6_MEASURE: Topic[] = [
  // slot: y6-convert
  { id: 'y6-convert', title: 'Converting Units and Miles', icon: '⚖️', subject: 'maths', year: 'year6', strand: 'measure', nc: 'Y6 Measurement: convert units to 3 dp, miles and kilometres (6M34–36)', gen: y6Convert },

  // slot: y6-areaperim

  // slot: y6-area

  // slot: y6-volume
];
