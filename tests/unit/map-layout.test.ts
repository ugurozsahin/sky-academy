import { describe, it, expect } from 'vitest';
import { islandsHTML, mapCols, mapLayout } from '../../src/ui/map-layout';
import { YEARS } from '../../src/curriculum/types';
import type { YearInfo } from '../../src/curriculum/types';

// Fixture years so a test bank can hold more than the three real `YEARS` rows, the same fixture-year
// pattern `island-placeholder.test.ts`-style tests use elsewhere in this repo.
const fixture = (id: string, short: string): YearInfo => ({
  ...YEARS[0], id: id as YearInfo['id'], short, title: `Year ${short}`, blurb: 'A blurb', tint: '#12345655',
});
const YEARS7 = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((s, i) => fixture(`y${i}`, s));

describe('mapCols (#1048): never more than 4 columns, rows stay balanced', () => {
  it.each([[1, 1], [2, 2], [3, 3], [4, 4], [5, 3], [6, 3], [7, 4]])('mapCols(%i) === %i', (n, cols) => {
    expect(mapCols(n)).toBe(cols);
  });
});

describe('mapLayout (#1048)', () => {
  it('n = 1..3 (today\'s shape) is not compact, cols === n', () => {
    for (const n of [1, 2, 3]) expect(mapLayout(n)).toEqual({ cols: n, compact: false });
  });
  it('n = 4 switches to compact, capped at 4 columns', () => {
    expect(mapLayout(4)).toEqual({ cols: 4, compact: true });
  });
  it('n = 7 caps at 4 columns and is compact', () => {
    expect(mapLayout(7)).toEqual({ cols: 4, compact: true });
  });
});

describe('islandsHTML (#1048)', () => {
  const stars = () => ({ s: 1, m: 3 });

  it('keeps data-year, aria-label and .sel for the selected year', () => {
    const html = islandsHTML(YEARS7, stars, 'y2', false);
    for (const y of YEARS7) {
      expect(html, y.id).toContain(`data-year="${y.id}"`);
      expect(html, y.id).toContain(`aria-label="${y.title} island"`);
    }
    expect(html.match(/class="island sel"/g)).toHaveLength(1);
    expect(html).toContain('data-year="y2" style="--tint:#12345655" aria-label="Year C island"');
  });

  it('no year selected: no button carries .sel', () => {
    const html = islandsHTML(YEARS7, stars, undefined, false);
    expect(html).not.toContain(' sel"');
  });

  it('compact mode drops only the blurb; the age stays', () => {
    const full = islandsHTML(YEARS7, stars, undefined, false);
    const compact = islandsHTML(YEARS7, stars, undefined, true);
    for (const y of YEARS7) {
      expect(full, y.id).toContain(`${y.age} · ${y.blurb}`);
      expect(compact, y.id).toContain(`<b>${y.title}</b><small>${y.age}</small>`);
      expect(compact, y.id).not.toContain(y.blurb);
    }
  });

  it('never says "coming soon", "placeholder" or "temporary"', () => {
    for (const compact of [false, true]) {
      const html = islandsHTML(YEARS7, stars, undefined, compact).toLowerCase();
      for (const bad of ['coming soon', 'placeholder', 'temporary']) expect(html, `${bad} (compact=${compact})`).not.toContain(bad);
    }
  });
});
