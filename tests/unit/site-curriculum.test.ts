// The /curriculum/ page rail (#2089): website/curriculum/index.html is generated from docs/content-map.json by
// scripts/site-curriculum.mjs, so it cannot say anything the content map does not. This regenerates it in memory
// and fails on drift, and holds its topic count to the registry (content-map.test.ts holds the map itself).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOPICS, YEARS } from '../../src/curriculum';
import type { YearId } from '../../src/curriculum/types';
import { esc, renderCurriculumPage, renderYear, yearSlug, type ContentMap } from '../../scripts/site-curriculum-lib.mjs';

const read = (p: string) => readFileSync(p, 'utf8');
const map: ContentMap = JSON.parse(read('docs/content-map.json'));
const page = read('website/curriculum/index.html');
const REGEN = 'run `npm run content-map` and commit website/curriculum/index.html';
const text = (html: string) => html.replace(/<head>[\s\S]*<\/head>/, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const sectionOf = (id: string) => { const at = page.indexOf(`<section id="${yearSlug(id as YearId)}"`); return page.slice(at, page.indexOf('</section>', at)); };
const rowHeads = (html: string) => [...html.matchAll(/<th scope="row">([^<]*)<\/th>/g)].map(m => m[1]);

describe('the curriculum page is generated, never hand-kept (#2089)', () => {
  it('website/curriculum/index.html equals a fresh render of the content map and the home page shell', () => {
    expect(page, REGEN).toBe(renderCurriculumPage(map, read('website/index.html')));
  });
  it('lists every registry topic exactly once and says how many there are', () => {
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
  it('lists under each year exactly the strands of that year that no topic of that year names', () => {
    const area = (name: string) => esc(name.replace(/^Years? [\d–-]+ /, ''));
    for (const y of map.byYear) {
      const named = new Set(map.topics.filter(t => t.year === y.year).flatMap(t => t.strands));
      const expected = map.coverage.filter(c => c.years.includes(y.year) && !named.has(c.id)).map(c => area(c.name));
      const section = sectionOf(y.year);
      const listed = [...section.slice(section.indexOf('<h3>Not covered yet')).matchAll(/<li>([^<]*) \((?:maths|English)\)<\/li>/g)].map(m => m[1]);
      expect(listed, y.year).toEqual(expected);
    }
    expect(sectionOf('year3'), 'a strand shared with Year 4 is a gap in Year 3 when only Year 4 has topics').toContain('<li>Reading: comprehension (English)</li>');
  });
  it('puts every topic under the curriculum area of its first strand', () => {
    for (const y of map.byYear) {
      for (const [, group] of sectionOf(y.year).matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)) {
        const heading = group.match(/<th scope="rowgroup" colspan="2">([^<]*)<\/th>/)![1];
        for (const title of rowHeads(group)) {
          const homes = map.topics.filter(t => t.year === y.year && esc(t.title) === title)
            .map(t => esc(map.coverage.find(c => c.id === t.strands[0])!.name.replace(/^Years? [\d–-]+ /, '')));
          expect(homes, `${y.year}: ${title}`).toContain(heading);
        }
      }
    }
  });
  it('escapes what it prints: markup in a title, an objective or an area name comes out as text', () => {
    const odd = { ...map, topics: map.topics.map((t, i) => (i ? t : { ...t, title: '<b>Odd</b> & "co"', nc: 'A<i>&</i>B' })),
      coverage: map.coverage.map((c, i) => (i ? c : { ...c, name: 'Area <u>x</u>' })) };
    const y = renderYear(odd, odd.byYear[0]);
    expect(y).toContain('&lt;b&gt;Odd&lt;/b&gt; &amp; &quot;co&quot;');
    expect(y).toContain('A&lt;i&gt;&amp;&lt;/i&gt;B');
    expect(y).toContain('Area &lt;u&gt;x&lt;/u&gt;');
    expect(y).not.toMatch(/<[biu]>/);
  });
});
