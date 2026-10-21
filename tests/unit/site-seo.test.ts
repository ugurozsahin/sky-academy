import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { sitemapUrls, sitemapXml, ORIGIN } from '../../scripts/site-sitemap.mjs';

/**
 * #1936: search and share metadata on every indexable page, a sitemap that cannot miss one, and a robots.txt
 * that keeps every crawler in. `pages.yml` deploys website/ as it is, so these text rails are the only check.
 * Titles, descriptions, canonicals and the home page's JSON-LD are also pinned by site.test.ts and
 * site-home.test.ts; this file adds what they do not: Open Graph and Twitter tags on every page, the sitemap,
 * robots.txt, llms.txt in step, and breadcrumbs on a guide page. A `noindex` page (a placeholder, the 404) is
 * outside all of it, as it is outside the sitemap.
 */
const root = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');
const pagesIn = (dir = 'website'): string[] => readdirSync(new URL(dir, root), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? pagesIn(`${dir}/${e.name}`) : e.name === 'index.html' ? [`${dir}/${e.name}`] : []);
const uncommented = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');
const noindex = (html: string) => /<meta name="robots" content="[^"]*\bnoindex\b/.test(uncommented(html));
const urlPath = (page: string) => page.replace(/^website/, '').replace(/index\.html$/, '');
const meta = (html: string, attr: 'name' | 'property', key: string) =>
  [...uncommented(html).matchAll(new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`, 'g'))].map(m => m[1]);

/** What is missing from one page's search and share metadata; [] when it is complete. */
function missingSeo(html: string): string[] {
  const one = (attr: 'name' | 'property', key: string) => meta(html, attr, key).filter(Boolean).length === 1;
  const out = [
    ...['description'].filter(k => !one('name', k)),
    ...['og:type', 'og:site_name', 'og:locale', 'og:url', 'og:title', 'og:description', 'og:image', 'og:image:alt'].filter(k => !one('property', k)),
    ...['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'].filter(k => !one('name', k)),
  ];
  const canonical = uncommented(html).match(/<link rel="canonical" href="([^"]*)">/)?.[1];
  if (canonical && meta(html, 'property', 'og:url')[0] !== canonical) out.push('og:url differs from canonical');
  if (!(meta(html, 'property', 'og:image')[0] ?? '').startsWith(`${ORIGIN}/`)) out.push('og:image is not an absolute sharpwise.co.uk URL');
  return out;
}

const hasBreadcrumbs = (html: string) => [...uncommented(html).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .some(m => { try { return JSON.stringify(JSON.parse(m[1])).includes('"BreadcrumbList"'); } catch { return false; } });

describe('every indexable page carries Open Graph and Twitter tags (#1936)', () => {
  const indexed = pagesIn().filter(p => !noindex(read(p)));
  it('reads the home page', () => {
    expect(indexed).toContain('website/index.html');
  });
  it('is complete on each', () => {
    for (const p of indexed) expect(missingSeo(read(p)), p).toEqual([]);
  });
  it('flags every tag it asks for, and a mismatched url or relative image', () => {
    const full = read('website/index.html');
    expect(missingSeo(full)).toEqual([]);
    expect(missingSeo('<title>x</title>')).toHaveLength(14);
    expect(missingSeo(full.replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="https://sharpwise.co.uk/x/">')))
      .toEqual(['og:url differs from canonical']);
    expect(missingSeo(full.replace(/(<meta property="og:image" content=")[^"]*/, '$1/share.jpg'))).toEqual(['og:image is not an absolute sharpwise.co.uk URL']);
    expect(missingSeo(full.replace(/<meta name="twitter:image" content="[^"]*">/, ''))).toEqual(['twitter:image']);
  });
});

describe('a guide page carries BreadcrumbList (#1936)', () => {
  it('on every indexable page under /guides/<name>/, and the check sees it', () => {
    const home = read('website/index.html');
    expect(hasBreadcrumbs(home)).toBe(false);
    expect(hasBreadcrumbs('<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>')).toBe(true);
    expect(hasBreadcrumbs('<!-- <script type="application/ld+json">{"@type":"BreadcrumbList"}</script> -->')).toBe(false);
    const guides = pagesIn().filter(p => /^website\/guides\/[^/]+\/index\.html$/.test(p) && !noindex(read(p)));
    for (const p of guides) expect(hasBreadcrumbs(read(p)), p).toBe(true);
  });
});

describe('website/sitemap.xml (#1936)', () => {
  it('is what scripts/site-sitemap.mjs writes from the pages, so it can never miss one', () => {
    expect(read('website/sitemap.xml')).toBe(sitemapXml());
  });
  it('lists the home page and the game, and every indexable page, and no noindex page or 404', () => {
    const listed = sitemapUrls();
    expect(listed).toEqual(expect.arrayContaining([`${ORIGIN}/`, `${ORIGIN}/play/`]));
    const indexable = pagesIn().filter(p => !noindex(read(p))).map(p => `${ORIGIN}${urlPath(p)}`);
    for (const u of indexable) expect(listed, u).toContain(u);
    for (const p of pagesIn().filter(p => noindex(read(p)))) expect(listed, p).not.toContain(`${ORIGIN}${urlPath(p)}`);
    expect(listed.some(u => u.includes('404'))).toBe(false);
  });
});

describe('website/robots.txt (#1936)', () => {
  const txt = read('website/robots.txt');
  const lines = txt.split('\n').filter(l => l && !l.startsWith('#'));
  it('lets every crawler in and names the sitemap', () => {
    expect(lines).toEqual(['User-agent: *', 'Allow: /', `Sitemap: ${ORIGIN}/sitemap.xml`]);
  });
  it('blocks no crawler, AI ones included, and records the owner\'s choice', () => {
    expect(lines.some(l => /^disallow:\s*\S/i.test(l))).toBe(false);
    expect(lines.filter(l => /^user-agent:/i.test(l))).toEqual(['User-agent: *']);
    expect(txt).toContain('2026-10-21');
  });
});

describe('website/llms.txt stays in step with the sitemap (#1936)', () => {
  it('links only to pages the sitemap lists', () => {
    const linked = [...read('website/llms.txt').matchAll(/\]\((https:\/\/sharpwise\.co\.uk[^)\s]*)\)/g)].map(m => m[1]);
    expect(linked.length).toBeGreaterThan(1);
    for (const u of linked) expect(sitemapUrls(), u).toContain(u);
  });
});
