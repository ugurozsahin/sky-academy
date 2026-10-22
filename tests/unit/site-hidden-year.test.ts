// A year the catalogue hides is not advertised anywhere on the website (#2201, #2253 review). The pruning is
// `withoutYearLinks`; the rail below holds the committed site to the same rule, whichever years it publishes.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_YEARS, withoutYearLinks, yearSlug } from '../../scripts/site-curriculum-lib.mjs';
import { sitemapUrls } from '../../scripts/site-sitemap.mjs';

const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : /\.(html|txt)$/.test(e.name) ? [`${dir}/${e.name}`] : []);
const site = files('website');

describe('a hidden year is dropped from every page that names it (#2201)', () => {
  it('removes the nav line and the llms.txt line, and nothing else', () => {
    const nav = '<ul>\n  <li><a href="/curriculum/year-1/">Year 1</a></li>\n  <li><a href="/curriculum/year-2/">Year 2</a></li>\n</ul>\n';
    expect(withoutYearLinks(nav, 'year2')).toBe('<ul>\n  <li><a href="/curriculum/year-1/">Year 1</a></li>\n</ul>\n');
    const llms = '- [Year 1](https://sharpwise.co.uk/curriculum/year-1/): a\n- [Year 2](https://sharpwise.co.uk/curriculum/year-2/): b\n';
    expect(withoutYearLinks(llms, 'year2')).toBe('- [Year 1](https://sharpwise.co.uk/curriculum/year-1/): a\n');
  });
  it('after pruning, no committed page or llms.txt keeps a nav or llms line for that year, for every year', () => {
    for (const id of ALL_YEARS) {
      const slug = yearSlug(id);
      const nav = new RegExp(`^\\s*<li><a href="/curriculum/${slug}/">|^- \\[[^\\]]*\\]\\(https://sharpwise\\.co\\.uk/curriculum/${slug}/\\)`, 'm');
      for (const f of site) expect(nav.test(withoutYearLinks(readFileSync(f, 'utf8'), id)), `${f} still advertises ${id}`).toBe(false);
    }
  });
});

describe('the committed site links no year page that does not exist (#2201)', () => {
  const dead = (text: string) => [...text.matchAll(/\/curriculum\/((?:reception|year-\d))\//g)].map(m => m[1]).filter(s => !existsSync(`website/curriculum/${s}/index.html`));
  it.each(site)('%s', f => { expect(dead(readFileSync(f, 'utf8'))).toEqual([]); });
  it('the sitemap lists exactly the pages that exist', () => {
    expect(readFileSync('website/sitemap.xml', 'utf8')).toBe(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls().map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  });
});
