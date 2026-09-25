// #715: renders every sketchbook object × variant × tier to docs/sketchbook/<object>/<variant>-<tier>.png and
// fails on any blank frame. Two ways in:
//   node scripts/sketch-shot.mjs [outDir] [--no-build]   — builds (unless told not to), starts its own preview, shoots
//   tests/sketch/shot.spec.ts                              — the same `shoot()` on Playwright's own page and server
// The page is driven through `window.__sketch` (src/three/sketchbook/main.ts); a frame is blank when the
// page's own read-back counts no pixel off the background — the check is on the GL buffer, not on the PNG.
// The CLI builds EVERY time by default: a checkout nearly always has a `dist/` from an earlier build, and a
// gallery shot from it would be of the previous object while saying nothing (silent-failure review).
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const OUT_DIR = 'docs/sketchbook';
export const TIERS = ['low', 'high'];
export const PAGE = '/sketchbook/sketchbook.html?shot=1';
/** The first read `waitForFunction` gets, in ms: a page that never becomes ready is broken, not slow. */
export const READY_MS = 10_000;

/**
 * Shoot every object × variant × tier on `page` against `base`. Returns what was written, what was blank, and
 * each frame's ink count (pixels off the background) so a caller can bound it from both sides.
 * A page error is rethrown with the page's own message, on the first wait AND on every shot's wait after it:
 * a stage that throws inside the frame loop stops `frames` moving, and without this the caller would see only
 * Playwright's "timeout exceeded" for the wait that followed (round 2 of #715's review). `readyMs` is the test's
 * way to make that wait short.
 */
export async function shoot({ page, base, out = OUT_DIR, tiers = TIERS, readyMs = READY_MS }) {
  let pageError = null;
  page.on('pageerror', (e) => { pageError ??= e; });
  /** Wait for `fn(arg)`; if it never comes, say what the page said rather than how long we waited. */
  const waitFor = async (fn, arg) => {
    try { await page.waitForFunction(fn, arg, { timeout: readyMs }); }
    catch (e) { throw pageError ?? e; }
  };
  await page.goto(`${base}${PAGE}`, { waitUntil: 'networkidle' });
  // `vite preview` answers a missing page with index.html and a 200 (SPA fallback), so a dist/ built by
  // `vite build` alone — bundle-single.mjs does that — would silently load the GAME here.
  const hasHook = await page.evaluate(() => typeof window.__sketch === 'object');
  if (!hasHook) throw new Error(`${base}${PAGE} has no window.__sketch — is dist/sketchbook/ built? (npm run build)`);
  await waitFor(() => window.__sketch.ready === true, undefined);
  const objects = await page.evaluate(() => window.__sketch.objects());
  if (!objects.length) throw new Error('the sketchbook lists no objects — even the placeholder is missing');
  const shots = [], blank = [], inks = {};
  for (const o of objects) for (const variant of o.variants) for (const tier of tiers) {
    const before = await page.evaluate(() => window.__sketch.frames);
    await page.evaluate(([n, v, t]) => window.__sketch.show(n, v, t), [o.name, variant, tier]);
    await waitFor((f) => window.__sketch.frames > f + 2, before);   // two real frames after the swap
    if (pageError) throw pageError;   // a frame that errored but still advanced the counter
    const ink = await page.evaluate(() => window.__sketch.ink());
    const file = join(out, o.name, `${variant}-${tier}.png`);
    mkdirSync(join(out, o.name), { recursive: true });
    await page.locator('#stage canvas').screenshot({ path: file });
    shots.push(file); inks[file] = ink;
    if (ink === 0) blank.push(file);
  }
  return { shots, blank, inks };
}

/** Wait until the preview answers, or say what the last error was. */
async function up(url, alive, tries = 60) {
  let last = 'no response yet';
  for (let i = 0; i < tries; i++) {
    if (!alive()) throw new Error(`vite preview exited before answering ${url}`);
    try { const r = await fetch(url); if (r.ok) return; last = `HTTP ${r.status}`; } catch (e) { last = String(e); }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`no server at ${url}: ${last}`);
}

// Same guard as build-sw.mjs / bundle-single.mjs (#116): importing this module must run nothing.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const noBuild = args.includes('--no-build');
  const out = args.find(a => !a.startsWith('--')) ?? OUT_DIR;
  if (noBuild && !(existsSync('dist/index.html') && existsSync('dist/sketchbook/sketchbook.html'))) {
    console.error('--no-build, but dist/ has no game or no sketchbook build — run npm run build first'); process.exit(1);
  }
  if (noBuild) console.log('using the build already in dist/ (--no-build)'); else execSync('npm run build', { stdio: 'inherit' });
  const port = 4600 + (process.pid % 300);
  const base = `http://localhost:${port}`;
  // The vite binary itself, not `npx`: a kill must reach the server, not a wrapper that leaves it holding the port.
  const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'ignore', 'inherit'] });
  let exited = null;
  preview.on('exit', (code) => { exited = code ?? 'signal'; });
  try {
    await up(`${base}${PAGE}`, () => exited === null);
    const { chromium } = await import('@playwright/test');
    const bundled = '/opt/pw-browsers/chromium';
    const browser = await chromium.launch(process.env.PW_CHROMIUM || existsSync(bundled) ? { executablePath: process.env.PW_CHROMIUM || bundled } : {});
    try {
      const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 2 });
      const { shots, blank } = await shoot({ page, base, out });
      console.log(`${shots.length} frames → ${out}`);
      if (blank.length) { console.error(`BLANK: ${blank.join(', ')}`); process.exitCode = 1; }
    } finally { await browser.close(); }
  } finally { if (exited === null) preview.kill(); }
}
