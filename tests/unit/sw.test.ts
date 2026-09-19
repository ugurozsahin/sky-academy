import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderSw } from '../../scripts/build-sw.mjs';

/**
 * The service worker itself, driven in a `vm` context (#15, asked for in review of #214).
 *
 * Before this file, `scripts/sw-template.js` had no executable coverage at all: the only assertions about it
 * were that its *text* still held two placeholders, and the e2e rail — which needs a browser, takes 13
 * minutes and, as this branch found out twice, can be satisfied by Chromium's own HTTP cache. Both bugs this
 * branch has already had (`shell()` matching the navigation request instead of `index.html`; `asset()`
 * missing on `Vary: Origin`) lived in here, and both were found by hand.
 *
 * The fakes below are deliberately literal about the two behaviours that bite: `match` honours `Vary` unless
 * `ignoreVary` is passed, and `addAll` is all-or-nothing.
 */

const TEMPLATE = readFileSync(new URL('../../scripts/sw-template.js', import.meta.url), 'utf8');
const ORIGIN = 'https://sky.test';
const BASE = `${ORIGIN}/`;

type Res = { ok: boolean; status: number; type: string; body: string; headers: Map<string, string>; clone(): Res };
const res = (body: string, o: Partial<Res> = {}): Res => ({
  ok: true, status: 200, type: 'basic', body, headers: new Map(),
  clone() { return { ...this, clone: this.clone }; }, ...o,
});

class FakeCache {
  entries = new Map<string, { req: { url: string; headers: Map<string, string> }; res: Res }>();
  constructor(private server: Server) {}
  async addAll(reqs: { url: string; headers: Map<string, string> }[]) {
    const got: [typeof reqs[0], Res][] = [];
    for (const r of reqs) {
      const v = this.server.get(r);
      if (!v || !v.ok) throw new TypeError('addAll: request failed');   // all-or-nothing, like the real thing
      got.push([r, v]);
    }
    for (const [r, v] of got) this.entries.set(r.url, { req: r, res: v });
  }
  async put(req: string | { url: string; headers: Map<string, string> }, v: Res) {
    const r = typeof req === 'string' ? { url: new URL(req, BASE).href, headers: new Map<string, string>() } : req;
    this.entries.set(r.url, { req: r, res: v });
  }
  async match(req: string | { url: string; headers: Map<string, string> }, opts: { ignoreVary?: boolean } = {}) {
    const r = typeof req === 'string' ? { url: new URL(req, BASE).href, headers: new Map<string, string>() } : req;
    const hit = this.entries.get(r.url);
    if (!hit) return undefined;
    if (!opts.ignoreVary) {
      // The real rule, and the one that cost this branch a red CI: every header named in the stored
      // response's `Vary` must match between the stored request and the incoming one.
      const vary = hit.res.headers.get('vary');
      if (vary) for (const h of vary.split(',').map(x => x.trim().toLowerCase())) {
        if (hit.req.headers.get(h) !== r.headers.get(h)) return undefined;
      }
    }
    return hit.res;
  }
  async keys() { return [...this.entries.values()].map(e => e.req); }
}

/** What the network would answer, and what it charged for it. */
type Server = { get(req: { url: string }): Res | undefined; hits: string[] };

function drive(files: Record<string, Res>, opts: { offline?: boolean } = {}) {
  const server: Server = {
    hits: [],
    get(req) {
      server.hits.push(req.url);
      if (opts.offline) return undefined;
      return files[new URL(req.url, BASE).pathname.replace(/^\//, '')];
    },
  };
  const caches = new Map<string, FakeCache>();
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const claimed = { skipWaiting: 0, claim: 0 };
  const waits: Promise<unknown>[] = [];

  const cachesApi = {
    async open(name: string) { if (!caches.has(name)) caches.set(name, new FakeCache(server)); return caches.get(name)!; },
    async keys() { return [...caches.keys()]; },
    async delete(name: string) { return caches.delete(name); },
  };
  const sandbox = {
    self: {
      location: { origin: ORIGIN, href: `${ORIGIN}/sw.js` },
      addEventListener: (t: string, fn: (e: unknown) => void) => { (listeners[t] ??= []).push(fn); },
      skipWaiting: () => { claimed.skipWaiting++; return Promise.resolve(); },
      clients: { claim: () => { claimed.claim++; return Promise.resolve(); } },
    },
    caches: cachesApi,
    URL,
    Request: function (url: string, init: { cache?: string } = {}) {
      return { url: new URL(url, BASE).href, headers: new Map<string, string>(), cache: init.cache };
    } as unknown as typeof Request,
    Response: { error: () => res('', { ok: false, status: 0, type: 'error' }) },
    fetch: async (req: string | { url: string }) => {
      const r = typeof req === 'string' ? { url: new URL(req, BASE).href } : req;
      const v = server.get(r);
      if (!v) throw new TypeError('Failed to fetch');
      return v;
    },
  };
  runInNewContext(renderSw(TEMPLATE, Object.keys(files), Object.entries(files).map(([k, v]) => `${k}\0${v.body}`)), sandbox);

  const fire = async (type: string, event: Record<string, unknown>) => {
    let responded: Promise<Res> | undefined;
    const e = {
      ...event,
      waitUntil: (p: Promise<unknown>) => { waits.push(p); },
      respondWith: (p: Promise<Res>) => { responded = p; },
    };
    for (const fn of listeners[type] ?? []) fn(e);
    await Promise.all(waits.splice(0));
    return responded ? await responded.catch((err: Error) => ({ thrown: err }) as unknown as Res) : undefined;
  };
  const request = (url: string, extra: Record<string, unknown> = {}) =>
    ({ url: new URL(url, BASE).href, method: 'GET', mode: 'no-cors', headers: new Map<string, string>(), ...extra });

  return { fire, request, caches, cachesApi, claimed, server, sandbox };
}

const BUILD = () => ({
  'index.html': res('<div id="app"></div>'),
  // Exactly the two files Vite marks `crossorigin`, answered with the header that broke this branch.
  'assets/app.js': res('boot()', { headers: new Map([['vary', 'Origin']]) }),
  'assets/app.css': res('.hero{}', { headers: new Map([['vary', 'Origin']]) }),
  'avatars/blaze.webp': res('ART'),
});

describe('the service worker, driven (#15)', () => {
  let sw: ReturnType<typeof drive>;
  beforeEach(async () => { sw = drive(BUILD()); await sw.fire('install', {}); });

  it('precaches every file in the list and takes over at once', async () => {
    const cache = [...sw.caches.values()][0];
    expect([...cache.entries.keys()].map(u => u.replace(BASE, '')).sort())
      .toEqual(['assets/app.css', 'assets/app.js', 'avatars/blaze.webp', 'index.html']);
    expect(sw.claimed.skipWaiting, 'a new worker must not sit waiting behind the old one').toBe(1);
  });

  it('serves a same-origin asset from the cache even when the server sent `Vary: Origin`', async () => {
    // The f936deb bug, as an executable test: the page asks for the module with an `Origin` header because
    // Vite marks it `crossorigin`; the precache stored it without one.
    const req = sw.request('/assets/app.js', { headers: new Map([['origin', ORIGIN]]) });
    sw.server.hits.length = 0;
    const out = await sw.fire('fetch', { request: req });
    expect(out?.body).toBe('boot()');
    expect(sw.server.hits, 'and it must not have touched the network to do it').toEqual([]);
  });

  it('serves the shell for any launch URL, query string or not', async () => {
    for (const url of ['/', '/?reset=1', '/?fast=4']) {
      const out = await sw.fire('fetch', { request: sw.request(url, { mode: 'navigate' }) });
      expect(out?.body, `${url} is the same document`).toBe('<div id="app"></div>');
    }
  });

  it('never writes a fresher shell into this deployment’s cache', async () => {
    // Item 2 of the #214 review. A refresh here would put a shell naming `assets/app-NEW.js` into a cache
    // holding only the old asset — and if this worker's successor never finishes installing, that pairing is
    // what the next offline launch gets: a rendered page whose script 404s out of the cache, for ever.
    const cache = [...sw.caches.values()][0];
    sw.server.get = (r) => (r.url.endsWith('index.html') ? res('<div id="app">NEWER DEPLOYMENT</div>') : undefined);
    await sw.fire('fetch', { request: sw.request('/', { mode: 'navigate' }) });
    expect((await cache.match('index.html'))?.body, 'the precached shell must be untouched')
      .toBe('<div id="app"></div>');
  });

  it('deletes its own superseded caches and leaves every other app on the origin alone', async () => {
    // Item 3. Cache Storage is origin-scoped; this worker's scope is `./`, so on a sub-path deployment
    // "everything that is not mine" is somebody else's offline support.
    const mine = [...sw.caches.keys()].find(k => k.startsWith('sna-'))!;
    await sw.cachesApi.open('sna-OLDDEPLOYMENT');
    await sw.cachesApi.open('another-app-v3');
    await sw.fire('activate', {});
    const left = await sw.cachesApi.keys();
    expect(left).toContain(mine);
    expect(left, 'a superseded cache of ours goes').not.toContain('sna-OLDDEPLOYMENT');
    expect(left, "another app's cache stays").toContain('another-app-v3');
    expect(sw.claimed.claim).toBe(1);
  });

  it('keeps the font cache across deployments', async () => {
    await sw.cachesApi.open('sna-fonts-v1');
    await sw.fire('activate', {});
    expect(await sw.cachesApi.keys()).toContain('sna-fonts-v1');
  });

  it('plays the whole build back with the network gone', async () => {
    const offline = { ...sw, server: sw.server };
    offline.server.get = () => undefined;
    for (const [path, body] of [['/', '<div id="app"></div>'], ['/assets/app.js', 'boot()'], ['/avatars/blaze.webp', 'ART']]) {
      const out = await sw.fire('fetch', {
        request: sw.request(path, path === '/' ? { mode: 'navigate' } : { headers: new Map([['origin', ORIGIN]]) }),
      });
      expect(out?.body, path).toBe(body);
    }
  });

  it('reports a miss it cannot fetch as an error, never as an empty success', async () => {
    sw.server.get = () => undefined;
    const out = await sw.fire('fetch', { request: sw.request('/assets/never-precached.js') });
    expect((out as unknown as { thrown?: Error }).thrown, 'a synthetic 200 would tell the app the asset arrived')
      .toBeInstanceOf(TypeError);
  });

  it('leaves a third-party request alone rather than answering it', async () => {
    const out = await sw.fire('fetch', { request: sw.request('https://example.com/beacon.gif') });
    expect(out, 'no respondWith at all').toBeUndefined();
  });

  it('never answers a POST', async () => {
    const out = await sw.fire('fetch', { request: sw.request('/', { method: 'POST', mode: 'navigate' }) });
    expect(out).toBeUndefined();
  });

  it('a build whose precache cannot be fetched does not take over half-installed', async () => {
    const broken = drive({ 'index.html': res('ok'), 'assets/app.js': res('', { ok: false, status: 500 }) });
    await broken.fire('install', {}).catch(() => undefined);
    const cache = [...broken.caches.values()][0];
    expect(cache?.entries.size, 'addAll is all-or-nothing').toBe(0);
    expect(broken.claimed.skipWaiting, 'and a worker that cached nothing must not replace the one that works').toBe(0);
  });
});
