import { describe, expect, it } from 'vitest';
import { needsSchoolYear, placementYear, schoolYearFromBirthDate, yearIdFromLevel } from '../../src/school-year';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
describe('schoolYearFromBirthDate (#1055)', () => {
  it('splits children on 31 August / 1 September', () => {
    expect(schoolYearFromBirthDate(at(2019, 8, 31), at(2024, 9, 15))).toBe(1);
    expect(schoolYearFromBirthDate(at(2019, 9, 1), at(2024, 9, 15))).toBe(0);
  });
  it("matches gov.uk's example: born 15 Jun 2019 starts Reception in September 2023", () => {
    expect(schoolYearFromBirthDate(at(2019, 6, 15), at(2023, 9, 15))).toBe(0);
    expect(schoolYearFromBirthDate(at(2019, 6, 15), at(2024, 7, 15))).toBe(0);
    expect(schoolYearFromBirthDate(at(2019, 6, 15), at(2024, 9, 1))).toBe(1);
  });
  it('is null outside Reception to Year 6', () => {
    expect(schoolYearFromBirthDate(at(2010, 1, 1), at(2024, 9, 15))).toBeNull();
    expect(schoolYearFromBirthDate(at(2023, 1, 1), at(2024, 9, 15))).toBeNull();
  });
});
describe('placementYear (#1055)', () => {
  it('is undefined when unset and the stored year when shown', () => {
    expect(placementYear({ ks2: {} })).toBeUndefined();
    expect(placementYear({ ks2: { schoolYear: 'year2' } })).toBe('year2');
  });
  it('falls back to the nearest shown year below a hidden one', () => {
    const ks1 = [{ id: 'reception' as const }, { id: 'year1' as const }, { id: 'year2' as const }];
    expect(placementYear({ ks2: { schoolYear: 'year3' } }, ks1)).toBe('year2');
    expect(yearIdFromLevel(5, ks1)).toBe('year2');
    expect(yearIdFromLevel(1)).toBe('year1');
    expect(yearIdFromLevel(null)).toBeUndefined();
  });
});
describe('needsSchoolYear (#1055)', () => {
  it('asks only a child with no school year and no progress', () => {
    expect(needsSchoolYear({ ks2: {}, progress: {} })).toBe(true);
    expect(needsSchoolYear({ ks2: { schoolYear: 'year1' }, progress: {} })).toBe(false);
    expect(needsSchoolYear({ ks2: {}, progress: { x: {} } })).toBe(false);
  });
});
