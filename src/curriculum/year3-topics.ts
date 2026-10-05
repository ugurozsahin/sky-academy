// The Year 3 topic registry (#1050). Concatenates every strand, in this fixed order, and nothing else — a new
// Year 3 topic fills its own slot in its own strand module, never edits this file.
// Import direction: year3-topics → year3-* → shared modules (util.ts, ks2num.ts, types.ts). No Year 3 file
// imports another year's file, and no shared module imports a year file.
import type { Topic } from './types';
import type { Strand } from './strands';
import { Y3_NUMBER } from './year3-number';
import { Y3_CALC } from './year3-calc';
import { Y3_FRACTIONS } from './year3-fractions';
import { Y3_MEASURE } from './year3-measure';
import { Y3_GEOMETRY } from './year3-geometry';
import { Y3_STATS } from './year3-stats';
import { Y3_READING } from './year3-reading';
import { Y3_SPELLING } from './year3-spelling';
import { Y3_GRAMMAR } from './year3-grammar';

// #1068: each module's rows take its strand unless a row already names its own.
const tag = (strand: Strand, rows: Topic[]): Topic[] => rows.map(t => ({ ...t, strand: t.strand ?? strand }));

export const YEAR3_TOPICS: Topic[] = [
  ...tag('number', Y3_NUMBER), ...tag('calc', Y3_CALC), ...tag('fractions', Y3_FRACTIONS), ...tag('measure', Y3_MEASURE),
  ...tag('geometry', Y3_GEOMETRY), ...tag('stats', Y3_STATS),
  ...tag('reading', Y3_READING), ...tag('spelling', Y3_SPELLING), ...tag('grammar', Y3_GRAMMAR),
];
