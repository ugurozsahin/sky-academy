import { readdirSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { MANIFEST_SELECTOR, registerServiceWorker, type RegisterEnv } from '../../src/pwa';
// @ts-expect-error — plain ESM build helper, run by `npm run build` (see scripts/build-sw.d.ts)
import { cacheName, fingerprints, listFiles, precacheList, renderSw } from '../../scripts/build-sw.mjs';

/**
 * #15 Part A — offline play. Two halves are tested here, and they fail in opposite directions:
 *
 *   - the REGISTRATION decides whether a worker is turned on at all. Its dangerous failure is turning one on
 *     where there is none to turn on (the single-file build, hosted on somebody else's origin).
 *   - the PRECACHE LIST decides what the worker stores. Its dangerous failure is being written by hand, so
 *     that a hashed filename changes and the cached `index.html` asks offline for an asset nobody has.
 *
 * Everything below is behavioural: no assertion here is satisfied by the text of the file it is about.
 */

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../../public/manifest.webmanifest', import.meta.url), 'utf8'));

/** A document whose only interesting property is whether it links the manifest. */
const docWith = (link: boolean) => ({ querySelector: (s: string) => (link && s === MANIFEST_SELECTOR ? {} : null) } as RegisterEnv['doc']);

function make(link: boolean, protocol: string, hostname: string, register?: () => Promise<unknown>,
              win: RegisterEnv['win'] = {}): RegisterEnv {
  return {
    doc: docWith(link),
    nav: register ? { serviceWorker: { register } as unknown as RegisterEnv['nav']['serviceWorker'] } : {},
    loc: { protocol, hostname } as RegisterEnv['loc'],
    win,
  };
}

describe('service worker registration (#15)', () => {
  it('does not even look for a worker when the page has no manifest link — the single-file build', async () => {
    const register = vi.fn().mockResolvedValue({});
    expect(await registerServiceWorker(make(false, 'https:', 'example.com', register))).toBe('single-file');
    // The assertion that matters. `scripts/bundle-single.mjs` strips the link precisely so this page, hosted
    // on an origin that is not ours and has no `sw.js`, never calls `register()` at all.
    expect(register, 'the inlined page must not try to register a worker').not.toHaveBeenCalled();
  });

  it('registers on https, at a relative URL so a sub-path deployment still works', async () => {
    const register = vi.fn().mockResolvedValue({});
    expect(await registerServiceWorker(make(true, 'https:', 'example.com', register))).toBe('registered');
    expect(register).toHaveBeenCalledWith('sw.js', { scope: './' });
    // Absolute would be wrong: hosted under `/games/sky/`, `/sw.js` is somebody else's worker or a 404.
    expect(register.mock.calls[0][0].startsWith('/'), 'the worker URL must be relative').toBe(false);
  });

  it('registers on localhost, which is what makes `vite preview` and the e2e run exercise the real thing', async () => {
    for (const host of ['localhost', '127.0.0.1']) {
      const register = vi.fn().mockResolvedValue({});
      expect(await registerServiceWorker(make(true, 'http:', host, register))).toBe('registered');
      expect(register).toHaveBeenCalledOnce();
    }
  });

  it('does not attempt registration over plain http elsewhere', async () => {
    const register = vi.fn().mockResolvedValue({});
    expect(await registerServiceWorker(make(true, 'http:', 'school.example', register))).toBe('insecure');
    expect(register).not.toHaveBeenCalled();
  });

  // The APK embeds `dist/` (capacitor.config.ts `webDir: 'dist'`) and serves it from `https://localhost`, so
  // every other gate here passes and the worker would register inside the app — where it gains nothing and
  // risks serving the previous release after an update, because that origin never changes. (Review of #214.)
  it('does not register inside the Android shell, where every byte is already local', async () => {
    const register = vi.fn().mockResolvedValue({});
    const env = make(true, 'https:', 'localhost', register, { Capacitor: { isNativePlatform: () => true } });
    expect(await registerServiceWorker(env)).toBe('native-shell');
    expect(register, 'the APK must not register a worker').not.toHaveBeenCalled();
  });

  it('reads the bridge without calling through it, so a half-built Capacitor cannot throw', async () => {
    const register = vi.fn().mockResolvedValue({});
    const boom = { get isNativePlatform() { throw new Error('bridge not ready'); } };
    await expect(registerServiceWorker(make(true, 'https:', 'localhost', register, { Capacitor: boom })))
      .resolves.toBe('native-shell');
    expect(register).not.toHaveBeenCalled();
  });

  it('reports a browser with no service worker support rather than throwing', async () => {
    expect(await registerServiceWorker(make(true, 'https:', 'example.com'))).toBe('no-support');
  });

  it('a rejected registration is reported, never thrown — the game still starts', async () => {
    const register = vi.fn().mockRejectedValue(new Error('SecurityError: opaque origin'));
    await expect(registerServiceWorker(make(true, 'https:', 'example.com', register))).resolves.toBe('failed');
  });
});

describe('the manifest and index.html must agree (#15)', () => {
  // Two places holding one colour is the shape of bug the rails here already catch. A theme colour that
  // disagrees with the manifest gives an installed app a different status bar from the page it launches.
  it('theme colour matches the meta tag', () => {
    const meta = html.match(/<meta name="theme-color" content="([^"]+)"/)?.[1];
    expect(meta, 'index.html must still declare a theme colour').toBeTruthy();
    expect(manifest.theme_color).toBe(meta);
    expect(manifest.background_color).toBe(meta);
  });

  it('index.html links the manifest at the path `public/` serves it from', () => {
    const href = html.match(/<link rel="manifest" href="([^"]+)"/)?.[1];
    expect(href, 'the link is also the service-worker switch — without it nothing registers').toBe('manifest.webmanifest');
  });

  // Deliberately NOT called "installable": with no `icons` array Chrome will not offer the install prompt,
  // and that is Part B's work. This checks the fields Part A actually ships. (Raised in review of #214.)
  it('declares en-GB, standalone, and a short name that fits under a home-screen icon', () => {
    expect(manifest.lang).toBe('en-GB');
    expect(html).toMatch(/<html lang="en-GB">/);
    expect(manifest.display).toBe('standalone');
    expect(manifest.short_name.length, 'longer than ~12 characters is truncated under the icon').toBeLessThanOrEqual(12);
    // All three relative, or a sub-path deployment claims another app's identity and scope.
    expect([manifest.start_url, manifest.scope, manifest.id]).toEqual(['./', './', './']);
  });
});

describe('the precache list is read from the build, never written down (#15)', () => {
  const dirent = (name: string, dir = false) => ({ name, isDirectory: () => dir });
  const fakeTree: Record<string, ReturnType<typeof dirent>[]> = {
    'dist': [dirent('assets', true), dirent('index.html'), dirent('sw.js'), dirent('manifest.webmanifest')],
    'dist/assets': [dirent('index-ABC123.js'), dirent('index-DEF456.css')],
  };
  const readdir = (p: string) => fakeTree[p.replace(/\/$/, '')] ?? [];

  it('walks sub-directories and returns sorted, forward-slashed paths', () => {
    expect(listFiles('dist', readdir as never)).toEqual([
      'assets/index-ABC123.js', 'assets/index-DEF456.css', 'index.html', 'manifest.webmanifest', 'sw.js',
    ]);
  });

  it('never precaches the worker itself', () => {
    expect(precacheList(listFiles('dist', readdir as never))).not.toContain('sw.js');
    expect(precacheList(listFiles('dist', readdir as never))).toContain('index.html');
  });

  // THE bug of this review: 14 of the 16 precached files are not content-hashed by Vite, twelve of them the
  // owner's avatar art. Naming the cache after the filenames meant a re-exported `blaze.webp` produced an
  // identical name, `activate` kept the old cache, and `asset()` is cache-first — the old picture, for ever.
  it('the cache name follows the files CONTENTS, not their names', () => {
    const files = ['avatars/blaze.webp', 'index.html'];
    const bytes: Record<string, string> = { 'dist/avatars/blaze.webp': 'old-art', 'dist/index.html': '<html>' };
    const read = (p: string) => Buffer.from(bytes[p]);

    const before = cacheName(fingerprints('dist', files, read as never));
    bytes['dist/avatars/blaze.webp'] = 'RE-EXPORTED';          // same name, same list, new picture
    const after = cacheName(fingerprints('dist', files, read as never));
    expect(after, 'a re-exported avatar must produce a new cache').not.toBe(before);

    bytes['dist/avatars/blaze.webp'] = 'old-art';
    expect(cacheName(fingerprints('dist', files, read as never)), 'and the same bytes the same one').toBe(before);
  });

  it('the cache name is stable under reordering, so an unchanged build keeps its cache', () => {
    const a = ['assets/index-ABC123.js', 'index.html'];
    expect(cacheName(a)).toBe(cacheName([...a]));
    expect(cacheName(a)).not.toBe(cacheName(['assets/index-ZZZ999.js', 'index.html']));
    // A rebuild that emits the same files in a different order is the same deployment. If the name moved,
    // every build would throw away a cache that was still correct and re-download the game.
    expect(cacheName(a)).toBe(cacheName([...a].reverse().sort()));
  });

  // #116 item 4: the digest length and the filename component were both unpinned — `cacheName` could have its
  // `.slice(0, 12)` widened or narrowed, or `fingerprints` could swap its `\0`-joined field order, and the
  // whole suite would stay green because nothing read the shape, only whether two calls agreed with each other.
  it('the cache name is `sna-` plus a fixed 12-character hex digest', () => {
    expect(cacheName(['a\x001\x00x'])).toMatch(/^sna-[0-9a-f]{12}$/);
  });

  it('a fingerprint line is exactly `name\\0size\\0sha256`, in that order', () => {
    const read = () => Buffer.from('hello');
    const [line] = fingerprints('dist', ['index.html'], read as never);
    const [name, size, hash] = line.split('\x00');
    expect(name).toBe('index.html');
    expect(size).toBe('5');
    expect(hash, 'sha256 hex is 64 characters').toMatch(/^[0-9a-f]{64}$/);
  });

  // A fingerprint that only needs to satisfy renderSw's "contains \0" shape check, not describe a real file —
  // these tests are about placeholder substitution, not fingerprint content.
  const FAKE_PRINTS = ['a\x001\x00x'];

  it('renders a worker with no placeholder left in it', () => {
    const out = renderSw(readFileSync(new URL('../../scripts/sw-template.js', import.meta.url), 'utf8'), ['index.html', 'a.js'], ['index.html\x009\x00a', 'a.js\x003\x00b']);
    expect(out).not.toMatch(/__PRECACHE__|__CACHE_NAME__/);
    expect(JSON.parse(out.match(/const PRECACHE = (\[[\s\S]*?\]);/)![1])).toEqual(['index.html', 'a.js']);
  });

  it('refuses to render if a placeholder has been renamed, or duplicated', () => {
    // Without this the worker ships precaching the literal string `__PRECACHE__` and caches nothing, while
    // every test above still passes on the template that no longer feeds it.
    expect(() => renderSw('const PRECACHE = __PRECACHE__;', ['a'], FAKE_PRINTS)).toThrow(/__CACHE_NAME__/);
    expect(() => renderSw("const CACHE = '__CACHE_NAME__';", ['a'], FAKE_PRINTS)).toThrow(/__PRECACHE__/);
    // `String.replace` with a string needle substitutes the FIRST occurrence only, so a second copy would
    // ship as the literal placeholder. Presence was not enough to check. (Raised in review of #214.)
    expect(() => renderSw("'__CACHE_NAME__' '__CACHE_NAME__' __PRECACHE__", ['a'], FAKE_PRINTS)).toThrow(/2 times/);
  });

  it('refuses to render when prints look like filenames, not fingerprints (#116 item 3)', () => {
    // The bug this guards against: `renderSw(t, list)` used to default `prints` to `list` itself, and
    // `renderSw(t, prints, list)` — the arguments transposed — type-checked and ran too, since both
    // parameters are `string[]`. Either shape names the cache after filenames instead of content.
    expect(() => renderSw('__CACHE_NAME__ __PRECACHE__', ['a.js'])).toThrow(/prints must be fingerprints/);
    expect(() => renderSw('__CACHE_NAME__ __PRECACHE__', ['a.js'], ['a.js'])).toThrow(/prints must be fingerprints/);
  });
});

/**
 * #15's worker itself, exercised for the first time (#116 item 4). Everything above imports `build-sw.mjs`'s
 * pure helpers directly; nothing ran `scripts/sw-template.js`'s own handlers, because `self`/`caches` do not
 * exist under Node and none of `shell`/`font`/`asset` is exported. Each gap below was proved by a mutation
 * that left the rest of the suite green: deleting the `res.ok && res.type === 'basic'` gate, dropping
 * `{ cache: 'reload' }`, or dropping `ignoreVary` all still passed before this.
 *
 * `runWorker` renders the real template (through the real `renderSw`) and evaluates it in a fresh V8 context
 * carrying a minimal, in-memory Cache Storage, a fake `Request` and a scripted `fetch` — as close to the real
 * object shape as a Node test gets without a browser. Types are kept to this file's own minimal shapes rather
 * than DOM's `Request`/`Response`, which the fakes below only partially satisfy.
 */
interface FakeReq { url: string; method?: string; mode?: string; cache?: string }
interface FakeRes { ok: boolean; type: string; clone: () => FakeRes }
interface FakeEvent { request?: FakeReq; respondWith?: (p: Promise<unknown>) => void; waitUntil: (p: Promise<unknown>) => void }

function fakeResponse(overrides: Partial<Pick<FakeRes, 'ok' | 'type'>> = {}): FakeRes {
  const shape = { ok: true, type: 'basic', ...overrides };
  return { ...shape, clone: () => fakeResponse(overrides) };
}

const DEFAULT_LIST = ['index.html'];
const DEFAULT_PRINTS = ['index.html\x009\x00a'];
const CACHE = cacheName(DEFAULT_PRINTS);

function runWorker(fetchImpl: (req: FakeReq | string) => Promise<FakeRes>, list: string[] = DEFAULT_LIST, prints: string[] = DEFAULT_PRINTS) {
  const listeners: Record<string, (e: FakeEvent) => void> = {};
  const named = new Map<string, Map<string, FakeRes>>();
  const matchCalls: { cache: string; url: string; opts: unknown }[] = [];
  const caches = {
    open: async (name: string) => {
      if (!named.has(name)) named.set(name, new Map());
      const store = named.get(name)!;
      return {
        match: async (req: FakeReq | string, opts?: unknown) => {
          const url = typeof req === 'string' ? req : req.url;
          matchCalls.push({ cache: name, url, opts });
          return store.get(url);
        },
        put: async (req: FakeReq | string, res: FakeRes) => { store.set(typeof req === 'string' ? req : req.url, res); },
        addAll: async (reqs: FakeReq[]) => { for (const req of reqs) store.set(req.url, await fetchImpl(req)); },
      };
    },
    keys: async () => [...named.keys()],
    delete: async (name: string) => named.delete(name),
  };
  const fakeSelf = {
    addEventListener: (type: string, fn: (e: FakeEvent) => void) => { listeners[type] = fn; },
    skipWaiting: () => {},
    clients: { claim: () => {} },
    location: { origin: 'https://example.com' },
  };
  // A real `Request` needs an absolute URL: in a browser a relative one resolves against the worker's own
  // `self.location`, which is exactly what `install`'s `new Request(u, { cache: 'reload' })` relies on for
  // every precached path — Node's `Request` has no such base and throws on a bare `'index.html'`.
  class FakeRequest implements FakeReq {
    url: string;
    cache?: string;
    constructor(input: string, init: { cache?: string } = {}) {
      this.url = new URL(input, `${fakeSelf.location.origin}/`).href;
      this.cache = init.cache;
    }
  }
  const context = vm.createContext({ self: fakeSelf, caches, fetch: fetchImpl, Response, Request: FakeRequest, URL });
  const template = readFileSync(new URL('../../scripts/sw-template.js', import.meta.url), 'utf8');
  vm.runInContext(renderSw(template, list, prints), context);
  return { listeners, named, matchCalls };
}

/** Fires the `fetch` listener and returns the promises it hands to `respondWith`/`waitUntil`. */
function dispatch(listeners: Record<string, (e: FakeEvent) => void>, req: FakeReq) {
  let respondWith!: Promise<unknown>;
  let waitUntil: Promise<unknown> | undefined;
  listeners.fetch({ request: req, respondWith: (p) => { respondWith = p; }, waitUntil: (p) => { waitUntil = p; } });
  return { respondWith, waitUntil: () => waitUntil };
}

describe("the worker's runtime handlers (#116 item 4)", () => {
  it('precaches with {cache:"reload"}, so a stale HTTP-cache entry cannot be stored under a fresh deployment\'s name', async () => {
    const seen: FakeReq[] = [];
    const fetchImpl = async (req: FakeReq | string) => { seen.push(req as FakeReq); return fakeResponse(); };
    const { listeners } = runWorker(fetchImpl);
    let waited!: Promise<unknown>;
    listeners.install({ waitUntil: (p) => { waited = p; } });
    await waited;
    expect(seen).toHaveLength(1);
    expect(seen[0].cache, "the one failure install's own comment says this whole mechanism exists to prevent").toBe('reload');
  });

  it('asset() never caches a non-ok or opaque response, so a 404 or captive-portal body is not pinned until the next deployment', async () => {
    const req: FakeReq = { method: 'GET', mode: 'cors', url: 'https://example.com/assets/index-ABC.js' };
    for (const overrides of [{ ok: false, type: 'basic' }, { ok: true, type: 'opaque' }]) {
      const { listeners, named } = runWorker(async () => fakeResponse(overrides));
      const { respondWith } = dispatch(listeners, req);
      await respondWith;
      expect(named.get(CACHE)?.has(req.url) ?? false, JSON.stringify(overrides)).toBe(false);
    }
  });

  it('asset() DOES cache an ok, same-origin response, matching the existing entry ignoring Vary', async () => {
    const req: FakeReq = { method: 'GET', mode: 'cors', url: 'https://example.com/assets/index-ABC.js' };
    const { listeners, named, matchCalls } = runWorker(async () => fakeResponse());
    const { respondWith } = dispatch(listeners, req);
    await respondWith;
    expect(named.get(CACHE)!.has(req.url)).toBe(true);
    // Vite marks the module script and the stylesheet `crossorigin`, so the page requests them WITH an Origin
    // header while the precache stored them without one — `ignoreVary` is what stops that being a permanent miss.
    expect(matchCalls.some(c => c.url === req.url && (c.opts as { ignoreVary?: boolean })?.ignoreVary === true)).toBe(true);
  });

  it('shell() matches the precached document ignoring Vary, the same reason as asset()', async () => {
    const req: FakeReq = { method: 'GET', mode: 'navigate', url: 'https://example.com/' };
    const { listeners, matchCalls } = runWorker(async () => fakeResponse());
    const { respondWith } = dispatch(listeners, req);
    await respondWith;
    expect(matchCalls.some(c => c.url === 'index.html' && (c.opts as { ignoreVary?: boolean })?.ignoreVary === true)).toBe(true);
  });

  it('shell() resolves to Response.error() rather than rejecting, before the cache has ever been populated', async () => {
    const req: FakeReq = { method: 'GET', mode: 'navigate', url: 'https://example.com/' };
    const { listeners } = runWorker(async () => { throw new Error('offline'); });
    const { respondWith } = dispatch(listeners, req);
    const res = await respondWith as Response;
    expect(res.type, 'a network failure with no cached shell must not reject the navigation').toBe('error');
  });

  it('font() never stores a non-ok (opaque) response — today it truly caches nothing, which is the accepted behaviour (#44)', async () => {
    const req: FakeReq = { method: 'GET', mode: 'no-cors', url: 'https://fonts.gstatic.com/s/fredoka/x.woff2' };
    const { listeners, named } = runWorker(async () => fakeResponse({ ok: false, type: 'opaque' }));
    const { respondWith, waitUntil } = dispatch(listeners, req);
    await respondWith;
    await waitUntil();
    expect(named.get('sna-fonts-v1')?.has(req.url) ?? false).toBe(false);
  });

  it('font() serves a cache hit immediately, without waiting on a slower background refresh', async () => {
    const req: FakeReq = { method: 'GET', mode: 'no-cors', url: 'https://fonts.gstatic.com/s/fredoka/x.woff2' };
    let resolveFetch!: () => void;
    const fetchImpl = () => new Promise<FakeRes>(resolve => { resolveFetch = () => resolve(fakeResponse()); });
    const { listeners, named } = runWorker(fetchImpl);
    named.set('sna-fonts-v1', new Map([[req.url, fakeResponse()]]));
    const { respondWith, waitUntil } = dispatch(listeners, req);
    // If font() awaited the refresh before checking the cache, this would hang until the timeout: the fetch
    // above never resolves until `resolveFetch()` is called, below.
    const res = await respondWith;
    expect(res, 'a cache hit must not wait on the network').toBeDefined();
    resolveFetch();
    await waitUntil();
    expect(named.get('sna-fonts-v1')!.has(req.url)).toBe(true);
  });
});

/**
 * #15 Part B — the home-screen icon.
 *
 * The manifest is the only thing that says what an icon *is*, and nothing about a wrong one is visible from
 * inside the game: an installed tile is drawn by the operating system, long after the tab that installed it
 * has gone. So every assertion below reads the **bytes on disk** and compares them with what the manifest
 * claims about them. A rail that only re-read the manifest would confirm the manifest agrees with itself.
 *
 * The three failures worth naming, because each ships silently:
 *   - a declared size that is not the file's real size. Android scales it and the tile is soft, or it
 *     rejects the icon and falls back to a screenshot of the page.
 *   - a declared type that is not the file's real format. `image/png` on a WebP is refused outright.
 *   - an `any` icon declared `maskable`. Nothing fails; the platform simply crops the ninja's head off.
 *
 * Prove them red: change a `sizes` or a `type` in public/manifest.webmanifest, point one at a file that is
 * not there, or regenerate an icon at the wrong size.
 */
describe('installed icons (#15 Part B)', () => {
  const bytes = (rel: string) => readFileSync(new URL(`../../public/${rel}`, import.meta.url));

  /** Pixel size straight out of the header — PNG's IHDR, or WebP's VP8X canvas size. */
  function dimensions(b: Buffer): { w: number; h: number; kind: string } {
    if (b.subarray(1, 4).toString('latin1') === 'PNG') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), kind: 'image/png' };
    if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') {
      // Only the extended (VP8X) form carries the canvas size in a fixed place; that is what the generator
      // emits. A plain VP8/VP8L file would land here and be reported as unknown rather than guessed at.
      if (b.subarray(12, 16).toString('latin1') !== 'VP8X') return { w: 0, h: 0, kind: 'image/webp (not VP8X)' };
      const le24 = (at: number) => 1 + (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16));
      return { w: le24(24), h: le24(27), kind: 'image/webp' };
    }
    return { w: 0, h: 0, kind: 'unknown' };
  }

  it('every icon the manifest declares is really there, at the size and in the format it claims', () => {
    expect(manifest.icons, 'no icons array means the installed tile is a screenshot of the page').toBeInstanceOf(Array);
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      const b = bytes(icon.src);
      expect(b.length, `${icon.src} is empty`).toBeGreaterThan(0);
      const { w, h, kind } = dimensions(b);
      expect(kind, `${icon.src} is declared ${icon.type} and is not one`).toBe(icon.type);
      expect(`${w}x${h}`, `${icon.src} is declared ${icon.sizes} and is ${w}x${h}`).toBe(icon.sizes);
      expect(w, `${icon.src} must be square`).toBe(h);
    }
  });

  it('declares an `any` icon at 192 and 512, and a `maskable` one — they cannot be the same file', () => {
    const by = (purpose: string, size: string) =>
      manifest.icons.filter((i: { purpose: string; sizes: string }) => i.purpose === purpose && i.sizes === size);
    expect(by('any', '192x192'), 'Android asks for 192 for the home screen').toHaveLength(1);
    expect(by('any', '512x512'), '512 any is what the install prompt and the splash are drawn from').toHaveLength(1);
    expect(by('maskable', '512x512'), 'without a maskable icon the platform crops the `any` one').toHaveLength(1);
    // The distinction is the whole reason there are two 512s. One file serving both purposes means either the
    // art is cropped on Android or the tile is a small ninja adrift in a large square everywhere else.
    expect(by('maskable', '512x512')[0].src).not.toBe(by('any', '512x512')[0].src);
    // And they must actually differ in pixels, not only in name — the maskable one insets the art.
    expect(bytes(by('maskable', '512x512')[0].src).equals(bytes(by('any', '512x512')[0].src)),
      'the maskable icon is the `any` icon under another name').toBe(false);
  });

  it('the Apple icon the page links is a real PNG, because Safari never reads the manifest', () => {
    const href = html.match(/<link rel="apple-touch-icon" href="([^"]+)"/)?.[1];
    expect(href, 'iOS has no other way to be told, and screenshots the page without it').toBeTruthy();
    const { w, h, kind } = dimensions(bytes(href!));
    expect(kind, 'iOS will not take a WebP here, and fails to a screenshot without saying so').toBe('image/png');
    expect(`${w}x${h}`).toBe('180x180');
  });

  it('ships no icon nothing points at — every file in public/icons/ is declared', () => {
    const declared = new Set<string>([
      ...manifest.icons.map((i: { src: string }) => i.src.replace(/^icons\//, '')),
      ...[...html.matchAll(/href="icons\/([^"]+)"/g)].map(m => m[1]),
    ]);
    const onDisk = readdirSync(new URL('../../public/icons/', import.meta.url));
    // Every one of these is precached and downloaded by every player on first install, so an icon left
    // behind by a rename is not clutter — it is weight, and the service worker will never let go of it.
    expect([...onDisk].sort(), 'an undeclared icon is dead weight in the precache').toEqual([...declared].sort());
  });
});
