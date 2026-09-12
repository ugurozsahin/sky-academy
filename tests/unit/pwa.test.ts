import { readFileSync } from 'node:fs';
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

  it('renders a worker with no placeholder left in it', () => {
    const out = renderSw(readFileSync(new URL('../../scripts/sw-template.js', import.meta.url), 'utf8'), ['index.html', 'a.js']);
    expect(out).not.toMatch(/__PRECACHE__|__CACHE_NAME__/);
    expect(JSON.parse(out.match(/const PRECACHE = (\[[\s\S]*?\]);/)![1])).toEqual(['index.html', 'a.js']);
  });

  it('refuses to render if a placeholder has been renamed, or duplicated', () => {
    // Without this the worker ships precaching the literal string `__PRECACHE__` and caches nothing, while
    // every test above still passes on the template that no longer feeds it.
    expect(() => renderSw('const PRECACHE = __PRECACHE__;', ['a'])).toThrow(/__CACHE_NAME__/);
    expect(() => renderSw("const CACHE = '__CACHE_NAME__';", ['a'])).toThrow(/__PRECACHE__/);
    // `String.replace` with a string needle substitutes the FIRST occurrence only, so a second copy would
    // ship as the literal placeholder. Presence was not enough to check. (Raised in review of #214.)
    expect(() => renderSw("'__CACHE_NAME__' '__CACHE_NAME__' __PRECACHE__", ['a'])).toThrow(/2 times/);
  });
});
