import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * #2162: the `site` e2e project only sees what a 360 px page load fetches. A `preconnect`, a `srcset` candidate for
 * another width or a `url()` in a wide-screen media block is never requested there, so this reads the source:
 * nothing under website/ may name a host other than the site's own in a place a browser fetches from. A link a
 * reader follows (`<a href>`) and a social-card `<meta content>` are not fetches, so neither is read.
 */
const ORIGIN = 'https://sharpwise.co.uk';

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(html|css)$/.test(e.name) ? [p] : [];
  });
}

const foreign = (u: string) => /^(https?:)?\/\//i.test(u.trim()) && !(u.trim().startsWith(`${ORIGIN}/`) || u.trim() === ORIGIN);
const attr = (tag: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1] ?? '';

function inAttributes(name: string, src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/\s(src|srcset|poster|data|action|data-src)\s*=\s*["']([^"']*)["']/gi)) {
    const urls = m[1].toLowerCase() === 'srcset' ? m[2].split(',').map(c => c.trim().split(/\s+/)[0]) : [m[2]];
    if (urls.some(foreign)) out.push(`${name}: ${m[0].trim()}`);
  }
  return out;
}

function inLinks(name: string, src: string): string[] {
  return [...src.matchAll(/<link\b[^>]*>/gi)].map(m => m[0]).filter(tag => {
    const rel = attr(tag, 'rel');
    return /\b(preconnect|dns-prefetch)\b/i.test(rel) || (!/\b(canonical|alternate)\b/i.test(rel) && foreign(attr(tag, 'href')));
  }).map(tag => `${name}: ${tag}`);
}

function inStyles(name: string, src: string): string[] {
  const hits = [...src.matchAll(/url\(\s*["']?([^)"']*)/gi), ...src.matchAll(/@import\s+(?:url\()?\s*["']?([^)"';\s]*)/gi)];
  return hits.filter(m => foreign(m[1])).map(m => `${name}: ${m[0]}`);
}

/** Every reference a browser would fetch, or warm a connection to, that names another host, as `file: text`. */
export const offOrigin = (name: string, src: string): string[] => [...inAttributes(name, src), ...inLinks(name, src), ...inStyles(name, src)];

describe('website/ names no host but its own where a browser fetches (#2162)', () => {
  const all = files('website');
  it('reads the pages and the stylesheet, or the rail below checks nothing', () => {
    expect(all.length).toBeGreaterThanOrEqual(15);
    expect(all).toContain(join('website', 'site.css'));
    expect(all).toContain(join('website', '404.html'));
  });
  it('has no off-origin src, srcset, link href, url(), @import, preconnect or dns-prefetch', () => {
    expect(all.flatMap(f => offOrigin(f, readFileSync(f, 'utf8')))).toEqual([]);
  });
  it.each([
    ['<img src="https://cdn.example.com/a.png">'], ['<img src="//cdn.example.com/a.png">'],
    ['<img srcset="/a.webp 1x, https://x.example/b.webp 2x">'], ['<script src="http://x.example/a.js"></script>'],
    ['<link rel="preconnect" href="https://fonts.gstatic.com">'], ['<link rel="dns-prefetch" href="//x.example">'],
    ['<link rel="stylesheet" href="https://x.example/a.css">'], ['a{background:url(https://x.example/a.png)}'],
    ['a{background:url( "//x.example/a.png" )}'], ['@import "https://x.example/a.css";'],
  ])('catches %s', src => { expect(offOrigin('t', src)).not.toEqual([]); });
  it.each([
    ['<link rel="canonical" href="https://sharpwise.co.uk/about/">'], ['<img src="/icons/a.webp">'],
    ['<img srcset="/a.webp 1x, /b.webp 2x">'], ['<a href="https://ico.org.uk/">ICO</a>'],
    ['<meta property="og:image" content="https://sharpwise.co.uk/share.jpg">'], ['a{background:url(/fonts/a.woff2)}'],
    ['a{background:url(data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27/%3E)}'],
  ])('lets %s through', src => { expect(offOrigin('t', src)).toEqual([]); });
});
