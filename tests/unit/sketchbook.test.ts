/**
 * #715: the sketchbook's own logic — the catalogue, the placeholder against the object contract, the palette
 * it lights the stage with, the gallery builder, and the service worker's blindness to it. The page itself is
 * exercised by `tests/sketch/shot.spec.ts` (the `sketchbook` Playwright project); this is what runs in Node.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { listFiles, precacheList } from '../../scripts/build-sw.mjs';
import { frames, galleryHtml } from '../../scripts/sketch-gallery.mjs';
import { BUDGET_CEILING, defaultsOf } from '../../src/three/objects';
import { createStage, measure } from '../../src/three/stage';
import { avatarSrc, CATALOGUE, DEFAULT_VARIANT, find, paramsFor, variantsOf } from '../../src/three/sketchbook/catalogue';
import { placeholder } from '../../src/three/sketchbook/placeholder';
import { TIER_LABEL } from '../../src/three/sketchbook/controls';

const root = new URL('../../', import.meta.url);
const tokens = (name: string) => ({ '--ink': '#0d1226', '--accent-2': '#3ec9ff' } as Record<string, string>)[name] ?? '';

describe('catalogue', () => {
  it('leads with the placeholder, so a fresh checkout shows the stage with no object approved yet', () => {
    expect(CATALOGUE[0]).toBe(placeholder);
    expect(find('placeholder')).toBe(placeholder);
    expect(find('no-such-object'), 'a stale bookmark still shows something').toBe(CATALOGUE[0]);
    expect(find(null)).toBe(CATALOGUE[0]);
  });
  it('lists default before the named variants, and hands back a full parameter set for each', () => {
    expect(variantsOf(placeholder)).toEqual([DEFAULT_VARIANT, 'sharp', 'pebble']);
    expect(paramsFor(placeholder, DEFAULT_VARIANT)).toEqual(defaultsOf(placeholder.params));
    expect(paramsFor(placeholder, 'pebble')).toEqual(placeholder.variants.pebble);
    expect(paramsFor(placeholder, 'pebble'), 'a copy, never the spec\'s own object — the sliders mutate it').not.toBe(placeholder.variants.pebble);
    expect(paramsFor(placeholder, 'nope')).toEqual(defaultsOf(placeholder.params));
  });
  it('finds an avatar\'s art by the roster\'s convention', () => {
    expect(avatarSrc('kai')).toBe('/avatars/kai.webp');
    expect(readFileSync(new URL('src/avatars.ts', root), 'utf8')).toContain("img: 'avatars/kai.webp'");
  });
});

describe('the placeholder honours the object contract it exists to exercise', () => {
  it('builds under its budget on both tiers, for the defaults and every variant, with one hull', () => {
    for (const tier of ['low', 'high'] as const)
      for (const variant of variantsOf(placeholder)) {
        const m = measure(placeholder.build(paramsFor(placeholder, variant), createStage(tier, tokens)));
        expect(m.drawCalls, `${variant}/${tier}: the tile and its hull`).toBe(2);
        expect(m.triangles, `${variant}/${tier}`).toBeLessThanOrEqual(placeholder.budget.triangles);
        expect(m.triangles).toBeGreaterThan(0);
      }
    expect(placeholder.budget.triangles).toBeLessThanOrEqual(BUDGET_CEILING.triangles);
  });
  it('keeps every variant value inside its parameter\'s range', () => {
    for (const [name, v] of Object.entries(placeholder.variants))
      for (const [k, x] of Object.entries(v)) { const p = (placeholder.params as Record<string, { min: number; max: number }>)[k]; expect(x >= p.min && x <= p.max, `${name}.${k}`).toBe(true); }
  });
});

describe('the sketchbook lights the stage with the game\'s own palette', () => {
  const tokensOf = (css: string) => Object.fromEntries([...(/:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
  it('sketchbook.css declares the same :root colour tokens as src/style.css, value for value', () => {
    const game = tokensOf(readFileSync(new URL('src/style.css', root), 'utf8'));
    const sketch = tokensOf(readFileSync(new URL('src/three/sketchbook/sketchbook.css', root), 'utf8'));
    expect(Object.keys(sketch).length, 'the sketchbook must declare tokens at all').toBeGreaterThan(5);
    for (const [name, value] of Object.entries(sketch)) expect({ name, value }, `${name} drifted from src/style.css`).toEqual({ name, value: game[name] });
  });
});

describe('the gallery builder', () => {
  it('groups <variant>-<tier>.png by variant and inlines every frame', () => {
    const rows = frames('x', () => ['default-high.png', 'default-low.png', 'notes.txt', 'pebble-low.png', 'gallery.html']);
    expect([...rows], 'paths under the folder, so the CLI can read them from anywhere').toEqual([['default', { high: 'x/default-high.png', low: 'x/default-low.png' }], ['pebble', { low: 'x/pebble-low.png' }]]);
    const html = galleryHtml({ object: 'tile <1>', rows, avatar: 'kai.webp', read: (f: string, t: string) => `${t}:${f}` });
    expect(html).toContain('tile &lt;1&gt;');
    expect(html).toContain('src="image/png:x/default-high.png"');
    for (const label of Object.values(TIER_LABEL)) expect(html, 'the gallery names the tiers the way the panel does').toContain(label);
    expect(html).toContain('src="image/webp:kai.webp"');
    expect(html, 'a missing tier is a dash, not a broken image').toContain('<span class="none">—</span>');
  });
});

describe('the game never carries the sketchbook', () => {
  it('the service worker precaches nothing under dist/sketchbook/, and still everything else', () => {
    const files = ['index.html', 'assets/index-abc.js', 'sketchbook/sketchbook.html', 'sketchbook/assets/sketchbook-def.js', 'sw.js'];
    expect(precacheList(files)).toEqual(['assets/index-abc.js', 'index.html']);
  });
  it('listFiles walks nested folders, so the exclusion has something to exclude', () => {
    const tree: Record<string, { name: string; isDirectory(): boolean }[]> = {
      'd': [{ name: 'index.html', isDirectory: () => false }, { name: 'sketchbook', isDirectory: () => true }],
      'd/sketchbook': [{ name: 'sketchbook.html', isDirectory: () => false }],
    };
    expect(listFiles('d', ((p: string) => tree[p]) as never)).toEqual(['index.html', 'sketchbook/sketchbook.html']);
  });
});
