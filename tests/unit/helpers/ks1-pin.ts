import { isKs2 } from '../../../src/curriculum/key-stage';
import type { YearId } from '../../../src/curriculum';

/** The ids an exact-set pin lists: EYFS/KS1 only (#1050) — a KS2 topic still runs the `it.each` rail, unpinned. */
export const ks1Pinned = (ids: string[], yearOf: (id: string) => YearId): string[] => ids.filter(id => !isKs2(yearOf(id)));
