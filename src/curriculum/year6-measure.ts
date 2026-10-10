// Year 6 measurement strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
// import: y6-convert
// import: y6-areaperim
// import: y6-area
import { y6Area } from './year6-area';
// import: y6-volume
import type { Topic } from './types';

export const Y6_MEASURE: Topic[] = [
  // slot: y6-convert

  // slot: y6-areaperim

  { id: 'y6-area', title: 'Area of Triangles and Parallelograms', icon: '🔺', subject: 'maths', year: 'year6', nc: 'Y6 Measurement: area of parallelograms and triangles (6M39)', strand: 'measure', gen: y6Area },

  // slot: y6-volume
];
