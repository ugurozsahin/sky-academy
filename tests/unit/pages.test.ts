import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { precacheList } from '../../scripts/build-sw.mjs';

/** #1933: the game is served from `/play/` on GitHub Pages. These rails hold the pieces that make that safe. */
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const wf = read('.github/workflows/pages.yml');
/** A step is fatal when nothing in it can swallow a failure. */
const fatal = (step: string) => !/continue-on-error|^\s+if:|\|\|\s*(true|:)|\bset \+e\b/m.test(step);

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
    // #2105: a non-fatal step would deploy pages whose /img/ pictures are missing, and stay green.
    const step = wf.slice(wf.indexOf('- name: Screenshots into site/img'), upload);
    expect(step, 'the screenshot step').toContain('site-shots.mjs');
    expect(fatal(step), 'must fail the deploy when a shot fails').toBe(true);
    // #2099 brings the script. Red until it is on main, so this cannot merge first and break every deploy.
    expect(existsSync(new URL('../../scripts/site-shots.mjs', import.meta.url)), 'scripts/site-shots.mjs (#2088) is on this branch').toBe(true);
  });
});

/**
 * #1935: website/ is script-free and loads nothing from anyone else. Before the site shell this rail forbade any
 * `https?://` at all; canonical, Open Graph and JSON-LD need absolute URLs, so the rule is now "no origin but
 * sharpwise.co.uk", plus the two store badge links, two official-site links (#2132) and JSON-LD's own `@context` (a vocabulary name, never fetched).
 * The scripts allowed: a JSON-LD data block, which no browser runs (owner-approved on #1925), and, since #2174, exactly
 * `<script src="/nav.js" defer></script>`, the first-party file that closes the Curriculum menu, with nothing inline
 * (owner-approved in session on 2026-10-21, recorded on #2174). site-nav-script.test.ts holds what nav.js may do.
 * #2087/#2105: the stores are allowed as the `href` of a link only, never as a source. Google's own badge snippet
 * hot-links its picture from play.google.com, which would load a file from Google on every visit. A store URL in
 * JSON-LD (`sameAs`, `installUrl`) fails this rail too, deliberately: it needs its own allow-list entry (#2113).
 */
const SITE_ORIGINS = ['https://sharpwise.co.uk'];
const STORE_HREF = /^https:\/\/(?:play\.google\.com|apps\.apple\.com)\/[^"'<>\s]*$/i;
/** #2132: plain outbound links to two official sites (owner, 2026-10-21): an exact, explicit list of hosts, as the `href`
 *  of an `<a>` whose first `rel` is `noopener`, never a source, `srcset`, `<link>`, CSS or JSON-LD. A new host is a new owner decision. */
const OFFICIAL_HOSTS = ['ico.org.uk', 'www.gov.uk'];
const OFFICIAL_HREF = new RegExp(`^https://(?:${OFFICIAL_HOSTS.map(h => h.replace(/\./g, '\\.')).join('|')})/[^"'<>\\s]*$`, 'i');
/** #2241: a real tag, found by walking quoted values whole, so an `<a` written inside another tag's attribute is never a tag of its own. */
const TAG = /<([a-z][a-z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi;
const ATTR = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
/** The first `href` (value span, quoted only) and the first `rel` value of a tag's attributes: browsers keep the first of a repeated attribute. */
function firstAttrs(attrs: string): { href?: { start: number; end: number; value: string }; rel?: string } {
  const out: { href?: { start: number; end: number; value: string }; rel?: string } = {};
  const seen = new Set<string>();
  for (const m of attrs.matchAll(ATTR)) {
    const key = m[1].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const quoted = m[2] ?? m[3];
    if (key === 'rel') out.rel = quoted ?? m[4] ?? '';
    if (key === 'href' && quoted !== undefined) {
      const start = m.index + m[0].length - 1 - quoted.length;
      out.href = { start, end: start + quoted.length, value: quoted };
    }
  }
  return out;
}
/** Blank the allowed link's href value: only an `<a>`'s first `href` counts and, for the official hosts, only when its first `rel` is `noopener`. */
function blankAllowedHref(name: string, attrs: string): string {
  if (name.toLowerCase() !== 'a') return attrs;
  const { href, rel } = firstAttrs(attrs);
  if (!href) return attrs;
  const allowed = STORE_HREF.test(href.value) || (rel === 'noopener' && OFFICIAL_HREF.test(href.value));
  return allowed ? attrs.slice(0, href.start) + attrs.slice(href.end) : attrs;
}
const NAV_SCRIPT = '<script src="/nav.js" defer></script>';
function offSite(html: string): string[] {
  const bad: string[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    if (/^\s*type="application\/ld\+json"\s*$/.test(m[1]) || html.startsWith(NAV_SCRIPT, m.index)) continue;
    bad.push(`<script${m[1]}>`);
  }
  for (const [tag] of html.matchAll(/<[a-z][^>]*>/gi)) for (const [h] of tag.matchAll(/(?<=\s)on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi)) bad.push(h);   // an inline handler is script by another name (#2105)
  for (const [j] of html.matchAll(/javascript:[^"'\s>]*/gi)) bad.push(j);
  const urls = html.replace(TAG, (_t, name, attrs) => `<${name}${blankAllowedHref(name, attrs)}>`).replace(/"@context":\s*"https:\/\/schema\.org"/g, '').matchAll(/(?:\bhttps?:)?\/\/[^\s"'<>)]+/gi);
  for (const [u] of urls) if (!SITE_ORIGINS.some(o => u === o || u.startsWith(`${o}/`))) bad.push(u);
  return bad;
}
const sitePages = (dir = 'website'): string[] => readdirSync(new URL(`../../${dir}`, import.meta.url), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? sitePages(`${dir}/${e.name}`) : /\.(html|css)$|^llms\.txt$/.test(e.name) ? [`${dir}/${e.name}`] : []);   // not fonts/OFL.txt: the font licence, which no page loads

describe('the screenshot-step rail sees a non-fatal step (#2105)', () => {
  it('flags continue-on-error, an if:, || true and set +e', () => {
    const ok = '      - name: Screenshots into site/img\n        run: |\n          node scripts/site-shots.mjs a b\n';
    expect(fatal(ok)).toBe(true);
    expect(fatal(ok.replace('        run:', '        continue-on-error: true\n        run:'))).toBe(false);
    expect(fatal(ok.replace('        run:', "        if: always()\n        run:"))).toBe(false);
    expect(fatal(ok.replace('a b\n', 'a b || true\n'))).toBe(false);
    expect(fatal(ok.replace('a b\n', 'a b || :\n'))).toBe(false);
    expect(fatal('set +e\n' + ok)).toBe(false);
  });
});

describe('website/ loads nothing from another origin and runs no script but /nav.js (#1933, #1935, #2174)', () => {
  it('flags any other script, from a file or inline', () => {
    expect(offSite('<script src="/a.js"></script> <script>x()</script>')).toEqual(['<script src="/a.js">', '<script>']);
  });
  it('allows /nav.js only as the exact deferred, empty tag (#2174)', () => {
    expect(offSite(NAV_SCRIPT)).toEqual([]);
    expect(offSite('<script src="/nav.js" defer>x()</script>')).toEqual(['<script src="/nav.js" defer>']);
    expect(offSite('<script src="/nav.js"></script>')).toEqual(['<script src="/nav.js">']);
    expect(offSite('<script src="/nav.js" async></script>')).toEqual(['<script src="/nav.js" async>']);
    expect(offSite('<script defer src="/nav.js"></script>')).toEqual(['<script defer src="/nav.js">']);
    expect(offSite('<script src="/nav.js" defer type="module"></script>')).toEqual(['<script src="/nav.js" defer type="module">']);
    expect(offSite('<script src="/menu.js" defer></script>')).toEqual(['<script src="/menu.js" defer>']);
    expect(offSite(`${NAV_SCRIPT}<script>x()</script>`)).toEqual(['<script>']);
  });
  it('flags a foreign or plain-http origin and a protocol-relative URL, and passes the allowed ones', () => {
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
  it('allows ico.org.uk and www.gov.uk only as a noopener link, never as a source or from another host (#2132)', () => {
    expect(offSite('<a href="https://ico.org.uk/make-a-complaint/" rel="noopener">ICO</a>' +
      '<a rel="noopener" href=\'https://www.gov.uk/government/collections/national-curriculum\'>NC</a>')).toEqual([]);
    expect(offSite('<img src="https://www.gov.uk/logo.png" alt="">')).toEqual(['https://www.gov.uk/logo.png']);
    expect(offSite('<link rel="stylesheet" href="https://ico.org.uk/a.css">')).toEqual(['https://ico.org.uk/a.css']);
    expect(offSite('<a href="https://ico.org.uk/x">no rel</a>')).toEqual(['https://ico.org.uk/x']);
    expect(offSite('<a rel="noopener" href="https://www.bbc.co.uk/bitesize">BBC</a>')).toEqual(['https://www.bbc.co.uk/bitesize']);
    expect(offSite('<a rel="noopener" href="https://gov.uk.evil.com/">x</a><a rel="noopener" href="https://sub.ico.org.uk/">y</a>'))
      .toEqual(['https://gov.uk.evil.com/', 'https://sub.ico.org.uk/']);
    const fails = (href: string) => expect(offSite(`<a rel="noopener" href="${href}">x</a>`), href).toEqual([href]);
    for (const h of ['https://wwwxgov.uk/', 'https://icoxorg.uk/', 'https://www.gov.uk.evil.com/', 'https://ico.org.uk.evil.com/', 'https://ico.org.uk@evil.com/', 'https://ico.org.uk:444/', 'https://www.gov.uk:444/x']) fails(h);
    expect(offSite('<link rel="noopener" href="https://www.gov.uk/x">')).toEqual(['https://www.gov.uk/x']);
    expect(offSite('<a rel="noopener" ping="https://www.gov.uk/p" href="https://www.gov.uk/x">x</a>')).toEqual(['https://www.gov.uk/p']);
    expect(offSite('<a rel="noopener" href="https://ico.org.uk/x" ping="https://ico.org.uk/p">x</a>')).toEqual(['https://ico.org.uk/p']);
    // #2241: an `<a` inside another tag's attribute value is not a tag, and only an `<a>`'s first `rel` counts
    expect(offSite('<a rel="noopener" href="https://evil.com/x">')).toEqual(['https://evil.com/x']);
    expect(offSite('<link rel="stylesheet" title=\'<a rel="noopener"\' href="https://ico.org.uk/x.css">')).toEqual(['https://ico.org.uk/x.css']);
    expect(offSite('<link rel="stylesheet" title="<a" href="https://apps.apple.com/x.css">')).toEqual(['https://apps.apple.com/x.css']);
    expect(offSite('<a rel="nofollow" rel="noopener" href="https://ico.org.uk/x">')).toEqual(['https://ico.org.uk/x']);
    expect(offSite('<a href="/ok/" href="https://apps.apple.com/x">')).toEqual(['https://apps.apple.com/x']);
    // the allowed path stops at a quote, an angle bracket or a space, so an HTML comment cannot hide a source inside it
    expect(offSite('<!-- <a rel="noopener" href="https://www.gov.uk/x --> <img src=https://evil.com/p.png> <!-- ">'))
      .toEqual(['https://www.gov.uk/x', 'https://evil.com/p.png']);
    expect(offSite('<!-- <a href="https://apps.apple.com/x --> <img src=https://evil.com/p.png> <!-- ">'))
      .toEqual(['https://apps.apple.com/x', 'https://evil.com/p.png']);
  });
  it('flags an inline event handler and a javascript: URL, however the attribute is spelled (#2105)', () => {
    expect(offSite('<button onclick="menu()">')).toEqual(['onclick="menu()"']);
    expect(offSite("<img src='/a.png' onerror='x()'>")).toEqual(["onerror='x()'"]);
    expect(offSite('<body\nONLOAD=go()>')).toEqual(['ONLOAD=go()']);
    expect(offSite('<a href="javascript:void(0)">')).toEqual(['javascript:void(0)']);
    expect(offSite('<a href=" JavaScript:x()">')).toEqual(['JavaScript:x()']);
    expect(offSite('<p>one online shop, a button that says on=ready</p> <a data-on="x" href="/a/">')).toEqual([]);
  });
  it('every page, the stylesheet and llms.txt under website/ pass', () => {
    const files = sitePages();
    expect(files, 'the files it reads').toContain('website/index.html');
    expect(files).toContain('website/site.css');
    expect(files).toContain('website/llms.txt');
    for (const f of files) expect(offSite(read(f)), f).toEqual([]);
  });
});

