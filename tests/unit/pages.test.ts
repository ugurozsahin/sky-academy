import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { precacheList } from '../../scripts/build-sw.mjs';

/** #1933: the game is served from `/play/` on GitHub Pages. These rails hold the pieces that make that safe. */
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const wf = read('.github/workflows/pages.yml');

describe('GitHub Pages deployment (#1933)', () => {
  it('builds the game with base /play/ and deploys with the official actions', () => {
    expect(wf).toContain('--base=/play/');
    expect(wf).toContain('--outDir site/play');
    expect(wf).toMatch(/uses: actions\/upload-pages-artifact@v\d/);
    expect(wf).toMatch(/uses: actions\/deploy-pages@v\d/);
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
