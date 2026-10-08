// Year 6 geometry strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
// import: y6-nets
// import: y6-missingangles
// import: y6-circles
// import: y6-coords
// import: y6-transform
import type { Topic } from './types';
import { y6Coords } from './year6-coords';

export const Y6_GEOMETRY: Topic[] = [
  // slot: y6-nets

  // slot: y6-missingangles

  // slot: y6-circles

  // slot: y6-coords
  { id: 'y6-coords', title: 'Four-Quadrant Coordinates', icon: '🧭', subject: 'maths', year: 'year6', nc: 'Y6 Geometry: describe positions on the full coordinate grid, all four quadrants (6M46)', gen: y6Coords },

  // slot: y6-transform
];
