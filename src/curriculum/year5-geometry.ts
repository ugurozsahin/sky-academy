// Year 5 geometry strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
// import: y5-angles
// import: y5-anglefacts
// import: y5-polygons
// import: y5-transform
import type { Topic } from './types';
import { y5AngleFacts } from './year5-anglefacts';
import { y5Angles } from './year5-angles';
import { y5Solids } from './year5-3d';

export const Y5_GEOMETRY: Topic[] = [
  { id: 'y5-3d', title: '3-D Shapes and Nets', icon: '📦', subject: 'maths', year: 'year5', nc: 'Y5 Geometry: identify 3-D shapes from 2-D representations (5M41)', strand: 'geometry', gen: y5Solids },

  { id: 'y5-angles', title: 'Angles in Degrees', icon: '📐', subject: 'maths', year: 'year5', nc: 'Y5 Geometry: estimate and compare acute, obtuse and reflex angles (5M42)', strand: 'geometry', gen: y5Angles },

  { id: 'y5-anglefacts', title: 'Angle Facts', icon: '📐', subject: 'maths', year: 'year5', nc: 'Y5 Geometry: angles at a point, on a line, and rectangle facts (5M44–45)', strand: 'geometry', gen: y5AngleFacts },

  // slot: y5-polygons

  // slot: y5-transform
];
