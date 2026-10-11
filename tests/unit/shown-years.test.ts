import { describe, it, expect, beforeEach } from 'vitest';
import { isKs2, meetsShowGate, previewAllYears, shownYears, SHOWN_YEARS_KEY, YEARS, type YearInfo } from '../../src/curriculum';
import { escapeXml, islandArt } from '../../src/ui/island-placeholder';

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

  it('shows every row, year3 to year6 included once each reaches 12 maths + 6 writing (#1050, #1109, #1164, #1224, #1279)', () => {
    expect(shownYears().map(y => y.id)).toEqual(['reception', 'year1', 'year2', 'year3', 'year4', 'year5', 'year6']);
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

// #1327: `svg()` prints `YearInfo.short` inside `<text>` and the tint inside a `fill='…'`. `encodeURIComponent`
// of the whole string makes a valid URI, never valid XML, so a `short` of `R&D` would render the island tile
// blank with nothing failing loudly. Two halves, both pinned here — in this sibling file rather than beside
// the tint rail in `curriculum.test.ts`, which `fileLines` freezes at its length (#1388).
describe('islandArt escapes its two interpolations (#1327)', () => {
  const fixture = (over: Partial<YearInfo>): YearInfo => ({
    id: 'year3', title: 'Year 3', short: 'Y3', age: 'Ages 7–8', blurb: 'blurb',
    tint: '#ffb02055', maxAnswer: 2000, perStage: 7, lives: 3, gentle: false,
    speeds: [1, 2, 3, 3, 3], diffs: [1, 2, 2, 3, 3], sprintStars: { threeStar: 12, twoStar: 6 },
    ...over,
  });
  const decoded = (y: YearInfo) => decodeURIComponent(islandArt(y).replace(/^data:image\/svg\+xml,/, ''));
  // A cheap well-formedness check, since the unit environment has no XML parser: every `&` opens one of the
  // five predefined entities, and every `<` opens one of the six tags the template writes — nothing else.
  const wellFormed = (svg: string) => {
    expect(svg.match(/&/g)?.length ?? 0).toBe(svg.match(/&(amp|lt|gt|apos|quot);/g)?.length ?? 0);
    expect(svg.match(/</g)?.length).toBe(6);
    expect(svg.match(/<(svg|rect|ellipse|text|\/text|\/svg)[ >]/g)?.length).toBe(6);
  };

  // guard rail — the data-source half: fail where the row is written, as the tint rail does. The set is what
  // every row uses today (`R`, `Y1`–`Y6`); a future value outside it needs this line widened on purpose.
  it('every YEARS row’s short is 1–4 of [A-Za-z0-9], so escapeXml() is the identity on every real row', () => {
    for (const y of YEARS) expect(y.short, y.id).toMatch(/^[A-Za-z0-9]{1,4}$/);
  });

  it('escapeXml() rewrites the five XML-significant characters and nothing else', () => {
    expect(escapeXml(`R&D <'Y3'> "a"`)).toBe('R&amp;D &lt;&apos;Y3&apos;&gt; &quot;a&quot;');
    expect(escapeXml('R Y1 Y6 #ffb020 0123456789')).toBe('R Y1 Y6 #ffb020 0123456789');
    expect(escapeXml('')).toBe('');
  });

  // the belt-and-braces half: a value the rail above would refuse still yields a well-formed SVG
  it('a short containing &, <, > and quotes yields a well-formed SVG with the characters as entities', () => {
    const svg = decoded(fixture({ short: `R&D<'x">` }));
    wellFormed(svg);
    expect(svg).toContain(`>R&amp;D&lt;&apos;x&quot;&gt;</text>`);
  });

  it('a tint containing an apostrophe cannot close the fill attribute early', () => {
    const svg = decoded(fixture({ tint: `#ab'cd` }));   // 6 chars: skips the alpha-byte slice, reaches fill raw
    wellFormed(svg);
    expect(svg).toContain(`fill='#ab&apos;cd'/>`);
    expect(svg).not.toContain(`fill='#ab'cd'`);
  });

  // not a new look: for every real row the output is what main produced before the escape existed
  it('is byte-identical to the pre-#1327 output for every real YEARS row without art', () => {
    const y3 = YEARS.find(y => y.id === 'year3')!;
    expect(y3.art).toBeUndefined();   // the literal below is the placeholder; if Y3 art lands, move this pin to the next art-less row
    expect(islandArt(y3)).toBe("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%20120%2070'%3E%3Crect%20width%3D'120'%20height%3D'70'%20fill%3D'%230d1226'%2F%3E%3Cellipse%20cx%3D'60'%20cy%3D'40'%20rx%3D'46'%20ry%3D'22'%20fill%3D'%23ffb020'%2F%3E%3Ctext%20x%3D'60'%20y%3D'40'%20text-anchor%3D'middle'%20dominant-baseline%3D'central'%20font-family%3D'sans-serif'%20font-weight%3D'700'%20font-size%3D'24'%20fill%3D'%23f4f6ff'%3EY3%3C%2Ftext%3E%3C%2Fsvg%3E");
    for (const y of YEARS.filter(y => !y.art)) {
      const svg = decoded(y);
      wellFormed(svg);
      expect(svg, y.id).not.toContain('&');                        // escaping was the identity on this row
      expect(svg, y.id).toContain(`>${y.short}</text>`);
      expect(svg, y.id).toContain(`fill='${y.tint.slice(0, 7)}'/>`);
    }
  });
});
