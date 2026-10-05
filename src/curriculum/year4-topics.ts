// The Year 4 topic registry (#1069). Concatenates every strand, in this fixed order, and nothing else — a new
// Year 4 topic fills its own slot in its own strand module, never edits this file.
// Import direction: year4-topics → year4-* → shared modules (util.ts, ks2num.ts, types.ts). No Year 4 file
// imports another year's file, and no shared module imports a year file.
import type { Topic } from './types';
import type { Strand } from './strands';
import { Y4_NUMBER } from './year4-number';
import { Y4_CALC } from './year4-calc';
import { Y4_FRACTIONS } from './year4-fractions';
import { Y4_MEASURE } from './year4-measure';
import { Y4_GEOMETRY } from './year4-geometry';
import { Y4_STATS } from './year4-stats';
import { Y4_READING } from './year4-reading';
import { Y4_SPELLING } from './year4-spelling';
import { Y4_GRAMMAR } from './year4-grammar';

// #1068: each module's rows take its strand unless a row already names its own.
const tag = (strand: Strand, rows: Topic[]): Topic[] => rows.map(t => ({ ...t, strand: t.strand ?? strand }));

export const YEAR4_TOPICS: Topic[] = [
  ...tag('number', Y4_NUMBER), ...tag('calc', Y4_CALC), ...tag('fractions', Y4_FRACTIONS), ...tag('measure', Y4_MEASURE),
  ...tag('geometry', Y4_GEOMETRY), ...tag('stats', Y4_STATS),
  ...tag('reading', Y4_READING), ...tag('spelling', Y4_SPELLING), ...tag('grammar', Y4_GRAMMAR),
];
