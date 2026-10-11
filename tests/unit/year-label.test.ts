import { describe, it, expect } from 'vitest';
import { ageLabel, isWarmUp } from '../../src/ui/year-label';
import { YEARS } from '../../src/curriculum/types';
import type { YearId } from '../../src/curriculum/types';
import { isKs2 } from '../../src/curriculum/key-stage';
import { islandsHTML } from '../../src/ui/map-layout';

const years = YEARS.filter(y => !isKs2(y.id));
const lastKs2 = YEARS[YEARS.length - 1].id;
const school: (YearId | undefined)[] = [undefined, 'year1', 'year2', 'year3', lastKs2];

describe('ageLabel (#1288)', () => {
  for (const y of years) for (const s of school) {
    const warm = !!s && isKs2(s);
    it(`${y.id} island, school year ${s ?? 'unset'} → ${warm ? 'Warm-up' : y.age}`, () => {
      expect(ageLabel(y, s)).toBe(warm ? 'Warm-up' : y.age);
      expect(isWarmUp(y, s)).toBe(warm);
    });
  }
  it('a KS2 island keeps its own age for a KS2 child', () => {
    const y3 = YEARS.find(y => y.id === 'year3')!;
    expect(ageLabel(y3, 'year5' as YearId)).toBe(y3.age);
  });
  it('the map card carries it, full and compact', () => {
    const stars = () => ({ s: 0, m: 3 });
    expect(islandsHTML(years, stars, undefined, false, 'year3')).not.toContain('Ages ');
    expect(islandsHTML(years, stars, undefined, true, 'year3')).toContain('<small>Warm-up</small>');
    expect(islandsHTML(years, stars, undefined, false)).toContain(`<small>${years[2].age} · `);
  });
});
