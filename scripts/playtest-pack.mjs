// Usage: node scripts/playtest-pack.mjs <base-url> <out-dir> [--year <y>] [--only <id,…>]      (#2205)
// Plays each game once, for its year, the way a child meets it on a 390×844 phone, and saves a play pack to
// <out-dir>/<year>/<game>/: up to six WebP screenshots and a metrics.json. The playtest profiles score from these
// (.claude/skills/playtest/SKILL.md §1 reads every file and key written here). Packs are never committed.
// The real clock runs, because timing is what is measured: no game speed-up, no fixed clock. The first
// wave is left alone so its whole flight is timed; the next question gets one deliberate wrong answer, then the
// rest are answered until the stage result. Settings come from the resolver (src/config/resolve.ts) via Vite's SSR
// loader, so the pack states what the catalogue resolves, not a second copy of the order.
// The Chromium path comes from PW_CHROMIUM, else Playwright's own download. Exits non-zero if any pack failed.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { launchSilent } from '../tests/e2e/mute.mjs';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { SIZES, SEED, ACTION_TIMEOUT, isWebp } from './site-shots.mjs';
import { PARALLEL, encode } from './game-shots.mjs';
import { plannedPacks, parseArgs, buildMetrics } from './playtest-metrics.mjs';
import { playBubbles, playTracing, playKeypad } from './playtest-play.mjs';

const VIEW = SIZES.phone;

/** The resolver and the topic registry, loaded through Vite so the TypeScript runs as the game's own does. */
async function loadApp() {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const [resolve, curriculum] = await Promise.all([vite.ssrLoadModule('/src/config/resolve.ts'), vite.ssrLoadModule('/src/curriculum/index.ts')]);
    return { RUNTIME: resolve.RUNTIME, resolveGame: resolve.resolveGame, resolveYear: resolve.resolveYear, topicById: curriculum.topicById };
  } finally { await vite.close(); }
}

/** Runs in the page before the app: seeds Math.random, then records frames, the first wave's bubbles, prompts and every spoken line. */
function packProbe([seed]) {
  let a = seed;                                      // mulberry32, as site-shots.mjs: the same stream on every run
  Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  localStorage.setItem('sna:three', 'off');
  localStorage.setItem('sna:years', 'all');          // a hidden island is packed too
  localStorage.setItem('sna:v1', JSON.stringify({ v: 1, name: 'Ada', avatar: 'volt', tutorialSeen: true, onboarded: true }));
  const pk = window.__pk = { on: false, onAt: 0, frames: [], samples: [], left: {}, seen: {}, prompts: [], speech: [] };
  const proto = globalThis.SpeechSynthesis?.prototype;
  if (proto) {
    const speak = proto.speak;
    proto.speak = function (u) {
      const e = { text: u.text, at: performance.now(), start: null, end: null, error: null, voice: u.voice?.name ?? null, rate: u.rate };
      pk.speech.push(e);
      u.addEventListener('start', () => { e.start ??= performance.now(); });
      u.addEventListener('end', () => { e.end ??= performance.now(); });
      u.addEventListener('error', ev => { e.error = ev.error; e.cut ??= performance.now(); });
      return speak.call(this, u);
    };
  }
  const play = () => (window.__sna && 'session' in window.__sna ? window.__sna : null);
  const target = s => { const c = s.session.current; return c.sequence ? s.session.remaining()[0] : c.answer; };
  /** The current question can be answered now: not held, and on bubbles its target is on screen. */
  pk.ready = () => {
    const s = play(); const st = s?.state();
    if (!s || !s.session.current || st.waiting || st.ended || st.paused) return false;
    return !s.arena || s.bubbles().some(b => b.label === target(s) && b.y < s.arena.H - b.r);
  };
  /** A wrong bubble of the current question is on screen. */
  pk.wrongReady = () => {
    const s = play(); if (!pk.ready() || !s.arena) return pk.ready();
    const right = s.session.current.anyOrder ? s.session.remaining() : [target(s)];
    return s.bubbles().some(b => !right.includes(b.label) && b.label !== '💣' && b.y < s.arena.H - b.r);
  };
  pk.result = () => !!document.querySelector('.modal.results') || !!document.querySelector('#overlay:not([hidden]) #next');
  pk.asked = () => play()?.session.questionsAsked ?? 0;
  let lastPrompt;
  const tick = t => {
    const s = window.__sna;
    const st = s && 'session' in s ? s.state() : null;
    if (st && st.prompt !== lastPrompt) { lastPrompt = st.prompt; if (st.prompt) pk.prompts.push({ t, prompt: st.prompt, index: st.index, stage: st.stage }); }
    const ar = s && 'session' in s ? s.arena : null;
    if (pk.on && st?.prompt && pk.wave === undefined) pk.wave = s.session.questionsAsked;   // the first question's wave is the one timed
    if (pk.on && ar && s.session.questionsAsked === pk.wave) {
      pk.frames.push(t);
      if (!pk.labels && ar.bubbles.length) pk.labels = ar.bubbles.filter(b => b.label !== '💣').map(b => b.label);   // the whole wave, launched or still waiting
      for (const b of ar.bubbles) {
        if (!b.launched || b.dead || b.hit || b.fade || ar.frozen || b.label === '💣') continue;   // live only: a resolved wave stops the clock
        pk.samples.push([t, b.id, b.label, b.y, b.r, b.vy]);
        pk.seen[b.id] = true;
        if (b.vy > 0 && b.y >= ar.H) pk.left[b.id] = true;
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** The island as the child finds the game on it: the tile (a topic), the chooser card (a drill) or the menu row (the keypad). */
async function findOnIsland(page, base, job, topic) {
  await page.goto(`${base}?year=${job.year}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.island-screen', { timeout: ACTION_TIMEOUT });
  if (!job.catalogue) return page.locator(`#${job.game}`);
  await page.click(`.tab[data-s="${topic.subject}"]`);
  if (!topic.drill) return page.locator(`#topics .topic[data-id="${job.game}"]`);
  await page.click('#relaxed');
  return page.locator(`#island-overlay .topic[data-id="${job.game}"]`);
}

/** Card, speaker, screen box and the first question's own flags, read once the first question is on screen. */
const readScreen = page => page.evaluate(() => {
  const s = window.__sna, q = s.session.current, card = document.querySelector('#qcard')?.getBoundingClientRect();
  const speak = document.querySelector('#speak'), hint = document.querySelector('#hint');
  return {
    H: s.arena?.H ?? innerHeight, card: card ? { top: card.top, bottom: card.bottom, width: card.width, height: card.height } : null,
    speakVisible: !!speak && speak.getClientRects().length > 0 && getComputedStyle(speak).visibility !== 'hidden',
    prompt: q?.prompt ?? null, answer: q ? (q.sequence ? s.session.remaining()[0] : q.answer) : null, hasLives: !!s.session.spec?.hasLives, hint: hint?.textContent?.trim() || null,
    slow: !!q?.slow, wide: !!q?.wide, sequence: !!q?.sequence, anyOrder: !!q?.anyOrder, visual: q?.visual?.type ?? null,
    lives: s.state().lives, mode: s.session.spec?.id ?? null,
  };
});

async function packOne(browser, enc, base, app, job, out) {
  const topic = job.catalogue ? app.topicById(job.game) : null;
  if (job.catalogue && !topic) throw new Error('no such topic in the registry');
  const input = job.catalogue ? topic.input ?? 'bubbles' : 'keypad';
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript(packProbe, [SEED]);
  const dir = `${out}/${job.year}/${job.game}`;
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const shots = [];
  const shot = async (file, moment) => {
    const buf = Buffer.from(await encode(enc, await page.screenshot({ caret: 'hide' }), 0, 0, 0.8), 'base64');
    if (!isWebp(buf)) throw new Error(`${file}: the browser did not encode WebP`);
    writeFileSync(`${dir}/${file}`, buf); shots.push({ file, moment });
  };
  try {
    const tile = await findOnIsland(page, base, job, topic);
    await tile.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    await shot('1-island.webp', job.catalogue ? (topic.drill ? 'the Relaxed chooser card for this drill' : 'the game tile on its island') : 'the menu row on the Year 4 island');
    await page.evaluate(() => { window.__pk.on = true; window.__pk.onAt = performance.now(); });
    await tile.click();                              // a real tap: it is also what lets the page speak
    await page.waitForFunction(() => window.__sna && 'session' in window.__sna && window.__sna.state().prompt, null, { timeout: ACTION_TIMEOUT });
    const play = input === 'tracing' ? playTracing : input === 'keypad' ? playKeypad : playBubbles;
    const played = await play(page, shot, readScreen);
    if (errors.length) throw new Error(errors.slice(0, 3).join('; '));
    const settings = job.catalogue ? app.resolveGame(job.game, job.year).settings : app.resolveYear(job.year);
    const metrics = buildMetrics({ job, input, settings, view: VIEW, seed: SEED, rec: played, shots });
    writeFileSync(`${dir}/metrics.json`, `${JSON.stringify(metrics, null, 2)}\n`);
    return metrics;
  } finally { await ctx.close(); }
}

async function main(argv) {
  const { base, out, year, only } = parseArgs(argv);
  if (!base || !out) throw new Error('usage: node scripts/playtest-pack.mjs <base-url> <out-dir> [--year <y>] [--only <id,…>]');
  const t0 = Date.now();
  const app = await loadApp();
  const unknown = (only ?? []).filter(id => !plannedPacks(app.RUNTIME).some(p => p.game === id));
  if (unknown.length) throw new Error(`--only names no game: ${unknown.join(', ')}`);
  const jobs = plannedPacks(app.RUNTIME, { year, only });
  if (!jobs.length) throw new Error('no pack matches --year and --only');
  const done = [], failed = [];
  let next = 0;
  // One browser per worker, not one shared: Chromium speaks through one queue per browser process, and a page's
  // cancel() stops a line another page of the same origin is speaking, so a shared browser cuts the prompts short.
  const worker = async () => {
    const browser = await launchSilent(chromium, process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
      const enc = await (await browser.newContext()).newPage();
      for (let j = jobs[next++]; j; j = jobs[next++]) {
        let last;
        for (let attempt = 1; attempt <= 2; attempt++) {   // one retry: four live pages can miss a beat
          try { done.push(await packOne(browser, enc, base, app, j, out)); last = null; break; } catch (e) { last = e; }
        }
        if (last) failed.push(`${j.year}/${j.game}: ${last.message.split('\n')[0]}`);
        process.stdout.write(`\rplaytest-pack: ${done.length + failed.length}/${jobs.length}`);
      }
    } finally { await browser.close(); }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  const seconds = Math.round((Date.now() - t0) / 1000);
  const slow = done.filter(m => m.frames && !m.frames.clean).map(m => `${m.year}/${m.game}`);
  writeFileSync(`${out}/run.json`, `${JSON.stringify({ base, year, only, packs: done.length, failed, seconds, parallel: PARALLEL, framesOver100ms: slow }, null, 2)}\n`);
  console.log(`\nplaytest-pack: ${done.length} packs in ${seconds} s (${PARALLEL} pages)${slow.length ? `; ${slow.length} timed with a frame gap over 100 ms: ${slow.join(', ')}` : ''}`);
  if (failed.length) throw new Error(`${failed.length} pack(s) failed: ${failed.join('; ')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(e => { console.error(`playtest-pack: ${e.message}`); process.exit(1); });
}
