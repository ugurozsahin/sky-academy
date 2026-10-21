// The /curriculum/ hub rail (#2089, a hub since #2161): website/curriculum/index.html is generated from
// docs/content-map.json by scripts/site-curriculum.mjs, so it cannot say anything the content map does not. This
// regenerates it in memory and fails on drift, holds every count on it to the game's own registry rather than to
// the map it was made from, and checks the seven year links. The tables the hub used to carry live on the year pages
// now: `no row is lost or doubled` in site-curriculum-years.test.ts holds every (year, topic, objective) row there.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOPICS, YEARS } from '../../src/curriculum';
import { esc, plainObjective, renderCurriculumPage, tasteOf, yearPath, type ContentMap } from '../../scripts/site-curriculum-lib.mjs';

const read = (p: string) => readFileSync(p, 'utf8');
const map: ContentMap = JSON.parse(read('docs/content-map.json'));
const home = read('website/index.html');
const page = read('website/curriculum/index.html');
const REGEN = 'run `npm run content-map` and commit website/curriculum/index.html';
const main = page.match(/<main\b[\s\S]*<\/main>/)![0];
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const topics = (year?: string, subject?: string) => TOPICS.filter(t => (!year || t.year === year) && (!subject || t.subject === subject));
const word = (n: number) => `${n} ${n === 1 ? 'topic' : 'topics'}`;
/** The year cards: one `<li>` each in the `.years` list, with its link, its name and its text. */
const cards = () => {
  const list = main.match(/<ul class="years">([\s\S]*?)<\/ul>/)![1];
  return [...list.matchAll(/<li><h3><a href="([^"]+)">([^<]+)<\/a><\/h3>([\s\S]*?)<\/li>/g)].map(m => ({ href: m[1], name: m[2], body: m[3] }));
};

describe('the curriculum hub is generated, never hand-kept (#2089, #2161)', () => {
  it('website/curriculum/index.html equals a fresh render of the content map and the home page shell', () => {
    expect(page, REGEN).toBe(renderCurriculumPage(map, home));
  });
  it('is at most 10 KB of HTML', () => {
    expect(Buffer.byteLength(page, 'utf8')).toBeLessThanOrEqual(10 * 1024);
  });
  it('shows no objective and no table: the year pages carry those, so no curriculum code can reach the hub (#2123)', () => {
    expect(main).not.toMatch(/<table\b/);
    expect(text(main)).not.toMatch(/\b(?:Y\d\S*|ELG|EYFS) [^.:]{0,20}:|\(\d+M\d|\bApp(?:endix|\.)/);
  });
});

describe('the hub\'s numbers are the game\'s own (#2161)', () => {
  it('says how many topics there are, and how many in maths and in English, in plain text', () => {
    const lede = text(main.match(/<p class="lede">[\s\S]*?<\/p>/)![0]).trim();
    expect(lede).toBe(`Sharpwise has ${TOPICS.length} maths and English topics, from Reception to Year 6: ${topics('', 'maths').length} in maths and ${topics('', 'writing').length} in English.`);
  });
  it('gives each year card its own maths and English counts', () => {
    const got = cards();
    expect(got).toHaveLength(YEARS.length);
    YEARS.forEach((y, i) => {
      expect(got[i].body, y.id).toContain(`<p>${word(topics(y.id, 'maths').length)} in maths and ${word(topics(y.id, 'writing').length)} in English.</p>`);
    });
  });
  it('puts the same counts in the description, for search results', () => {
    const description = page.match(/<meta name="description" content="([^"]+)">/)![1];
    expect(description).toContain(`${TOPICS.length} maths and English topics`);
    expect(description).toContain(`${topics('', 'maths').length} in maths and ${topics('', 'writing').length} in English`);
  });
});

describe('the hub links the seven year pages (#2161)', () => {
  it('as a list of seven cards, in school order, each named for its year and linking its page', () => {
    expect(cards().map(c => [c.href, c.name])).toEqual(YEARS.map(y => [yearPath(y.id), esc(y.title)]));
    for (const { href } of cards()) expect(existsSync(`website${href}index.html`), href).toBe(true);
  });
  it('carries a JSON-LD ItemList of the same seven pages, in the same order', () => {
    const ld = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    expect(ld['@type']).toBe('ItemList');
    expect(ld.numberOfItems).toBe(7);
    expect(ld.itemListElement.map((i: { position: number; name: string; url: string }) => [i.position, i.name, i.url]))
      .toEqual(YEARS.map((y, i) => [i + 1, y.title, `https://sharpwise.co.uk${yearPath(y.id)}`]));
  });
  it('links the game, and keeps its heading levels in order: one h1, then h2, then h3', () => {
    expect(main).toContain('<a class="btn" href="/play/">Play Sharpwise</a>');
    expect([...main.matchAll(/<h(\d)\b/g)].map(m => Number(m[1]))).toEqual([1, 2, ...YEARS.map(() => 3)]);
  });
  it('uses only classes website/site.css defines', () => {
    const css = read('website/site.css');
    for (const [, list] of main.matchAll(/class="([^"]+)"/g)) for (const c of list.split(/\s+/)) expect(css, `.${c}`).toMatch(new RegExp(`\\.${c}\\b`));
  });
});

describe('each card gives a taste of its year in plain words (#2161)', () => {
  it('names three topics of that year, two in maths and one in English, each as the year page words it', () => {
    for (const y of map.byYear) {
      const taste = tasteOf(map, y);
      expect(taste, y.year).toHaveLength(3);
      const said = (subject: string) => map.topics.filter(t => t.year === y.year && t.subject === subject)
        .map(t => (plainObjective(t.nc) || '').split(';')[0].trim());
      expect(said('maths'), `${y.year}: ${taste[0]}`).toContain(taste[0]);
      expect(said('maths'), `${y.year}: ${taste[1]}`).toContain(taste[1]);
      expect(said('writing'), `${y.year}: ${taste[2]}`).toContain(taste[2]);
      expect(new Set(taste).size, `${y.year}: three different topics`).toBe(3);
      expect(cards().find(c => c.href === yearPath(y.year))!.body, y.year).toContain(`<p>For example: ${taste.map(esc).join('; ')}.</p>`);
    }
  });
  it('escapes what it prints: markup in a year title or an objective comes out as text', () => {
    const odd = { ...map, byYear: map.byYear.map((y, i) => (i ? y : { ...y, title: '<b>R</b>' })),
      topics: map.topics.map((t, i) => (i ? t : { ...t, nc: 'ELG Number: <i>x</i> & y' })) };
    const html = renderCurriculumPage(odd, home);
    expect(html).toContain('&lt;b&gt;R&lt;/b&gt;');
    expect(html).toContain('&lt;i&gt;x&lt;/i&gt; &amp; y');
    expect(html).toContain('"name": "\\u003cb>R\\u003c/b>"');
    expect(html.match(/<main\b[\s\S]*<\/main>/)![0]).not.toMatch(/<[bi]>/);
  });
});
