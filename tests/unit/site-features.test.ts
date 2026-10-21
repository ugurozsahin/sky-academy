import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { featureProblems, renderFeaturesPage, type FeaturesData } from '../../scripts/site-features.mjs';
import { shownYears } from '../../src/curriculum';
import { aboutLines } from '../../src/ui/about';

/**
 * #2101: the /features/ page lists what Sharpwise does today and what is planned, and every line is traced:
 * a `today` entry names the module or test that shows it, a `later` entry the open issue that tracks it. The
 * page is generated from docs/site/features.json and committed, so it is held equal to a fresh render here.
 *
 * Prove it red: point a `source` at a missing file; make an `issue` a string; put "soon" or "March" in a blurb;
 * edit website/features/index.html by hand; change the shell's header in website/index.html.
 */
const root = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');
const isFile = (p: string) => { try { return statSync(new URL(p, root)).isFile(); } catch { return false; } };
const data: FeaturesData = JSON.parse(read('docs/site/features.json'));
const page = read('website/features/index.html');
/** Whether `css` defines the class `c` by its whole name; the suffix of a `url()` address is not a class. */
const defines = (css: string, c: string) => new RegExp(`\\.${c}(?![\\w-])`).test(css.replace(/url\([^)]*\)/g, ''));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');

describe('docs/site/features.json (#2101)', () => {
  it('has both lists, and breaks none of its rules', () => {
    expect(data.today.length).toBeGreaterThan(10);
    expect(data.later.length).toBeGreaterThan(2);
    expect(featureProblems(data, isFile)).toEqual([]);
  });

  it('every today.source is a module or test that exists, and every later.issue is a number', () => {
    for (const e of data.today) expect(isFile(e.source), `${e.title}: ${e.source}`).toBe(true);
    for (const e of data.later) expect(Number.isInteger(e.issue), `${e.title}: ${e.issue}`).toBe(true);
  });

  it('the rules catch each broken entry they exist for', () => {
    const ok = { today: [{ title: 'T', blurb: 'B.', source: 'src/main.ts' }], later: [{ title: 'L', blurb: 'B.', issue: 54 }] };
    expect(featureProblems(ok, isFile)).toEqual([]);
    const bad = (patch: { today?: object[]; later?: object[] }) => featureProblems({ ...ok, ...patch }, isFile);
    expect(bad({ today: [{ title: 'T', blurb: 'B.', source: 'src/missing.ts' }] }), 'a missing file').toHaveLength(1);
    expect(bad({ today: [{ title: 'T', blurb: 'B.', source: 'src' }] }), 'a directory').toHaveLength(1);
    expect(bad({ today: [{ title: 'T', blurb: 'B.', source: 'package.json' }] }), 'not a module or test').toHaveLength(1);
    expect(bad({ today: [{ title: 'T', blurb: 'B.', source: 'src/../package.json' }] }), 'out of src').toHaveLength(1);
    expect(bad({ today: [{ title: 'T', blurb: 'B.' }] }), 'no source').toHaveLength(1);
    expect(bad({ later: [{ title: 'L', blurb: 'B.', issue: '54' }] }), 'an issue as text').toHaveLength(1);
    expect(bad({ later: [{ title: 'L', blurb: 'B.', issue: 0 }] }), 'issue 0').toHaveLength(1);
    expect(bad({ later: [{ title: 'L', blurb: 'B.' }] }), 'no issue').toHaveLength(1);
    expect(bad({ later: [{ title: '', blurb: 'B.', issue: 54 }] }), 'no title').toHaveLength(1);
    expect(bad({ later: [] }), 'an empty list').toHaveLength(1);
    for (const words of ['Ready soon.', 'Out in 2027.', 'From March.', 'In May.', 'On the 3rd.', 'On 12/4.', 'It will be available here.', 'It will  be\navailable.', 'SOON', 'By september.', 'In JUNE.', 'From Sept.', 'From jan.', 'Out in MAY.', 'Coming SEPT.', 'In MARCH.']) {
      expect(bad({ later: [{ title: 'L', blurb: words, issue: 54 }] }), words).toHaveLength(1);
    }
    for (const words of ['Year 3–4 lists.', '25 questions, 6 seconds each.', 'Children may play.', 'Ninjas march on.', 'Year 6 practice.']) {
      expect(bad({ later: [{ title: 'L', blurb: words, issue: 54 }] }), words).toEqual([]);
    }
  });

  it('no line of the page itself names a date or a promise of timing', () => {
    const main = page.slice(page.indexOf('<main'), page.indexOf('</main>'));
    const lines = text(main).split(/\s{2,}/).filter(Boolean).map(l => ({ title: 'page', blurb: l, issue: 1 }));
    expect(lines.length).toBeGreaterThan(data.today.length);
    expect(featureProblems({ today: data.today, later: lines }, isFile)).toEqual([]);
  });

  it('the title and descriptions of the page name no date or promise of timing either', () => {
    const metas = [...page.matchAll(/<meta (?:name|property)="(?:description|og:title|og:description|twitter:title|twitter:description)" content="([^"]+)"/g)].map(m => text(m[1]));
    const lines = [text(page.match(/<title>([^<]+)<\/title>/)![1]), ...metas].map(l => ({ title: 'page', blurb: l, issue: 1 }));
    expect(lines.length).toBeGreaterThan(1);
    expect(featureProblems({ today: data.today, later: lines }, isFile)).toEqual([]);
    expect(featureProblems({ today: data.today, later: [{ title: 'page', blurb: 'Sharpwise features, coming 2027', issue: 1 }] }, isFile)).toHaveLength(1);
  });

  it('the claims read from the game itself say what the game says', () => {
    const years = shownYears();
    const span = data.today.find(e => e.source === 'src/curriculum/index.ts');
    expect(span?.blurb).toContain(`from ${years[0].title} to ${years[years.length - 1].title}`);
    expect(span?.blurb.startsWith(`${['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'][years.length]} islands`), 'the island count').toBe(true);
    const about = aboutLines();
    expect(about).toContain('No adverts.');
    expect(about.some(l => l.startsWith('No tracking — no analytics'))).toBe(true);
    expect(about.some(l => l.startsWith('No account'))).toBe(true);
    expect(data.today.find(e => e.source === 'src/ui/about.ts')?.blurb).toBe('No adverts, no analytics and no account: progress is kept on the device.');
    expect(about).toContain('Tables Check practice with the same timing as the Year 4 check: 25 questions, 6 seconds each.');
    expect(about).toContain('Every word on the statutory Year 3–4 and Year 5–6 spelling lists.');
  });
});

describe('website/features/index.html (#2101)', () => {
  it('equals a fresh render of the data on the current shell: run node scripts/site-features.mjs', () => {
    expect(page).toBe(renderFeaturesPage(data, read('website/index.html')));
  });

  it('shows every entry, in order, and is no longer the placeholder', () => {
    const shown = [...page.matchAll(/<dt>([^<]+)<\/dt><dd>([^<]+)<\/dd>/g)].map(m => text(m[1]));
    expect(shown).toEqual([...data.today, ...data.later].map(e => e.title));
    expect(page).not.toContain('noindex');
    expect(page).toContain('<link rel="canonical" href="https://sharpwise.co.uk/features/">');
    expect(page).toContain('<h2 id="later-title">Coming later</h2>');
  });

  it('a change to the shell changes the render, so a stale page cannot pass', () => {
    const home = read('website/index.html');
    expect(renderFeaturesPage(data, home.replace('>About<', '>About us<'))).not.toBe(page);
    expect(() => renderFeaturesPage(data, home.replace('</header>', ''))).toThrow();
    expect(() => renderFeaturesPage(data, home.replace('<a href="/features/">', '<a class="x" href="/features/">'))).toThrow(/features/);
    expect(page).toContain('<li><a href="/features/" aria-current="page">Features</a></li>');
  });

  it('matches a class by its whole name, and ignores the suffixes of url() addresses', () => {
    expect(defines('.site-header { }', 'site')).toBe(false);
    expect(defines('.site { }', 'site')).toBe(true);
    expect(defines('.site, .x { }', 'site')).toBe(true);
    expect(defines('@font-face { src: url(/fonts/a.woff2) }', 'woff2')).toBe(false);
  });

  it('uses only classes website/site.css defines', () => {
    const css = read('website/site.css');
    const used = new Set([...page.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)));
    for (const c of used) expect(defines(css, c), c).toBe(true);
  });
});
