// The per-year pages (#2090): website/curriculum/<year>/index.html is generated from docs/content-map.json by
// scripts/site-curriculum.mjs, like /curriculum/ itself (site-curriculum.test.ts). This regenerates each in memory
// and fails on drift, holds each page's topics to the registry, and holds the words to plain ones: no curriculum
// code a parent cannot read, and every home tip the map has for the year. Since #2160 each page also carries its
// year's tables and gaps in a collapsed teachers' section, and a year switcher: the last two describes hold those.
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
/** The details element in the teachers' section (#2160), never the header's menu (#2159); '' when there is none. */
const teachers = (html: string) => {
  const at = html.indexOf('<details>', html.indexOf('<section id="for-teachers"')), end = html.indexOf('</details>', at);
  return at < 0 || end < 0 ? '' : html.slice(at, end);
};
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
        expect(dd, `${y.year}: ${dt}`).not.toMatch(/\d+M\d|\bApp(?:endix|\.)/);
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
        const area = html.slice(at, areaEnd);
        expect(area, `${y.year}: ${t.title}`).toContain(`<li>${esc(t.tip!)}</li>`);
        expect(area.split(`<li>${esc(t.tip!)}</li>`), `${y.year}: ${t.title}: a tip shows once per area`).toHaveLength(2);
      }
    }
  });
  it('falls back to the area name only for the one objective that is nothing but a code', () => {
    const fellBack = map.topics.filter(t => !plainObjective(t.nc)).map(t => `${t.year} ${t.title}`);
    expect(fellBack, 'give a new one real words in its nc, or add it here on purpose').toEqual(['year6 Spell the missing word']);
    const y6 = read(fileOf('year6'));
    expect(y6, 'it shows its area\'s name').toContain('<div><dt>Spell the missing word</dt><dd>Writing: transcription (spelling)</dd></div>');
  });
  it('keeps a spelling pattern that opens an objective in lower case, and only those (#2140 review)', () => {
    const lower = map.topics.map(t => plainObjective(t.nc)).filter(p => /^[a-z]/.test(p));
    expect(lower, 'every objective the map opens with a letter pattern, driven from the shipped map').toEqual([
      'ff, ll, ss, zz, ck; n before k; -tch; -ve',
      'ai/ay, oi/oy, -y endings, k before e/i/y, ph, wh',
      'a before l, o for /ʌ/, -ey, a after w and qu, or and ar after w, s for /ʒ/',
      'a or an according to whether the next word begins with a consonant or a vowel',
      'ch (Greek/French), -gue/-que, sc, ei/eigh/ey',
      'ough; ei after c',
    ]);
    expect(plainObjective('Y4 M&D: up to 4 digits × 1 or 2 digits'), 'a two-letter word is a word').toBe('Up to 4 digits × 1 or 2 digits');
    expect(plainObjective('Y3 Grammar: co-ordination (and, or, but)')).toBe('Co-ordination (and, or, but)');
    expect(plainObjective('Y1 Measurement: mass/weight')).toBe('Mass/weight');
  });
  it('plainObjective drops the code and the reference and keeps the map\'s words', () => {
    expect(plainObjective('Y3 NPV: identify, represent and estimate numbers (3M4)')).toBe('Identify, represent and estimate numbers');
    expect(plainObjective('Y6 ASMD: multi-step problems, estimating to check (6M11–13)')).toBe('Multi-step problems, estimating to check');
    expect(plainObjective('ELG Number: count objects to 10')).toBe('Count objects to 10');
    expect(plainObjective('Y1 common exception words')).toBe('Common exception words');
    expect(plainObjective('Y6 Punctuation: hyphens to avoid ambiguity (Appendix 1, Appendix 2)')).toBe('Hyphens to avoid ambiguity');
    expect(plainObjective('Y1 Spelling: contractions (I\'m, I\'ll, we\'ll)'), 'a plain bracket stays').toBe('Contractions (I\'m, I\'ll, we\'ll)');
    expect(plainObjective('E56-25 (App. 1 Y5–6)'), 'only a code left: the caller falls back').toBe('');
    expect(plainObjective('Y3–4 Spelling: words often misspelt, Appendix 1 words 1–50'), 'a bare reference goes too').toBe('Words often misspelt, words 1–50');
    expect(plainObjective('ELG Number: count to 10: then back'), 'only the code before the first colon goes').toBe('Count to 10: then back');
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
  it('lists as not covered yet, inside the teachers\' section, exactly the year\'s gaps (#2160)', () => {
    for (const y of map.byYear) {
      const detail = teachers(read(fileOf(y.year))), at = detail.indexOf('<h2 id="not-covered-title">');
      expect(at, `${y.year}: the gaps sit inside the details`).toBeGreaterThan(-1);
      const listed = [...detail.slice(at).matchAll(/<li>([^<]*)<\/li>/g)].map(m => m[1]);
      // Worked out here from the map, not with the generator's own gapsOf: a strand of this year no topic of this year names.
      const named = new Set(map.topics.filter(t => t.year === y.year).flatMap(t => t.strands));
      const expected = map.coverage.filter(c => c.years.includes(y.year) && !named.has(c.id)).map(c => `${areaOf(c.id)} (${c.subject === 'maths' ? 'maths' : 'English'})`);
      expect(listed, y.year).toEqual(expected);
      expect(gapsOf(map, y).map(c => c.id), `${y.year}: the generator agrees`).toEqual(map.coverage.filter(c => c.years.includes(y.year) && !named.has(c.id)).map(c => c.id));
      if (!expected.length) expect(detail.slice(at), y.year).toContain('Every part of the curriculum listed for this year has at least one topic.');
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
  it('/curriculum/ links to every year page from its year cards (#2161)', () => {
    const list = index.slice(index.indexOf('<ul class="years">'), index.indexOf('</ul>', index.indexOf('<ul class="years">')));
    for (const y of map.byYear) {
      expect(existsSync(fileOf(y.year))).toBe(true);
      expect(list, y.year).toContain(`<h3><a href="${yearPath(y.year)}">${y.title}</a></h3>`);
    }
  });
  it('each year page links back to /curriculum/, to the game and to every other year', () => {
    for (const y of map.byYear) {
      const html = read(fileOf(y.year)), main = html.slice(html.indexOf('<main'));
      expect(main, y.year).toContain('<a href="/curriculum/">');
      expect(main, y.year).toContain('href="/play/"');
      for (const o of map.byYear.filter(o => o.year !== y.year)) expect(main, `${y.year} → ${o.year}`).toContain(`<a href="${yearPath(o.year)}">${o.title}</a>`);
      expect(main, `${y.year} links to itself only as the current page`).not.toContain(`<a href="${yearPath(y.year)}">`);
    }
  });
});

describe('the year pages carry the teachers\' detail, collapsed (#2160)', () => {
  const rows = (html: string) => [...html.matchAll(/<tr><th scope="row">([^<]*)<\/th><td>([^<]*)<\/td><\/tr>/g)].map(m => [m[1], m[2]]);
  it('puts it in one closed details, below the plain-words lists, with the summary the issue names', () => {
    for (const y of map.byYear) {
      const html = read(fileOf(y.year));
      const main = html.match(/<main\b[\s\S]*<\/main>/)![0];   // the header's Curriculum menu is a details too (#2159)
      expect(main.match(/<details\b[^>]*>/g), y.year).toEqual(['<details>']);
      expect(html, y.year).toContain('<details>\n          <summary>For teachers: National Curriculum references and gaps</summary>');
      const open = html.indexOf('<details>');
      for (const [id, n] of [['maths', y.maths], ['english', y.writing]] as const) {
        const at = html.indexOf(`<section id="${id}"`);
        expect(at > -1, `${y.year}: a ${id} section when the year has ${id} topics`).toBe(n > 0);
        if (n) expect(html.indexOf('</section>', at), `${y.year}: ${id} comes first`).toBeLessThan(open);
      }
      expect(rows(html).length, `${y.year}: every table row is inside the details`).toBe(rows(teachers(html)).length);
    }
  });
  it('no row is lost or doubled: the (year, topic, objective) rows across the seven pages are the content map\'s', () => {
    const onPages = map.byYear.flatMap(y => rows(teachers(read(fileOf(y.year)))).map(([title, nc]) => `${y.year} | ${title} | ${nc}`));
    const inMap = map.topics.map(t => `${t.year} | ${esc(t.title)} | ${esc(t.nc)}`);
    expect(new Set(onPages).size, 'no row twice').toBe(onPages.length);
    expect(onPages.sort()).toEqual(inMap.sort());
    expect(onPages, 'and the registry has as many topics').toHaveLength(TOPICS.length);
    expect(onPages, 'escaped once, read against a known row rather than esc()').toContain('year3 | Mental Adding and Subtracting | Y3 A&amp;S: 3-digit number and 1s, 10s, 100s mentally (3M7)');
  });
  it('gives each table a caption first, column headers, and a row header on every data row', () => {
    for (const y of map.byYear) {
      const tables = [...teachers(read(fileOf(y.year))).matchAll(/<table>([\s\S]*?)<\/table>/g)].map(m => m[1]);
      expect(tables.length, y.year).toBe((y.maths ? 1 : 0) + (y.writing ? 1 : 0));
      for (const t of tables) {
        expect(t.trimStart().startsWith('<caption>'), `${y.year}: caption first`).toBe(true);
        expect(t).toContain('<thead><tr><th scope="col">Topic</th><th scope="col">Curriculum objective</th></tr></thead>');
        for (const [row] of t.matchAll(/<tr>(?!<th scope="(?:col|rowgroup)")[\s\S]*?<\/tr>/g)) expect(row).toMatch(/^<tr><th scope="row">/);
      }
    }
  });
});

describe('every year page has a year switcher (#2160)', () => {
  const switcherOf = (html: string) => {
    const navs = html.match(/<nav class="switcher" aria-label="School years">[\s\S]*?<\/nav>/g) ?? [];
    expect(navs, 'one switcher').toHaveLength(1);
    return navs[0] ?? '';
  };
  const links = (nav: string) => [...nav.matchAll(/<a href="([^"]+)"([^>]*)>([^<]*)<\/a>/g)].map(m => ({ href: m[1], attrs: m[2], text: m[3] }));
  it('lists all seven years in order, and marks exactly one, the page\'s own, as the current page', () => {
    for (const y of map.byYear) {
      const all = links(switcherOf(read(fileOf(y.year)))).filter(l => !/\brel=/.test(l.attrs));
      expect(all.map(l => [l.href, l.text]), y.year).toEqual(YEARS.map(o => [yearPath(o.id), o.title]));
      const current = all.filter(l => l.attrs.includes('aria-current="page"'));
      expect(current.map(l => l.href), y.year).toEqual([yearPath(y.year)]);
      expect(all.every(l => l.attrs === '' || l.attrs === ' aria-current="page"'), y.year).toBe(true);
      const main = read(fileOf(y.year)).match(/<main\b[\s\S]*<\/main>/)![0];
      expect(main.match(/aria-current=/g), `${y.year}: one current-page mark in main, the switcher's`).toHaveLength(1);
    }
  });
  it('links the years either side as Previous and Next, and Reception has no Previous, Year 6 no Next', () => {
    YEARS.forEach((y, i) => {
      const nav = links(switcherOf(read(fileOf(y.id))));
      const prev = nav.filter(l => l.attrs === ' rel="prev"'), next = nav.filter(l => l.attrs === ' rel="next"');
      expect(prev.map(l => [l.href, l.text]), y.id).toEqual(i ? [[yearPath(YEARS[i - 1].id), `Previous: ${YEARS[i - 1].title}`]] : []);
      expect(next.map(l => [l.href, l.text]), y.id).toEqual(i < YEARS.length - 1 ? [[yearPath(YEARS[i + 1].id), `Next: ${YEARS[i + 1].title}`]] : []);
    });
  });
  it('every switcher link resolves to a page under website/', () => {
    for (const y of map.byYear) {
      for (const { href } of links(switcherOf(read(fileOf(y.year))))) {
        expect(href, y.year).toMatch(/^\/[a-z0-9/-]*\/$/);
        expect(existsSync(`website${href}index.html`), `${y.year}: ${href}`).toBe(true);
      }
    }
  });
});
