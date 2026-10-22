import { readFileSync } from 'node:fs';
import { test, expect } from '../e2e/fixtures';
import { serve } from '../../scripts/site-serve.mjs';

/**
 * #2096: every page `website/sitemap.xml` lists, opened at a 360 px phone and served the way the Pages deploy lays
 * the site out (`scripts/site-serve.mjs`: website/ at `/`, the built game at `/play/`). Three checks a page PR
 * used to make by hand:
 *   - the page does not scroll sideways;
 *   - every on-site link on it answers 200 with no redirect, the header and footer navigation included;
 *   - no request leaves the page's own origin. Nothing is allowed through: a font, a script or a picture from
 *     anywhere else is a third party that sees the reader. A link out (`<a href="https://ico.org.uk/…">`) is not a
 *     request, so it is neither followed nor counted.
 * #2162: a same-origin response that is not 2xx/304 fails the page (a stylesheet, font or icon that 404s), except under
 * `/img/` (screenshots made at deploy time, #2088); and `website/404.html`, which no sitemap lists, is walked too, by
 * asking for an address that does not exist and so must answer 404 with it, at a depth no page has.
 * `/play/` is in the sitemap but is the game, not a page of website/: it is served here from dist/ (built for `/`,
 * not for `/play/` as the deploy builds it), so only its link must answer, never its page be walked.
 */
const ORIGIN = 'https://sharpwise.co.uk';
const GAME = '/play/';
const locs = [...readFileSync('website/sitemap.xml', 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const pages = locs.map(l => l.slice(ORIGIN.length)).filter(p => p !== GAME);
const LOST = '/no-such-page/at/any-depth/';          // served website/404.html with status 404
const DEPLOY_TIME = '/img/';                          // screenshots are made at deploy time (#2088), so they may be absent here
const walked: Array<[string, number]> = [...pages.map((p): [string, number] => [p, 200]), [LOST, 404]];

let site: { origin: string; close: () => Promise<void> };
test.beforeAll(async () => { site = await serve(); });
test.afterAll(async () => { await site?.close(); });

test('the sitemap lists the pages this walks, every one on sharpwise.co.uk', () => {
  expect(locs.length, 'website/sitemap.xml must be read and list its pages, or nothing below runs').toBeGreaterThanOrEqual(10);
  expect(locs.filter(l => !l.startsWith(`${ORIGIN}/`)), 'a sitemap entry off the site').toEqual([]);
  expect(pages).toContain('/');
});

for (const [path, status] of walked) {
  test(`${path} at 360 px: no sideways scroll, every on-site link answers 200, nothing leaves the origin`, async ({ page }) => {
    const outbound: string[] = [];
    await page.route('**/*', route => {
      const url = route.request().url();
      if (!/^(https?|wss?):/.test(url) || new URL(url).origin === site.origin) return route.continue();   // a data: URL is no request
      outbound.push(url);
      return route.abort('blockedbyclient');
    });
    page.on('websocket', ws => outbound.push(ws.url()));
    const failed: string[] = [];
    page.on('response', r => {
      const u = new URL(r.url());
      if (u.origin !== site.origin || u.pathname === path || u.pathname.startsWith(DEPLOY_TIME)) return;
      if (!r.ok() && r.status() !== 304) failed.push(`${u.pathname} → ${r.status()}`);
    });
    const res = await page.goto(site.origin + path, { waitUntil: 'load' });
    expect(res?.status(), `${path} must answer ${status}`).toBe(status);
    expect(res?.request().redirectedFrom()?.url(), `${path} must answer itself, not redirect`).toBeUndefined();
    // A lazy picture below the fold is never fetched at this height: fetch every one now, so one that would leave
    // the origin is seen here rather than only by a reader who scrolls.
    await page.evaluate(() => document.querySelectorAll('[loading="lazy"]').forEach(e => e.setAttribute('loading', 'eager')));
    await page.waitForLoadState('networkidle');
    expect(failed, `${path} loads on-site files that do not answer`).toEqual([]);
    expect(outbound, `${path} asked for something off its own origin`).toEqual([]);

    const { scroll, view } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, view: document.documentElement.clientWidth }));
    expect(view, 'the page is laid out at the phone width').toBe(360);
    expect(scroll, `${path} scrolls sideways at 360 px: something is ${scroll} px wide`).toBeLessThanOrEqual(view);

    const hrefs = await page.$$eval('a[href]', as => as.map(a => a.getAttribute('href') ?? ''));
    const onSite = new Set<string>(), here = new URL(page.url()), anchors = new Set<string>();
    for (const href of hrefs) {
      const url = new URL(href, page.url());
      if (url.origin === site.origin || url.origin === ORIGIN) onSite.add(url.pathname + url.search);
      if (url.origin === site.origin && url.pathname === here.pathname && url.hash) anchors.add(decodeURIComponent(url.hash.slice(1)));
    }
    const lost = await page.evaluate(ids => ids.filter(id => !document.getElementById(id)), [...anchors]);
    expect(lost, `${path} links to spots on itself that no element carries`).toEqual([]);
    expect(onSite.size, `${path} must link somewhere on the site`).toBeGreaterThan(0);
    const broken: string[] = [];
    for (const target of onSite) {
      if (target === path) continue;   // the skip link's `#main` is the page itself, which answers `status`, not 200
      const status = (await page.request.get(site.origin + target, { maxRedirects: 0 })).status();
      if (status !== 200) broken.push(`${target} → ${status}`);
    }
    expect(broken, `${path} links to pages that do not answer 200`).toEqual([]);
  });
}
