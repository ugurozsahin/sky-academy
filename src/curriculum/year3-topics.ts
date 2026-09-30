// The Year 3 topic registry (#1050). Concatenates every strand, in this fixed order, and nothing else — a new
// Year 3 topic fills its own slot in its own strand module, never edits this file.
// Import direction: year3-topics → year3-* → shared modules (util.ts, ks2num.ts, types.ts). No Year 3 file
// imports another year's file, and no shared module imports a year file.
import type { Topic } from './types';
import { Y3_NUMBER } from './year3-number';
import { Y3_CALC } from './year3-calc';
import { Y3_FRACTIONS } from './year3-fractions';
import { Y3_MEASURE } from './year3-measure';
import { Y3_GEOMETRY } from './year3-geometry';
import { Y3_STATS } from './year3-stats';
import { Y3_READING } from './year3-reading';
import { Y3_SPELLING } from './year3-spelling';
import { Y3_GRAMMAR } from './year3-grammar';

export const YEAR3_TOPICS: Topic[] = [
  ...Y3_NUMBER, ...Y3_CALC, ...Y3_FRACTIONS, ...Y3_MEASURE, ...Y3_GEOMETRY, ...Y3_STATS,
  ...Y3_READING, ...Y3_SPELLING, ...Y3_GRAMMAR,
];
