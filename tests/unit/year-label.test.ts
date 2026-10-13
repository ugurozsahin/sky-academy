import { describe, it, expect } from 'vitest';
import { ageLabel, isWarmUp } from '../../src/ui/year-label';
import { YEARS } from '../../src/curriculum/types';
import type { YearId } from '../../src/curriculum/types';
import { isKs2 } from '../../src/curriculum/key-stage';
import { islandsHTML } from '../../src/ui/map-layout';
import { senseiTrainLine, topicTapMode } from '../../src/ui/home';
import type { Topic } from '../../src/curriculum';

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
    const full = islandsHTML(years, stars, undefined, false, 'year3');
    expect(full).not.toContain('Ages ');
    for (const y of years) expect(full).toContain(`<small>Warm-up · ${y.blurb}</small>`);
    expect(islandsHTML(years, stars, undefined, true, 'year3')).toContain('<small>Warm-up</small>');
    expect(islandsHTML(years, stars, undefined, false)).toContain(`<small>${YEARS.find(y => y.id === 'year2')!.age} · `);
  });
});

describe('senseiTrainLine (#1288)', () => {
  const weakest = [{ title: 'Counting' }, { title: 'Shapes' }] as Topic[];
  const y2 = YEARS.find(y => y.id === 'year2')!, y3 = YEARS.find(y => y.id === 'year3')!;
  it('a KS1 island with a KS2 school year calls it a warm-up', () => {
    expect(senseiTrainLine(y2, 'year3', weakest)).toBe("Sensei says: a warm-up. Let's train Counting, Shapes");
  });
  it('a KS1 island with a KS1 or unset school year is unchanged', () => {
    expect(senseiTrainLine(y2, 'year1', weakest)).toBe("Sensei says: let's train Counting, Shapes");
    expect(senseiTrainLine(y2, undefined, weakest)).toBe("Sensei says: let's train Counting, Shapes");
  });
  it('a KS2 island is never a warm-up', () => {
    expect(senseiTrainLine(y3, 'year5' as YearId, weakest)).toBe("Sensei says: let's train Counting, Shapes");
  });
});

describe('topicTapMode (#949)', () => {
  it('opens Relaxed practice in Whiteboard mode, a Mission otherwise', () => {
    expect(topicTapMode(true)).toBe('relaxed');
    expect(topicTapMode(false)).toBe('mission');
  });
});
