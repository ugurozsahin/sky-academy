import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { precacheList } from '../../scripts/build-sw.mjs';

/** #1933: the game is served from `/play/` on GitHub Pages. These rails hold the pieces that make that safe. */
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const wf = read('.github/workflows/pages.yml');

describe('GitHub Pages deployment (#1933)', () => {
  it('builds the game with base /play/ and deploys with the official actions', () => {
    expect(wf).toContain('npx vite build --base=/play/ --outDir site/play --emptyOutDir && node scripts/build-sw.mjs site/play');
    expect(wf).toMatch(/uses: actions\/upload-pages-artifact@v\d/);
    expect(wf).toMatch(/uses: actions\/deploy-pages@v\d/);
  });
  // #2085: upload-pages-artifact leaves out every dotfile unless told otherwise (v4 could not be told), and the
  // site carries two: .well-known/ (scripts/app-links.mjs, #2028) and .nojekyll (website/). Without the input
  // assetlinks.json is built, then silently left out of the deploy.
  it('uploads the site with its hidden files, so .well-known/assetlinks.json reaches the deploy (#2085)', () => {
    const upload = wf.match(/uses: actions\/upload-pages-artifact@v(\d+)\n(?:\s*#.*\n)*\s*with: \{([^}]*)\}/);
    expect(upload, 'the upload-pages-artifact step and its one-line `with:` must be read').toBeTruthy();
    expect(Number(upload![1]), 'v5 is the first major with include-hidden-files').toBeGreaterThanOrEqual(5);
    expect(upload![2]).toMatch(/\bpath: site\b/);
    expect(upload![2]).toMatch(/\binclude-hidden-files: true\b/);
    expect(read('scripts/app-links.mjs'), 'the file the input exists for still lives under a dot directory').toContain('/.well-known/assetlinks.json');
  });
  it('is skipped until the owner opts in, so main is not red while Pages is off', () => {
    expect(wf).toMatch(/^  build:\n    if: vars\.PAGES_ENABLED == 'true'/m);
    expect(read('docs/WEBSITE.md')).toContain('`PAGES_ENABLED` = `true`');
  });
  it('has least-privilege permissions and a concurrency group', () => {
    expect(wf).toMatch(/^permissions:\n  contents: read$/m);
    expect(wf).toMatch(/pages: write/);
    expect(wf).toMatch(/id-token: write/);
    expect(wf).toMatch(/^concurrency:\n  group: pages$/m);
  });
  it('the manifest, worker registration and precache are all relative, so they follow the base path', () => {
    const m = JSON.parse(read('public/manifest.webmanifest'));
    for (const k of ['start_url', 'scope', 'id']) expect(m[k], k).toBe('./');
    for (const i of m.icons) expect(i.src.startsWith('/')).toBe(false);
    expect(read('src/pwa.ts')).toContain("register('sw.js', { scope: './' })");
    expect(precacheList(['index.html', 'assets/a.js']).every((f: string) => !f.startsWith('/'))).toBe(true);
  });
  it('the custom domain, .nojekyll and a home page that links to the game ship from website/', () => {
    expect(read('website/CNAME').trim()).toBe('sharpwise.co.uk');
    expect(read('website/.nojekyll')).toBe('');
    expect(read('website/index.html')).toContain('href="/play/"');
  });
  // #2088: the deploy makes the pictures the pages show; nothing under website/img/ is committed.
  it('runs the screenshot script into site/img after the site is assembled and the browser installed (#1935)', () => {
    const assemble = wf.indexOf('cp -a website/. site/');
    const install = wf.indexOf('npx playwright install --with-deps chromium');
    const shots = wf.indexOf('node scripts/site-shots.mjs http://localhost:4173/play/ site/img');
    const upload = wf.indexOf('uses: actions/upload-pages-artifact');
    expect(assemble, 'the step that copies website/ into site/').toBeGreaterThan(-1);
    expect(install, 'Chromium for the screenshots').toBeGreaterThan(assemble);
    expect(shots, 'the screenshots, from the assembled site, into site/img').toBeGreaterThan(install);
    expect(upload, 'and all of it before the upload').toBeGreaterThan(shots);
    expect(wf.slice(install, shots)).toContain('python3 -m http.server 4173 --directory site');
    expect(wf.slice(install, shots), 'a server that never starts says so').toContain('the local server never answered');
    // #2099 brings the script. Red until it is on main, so this cannot merge first and break every deploy.
    expect(existsSync(new URL('../../scripts/site-shots.mjs', import.meta.url)), 'scripts/site-shots.mjs (#2088) is on this branch').toBe(true);
  });
});

/**
 * #1935: website/ is script-free and loads nothing from anyone else. Before the site shell this rail forbade any
 * `https?://` at all; canonical, Open Graph and JSON-LD need absolute URLs, so the rule is now "no origin but
 * sharpwise.co.uk", plus the two store badge links and JSON-LD's own `@context` (a vocabulary name, never fetched).
 * The one script allowed is a JSON-LD data block, which no browser runs. Owner-approved on #1925.
 * #2087/#2105: the stores are allowed as the `href` of a link only, never as a source. Google's own badge snippet
 * hot-links its picture from play.google.com, which would load a file from Google on every visit.
 */
const SITE_ORIGINS = ['https://sharpwise.co.uk'];
const STORE_LINK = /(<a\b[^>]*?\shref=)(["'])https:\/\/(?:play\.google\.com|apps\.apple\.com)\/[^"']*\2/gi;
function offSite(html: string): string[] {
  const bad: string[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) if (!/^\s*type="application\/ld\+json"\s*$/.test(m[1])) bad.push(`<script${m[1]}>`);
  const urls = html.replace(STORE_LINK, '$1$2$2').replace(/"@context":\s*"https:\/\/schema\.org"/g, '').matchAll(/(?:\bhttps?:)?\/\/[^\s"'<>)]+/gi);
  for (const [u] of urls) if (!SITE_ORIGINS.some(o => u === o || u.startsWith(`${o}/`))) bad.push(u);
  return bad;
}
const sitePages = (dir = 'website'): string[] => readdirSync(new URL(`../../${dir}`, import.meta.url), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? sitePages(`${dir}/${e.name}`) : /\.(html|css)$|^llms\.txt$/.test(e.name) ? [`${dir}/${e.name}`] : []);   // not fonts/OFL.txt: the font licence, which no page loads

describe('website/ loads nothing from another origin and runs no script (#1933, #1935)', () => {
  it('flags a script, a foreign or plain-http origin and a protocol-relative URL, and passes the allowed ones', () => {
    expect(offSite('<script src="/a.js"></script> <script>x()</script>')).toEqual(['<script src="/a.js">', '<script>']);
    expect(offSite('<link href="https://fonts.googleapis.com/css"> <a href="http://sharpwise.co.uk/">')).toEqual(['https://fonts.googleapis.com/css', 'http://sharpwise.co.uk/']);
    expect(offSite('<img src="//cdn.example.com/x.png"> <a href="https://sharpwise.co.uk.evil.com/">')).toEqual(['//cdn.example.com/x.png', 'https://sharpwise.co.uk.evil.com/']);
    expect(offSite('<a href="https://schema.org/VideoGame">')).toEqual(['https://schema.org/VideoGame']);   // only as @context
    expect(offSite('<script type="application/ld+json">{"@context": "https://schema.org", "url": "https://sharpwise.co.uk/"}</script>' +
      '<a href="https://play.google.com/store/apps/details?id=x"></a><a href="https://apps.apple.com/gb/app/id1">')).toEqual([]);
  });
  it('allows a store only as a link, so its badge picture cannot be hot-linked (#2105)', () => {
    const google = "<a href='https://play.google.com/store/apps/details?id=uk.co.sharpwise'><img alt='Get it on Google Play' " +
      "src='https://play.google.com/intl/en_gb/badges/static/images/badges/en_badge_web_generic.png'/></a>";
    expect(offSite(google)).toEqual(['https://play.google.com/intl/en_gb/badges/static/images/badges/en_badge_web_generic.png']);
    expect(offSite('<link rel="preconnect" href="https://apps.apple.com"> <a data-x href="https://apps.apple.com/gb/app/id1">'))
      .toEqual(['https://apps.apple.com']);
    expect(offSite('<a class="badge" href="https://apps.apple.com/gb/app/id1"><img src="/badges/app-store.svg" alt="Download on the App Store"></a>')).toEqual([]);
  });
  it('every page, the stylesheet and llms.txt under website/ pass', () => {
    const files = sitePages();
    expect(files, 'the files it reads').toContain('website/index.html');
    expect(files).toContain('website/site.css');
    expect(files).toContain('website/llms.txt');
    for (const f of files) expect(offSite(read(f)), f).toEqual([]);
  });
});

