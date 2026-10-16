// Year 5 geometry strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
// import: y5-3d
// import: y5-angles
// import: y5-anglefacts
// import: y5-transform
import type { Topic } from './types';
import { y5AngleFacts } from './year5-anglefacts';
import { y5Angles } from './year5-angles';
import { y5Polygons } from './year5-polygons';
import { y5Transform } from './year5-transform';

export const Y5_GEOMETRY: Topic[] = [
  // slot: y5-3d

  { id: 'y5-angles', title: 'Angles in Degrees', icon: '📐', subject: 'maths', year: 'year5', nc: 'Y5 Geometry: estimate and compare acute, obtuse and reflex angles (5M42)', strand: 'geometry', gen: y5Angles },

  { id: 'y5-anglefacts', title: 'Angle Facts', icon: '📐', subject: 'maths', year: 'year5', nc: 'Y5 Geometry: angles at a point, on a line, and rectangle facts (5M44–45)', strand: 'geometry', gen: y5AngleFacts },

  { id: 'y5-polygons', title: 'Regular Polygons', icon: '🔷', subject: 'maths', year: 'year5', nc: 'Y5 Geometry: regular and irregular polygons (5M46)', strand: 'geometry', gen: y5Polygons },

  { id: 'y5-transform', title: 'Reflection and Translation', icon: '🔄', subject: 'maths', year: 'year5', nc: 'Y5 Geometry: position after a reflection or translation (5M47)', strand: 'geometry', gen: y5Transform },
];
