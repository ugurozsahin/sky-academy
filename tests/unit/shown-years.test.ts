import { describe, it, expect, beforeEach } from 'vitest';
import { isKs2, meetsShowGate, previewAllYears, shownYears, SHOWN_YEARS_KEY, YEARS, type YearInfo } from '../../src/curriculum';
import { islandArt } from '../../src/ui/island-placeholder';

// minimal localStorage shim for node — same shape tests/unit/storage.test.ts and three.test.ts use
const mem: Record<string, string> = {};
const installShim = () => { (globalThis as any).localStorage = {
  getItem: (k: string) => mem[k] ?? null,
  setItem: (k: string, v: string) => { mem[k] = v; },
  removeItem: (k: string) => { delete mem[k]; },
  clear: () => { for (const k in mem) delete mem[k]; },
}; };
installShim();

describe('isKs2 (#1032)', () => {
  it.each(['reception', 'year1', 'year2'] as const)('%s is not KS2', y => expect(isKs2(y)).toBe(false));

  // pr-test-analyzer review: only the false branch was covered above, which a broken negation
  // (`EYFS_KS1.has(y)` for `!EYFS_KS1.has(y)`) would still pass unnoticed.
  it('year3 (#1050, the first real KS2 id) is KS2', () => expect(isKs2('year3')).toBe(true));
});

describe('meetsShowGate: KS2 needs 12 maths + 6 writing, EYFS/KS1 keeps 6 + 3 (#1032)', () => {
  it('a KS2 year one topic short of either minimum is hidden', () => {
    expect(meetsShowGate(true, 11, 6)).toBe(false);
    expect(meetsShowGate(true, 12, 5)).toBe(false);
  });
  it('a KS2 year at exactly the gate is shown', () => {
    expect(meetsShowGate(true, 12, 6)).toBe(true);
  });
  it('an EYFS/KS1 year at today’s minimum (6 maths, 3 writing) is shown', () => {
    expect(meetsShowGate(false, 6, 3)).toBe(true);
  });
  it('an EYFS/KS1 year below its own minimum is hidden', () => {
    expect(meetsShowGate(false, 5, 3)).toBe(false);
    expect(meetsShowGate(false, 6, 2)).toBe(false);
  });
});

describe('previewAllYears: the sna:years device key (#1032)', () => {
  beforeEach(() => localStorage.clear());

  it('reads false with no store at all', () => {
    delete (globalThis as any).localStorage;
    try {
      expect(previewAllYears()).toBe(false);
    } finally {
      installShim();
    }
  });

  it('reads false with no key set', () => {
    expect(previewAllYears()).toBe(false);
  });

  it('reads true only when the key is exactly "all"', () => {
    localStorage.setItem(SHOWN_YEARS_KEY, 'all');
    expect(previewAllYears()).toBe(true);
  });

  it('reads false for any other value', () => {
    localStorage.setItem(SHOWN_YEARS_KEY, 'true');
    expect(previewAllYears()).toBe(false);
  });

  it('reads false rather than throwing when the store itself throws', () => {
    const real = localStorage.getItem;
    (localStorage as any).getItem = () => { throw new Error('blocked'); };
    expect(previewAllYears()).toBe(false);
    (localStorage as any).getItem = real;
  });
});

describe('shownYears (#1032)', () => {
  beforeEach(() => localStorage.clear());

  it('shows every row, year3, year4 and year5 included once each reaches 12 maths + 6 writing (#1050, #1109, #1164, #1224)', () => {
    expect(shownYears().map(y => y.id)).toEqual(['reception', 'year1', 'year2', 'year3', 'year4', 'year5']);
  });

  it('the preview key shows every row, including any gated row', () => {
    localStorage.setItem(SHOWN_YEARS_KEY, 'all');
    expect(shownYears()).toEqual(YEARS);
  });
});

describe('islandArt (#1032)', () => {
  const fixture = (over: Partial<YearInfo>): YearInfo => ({
    id: 'reception', title: 'Reception', short: 'R', age: 'Ages 4–5', blurb: 'blurb',
    tint: '#66c25a55', maxAnswer: 30, perStage: 5, lives: 4, gentle: true,
    speeds: [0, 0, 0, 1, 1], diffs: [1, 1, 2, 2, 3], sprintStars: { threeStar: 8, twoStar: 4 },
    ...over,
  });

  it('returns the real art unchanged when the year has one', () => {
    const y = fixture({ art: 'data:image/svg+xml,%3Csvg/%3E' });
    expect(islandArt(y)).toBe(y.art);
  });

  it('draws a distinct placeholder per year when art is unset', () => {
    const a = islandArt(fixture({ short: 'Y3', tint: '#7a5ad655' }));
    const b = islandArt(fixture({ short: 'Y4', tint: '#3ec9ff55' }));
    expect(a).not.toBe(b);
    expect(a).toContain('data:image/svg+xml,');
  });

  it('carries the year’s short label in the drawn SVG', () => {
    const svg = decodeURIComponent(islandArt(fixture({ short: 'Y5' })));
    expect(svg).toContain('Y5');
  });

  it('every colour in the placeholder is a design-language token or the row’s own tint', () => {
    const y = fixture({ tint: '#7a5ad655' });
    const svg = decodeURIComponent(islandArt(y));
    const hexes = [...svg.matchAll(/#[0-9a-fA-F]{6,8}/g)].map(m => m[0]);
    expect(hexes.length).toBeGreaterThan(0);
    const opaqueTint = y.tint.slice(0, 7);
    const allowed = new Set(['#0d1226', '#f4f6ff', opaqueTint]);
    for (const hex of hexes) expect(allowed, hex).toContain(hex);
  });

  it('the label renders at ≥13px even at the 96×64 island-header scale (viewBox 120 wide, font-size ≥17)', () => {
    const svg = decodeURIComponent(islandArt(fixture({})));
    const [, size] = svg.match(/font-size='(\d+)'/) ?? [];
    expect(Number(size)).toBeGreaterThanOrEqual(17);
    expect(Number(size) * (96 / 120)).toBeGreaterThanOrEqual(13);
  });

  // pr-test-analyzer review: every other fixture's 9-char #rrggbbaa tint always takes the `.slice(0, 7)`
  // branch — this is the only one that exercises the already-opaque (7-char) fallback.
  it('an already-opaque 7-char tint is used as-is, not sliced short', () => {
    const svg = decodeURIComponent(islandArt(fixture({ tint: '#7a5ad6' })));
    expect(svg).toContain('#7a5ad6');
  });
});
