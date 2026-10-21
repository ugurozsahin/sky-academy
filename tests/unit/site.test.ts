import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { shotFiles } from '../../scripts/site-shots.mjs';

/**
 * #2087: `pages.yml` copies website/ as it is (`cp -a website/. site/`), and a website-only pull request runs no
 * e2e, so these text rails are the only check a new page meets before it is live. They hold what #1935's rails
 * did not: the viewport, a canonical URL, and that every link resolves. The rest of #2087 already has a home:
 * lang, one h1, unique titles and descriptions, the shared header and footer, image sizes and the colour tokens in
 * site-home.test.ts; no script and no other origin in pages.test.ts; /img/ names in site-shots.test.ts.
 */
const root = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');
const files = (ext: string, dir = 'website'): string[] => readdirSync(new URL(dir, root), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? files(ext, `${dir}/${e.name}`) : e.name.endsWith(ext) ? [`${dir}/${e.name}`] : []);
const pages = () => files('.html');
const uncommented = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');
/** The URL path a page is served at: website/about/index.html is /about/. */
const urlPath = (page: string) => page.replace(/^website/, '').replace(/index\.html$/, '');
const ORIGIN = 'https://sharpwise.co.uk';
/** A placeholder's `noindex`; one left in a comment when the page goes live does not count. */
const noindex = (html: string) => /<meta name="robots" content="[^"]*\bnoindex\b/.test(uncommented(html));

/** Every address a page points at on this site: `href`/`src`/`srcset` attributes (single or double quotes), CSS
 *  `url()`, and every absolute sharpwise.co.uk URL anywhere in the file (Open Graph, JSON-LD). JSON-LD's
 *  `"@id": ".../#organization"` is a name, never a jump, so its fragment is dropped. Other origins are
 *  pages.test.ts's business. */
function links(text: string): string[] {
  const out = [...text.matchAll(/\s(href|src|srcset)=(["'])(.*?)\2|url\(\s*["']?([^"')]+)["']?\s*\)/gi)]
    .flatMap(m => m[1]?.toLowerCase() === 'srcset' ? m[3].split(',').map(c => c.trim().split(/\s+/)[0]) : [m[3] ?? m[4]]);
  const ids = text.replace(/("@id":\s*"[^"#]*)#[^"]*"/g, '$1"');
  for (const [u] of ids.matchAll(/https:\/\/sharpwise\.co\.uk(?=[/"'\s<)]|$)[^\s"'<>)]*/g)) out.push(u);
  return [...new Set(out)].filter(u => !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(u) || u.startsWith(`${ORIGIN}/`) || u === ORIGIN);
}

/** Why `link`, found in `from` (a path under website/), would not load once deployed; '' when it would. */
function dead(link: string, from: string): string {
  const url = new URL(link, `${ORIGIN}${urlPath(from) || '/'}`);
  if (url.origin !== ORIGIN) return `${link}: leaves the site`;
  const path = decodeURIComponent(url.pathname);
  if (path === '/play/') return '';                                          // the game, built into site/play/ at deploy
  if (path.startsWith('/play/')) return `${link}: only /play/ itself is known to exist`;
  const img = path.match(/^\/img\/([^/]+)$/);
  if (img) return shotFiles().includes(img[1]) ? '' : `${link}: not in the site-shots.mjs shot list (#2088)`;
  const file = `website${path.endsWith('/') ? `${path}index.html` : path}`;
  if (!existsSync(new URL(file, root)) || !statSync(new URL(file, root)).isFile()) return `${link}: no ${file}`;
  // A fragment must name an id attribute on the page it points at.
  if (url.hash && file.endsWith('.html') && !read(file).includes(` id="${decodeURIComponent(url.hash.slice(1))}"`)) {
    return `${link}: no id="${url.hash.slice(1)}" in ${file}`;
  }
  return '';
}
const deadLinks = (file: string, text = read(file)) => links(text).map(l => dead(l, file)).filter(Boolean);

describe('every page under website/ (#2087)', () => {
  const all = pages();
  it('reads every page, the home page and a page in a folder among them', () => {
    expect(all).toContain('website/index.html');
    expect(all).toContain('website/about/index.html');
  });
  it('has the viewport meta', () => {
    for (const p of all) expect(read(p), p).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
  });
  it('that search engines may index names itself as its canonical URL on sharpwise.co.uk; a noindex placeholder may not', () => {
    const indexed = all.filter(p => !noindex(read(p)));
    expect(indexed, 'the home page is indexed').toContain('website/index.html');
    for (const p of indexed) {
      const canonical = [...uncommented(read(p)).matchAll(/<link rel="canonical" href="([^"]*)">/g)].map(m => m[1]);
      expect(canonical, p).toEqual([`${ORIGIN}${urlPath(p)}`]);
    }
  });
  it('links only to files in website/, to /play/, to a deploy-time screenshot and to ids on the page', () => {
    const found = all.flatMap(p => links(read(p)));
    expect(found, 'the links it checks').toEqual(expect.arrayContaining(['/', '/play/', '#main', '/site.css', `${ORIGIN}/share.jpg`]));
    expect(found.some(l => l.startsWith('/img/')), 'a deploy-time screenshot among them').toBe(true);
    for (const p of all) expect(deadLinks(p), p).toEqual([]);
  });
  it('every stylesheet loads only files that are in website/', () => {
    expect(files('.css')).toContain('website/site.css');
    expect(links(read('website/site.css'))).toContain('/fonts/fredoka-latin.woff2');
    for (const f of files('.css')) expect(deadLinks(f), f).toEqual([]);
  });
  it('flags a dead page, file, fragment and screenshot, and passes the ones that resolve', () => {
    const page = '<a href="/nope/"> <link href="/gone.css"> <a href="#top"> <img src="/img/nope-phone.webp"> <a href="/play/x.html">' +
      ` <meta content="${ORIGIN}/missing.jpg"> <a href="about/"> <a href='/single/'> <a href="#skip">` +
      ` <source srcset="/img/slice-phone.webp 390w, /img/slice-tablet.webp 768w"> <a href="${ORIGIN}/#faq">`;
    expect(deadLinks('website/index.html', page)).toEqual([
      '/nope/: no website/nope/index.html', '/gone.css: no website/gone.css', '#top: no id="top" in website/index.html',
      '/img/nope-phone.webp: not in the site-shots.mjs shot list (#2088)', '/play/x.html: only /play/ itself is known to exist',
      "/single/: no website/single/index.html", '#skip: no id="skip" in website/index.html',
      '/img/slice-tablet.webp: not in the site-shots.mjs shot list (#2088)', `${ORIGIN}/#faq: no id="faq" in website/index.html`,
      `${ORIGIN}/missing.jpg: no website/missing.jpg`,
    ]);
    expect(deadLinks('website/about/index.html', '<a href="../curriculum/"> <a href="/#main"> <img src="/img/slice-desktop.webp">' +
      ` <a href="mailto:a@b.c"> <a href="https://play.google.com/store"> "@id": "${ORIGIN}/#organization"`)).toEqual([]);
  });
});
