import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { COMPACT_VARS, islandsHTML, mapCols, mapLayout } from '../../src/ui/map-layout';
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

  it('carries the star bar (percentage math), the star count, the CTA and the art background for every island', () => {
    const html = islandsHTML(YEARS7, () => ({ s: 1, m: 4 }), undefined, false);
    for (const y of YEARS7) {
      expect(html, y.id).toContain(`data-year="${y.id}"`);
    }
    expect(html.match(/class="isl-bar"/g)).toHaveLength(YEARS7.length);
    expect(html.match(/style="width:25%"/g), '1/4 must round to a 25% bar').toHaveLength(YEARS7.length);
    expect(html.match(/class="isl-stars">★ 1\/4</g)).toHaveLength(YEARS7.length);
    expect(html.match(/class="isl-go">Go →</g)).toHaveLength(YEARS7.length);
    expect(html.match(/class="isl-art"[^>]*background-image:url/g)).toHaveLength(YEARS7.length);
  });
});

/**
 * #1048 pr-test-analyzer review: the e2e tests inject a compact style string of their own rather than
 * exercising `mapScreen` (which #399 requires to write these four properties as a literal `style="…"`
 * attribute — see the comment above that attribute in `home.ts` — so nothing else pins them against a typo
 * there). This reads `home.ts`'s own source text and checks the literal compact suffix is exactly what
 * `mapLayout`'s doc comment, and every test above, assumes it to be — the same static-source-pinning method
 * `guardrails.test.ts`'s `#399` rail itself already uses for the very same class of property.
 */
describe('home.ts writes the exact compact custom properties this module documents (#1048, #399)', () => {
  const src = readFileSync(new URL('../../src/ui/home.ts', import.meta.url), 'utf8');

  it('the literal ternary branch matches map-layout.ts\'s COMPACT_VARS', () => {
    expect(src).toContain(`${COMPACT_VARS}' : ''`);
  });

  it('the container style attribute reads layout.cols and layout.compact, not a hand-typed island count', () => {
    expect(src).toContain('style="--cols:${layout.cols}${layout.compact ?');
  });
});
