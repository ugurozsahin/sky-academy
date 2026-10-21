// Usage: node scripts/site-shots.mjs <base-url> <out-dir>      (#2088)
// Captures every screenshot the website and the store listing need, from fixed seeds, through the same
// `window.__sna` hooks the e2e drives. It runs during the Pages deploy, so no image is ever committed.
// The Chromium path comes from PW_CHROMIUM, else Playwright's own download. Exits non-zero on any failure,
// on any failed request or response of 400 or above (a missing asset), and on any file over MAX_BYTES.
import { chromium } from '@playwright/test';
import { launchSilent } from '../tests/e2e/mute.mjs';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
export const MAX_BYTES = 150 * 1024;
const SEED = 20261021;

const ACTION_TIMEOUT = 20000;
const waitTarget = page => page.waitForFunction(() => {
  const s = window.__sna; if (!s || s.state().waiting) return false;
  const c = s.session.current; const label = c.sequence ? s.session.remaining()[0] : c.answer;
  return s.bubbles().some(b => b.label === label && b.y > 60);
}, null, { timeout: ACTION_TIMEOUT });
/** Stop the wave and lay its bubbles out on a fixed grid, so the frame never depends on how fast this machine drew. */
const freeze = page => page.evaluate(() => {
  const a = window.__sna?.arena; if (!a) return;
  const live = a.bubbles.filter(x => !x.dead && !x.hit);
  const cols = Math.min(live.length, a.W > 600 ? 5 : 3), rows = Math.ceil(live.length / cols);
  const top = a.topInset + 60, bottom = a.H - 40;
  live.forEach((x, i) => {
    x.launched = true; x.vx = 0; x.vy = 0; x.g = 0;
    x.x = (a.W / cols) * ((i % cols) + 0.5);
    x.y = top + ((bottom - top) / rows) * (Math.floor(i / cols) + 0.5);
  });
});
async function openTopic(page, year, topic, tab = 'maths') {
  await page.click(`.island[data-year="${year}"]`);
  await page.click(`.tab[data-s="${tab}"]`);
  await page.click(`.topic[data-id="${topic}"]`);
  await page.waitForFunction(() => window.__sna?.state().prompt, null, { timeout: ACTION_TIMEOUT });
  await waitTarget(page);
  await freeze(page);
}

/** The product the grown-ups gate asks for: "6 × 8", or "thirty-seven times twenty-four" (tests/e2e/viewport.ts re-exports this). */
export function gateProduct(q) {
  const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const tens = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const num = s => {
    const t = s.trim();
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    const [h, l] = t.split('-');
    if (teens.includes(h)) return 10 + teens.indexOf(h);
    return l ? tens[h] + ones.indexOf(l) : (tens[h] ?? ones.indexOf(h));
  };
  const [a, b] = q.split(/×|times/).map(num);
  return a * b;
}

/** The shot list: `name` becomes `<name>-<size>.webp`. A website page may only reference a file made from here. */
export const SHOTS = [
  { name: 'sky-map', run: async () => {} },
  { name: 'slice', run: page => openTopic(page, 'year1', 'y1-add') },
  { name: 'ten-frame', run: page => openTopic(page, 'reception', 'r-bonds') },
  { name: 'results', run: async page => {
    await openTopic(page, 'reception', 'r-count');
    for (let i = 0; i < 3; i++) {                                // a few real answers, then the mission ends as a win
      await waitTarget(page);
      await page.evaluate(() => window.__sna.answer());
      await page.waitForFunction(n => window.__sna.session.questionsAsked > n, i + 1, { timeout: ACTION_TIMEOUT });
    }
    // The praise line is drawn from Math.random, and how many draws the live arena took by now varies by machine:
    // hold the arena, re-pin the stream, and only then end the mission.
    await page.evaluate(seed => { window.__sna.arena.paused = true; window.__shotsReseed(seed); window.__sna.session.end(true); }, SEED);
    await page.waitForSelector('.modal.results', { timeout: ACTION_TIMEOUT });
    await page.evaluate(() => { window.__sna.arena.bubbles.length = 0; });   // the backdrop is blurred: whatever wave is left behind the modal differs by a few pixels between runs
  } },
  { name: 'parents', run: async page => {
    await page.click('#grownups');
    await page.fill('#gate-input', String(gateProduct(await page.locator('#gate-q').textContent())));
    await page.click('#gate-go');
    await page.waitForSelector('.parents-dash', { timeout: ACTION_TIMEOUT });
  } },
  { name: 'island', run: async page => { await page.click('.island[data-year="year1"]'); await page.waitForSelector('.island-screen'); } },
];
/** The files over MAX_BYTES, as the lines the failure names: `[{ file, bytes }]` in, `["file (n bytes)"]` out. */
export const oversized = files => files.filter(f => f.bytes > MAX_BYTES).map(f => `${f.file} (${f.bytes} bytes)`);
export const shotFiles = () => SHOTS.flatMap(s => Object.keys(SIZES).map(z => `${s.name}-${z}.webp`));

export const isWebp = buf => buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP';

/** Chromium can encode WebP but Playwright's screenshot cannot: re-encode the PNG on a canvas. */
const toWebp = (page, png) => page.evaluate(async b64 => {
  const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return c.toDataURL('image/webp', 0.8).split(',')[1];
}, png.toString('base64'));

async function main([base, out]) {
  if (!base || !out) throw new Error('usage: node scripts/site-shots.mjs <base-url> <out-dir>');
  mkdirSync(out, { recursive: true });
  const browser = await launchSilent(chromium, process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const enc = await (await browser.newContext()).newPage();
  const written = [], errors = [];
  try {
    for (const [size, viewport] of Object.entries(SIZES)) {
      for (const shot of SHOTS) {
        const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: size === 'phone', isMobile: size === 'phone', reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        page.on('pageerror', e => errors.push(`${shot.name}-${size}: ${e.message}`));   // thrown after the loop: a throw here would be Playwright's emitter's, not main()'s
        page.on('requestfailed', r => errors.push(`${shot.name}-${size}: request failed ${r.url()}`));
        page.on('response', r => { if (r.status() >= 400) errors.push(`${shot.name}-${size}: ${r.status()} ${r.url()}`); });
        await page.clock.setFixedTime(new Date('2026-10-21T10:00:00Z'));
        await page.addInitScript(([seed]) => {
          let a = seed;                                              // mulberry32: the same stream on every run
          window.__shotsReseed = v => { a = v; };                    // how many draws the live arena took varies by machine, so a shot re-pins the stream where it matters
          Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
          window.__SNA_FAST = 4;
          localStorage.setItem('sna:three', 'off');
          if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', JSON.stringify({ v: 1, name: 'Ada', avatar: 'volt', tutorialSeen: true }));
        }, [SEED]);
        await page.goto(base, { waitUntil: 'networkidle' });
        await page.waitForSelector('.home', { timeout: ACTION_TIMEOUT });
        try { await shot.run(page); } catch (e) {                    // Playwright's timeout names neither the shot nor the size, and the page errors that likely caused it would be dropped
          throw new Error(`${shot.name}-${size}: ${e.message.split('\n')[0]}${errors.length ? ` (page errors: ${errors.join('; ')})` : ''}`);
        }
        await page.waitForTimeout(500);
        await freeze(page);                                          // a wave that spawned after the shot's own steps (the results' backdrop) goes on the grid too
        await page.evaluate(() => {                                  // the bubbles' sway is driven by frame time: pin it, then hold
          const a = window.__sna?.arena; if (!a) return;
          a.bubbles.forEach((x, i) => { x.wobble = i; }); a.particles.length = 0; a.shots.length = 0; a.trail.length = 0; a.paused = true;   // sparks and the trail come from the answers just given
          a.dirty = true;                                            // a paused arena keeps its last bitmap, drawn before the pin: repaint it once
        });
        await page.waitForTimeout(150);
        const buf = Buffer.from(await toWebp(enc, await page.screenshot({ animations: 'disabled', caret: 'hide' })), 'base64');
        if (!isWebp(buf)) throw new Error(`${shot.name}-${size}: the browser did not encode WebP`);   // toDataURL falls back to PNG silently
        const file = `${out}/${shot.name}-${size}.webp`;
        writeFileSync(file, buf);
        written.push({ file, bytes: statSync(file).size });
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
  if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
  const tooBig = oversized(written);
  if (tooBig.length) throw new Error(`over ${MAX_BYTES} bytes: ${tooBig.join(', ')}`);
  console.log(`site-shots: wrote ${shotFiles().length} files to ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(e => { console.error(`site-shots: ${e.message}`); process.exit(1); });
}
