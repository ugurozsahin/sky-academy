import { describe, expect, it } from 'vitest';
import { ks1Pinned } from './helpers/ks1-pin';
import type { YearId } from '../../src/curriculum';

// #1050: the exact-set pins in session.test.ts list EYFS/KS1 topics only. This drives that scoping with a
// synthetic KS2 topic, so the pins are proved to stay green when the first real KS2 topic joins the registry.
describe('ks1Pinned (#1050)', () => {
  const years: Record<string, YearId> = { 'r-a': 'reception', 'y1-a': 'year1', 'y2-a': 'year2', 'y3-fake': 'year3' };
  const yearOf = (id: string) => years[id];
  it('drops KS2 ids and keeps every EYFS/KS1 id, in order', () => {
    expect(ks1Pinned(Object.keys(years), yearOf)).toEqual(['r-a', 'y1-a', 'y2-a']);
  });
  it('an all-KS2 input pins nothing, and an empty one stays empty', () => {
    expect(ks1Pinned(['y3-fake', 'y3-fake'], yearOf)).toEqual([]);
    expect(ks1Pinned([], yearOf)).toEqual([]);
  });
});
