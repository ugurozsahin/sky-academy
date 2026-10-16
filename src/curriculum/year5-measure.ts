// Year 5 measurement strand (#1177). Each slot below is a future PR's own ticket. Keep this file ≤300 lines: a generator that
// would push it past that moves to its own `year5-<slug>.ts` and this file keeps only its row/import.
import type { Topic } from './types';
import { y5Convert } from './year5-convert';
import { y5Area } from './year5-area';
import { y5Imperial } from './year5-imperial';
import { y5Volume } from './year5-volume';
import { y5StoryMeasure } from './year5-story-measure';

export const Y5_MEASURE: Topic[] = [
  { id: 'y5-convert', title: 'Metric Units and Time', icon: '⚖️', subject: 'maths', year: 'year5', strand: 'measure', nc: 'Y5 Measurement: convert metric units and units of time (5M34, 5M39)', gen: y5Convert },

  { id: 'y5-imperial', title: 'Imperial Units', icon: '📏', subject: 'maths', year: 'year5', strand: 'measure', nc: 'Y5 Measurement: approximate metric and imperial equivalences (5M35)', gen: y5Imperial },
  { id: 'y5-area', title: 'Area and Perimeter', icon: '📐', subject: 'maths', year: 'year5', strand: 'measure', nc: 'Y5 Measurement: area of rectangles, composite perimeter, estimating area (5M36–37)', gen: y5Area },

  { id: 'y5-volume', title: 'Volume and Capacity', icon: '🧊', subject: 'maths', year: 'year5', strand: 'measure', nc: 'Y5 Measurement: estimate volume and capacity (5M38)', gen: y5Volume },

  { id: 'y5-story-measure', title: 'Measure Problems', icon: '🧮', subject: 'maths', year: 'year5', strand: 'measure', nc: 'Y5 Measurement: four operations on measures in decimal notation (5M40)', gen: y5StoryMeasure },
];
