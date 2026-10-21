// The per-year pages (#2090): website/curriculum/<year>/index.html is generated from docs/content-map.json by
// scripts/site-curriculum.mjs, like /curriculum/ itself (site-curriculum.test.ts). This regenerates each in memory
// and fails on drift, holds each page's topics to the registry, and holds the words to plain ones: no curriculum
// code a parent cannot read, and every home tip the map has for the year.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOPICS, YEARS } from '../../src/curriculum';
import type { YearId } from '../../src/curriculum/types';
import { esc, gapsOf, plainObjective, renderYearPage, yearPath, yearSlug, type ContentMap } from '../../scripts/site-curriculum-lib.mjs';

const read = (p: string) => readFileSync(p, 'utf8');
const map: ContentMap = JSON.parse(read('docs/content-map.json'));
const home = read('website/index.html');
const fileOf = (id: YearId) => `website/curriculum/${yearSlug(id)}/index.html`;
const REGEN = 'run `npm run content-map` and commit website/curriculum/';
const terms = (html: string) => [...html.matchAll(/<div><dt>([^<]*)<\/dt><dd>([^<]*)<\/dd><\/div>/g)].map(m => ({ dt: m[1], dd: m[2] }));

describe('one page per school year, generated from the content map (#2090)', () => {
  it('there are exactly seven, one per year, and each equals a fresh render', () => {
    const dirs = readdirSync('website/curriculum', { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
    expect(dirs.sort()).toEqual(YEARS.map(y => yearSlug(y.id)).sort());
    expect(dirs).toHaveLength(7);
    for (const y of map.byYear) expect(read(fileOf(y.year)), `${y.year}: ${REGEN}`).toBe(renderYearPage(map, y, home));
  });
  it('lists every registry topic of its year, and no other, each once', () => {
    for (const y of YEARS) {
      const listed = terms(read(fileOf(y.id))).map(t => t.dt);
      expect(listed.sort(), y.id).toEqual(TOPICS.filter(t => t.year === y.id).map(t => esc(t.title)).sort());
    }
  });
  it('gives each its own title and description, naming the year', () => {
    const heads = map.byYear.map(y => read(fileOf(y.year)).match(/<title>([^<]+)<\/title>[\s\S]*?<meta name="description" content="([^"]+)">/)!);
    for (const [i, h] of heads.entries()) {
      expect(h[1], map.byYear[i].year).toContain(map.byYear[i].title);
      expect(h[2], map.byYear[i].year).toContain(map.byYear[i].title);
    }
    expect(new Set(heads.map(h => h[1])).size).toBe(7);
    expect(new Set(heads.map(h => h[2])).size).toBe(7);
  });
  it('carries a BreadcrumbList, Home › Curriculum › the year, ending at its own canonical URL', () => {
    for (const y of map.byYear) {
      const html = read(fileOf(y.year));
      const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
      const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)![1];
      expect(ld['@type']).toBe('BreadcrumbList');
      expect(ld.itemListElement.map((i: { name: string }) => i.name)).toEqual(['Home', 'Curriculum', y.title]);
      expect(ld.itemListElement.at(-1).item).toBe(canonical);
    }
  });
});

describe('the year pages speak plainly (#2090, the shorthand in #2123)', () => {
  it('no objective starts with a curriculum code or keeps a statutory reference', () => {
    for (const y of map.byYear) {
      for (const { dt, dd } of terms(read(fileOf(y.year)))) {
        expect(dd, `${y.year}: ${dt}`).not.toMatch(/^(?:Y\d|ELG\b|EYFS\b|Development Matters\b|E\d)/);
        expect(dd, `${y.year}: ${dt}`).not.toMatch(/\(\d+M\d|\(App(?:endix|\.)/);
        expect(dd.trim(), `${y.year}: ${dt}`).not.toBe('');
      }
    }
  });
  it('shows every home tip the map gives a topic of that year, under that topic\'s area', () => {
    for (const y of map.byYear) {
      const html = read(fileOf(y.year));
      for (const t of map.topics.filter(x => x.year === y.year && x.tip)) {
        const at = html.indexOf(`<dt>${esc(t.title)}</dt>`);
        const areaEnd = html.indexOf('<h3>', at) === -1 ? html.indexOf('</section>', at) : Math.min(html.indexOf('<h3>', at), html.indexOf('</section>', at));
        expect(html.slice(at, areaEnd), `${y.year}: ${t.title}`).toContain(`<li>${esc(t.tip!)}</li>`);
      }
    }
  });
  it('falls back to the area name only for the one objective that is nothing but a code', () => {
    const fellBack = map.topics.filter(t => !plainObjective(t.nc)).map(t => `${t.year} ${t.title}`);
    expect(fellBack, 'give a new one real words in its nc, or add it here on purpose').toEqual(['year6 Spell the missing word']);
  });
  it('plainObjective drops the code and the reference and keeps the map\'s words', () => {
    expect(plainObjective('Y3 NPV: identify, represent and estimate numbers (3M4)')).toBe('Identify, represent and estimate numbers');
    expect(plainObjective('Y6 ASMD: multi-step problems, estimating to check (6M11–13)')).toBe('Multi-step problems, estimating to check');
    expect(plainObjective('ELG Number: count objects to 10')).toBe('Count objects to 10');
    expect(plainObjective('Y1 common exception words')).toBe('Common exception words');
    expect(plainObjective('Y6 Punctuation: hyphens to avoid ambiguity (Appendix 1, Appendix 2)')).toBe('Hyphens to avoid ambiguity');
    expect(plainObjective('Y1 Spelling: contractions (I\'m, I\'ll, we\'ll)'), 'a plain bracket stays').toBe('Contractions (I\'m, I\'ll, we\'ll)');
    expect(plainObjective('E56-25 (App. 1 Y5–6)'), 'only a code left: the caller falls back').toBe('');
  });
  it('escapes what it prints: markup in a title, an objective or a tip comes out as text', () => {
    const odd = { ...map, topics: map.topics.map((t, i) => (i ? t : { ...t, title: '<b>Odd</b>', nc: 'Y1 X: <i>x</i>', tip: '<u>tip</u>' })) };
    const html = renderYearPage(odd, odd.byYear.find(y => y.year === odd.topics[0].year)!, home);
    expect(html).toContain('<dt>&lt;b&gt;Odd&lt;/b&gt;</dt><dd>&lt;i&gt;x&lt;/i&gt;</dd>');
    expect(html).toContain('<li>&lt;u&gt;tip&lt;/u&gt;</li>');
    expect(html).not.toMatch(/<[biu]>/);
  });
});

describe('the year pages agree with /curriculum/ (#2090)', () => {
  const areaOf = (id: string) => esc(map.coverage.find(c => c.id === id)!.name.replace(/^Years? [\d–-]+ /, ''));
  it('puts every topic under the curriculum area of its first strand', () => {
    for (const y of map.byYear) {
      const html = read(fileOf(y.year));
      for (const t of map.topics.filter(x => x.year === y.year)) {
        const before = html.slice(0, html.indexOf(`<dt>${esc(t.title)}</dt>`));
        const heading = [...before.matchAll(/<h3>([^<]*)<\/h3>/g)].at(-1)![1];
        expect(areaOf(t.strands[0]), `${y.year}: ${t.title}`).toBe(heading);
      }
    }
  });
  it('lists as not covered yet exactly the year\'s gaps that /curriculum/ lists', () => {
    for (const y of map.byYear) {
      const html = read(fileOf(y.year)), at = html.indexOf('<section id="not-covered"');
      const listed = [...html.slice(at, html.indexOf('</section>', at)).matchAll(/<li>([^<]*)<\/li>/g)].map(m => m[1]);
      const gaps = gapsOf(map, y).map(c => `${areaOf(c.id)} (${c.subject === 'maths' ? 'maths' : 'English'})`);
      expect(listed, y.year).toEqual(gaps);
      if (!gaps.length) expect(html.slice(at), y.year).toContain('Every part of the curriculum listed for this year has at least one topic.');
    }
    expect(gapsOf(map, map.byYear.find(y => y.year === 'year3')!).length, 'a year with gaps is among them').toBeGreaterThan(0);
  });
  it('uses only classes website/site.css defines, so it adds no look of its own', () => {
    const css = read('website/site.css');
    for (const y of map.byYear) {
      for (const [, list] of read(fileOf(y.year)).matchAll(/class="([^"]+)"/g)) {
        for (const c of list.split(/\s+/)) expect(css, `${y.year}: .${c}`).toMatch(new RegExp(`\\.${c}\\b`));
      }
    }
  });
});

describe('the year pages and /curriculum/ link to each other (#2090)', () => {
  const index = read('website/curriculum/index.html');
  it('/curriculum/ links to every year page from its year index and from the year\'s section', () => {
    const nav = index.slice(index.indexOf('<nav aria-labelledby="index-title">'), index.indexOf('</nav>', index.indexOf('index-title')));
    for (const y of map.byYear) {
      expect(existsSync(fileOf(y.year))).toBe(true);
      expect(nav, y.year).toContain(`<a href="${yearPath(y.year)}">${y.title} in plain words</a>`);
      const at = index.indexOf(`<section id="${yearSlug(y.year)}"`);
      expect(index.slice(at, index.indexOf('</section>', at)), y.year).toContain(`<a href="${yearPath(y.year)}">`);
    }
  });
  it('each year page links back to /curriculum/, to the game and to every other year', () => {
    for (const y of map.byYear) {
      const html = read(fileOf(y.year)), main = html.slice(html.indexOf('<main'));
      expect(main, y.year).toContain('<a href="/curriculum/">');
      expect(main, y.year).toContain('href="/play/"');
      for (const o of map.byYear.filter(o => o.year !== y.year)) expect(main, `${y.year} → ${o.year}`).toContain(`<a href="${yearPath(o.year)}">${o.title}</a>`);
      expect(main, `${y.year} does not link to itself`).not.toContain(`<a href="${yearPath(y.year)}">`);
    }
  });
});
