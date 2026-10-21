// Usage: node scripts/site-sitemap.mjs [--check]      (#1936)
// Writes website/sitemap.xml from every indexable website/**/index.html, plus /play/ (the game is built into
// site/play/ at deploy, so no file here names it). A page with `noindex` is left out: a sitemap that lists
// a page it also asks crawlers to skip contradicts itself. 404.html is not an index.html and never appears.
// `--check` prints nothing and exits non-zero when the committed file differs from what this would write.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const ORIGIN = 'https://sharpwise.co.uk';
const site = new URL('../website/', import.meta.url);

const indexFiles = (dir = '') => readdirSync(new URL(dir, site), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? indexFiles(`${dir}${e.name}/`) : e.name === 'index.html' ? [`${dir}${e.name}`] : []);
const uncommented = html => html.replace(/<!--[\s\S]*?-->/g, '');
const noindex = html => /<meta name="robots" content="[^"]*\bnoindex\b/.test(uncommented(html));

/** Every address the sitemap lists, home first and then in path order. */
export function sitemapUrls() {
  const paths = indexFiles()
    .filter(f => !noindex(readFileSync(new URL(f, site), 'utf8')))
    .map(f => `/${f.replace(/index\.html$/, '')}`);
  return [...new Set([...paths, '/play/'])].sort().map(p => `${ORIGIN}${p}`);
}

export const sitemapXml = () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls().map(u => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = new URL('sitemap.xml', site);
  if (process.argv.includes('--check')) {
    let have = '';
    try { have = readFileSync(out, 'utf8'); } catch { /* missing counts as different */ }
    if (have !== sitemapXml()) { console.error('website/sitemap.xml is stale: run node scripts/site-sitemap.mjs'); process.exit(1); }
  } else writeFileSync(out, sitemapXml());
}
