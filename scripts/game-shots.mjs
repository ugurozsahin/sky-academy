// Usage: node scripts/game-shots.mjs <base-url> <out-dir> [--only <id,…>]      (#2202)
// Captures every picture the catalogue's `media` paths name (src/config/catalogue.json): for each game one phone
// screenshot of its first wave and one thumbnail, for each island one screenshot and one thumbnail. The files land
// under <out-dir>/<media src> and are never committed, the rule site-shots.mjs keeps (#2088). The list of files is
// the catalogue's, never a second list: `plannedFiles` is what a rail compares against every `media` src.
// The Chromium path comes from PW_CHROMIUM, else Playwright's own download. Exits non-zero on any failed request,
// any response of 400 or above, any file over its cap, and any capture that did not produce its files.
import { chromium } from '@playwright/test';
import { launchSilent } from '../tests/e2e/mute.mjs';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SIZES, SEED, ACTION_TIMEOUT, freeze, isWebp } from './site-shots.mjs';

export const SHOT_BYTES = 150 * 1024;
export const THUMB_BYTES = 25 * 1024;
export const THUMB_CROP = 320;                       // the centre square taken from the frame, in CSS pixels
export const THUMB_SIZE = 160;                       // and the side it is downscaled to
export const PARALLEL = 4;

const catalogue = () => JSON.parse(readFileSync(new URL('../src/config/catalogue.json', import.meta.url), 'utf8'));

/** Every picture the catalogue names, as capture jobs: a game or an island, its thumbnail path and its screenshot paths. */
export function plannedJobs(cat = catalogue()) {
  const jobs = [];
  for (const [id, g] of Object.entries(cat.games)) {
    const year = Object.keys(g.years)[0];
    jobs.push({ kind: 'game', id, year, thumb: g.media.thumbnail.src, shots: g.media.screenshots.map(s => s.src) });
  }
  for (const [year, y] of Object.entries(cat.years)) {
    jobs.push({ kind: 'island', id: year, year, thumb: y.media.thumbnail.src, shots: y.media.screenshots.map(s => s.src) });
  }
  return jobs;
}
/** The files the script plans to write: the catalogue's `media` srcs, no more and no fewer (the rail in tests/unit/game-shots.test.ts). */
export const plannedFiles = jobs => jobs.flatMap(j => [j.thumb, ...j.shots]);

/** The files over their cap, as the lines the failure names: `[{ file, bytes, cap }]` in. */
export const overCap = files => files.filter(f => f.bytes > f.cap).map(f => `${f.file} (${f.bytes} bytes, cap ${f.cap})`);

/** Open a game and wait for its first question. A topic opens by its link; a drill is not linkable, so it opens the way the Relaxed chooser does. */
async function openGame(page, job) {
  await page.goto(`${page.__base}?topic=${job.id}`, { waitUntil: 'networkidle' });
  const linked = await page.waitForFunction(() => window.__sna?.state().prompt, null, { timeout: 4000 }).then(() => true, () => false);
  if (!linked) {
    await page.waitForSelector('.home', { timeout: ACTION_TIMEOUT });
    await page.click(`.island[data-year="${job.year}"]`);
    for (const tab of ['maths', 'writing']) {
      await page.click(`.tab[data-s="${tab}"]`);
      await page.click('#relaxed');
      const card = page.locator(`#island-overlay .topic[data-id="${job.id}"]`);
      if (await card.count()) { await card.click(); break; }
      await page.click('#chooser-back');
    }
    await page.waitForFunction(() => window.__sna?.state().prompt, null, { timeout: ACTION_TIMEOUT });
  }
  await page.waitForFunction(() => { const s = window.__sna; return !s.state().waiting && (!s.bubbles().length || s.bubbles().some(b => b.y > 60)); }, null, { timeout: ACTION_TIMEOUT });
}
const openIsland = async (page, job) => {
  await page.goto(`${page.__base}?year=${job.year}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.island-screen', { timeout: ACTION_TIMEOUT });
};

/** Chromium encodes WebP; Playwright's screenshot cannot. `crop` is a source rectangle and `side` the output size (0 = whole frame). */
const encode = (page, png, crop, side, quality) => page.evaluate(async ([b64, crop, side, quality]) => {
  const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
  const sx = crop ? Math.max(0, (img.width - crop) / 2) : 0, sy = crop ? Math.max(0, (img.height - crop) / 2) : 0;
  const sw = crop || img.width, sh = crop || img.height;
  const c = document.createElement('canvas'); c.width = side || sw; c.height = side || sh;
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/webp', quality).split(',')[1];
}, [png.toString('base64'), crop, side, quality]);

async function capture(browser, enc, base, job, out, errors) {
  const ctx = await browser.newContext({ viewport: SIZES.phone, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.__base = base;
  const name = `${job.kind} ${job.id}`;
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  page.on('requestfailed', r => errors.push(`${name}: request failed ${r.url()}`));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${name}: ${r.status()} ${r.url()}`); });
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00Z'));
  await page.addInitScript(([seed]) => {
    let a = seed;                                    // mulberry32: the same stream on every run
    Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    window.__SNA_FAST = 4;
    localStorage.setItem('sna:three', 'off');
    localStorage.setItem('sna:years', 'all');        // hidden islands are captured too
    localStorage.setItem('sna:v1', JSON.stringify({ v: 1, name: 'Ada', avatar: 'volt', tutorialSeen: true, onboarded: true }));
  }, [SEED]);
  try {
    if (job.kind === 'game') await openGame(page, job); else await openIsland(page, job);
    await page.waitForTimeout(500);
    await freeze(page);
    await page.evaluate(() => {                      // pin the sway and clear sparks, then hold (see site-shots.mjs)
      const a = window.__sna?.arena; if (!a) return;
      a.bubbles.forEach((x, i) => { x.wobble = i; }); a.particles.length = 0; a.shots.length = 0; a.trail.length = 0; a.paused = true; a.dirty = true;
    });
    await page.waitForTimeout(150);
    const png = await page.screenshot({ animations: 'disabled', caret: 'hide' });
    const written = [];
    const put = async (file, buf, cap) => {
      if (!isWebp(buf)) throw new Error(`${file}: the browser did not encode WebP`);
      mkdirSync(dirname(`${out}/${file}`), { recursive: true });
      writeFileSync(`${out}/${file}`, buf); written.push({ file, bytes: statSync(`${out}/${file}`).size, cap });
    };
    for (const s of job.shots) await put(s, Buffer.from(await encode(enc, png, 0, 0, 0.8), 'base64'), SHOT_BYTES);
    await put(job.thumb, Buffer.from(await encode(enc, png, THUMB_CROP, THUMB_SIZE, 0.8), 'base64'), THUMB_BYTES);   // a crop of the same frame, not a second capture
    return written;
  } catch (e) {
    throw new Error(`${name}: ${e.message.split('\n')[0]}`);
  } finally { await ctx.close(); }
}

export function parseArgs(argv) {
  const [base, out, ...rest] = argv;
  const i = rest.indexOf('--only');
  return { base, out, only: i >= 0 ? (rest[i + 1] ?? '').split(',').filter(Boolean) : null };
}

async function main(argv) {
  const { base, out, only } = parseArgs(argv);
  if (!base || !out) throw new Error('usage: node scripts/game-shots.mjs <base-url> <out-dir> [--only <id,…>]');
  const all = plannedJobs();
  const jobs = only ? all.filter(j => only.includes(j.id)) : all;
  const missing = only ? only.filter(id => !all.some(j => j.id === id)) : [];
  if (missing.length) throw new Error(`--only names no catalogue id: ${missing.join(', ')}`);
  mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  const browser = await launchSilent(chromium, process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const enc = await (await browser.newContext()).newPage();
  const written = [], errors = [], failed = [];
  let next = 0;
  const worker = async () => {
    for (let j = jobs[next++]; j; j = jobs[next++]) {
      try { written.push(...await capture(browser, enc, base, j, out, errors)); } catch (e) { failed.push(e.message); }
    }
  };
  try { await Promise.all(Array.from({ length: PARALLEL }, worker)); } finally { await browser.close(); }
  const want = plannedFiles(jobs);
  const got = new Set(written.map(w => w.file));
  const absent = want.filter(f => !got.has(f));
  const problems = [
    ...failed, ...errors.map(e => `page error: ${e}`),
    ...overCap(written).map(l => `over its cap: ${l}`),
    ...(absent.length && !failed.length ? [`missing: ${absent.join(', ')}`] : []),
  ];
  if (problems.length) throw new Error(`${problems.length} problem(s): ${problems.slice(0, 20).join('; ')}`);
  console.log(`game-shots: wrote ${written.length} files for ${jobs.length} pages to ${out} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(e => { console.error(`game-shots: ${e.message}`); process.exit(1); });
}
