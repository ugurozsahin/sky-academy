import type { YearId } from './types';

export const EYFS_KS1: ReadonlySet<YearId> = new Set(['reception', 'year1', 'year2']);
export const isKs2 = (y: YearId) => !EYFS_KS1.has(y);
