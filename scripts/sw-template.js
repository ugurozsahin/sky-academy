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

/**
 * Fills `cache` with every precached file. `reload` bypasses the HTTP cache: precaching a response the browser
 * had already cached from the previous deployment would put a stale asset in a fresh cache under a new name,
 * which is the one failure this whole mechanism exists to prevent. `addAll` is atomic — one failed fetch
 * stores nothing — so a cache is either whole or empty, never a shell whose assets are missing.
 */
function precache(cache) {
  return cache.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' })));
}

/**
 * Cache Storage, or `null` when it cannot be opened (#116 item 5). Blocked site data, a corrupt store or a
 * full disk make `caches.open()` reject, and a rejection handed to `respondWith` is a browser error page — for
 * a game the network would have served. Every handler below takes `null` as "go to the network": a storage
 * failure degrades to no worker at all, never to an error. `install` still uses `caches.open` directly: a
 * worker that cannot store its precache must fail to install, so the previous one (or none) keeps control.
 * `tests/unit/pwa.test.ts` pins that: `.then(c => c && precache(c))` here would install with an empty cache (#633).
 *
 * @returns {Promise<Cache | null>}
 */
async function open(name) {
  try { return await caches.open(name); } catch { return null; }
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(precache).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // Every deployment gets its own CACHE name (derived from the precached files' CONTENTS), so a superseded
  // cache is one of ours that is not the current one. The `sna-` prefix is load-bearing: Cache Storage is
  // origin-scoped while this worker's scope is `./`, so on a sub-path deployment — the case `src/pwa.ts`
  // registers relatively for — "everything that is not mine" would silently destroy another app's offline
  // cache on this origin, and the symptom would appear in somebody else's project. (Raised in review.)
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('sna-') && k !== CACHE).map(k => caches.delete(k))))
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
 * A HIT DOES NOT REVALIDATE, and that is deliberate. CACHE is per-deployment, so writing a fresher `index.html`
 * into it on its own would put a shell referencing `assets/index-NEW.js` into a cache that holds only `…-OLD.js`. That
 * is harmless while the new worker installs and `activate` drops the old cache — and permanent when it does
 * not: one non-ok response in `addAll`, or the player closing the tab between the 2 kB shell and the ~1.2 MB
 * precache, leaves the old worker alive with a cache whose shell asks for assets it will never hold. The
 * blank sky this whole mechanism exists to prevent, through a different door. A captive portal answering the
 * refresh with a 200 login page would have been cached as the app shell, permanently, on top of that.
 * Versioning already makes the refresh unnecessary: a new deployment brings a new worker, a new cache name
 * and a full precache, so a shell in a versioned cache is consistent with its own assets by construction.
 * (Raised in review of this PR.)
 *
 * The one other writer is the rebuild below, and it keeps the rule rather than breaking it: it runs only on a
 * MISS, when there is no shell to be inconsistent with, and it fills the shell and every asset together in one
 * atomic `addAll` (all or nothing). What it fetched is whatever the server serves NOW, so it then reads the
 * stored shell back and requires every `assets/…` file it names to be in this deployment's PRECACHE. If a host
 * still serving superseded assets under the old name handed it a newer shell, the shell is deleted again and
 * the rebuild gives up: the cache is back to a miss, never a shell beside assets it will not hold (#635).
 *
 * A MISS means the browser evicted the cache (#116 item 5). A worker only handles fetches once it is active,
 * and `install` cannot complete without the precache, so under a controlling worker the shell is either there
 * or the whole origin's storage has been dropped — iOS Safari does that after about seven days without a
 * visit, the half-term shape for a school app. Before this, `addAll` ran in `install` and never again: the
 * game loaded online, rebuilt nothing, and was dead the next time there was no signal, until the next
 * deployment. Now a miss serves the network at once and rebuilds the precache behind it, in `waitUntil` so
 * the browser does not stop the worker mid-way.
 */
async function shell(e) {
  const cache = await open(CACHE);
  if (!cache) return fetch(SHELL).catch(() => Response.error());
  const hit = await cache.match(SHELL, { ignoreVary: true });   // same reason as `asset()` below
  if (hit) return hit;
  e.waitUntil(rebuild(cache));
  return fetch(SHELL).catch(() => Response.error());
}

/** The one rebuild in flight, so two tabs missing the shell together do not download the game twice. It
 *  ignores `cache` after the first call, which is safe only because `CACHE` is a single constant: a second
 *  cache name must not reuse it. */
let rebuilding = null;
function rebuild(cache) {
  if (!rebuilding) rebuilding = attempt(cache).catch(() => {}).then(() => { rebuilding = null; });
  return rebuilding;
}

/**
 * Bounded retries (#635). A rebuild fails in two ways, and only one of them is worth another go.
 *  - Offline, or a non-ok answer: `addAll` rejects with a `TypeError` having stored nothing and, offline,
 *    downloaded nothing. The next launch simply tries again; it costs nothing.
 *  - Anything else (`QuotaExceededError` on a full device, a corrupt store, a shell from another deployment):
 *    the ~1.2 MB WAS fetched and cannot be kept, so trying again on every launch would pay it every launch.
 *    The worker gives up for `RETRY_AFTER`, in memory and by a marker inside CACHE (an idle worker is killed
 *    within seconds, so memory alone forgets before the next launch). The marker lives in this deployment's
 *    cache, so a new deployment starts clean and the old one's marker goes with its cache. Giving up costs
 *    the player nothing they have today: a shell miss already serves the network (they lose offline play
 *    until the device has room, or a day passes).
 * The failure is swallowed because nothing awaits it that could act on it, and an unhandled rejection would
 * be a console error on every launch. (#116 item 5)
 */
const GAVE_UP = 'rebuild-gave-up';
const RETRY_AFTER = 24 * 60 * 60 * 1000;
let gaveUpAt = 0;

async function attempt(cache) {
  if (!(await mayRebuild(cache))) return;
  try { await precache(cache); } catch (err) {
    if (err && err.name === 'TypeError') return;
    return giveUp(cache);
  }
  if (!(await sameDeployment(cache))) {
    await cache.delete(SHELL).catch(() => {});
    await giveUp(cache);
  }
}

async function mayRebuild(cache) {
  if (backingOff(gaveUpAt)) return false;
  const mark = await cache.match(GAVE_UP).catch(() => undefined);
  const at = mark ? Number(await mark.clone().text().catch(() => 0)) : 0;
  return !backingOff(at);
}

/** A timestamp from the future (a clock that was ahead and has been corrected) is expired, not a ban for years. */
function backingOff(at) {
  const age = Date.now() - at;
  return at > 0 && age >= 0 && age < RETRY_AFTER;
}

async function giveUp(cache) {
  gaveUpAt = Date.now();
  await cache.put(GAVE_UP, new Response(String(gaveUpAt))).catch(() => {});
}

/** True when every hashed file the stored shell names is one this deployment precached. */
async function sameDeployment(cache) {
  const hit = await cache.match(SHELL, { ignoreVary: true });
  const html = hit ? await hit.clone().text() : '';
  return (html.match(/assets\/[^"'\s)>]+\.\w+/g) || []).every(f => PRECACHE.includes(f));
}

/**
 * Same-origin assets, cache-first. Everything precached is content-hashed or an avatar that changes only
 * with a deployment, so a hit is always current for this CACHE and is served without touching the network.
 * A miss that cannot be fetched rejects, exactly as it would with no worker installed: a synthetic empty 200
 * would tell the app the asset arrived, which is the lie this project keeps writing rails against.
 */
async function asset(req) {
  const cache = await open(CACHE);
  if (!cache) return fetch(req);
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
  if (req.mode === 'navigate') { e.respondWith(shell(e)); return; }
  const url = new URL(req.url);
  if (url.origin === self.location.origin) { e.respondWith(asset(req)); return; }
  // Anything else (a third party the game does not have, a font host included: the font is self-hosted since #479) is left to the network, untouched.
});
