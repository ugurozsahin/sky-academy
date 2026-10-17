// Year 6 geometry strand (#1212). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year6-<slug>.ts` and this file keeps only its row/import.
// import: y6-missingangles
// import: y6-coords
import type { Topic } from './types';
import { y6Circles } from './year6-circles';
import { y6Coords } from './year6-coords';
import { y6Nets } from './year6-nets';
import { y6MissingAngles } from './year6-missingangles';
import { y6Transform } from './year6-transform';

export const Y6_GEOMETRY: Topic[] = [
  { id: 'y6-nets', title: 'Nets of 3-D Shapes', icon: '📦', subject: 'maths', year: 'year6', strand: 'geometry', nc: 'Y6 Geometry: describe 3-D shapes and their nets (6M42)', gen: y6Nets },

  // slot: y6-missingangles
  { id: 'y6-missingangles', title: 'Missing Angles', icon: '📐', subject: 'maths', year: 'year6', nc: 'Y6 Geometry: missing angles in shapes, on lines, vertically opposite (6M43, 6M45)', strand: 'geometry', gen: y6MissingAngles },

  { id: 'y6-circles', title: 'Parts of a Circle', icon: '⭕', subject: 'maths', year: 'year6', strand: 'geometry', nc: 'Y6 Geometry: radius, diameter and circumference (6M44)', gen: y6Circles },

  // slot: y6-coords
  { id: 'y6-coords', title: 'Four-Quadrant Coordinates', icon: '🧭', subject: 'maths', year: 'year6', nc: 'Y6 Geometry: describe positions on the full coordinate grid, all four quadrants (6M46)', gen: y6Coords },

  { id: 'y6-transform', title: 'Reflect in the Axes', icon: '🔄', subject: 'maths', year: 'year6', strand: 'geometry', nc: 'Y6 Geometry: translate and reflect in the axes (6M47)', gen: y6Transform },
];
