// Year 5 geometry strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
// import: y5-3d
// import: y5-angles
// import: y5-anglefacts
// import: y5-polygons
// import: y5-transform
import type { Topic } from './types';
import { y5AngleFacts } from './year5-anglefacts';

export const Y5_GEOMETRY: Topic[] = [
  // slot: y5-3d

  // slot: y5-angles

  { id: 'y5-anglefacts', title: 'Angle Facts', icon: '📐', subject: 'maths', year: 'year5', nc: 'Y5 Geometry: angles at a point, on a line, and rectangle facts (5M44–45)', strand: 'geometry', gen: y5AngleFacts },

  // slot: y5-polygons

  // slot: y5-transform
];
