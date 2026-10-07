// The Year 5 topic registry (#1177). Concatenates every strand, in this fixed order, and nothing else — a new
// Year 5 topic fills its own slot in its own strand module, never edits this file.
// Import direction: year5-topics → year5-* → shared modules (util.ts, ks2num.ts, types.ts). No Year 5 file
// imports another year's file, and no shared module imports a year file.
import type { Topic } from './types';
import type { Strand } from './strands';
import { Y5_NUMBER } from './year5-number';
import { Y5_CALC } from './year5-calc';
import { Y5_FRACTIONS } from './year5-fractions';
import { Y5_MEASURE } from './year5-measure';
import { Y5_GEOMETRY } from './year5-geometry';
import { Y5_STATS } from './year5-stats';
import { Y5_READING } from './year5-reading';
import { Y5_SPELLING } from './year5-spelling';
import { Y5_GRAMMAR } from './year5-grammar';

// #1068: each module's rows take its strand unless a row already names its own.
const tag = (strand: Strand, rows: Topic[]): Topic[] => rows.map(t => ({ ...t, strand: t.strand ?? strand }));

export const YEAR5_TOPICS: Topic[] = [
  ...tag('number', Y5_NUMBER), ...tag('calc', Y5_CALC), ...tag('fractions', Y5_FRACTIONS), ...tag('measure', Y5_MEASURE),
  ...tag('geometry', Y5_GEOMETRY), ...tag('stats', Y5_STATS),
  ...tag('reading', Y5_READING), ...tag('spelling', Y5_SPELLING), ...tag('grammar', Y5_GRAMMAR),
];
