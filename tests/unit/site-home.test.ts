import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

/**
 * #1935: the site shell (header, navigation, footer, website/site.css) and the home page. These hold the parts
 * of its SEO, AI-search and WCAG 2.2 AA criteria that a text check can see; Lighthouse and axe-core were run by
 * hand on the PR. Text checks, not a browser: they catch the exact mistakes named, nothing more.
 */
const root = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');
const bytes = (p: string) => readFileSync(new URL(p, root));
const pages = (dir = 'website'): string[] => readdirSync(new URL(dir, root), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? pages(`${dir}/${e.name}`) : e.name.endsWith('.html') ? [`${dir}/${e.name}`] : []);
const home = read('website/index.html');
const between = (html: string, from: string, to: string) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)) + to.length);
const shell = (html: string) => ({
  header: between(html, '<a class="skip"', '</header>').replace(/ aria-current="page"/g, ''),
  footer: between(html, '<footer', '</footer>').replace(/ aria-current="page"/g, ''),
});
const meta = (html: string, key: string) => html.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`))?.[1];
/** Heading levels in document order, so a skipped level (h2 straight to h4) can be found. */
const headings = (html: string) => [...html.matchAll(/<h([1-6])\b/gi)].map(m => Number(m[1]));
/** JPEG size from its first start-of-frame marker. */
function jpegSize(b: Buffer): [number, number] {
  for (let i = 2; i < b.length;) {
    const marker = b[i + 1], len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return [0, 0];
}

describe('the site shell is the same on every page (#1935)', () => {
  const all = pages();
  it('reads every page under website/', () => {
    expect(all).toContain('website/index.html');
    expect(all.length).toBeGreaterThan(1);
  });
  it('every page carries the home page header and footer, differing only in which link is the current page', () => {
    for (const p of all) expect(shell(read(p)), p).toEqual(shell(home));
  });
  it('the header has the logo, Home, Curriculum, Features, Guides and About, then Play now', () => {
    const links = [...shell(home).header.matchAll(/<a [^>]*href="([^"]+)"/g)].map(m => m[1]);
    expect(links).toEqual(['#main', '/', '/', '/curriculum/', '/features/', '/guides/', '/about/', '/play/']);
  });
  it('the footer has Privacy, Support and About, and the company name with the year (3.2.6: help in one place)', () => {
    const { footer } = shell(home);
    expect([...footer.matchAll(/href="([^"]+)"/g)].map(m => m[1])).toEqual(['/privacy/', '/support/', '/about/']);
    expect(footer).toMatch(/© 20\d\d Inobil Technology Ltd/);
  });
  it('on every page, each navigation link to that page, and no other, is marked as the current page', () => {
    for (const p of all) {
      // The shell only: a page's own navigation in main (the year switcher, #2160) has its own rail.
      const html = read(p).replace(/<main\b[\s\S]*<\/main>/, ''), path = p.replace(/^website/, '').replace(/index\.html$/, '');
      const nav = [...html.matchAll(/<li><a href="([^"]+)"( aria-current="page")?>/g)];
      expect(nav.length, p).toBe(8);
      for (const [, href, current] of nav) expect(Boolean(current), `${p}: ${href}`).toBe(href === path);
    }
  });
  it('every page has landmarks, a skip link to #main first, one h1 and no skipped heading level', () => {
    for (const p of all) {
      const html = read(p);
      expect(html, p).toContain('<html lang="en-GB">');
      expect(html.slice(html.indexOf('<body>')).match(/<a [^>]*>/)?.[0], `${p}: the first link is the skip link`).toBe('<a class="skip" href="#main">');
      for (const tag of ['<header', '<nav', '<main id="main"', '<footer']) expect(html, `${p}: ${tag}`).toContain(tag);
      const h = headings(html);
      expect(h.filter(n => n === 1), `${p}: one h1`).toHaveLength(1);
      expect(h[0], `${p}: the h1 comes first`).toBe(1);
      h.forEach((n, i) => { if (i) expect(n - h[i - 1], `${p}: heading ${i} skips a level`).toBeLessThanOrEqual(1); });
    }
  });
  it('every page has its own title and description', () => {
    const titles = all.map(p => read(p).match(/<title>([^<]+)<\/title>/)?.[1]);
    const descriptions = all.map(p => meta(read(p), 'description'));
    expect(titles.every(Boolean) && descriptions.every(Boolean)).toBe(true);
    expect(new Set(titles).size).toBe(all.length);
    expect(new Set(descriptions).size).toBe(all.length);
  });
  it('every image has an alt text and its width and height', () => {
    for (const p of all) for (const [img] of read(p).matchAll(/<img\b[^>]*>/g)) {
      expect(img, p).toMatch(/\balt="[^"]*"/);
      expect(img, p).toMatch(/\bwidth="\d+"/);
      expect(img, p).toMatch(/\bheight="\d+"/);
    }
  });
  it('on every page only the first picture in main loads at once, the rest lazily (#2105)', () => {
    for (const p of all) {
      const html = read(p);
      const imgs = [...html.slice(Math.max(html.indexOf('<main'), 0)).matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
      for (const img of imgs.slice(1)) expect(img, p).toMatch(/\bloading="lazy"/i);
    }
  });
  it('the heading rail reads upper-case tags too (#2105)', () => {
    expect(headings('<H1>a</H1><H3>b</H3>')).toEqual([1, 3]);
  });
  it('the fonts and the icon are byte-for-byte copies of the game\'s, and the main font is preloaded', () => {
    for (const f of ['fonts/fredoka-latin.woff2', 'fonts/fredoka-latin-ext.woff2', 'fonts/OFL.txt', 'icons/icon-192.webp']) {
      expect(bytes(`website/${f}`).equals(bytes(`public/${f}`)), f).toBe(true);
    }
    for (const p of all) expect(read(p), p).toContain('<link rel="preload" href="/fonts/fredoka-latin.woff2" as="font" type="font/woff2" crossorigin>');
  });
});

describe('site.css (#1935)', () => {
  const css = read('website/site.css');
  it('copies the game\'s colour tokens exactly', () => {
    const tokens = (s: string) => Object.fromEntries([...s.matchAll(/--(ink|panel|panel-2|line|text|muted|accent|accent-2|good|bad|glow|radius):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
    const game = tokens(read('src/styles/base.css'));
    expect(Object.keys(game)).toHaveLength(12);
    expect(tokens(css)).toEqual(game);
  });
  it('keeps focus visible, never under a sticky header, respects reduced motion and gives taps 44px', () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid/);
    expect(css, 'a sticky or fixed header could cover the focused element (2.4.11)').not.toMatch(/position:\s*(sticky|fixed)/);
    expect(css).toContain('@media (prefers-reduced-motion: no-preference)');
    expect(css.match(/@keyframes|animation:/), 'no animation outside the reduced-motion guard').toBeNull();
    expect(css).toContain('--tap: 44px');
    expect(css.match(/min-height: var\(--tap\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe('the home page (#1935)', () => {
  it('has a canonical URL, Open Graph and Twitter tags, and a 1200 × 630 share image', () => {
    expect(home).toContain('<link rel="canonical" href="https://sharpwise.co.uk/">');
    for (const k of ['og:type', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'twitter:card', 'twitter:image']) expect(meta(home, k), k).toBeTruthy();
    expect(meta(home, 'og:image')).toBe('https://sharpwise.co.uk/share.jpg');
    expect(meta(home, 'twitter:card')).toBe('summary_large_image');
    expect(jpegSize(bytes('website/share.jpg'))).toEqual([1200, 630]);
    expect([meta(home, 'og:image:width'), meta(home, 'og:image:height')]).toEqual(['1200', '630']);
  });
  it('has JSON-LD for the company, the website and the game, which parses', () => {
    const block = home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    expect(block).toBeTruthy();
    const graph: { '@type': string | string[]; offers?: { price: string } }[] = JSON.parse(block!)['@graph'];
    const types = graph.map(n => n['@type']).flat();
    expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite', 'VideoGame']));
    expect(graph.find(n => n.offers)?.offers?.price).toBe('0');
  });
  it('states its facts as text, not only in pictures: who, which years, free, platforms, no adverts, no tracking', () => {
    const text = home.replace(/<head>[\s\S]*<\/head>/, '').replace(/<[^>]+>/g, ' ');
    for (const fact of ['aged 4 to 11', 'Reception to Year 6', 'National Curriculum for England', 'Free.', 'phone, tablet or computer', 'Adverts', 'Tracking']) {
      expect(text, fact).toContain(fact);
    }
  });
  it('loads the hero picture at once and every picture below it lazily', () => {
    const imgs = [...home.slice(home.indexOf('<main')).matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
    expect(imgs.length).toBeGreaterThanOrEqual(3);
    expect(imgs[0]).not.toContain('loading="lazy"');
    for (const img of imgs.slice(1)) expect(img).toContain('loading="lazy"');
  });
  it('links to the game twice in the page and once in the header', () => {
    expect(home.match(/href="\/play\/"/g)).toHaveLength(3);
  });
});

describe('/llms.txt (#1935)', () => {
  const txt = read('website/llms.txt');
  it('links every page by its absolute address, so a relative link is a mistake (#2105)', () => {
    const targets = [...txt.matchAll(/\]\(([^)]*)\)/g)].map(m => m[1]);
    expect(targets.length).toBeGreaterThan(3);
    for (const t of targets) expect(t, 'relative link').toMatch(/^https:\/\/sharpwise\.co\.uk(\/|$)/);
  });
  it('has the llmstxt.org shape: a title, a summary and a list of pages', () => {
    expect(txt.startsWith('# Sharpwise\n')).toBe(true);
    expect(txt).toMatch(/^> .+/m);
    expect(txt).toMatch(/^## Pages$/m);
  });
  it('lists only pages that exist: the game, or a page under website/ that is not a placeholder', () => {
    const links = [...txt.matchAll(/\]\(((?:https:\/\/sharpwise\.co\.uk)?(\/[^)]*))\)/g)].map(m => m[2]);
    expect(links).toContain('/');
    for (const l of links) {
      if (l === '/play/') continue;
      const file = `website${l}index.html`;
      expect(existsSync(new URL(file, root)), file).toBe(true);
      expect(read(file), `${file} is a placeholder`).not.toContain('noindex');
    }
  });
});
