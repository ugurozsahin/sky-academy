import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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
  it('the custom domain, .nojekyll and a script-free holding page ship from website/', () => {
    expect(read('website/CNAME').trim()).toBe('sharpwise.co.uk');
    expect(read('website/.nojekyll')).toBe('');
    const page = read('website/index.html');
    expect(page).toContain('href="/play/"');
    expect(page).not.toMatch(/<script|https?:\/\//i);
  });
});
