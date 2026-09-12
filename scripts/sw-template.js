/* eslint-disable */
// Service worker SOURCE for #15 Part A. `scripts/build-sw.mjs` substitutes the two placeholders below with
// values read from `dist/` and writes the result to `dist/sw.js`. Nothing hand-maintains a file list: a
// precache list typed by a human goes stale on the next hashed filename and then serves a game whose HTML
// asks for assets the cache does not have — a blank screen a reload cannot fix.
//
// This file is never shipped as-is and never imported by the app, so it is plain JS with no build step of
// its own. `dist/sw.js` is a build output and is not committed.
const CACHE = '__CACHE_NAME__';
const PRECACHE = __PRECACHE__;
/** The one document the game ever serves. Every launch URL is a view of it. */
const SHELL = 'index.html';
// Fredoka comes from Google Fonts at runtime (index.html), so it cannot be precached by URL — the CSS names
// woff2 files whose paths change. It is cached opportunistically instead: whatever the first online launch
// fetched is replayed offline. If it was never fetched, `src/ui/font.ts` gives up after its deadline and the
// game starts in the fallback face, which is the existing behaviour and is playable (#44).
const FONTS = 'sna-fonts-v1';
const FONT_HOSTS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  // `reload` bypasses the HTTP cache: precaching a response the browser had already cached from the previous
  // deployment would put a stale asset in a fresh cache under a new name, which is the one failure this
  // whole mechanism exists to prevent.
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // Every deployment gets its own CACHE name (derived from the precached files' CONTENTS), so a superseded
  // cache is one of ours that is not the current one. The `sna-` prefix is load-bearing: Cache Storage is
  // origin-scoped while this worker's scope is `./`, so on a sub-path deployment — the case `src/pwa.ts`
  // registers relatively for — "everything that is not mine" would silently destroy another app's offline
  // cache on this origin, and the symptom would appear in somebody else's project. (Raised in review.)
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('sna-') && k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/**
 * The app shell, served straight from this deployment's cache.
 *
 * It matches `index.html` explicitly rather than matching the navigation request, because the request is for
 * `/`, or `/?reset=1`, or `/?fast=4`, and NONE of those is the cache key `/index.html` — `ignoreSearch` drops
 * the query string, not the path, so relying on it would quietly turn this into network-first and only show
 * itself as a slow first paint. Every one of those URLs is the same document.
 *
 * IT DOES NOT REVALIDATE, and that is deliberate. CACHE is per-deployment, so writing a fresher `index.html`
 * into it would put a shell referencing `assets/index-NEW.js` into a cache that holds only `…-OLD.js`. That
 * is harmless while the new worker installs and `activate` drops the old cache — and permanent when it does
 * not: one non-ok response in `addAll`, or the player closing the tab between the 2 kB shell and the ~1.2 MB
 * precache, leaves the old worker alive with a cache whose shell asks for assets it will never hold. The
 * blank sky this whole mechanism exists to prevent, through a different door. A captive portal answering the
 * refresh with a 200 login page would have been cached as the app shell, permanently, on top of that.
 * Versioning already makes the refresh unnecessary: a new deployment brings a new worker, a new cache name
 * and a full precache, so a shell in a versioned cache is consistent with its own assets by construction.
 * (Raised in review of this PR.)
 */
async function shell() {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(SHELL, { ignoreVary: true });   // same reason as `asset()` below
  if (hit) return hit;
  // Only before this worker has ever finished installing, or after the browser has evicted the cache.
  return fetch(SHELL).catch(() => Response.error());
}

/**
 * Stale-while-revalidate, for the one thing that cannot be precached by URL.
 *
 * Honest about its reach: `index.html` loads the Fredoka stylesheet WITHOUT `crossorigin`, so the response is
 * opaque (`status 0`, `ok === false`) and the `res.ok` gate below never stores it. So today this caches
 * nothing and the offline face is the fallback — which is the accepted behaviour (#44) rather than a
 * regression, and `src/ui/font.ts` degrades to it after its 1200 ms deadline. The handler is here because it
 * is the right shape for when #44 settles how the font arrives; it is not doing anything yet.
 * (Raised in review of this PR.)
 */
async function font(e, req) {
  const cache = await caches.open(FONTS);
  const refresh = fetch(req)
    .then(res => (res && res.ok ? cache.put(req, res.clone()).then(() => res) : res))
    .catch(() => undefined);
  e.waitUntil(refresh);
  const hit = await cache.match(req);
  if (hit) return hit;
  return (await refresh) ?? Response.error();
}

/**
 * Same-origin assets, cache-first. Everything precached is content-hashed or an avatar that changes only
 * with a deployment, so a hit is always current for this CACHE and is served without touching the network.
 * A miss that cannot be fetched rejects, exactly as it would with no worker installed: a synthetic empty 200
 * would tell the app the asset arrived, which is the lie this project keeps writing rails against.
 */
async function asset(req) {
  const cache = await caches.open(CACHE);
  // `ignoreVary` is load-bearing, not tidiness. The server sends `Vary: Origin` (vite preview does, and so
  // does most anything behind a CDN), and Vite marks the module script and the stylesheet `crossorigin`, so
  // the page requests them WITH an `Origin` header while the precache stored them with none. Without this,
  // `match` fails the Vary comparison for exactly those two files: offline you get the shell, an empty
  // `#app`, and no error anywhere — the blank sky this whole mechanism exists to prevent. The precache is
  // keyed by URL and we control every entry in it, so varying headers cannot select a different response.
  // Caught by the `offline (#15)` e2e rail; before the rail existed it passed locally only because the
  // browser's own HTTP cache was answering.
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  // `.catch` because this is not awaited: a QuotaExceededError here must not become an unhandled rejection,
  // and failing to cache an asset we have already fetched costs the player nothing. (Raised in review.)
  if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') { e.respondWith(shell()); return; }
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.origin)) { e.respondWith(font(e, req)); return; }
  if (url.origin === self.location.origin) { e.respondWith(asset(req)); return; }
  // Anything else (a third-party the game does not have) is left to the network, untouched.
});
