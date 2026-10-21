import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * #2095: GitHub Pages serves website/404.html for any missing address, at whatever depth was asked for, so a
 * relative `site.css` on /a/b/c would be looked for at /a/b/site.css and the page would arrive unstyled. #2087's
 * dead-link rail (PR #2109) resolves a page's links from the page's own path (/404.html, the root), so it cannot
 * see this; that rail, not this one, checks that each address exists.
 */
const page = readFileSync(new URL('../../website/404.html', import.meta.url), 'utf8');
const uncommented = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');
/** Every address (an attribute, quoted or not, or an inline CSS `url()`) that would resolve differently at /a/b/c
 *  than at the root. */
function depthBound(html: string): string[] {
  const text = uncommented(html);
  const attrs = [...text.matchAll(/\s(href|src|srcset|imagesrcset|poster|action|formaction)\s*=\s*(?:(["'])(.*?)\2|([^\s"'>]+))/gi)]
    .flatMap(m => { const v = m[3] ?? m[4]; return /srcset$/i.test(m[1]) ? v.split(',').map(c => c.trim().split(/\s+/)[0]) : [v]; });
  const urls = [...attrs, ...[...text.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)].map(m => m[2])];
  return urls.filter(u => !/^(?:\/(?!\/)|#|https:\/\/sharpwise\.co\.uk\/)/.test(u));
}

describe('the 404 page (#2095)', () => {
  it('flags an address that depends on the depth it is served at, and passes root-absolute ones', () => {
    expect(depthBound('<link href="site.css"> <img src="../icons/a.webp"> <a href=\'./\'> <a href="//x.com/">' +
      ' <source srcset="/img/a.webp 1x, img/b.webp 2x">')).toEqual(['site.css', '../icons/a.webp', './', '//x.com/', 'img/b.webp']);
    expect(depthBound('<img src=img/c.webp> <a href = "about/"> <link rel="preload" imagesrcset="img/d.webp 1x">' +
      ' <div style="background: url(\'img/e.webp\')"> <style>.x { background: url(/img/f.webp) }</style>'))
      .toEqual(['img/c.webp', 'about/', 'img/d.webp', 'img/e.webp']);
    expect(depthBound('<a href="/"> <a href="#main"> <link href="/site.css"> <meta content="x"> <!-- <a href="old/"> -->' +
      ' <a href="https://sharpwise.co.uk/play/">')).toEqual([]);
  });
  it('loads its stylesheet, font and icon, and links everything, from the site root', () => {
    for (const ref of ['href="/site.css"', 'href="/fonts/fredoka-latin.woff2"', 'src="/icons/icon-192.webp"']) expect(page).toContain(ref);
    expect(depthBound(page)).toEqual([]);
  });
  it('is never indexed and names no canonical URL, since it answers for every missing address', () => {
    expect(uncommented(page)).toContain('<meta name="robots" content="noindex">');
    expect(uncommented(page)).not.toContain('rel="canonical"');
  });
  it('offers a way back: the home page and the game, inside the main content', () => {
    const main = page.slice(page.indexOf('<main'), page.indexOf('</main>'));
    expect(main).toContain('href="/"');
    expect(main).toContain('href="/play/"');
    expect(main.match(/<h1>Page not found<\/h1>/)).toBeTruthy();
  });
});
