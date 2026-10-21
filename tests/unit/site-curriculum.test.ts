// The /curriculum/ page rail (#2089): website/curriculum/index.html is generated from docs/content-map.json by
// scripts/site-curriculum.mjs, so it cannot say anything the content map does not. This regenerates it in memory
// and fails on drift, and holds its topic count to the registry (content-map.test.ts holds the map itself).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOPICS, YEARS } from '../../src/curriculum';
import { esc, gapsOf, renderCurriculumPage, renderYear, yearSlug, type ContentMap } from '../../scripts/site-curriculum-lib.mjs';

const read = (p: string) => readFileSync(p, 'utf8');
const map: ContentMap = JSON.parse(read('docs/content-map.json'));
const page = read('website/curriculum/index.html');
const REGEN = 'run `npm run content-map` and commit website/curriculum/index.html';
const text = (html: string) => html.replace(/<head>[\s\S]*<\/head>/, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const rowHeads = (html: string) => [...html.matchAll(/<th scope="row">([^<]*)<\/th>/g)].map(m => m[1]);

describe('the curriculum page is generated, never hand-kept (#2089)', () => {
  it('website/curriculum/index.html equals a fresh render of the content map and the home page shell', () => {
    expect(page, REGEN).toBe(renderCurriculumPage(map, read('website/index.html')));
  });
  it('lists every registry topic exactly once and says how many there are', () => {
    const sectionOf = (id: string) => { const at = page.indexOf(`<section id="${yearSlug(id)}"`); return page.slice(at, page.indexOf('</section>', at)); };
    const onPage = YEARS.flatMap(y => rowHeads(sectionOf(y.id)).map(title => `${y.id} ${title}`));
    expect(onPage.sort(), 'each topic under its own year').toEqual(TOPICS.map(t => `${t.year} ${esc(t.title)}`).sort());
    expect(rowHeads(page)).toHaveLength(TOPICS.length);
    expect(text(page)).toContain(`Sharpwise has ${TOPICS.length} maths and English topics`);
  });
  it('gives each year a section with its anchor, its index link, and a maths and an English table', () => {
    for (const y of YEARS) {
      const slug = yearSlug(y.id);
      expect(page, y.id).toContain(`<section id="${slug}" aria-labelledby="${slug}-title">`);
      expect(page, y.id).toContain(`<a href="#${slug}">${y.title}</a>`);
      expect(page, y.id).toContain(`<caption>${y.title} maths: `);
      expect(page, y.id).toContain(`<caption>${y.title} English: `);
    }
  });
  it('every in-page link lands on an id the page has', () => {
    const ids = new Set([...page.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
    for (const [, id] of page.matchAll(/href="#([^"]+)"/g)) expect(ids.has(id), `#${id}`).toBe(true);
  });
  it('every table has a caption first and column headers, and every data row a row header', () => {
    const tables = [...page.matchAll(/<table>([\s\S]*?)<\/table>/g)].map(m => m[1]);
    expect(tables).toHaveLength(YEARS.length * 2);
    for (const t of tables) {
      expect(t.trimStart().startsWith('<caption>'), 'caption first').toBe(true);
      expect(t).toContain('<thead><tr><th scope="col">Topic</th><th scope="col">Curriculum objective</th></tr></thead>');
      for (const [row] of t.matchAll(/<tr>(?!<th scope="(?:col|rowgroup)")[\s\S]*?<\/tr>/g)) expect(row).toMatch(/^<tr><th scope="row">/);
    }
  });
  it('lists, in each year, every strand the content map says no topic names', () => {
    for (const y of map.byYear) {
      const section = renderYear(map, y);
      for (const gap of gapsOf(map, y)) expect(section, `${y.year}: ${gap.name}`).toContain(esc(gap.name.replace(/^Years? [\d–-]+ /, '')));
    }
    const all = map.coverage.filter(c => !c.topics.length);
    expect(all.length, 'the content map has gaps to show').toBeGreaterThan(0);
    for (const gap of all) expect(gap.years.some(y => gapsOf(map, map.byYear.find(b => b.year === y)!).includes(gap)), gap.id).toBe(true);
  });
  it('escapes what it prints: a topic title with markup in it comes out as text', () => {
    const odd = { ...map, topics: map.topics.map((t, i) => (i ? t : { ...t, title: '<b>Odd</b> & "co"' })) };
    const y = renderYear(odd, odd.byYear[0]);
    expect(y).toContain('&lt;b&gt;Odd&lt;/b&gt; &amp; &quot;co&quot;');
    expect(y).not.toContain('<b>Odd</b>');
  });
});
