import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { YEARS } from '../../src/curriculum';
import type { YearId } from '../../src/curriculum/types';
import { yearPath } from '../../scripts/site-curriculum-lib.mjs';

/**
 * #2159: the main menu's Curriculum item is a <details> disclosure listing All years and the seven school years,
 * on every page. The years come from the game's registry, not from the header, so a year added to the game and
 * not to the menu fails here. site-home.test.ts holds the header byte-identical and the current-page marks.
 * #2174: website/nav.js turns it into a button and an overlay at run time; the markup on disk stays this <details>.
 * #2178: All years first, on its own, then the years in two lists by key stage, each named by its visible label.
 */
const root = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');
const pages = (dir = 'website'): string[] => readdirSync(new URL(dir, root), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? pages(`${dir}/${e.name}`) : e.name.endsWith('.html') ? [`${dir}/${e.name}`] : []);
const header = (html: string) => html.slice(html.indexOf('<header'), html.indexOf('</header>'));
const disclosure = (html: string) => header(html).match(/<details class="nav-years">([\s\S]*?)<\/details>/)?.[1] ?? '';
const css = read('website/site.css').replace(/\/\*[\s\S]*?\*\//g, '');
/** Every declaration block whose selector names .nav-years. */
const rules = [...css.matchAll(/([^{}]*\.nav-years[^{}]*)\{([^}]*)\}/g)].map(m => ({ selector: m[1].trim(), body: m[2] }));

describe('the Curriculum item opens the seven school years (#2159)', () => {
  const all = pages();
  const expected = [['/curriculum/', 'All years'], ...YEARS.map(y => [yearPath(y.id), y.title])];

  it('reads every page and the seven years of the registry', () => {
    expect(all).toContain('website/curriculum/year-3/index.html');
    expect(YEARS).toHaveLength(7);
  });
  it('every page\'s header has the disclosure, closed, with Curriculum as its summary', () => {
    for (const p of all) {
      const html = read(p);
      expect(header(html), p).toContain('<details class="nav-years">\n              <summary>Curriculum</summary>');
      expect(header(html).match(/<details\b/g), `${p}: one disclosure`).toHaveLength(1);
    }
  });
  it('lists All years and then each year, in order, by its name and its page', () => {
    for (const p of all) {
      const links = [...disclosure(read(p)).matchAll(/<li><a href="([^"]+)"(?: aria-current="page")?>([^<]+)<\/a><\/li>/g)].map(m => [m[1], m[2]]);
      expect(links, p).toEqual(expected);
    }
  });
  it('each link resolves to a page in website/', () => {
    for (const [href] of expected) expect(existsSync(new URL(`website${href}index.html`, root)), href).toBe(true);
  });
  it('a year page marks its own year, and the hub marks All years', () => {
    const current = (p: string) => [...disclosure(read(p)).matchAll(/<a href="([^"]+)" aria-current="page">/g)].map(m => m[1]);
    expect(current('website/curriculum/index.html')).toEqual(['/curriculum/']);
    for (const y of YEARS) expect(current(`website${yearPath(y.id)}index.html`), y.id).toEqual([yearPath(y.id)]);
    expect(current('website/index.html')).toEqual([]);
  });
  it('the CSS styles the item as current on a curriculum page, and never opens it on hover alone', () => {
    expect(rules.length, 'the .nav-years rules it reads').toBeGreaterThan(3);
    for (const el of ['summary', 'button']) {
      expect(rules.some(r => r.selector.includes(`:has([aria-current="page"]) > ${el}`) && /color:\s*var\(--accent\)/.test(r.body)), el).toBe(true);
    }
    for (const r of rules) expect(r.selector, `${r.selector}: hover must not open it (1.4.13)`).not.toMatch(/:hover[^,]*(ul|details-content)/);
    expect(rules.find(r => r.selector === '.nav-years > summary, .nav-years > button')?.body).toContain('min-height: var(--tap)');
  });
  // #2174: only the scripted menu (nav.js turns the <details> into a div.nav-years with a button) may lie over the
  // page, because only it closes when focus leaves. The <details> a reader without the script gets has nothing to
  // close it, so its list stays in the header's flow, where it can hide nothing (2.4.11).
  const overlay = (body: string) => /position:\s*(absolute|fixed|sticky)/.test(body);
  const scripted = (selector: string) => selector.split(',').every(s => s.trim().startsWith('.site-nav div.nav-years'));
  it('lies over the page only once nav.js has made it closable; the no-script list opens in the flow', () => {
    const over = rules.filter(r => overlay(r.body));
    expect(over.map(r => r.selector), 'the overlay rule it reads').toContain('.site-nav div.nav-years > ul');
    for (const r of over) expect(scripted(r.selector), `${r.selector}: a panel no script can close could hide the next focused link (2.4.11)`).toBe(true);
    expect(overlay('position: absolute') && overlay('position:fixed'), 'what it reads as an overlay').toBe(true);
    expect(['.site-nav .nav-years ul', 'details.nav-years > ul', '.site-nav div.nav-years > ul, .nav-years ul'].map(scripted), 'what it refuses').toEqual([false, false, false]);
  });
  it('the scripted list is hidden while the button says collapsed, so aria-expanded is its one state', () => {
    expect(rules.find(r => r.selector === '.site-nav div.nav-years > [aria-expanded="false"] + ul')?.body).toMatch(/display:\s*none/);
  });
});

/**
 * #2178: the years are grouped the way schools in England speak of them. Key Stage 1 is Years 1 and 2; Reception
 * is the Early Years Foundation Stage, so the first group's label names it. The membership is pinned by the
 * registry's ids, so a year added to the game and to no group fails here.
 */
const GROUPS: { id: string; label: string; years: YearId[] }[] = [
  { id: 'nav-ks1', label: 'Reception and Key Stage 1', years: ['reception', 'year1', 'year2'] },
  { id: 'nav-ks2', label: 'Key Stage 2', years: ['year3', 'year4', 'year5', 'year6'] },
];
/** Each group in the header: the label's id and text, the id its list is named by, and the pages it links. */
const groups = (html: string) => [...disclosure(html).matchAll(/<li>\s*<p id="([^"]+)">([^<]+)<\/p>\s*<ul aria-labelledby="([^"]+)">([\s\S]*?)<\/ul>\s*<\/li>/g)]
  .map(m => ({ id: m[1], label: m[2], by: m[3], links: [...m[4].matchAll(/<a href="([^"]+)"/g)].map(h => h[1]) }));

describe('the Curriculum menu groups the years by key stage (#2178)', () => {
  const all = pages();
  it('the two groups cover every year of the registry once, in order', () => {
    expect(GROUPS.flatMap(g => g.years)).toEqual(YEARS.map(y => y.id));
  });
  it('on every page: All years first on its own, then each group as a list named by its visible label', () => {
    const want = GROUPS.map(g => ({ id: g.id, label: g.label, by: g.id, links: g.years.map(yearPath) }));
    for (const p of all) {
      const html = read(p);
      expect(groups(html), p).toEqual(want);
      expect(disclosure(html), `${p}: All years comes before the groups`).toMatch(/^\s*<summary>Curriculum<\/summary>\s*<ul>\s*<li><a href="\/curriculum\/"(?: aria-current="page")?>All years<\/a><\/li>\s*<li>\s*<p id="nav-ks1">/);
      for (const g of GROUPS) expect(html.split(`id="${g.id}"`), `${p}: ${g.id} is one id on the page`).toHaveLength(2);
    }
  });
  it('reads a group it is shown, and not a list named by anything else', () => {
    const one = '<details class="nav-years"><summary>Curriculum</summary><ul><li><p id="a">A</p><ul aria-labelledby="b"><li><a href="/x/">X</a></li></ul></li></ul></details>';
    expect(groups(`<header>${one}</header>`)).toEqual([{ id: 'a', label: 'A', by: 'b', links: ['/x/'] }]);
  });
  it('the scripted list stacks the groups on a phone and sets them side by side from 900px', () => {
    const rule = (sel: string, media = false) => {
      const at = css.indexOf('@media (min-width: 900px)', css.indexOf('.site-nav div.nav-years > ul {'));
      const scope = media ? css.slice(at) : css.slice(0, at);
      return [...scope.matchAll(/([^{}]*)\{([^}]*)\}/g)].find(m => m[1].trim() === sel)?.[2] ?? '';
    };
    expect(rule('.site-nav div.nav-years > ul')).toMatch(/grid-template-columns:\s*1fr;/);
    expect(rule('.site-nav div.nav-years > ul', true)).toMatch(/grid-template-columns:\s*auto auto;/);
    expect(rule('.site-nav div.nav-years > ul > li:first-child')).toMatch(/grid-column:\s*1 \/ -1/);
  });
});
