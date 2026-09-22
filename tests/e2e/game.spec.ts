import { test, expect, type Page } from '@playwright/test';
import { TOPICS } from '../../src/curriculum';
import { SAVE_VERSION } from '../../src/storage';
import { itemById } from '../../src/game/shop';
import type { PlayHooks, MemoryHooks } from '../../src/ui/hooks';
import { expectFitsViewport } from './viewport';   // #380 review round 5, B1: the rail this repo already built for a screen that does not fit (#107, #109, #110)

declare global {
  interface Window { __lastVoiceLine?: SpeechSynthesisUtterance }   // #65: the stubbed engine parks the last line here for a test to start by hand
  interface Window { __spoken?: string[] }                          // #380 review B2: every line the engine was handed, in order
}

// The live screen sets `__sna` to PlayHooks or MemoryHooks; a given test knows which, so the spec views it as
// the union of both surfaces (#34, replacing `__sna: any`). tests/e2e is outside tsconfig's `include`, so this
// augmentation and the `__sna?: SnaHooks` one in hooks.ts never meet in a single type-check pass.
declare global { interface Window { __sna: PlayHooks & MemoryHooks; __SNA_FAST?: number } }

/**
 * Walk the avatar screen the way a child does, on a cleared save. Kept for the handful of tests that are
 * *about* that screen — the pick itself, the Master Ninja unlock, the sticky-button layout — and for the one
 * cold-start path below that proves seeding and walking land a test in the same place (#138).
 */
async function pickAvatar(page: Page, id = 'volt', name = 'Ada') {
  await page.goto('/?reset=1');
  await expect(page.locator('.avatar-screen')).toBeVisible();
  await expect(page.locator('#next')).toBeDisabled();
  await page.click(`.avatar-card[data-id="${id}"]`);
  await page.click('#next');                                 // #67: ninja step → name step, its own screen
  await page.fill('#name', name);
  await page.click('#go');
  await expect(page.locator('.intro-card')).toBeVisible();   // #67: first run continues into the introduction
  await page.click('#intro-go');
  await expect(page.locator('.home')).toBeVisible();
}
/**
 * #138: land on the sky map with the avatar already chosen, by writing the save `chooseNinjaScreen`/`nameScreen`
 * would have written (`src/storage.ts`: key `sna:v1`, `save({ avatar })` then `save({ name })`) before the app boots.
 * A test that is not about the avatar screen gets the same starting state without rendering eleven portraits
 * and making three round trips for them.
 *
 * The init script runs on **every** navigation in the page, so it writes only when the slot is empty — a test
 * that reloads to check something persisted (the Daily Dojo, the remembered home screen) must find its own
 * save, not this seed, waiting for it. That also makes `?reset=1` unnecessary: the context starts with an
 * empty localStorage, so the seed *is* the clean slate.
 */
async function seedPlayer(page: Page, id = 'volt', name = 'Ada', extra: Record<string, unknown> = {}) {
  await page.addInitScript(save => {
    if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save);
  }, JSON.stringify({ v: 1, name, avatar: id, ...extra }));
  await page.goto('/');
  await expect(page.locator('.home')).toBeVisible();
}
/** Open the grown-ups dashboard from the map, answering the maths gate with the product it asks for. */
async function openGrownUps(page: Page) {
  await page.click('#grownups');
  await expect(page.locator('.parents .gate')).toBeVisible();
  const q = await page.locator('#gate-q').textContent();          // e.g. "6 × 8"
  const [a, b] = q!.split('×').map(s => parseInt(s.trim(), 10));
  await page.fill('#gate-input', String(a * b));
  await page.click('#gate-go');
  await expect(page.locator('.parents-dash')).toBeVisible();
}
async function startTopic(page: Page, year: string, topic: string) {
  if (await page.locator('.island-screen').count()) await page.click('#back');
  await page.click(`.island[data-year="${year}"]`);
  await expect(page.locator('.island-screen')).toBeVisible();
  const subjectTab = TOPICS.find(t => t.id === topic)?.subject ?? 'maths';   // from the registry, not a topic-id regex (#27)
  await page.click(`.tab[data-s="${subjectTab}"]`);
  await page.click(`.topic[data-id="${topic}"]`);
  await expect(page.locator('.play')).toBeVisible();
  await page.waitForFunction(() => window.__sna?.state().prompt);
}
/**
 * Real-pointer slice through the correct bubble. Pointer round trips are slow under headless software
 * rendering (hundreds of ms each), so the wave is frozen in place first: this test checks the pointer →
 * canvas → segment hit → session path, not the physics (the other tests cover flight and falling).
 */
/** Freeze every bubble where it is and read them back with the canvas box offset. */
async function freezeWave(page: Page) {
  return page.evaluate(() => {                      // freeze every bubble where it is; never launch the rest of the wave
    const a = window.__sna.arena;
    for (const x of a.bubbles) { if (x.launched) { x.vx = 0; x.vy = 0; x.g = 0; } else x.launchAt = Infinity; }
    // bubbles() returns canvas-space coords (arena.pos subtracts the canvas rect); the arena is now centred and
    // capped (#67), so page.mouse (viewport coords) must add the canvas box offset — 0 on a phone, non-zero on desktop.
    const rect = (document.getElementById('arena') as HTMLCanvasElement).getBoundingClientRect();
    return { others: window.__sna.bubbles(), W: a.W, H: a.H, top: a.topInset, ox: rect.left, oy: rect.top };
  });
}
/** Wait for the bubble that answers the current question, freeze the wave, and return it with its neighbours. */
async function frozenTarget(page: Page) {
  const b = await page.waitForFunction(() => {
    const s = window.__sna; if (!s || s.state().waiting) return null;
    const label = s.session.current.sequence ? s.session.current.sequence[s.session.seqIndex] : s.session.current.answer;
    const hit = s.bubbles().find((x: any) => x.label === label && x.y > 60 && x.y < window.innerHeight - 20);
    return hit ? JSON.stringify(hit) : null;
  }, null, { timeout: 15000 });
  const label = JSON.parse(await b.jsonValue() as string).label as string;
  const { others, W, H, top, ox, oy } = await freezeWave(page);
  const target = others.find((x: any) => x.label === label);   // position after the freeze, not before the round trip
  return { target, others, W, H, top, ox, oy };
}
async function swipeAnswer(page: Page) {
  const { target, others, W, H, top, ox, oy } = await frozenTarget(page);
  // Approach from a side with no other bubble in the way (a stroke through a decoy counts as a wrong answer),
  // and whose start point is still on the canvas (edge bubbles sit r+8 from the side; the question card covers the top).
  const decoys = others.filter((x: any) => x.label !== target.label);
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const onCanvas = (dx: number, dy: number) => { const sx = target.x + dx * target.r * 1.6, sy = target.y + dy * target.r * 1.6; return sx > 4 && sx < W - 4 && sy > top + 4 && sy < H - 4; };
  const clear = (dx: number, dy: number) => onCanvas(dx, dy) && decoys.every((o: any) => [1.6, 1.1, 0.6].every(k => Math.hypot(o.x - (target.x + dx * target.r * k), o.y - (target.y + dy * target.r * k)) > o.r * 1.2 + 4));
  const [dx, dy] = dirs.find(([x, y]) => clear(x, y)) ?? dirs.find(([x, y]) => onCanvas(x, y)) ?? dirs[0];
  await page.mouse.move(ox + target.x + dx * target.r * 1.6, oy + target.y + dy * target.r * 1.6);
  await page.mouse.down();
  for (let i = 1; i <= 4; i++) { const k = 1.6 - (1.8 * i) / 4; await page.mouse.move(ox + target.x + dx * target.r * k, oy + target.y + dy * target.r * k); }
  await page.mouse.up();
}
const answer = (page: Page) => page.evaluate(() => window.__sna.answer());
const waitForTarget = (page: Page) => page.waitForFunction(() => { const s = window.__sna?.state(); if (!s || s.waiting) return false; const c = window.__sna.session.current; const label = c.sequence ? c.sequence[window.__sna.session.seqIndex] : c.answer; return window.__sna.bubbles().some((b: any) => b.label === label); }, null, { timeout: 20000 });
const state = (page: Page) => page.evaluate(() => window.__sna.state());
/**
 * Bring up a Sky Storm wave carrying a TNT. Bombs ride every third question (`play-session.ts`), but never a
 * sequence one, and Storm draws its topic at random from the year's pool — so the helper pins the pool to a
 * maths topic that never emits a sequence question *before* it forces "question 6". The wave that follows
 * then carries a bomb by the spawn rule alone, with nothing left to the RNG.
 *
 * guard rail (#278): the earlier helper left the pool alone and retried three times, spending an attempt
 * on every sequence draw. Three such draws in a row — a coin toss the tree under test has no say in — threw
 * "no TNT wave after 3 attempts" and held PR #274's merge (run 35432297494) on a diff that touched no game
 * code. A helper here never samples the RNG for a condition the game guarantees: pin the draw instead.
 *
 * `bubbles()` shows only launched bubbles and a bomb can ride the second batch seconds later, so the final
 * wait reads the launched list with a deadline rather than a count, and its predicate returns a boolean — a
 * JSON string would be truthy on the first frame and resolve the wait immediately.
 */
async function nextWaveWithBomb(page: Page) {
  const pinned = await page.evaluate(() => {
    const s = window.__sna.session;
    s.o.pool = s.o.pool!.filter(t => t.id === 'y2-tables');            // a maths topic: no generator path makes a sequence
    s.questionsAsked = 5;
    return s.o.pool.length;
  });
  expect(pinned, 'the Storm pool must still hold the pinned topic').toBe(1);
  await solveCurrent(page);                                              // the wave this spawns is "question 6"
  const drawn = await page.evaluate(() => {
    const s = window.__sna.session;
    return { ended: s.ended, asked: s.questionsAsked, sequence: !!s.current?.sequence, topic: s.currentTopic?.id };
  });
  if (drawn.ended) throw new Error('the Storm ended before the TNT wave came up');
  expect(drawn, 'question 6 came from the pinned topic and is not a sequence').toEqual({ ended: false, asked: 6, sequence: false, topic: 'y2-tables' });
  await page.waitForFunction(() => window.__sna.bubbles()                // let the TNT rise into a tappable spot
    .some((b: any) => b.label === '💣' && b.vy < 0 && b.y > 80 && b.y < window.innerHeight - 40), null, { timeout: 15000 });
}

/** Answer the current question via the hook and wait for the next one (a sequence question needs one slice per letter). */
async function solveCurrent(page: Page) {
  const before = await page.evaluate(() => window.__sna.session.questionsAsked as number);
  for (let k = 0; k < 16; k++) {
    await waitForTarget(page);
    if (!await answer(page)) continue;                                   // the wave fell and respawned between the wait and the slice
    if (await page.evaluate(() => window.__sna.state().waiting)) break;   // decided; otherwise it was a step in a sequence
  }
  await page.waitForFunction((n) => window.__sna.session.questionsAsked > n || window.__sna.state().ended, before);
}
/** Wait until a wrong bubble can be sliced on a live question — or the game has ended. */
const waitForWrongOrEnd = (page: Page) => page.waitForFunction(() => { const s = window.__sna?.state(); if (!s) return false; if (s.ended) return true; if (s.waiting) return false; const c = window.__sna.session.current; const t = c.sequence ? c.sequence[window.__sna.session.seqIndex] : c.answer; const bs = window.__sna.bubbles(); return bs.some((b: any) => b.label === t) && bs.some((b: any) => b.label !== t && b.label !== '💣'); }, null, { timeout: 20000 });   // a decoy must be in flight too (every 3rd Storm wave adds a TNT bubble, which never counts as a wrong slice)
async function answerAll(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    await page.waitForFunction(() => { const s = window.__sna?.state(); return s && !s.waiting && window.__sna.bubbles().some((b: any) => b.label === (window.__sna.session.current.sequence ? window.__sna.session.current.sequence[window.__sna.session.seqIndex] : s.answer)); });
    expect(await answer(page)).toBe(true);
    await page.waitForFunction((i) => { const s = window.__sna?.state(); return s && (s.index > i || s.ended || document.querySelector('.celebrate')); }, i);
  }
}

test.describe('Sky Ninja Academy', () => {
  // #32: run the whole suite at 4× game speed. The app reads `window.__SNA_FAST` at boot (src/game/speed.ts)
  // and divides only the scheduled waits — outcome holds, the inter-question gap, the launch stagger and the
  // bubble flight time — so the suite runs in a fraction of real game time without touching the clock the
  // guard rails read. One test below overrides this to 1 to pin the holds to their curriculum values.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { window.__SNA_FAST = 4; });
  });

  test('avatar selection is required, saved and shown on the home screen', async ({ page }) => {
    await pickAvatar(page, 'blaze', 'Zoe');
    await expect(page.locator('.hero b')).toHaveText('Zoe');
    await expect(page.locator('.hero small')).toContainText('Blaze');
    await page.goto('/');
    await expect(page.locator('.home')).toBeVisible(); // remembered
  });

  test('Master Ninja is locked until every topic has a star, then becomes a playable avatar', async ({ page }) => {
    await page.goto('/?reset=1');
    const card = page.locator('.avatar-card[data-id="master"]');
    await expect(page.locator('.avatar-card')).toHaveCount(11);
    await expect(card).toHaveClass(/locked/);
    await expect(card.locator('.lock')).toBeVisible();
    await expect(card.locator('small')).toHaveText(`0/${TOPICS.length} topics ★`);
    await card.click();
    await expect(page.locator('#next')).toBeDisabled();                               // a locked card never selects
    await expect(card).not.toHaveClass(/sel/);
    // Star every topic (as a finished player would have) and come back: the Master is unlocked.
    await page.evaluate((ids) => {
      const progress = Object.fromEntries(ids.map(id => [id, { stars: 1, best: 10, plays: 1 }]));
      localStorage.setItem('sna:v1', JSON.stringify({ v: 1, name: 'Ada', avatar: null, progress }));
    }, TOPICS.map(t => t.id));
    await page.goto('/');
    await expect(card).not.toHaveClass(/locked/);
    await expect(card.locator('small')).toHaveText('Sensei of all elements');
    await card.click();
    await expect(card).toHaveClass(/sel/);
    await page.click('#next');
    await expect(page.locator('#name')).toHaveValue('Ada');   // carried over from the seeded save
    await page.click('#go');
    await expect(page.locator('.intro-card')).toBeVisible();   // #67: first run continues into the introduction
    await page.click('#intro-go');
    await expect(page.locator('.hero small')).toContainText('Master Ninja');
    await page.click('.island[data-year="year1"]');
    await expect(page.locator('#train img')).toHaveAttribute('src', /sensei/);         // Sensei fronts the training button
    await page.click('.tab[data-s="maths"]'); await page.click('.topic[data-id="y1-add"]');
    await expect(page.locator('.play')).toBeVisible();
    await page.waitForFunction(() => window.__sna?.state().prompt);
    expect(await page.evaluate(() => window.__sna.arena.fx)).toBe('master');             // the trail mixes every element
    await expect(page.locator('.tutorial .tut-sensei img')).toHaveAttribute('src', /sensei/);
  });

  test('avatar screen: the last card row is never left under the sticky Continue button (#51)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 664 });        // the shortest phone we support
    await page.goto('/?reset=1');
    await expect(page.locator('.avatar-card')).toHaveCount(11);
    const clearance = () => page.evaluate(() => {
      const cards = document.querySelectorAll('.avatar-card');
      const last = cards[cards.length - 1].getBoundingClientRect();  // Master, bottom-right
      const next = (document.querySelector('#next') as HTMLElement).getBoundingClientRect();
      return Math.round(next.top - last.bottom);                     // px between the last card and the button (≥ 0 = clear)
    });
    // From the top the last row is below the fold; tapping it must scroll it fully clear of the sticky button.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('.avatar-card').last().click();               // locked Master → shakes and reveals itself
    await expect.poll(clearance, { timeout: 3000 }).toBeGreaterThanOrEqual(0);
    // and there is enough scroll runway to bring the row fully above the button
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect(await clearance()).toBeGreaterThanOrEqual(0);
  });

  /**
   * #110, both halves — now the wizard-split version (#67). The field used to be the last thing on a page
   * that also carried all eleven cards, and `Let's go!` only ever asked for an avatar — so a child could walk
   * straight past it and every screen downstream fell back to the literal "Ninja", the printed certificate
   * included. Splitting the ninja pick and the name onto their own screens makes "visible without hunting
   * for it" structural rather than a matter of ordering: the name screen has nothing else on it to be under.
   *
   * "Visible without hunting for it" is measured as *on screen at first paint, before anything scrolls*,
   * which is the thing the old layout failed; `toBeInViewport` on its own would pass after a scroll.
   */
  test('avatar wizard: the name field is on screen from the start, and is required (#110, #67)', async ({ page }) => {
    await page.goto('/?reset=1');
    await expect(page.locator('.avatar-screen')).toBeVisible();
    await expect(page.locator('.avatar-card')).toHaveCount(11);
    await expect(page.locator('#name'), 'step 1 has no name field at all to bury (#110)').toHaveCount(0);

    // Required: an avatar alone advances past step 1, but not further.
    await expect(page.locator('#next')).toBeDisabled();
    await page.click('.avatar-card[data-id="volt"]');
    await expect(page.locator('#next')).toBeEnabled();
    await page.click('#next');

    // Step 2: on screen at first paint — no scrolling, nothing else on the screen to sit below.
    expect(await page.evaluate(() => window.scrollY), 'the screen must not have scrolled yet').toBe(0);
    await expect(page.locator('.avatar-grid'), 'step 2 has no avatar grid to bury the name field under (#110)').toHaveCount(0);
    await expect(page.locator('#name')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#name-hint')).toHaveText(/name/i);   // a friendly nudge, not an error

    // A space bar is not a name.
    await expect(page.locator('#go')).toBeDisabled();
    await page.fill('#name', '   ');
    await expect(page.locator('#go')).toBeDisabled();
    await page.fill('#name', 'Ada');
    await expect(page.locator('#go')).toBeEnabled();
    await expect(page.locator('#name-hint')).toBeEmpty();           // the nudge clears once there is a name
    await page.fill('#name', '');                                   // and comes back if the name is cleared again
    await expect(page.locator('#go')).toBeDisabled();
    await expect(page.locator('#name-hint')).toHaveText(/name/i);

    await page.fill('#name', 'Ada');
    await page.click('#go');
    // #67: first run continues into the introduction step, not straight to the map.
    await expect(page.locator('.intro-card')).toBeVisible();
    await page.click('#intro-go');
    await expect(page.locator('.home')).toBeVisible();

    // A returning player re-enters via #change-av for the ninja only (#67) — never the name field again,
    // and never the introduction a second time.
    await page.click('#change-av');
    await expect(page.locator('.change-avatar')).toBeVisible();
    await expect(page.locator('#name')).toHaveCount(0);
    await expect(page.locator('.intro-card')).toHaveCount(0);
    await expect(page.locator('.avatar-card.sel')).toHaveAttribute('data-id', 'volt');
    await page.click('#change-save');
    await expect(page.locator('.home')).toBeVisible();
  });

  /**
   * #67: the introduction step. First run only, personalised, read aloud, skippable, and never shown again —
   * a returning save already carries `onboarded: true` (set by the wizard, or by `migrate()` for anyone who
   * already has an avatar chosen — `storage.test.ts` covers that half without a browser).
   */
  test('onboarding: the introduction greets the child by name, reads aloud, and is skippable', async ({ page }) => {
    await stubSilentEngine(page, true);   // #65: headless Chromium's engine never actually starts a line
    await page.goto('/?reset=1');
    await page.click('.avatar-card[data-id="blaze"]');
    await page.click('#next');
    await page.fill('#name', 'Zoe');
    await page.click('#go');

    await expect(page.locator('.intro-card')).toBeVisible();
    await expect(page.locator('#intro-heading')).toHaveText(/Zoe/);
    await expect(page.locator('.intro-text')).toContainText('Zoe');
    await expect(page.locator('#intro-heading')).toBeFocused();          // focus moves to the new step (#67 a11y)
    await expect.poll(() => page.evaluate(() => window.__lastVoiceLine?.text)).toContain('Zoe');   // read aloud

    await page.click('#intro-skip');
    await expect(page.locator('.home')).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!).onboarded)).toBe(true);

    // A fresh load of the same profile never shows the wizard again.
    await page.goto('/');
    await expect(page.locator('.home')).toBeVisible();
    await expect(page.locator('.avatar-screen')).toHaveCount(0);
  });

  test('onboarding: hardware/browser back moves between all three wizard steps', async ({ page }) => {
    await page.goto('/?reset=1');
    await page.click('.avatar-card[data-id="volt"]');
    await page.click('#next');
    await expect(page.locator('#name')).toBeVisible();
    await page.fill('#name', 'Ada');
    await page.click('#go');
    await expect(page.locator('.intro-card')).toBeVisible();

    // step 3 → step 2: the name typed before moving on was not lost
    await page.goBack();
    await expect(page.locator('#name')).toHaveValue('Ada');

    // step 2 → step 1: the ninja picked two steps back was not lost either
    await page.goBack();
    await expect(page.locator('.avatar-screen')).toBeVisible();
    await expect(page.locator('.avatar-card.sel')).toHaveAttribute('data-id', 'volt');

    await page.goForward();
    await expect(page.locator('#name')).toHaveValue('Ada');

    await page.goForward();
    await expect(page.locator('.intro-card')).toBeVisible();

    await page.click('#intro-go');
    await expect(page.locator('.home')).toBeVisible();
  });

  test('onboarding: a reload mid-wizard does not lose the ninja that was already picked', async ({ page }) => {
    await page.goto('/?reset=1');
    await page.click('.avatar-card[data-id="terra"]');
    // Closing the app before the name/introduction steps must not lose the avatar choice (#67 acceptance).
    // Plain reload would re-clear the profile — `?reset=1` wipes storage on every load it appears in, this
    // test's own first line included — so the next launch is `/`, exactly like a real relaunch would be.
    await page.goto('/');
    await expect(page.locator('.avatar-screen')).toBeVisible();
    await expect(page.locator('.avatar-card.sel')).toHaveAttribute('data-id', 'terra');
  });

  /**
   * Review on PR #197: a reload while sitting on the name or intro step leaves that step's history entry
   * current (unlike a fresh boot, a same-URL reload reuses the entry in place rather than pushing a new
   * one), but boot always restarts at `chooseNinjaScreen` regardless of what that entry says. A fresh
   * walk-through then pushes two *more* entries on top of the stale one, and finishing unwinds a fixed
   * `history.go(-2)` — which landed back on the stale entry instead of the map, so "Let's go!" silently did
   * nothing. Reproduced independently before the fix (real build, real reload, real Chromium) and confirmed
   * fixed by gating the popstate handler's `onboard-name`/`onboard-intro` branches on `!load().onboarded`:
   * once the wizard is finished, a stale wizard-tagged entry from before the reload is inert no matter how
   * a later back-navigation reaches it.
   */
  for (const step of ['name', 'intro'] as const) {
    test(`onboarding: a reload on the ${step} step does not strand "Let's go!" (#197 review)`, async ({ page }) => {
      // Plain `/`, not `/?reset=1` — each test already gets a fresh, storage-free browser context, and this
      // test's own final back-navigation must never revisit a `?reset=1` URL still sitting in history: doing
      // so would re-trigger the reset param's storage wipe, which is a test-harness artefact, not this bug.
      await page.goto('/');
      await page.click('.avatar-card[data-id="volt"]');
      await page.click('#next');
      await page.fill('#name', 'Ada');
      if (step === 'intro') { await page.click('#go'); await expect(page.locator('.intro-card')).toBeVisible(); }
      else await expect(page.locator('#name')).toBeVisible();

      await page.goto('/');   // a real relaunch, mid-wizard — the stale history entry this regression needs

      // The wizard restarts at step 1 (chooseNinjaScreen always does, regardless of the stale entry), with
      // the ninja already picked carried over from storage.
      await expect(page.locator('.avatar-screen')).toBeVisible();
      await expect(page.locator('.avatar-card.sel')).toHaveAttribute('data-id', 'volt');

      // Walking the wizard through to the end must actually reach the map this time.
      await page.click('#next');
      await expect(page.locator('#name')).toBeVisible();
      await page.fill('#name', 'Ada');
      await page.click('#go');
      await expect(page.locator('.intro-card')).toBeVisible();
      await page.click('#intro-go');
      await expect(page.locator('.home')).toBeVisible();

      // And the stale entry from before the reload, wherever `history.go(-2)` actually left it in the
      // stack, is inert: one more hardware back does not resurrect a wizard screen now that onboarding is
      // done.
      await page.goBack();
      await expect(page.locator('.avatar-screen')).toHaveCount(0);
    });
  }

  /** #67 acceptance: "progress is obvious to a child" — a small dot rail across all three first-run steps. */
  test('onboarding: the wizard progress rail advances across all three steps, and is not shown to a returning player', async ({ page }) => {
    await page.goto('/?reset=1');
    await expect(page.locator('.wizard-progress')).toHaveAttribute('aria-label', 'Step 1 of 3');
    await expect(page.locator('.wizard-progress .dot.active')).toHaveCount(1);
    await expect(page.locator('.wizard-progress .dot').nth(0)).toHaveClass(/active/);

    await page.click('.avatar-card[data-id="blaze"]');
    await page.click('#next');

    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('.wizard-progress')).toHaveAttribute('aria-label', 'Step 2 of 3');
    await expect(page.locator('.wizard-progress .dot.active')).toHaveCount(1);
    await expect(page.locator('.wizard-progress .dot').nth(1)).toHaveClass(/active/);

    await page.fill('#name', 'Zoe');
    await page.click('#go');

    await expect(page.locator('.intro-card')).toBeVisible();
    await expect(page.locator('.wizard-progress')).toHaveAttribute('aria-label', 'Step 3 of 3');
    await expect(page.locator('.wizard-progress .dot.active')).toHaveCount(1);
    // it is the *third* dot that is active on step 3, not the first or second
    await expect(page.locator('.wizard-progress .dot').nth(2)).toHaveClass(/active/);

    await page.click('#intro-go');
    await expect(page.locator('.home')).toBeVisible();

    // a returning player re-entering via #change-av is not mid-wizard — no step rail to show them
    await page.click('#change-av');
    await expect(page.locator('.change-avatar')).toBeVisible();
    await expect(page.locator('.wizard-progress')).toHaveCount(0);
  });

  test('every year has maths and writing topics listed', async ({ page }) => {
    await seedPlayer(page);
    for (const y of ['reception', 'year1', 'year2']) {
      await page.click(`.island[data-year="${y}"]`);
      await expect(page.locator('.isl-head b')).toContainText(y === 'reception' ? 'Reception' : y === 'year1' ? 'Year 1' : 'Year 2');
      await page.click('.tab[data-s="maths"]'); expect(await page.locator('.topic').count()).toBeGreaterThanOrEqual(6);
      await page.click('.tab[data-s="writing"]'); expect(await page.locator('.topic').count()).toBeGreaterThanOrEqual(3);
      await page.click('#back'); await expect(page.locator('.map')).toBeVisible();
    }
  });

  test('real swipe slices the correct bubble and scores', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'year1', 'y1-add');
    await swipeAnswer(page);
    await expect(page.locator('#score')).not.toHaveText('0');
    await expect(page.locator('.toast.good')).toBeVisible();
  });

  test('a tap throws the ninja star: scored at the tap, and a swipe throws nothing (#48)', async ({ page }) => {
    await seedPlayer(page, 'kai');
    await startTopic(page, 'year1', 'y1-add');
    const { target, ox, oy } = await frozenTarget(page);
    await page.mouse.click(ox + target.x, oy + target.y);                          // a single tap, no swipe
    await expect(page.locator('#score')).not.toHaveText('0');                      // the score settles at the tap…
    const s = await state(page); expect(s.shots).toBe(1); expect(s.waiting).toBe(true);
    const live = await page.evaluate(() => window.__sna.bubbles().map((b: any) => b.label));
    expect(live).not.toContain(target.label);                                      // …and the bubble is resolved there too
    await expect(page.locator('.toast.good')).toBeVisible();
    await page.waitForFunction(() => !window.__sna.state().waiting && window.__sna.bubbles().length > 0);
    await swipeAnswer(page);
    await expect(page.locator('.toast.good')).toBeVisible();
    expect((await state(page)).shots).toBe(1);                                     // the slice popped it in place
  });

  // #48 review of PR #60: a tapped TNT threw a star at it, so it burst once from the BOMB branch and again
  // when the star landed — and the landing played the avatar's slice sound, rewarding the child for hitting
  // the bomb, while the exploded bubble kept falling for the 150 ms flight. Both failures are visible here:
  // a thrown star would raise `shots`, and a bubble waiting to be popped on landing would still be alive.
  test('a tapped TNT blows up under the finger — no star is thrown at it (#48)', async ({ page }) => {
    await seedPlayer(page, 'blaze', 'Ivy');
    await page.click('.island[data-year="year2"]');
    await page.click('#endless');                                                  // Sky Storm: Hammer Man drops TNT in
    await expect(page.locator('.villain img')).toBeVisible();
    await page.waitForFunction(() => window.__sna?.state().prompt);
    await nextWaveWithBomb(page);
    const { others, ox, oy } = await freezeWave(page);
    const bomb = others.find((x: any) => x.label === '💣');
    const before = await state(page);
    await page.mouse.click(ox + bomb.x, oy + bomb.y);
    await expect(page.locator('.toast.bad')).toContainText('TNT');
    const after = await state(page);
    expect(after.shots).toBe(before.shots);                                        // nothing was thrown at the bomb
    expect(after.lives).toBe(before.lives - 1);
    expect(await page.evaluate(() => window.__sna.arena!.bubbles.find((b: any) => b.label === '💣')!.dead)).toBe(true);
    expect(await page.evaluate(() => window.__sna.arena!.shots.length)).toBe(0);    // and none is in flight
  });

  test('wrong slice loses a life and shows the answer; correct then continues', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'year2', 'y2-tables');
    await page.waitForFunction(() => window.__sna.bubbles().length > 1);
    expect(await page.evaluate(() => window.__sna.wrong())).toBe(true);
    await expect(page.locator('.toast.bad')).toContainText('Not quite');
    await expect(page.locator('.lives span.off')).toHaveCount(1);
    await page.waitForFunction(() => window.__sna.state().index === 1);
  });

  test('statistics: the tally chart, then the pictogram and its key, reach the card (#8)', async ({ page }) => {
    // Reaching difficulty 2 means playing out stage 1, which is longer than the 60 s default — the same
    // reason the full-mission test raises its own. The pictogram is the only chart with arithmetic in its
    // rendering, so paying ~40 s once is worth more than leaving it unrendered in a browser.
    test.setTimeout(120_000);
    await seedPlayer(page);
    await startTopic(page, 'year2', 'y2-stats');
    // Stage 1 is difficulty 1, the tally chart. The drawing is the data for this topic, so if it does not
    // reach the card the question is unanswerable — a unit test of the renderer cannot see that.
    await expect(page.locator('.vis .chart.tally')).toBeVisible();
    await expect(page.locator('.vis .chart .chart-row')).toHaveCount(3);
    await expect(page.locator('.vis .chart .tal').first()).toBeVisible();
    // `bubbles().length > 1` is not enough to slice: it is true while the answer bubble is still to launch,
    // which is why every other topic test waits on `waitForTarget` for the labelled bubble itself.
    await waitForTarget(page);
    expect(await answer(page)).toBe(true);
    // No `|| ended` here: the one assertion meant to prove the question was answered must not also pass on a
    // session that ended for some other reason (#8 review).
    await page.waitForFunction(() => window.__sna.state().index > 0);

    // Stage 2 is difficulty 2, the pictogram — the kind with real arithmetic in its rendering, and the only
    // place the key line exists. Without this it never rendered in a browser at any viewport. The stage
    // length is read from the session rather than copied from `YEARS`, so this does not rot if it changes.
    const perStage = await page.evaluate(() => window.__sna.session.perStage as number);
    await answerAll(page, perStage - 1);
    await expect(page.locator('.celebrate h2')).toContainText('Stage 1 clear');
    await page.click('#next');
    await expect(page.locator('.vis .chart.pictogram')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.vis .chart .key')).toContainText(/^1 \S+ = [25]$/);
    const pics = await page.locator('.vis .chart .pic').count();
    expect(pics).toBeGreaterThan(0);
    // The symbol is deliberately not one of the categories, so no row is drawn in another row's emoji.
    const symbol = (await page.locator('.vis .chart .key').innerText()).split(' ')[1];
    for (const label of await page.locator('.vis .chart .cat').allInnerTexts()) expect(label).not.toContain(symbol);
  });

  // #137 "5. Smaller, same family": the block diagram (d3) never rendered in a browser at all — the e2e rail
  // above stops at d2, and unit tests cannot see CSS layout. Year 2's `diffs` array (`src/curriculum/types.ts`)
  // is `[1, 2, 2, 3, 3]`, so difficulty 3 is not reached until stage 4 — three whole stages must be played
  // first, which is why this is its own test rather than an extension of the one above.
  test('statistics: the block diagram reaches the card without overflowing a narrow viewport (#137)', async ({ page }) => {
    test.setTimeout(240_000);
    await seedPlayer(page);
    await startTopic(page, 'year2', 'y2-stats');
    const perStage = await page.evaluate(() => window.__sna.session.perStage as number);
    for (let stage = 1; stage < 4; stage++) {
      await answerAll(page, perStage);
      await expect(page.locator('.celebrate')).toBeVisible();
      await page.click('#next');
    }
    // Every question from here is difficulty 3: `y2Stats`'s `kind` is a pure function of `d`
    // (`src/curriculum/maths.ts`), so every one of this stage's questions is a block diagram — nothing here
    // depends on which survey or which `ask` was rolled. What *is* random is each row's count (`ri(rng, 1, 9)`
    // per row, capped at 10 by the unit rail in `tests/unit/curriculum.test.ts`), which is exactly the input
    // the CSS in `src/style.css` (`.chart .blk`, `clamp(14px, 4.4vw, 20px)` each) has never been checked
    // against in a real layout engine — checking every question in the stage, not just the first, gives this a
    // real chance of drawing the worst case (nine `.blk` boxes in one row) at least once.
    for (let i = 0; i < perStage; i++) {
      await expect(page.locator('.vis .chart.block')).toBeVisible();
      await expect(page.locator('.vis .chart .blk').first()).toBeVisible();
      // `.vis` is the row's own scroller (`src/ui/visuals.ts`'s wrapper div): scrollWidth outgrowing
      // clientWidth means a row of blocks has pushed past the edge of the phone screen, which is unreadable
      // rather than merely ugly — the whole point of #137 item 1's sibling check for the tally gate.
      const overflow = await page.locator('.vis').evaluate(el => el.scrollWidth - el.clientWidth);
      expect(overflow, `a chart row overflowed the viewport by ${overflow}px`).toBeLessThanOrEqual(1);
      await waitForTarget(page);
      expect(await answer(page)).toBe(true);
      await page.waitForFunction((idx) => { const s = window.__sna?.state(); return s && (s.index > idx || s.ended || document.querySelector('.celebrate')); }, i);
    }
  });

  // #299 slice 4: for `y2-symmetry` the drawing *is* the question — "Is the dotted line a line of symmetry?"
  // is unanswerable without the picture and the line, and a unit test of `renderVisual` cannot see whether
  // the SVG is laid out, sized or visible in a browser. Stage 1 is difficulty 1 (`YEARS[year2].diffs` is
  // `[1, 2, 2, 3, 3]`), which `y2Symmetry` makes the drawn card unconditionally, so the first question is
  // always this visual — nothing here depends on the roll.
  test('symmetry: the mirror line and both halves of the picture reach the card (#299)', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'year2', 'y2-symmetry');
    await expect(page.locator('.vis .symgrid')).toBeVisible();
    // `toBeVisible()` is not the check for the fold line: an SVG `<line>` is zero-wide, so Playwright reads
    // its bounding box as empty and calls it hidden. Its geometry below is what proves it was laid out.
    await expect(page.locator('.vis .symgrid .mirror')).toHaveCount(1);
    // Every square is drawn, and at least one is filled: a card of empty slots is a picture of nothing, and
    // the answer would be "yes" for the wrong reason.
    expect(await page.locator('.vis .symgrid rect').count()).toBeGreaterThan(3);
    expect(await page.locator('.vis .symgrid rect.on').count()).toBeGreaterThan(0);
    // The fold line sits on the middle of the grid, which is what makes the two halves comparable at a glance.
    const geom = await page.locator('.vis .symgrid').evaluate(el => {
      const svg = el as unknown as SVGSVGElement, box = svg.getBoundingClientRect();
      const line = svg.querySelector('line')!.getBoundingClientRect();
      return { centre: box.left + box.width / 2, line: line.left + line.width / 2, span: line.height, height: box.height, width: box.width, overflow: el.parentElement!.scrollWidth - el.parentElement!.clientWidth };
    });
    expect(Math.abs(geom.centre - geom.line), 'the mirror line is down the middle').toBeLessThanOrEqual(1.5);
    expect(geom.span, 'the fold line runs the height of the picture').toBeGreaterThanOrEqual(geom.height * 0.9);
    expect(geom.width, 'the picture is drawn at a readable size').toBeGreaterThan(100);
    expect(geom.overflow, `the picture overflowed the viewport by ${geom.overflow}px`).toBeLessThanOrEqual(1);
    await waitForTarget(page);
    expect(await answer(page)).toBe(true);
    await page.waitForFunction(() => window.__sna.state().index > 0);
  });

  test('completing stage 1 shows the avatar celebrating with a praise line', async ({ page }) => {
    await seedPlayer(page, 'kai', 'Sam');
    await startTopic(page, 'year1', 'y1-bonds');
    await answerAll(page, 6);
    const modal = page.locator('.celebrate');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h2')).toContainText('Stage 1 clear');
    await expect(modal.locator('img')).toHaveAttribute('src', /kai\.webp/);
    await expect(modal.locator('.speech')).toContainText('Sam');
    await expect(modal.locator('.stars')).toContainText('★★★');
    await page.click('#next');
    await page.waitForFunction(() => window.__sna.state().stage === 2);
  });

  test('a full mission (5 stages) ends with results, medal, coins, a sticker and saved stars', async ({ page }) => {
    test.setTimeout(150_000);
    await seedPlayer(page, 'terra');
    await startTopic(page, 'reception', 'r-count');
    const stages = await page.evaluate(() => window.__sna.session.stages);
    expect(stages).toBe(5);
    for (let stage = 1; stage <= stages; stage++) {
      await answerAll(page, 5);
      const modal = page.locator('.celebrate');
      await expect(modal).toBeVisible();
      await expect(modal.locator('h2')).toContainText(`Stage ${stage} clear`);
      await page.click('#next');
    }
    const results = page.locator('.results');
    await expect(results).toBeVisible();
    await expect(results.locator('h2')).toHaveText('Mission complete!');
    await expect(results.locator('.medal')).toHaveText('🥇');
    await expect(results.locator('.coin-gain')).toContainText('+120');   // 25 correct + 15 stars×5 + 20 mission
    await expect(results.locator('.unlock')).toHaveCount(3);              // 120 coins → the three coin stickers at 30, 70, 120 (#114: the rest is achievement-based, not more coins)
    const dojoBonus = (await results.locator('.dojo-bonus .gain').allTextContents()).reduce((n, t) => n + Number(t.replace(/\D/g, '')), 0);   // today's Daily Dojo may pay for the mission / 3 stars / no slips / combo
    await expect(results.locator('#cert')).toBeVisible();                   // printable certificate for a completed mission
    // guard rail (#398 round 1/2, B1/B2), on the exact scenario the review found both in: a mission this tall
    // (a medal, three unlocks and a dojo bonus) overflows the overlay, which is what exposes them.
    // B1 — a `position: sticky` nav row held a fixed on-screen band for most of the scroll range, so
    // reordering the DOM only changed which *other* element's static position fell into that band, never
    // whether the overlap happened — caught only by sweeping scroll positions, not the one spot
    // `scrollIntoViewIfNeeded()` happens to land on (round 2 review). `.row.nav` is now a flex sibling outside
    // the scrolling `.scroll` region, so no scroll position should put anything underneath it.
    //
    // Settle `.modal`'s own 350ms pop-in (`transform: scale(.7 → 1)`) before capturing ANY position on this
    // overlay — found chasing `pr-test-analyzer`'s round-3 desktop flake (6/10 pass) and a real failure of
    // this exact assertion in my own desktop run. A scale still in flight shifts every descendant's rect by a
    // different amount from the transform origin, so `scrollerBox` captured mid-animation and `stepBox`
    // captured later, once it has settled, describe two different geometries — the sweep below can then miss
    // every position where the button is genuinely visible. See the K.O. test further down for the same
    // mechanism measured directly.
    await page.waitForTimeout(500);
    const scroller = results.locator('.scroll');
    const scrollerBox = (await scroller.boundingBox())!;
    const maxScroll = await scroller.evaluate(el => el.scrollHeight - el.clientHeight);
    expect(maxScroll, 'this scenario must actually overflow, or the sweep below proves nothing').toBeGreaterThan(0);
    let sawCertOnScreen = false;
    // A tolerance wider than one pixel: `scrollHeight`/`clientHeight` are integers and the fractional
    // `getBoundingClientRect()` values they are compared against are not, so the very last step or two of a
    // sweep can read a few px "short" of the scroller's box with no scroll position actually cutting it off.
    const slack = 24;
    // `maxScroll` itself is always swept explicitly (round 3 review, non-blocking B2): a fixed stride can
    // land short of it by up to (stride - 1)px on a viewport/content combination where `maxScroll` is not a
    // multiple of the stride, which left the last few pixels of real scroll range untested.
    const steps = []; for (let top = 0; top < maxScroll; top += 15) steps.push(top); steps.push(maxScroll);
    for (const top of steps) {
      await scroller.evaluate((el, t) => { el.scrollTop = t; }, top);
      const stepBox = (await results.locator('#cert').boundingBox())!;
      const onScreen = stepBox.y >= scrollerBox.y - slack && stepBox.y + stepBox.height <= scrollerBox.y + scrollerBox.height + slack;
      if (!onScreen) continue;   // cert clipped by the scroll region at this position — nothing visible to hit-test
      sawCertOnScreen = true;
      const atCertTop = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el ? `${el.id} ${el.className}` : '';
      }, { x: stepBox.x + stepBox.width / 2, y: stepBox.y + 2 });
      expect(atCertTop, `at scrollTop ${top}, the nav row must not paint over the certificate button`).not.toContain('nav');
      expect(atCertTop, `at scrollTop ${top}, the point must land on the certificate button itself`).toContain('cert');
    }
    expect(sawCertOnScreen, 'the sweep must actually see the certificate button visible at some scroll position').toBe(true);
    // B2 — `.modal.results` switching to a flex column stretched `.hero-big` (normally ~200px, shrink-wrapping
    // its avatar art) to the column's full width, which pushed `.speech` — positioned at 68% of ITS OWN box —
    // off the right edge of a phone screen on any headline longer than the shortest one.
    const heroBox = (await results.locator('.hero-big').boundingBox())!;
    expect(heroBox.width, 'hero-big must keep shrink-wrapping its ~200px avatar art').toBeLessThan(260);
    const speechBox = (await results.locator('.speech').boundingBox())!;
    expect(speechBox.x + speechBox.width, 'the speech bubble must stay on screen')
      .toBeLessThanOrEqual(page.viewportSize()!.width);
    const png = await page.evaluate(() => window.__sna.certificate());
    expect(png).toMatch(/^data:image\/png;base64,/); expect(png.length).toBeGreaterThan(20_000);

    // #205: the certificate is filed the moment it is *earned*, before the 🎓 button is touched — on the
    // Android tablet that button does nothing at all, and that is exactly the child whose certificate has
    // to survive the results overlay closing. Asserted here, above the delivery routes, so a regression
    // that only files on a successful save cannot hide behind the two that work.
    const album = await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!).certs);
    expect(album).toHaveLength(1);
    // `name` and `avatar` are the two fields `fileCertificate()` reads from the save rather than copying from
    // `CertInfo`, so they are the wiring nothing else checks: with `avatar` dropped, every certificate a child
    // has earned silently redraws with the default ninja's face, because `avatarById` is total by design.
    // Both come from this test's own seed — `seedPlayer(page, 'terra')`, whose `name` default is 'Ada'.
    expect(album[0]).toMatchObject({ id: 'reception:r-count', year: 'Reception', training: false, name: 'Ada', avatar: 'terra' });
    expect(album[0].stars).toBeGreaterThan(0);
    expect(album[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // #50: the 🎓 button always delivers — it never silently does nothing.
    await page.evaluate(() => { (navigator as any).canShare = () => false; });   // exercise the non-share routes deterministically (headless can't complete a real Web Share)
    // (a) artifact viewer WITH the downloads grant → the save prompt
    await page.evaluate(() => {
      (window as any).__saved = null;
      (window as any).claude = { use: async (n: string) => n === 'downloads' ? { save: async (r: any) => { (window as any).__saved = r.filename; return { status: 'saved' }; } } : null };
    });
    await page.click('#cert');
    await expect(page.locator('#cert')).toBeEnabled();
    await expect(page.locator('#toast')).toContainText('saved');
    expect(await page.evaluate(() => (window as any).__saved)).toMatch(/^sky-ninja-certificate-.*\.png$/);
    // AND IT GOES AWAY AGAIN. The auto-hide is 1300ms, and nothing asserted it until now: PR #474's round-1
    // review found that a beat armed under the results screen's own hold was frozen and never armed, so this
    // toast pinned itself over the modal for the life of the screen — and the untested auto-hide made the
    // assertion above *steadier* while the behaviour broke. The worst of the four messages is
    // 'Could not make the certificate', which a child cannot clear by pressing the button again.
    await expect(page.locator('#toast'), 'the certificate toast hides itself again (PR #474 review, B1)')
      .not.toHaveClass(/show/, { timeout: 4000 });
    // (b) artifact viewer WITHOUT a downloads grant → the full-screen "press and hold" fallback
    await page.evaluate(() => { (window as any).claude = { use: async () => null }; });
    await page.click('#cert');
    const certView = page.locator('.cert-view');
    await expect(certView).toBeVisible();
    await expect(certView.locator('.cert-view-hint')).toContainText('Press and hold');
    await certView.getByRole('button', { name: 'Done' }).click();
    await expect(certView).toHaveCount(0);
    await page.evaluate(() => { delete (window as any).claude; });   // leave the runtime clean for the rest of the test

    await page.click('#home');
    await expect(page.locator('.island-screen')).toBeVisible();
    await expect(page.locator('.topic[data-id="r-count"] .stars')).toContainText('★★★');
    await page.click('#back');
    await expect(page.locator('.island[data-year="reception"] .isl-stars')).toContainText('★ 3/');
    await expect(page.locator('#rewards b')).toHaveText(String(120 + dojoBonus));
    await page.click('#rewards');
    await expect(page.locator('.rewards')).toBeVisible();
    await expect(page.locator('.sticker.got')).toHaveCount(3);
  });

  test('"My certificates" (#110): an earned certificate lists on the rewards screen, and View opens it full-screen with tap-to-zoom', async ({ page }) => {
    const cert = { id: 'reception:r-count', name: 'Ada', avatar: 'volt', year: 'Reception', title: 'Counting to 10', stars: 3, score: 250, correct: 20, attempts: 20, date: '2026-09-10' };
    // Seeded with a duel as well as a certificate (#415 round 2, note 3). With no duel on the page
    // `.cert-row:not(.duel-row)` is literally `.cert-row`, so the scoping this test depends on was green
    // even when reverted. One of each makes the split load-bearing here and in the two QA flow scripts.
    const duel = { at: 1_757_000_000_000, topic: 'y1-bonds', title: 'Number bonds', year: 'Year 1', winner: 'a', scoreA: 6, scoreB: 4, rounds: 10 };
    await seedPlayer(page, 'volt', 'Ada', { certs: [cert], duels: [duel] });
    await page.click('#rewards');
    await expect(page.locator('.rewards')).toBeVisible();
    await expect(page.locator('.cert-empty')).toHaveCount(0);
    // Scoped to the album, not the page: "Recent duels" borrows `cert-row`'s rule, so an unscoped locator
    // counts duel rows too and this test would fail pointing at the album (#415 review, note 1).
    const row = page.locator('.cert-row:not(.duel-row)');
    await expect(row).toHaveCount(1);
    // Both kinds are on the screen: unscoped, this would be 2, which is what the album's own test would have
    // started failing on the day a seed carried a duel.
    await expect(page.locator('.cert-row')).toHaveCount(2);
    await expect(page.locator('.duel-row')).toHaveCount(1);
    await expect(row, 'the scoped locator is the certificate, not the duel').toContainText('Counting to 10');
    await expect(row).toContainText('Counting to 10');
    await expect(row).toContainText('★★★');

    await page.click('.cert-open');
    const view = page.locator('.cert-view');
    await expect(view).toBeVisible();
    const img = view.locator('.cert-view-img');
    await expect(img).toHaveAttribute('src', /^data:image\/png/);
    await expect(view.locator('.cert-view-hint')).toContainText('Tap to zoom');

    await img.click();                                        // tap to zoom in
    await expect(img).toHaveClass(/zoomed/);
    await img.click();                                        // tap again to zoom back out
    await expect(img).not.toHaveClass(/zoomed/);

    await view.getByRole('button', { name: 'Done' }).click();
    await expect(view).toHaveCount(0);
  });

  test('"Recent duels" (#16): finished matches list on the rewards screen, newest first, in seat order', async ({ page }) => {
    // Seeded at `v: 1`, like every other save here, so this also climbs the ladder through the v3 → v4 step.
    // What kills a mutant in `MIGRATIONS[3]` is the unit test in `storage.test.ts`, not this: empty that
    // step's body and `duelHistory()`'s own filter drops the junk row anyway and this stays green (#415
    // review, note 4). What this proves is the whole path — a real save, migrated, read and rendered.
    const match = (at: number, extra: Record<string, unknown> = {}) =>
      ({ at, topic: 'y1-bonds', title: 'Number bonds', year: 'Year 1', winner: 'a', scoreA: 6, scoreB: 4, rounds: 10, ...extra });
    await seedPlayer(page, 'volt', 'Ada', {
      duels: [
        match(1_757_100_000_000, { topic: 'y1-days', title: 'Days of the week', winner: 'b', scoreA: 3, scoreB: 7 }),
        match(1_757_000_000_000),
        { topic: 'y1-bonds', title: 'junk' },                     // a hand-edited row: never reaches the list
      ],
    });
    await page.click('#rewards');
    await expect(page.locator('.rewards')).toBeVisible();

    const lines = page.locator('.duel-line');
    await expect(lines).toHaveCount(2);                           // the junk row is filtered, not rendered
    // Newest first, and the scoreline in seat order — Player 1's score stays on the left in BOTH rows, which
    // is the whole reason this line is not `duelHeadline`. Sorted by winner, row 0 would read "7–3".
    await expect(lines.nth(0)).toHaveText('Player 2 won · 3–7');
    await expect(lines.nth(1)).toHaveText('Player 1 won · 6–4');
    await expect(page.locator('.cert-row').filter({ hasText: 'Days of the week' })).toBeVisible();
    // The section's own heading and subtitle (#415 round 2, note 2): both were untested, so collapsing
    // `duelsSub` to a constant or deleting the heading line was green.
    await expect(page.getByText('Recent duels')).toBeVisible();
    await expect(page.getByText('your last 2 matches')).toBeVisible();
    await expect(page.locator('.duel-ava').first()).toBeVisible();
  });

  test('"Recent duels" (#16): a player who has never duelled gets the hint, not an empty box', async ({ page }) => {
    await seedPlayer(page, 'volt', 'Ada');
    await page.click('#rewards');
    await expect(page.locator('.rewards')).toBeVisible();
    await expect(page.locator('.duel-line')).toHaveCount(0);
    // Its own class, not `.cert-empty`: that one means "no certificates" to the album test above, and a
    // screen showing both lists cannot have one class meaning two things.
    await expect(page.locator('.duel-empty')).toContainText('Hand the device to a friend and play a Ninja Duel');
    await expect(page.locator('.cert-empty'), 'the album keeps its own empty state').toHaveCount(1);
    // The other two `duelsSub` branches are the singular and the empty one; this is the empty one.
    await expect(page.getByText('Play a Ninja Duel with a friend')).toBeVisible();
  });

  test('ninja shop: buy a trail skin with the balance, stickers keep their lifetime unlocks, the skin is equipped', async ({ page }) => {
    test.slow();   // three navigations, and each one waits ~12 s for the blocked Google Fonts stylesheet in the sandbox
    const seed = async (patch: Record<string, unknown>) => {   // patch the save, then reopen the app (not reload(): the URL still carries ?reset=1)
      await page.evaluate(p => { localStorage.setItem('sna:v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('sna:v1')!), ...p })); }, patch);
      await page.goto('/'); await expect(page.locator('.home')).toBeVisible();
    };
    await seedPlayer(page);
    await seed({ coins: 200, spent: 100, stickers: ['volt', 'blaze', 'splash'] });                // lifetime 200, balance 100
    await page.click('#rewards'); await page.click('#shop');
    await expect(page.locator('.shop')).toBeVisible();
    await expect(page.locator('#balance b')).toHaveText('100');
    await expect(page.locator('.item[data-item="trail-element"] .pill.on')).toBeVisible();     // free default is equipped
    await expect(page.locator('.item[data-item="trail-gold"] [data-buy]')).toBeDisabled();     // 200 coins needed, balance is 100
    await seed({ spent: 0 });                                                                   // balance 200
    await page.click('#rewards'); await page.click('#shop');
    await page.click('.item[data-item="trail-gold"] [data-buy]');
    await expect(page.locator('#balance b')).toHaveText('0');
    await expect(page.locator('.item[data-item="trail-gold"]')).toHaveClass(/\bon\b/);
    await expect(page.locator('.item[data-item="trail-element"] [data-equip]')).toBeVisible();
    await page.click('#back');                                                                  // pops the history entry back to Rewards
    await expect(page.locator('.rewards')).toBeVisible();
    await expect(page.locator('.sticker.got')).toHaveCount(3);                                  // the seeded stickers are untouched by spending
    await expect(page.locator('#rewards b')).toHaveText('0');                                   // the pill shows what is left to spend
    expect(await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('sna:v1')!); return [d.coins, d.spent, d.owned, d.equipped]; }))
      .toEqual([200, 200, ['trail-gold'], { trail: 'trail-gold' }]);                            // persisted
    await page.click('#back'); await expect(page.locator('.islands.big')).toBeVisible();        // Rewards → sky map (pops its history entry)
    await startTopic(page, 'reception', 'r-count');
    expect(await page.evaluate(() => window.__sna.state().trail)).toEqual({ color: '#ffd23a', core: '#fff6c4' });
  });

  test('ninja shop: a bought element trail overrides the avatar\'s own effect, not just its colour (#69)', async ({ page }) => {
    const water = itemById('trail-water')!;                                       // volt (the default seed avatar) is electric, not water
    await seedPlayer(page, 'volt', 'Ada', { coins: water.price, spent: 0 });
    await page.click('#rewards'); await page.click('#shop');
    await page.click(`.item[data-item="${water.id}"] [data-buy]`);
    await expect(page.locator(`.item[data-item="${water.id}"]`)).toHaveClass(/\bon\b/);
    await page.click('#back'); await expect(page.locator('.rewards')).toBeVisible();
    await page.click('#back'); await expect(page.locator('.islands.big')).toBeVisible();
    await startTopic(page, 'reception', 'r-count');
    expect(await page.evaluate(() => window.__sna.arena!.fx)).toBe('water');      // not volt's own 'electric'
    expect(await page.evaluate(() => window.__sna.state().trail)).toEqual(water.trail);
  });

  test('reception is gentle: missed bubbles re-ask without losing lives', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'reception', 'r-onemore');
    await page.waitForFunction(() => window.__sna.bubbles().length > 0);
    await page.waitForFunction(() => window.__sna.bubbles().length === 0, null, { timeout: 30000 }); // let the wave fall
    await expect(page.locator('.lives span.off')).toHaveCount(0);
    await page.waitForFunction(() => window.__sna.state().index === 1 && !window.__sna.state().waiting);
  });

  test('spelling: letters must be sliced in order', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'reception', 'r-build');
    const word = (await state(page)).answer as string;
    await expect(page.locator('.prompt .seq span')).toHaveCount(word.length);
    for (let i = 0; i < word.length; i++) {
      await page.waitForFunction(() => window.__sna.bubbles().some((b: any) => b.label === window.__sna.session.current.sequence[window.__sna.session.seqIndex]));
      expect(await answer(page)).toBe(true);
      if (i < word.length - 1) await expect(page.locator('.prompt .seq .got')).toHaveCount(i + 1);
    }
    await expect(page.locator('.toast.good')).toBeVisible();
  });

  test('Story Sentences: the sentence is shown, and its words must be sliced in order', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'reception', 'r-sentence');
    const sentence = (await state(page)).answer as string;
    const words = sentence.split(' ');
    await expect(page.locator('.vis.sentence')).toHaveText(sentence);
    await expect(page.locator('.prompt .seq span')).toHaveCount(words.length);
    await waitForWrongOrEnd(page);                                                     // a decoy must be in the air, not just the first word
    expect(await page.evaluate(() => window.__sna.wrong())).toBe(true);           // a word out of order is a slip
    await expect(page.locator('.toast.bad')).toContainText('Not quite');
    await page.waitForFunction(() => window.__sna.state().index === 1);
    await solveCurrent(page);                                                          // whole sentence, word by word
    await expect(page.locator('#score')).not.toHaveText('0');
  });

  test('guard rail: a pause inside the outcome hold holds the question — nothing advances behind the overlay (#301)', async ({ page }) => {
    // #301, the play-screen half of the same defect the duel carries. `hold(true)` paused the ARENA and left
    // the beats scheduled through `later()` running, so a pause pressed inside the ~1 s outcome hold let
    // `endWave`'s `clearWave` fire, `session.waveEnd()` advance, and the next question render, be SPOKEN and
    // spawn its wave with `launchAt` already in the past. The child came back to a wave flying at a question
    // they had never been shown. #65 stopped the peek's clock under an overlay; the outcome beats were left.
    await page.addInitScript(() => { window.__SNA_FAST = 1; });   // #32: real holds — a compressed one is not a hold anybody can press pause inside
    await seedPlayer(page);
    await startTopic(page, 'year1', 'y1-add');
    await waitForTarget(page);
    expect(await answer(page)).toBe(true);
    const before = await state(page);
    expect(before.waiting, 'the verdict is up and the hold has begun — this is the window the bug lives in').toBe(true);
    await page.click('#pause');
    await expect(page.locator('#resume')).toBeVisible();
    // Well past the correct hold AND the inter-question gap. Before the fix index had moved on by here.
    await page.waitForTimeout(3000);
    const held = await state(page);
    expect(held.index, 'the question does not advance behind the overlay').toBe(before.index);
    expect(held.prompt, 'nor is the next one written onto the card').toBe(before.prompt);
    expect(await page.evaluate(() => window.__sna.arena.frozen), 'and the sliced wave was never cleared').toBe(true);
    // And resuming spends the time the hold had LEFT, so the mission carries on rather than stalling.
    await page.click('#resume');
    await page.waitForFunction(i => window.__sna.state().index === i + 1 && !window.__sna.state().waiting,
      before.index as number, { timeout: 5000 });
  });

  test('outcome beat: a slice freezes the wave, spotlights the answer and fills in the card before moving on', async ({ page }) => {
    await page.addInitScript(() => { window.__SNA_FAST = 1; });   // #32: this test asserts the REAL outcome-beat pause (≥1200 ms) — it must run at game speed
    await seedPlayer(page);
    await startTopic(page, 'year1', 'y1-add');
    await waitForTarget(page);
    const expected = (await state(page)).answer as string;                        // read before the slice: the session moves on after the hold
    const t0 = Date.now(); expect(await answer(page)).toBe(true);
    // correct: wave frozen, the sliced bubble stays with a ✓, the card turns green with the answer filled in
    expect(await page.evaluate(() => window.__sna.arena.frozen)).toBe(true);
    expect(await page.evaluate(() => window.__sna.arena.bubbles.some((b: any) => b.mark === 'good' && !b.dead))).toBe(true);
    await expect(page.locator('.qcard.good .prompt .ans')).toHaveText(expected);
    await expect(page.locator('.qcard.good .hint')).toContainText("that's right");
    await page.waitForFunction(() => window.__sna.state().index === 1 && !window.__sna.state().waiting);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(1200);                       // a real pause before the next question
    await expect(page.locator('.qcard')).not.toHaveClass(/good|bad/);
    // wrong: the sliced bubble gets a ✗, the right one glows, the card goes red and names the answer
    await waitForWrongOrEnd(page);
    expect(await page.evaluate(() => window.__sna.wrong())).toBe(true);
    const marks = await page.evaluate(() => window.__sna.arena.bubbles.filter((b: any) => !b.dead && b.mark).map((b: any) => b.mark).sort());
    expect(marks).toEqual(['bad', 'good']);
    await expect(page.locator('.qcard.bad .hint')).toContainText('The answer is');
    expect(await page.evaluate(() => window.__sna.answer())).toBe(false);          // input is ignored while the outcome shows
    await page.waitForFunction(() => window.__sna.state().index === 2 && !window.__sna.state().waiting);
  });

  test('long sentences launch in batches that fit across the screen, never on top of each other', async ({ page }) => {
    await page.addInitScript(() => { window.__SNA_FAST = 1; });   // #32: samples flight every 400 ms over 2.4 s — tuned to real pacing; at 4× it would land on a miss-reveal freeze or a respawn, not free flight
    await seedPlayer(page);
    await startTopic(page, 'year2', 'y2-sentence');
    await page.waitForFunction(() => window.__sna.arena.bubbles.length >= 5);
    const info = await page.evaluate(() => { const a = window.__sna.arena; const r = a.bubbles[0].r; return { n: a.bubbles.length, fits: Math.floor((a.W - 16) / (2 * r + 10)), queued: a.bubbles.filter((b: any) => !b.launched).length }; });
    if (info.n > info.fits) expect(info.queued).toBeGreaterThan(0);              // more words than fit across → later batches wait (phones)
    // sample the flight a few times: launched bubbles must not overlap
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(400);
      const worst = await page.evaluate(() => { const bs = window.__sna.arena.bubbles.filter((b: any) => b.launched && !b.dead && !b.hit); let w = Infinity; for (const a of bs) for (const b of bs) if (a !== b) w = Math.min(w, Math.hypot(a.x - b.x, a.y - b.y) / (a.r + b.r)); return w; });
      expect(worst).toBeGreaterThan(0.75);
    }
  });

  test('the play area is capped and centred on a wide screen, full-width on a phone (#67)', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'reception', 'r-count');
    const m = await page.evaluate(() => {
      const c = document.getElementById('arena')!.getBoundingClientRect();
      const cap = parseFloat(getComputedStyle(document.querySelector('.play')!).getPropertyValue('--arena-w'));
      return { boxW: c.width, left: c.left, right: window.innerWidth - c.right, vw: window.innerWidth, W: window.__sna.arena.W, cap };
    });
    expect(m.W).toBeLessThanOrEqual(m.cap + 1);              // Arena.W follows the capped canvas box, not the window
    expect(Math.abs(m.boxW - m.W)).toBeLessThan(1.5);        // the physics width matches the CSS box
    if (m.vw > m.cap) {                                      // desktop / tablet: a bounded, centred arena
      expect(m.boxW).toBeLessThanOrEqual(m.cap + 1);
      expect(m.boxW).toBeLessThan(m.vw - 40);               // not window-wide
      expect(Math.abs(m.left - m.right)).toBeLessThan(2);   // centred, sky either side
    } else {                                                 // phone: the arena fills the width as before
      expect(m.boxW).toBeGreaterThan(m.vw - 2);
    }
  });

  /** #65: an engine that exists but never speaks — `speechSynthesis` present, no voices, `speak()` fires nothing. The APK's WebView without a TTS engine looks exactly like this (and so does headless Chromium). */
  const stubSilentEngine = (page: Page, keepLastLine = false) => page.addInitScript(keep => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false, pending: false, getVoices: () => [], cancel: () => {}, onvoiceschanged: null,
        speak: (u: SpeechSynthesisUtterance) => { if (keep) window.__lastVoiceLine = u; },
      },
    });
  }, keepLastLine);
  /**
   * #131: the opposite stub — an engine that starts every line synchronously, so the probe verdicts `yes`
   * straight away instead of racing the real 4 s `VOICE_START_MS` budget against however long the rest of a
   * test's actions take on a loaded runner. Headless Chromium exposes `speechSynthesis` but this container
   * never actually starts a line through it, which is exactly `stubSilentEngine`'s shape by accident rather
   * than by choice — a test that wants the spoken path and does not stub anything is at the mercy of that.
   */
  const stubSpeakingEngine = (page: Page) => page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false, pending: false, getVoices: () => [], cancel: () => {}, onvoiceschanged: null,
        speak: (u: SpeechSynthesisUtterance) => { (u.onstart as ((e: Event) => void) | null)?.(new Event('start')); },
      },
    });
  });
  const storedVoice = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!).voice as string);

  test('Sound Hunt: nothing to read on the card; the words appear only when read-aloud is off', async ({ page }) => {
    await stubSpeakingEngine(page);
    await seedPlayer(page);
    await startTopic(page, 'reception', 'r-soundhunt');
    await expect(page.locator('.prompt')).toHaveText('🔊 Listen!');
    await expect(page.locator('.vis')).toHaveCount(0);                                 // picture-free: no clue on the card
    const q = await page.evaluate(() => window.__sna.session.current);
    expect(q.say).toMatch(/^Listen: \w+, \w+, \w+\. Which sound/);                    // the sound is carried by spoken keywords only
    await waitForTarget(page); expect(await answer(page)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__sna.state().score)).toBeGreaterThan(0);
    // The stub actually started every line above (#131): the engine verdict is `yes`, so the keywords below
    // are read-aloud being turned off, not a real-time probe verdict landing by coincidence.
    await expect.poll(() => storedVoice(page)).toBe('yes');
    await page.click('#pause'); await page.click('#quit');
    await page.click('#spk');                                                          // read-aloud off → the card shows the words instead
    await startTopic(page, 'reception', 'r-soundhunt');
    const listen = await page.evaluate(() => window.__sna.session.current.listen as string);
    await expect(page.locator('.prompt')).toHaveText(listen);
    expect(listen.split(' · ')).toHaveLength(3);
  });

  // #65, one test per topic rather than one walk through all of them: the walk ran to ~60 s on a loaded desktop
  // runner and was reported as "page.goto hangs" — the test budget expiring mid-navigation, not a wedged page.
  test('no voice: Sound Hunt prints its keywords, mid-wave and without a pause, and stays answerable (#65)', async ({ page }) => {
    await stubSilentEngine(page);
    await seedPlayer(page, 'volt', 'Ada', { speech: true, voice: 'unknown', tutorialSeen: true });
    // `unknown` is optimistic, so the first card may show "🔊 Listen!" until the probe's silence budget
    // (VOICE_START_MS, real time, summed across the lines the questions hand it) runs out; then the keywords.
    await startTopic(page, 'reception', 'r-soundhunt');
    await expect.poll(() => storedVoice(page), { timeout: 10000 }).toBe('no');
    await expect.poll(() => page.evaluate(() => document.querySelector('.prompt')!.textContent === window.__sna.session.current.listen)).toBe(true);
    const keywords = await page.evaluate(() => window.__sna.session.current.listen as string);
    expect(keywords.split(' · ')).toHaveLength(3);
    expect(await page.evaluate(() => window.__sna.arena!.paused), 'a verdict landing mid-wave never freezes the bubbles').toBe(false);
    await expect(page.locator('#speak')).toBeHidden();                        // the words are on the card: no dead 🔊
    await answerAll(page, 1);                                                 // and the question can actually be answered
  });

  test('no voice: Build a Word shows the whole word to copy AND the place in it (#65)', async ({ page }) => {
    await stubSilentEngine(page);
    await seedPlayer(page, 'volt', 'Ada', { speech: true, voice: 'no', tutorialSeen: true });
    await startTopic(page, 'reception', 'r-build');
    const word = await page.evaluate(() => window.__sna.session.current.answer as string);
    await expect(page.locator('.prompt')).toHaveText(word);
    await expect(page.locator('.prompt .seq span')).toHaveCount(word.length);
    await waitForTarget(page); expect(await answer(page)).toBe(true);
    await expect(page.locator('.prompt .seq .got')).toHaveCount(1);           // progress is still shown …
    await expect(page.locator('.prompt')).toHaveText(word);                   // … and the copy word stays for every letter
    await solveCurrent(page);                                                 // the rest of the word is sliceable in order
  });

  test('no voice: a Story Sentence is shown, survives a pause, hides, can be shown again, and is buildable (#65)', async ({ page }) => {
    await stubSilentEngine(page);
    await seedPlayer(page, 'volt', 'Ada', { speech: true, voice: 'no', tutorialSeen: true });
    await startTopic(page, 'year1', 'y1-sentence');
    await waitForTarget(page);                                                // the d1 wave (sentence shown) is up …
    const sentence = await page.evaluate(() => {
      const s = window.__sna.session;
      s.stage = 2; s.index = 0; s.nextQuestion();                             // … when the hook jumps to d2 (listen-and-build)
      return s.current.answer;
    });
    await expect(page.locator('.prompt')).toHaveText(sentence);
    await expect(page.locator('#speak')).toHaveAttribute('aria-label', 'Show the sentence again');
    // The d1 bubbles are still the arena's wave: a launch under the overlay would replace them with d2's.
    const held = await page.evaluate(() => window.__sna.bubbles().map(b => b.label));
    await page.click('#pause');
    await expect(page.locator('#resume')).toBeVisible();
    await page.waitForTimeout(1500);                                          // twice the peek at 4×: it would have expired
    await expect(page.locator('.prompt'), 'a child who pauses mid-look keeps the sentence').toHaveText(sentence);
    expect(await page.evaluate(() => window.__sna.arena!.paused)).toBe(true);
    expect(await page.evaluate(() => window.__sna.bubbles().map(b => b.label)), 'nothing launches under the overlay').toEqual(held);
    await page.click('#resume');
    await expect(page.locator('.prompt .seq')).toBeVisible({ timeout: 3000 }); // the rest of the look runs from the resume
    await expect(page.locator('.prompt')).not.toHaveText(sentence);
    await expect.poll(() => page.evaluate(() => window.__sna.arena!.paused)).toBe(false);
    await waitForTarget(page);                                                // the bubbles launch only after the visual memory beat
    // the card tap is the repeat on a silent device: the sentence comes back for a look, bubbles frozen, then goes again
    await page.click('#speak');
    await expect(page.locator('.prompt')).toHaveText(sentence);
    expect(await page.evaluate(() => window.__sna.arena!.paused)).toBe(true);
    await expect(page.locator('.prompt .seq')).toBeVisible({ timeout: 3000 });
    await expect.poll(() => page.evaluate(() => window.__sna.arena!.paused)).toBe(false);
    await solveCurrent(page);                                                 // and the sentence can be built
  });

  test('no voice: the grown-ups dashboard says so once, to the grown-up (#65)', async ({ page }) => {
    await stubSilentEngine(page);
    await seedPlayer(page, 'volt', 'Ada', { speech: true, voice: 'no', tutorialSeen: true });
    await openGrownUps(page);
    await expect(page.locator('.voice-note')).toContainText('Settings → Accessibility → Text-to-speech');
    expect(await page.locator('.voice-note').count()).toBe(1);
  });

  test('a late voice verdict never resumes a game the child paused (#65)', async ({ page }) => {
    await stubSilentEngine(page, true);
    await seedPlayer(page, 'volt', 'Ada', { speech: true, voice: 'unknown', tutorialSeen: true });
    await startTopic(page, 'year1', 'y1-add');
    await page.click('#pause');
    await expect(page.locator('#resume')).toBeVisible();
    expect(await page.evaluate(() => {
      const u = window.__lastVoiceLine;
      if (!u?.onstart) return false;
      u.onstart(new Event('start') as SpeechSynthesisEvent); return true;
    })).toBe(true);
    await expect.poll(() => storedVoice(page)).toBe('yes');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__sna.arena!.paused)).toBe(true);
  });

  test('resuming during a no-voice sentence waits for the memory peek to finish (#65)', async ({ page }) => {
    await page.addInitScript(() => { window.__SNA_FAST = 1; });
    await stubSilentEngine(page);
    await seedPlayer(page, 'volt', 'Ada', { speech: true, voice: 'no', tutorialSeen: true });
    expect(await storedVoice(page), 'the seed must survive the v1 → v2 migration, or this test starts in the wrong state').toBe('no');
    await startTopic(page, 'year1', 'y1-sentence');
    const sentence = await page.evaluate(() => {
      const s = window.__sna.session;
      s.stage = 2; s.index = 0; s.nextQuestion();
      return s.current.answer;
    });
    await expect(page.locator('.prompt')).toHaveText(sentence);
    await page.click('#pause');
    await page.click('#resume');
    expect(await page.evaluate(() => window.__sna.arena!.paused)).toBe(true);
    await expect(page.locator('.prompt .seq')).toBeVisible({ timeout: 5000 });
    await expect.poll(() => page.evaluate(() => window.__sna.arena!.paused)).toBe(false);
    await waitForTarget(page);
  });

  test('letter tracing passes when the glyph is covered', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'reception', 'r-trace');
    await expect(page.locator('#trace')).toBeVisible();
    await page.click('#tcheck');
    await expect(page.locator('.toast.bad')).toBeVisible();          // nothing traced yet
    expect(await answer(page)).toBe(true);                            // auto-trace
    await expect(page.locator('.toast.good')).toBeVisible();
    await page.waitForFunction(() => window.__sna.state().index === 1);
  });

  test('word tracing: 2 of 3 letters is not enough, every letter must be covered', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'year2', 'y2-trace');
    const word = (await state(page)).answer as string;
    expect(word.length).toBeGreaterThanOrEqual(2);
    await page.evaluate((n) => window.__sna.tracer.autoTrace([...Array(n).keys()]), word.length - 1);   // every letter but the last
    const r = await page.evaluate(() => window.__sna.tracer.result());
    expect(r.coverage).toBeGreaterThan(0.3); expect(r.pass).toBe(false);
    await page.click('#tcheck');
    await expect(page.locator('.toast.bad')).toContainText('every letter');
    await page.evaluate(() => window.__sna.tracer.autoTrace());                // the rest
    await expect(page.locator('.toast.good')).toBeVisible();
    await page.waitForFunction(() => window.__sna.state().index === 1);
  });

  test('back button steps back one screen: play → island → sky map (Android/browser history)', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'year1', 'y1-add');
    await page.goBack();
    await expect(page.locator('.isl-head b')).toContainText('Year 1');
    await page.goBack();
    await expect(page.locator('.islands.big')).toBeVisible();
    await page.click('.island[data-year="reception"]');                          // forward again still works after a pop
    await expect(page.locator('.isl-head b')).toContainText('Reception');
    // in-app Quit pops the same history: one hardware back from the island then reaches the map (no dead press)
    await page.click('.tab[data-s="maths"]'); await page.click('.topic[data-id="r-count"]');
    await page.waitForFunction(() => window.__sna?.state().prompt);
    await page.click('#pause'); await page.click('#quit');
    await expect(page.locator('.island-screen')).toBeVisible();
    await page.goBack();
    await expect(page.locator('.islands.big')).toBeVisible();
    await page.click('#rewards'); await expect(page.locator('.album')).toBeVisible();
    await page.click('#back'); await expect(page.locator('.islands.big')).toBeVisible();
    await page.goBack();                                                          // nothing stale left: back from the map goes before the app
    expect(await page.evaluate(() => history.state)).toBeNull();
  });

  test('a long sentence can be built without waiting: each word arrives in order, in its batch or the next', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'year2', 'y2-sentence');
    // hardest form: 7 words + decoys, listen-and-build (the shape Sprint/Boss/Sensei serve within a minute)
    const words = await page.evaluate(() => {
      const s = window.__sna.session;
      s.questionsAsked = 14; s.stage = 5; s.index = 0; s.nextQuestion();
      return s.current.sequence as string[];
    });
    expect(words.length).toBeGreaterThanOrEqual(5);
    // nextQuestion() only updates session state; the arena's own wave spawns a frame (or a reveal-hold) later
    // (play-session.ts's onQuestion), so a bubble count alone can pass against the PREVIOUS wave's leftover
    // bubbles before the new one lands. Waiting for every target word to resolve to a distinct bubble — not
    // just enough of them — waits out that gap instead of racing it (a bug this test itself used to hit
    // intermittently in the nightly full matrix: "no bubble for ..." read stale bubbles from the wave before).
    const batchesHandle = await page.waitForFunction((ws) => {
      const bs = window.__sna.arena.bubbles, used = new Set<number>(), idxs: number[] = [];
      for (const w of ws) { const k = bs.findIndex((b: any, i: number) => b.label === w && !used.has(i)); if (k < 0) return false; used.add(k); idxs.push(k); }
      const t0 = Math.min(...bs.map((b: any) => b.launchAt));
      return idxs.map(k => Math.round(bs[k].launchAt - t0));
    }, words);
    const batches = await batchesHandle.jsonValue();
    // the exact batch layout is unit-tested (dealOrdered); here the user-facing property: no long wait between words
    for (let i = 1; i < batches.length; i++) expect(batches[i] - batches[i - 1]).toBeLessThanOrEqual(5000);
    expect(Math.max(...batches)).toBeLessThanOrEqual(9000);                       // the last word is up within one wave, phone or tablet
    // the first batch's words can be sliced back to back, in order, without waiting or losing a life
    const lives0 = (await state(page)).lives;
    // and once the air is clear, the next word's batch is pulled forward instead of making the child wait
    const rushed = await page.evaluate(() => {
      const a = window.__sna.arena, s = window.__sna.session;
      for (const b of a.bubbles) if (b.launched) b.dead = true;                   // as if the first batch had been sliced
      const next = s.current.sequence.find((w: string) => a.bubbles.some((b: any) => b.label === w && !b.launched));
      a.rush(next);
      return Math.round(a.bubbles.find((b: any) => b.label === next).launchAt - performance.now());
    });
    expect(rushed).toBeLessThan(500);                                             // the earned word comes up now, not in 3.5 s
  });

  // GUARD RAILS (#73) — see tests/unit/guardrails.test.ts for the rest. These need a browser.
  // Headless software rendering on CI is well below a device's real frame rate, so the floor is set from the
  // measured clean value with room to spare; the drift bug it guards against roughly halves it. Raise it only
  // with fresh measurements from both projects.
  const FPS_FLOOR = 30;   // clean: 60.4 on both projects; with the drift bug back: 19.9 (phone) / 4.3 (desktop).
  // Half the clean rate, still well above the bug — a shared CI runner can be slow without going red.
  test('guard rail: the play screen still renders at speed', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'reception', 'r-onemore');
    await page.waitForFunction(() => window.__sna?.bubbles().length > 0);
    // Incident 2026-09-06: `.bg-play::after` animated `background-position` over 13 gradients under the live
    // canvas — the game ran at 0.17x real time on 1280x800 and 0.67x on a phone, so bubbles crawled and a
    // 5.6 s flight took half a minute. Nothing noticed for weeks. This rail is that alarm.
    // Measure FRAMES, not `arena.time`: the loop clamps dt to 0.1 s, so the arena clock only falls behind
    // once frames pass 100 ms — it would sit at 1.00x while the game stuttered along at 11 fps (#73 review).
    const [fps, ratio] = await page.evaluate(() => new Promise<[number, number]>(res => {
      const a = window.__sna.arena, t0 = a.time, w0 = performance.now();
      let frames = 0;
      const tick = () => { frames++; const el = performance.now() - w0;
        if (el < 2000) requestAnimationFrame(tick); else res([frames / (el / 1000), (a.time - t0) / (el / 1000)]); };
      requestAnimationFrame(tick);
    }));
    console.log(`[guard rail] fps=${fps.toFixed(1)} ratio=${ratio.toFixed(2)}`);
    expect(fps).toBeGreaterThan(FPS_FLOOR);  // clean: see the constant; with the drift bug back it halves
    expect(ratio).toBeGreaterThan(0.8);      // and the arena clock still tracks the wall clock (loop alive)
  });

  // #146: rotating the phone mid-mission used to blank the arena completely — measured at 0 painted pixels
  // in landscape while bubbles kept spawning and falling, with the picture only coming back on rotating to
  // portrait again. A wave is laid out once, for the box it was spawned in, so every bubble sat below the
  // shorter canvas; and `update`'s fall test fired at once for every bubble already on its way down, which in
  // Year 1 and Year 2 costs a life each. The child was playing blind AND being charged for it.
  // Measured in painted pixels rather than by reading the arena's own numbers, because the original report
  // was a rendering symptom and the canvas is the only thing that can answer it honestly.
  test('guard rail: rotating to landscape keeps the arena painted, and costs no lives (#146)', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'year1', 'y1-bonds');          // Year 1: a missed bubble costs a life
    await page.waitForFunction(() => window.__sna.bubbles().length > 1);
    const painted = () => page.evaluate(() => new Promise<number>(res => requestAnimationFrame(() => requestAnimationFrame(() => {
      const c = document.querySelector('canvas#arena') as HTMLCanvasElement;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      res(n);
    }))));
    const before = { painted: await painted(), lives: (await page.evaluate(() => window.__sna.state())).lives };
    expect(before.painted).toBeGreaterThan(0);             // the control: it paints in portrait

    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => window.__sna.arena!.W > window.__sna.arena!.H);
    const after = { painted: await painted(), lives: (await page.evaluate(() => window.__sna.state())).lives };
    console.log(`[guard rail #146] painted portrait=${before.painted} landscape=${after.painted} lives ${before.lives} -> ${after.lives}`);
    expect(after.painted, 'the arena went blank when the phone was rotated').toBeGreaterThan(0);
    expect(after.lives, 'rotating the phone cost the child a life').toBe(before.lives);

    // …and the bubbles are in the box the child is now looking at. Asserted on the *rising* ones only: a
    // bubble already on its way out of the bottom is legitimately below the line, and scaling keeps it there.
    // Running this on desktop is what taught me that — the first version of this check called such a bubble
    // stray and went red on a viewport CI would not have run until tonight.
    const inBox = await page.evaluate(() => {
      const a = window.__sna.arena!, bs = window.__sna.bubbles();
      return {
        rising: bs.filter(b => b.vy < 0).length,
        risingOutside: bs.filter(b => b.vy < 0 && (b.y - b.r > a.H || b.y + b.r < 0)).length,
        offSide: bs.filter(b => b.x < 0 || b.x > a.W).length,
      };
    });
    expect(inBox.rising, 'no bubble was rising, so the check below proved nothing').toBeGreaterThan(0);
    expect(inBox, 'a bubble was left outside the resized arena').toMatchObject({ risingOutside: 0, offSide: 0 });
  });

  /**
   * #328: `@media (max-height: 640px)` in `src/style.css` hid `.hint` outright to buy the play card vertical
   * space, and a phone held sideways is ~390px tall — squarely in that band. For the seven measure topics
   * (`y1-length`, `y1-mass`, `y1-capacity`, `y2-length`, `y2-mass`, `y2-capacity`, `y2-temp`) the values being
   * compared live in `q.hint` and nowhere else on the card: no `visual`, nothing in the prompt. Hidden,
   * "Which is longer?" sits over two coloured bubbles with nothing on screen to decide by — #65's rule that
   * every card stays usable without read-aloud, broken by a layout rule rather than by a generator. The duel
   * screen's half of the same bug is pinned in `duel.spec.ts` (PR #295); this is the play screen's.
   *
   * **The control is `y1-shapes`, and that is the point of it.** This test first used `y1-bonds`, which
   * writes no `hint` at all — so it passed whether the mark was `hintIsData` or the `!!q.hint` the first
   * version of the fix used, and could not see that the latter gives a line back to ~40 instruction-writing
   * topics and pushes the arena down with it (PR #430 review, round 1). `y1-shapes` writes "Slice the shape"
   * and must stay hidden, so the control now fails against the wrong predicate.
   *
   * Run at a landscape phone rather than in `viewport.spec.ts`, which only the two tablet projects run.
   */
  test('guard rail: a phone in landscape keeps the values a measure question is asking about (#328)', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'year1', 'y1-length');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => window.__sna.arena!.W > window.__sna.arena!.H);   // the resize is laid out, not still portrait
    const seen = await page.evaluate(() => {
      const el = document.querySelector('#hint') as HTMLElement, r = el.getBoundingClientRect();
      return {
        text: el.textContent ?? '', display: getComputedStyle(el).display, own: el.classList.contains('own'),
        height: r.height, bottom: r.bottom,
        cardBottom: (document.querySelector('.qcard') as HTMLElement).getBoundingClientRect().bottom,
      };
    });
    console.log(`[guard rail #328] landscape hint: display=${seen.display} h=${seen.height} cardBottom=${seen.cardBottom} "${seen.text}"`);
    expect(seen.own, "the writer did not mark the question's own line, so the CSS cannot let it through").toBe(true);
    expect(seen.display, 'the short-screen rule hid the only values on the card').not.toBe('none');
    expect(seen.height, 'the line is laid out, not collapsed to nothing').toBeGreaterThan(0);
    // The measure hint is `colour noun: value unit`, joined by ` · ` — the one shape no generic line has.
    expect(seen.text, 'the line on screen is not the values being compared').toMatch(/: ?\d+ ?(cm|m|g|kg|ml|°C)\b/);
    expect(seen.bottom, 'the values are on the card but off the bottom of a 390px screen').toBeLessThanOrEqual(390);

    // The control: `y1-shapes`, which WRITES a hint ("Slice the shape") that the card does not need. Same
    // year, same landscape phone. This is the case the first version of the fix got wrong.
    // Through `startTopic()`, which picks the subject tab from the registry (#27). The bare
    // `.topic[data-id=...]` click this used before passed only because `y1-bonds` is maths and maths is the
    // default tab — and the useful controls here are hint-writing topics, several of which are writing
    // (#430 review). `y1-shapes` is maths too, so this is insurance against the next swap, not a fix.
    await page.evaluate(() => history.back());
    await expect(page.locator('.island-screen')).toBeVisible();
    await startTopic(page, 'year1', 'y1-shapes');
    // `y1-shapes` writes its hint on ~half its draws, so take the first drawn question that has one: a draw
    // without it would make the control vacuous rather than red.
    await page.waitForFunction(() => (document.querySelector('#hint') as HTMLElement).textContent !== '');
    const plain = await page.evaluate(() => {
      const el = document.querySelector('#hint') as HTMLElement;
      return {
        text: el.textContent ?? '', display: getComputedStyle(el).display,
        own: el.classList.contains('own'), height: el.getBoundingClientRect().height,
        cardBottom: (document.querySelector('.qcard') as HTMLElement).getBoundingClientRect().bottom,
      };
    });
    console.log(`[guard rail #328] landscape control: display=${plain.display} h=${plain.height} cardBottom=${plain.cardBottom} "${plain.text}"`);
    expect(plain.text, 'the control drew a card with no hint, so it proves nothing').not.toBe('');
    expect(plain.own, "a generator's instruction hint must not be marked as data").toBe(false);
    expect(plain.display, 'the ordinary landscape card gave up a line it used to keep').toBe('none');
    expect(plain.height, 'the hidden line still took layout space').toBe(0);
    // …and the cost is measured where it actually lands (#430 review, note 4). The card's bottom edge is
    // what the wave is laid out under — `arena.topInset = els.qcard.getBoundingClientRect().bottom + 6` in
    // `play-session.ts` — so a line shown here is a line of flight taken away. Read the edge rather than
    // `topInset` itself, which is only written inside the launch rAF and reads its default until a wave goes
    // up; and rather than `arena.H`, which is the viewport's and never moves whatever the card does.
    // Hidden, the control's card ends no lower than the measure card's; with the #430 regression back it
    // ends ~16px lower, which is the whole of what that regression costs a child in landscape.
    // Strictly shorter, by at least the line's own height: `<=` would be satisfied by the two cards being
    // identical, which is exactly what the regression looks like.
    expect(seen.cardBottom - plain.cardBottom, 'the control card did not get the line of arena back')
      .toBeGreaterThanOrEqual(seen.height - 1);
  });

  /**
   * #328 / PR #430 review: a landscape card-height budget, which the play screen had none of while
   * `duel.spec.ts` has had one for the duel strip at this very viewport since #388. The media query exists
   * to keep the card off the arena on a short screen, and nothing bounded how much of the 390px the card
   * may take — so the round-1 regression (an instruction hint shown on ~40 topics) cost `y2-symmetry` 16 of
   * the 69px of flight `main` left it, a 23% cut, with every test green.
   *
   * The sample is the reviewer's own, the tallest cards they measured, and the budget is a BUDGET: it only
   * ever goes down (`.claude/rules/guardrails.md`). Do not raise it to make a build pass — a card that
   * needs more room in landscape is the bug this rail is for.
   */
  test('guard rail: no play card eats the landscape arena, on any of the tallest topics (#328)', async ({ page }) => {
    const CARD_BUDGET = 330;   // measured worst on this tree: y2-symmetry at 321 of 390. The regression: 337.
    await seedPlayer(page);
    await page.setViewportSize({ width: 844, height: 390 });
    const worst: { id: string; bottom: number; hint: string }[] = [];
    for (const [year, id] of [['year2', 'y2-symmetry'], ['year1', 'y1-punct'], ['year1', 'y1-spelling'], ['reception', 'r-oddeven'], ['year1', 'y1-position'], ['year1', 'y1-length']] as const) {
      await startTopic(page, year, id);
      await page.waitForFunction(() => window.__sna.arena!.W > window.__sna.arena!.H);
      const m = await page.evaluate(() => ({
        bottom: (document.querySelector('.qcard') as HTMLElement).getBoundingClientRect().bottom,
        hint: (document.querySelector('#hint') as HTMLElement).textContent ?? '',
      }));
      worst.push({ id, ...m });
      await page.evaluate(() => history.back());
      await expect(page.locator('.island-screen')).toBeVisible();
      await page.evaluate(() => history.back());
      await expect(page.locator('.home')).toBeVisible();
    }
    console.log(`[guard rail #328 budget] ${worst.map(w => `${w.id}=${w.bottom}`).join(' ')}`);
    for (const w of worst)
      expect(w.bottom, `${w.id}: the card reaches ${w.bottom}px of a 390px screen, leaving ${390 - w.bottom}px of arena — hint "${w.hint}"`)
        .toBeLessThanOrEqual(CARD_BUDGET);
  });

  test('guard rail: leaving the play screen stops it', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'reception', 'r-onemore');
    await page.waitForFunction(() => window.__sna?.bubbles().length > 0);
    // Incident 2026-09-06 (#73 review): only the Quit/Islands/Play-again buttons tore the screen down, so
    // the back button left the old Arena's rAF loop running on a detached canvas — with its window listeners
    // attached and `window.__sna` pointing at the dead session. Every play → back → play stacked another one.
    // Sample only once the route change has finished: the arena legitimately ticks a frame or two between
    // `history.back()` and `popstate` running, so measuring across the pop would flake at ~0.02 s (#74 review).
    await page.evaluate(() => { (window as any).__deadArena = window.__sna.arena; history.back(); });
    await expect(page.locator('.island-screen')).toBeVisible();
    const leaked = await page.evaluate(() => new Promise<any>(res => {
      const dead = (window as any).__deadArena, t0 = dead.time;
      setTimeout(() => res({ advanced: +(dead.time - t0).toFixed(2), sna: typeof window.__sna }), 500);
    }));
    expect(leaked).toEqual({ advanced: 0, sna: 'undefined' });   // no ticking loop, and the dead hooks are gone
  });

  // #30: `.qcard` blurred the live arena through itself (`backdrop-filter: blur(8px)`). A backdrop filter over
  // a moving canvas is re-filtered every frame and the compositor can cache none of it — this branch measured
  // 43.0 → 46.7 fps on mobile under 6× CPU throttling, the earlier run on #30 got 49.0 → 54.8 on another
  // machine. So the card drops the filter in play AND takes an opaque-ish background, and the rail pins both:
  // the blur was hiding real ink. `topInset` bounds bubble apex only, so `floatText` (the score float on every
  // correct answer) finishes ~20 px inside the card, and through a 22 %-transparent panel with no blur it
  // reads as a sharp `+10` over the question text. Drop the opacity and the bleed-through comes back with
  // nothing failing, which is exactly what a rail is for.
  // Here rather than in `guardrails.test.ts` because Vitest cannot read CSS text (Vite's css plugin returns ''
  // for `?raw` outside the browser), so a unit rail for it would pass vacuously; computed style in a real
  // browser is the only honest way to ask. The filter half checks *overlap with the canvas*, not the one
  // selector, so re-adding the blur under any new name — or on a new layer over the arena — still goes red.
  // Sampled mid-play on purpose: the pause/results `.overlay` keeps its blur and is measured at zero size
  // while hidden. That is not a hole — the arena stops rendering behind it (#31), so nothing re-filters.
  test('guard rail: nothing blurs its backdrop over the live arena (#30)', async ({ page }) => {
    await pickAvatar(page);
    await startTopic(page, 'reception', 'r-onemore');
    await page.waitForFunction(() => window.__sna?.bubbles().length > 0);
    const found = await page.evaluate(() => {
      const canvas = document.querySelector('#arena');
      if (!canvas) return { canvas: false, card: false, blurred: ['#arena is missing'] };
      const a = canvas.getBoundingClientRect();
      const over = (r: DOMRect) => r.width > 0 && r.height > 0
        && r.left < a.right && r.right > a.left && r.top < a.bottom && r.bottom > a.top;
      // Any filter function, not just blur: `saturate()` over the canvas costs the same re-filter per frame.
      const FILTERS = /blur|saturate|brightness|contrast|invert|grayscale|sepia|hue-rotate|drop-shadow|opacity/;
      const blurred: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('*')) {
        const s = getComputedStyle(el) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
        const bf = [s.backdropFilter, s.webkitBackdropFilter].filter(v => v && v !== 'none').join(' ');
        if (FILTERS.test(bf) && over(el.getBoundingClientRect()))
          blurred.push(`${el.id || el.className || el.tagName}: ${bf}`);
      }
      // The panel's own alpha is the other half: with no blur it is all that hides the score float.
      const card = document.querySelector('.play .qcard');
      const bg = card ? getComputedStyle(card).backgroundColor : '';
      const alpha = /rgba?\([^)]*?,\s*([\d.]+)\s*\)/.exec(bg);
      return { canvas: true, card: !!card, cardAlpha: alpha ? +alpha[1] : (bg ? 1 : 0), blurred };
    });
    expect(found.canvas, 'the arena canvas must be on screen, or this rail proves nothing').toBe(true);
    expect(found.card, 'the question card must be on screen, or this rail proves nothing').toBe(true);
    expect(found.blurred).toEqual([]);        // no backdrop filter over the arena — see #30 for the measurement
    // Not a budget: the floor is what keeps `floatText` from reading through the card now the blur is gone.
    expect(found.cardAlpha, 'the play question card must stay opaque-ish (#30): with no blur, its alpha is the '
      + 'only thing hiding the score float that finishes inside it').toBeGreaterThanOrEqual(0.9);
  });

  // #32: the suite runs at 4× (the beforeEach above), which compresses the outcome holds. This one test forces
  // speed 1 and asserts the holds are the curriculum values the owner asked for (correct 1000, wrong 1800,
  // miss 1500). Without it the fast suite verifies nothing about the holds, and the day someone changes a
  // constant nobody would notice (the reason the issue asks for a normal-speed test).
  test('guard rail: outcome holds are the curriculum values at speed 1 (#32)', async ({ page }) => {
    await page.addInitScript(() => { window.__SNA_FAST = 1; });   // overrides the suite's 4× for this test only
    await seedPlayer(page);
    await startTopic(page, 'reception', 'r-onemore');
    expect(await page.evaluate(() => window.__sna.timing()))
      .toEqual({ speed: 1, hold: { correct: 1000, wrong: 1800, miss: 1500 } });
  });

  // #32: prove the multiplier speeds the GAME, not the clock a rail reads. At 4× the holds compress
  // (timing().speed === 4), but the arena clock must still track the wall clock (ratio ~1) and the loop must
  // still render real frames. A multiplier that scaled `dt`/`Arena.time` instead would push the ratio towards
  // 4 and pass the "renders at speed" rail on nonsense — the trap the acceptance criteria name explicitly.
  test('guard rail: 4× speeds the game, not the clock the rails read (#32)', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'reception', 'r-onemore');
    await page.waitForFunction(() => (window.__sna?.bubbles().length ?? 0) > 0);
    expect(await page.evaluate(() => window.__sna.timing().speed)).toBe(4);
    const [fps, ratio] = await page.evaluate(() => new Promise<[number, number]>(res => {
      const a = window.__sna.arena!, t0 = a.time, w0 = performance.now();
      let frames = 0;
      const tick = () => { frames++; const el = performance.now() - w0;
        if (el < 2000) requestAnimationFrame(tick); else res([frames / (el / 1000), (a.time - t0) / (el / 1000)]); };
      requestAnimationFrame(tick);
    }));
    console.log(`[guard rail] fast=4 fps=${fps.toFixed(1)} ratio=${ratio.toFixed(2)}`);
    expect(fps).toBeGreaterThan(FPS_FLOOR);   // the loop still renders real frames
    expect(ratio).toBeGreaterThan(0.8);       // the arena clock still tracks wall time...
    expect(ratio).toBeLessThan(1.5);          // ...and is NOT sped up 4× — the clock the rails read is untouched
  });

  // #138: a wave's spawn is deferred twice — behind the first-play tutorial hold, then behind a rAF — and the
  // session can move on in either gap. The superseded spawn used to run anyway, and spawnWave() empties the
  // bubble array before it fills it, so the PREVIOUS question's bubbles replaced the live wave: the child is
  // asked one thing and handed the answers to another. It hid while the hold was 1800 ms of real time, longer
  // than anything that raced with it, and surfaced as an intermittent `no bubble for "<word>"` on desktop the
  // moment that hold started scaling with the game speed (450 ms at 4×).
  // Pinned to speed 1 on purpose: the 1800 ms hold makes this a wide, deterministic window instead of the
  // race that caught it, and the rail asserts the wave is still held before it does anything, so it cannot
  // pass by arriving late and testing nothing.
  test('guard rail: a superseded wave never replaces the live one (#138)', async ({ page }) => {
    await page.addInitScript(() => { window.__SNA_FAST = 1; });   // overrides the suite's 4× for this test only
    await seedPlayer(page);                                       // a fresh save: tutorialSeen is false, so the first wave IS held
    await startTopic(page, 'year1', 'y1-add');
    await expect(page.locator('#tutorial')).toBeVisible();
    // move the session on while the first wave is still behind the hold, and note what the live question wants
    const want = await page.evaluate(() => {
      const s = window.__sna.session;
      if (window.__sna.arena!.bubbles.length) return null;         // the hold already fired: this rail would prove nothing
      s.nextQuestion();
      return { answer: s.current!.answer, options: [...s.current!.options] };
    });
    expect(want, 'the first wave must still be held back, or this rail is vacuous').not.toBeNull();
    await page.waitForFunction(() => window.__sna.arena!.bubbles.length > 0);
    await page.waitForTimeout(2200);                               // outlast the superseded spawn's 1800 ms hold
    const labels = await page.evaluate(() => window.__sna.arena!.bubbles.map(b => b.label).sort());
    expect(labels, 'the wave on screen belongs to the question on screen').toEqual([...want!.options].sort());
    expect(labels).toContain(want!.answer);
  });

  test('guard rail: no control inherits a full-screen rule, and the mode cards match', async ({ page }) => {
    await seedPlayer(page);
    await page.click('.island[data-year="year2"]');
    // Incident 2026-09-06: the Memory Match *screen* rule was written on the bare `.memory` class, which the
    // island's mode button also carries — that card rendered 844 px tall against 86 px for the others (#63).
    const heights = await page.evaluate(() => [...document.querySelectorAll('.mode-btn')].map(el => Math.round(el.getBoundingClientRect().height)));
    expect(heights.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(8);
    const giant = await page.evaluate(() => [...document.querySelectorAll('button, .btn')]
      .filter(el => el.getBoundingClientRect().height > window.innerHeight * 0.5)
      .map(el => (el as HTMLElement).id || el.className));
    expect(giant).toEqual([]);               // a button is never half the screen tall
  });

  test('guard rail: island art and grid come from year data, not a per-index CSS class (#27)', async ({ page }) => {
    // Incident #27: island art/tint were keyed by `.i0/.i1/.i2` and the grid was a hard `repeat(3, 1fr)`,
    // so a fourth year (Y3–Y6) drew no art and overflowed the row. Art now comes from YearInfo, inline.
    await seedPlayer(page);
    const arts = await page.$$eval('.islands .island .isl-art', els => els.map(el => getComputedStyle(el).backgroundImage));
    expect(arts.length).toBeGreaterThanOrEqual(3);
    for (const bg of arts) expect(bg).toContain('url(');     // each island draws its own art from data
    expect(new Set(arts).size).toBe(arts.length);            // and the art is distinct per year
    const style = await page.$eval('.islands', el => el.getAttribute('style') || '');
    expect(style).toContain('--cols:');                      // grid tracks YEARS.length, so a new year needs no CSS
  });

  test('endless Sky Storm ramps up and ends when lives run out', async ({ page }) => {
    await seedPlayer(page);
    await page.click('.island[data-year="year2"]');
    await page.click('#endless');
    await expect(page.locator('.villain img')).toBeVisible();
    for (let i = 0; i < 4; i++) await solveCurrent(page);
    expect((await state(page)).score).toBeGreaterThan(30);
    // slice wrong until the lives are gone (a wave missed under a slow renderer may already have cost one)
    for (let i = 0; i < 4; i++) {
      await waitForWrongOrEnd(page);
      if ((await state(page)).ended) break;
      const before = await page.evaluate(() => window.__sna.session.questionsAsked as number);
      expect(await page.evaluate(() => window.__sna.wrong())).toBe(true);
      await page.waitForFunction((n) => window.__sna.session.questionsAsked > n || window.__sna.state().ended, before);
    }
    await expect(page.locator('.results h2')).toHaveText('Storm over!');
    await page.click('#home');
    await expect(page.locator('#endless small')).toContainText('best');
  });

  test('Train with Sensei: a staged mission over the weakest topics, each question named by topic', async ({ page }) => {
    await seedPlayer(page);
    await page.click('.island[data-year="year1"]');
    await expect(page.locator('#train small')).toContainText('sessions 0');
    await page.click('#train');
    await expect(page.locator('.play')).toBeVisible();
    await expect(page.locator('#stage .sname')).toHaveText('Apprentice');            // mission rules: stages and lives
    await expect(page.locator('#stage .segs i')).toHaveCount(6); await expect(page.locator('#stage .q')).toHaveText('1/6');   // progress bar (#55)
    await expect(page.locator('#stage .segs i.cur')).toHaveCount(1);
    await expect(page.locator('#lives span')).toHaveCount(3);
    await page.waitForFunction(() => window.__sna?.state().prompt);
    const first = await page.evaluate(() => window.__sna.session.currentTopic.title as string);
    await expect(page.locator('.ttl')).toHaveText(new RegExp(first));
    await solveCurrent(page);
    await expect(page.locator('#stage .segs i.good')).toHaveCount(1);              // the answered question turned green
    await expect.poll(() => page.evaluate(() => window.__sna.state().score)).toBeGreaterThan(0);
    const pool = await page.evaluate(() => window.__sna.session.o.pool.map((t: any) => t.id));
    expect(pool).toHaveLength(3);
    expect(pool).toContain(await page.evaluate(() => window.__sna.session.currentTopic.id));
  });

  test('Ninja Sprint: timed run with no lives ends on the clock and saves a best score', async ({ page }) => {
    await seedPlayer(page);
    await page.click('.island[data-year="year1"]');
    await expect(page.locator('#sprint small')).toContainText('best 0');
    await page.click('#sprint');
    await expect(page.locator('.play')).toBeVisible();
    await expect(page.locator('#timer')).toContainText(/⏱ (60|59|58)/);
    await expect(page.locator('#lives')).toHaveCount(0);
    await expect(page.locator('#stage')).toHaveText('Q1');
    await solveCurrent(page);
    await expect(page.locator('#score')).toHaveText('10');
    await waitForWrongOrEnd(page);
    expect(await page.evaluate(() => window.__sna.wrong())).toBe(true);
    await expect(page.locator('.toast.bad')).toContainText('Not quite');
    expect((await state(page)).lives).toBe(3);                              // a slip costs time, never a life
    await page.click('#pause');
    const frozen = (await state(page)).timeLeft;
    await page.waitForTimeout(400);
    expect((await state(page)).timeLeft).toBe(frozen);                      // the clock stops while paused
    await page.click('#resume');
    await page.waitForFunction((t) => window.__sna.state().timeLeft < t, frozen);
    await page.evaluate(() => window.__sna.session.tick(60_000));            // fast-forward to the whistle
    await expect(page.locator('#timer')).toHaveText('⏱ 0');
    const results = page.locator('.results');
    await expect(results.locator('h2')).toHaveText("Time's up!");
    await expect(results.locator('.best-pill')).toBeVisible();
    await expect(results.locator('.coin-gain')).toContainText('+6');         // 1 correct + 1 star × 5
    await page.click('#home');
    await expect(page.locator('#sprint small')).toContainText('best 10');
  });

  test('Daily Dojo: three challenges on the sky map, progress survives a reload, bonus rows on results', async ({ page }) => {
    await seedPlayer(page);
    const items = page.locator('.dojo-item');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0).locator('.prog')).toHaveText(/^0\/\d+$/);          // the volume challenge ("Answer N questions right")
    await expect(page.locator('.dojo-foot')).toContainText('+25');               // set bonus, ×1 with no dojo streak yet
    await expect(page.locator('.dojo-head .mult')).toHaveCount(0);
    await page.click('.island[data-year="year1"]');
    await page.click('#sprint');
    await expect(page.locator('.play')).toBeVisible();
    await solveCurrent(page);
    await page.evaluate(() => window.__sna.session.tick(60_000));
    const results = page.locator('.results');
    await expect(results.locator('h2')).toHaveText("Time's up!");
    await expect(results.locator('.coin-gain')).toContainText('+6');             // the session's own coins stay separate from dojo bonuses
    const bonusRows = await results.locator('.dojo-bonus').count();              // "Play a Ninja Sprint" is one of today's challenges only on some days
    await page.click('#home');
    await page.click('#back');
    await expect(items.nth(0).locator('.prog')).toHaveText(/^1\/\d+$/);          // one correct answer counted
    expect(await page.locator('.dojo-item.done').count()).toBe(bonusRows);
    await page.goto('/');
    await expect(page.locator('.dojo-item').nth(0).locator('.prog')).toHaveText(/^1\/\d+$/);
  });

  test('Boss Battle: correct slices hurt Hammer Man, a slip heals him, and the KO is counted', async ({ page }) => {
    await seedPlayer(page);
    await page.click('.island[data-year="year2"]');
    await expect(page.locator('#boss small')).toContainText('KOs 0');
    await page.click('#boss');
    await expect(page.locator('.villain.boss img')).toBeVisible();
    await expect(page.locator('#hp')).toHaveCSS('width', /px/);
    const full = (await state(page)).bossHp; expect(full).toBe(8);
    await solveCurrent(page);
    await page.waitForFunction(() => window.__sna.state().bossHp === 7);
    await expect(page.locator('#villain')).toHaveClass(/hit/);
    await waitForWrongOrEnd(page);
    expect(await page.evaluate(() => window.__sna.wrong())).toBe(true);
    await page.waitForFunction(() => window.__sna.state().bossHp === 8);           // healed
    await expect(page.locator('.lives span.off')).toHaveCount(1);                     // and it still costs a life
    await page.waitForFunction(() => window.__sna.session.questionsAsked > 2);
    await page.evaluate(() => { window.__sna.session.bossHp = 1; });                  // skip to the final blow
    await solveCurrent(page);
    const results = page.locator('.results');
    await expect(results.locator('h2')).toHaveText('Knock-out!');
    await expect(results.locator('.ko')).toBeVisible();
    await expect(results.locator('.speech')).toContainText('K.O.');
    await page.click('#home');
    await expect(page.locator('#boss small')).toContainText('KOs 1');
  });

  /**
   * guard rail (#398 round 3, B1). `.ko` is `position: absolute`, and its containing block moved when the
   * overlay became a `.modal.results` > `.scroll` > (content) shell (round 2): `.scroll` declared no
   * `position`, so `.ko` skipped past it to `.modal.results` itself and stayed pinned to the modal's corner
   * while the hero art it decorates scrolled away underneath it. Coverage was a real gap on both axes: the
   * only test that renders `.ko` (above) never overflows the overlay, and neither scroll-sweep test (this
   * file's mission one, `duel.spec.ts`'s) ever renders `.ko`. A 118-coin purse crosses the 120-coin sticker
   * threshold on the KO's own payout, which is enough on its own to overflow a 390x664 viewport.
   */
  test('Boss Battle: the K.O. badge scrolls with the hero art it is stamped on, not pinned to the modal (#398)', async ({ page }) => {
    await seedPlayer(page, 'volt', 'Ada', { coins: 118 });
    await page.click('.island[data-year="year2"]');
    await page.click('#boss');
    await expect(page.locator('.villain.boss img')).toBeVisible();
    await page.waitForFunction(() => window.__sna.state().bossHp === 8);
    await page.evaluate(() => { window.__sna.session.bossHp = 1; });   // skip straight to the final blow
    await solveCurrent(page);
    const results = page.locator('.results');
    await expect(results.locator('h2')).toHaveText('Knock-out!');
    await expect(results.locator('.ko')).toBeVisible();
    const scroller = results.locator('.scroll');
    const maxScroll = await scroller.evaluate(el => el.scrollHeight - el.clientHeight);
    expect(maxScroll, 'this seed must actually overflow the overlay, or the sweep below proves nothing').toBeGreaterThan(0);
    // `.modal`'s own 350ms pop-in (`transform: scale(.7 → 1)`) shifts every descendant's rect by a different
    // amount depending on its distance from the transform origin while it is still running, which is enough
    // on its own to move the ko-to-hero-big gap by the tens of pixels this assertion is trying to measure —
    // observed directly, and unrelated to scrolling. Settled well before the sweep test above ever reads a
    // position, because it does not compare two time-separated absolute measurements the way this one does.
    await page.waitForTimeout(500);
    const gap = async () => {
      const ko = (await results.locator('.ko').boundingBox())!;
      const hero = (await results.locator('.hero-big').boundingBox())!;
      return ko.y - hero.y;
    };
    const gapAtTop = await gap();
    await scroller.evaluate((el, t) => { el.scrollTop = t; }, maxScroll);
    const gapAtBottom = await gap();
    // Pinned to the modal (the round 3 defect) holds `.ko` at a near-constant screen position while `.hero-big`
    // moves the full `maxScroll` distance underneath it, so the gap changes by roughly `maxScroll`. Scrolling
    // correctly with the content keeps the two in lock-step, so the gap barely moves at all.
    expect(Math.abs(gapAtBottom - gapAtTop), `the K.O. badge must scroll with the hero art (gap moved by ${gapAtBottom - gapAtTop}px, `
      + `not the modal's fixed position (which would move it close to maxScroll = ${maxScroll}px)`).toBeLessThan(10);
  });

  test('Memory Match: cards flip, a miss turns back, pairs lock, and the finished board is counted', async ({ page }) => {
    await seedPlayer(page, 'splash', 'Mia');
    await page.click('.island[data-year="reception"]');
    await expect(page.locator('#memory small')).toContainText('boards 0');
    await page.click('#memory');
    await expect(page.locator('.memory')).toBeVisible();
    await expect(page.locator('.card')).toHaveCount(8);
    await expect(page.locator('.card.up')).toHaveCount(0);
    const cards = await page.evaluate(() => window.__sna.cards() as { pair: number; matched: boolean }[]);
    const wrong = cards.findIndex((c, i) => i > 0 && c.pair !== cards[0].pair);
    await page.click('.card[data-i="0"]');
    await expect(page.locator('.card[data-i="0"]')).toHaveClass(/up/);
    await page.click(`.card[data-i="${wrong}"]`);
    await expect(page.locator('.toast.bad')).toContainText('Not a pair');
    await expect(page.locator('.card.up')).toHaveCount(0);                              // both turn back over
    expect((await state(page)).moves).toBe(1);
    for (let i = 0; i < cards.length; i++) {
      if (await page.evaluate((k) => window.__sna.cards()[k].matched, i)) continue;
      const mate = cards.findIndex((c, k) => k !== i && c.pair === cards[i].pair);
      await page.waitForFunction(() => !window.__sna.state().waiting);
      expect(await page.evaluate((k) => window.__sna.flip(k), i)).toBe(true);
      expect(await page.evaluate((k) => window.__sna.flip(k), mate)).toBe(true);
      await expect(page.locator(`.card[data-i="${i}"]`)).toHaveClass(/matched/);
    }
    await expect(page.locator('#pairs b')).toHaveText('4');
    const results = page.locator('.results');
    await expect(results.locator('h2')).toHaveText('All pairs found!');
    await expect(results.locator('.stars')).toContainText('★★★');                    // 5 turns for 4 pairs
    await expect(results.locator('.coin-gain')).toContainText('+23');                  // 4 pairs × 2 + 3 stars × 5
    await expect(results.locator('.speech')).toContainText('Mia');
    await page.click('#home');
    await expect(page.locator('#memory small')).toContainText('boards 1');
  });

  test('guard rail: a Memory board never leaves a short row hanging off one edge (#372)', async ({ page }) => {
    // Nothing in this repository rendered a Memory board to LOOK at it, so a five-pair deck shipped as
    // 4 + 4 + 2 with two empty cells beside the last row — the first ragged board the mode had ever had, and
    // the only one whose card count is not a multiple of four. The existing Memory test above plays Reception
    // (8 cards, two full rows) and `viewport.spec.ts` seeds a board count into storage without opening the
    // screen, so both were green throughout. This measures the real boxes.
    await seedPlayer(page, 'splash', 'Mia');
    await page.click('.island[data-year="year2"]');
    // The theme is drawn at random; re-enter until the 3-D board comes up, which is the deck at issue.
    let theme = '';
    for (let tries = 0; tries < 60 && theme !== 'shapes'; tries++) {
      await page.click('#memory');
      await expect(page.locator('.card').first()).toBeVisible();
      theme = await page.evaluate(() => window.__sna.theme as string);
      if (theme !== 'shapes') await page.click('#back');
    }
    expect(theme, 'a 3-D shapes board came up inside 60 draws').toBe('shapes');
    // The count comes from the DECK, not a literal 10 (#372 review round 2, note 2): this is a rail about
    // GEOMETRY, and a literal would turn it red for a curriculum reason the moment a shape table grew.
    const cards = await page.evaluate(() => window.__sna.memory.pairs.length * 2);
    await expect(page.locator('.card')).toHaveCount(cards);
    const rows = await page.evaluate(() => {
      const grid = document.querySelector('#cards')!.getBoundingClientRect();
      const byRow = new Map<number, DOMRect[]>();
      for (const c of document.querySelectorAll('#cards .card')) {
        const r = c.getBoundingClientRect(); const key = Math.round(r.y);
        (byRow.get(key) ?? byRow.set(key, []).get(key)!).push(r);
      }
      return [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([, cards]) => ({
        n: cards.length,
        left: Math.round(Math.min(...cards.map(c => c.left)) - grid.left),
        right: Math.round(grid.right - Math.max(...cards.map(c => c.right))),
      }));
    });
    expect(rows.length, 'the deck fills whole rows of four plus a short one').toBe(Math.ceil(cards / 4));
    for (const r of rows) {
      // The gap each side of a row is equal: a full row has none, and a short one is centred rather than
      // pushed against the left edge with the whole remainder showing on the right.
      expect(Math.abs(r.left - r.right), `a row of ${r.n} sits centred (left ${r.left}px, right ${r.right}px)`).toBeLessThanOrEqual(2);
    }
    expect(rows.map(r => r.n).slice(0, -1).every(n => n === 4), 'every row but the last is full').toBe(true);
    expect(rows[rows.length - 1].n, 'and the short row is the last one').toBe(cards % 4 || 4);
  });

  // #138: the one test that still walks the whole cold start — avatar screen → intro (#67) → sky map → island
  // → play — so
  // the path every other test now seeds past keeps a test of its own, end to end and in order.
  test('first play shows the slice tutorial hand, which goes away after the first slice for good', async ({ page }) => {
    await pickAvatar(page);
    await startTopic(page, 'reception', 'r-count');
    const tut = page.locator('#tutorial');
    await expect(tut).toBeVisible();
    await expect(tut).toContainText('Slice the bubble');
    await page.waitForFunction(() => window.__sna.bubbles().some((b: any) => b.label === window.__sna.state().answer));
    expect(await answer(page)).toBe(true);
    await expect(tut).toBeHidden();
    await page.click('#pause'); await page.click('#quit');
    await startTopic(page, 'reception', 'r-count');
    await expect(page.locator('#tutorial')).toHaveCount(0);                 // remembered: no demo on the second play
  });

  test('tapping the question card repeats it aloud (pulse feedback)', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'year1', 'y1-add');
    await page.click('#qcard .prompt');
    await expect(page.locator('#qcard')).toHaveClass(/pulse/);
  });

  test('pause and quit return home', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'year1', 'y1-time');
    await page.click('#pause');
    await expect(page.locator('.modal h2')).toHaveText('Paused');
    await page.click('#quit');
    await expect(page.locator('.island-screen')).toBeVisible();
  });

  test('question visuals render for pictorial topics', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'year1', 'y1-coins');
    await expect(page.locator('.vis .coin')).toHaveCount(1);
    await page.click('#pause'); await page.click('#quit');
    await startTopic(page, 'year2', 'y2-time');
    await expect(page.locator('.vis .clock')).toBeVisible();
    await page.click('#pause'); await page.click('#quit');
    await startTopic(page, 'year1', 'y1-balance');
    await expect(page.locator('.vis .scales .pan')).toHaveCount(2);
    const prompt = await page.evaluate(() => window.__sna.state().prompt as string);
    expect(prompt).toContain('=');
    await waitForTarget(page);
    expect(await answer(page)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__sna.state().score)).toBeGreaterThan(0);
  });

  test('For grown-ups: a maths gate opens the read-only parent dashboard (#9)', async ({ page }) => {
    await seedPlayer(page, 'volt', 'Ada');
    await page.click('#grownups');
    await expect(page.locator('.parents .gate')).toBeVisible();

    // a wrong answer keeps the gate closed and warns the grown-up
    await page.fill('#gate-input', '1');
    await page.click('#gate-go');
    await expect(page.locator('#gate-msg')).toBeVisible();
    await expect(page.locator('.parents-dash')).toHaveCount(0);

    // the correct product opens the dashboard
    const q = await page.locator('#gate-q').textContent();          // e.g. "6 × 8"
    const [a, b] = q!.split('×').map(s => parseInt(s.trim(), 10));
    await page.fill('#gate-input', String(a * b));
    await page.click('#gate-go');
    await expect(page.locator('.parents-dash')).toBeVisible();
    await expect(page.locator('.p-stats div')).toHaveCount(4);       // overall stat tiles
    await expect(page.locator('.p-table tbody tr')).toHaveCount(3);  // one row per island

    // back returns to the sky map
    await page.click('#back');
    await expect(page.locator('.map')).toBeVisible();
  });

  // #64: reinstalling the APK wipes localStorage, so the grown-up needs a way to carry the save across.
  test('For grown-ups: the save code copies out and restores back (#64)', async ({ page }) => {
    await seedPlayer(page, 'volt', 'Ada');
    await openGrownUps(page);

    // the code is the save, and it carries the version that makes it recognisable
    const code = await page.inputValue('#save-code');
    const parsed = JSON.parse(code);
    expect(parsed.v, 'read from storage.ts, not written out: a literal here goes red on every bump').toBe(SAVE_VERSION);
    expect(parsed.name).toBe('Ada');

    // a stray paste is refused, and nothing on the device changes
    await page.fill('#restore-code', 'shopping list');
    await page.click('#restore-go');                                  // first tap only warns
    await expect(page.locator('#move-msg')).toHaveClass(/bad/);
    await page.click('#restore-go');
    await expect(page.locator('#move-msg')).toContainText('not a Sky Ninja Academy save');
    await expect(page.locator('.isl-head b')).toContainText('Grown-ups dashboard');
    expect(await page.inputValue('#save-code')).toBe(code);           // the save is untouched

    // a real code from "the other device" lands, and the dashboard redraws from it
    const other = JSON.stringify({ ...parsed, name: 'Rye', coins: 456 });
    await page.fill('#restore-code', other);
    await page.click('#restore-go');
    await expect(page.locator('#move-msg')).toContainText('Tap Restore again');   // never on one tap
    await page.click('#restore-go');
    await expect(page.locator('#move-msg')).toContainText('Restored');
    await expect(page.locator('.p-extra')).toContainText('456 coins');
    await expect(page.locator('.isl-head small')).toContainText('Rye');
    expect(JSON.parse(await page.inputValue('#save-code')).coins).toBe(456);
  });

  // #115: a guarded "Start again" on the grown-ups screen — for handing the tablet to a new child.
  test('For grown-ups: "Start again" requires the typed word, and cancelling changes nothing (#115)', async ({ page }) => {
    await seedPlayer(page, 'volt', 'Ada', { coins: 200 });
    await openGrownUps(page);

    await page.click('#start-again');
    await expect(page.locator('.reset-modal h2')).toContainText('Start again?');
    await expect(page.locator('#reset-go')).toBeDisabled();

    // a wrong or partial word never arms the button
    await page.fill('#reset-word', 'reset');
    await expect(page.locator('#reset-go')).toBeDisabled();
    await page.fill('#reset-word', 'RESET');
    await expect(page.locator('#reset-go')).toBeEnabled();

    // cancelling closes the modal and touches nothing on the device
    await page.click('#reset-cancel');
    await expect(page.locator('.reset-modal')).toHaveCount(0);
    await expect(page.locator('.p-extra')).toContainText('200 coins');
    await page.click('#back');
    await expect(page.locator('.map')).toBeVisible();
  });

  test('For grown-ups: "Start again" clears the device and lands on onboarding; Undo brings it all back (#115)', async ({ page }) => {
    await seedPlayer(page, 'volt', 'Ada', { coins: 300 });
    await openGrownUps(page);

    await page.click('#start-again');
    await page.fill('#reset-word', 'RESET');
    await page.click('#reset-go');
    await expect(page.locator('.reset-modal h2')).toContainText('All cleared');

    // Undo, while still on this screen, restores the dashboard exactly as it was
    await page.click('#reset-undo');
    await expect(page.locator('.reset-modal')).toHaveCount(0);
    await expect(page.locator('.p-extra')).toContainText('300 coins');
    await expect(page.locator('.isl-head small')).toContainText('Ada');

    // doing it again and continuing this time lands on onboarding with an empty profile
    await page.click('#start-again');
    await page.fill('#reset-word', 'RESET');
    await page.click('#reset-go');
    await page.click('#reset-continue');
    await expect(page.locator('.avatar-screen')).toBeVisible();
    await expect(page.locator('#next')).toBeDisabled();
    await expect(page.locator('.avatar-card.sel')).toHaveCount(0);
    // reset() removes the key outright rather than writing fresh defaults over it — nothing from Ada is left
    // to read back on the next launch. (Not reloaded here: seedPlayer's init script re-seeds an empty slot on
    // every navigation, which would mask exactly the thing this assertion checks.)
    expect(await page.evaluate(() => localStorage.getItem('sna:v1'))).toBeNull();
  });

  // Caught in review: the on-screen back arrow was the only place the post-reset invariant was enforced, so
  // the hardware/browser back button — a more natural gesture here than reaching for the arrow — fell through
  // main.ts's popstate handler straight to the map, with an empty profile (#115, review on PR #274).
  test('For grown-ups: the hardware/browser back button after a reset also lands on onboarding, not the map (#115)', async ({ page }) => {
    await seedPlayer(page, 'volt', 'Ada', { coins: 150 });
    await openGrownUps(page);

    await page.click('#start-again');
    await page.fill('#reset-word', 'RESET');
    await page.click('#reset-go');
    await expect(page.locator('.reset-modal h2')).toContainText('All cleared');

    await page.goBack();   // instead of tapping "Continue" or the on-screen arrow
    await expect(page.locator('.avatar-screen')).toBeVisible();
    await expect(page.locator('.avatar-card.sel')).toHaveCount(0);
  });
});

/**
 * #95: `importSave()` only checks the version, so a hand-edited or corrupted "Restore" paste can carry
 * `progress` (or the other per-year record fields) as anything, and every screen that used to index it
 * directly — the map's star tally, the island screen's mode blurbs, the grown-ups dashboard — threw on the
 * very next launch. The unit tests pin `parentSummary()`; this is the same corrupted blob reaching the real
 * screens, which no unit test can (`home.ts`/`avatar.ts` render through `document`, with no jsdom in this
 * suite).
 *
 * Review of the first cut (PR #171): the fix guarded two readers only, and `topbar()`'s `d.streak.days`,
 * `dojoCard()` (`dojo`) and every `record*()` writer in `storage.ts` still threw on the same corrupted save
 * — the last of those only reachable once a player could get past the map at all, which this PR's own fix
 * is what newly lets them do. `streak`/`dojo` join the seed below, and the second test plays a full mission
 * to completion on the corrupted save — the round trip finding 3 named, not just surviving the read side.
 */
test.describe('a corrupted save does not brick the app (#95)', () => {
  // This describe block sits outside the main one (line 167), so it does not inherit its `beforeEach` — without
  // this, the full-mission test below ran at 1× speed instead of the suite's 4×, ~3x slower for no reason.
  test.beforeEach(async ({ page }) => { await page.addInitScript(() => { window.__SNA_FAST = 4; }); });

  test('guard rail: the map, an island, and the grown-ups dashboard all still render on a null-shaped save', async ({ page }) => {
    // pageerror only — an uncaught exception is the actual failure mode this rail guards (d.progress[id]
    // throwing when d.progress itself is not an object). A console `error` also catches unrelated resource-load
    // noise (a blocked font fetch, say), which is not what this test is about and would make it flaky for a
    // reason that has nothing to do with #95.
    const failed: string[] = [];
    page.on('pageerror', e => failed.push(`page error: ${e.message}`));

    await seedPlayer(page, 'volt', 'Ada', {
      progress: null, endless: null, sprint: 'not an object', boss: [], training: 42, streak: null, dojo: null,
    });
    // seedPlayer already asserts `.home` (the map) rendered — the corrupted blob alone would have thrown
    // inside mapScreen's star tally, topbar's streak badge, or the Daily Dojo card before this point if the
    // fix were not in place.
    expect(failed, `while landing on the map${failed.length ? ':\n  ' + failed.join('\n  ') : ''}`).toEqual([]);

    await page.click('.island[data-year="year1"]');
    await expect(page.locator('.island-screen')).toBeVisible();
    expect(failed, `while opening an island${failed.length ? ':\n  ' + failed.join('\n  ') : ''}`).toEqual([]);

    await page.click('#back');
    await openGrownUps(page);   // renders parentSummary() over the same corrupted save
    await expect(page.locator('.parents-dash')).toContainText('0');   // nothing played, but it renders rather than throwing
    expect(failed, `while opening the grown-ups dashboard${failed.length ? ':\n  ' + failed.join('\n  ') : ''}`).toEqual([]);
  });

  // Third review round on PR #171: sanitizeTypes() originally covered only object/array/number fields.
  // `name` is the one field a person freely types into the Restore box, and `esc(d.name)`/`hasName(d.name)`
  // in nameScreen() both throw on a non-string — "Change ninja" from the map is a screen every returning
  // player can reach, not an edge case.
  // #67 update: "Change ninja" (`#change-av`, returning players) is now `changeAvatarScreen`, which never
  // renders `d.name` at all — the crash this rail guarded against cannot occur on that screen any more. The
  // name field now lives only on the first-run wizard's `nameScreen` (split from the ninja pick in #67's
  // follow-up), so that half of the rail moves there rather than being dropped.
  test('guard rail: "Change ninja" does not crash on a save with a wrong-typed name, and never touches name at all (#171, #67)', async ({ page }) => {
    const failed: string[] = [];
    page.on('pageerror', e => failed.push(`page error: ${e.message}`));

    await seedPlayer(page, 'volt', 'Ada', { name: 123, sound: 'yes', tutorialSeen: 'true' });
    expect(failed, `while landing on the map${failed.length ? ':\n  ' + failed.join('\n  ') : ''}`).toEqual([]);

    await page.click('#change-av');
    await expect(page.locator('.change-avatar')).toBeVisible();
    await expect(page.locator('#name')).toHaveCount(0);   // #67: this screen no longer asks for or shows a name
    expect(failed, `while opening "Change ninja"${failed.length ? ':\n  ' + failed.join('\n  ') : ''}`).toEqual([]);
  });

  test('guard rail: the first-run wizard still opens on a save with a wrong-typed name, and the name step sanitises it (#171, #67)', async ({ page }) => {
    const failed: string[] = [];
    page.on('pageerror', e => failed.push(`page error: ${e.message}`));

    await page.addInitScript(save => {
      if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save);
    }, JSON.stringify({ v: 1, name: 123, sound: 'yes', tutorialSeen: 'true' }));   // no avatar → not onboarded
    await page.goto('/');
    // Step 1 never reads d.name at all, so the corrupted value cannot crash it — confirmed by the absence of
    // a page error, not by anything visible on this screen.
    await expect(page.locator('.avatar-screen')).toBeVisible();
    expect(failed, `while opening step 1${failed.length ? ':\n  ' + failed.join('\n  ') : ''}`).toEqual([]);

    // Step 2 is where the corrupted name would actually be read (esc()/hasName()) and rendered.
    await page.click('.avatar-card[data-id="volt"]');
    await page.click('#next');
    await expect(page.locator('#name')).toHaveValue('');   // the corrupted name was dropped, not rendered as "123"
    expect(failed, `while opening the name step${failed.length ? ':\n  ' + failed.join('\n  ') : ''}`).toEqual([]);
  });

  // Review finding 3: the reader fix is what lets a player reach the topic list on a corrupted save in the
  // first place — before it, they crashed at the map. Finishing a mission there used to throw in recordTopic()/
  // recordAccuracy() instead, since importSave() had written the corruption straight to the stored blob and
  // every writer indexed into it unguarded. Playing an entire mission to completion is the round trip the
  // unit tests (which call the writers directly) cannot stand in for.
  test('guard rail: a full mission still saves stars and coins on a corrupted save', async ({ page }) => {
    test.setTimeout(150_000);
    const failed: string[] = [];
    page.on('pageerror', e => failed.push(`page error: ${e.message}`));

    await seedPlayer(page, 'volt', 'Ada', {
      progress: null, endless: null, sprint: 'not an object', boss: [], memory: undefined, training: 42,
      streak: null, dojo: null,
    });
    await startTopic(page, 'reception', 'r-count');   // matches the known-fast full-mission path above (line 400)
    const stages = await page.evaluate(() => window.__sna.session.stages);
    const perStage = await page.evaluate(() => window.__sna.session.perStage);
    for (let stage = 1; stage <= stages; stage++) {
      await answerAll(page, perStage);
      await expect(page.locator('.celebrate')).toBeVisible();
      await page.click('#next');
    }
    await expect(page.locator('.results')).toBeVisible();
    expect(failed, `while playing a full mission${failed.length ? ':\n  ' + failed.join('\n  ') : ''}`).toEqual([]);

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!));
    expect(saved.progress['r-count'].stars).toBeGreaterThan(0);
    expect(saved.coins).toBeGreaterThan(0);
  });

  /**
   * #363: the seeds above carry `dojo: null`, which the record check catches. A `dojo` that IS a record but
   * broken inside was not — and what it takes down first is the **map screen**, before any game starts.
   *
   * `dojoCard()` (`src/ui/home.ts`) runs at boot and reads `carriedStreak(s, s.date)` → `s.streak.last`,
   * `s.done.includes()` and `s.progress[…]`: a strict **superset** of what `applyEvent()` reads at the end
   * of a game. `dojoFor()` rebuilds only a *stale* state, so a record carrying TODAY's date reaches both
   * readers untouched, and the child meets the boot one first — a blank screen with nothing to start.
   *
   * The end-of-game path is real too and lands worse (inside `duel.ts`'s `showResults()`, between
   * `hold(true)` and `overlay.hidden = false`, freezing both arenas) — but no fixture can reach it to be
   * tested: anything that crashes `applyEvent()` has already crashed the map. So this rail asserts the boot,
   * which is both the first symptom and the stronger guard (PR #408 review, B1).
   */
  test('guard rail: a record-shaped but broken `dojo` still renders the map and its Daily Dojo card', async ({ page }) => {
    const failed: string[] = [];
    page.on('pageerror', e => failed.push(`page error: ${e.message}`));

    // The date is computed IN THE PAGE. `today()` is `toISOString().slice(0, 10)`, so a run crossing UTC
    // midnight between a Node-side seed and the assertion would leave a *stale* `dojo` — which `dojoFor()`
    // rolls over, quietly evaporating the reproduction (PR #408 review, note 8). `v: 1` matches
    // `seedPlayer`: the v2→v3 step is what marks a save with an avatar as already onboarded.
    await page.addInitScript(() => {
      if (localStorage.getItem('sna:v1')) return;
      const date = new Date().toISOString().slice(0, 10);
      localStorage.setItem('sna:v1', JSON.stringify({ v: 1, name: 'Ada', avatar: 'volt', year: 'year2', dojo: { date } }));
    });
    await page.goto('/');

    // The map and the card itself — this is the assertion that goes red without the guard, and it names the
    // reader that actually throws.
    await expect(page.locator('.home')).toBeVisible();
    await expect(page.locator('#dojo')).toBeVisible();
    await expect(page.locator('#dojo .dojo-item')).toHaveCount(3);
    // …drawn from a *default* state, not a half-read one: a fresh day has no streak multiplier and the foot
    // offers the set bonus rather than "come back tomorrow".
    await expect(page.locator('#dojo .mult')).toHaveCount(0);
    await expect(page.locator('#dojo .dojo-foot')).toContainText('Finish all three');
    expect(failed, `while landing on the map with a broken dojo${failed.length ? ':\n  ' + failed.join('\n  ') : ''}`).toEqual([]);
  });
});

/**
 * #15 Part A — offline play. The acceptance criterion for the whole feature is behavioural and there is no
 * way to check it without a browser: the service worker, its install, its cache and its fetch handler are all
 * browser machinery, and the unit tests deliberately stop at the two decisions that are not (whether to
 * register, and what goes in the list).
 *
 * `vite preview` serves `dist/`, so this exercises the real generated `dist/sw.js` — including the precache
 * list `scripts/build-sw.mjs` wrote from the real hashed filenames. That is the pairing that goes wrong: a
 * worker whose list is stale installs perfectly and only fails once the network is gone.
 */
test.describe('offline (#15)', () => {
  test('guard rail: the game still loads and plays with the network off', async ({ page, context, baseURL }) => {
    await seedPlayer(page);
    // Wait for the worker to be in control. `ready` resolves on activation, and `controller` is what decides
    // whether the NEXT navigation is served by it — asserting only `ready` would let this test pass on a
    // reload that quietly went to the network.
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30_000 });
    // Then wait for the ONE entry the offline launch cannot do without, by name. Counting entries ("more than
    // five in some cache") would have been satisfied by a half-filled cache, and `waitForFunction` with an
    // async predicate is not a shape worth betting a rail on. `expect.poll` over `page.evaluate` awaits the
    // promise for certain, and what it asks is exactly what the next line needs to be true.
    await expect.poll(async () => page.evaluate(async () => {
      for (const k of await caches.keys()) if (await (await caches.open(k)).match('index.html')) return true;
      return false;
    }), { timeout: 30_000, message: 'the shell must be precached before the network goes' }).toBe(true);

    // Everything the browser refuses or the app complains about while the network is down, so a failure here
    // names its cause instead of leaving "element not found". The first CI run of this rail served the shell
    // (200, asserted below) and then rendered nothing, and no log said which asset never arrived.
    const failed: string[] = [];
    // Provenance, not just success. Every previous version of this rail was satisfiable by Chromium's own
    // HTTP cache, warmed by `seedPlayer` seconds earlier — which is exactly why reverting the `ignoreVary`
    // fix did not reliably turn it red. `fromServiceWorker()` is the only thing that tells the two apart, so
    // "the worker is installed and answers nothing" is now a named failure. (Raised in review of this PR.)
    const fromNetwork: string[] = [];
    // #123 review: the port is now derived (playwright.config.ts), never the bare literal '4173' —
    // that literal here would make this whole provenance check permanently vacuous the moment the
    // derived port stopped being 4173, which is every run by default now. baseURL is the same value
    // the page itself was navigated with, so this stays correct whatever the port derives to.
    page.on('response', r => { if (r.url().startsWith(baseURL!) && !r.fromServiceWorker()) fromNetwork.push(r.url()); });
    page.on('requestfailed', r => failed.push(`request failed: ${r.url()} — ${r.failure()?.errorText}`));
    page.on('pageerror', e => failed.push(`page error: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') failed.push(`console error: ${m.text()}`); });
    const why = () => (failed.length ? `\nwhile offline:\n  ${failed.join('\n  ')}` : '\nwhile offline: nothing failed and nothing was logged');

    await context.setOffline(true);
    const served = await page.reload();
    // Diagnose before asserting. If the worker did not answer the navigation, the next assertion fails with
    // "element not found", which says nothing about why — and that is the one failure this rail is for.
    expect(served?.status(), `the worker, not the network, must have served the reload${why()}`).toBe(200);
    // Generous on purpose: this is a cold start with every byte coming out of Cache Storage, on a CI runner
    // that has already been busy for minutes. The assertion is unchanged; only the patience is.
    // try/catch rather than expect's message argument: that argument is evaluated when the call is made, and
    // everything worth reporting happens during the wait that follows it.
    try {
      await expect(page.locator('.home')).toBeVisible({ timeout: 20_000 });
    } catch (err) {
      throw new Error(`the sky map must render with no network at all${why()}\n\n${(err as Error).message}`);
    }

    // Not just the shell. Three separate cached assets have to have arrived for this screen to be right, and
    // each is checked for what it actually produced rather than for the element existing:
    //   the JS bundle — the map rendered at all, and its islands respond;
    //   an avatar webp — the portrait decoded, so it is art and not a broken image;
    //   the CSS — a rule from the stylesheet is in effect.
    const portrait = page.locator('#change-av img').first();
    await expect(portrait).toBeVisible();
    expect(await portrait.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
      'the avatar art must come from the cache, not a broken image').toBe(true);
    // `.hero { display: flex }` (src/style.css:232) against a <button>'s `inline-block` default. The previous
    // version of this asked `.home` for `display` — and there is no `.home` rule in the stylesheet at all, so
    // a <div>'s UA `block` satisfied it whether or not the CSS ever arrived. (Raised in review of this PR.)
    expect(await page.locator('#change-av').evaluate(el => getComputedStyle(el).display),
      'the stylesheet must have been served from the cache too').toBe('flex');

    await page.click('.island[data-year="reception"]');
    await expect(page.locator('.island-screen'), 'and the game is navigable offline, not just visible').toBeVisible();
    await expect(page.locator('.topic').first()).toBeVisible();

    // Nothing of ours may have failed to load. Google Fonts is allowed to (it is cross-origin and cannot be
    // precached by URL — `src/ui/font.ts` degrades to the fallback face, which is #44's story, not this one).
    const ours = failed.filter(f => f.includes('localhost') || f.includes('127.0.0.1'));
    expect(ours, 'no same-origin request may fail while offline').toEqual([]);
    // The assertion above is necessary and not sufficient: `requestfailed` fires only on a network-level
    // failure, so it says nothing about WHO answered. This one does, and it is the one that fails if the
    // worker stops serving and the HTTP cache quietly covers for it.
    expect(fromNetwork, 'every same-origin response while offline must come from the service worker').toEqual([]);

    await context.setOffline(false);
  });
});

/**
 * #20 slice 2 — "Who is playing?", the profile picker. Slice 1 gave siblings a save each at the storage layer
 * and nothing in the app called it; these are the first tests where two children actually reach their own game.
 *
 * The index shape is `src/storage.ts`'s: `sna:profiles = { v: 1, active, ids }`, profile 1 under the historical
 * `sna:v1` key and the rest under `sna:v1:p2`… — seeded directly rather than walked, the same trade `seedPlayer`
 * makes above, because the walk through onboarding is the *other* tests' subject.
 */
async function seedSiblings(page: Page, active = 'p1') {
  await page.addInitScript(({ index, ada, bo }) => {
    if (!localStorage.getItem('sna:profiles')) {
      localStorage.setItem('sna:v1', ada);
      localStorage.setItem('sna:v1:p2', bo);
      localStorage.setItem('sna:profiles', index);
    }
  }, {
    index: JSON.stringify({ v: 1, active, ids: ['p1', 'p2'] }),
    ada: JSON.stringify({ v: SAVE_VERSION, name: 'Ada', avatar: 'volt', coins: 40, spent: 0, onboarded: true }),
    bo: JSON.stringify({ v: SAVE_VERSION, name: 'Bo', avatar: 'blaze', coins: 7, spent: 0, onboarded: true }),
  });
}

test.describe('profile picker (#20 slice 2)', () => {
  test('one profile: the launch picker never appears, and boot is unchanged', async ({ page }) => {
    await seedPlayer(page, 'volt', 'Ada');          // asserts `.home` is visible, i.e. boot went straight there
    await expect(page.locator('.profile-screen')).toHaveCount(0);
    // The route still exists for the one child on the device — it is the only way a second one is ever added.
    await page.click('#who');
    await expect(page.locator('.profile-screen')).toBeVisible();
    await expect(page.locator('.avatar-card[data-profile]')).toHaveCount(1);
    await expect(page.locator('#new-ninja')).toBeVisible();
  });

  test('two profiles: the picker comes first and each child keeps their own coins', async ({ page }) => {
    await seedSiblings(page);
    await page.goto('/');
    await expect(page.locator('.profile-screen')).toBeVisible();
    await expect(page.locator('.avatar-card[data-profile]')).toHaveCount(2);
    await expect(page.locator('.avatar-card[data-profile="p1"]')).toContainText('Ada');
    await expect(page.locator('.avatar-card[data-profile="p2"]')).toContainText('Bo');

    await page.click('.avatar-card[data-profile="p2"]');
    await expect(page.locator('.home')).toBeVisible();
    await expect(page.locator('#change-av')).toContainText('Bo');
    await expect(page.locator('#rewards'), "the sibling's coins, not the other child's").toContainText('7');

    // The switch is persisted, not merely rendered: the next launch opens the picker again (two profiles), and
    // the other card leads to a game that kept its own 40 coins through all of it.
    await page.goto('/');
    await expect(page.locator('.profile-screen')).toBeVisible();
    await page.click('.avatar-card[data-profile="p1"]');
    await expect(page.locator('#change-av')).toContainText('Ada');
    await expect(page.locator('#rewards')).toContainText('40');
  });

  /**
   * guard rail (#380 review B1, round 3): a slot in the index with no save behind it — tap ＋ and close the
   * app before a ninja is chosen, "Start again" in the grown-ups screen, or any sibling save the app cannot
   * read — drew `AVATARS[0]`, Volt, because `avatarById` falls back rather than answering "none". On the one
   * screen a pre-reader picks by the picture, an unplayed slot was pixel for pixel a sibling who plays as
   * Volt, and it was labelled "New ninja" — the same two words as the ＋ card beside it, which does something
   * else entirely. Every card in every other test has an avatar, which is why nothing saw it.
   *
   * The tap is asserted too (#380 review note 2): `afterPick()`'s un-onboarded branch was dead in the suite,
   * and it is #67's rule at a second call site — a child who abandons the wizard must be sent back to it,
   * never dropped on the map with an empty profile.
   */
  test('an unplayed slot is drawn as an empty slot, not as another child (#20 slice 2)', async ({ page }) => {
    await page.addInitScript(({ index, ada }) => {
      if (!localStorage.getItem('sna:profiles')) {
        localStorage.setItem('sna:v1', ada);                 // p2 is in the index with no save key at all
        localStorage.setItem('sna:profiles', index);
      }
    }, {
      index: JSON.stringify({ v: 1, active: 'p1', ids: ['p1', 'p2'] }),
      ada: JSON.stringify({ v: SAVE_VERSION, name: 'Ada', avatar: 'volt', coins: 40, spent: 0, onboarded: true }),
    });
    await page.goto('/');
    await expect(page.locator('.profile-screen')).toBeVisible();

    const played = page.locator('.avatar-card[data-profile="p1"]'), empty = page.locator('.avatar-card[data-profile="p2"]');
    await expect(played.locator('img')).toHaveAttribute('src', /volt/);
    await expect(empty.locator('img'), 'no portrait at all, rather than the first ninja in the list').toHaveCount(0);
    await expect(empty, 'the dashed ＋ figure the ＋ card already means "empty" with').toHaveClass(/new-ninja/);
    await expect(empty.locator('b'), "and words of its own, not the ＋ card's").not.toHaveText('New ninja');
    await expect(page.locator('#new-ninja b')).toHaveText('New ninja');

    // It is still a card, and tapping it goes where that child belongs: the wizard, not the map.
    await empty.click();
    await expect(page.locator('.choose-ninja-screen'), 'an unplayed slot opens the wizard').toBeVisible();
    await expect(page.locator('.home'), 'never the map with an empty profile (#67)').toHaveCount(0);
  });

  test('a fourth ninja is the last: the New ninja card goes when the device is full', async ({ page }) => {
    await seedSiblings(page);
    await page.goto('/');
    await expect(page.locator('#new-ninja')).toBeVisible();
    // Two more, each through the real onboarding the card opens — the child's own route, not the grown-ups'.
    for (const [ninja, name] of [['blaze', 'Cass'], ['kai', 'Dee']] as const) {
      await page.click('#new-ninja');
      await expect(page.locator('.choose-ninja-screen'), 'a new ninja runs the normal wizard').toBeVisible();
      await page.click(`.avatar-card[data-id="${ninja}"]`);
      await page.click('#next');
      await page.fill('#name', name);
      await page.click('#go');
      await page.click('#intro-go');
      await expect(page.locator('.home')).toBeVisible();
      await expect(page.locator('#change-av')).toContainText(name);
      await page.click('#who');
      await expect(page.locator('.profile-screen')).toBeVisible();
    }
    await expect(page.locator('.avatar-card[data-profile]')).toHaveCount(4);
    await expect(page.locator('#new-ninja'), 'four is the most one device holds').toHaveCount(0);
  });

  /**
   * guard rail (#380 review B1, and round 5's B3): the picker pushes no history entry of its own, so whatever
   * entry is current when it opens is what everything leaving it unwinds onto. `renderIntro`'s `history.go(-2)`
   * landed a brand-new Reception profile on the previous child's Year 2 island, or on an empty rewards screen.
   *
   * The 👥 control is on the sky map, which is the root, so the way to reach the picker over a stacked entry is
   * the **boot** path: `history.state` survives a reload, a PWA relaunch or a restored tab, and boot drew the
   * picker wherever the stack happened to be. Round 5's B3 is that door, and one function is now both doors —
   * so this reloads from a stacked screen rather than clicking a button that no longer sits on one.
   */
  for (const from of ['island', 'rewards'] as const) {
    test(`a new ninja added after a reload from the ${from} screen starts on their own sky map (#20 slice 2)`, async ({ page }) => {
      await seedSiblings(page);
      await page.goto('/');
      await page.click('.avatar-card[data-profile="p1"]');
      await expect(page.locator('.home.map')).toBeVisible();

      if (from === 'island') {
        await page.click('.island[data-year="year2"]');
        await expect(page.locator('.island-screen')).toBeVisible();
      } else {
        await page.click('#rewards');
        await expect(page.locator('.home.rewards')).toBeVisible();
      }
      expect(await page.evaluate(() => history.state?.screen ?? null), 'the screen we reload from pushed an entry').toBe(from);

      await page.reload();
      await expect(page.locator('.profile-screen')).toBeVisible();
      expect(await page.evaluate(() => history.state?.screen ?? null), 'and the picker is drawn at the root, not on it').toBeNull();
      await page.click('#new-ninja');
      await expect(page.locator('.choose-ninja-screen')).toBeVisible();
      await page.click('.avatar-card[data-id="kai"]');
      await page.click('#next');
      await page.fill('#name', 'Cass');
      await page.click('#go');
      await page.click('#intro-go');

      await expect(page.locator('.home.map'), "the new child's own sky map, not the screen the picker was opened from").toBeVisible();
      await expect(page.locator('#change-av')).toContainText('Cass');
      await expect(page.locator('#rewards'), 'and their own empty purse, not the 40 coins of the child they were added from')
        .toHaveAttribute('aria-label', 'Rewards: 0 coins');
    });
  }

  /**
   * guard rail (#380 review B5): opened from the sky map the picker needs a way out. The ＋ card adds a profile
   * for good — nothing deletes one until slice 3 — so without a back control a child who tapped 👥 out of
   * curiosity could only leave by committing to a profile, and the launch picker would then greet them on
   * every boot forever. At launch there is deliberately no back control: the picker is the root screen there,
   * and since round 5's B3 that is *derived* from a screen being on the page rather than passed in by whichever
   * route called — so this test and the two below it are the pair that hold the two halves apart.
   */
  test('the picker opened from the sky map has a way back that adds nobody (#20 slice 2)', async ({ page }) => {
    await seedPlayer(page, 'volt', 'Ada');
    await page.click('#who');
    await expect(page.locator('.profile-screen')).toBeVisible();
    await page.click('#back');
    await expect(page.locator('.home.map')).toBeVisible();
    await expect(page.locator('#change-av'), 'the same child, still playing').toContainText('Ada');

    await page.click('#who');
    await expect(page.locator('.avatar-card[data-profile]'), 'and backing out created nobody').toHaveCount(1);
  });

  /**
   * guard rail (#380 review B3, round 3): "back from the picker leaves the app, exactly as back from the map
   * does" is stated three times — `main.ts`'s route comment, the rail's comment, the docstring above — and
   * was verified by nothing at any layer. It is the property the whole no-history decision rests on, and on
   * the APK hardware back is the primary navigation control, so a stray `enter('profiles')` would send every
   * "chosen, go to the map" straight back here with no way out. The rail can see the two source sites; only
   * this can see what pressing back actually does.
   */
  test('hardware back at the launch picker leaves the app, as it does from the map (#20 slice 2)', async ({ page }) => {
    await seedSiblings(page);
    await page.goto('/');
    await expect(page.locator('.profile-screen')).toBeVisible();
    // Nothing of ours to pop: the picker is the root screen here, so back is the browser's to answer.
    expect(await page.evaluate(() => history.state?.screen ?? null), 'the picker pushed no entry').toBeNull();
    await page.goBack();
    await expect(page.locator('.home'), 'no sibling\'s sky map was entered by the press').toHaveCount(0);
  });

  /**
   * ...**with a history entry behind it**, which is the half the test above cannot see and round 5's B3 lived in
   * (#380 review round 5, B3). After a single `page.goto('/')` the history length is 1, so `page.goBack()` is a
   * no-op and the assertion above cannot fail however the picker is drawn. `history.state` survives a reload,
   * so a pull-to-refresh, PWA relaunch or restored tab from any screen below the map used to draw the *launch*
   * picker — the one that deliberately has no `←` because "back leaves the app" — on top of that screen's
   * entry. One press then dismissed the screen whose whole question is which child is playing, straight into
   * whoever the index last called active: a sibling playing in the other child's game, earning their coins.
   */
  test('...and with a reloaded entry behind it, which is the one that broke (#20 slice 2)', async ({ page }) => {
    await seedSiblings(page);
    await page.goto('/');
    await page.click('.avatar-card[data-profile="p2"]');          // Bo is the child the index now calls active
    await expect(page.locator('.home.map')).toBeVisible();
    await page.click('.island[data-year="year2"]');
    await expect(page.locator('.island-screen')).toBeVisible();

    await page.reload();
    await expect(page.locator('.profile-screen'), 'the reload asks who is playing, as a launch does').toBeVisible();
    expect(await page.evaluate(() => history.state?.screen ?? null), "the restored entry is unwound, not drawn on").toBeNull();
    await expect(page.locator('.profile-screen #back'), 'so there is no back control, and none is owed').toHaveCount(0);

    await page.goBack();
    await expect(page.locator('.home'), 'the press leaves the app rather than walking past the question').toHaveCount(0);
    await expect(page.locator('.island-screen'), 'and does not restore the screen the reload came from').toHaveCount(0);
  });

  /**
   * guard rail (#380 review round 5, B1): 👥 was a fourth `.icon-btn` on the shared topbar, and that row was
   * already full to the pixel — on a 390×844 iPhone, this project's own device, the new button's right edge sat
   * at 397.6 with the screen ending at 390, and `document.documentElement.scrollWidth` went from 390 to 398, so
   * the sky map, the island screen and the rewards screen all gained horizontal scroll. The control this checks
   * is not decorative: with one profile the launch picker never appears, so it is the only way a second child
   * is ever added, and a parent hunting for it found two-thirds of a button against the bezel.
   *
   * Nothing pointed `expectFitsViewport` — the rail shape this repo already built for this class of bug (#107,
   * #109, #110) — at the topbar, and the picker's own e2e clicked the button successfully because Playwright
   * clicks an element's centre, which at 374.6 was still on screen.
   */
  test('the sky map, island and rewards screens fit across, control and all (#20 slice 2)', async ({ page }) => {
    // The purse is seeded on purpose, and it is the whole difference between a rail and a decoration: with an
    // empty purse the coin pill reads "🪙 0" and the row has ~10px of slack, so the four-button topbar fitted
    // and this test passed while the bug was in front of it. The review's own fixture — Ada, 40 coins, no
    // streak — is what the measurement was taken against, so it is what this seeds.
    await page.addInitScript(save => {
      if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save);
    }, JSON.stringify({ v: SAVE_VERSION, name: 'Ada', avatar: 'volt', coins: 40, spent: 0, onboarded: true }));
    await page.goto('/');
    await expect(page.locator('.home.map')).toBeVisible();
    const vw = page.viewportSize()!.width;
    const who = page.locator('#who');
    await expect(who, 'the way to the picker is on the map, where every screen comes back to').toBeVisible();
    const box = (await who.boundingBox())!;
    expect(Math.round(box.x + box.width), 'the whole control is on screen, not two-thirds of it').toBeLessThanOrEqual(vw);
    expect(box.height, 'and it clears the 44px touch floor (`design-language` §4)').toBeGreaterThanOrEqual(44);
    await expectFitsViewport(page, 'sky map');

    await page.click('.island[data-year="year2"]');
    await expect(page.locator('.island-screen')).toBeVisible();
    await expectFitsViewport(page, 'island screen');

    await page.goBack();
    await page.click('#rewards');
    await expect(page.locator('.home.rewards')).toBeVisible();
    await expectFitsViewport(page, 'rewards screen');
  });

  /**
   * guard rail (#414): the same topbar row, on the two widths #20 slice 2's own test never measured — a 320px
   * phone, and a 360px one once the coin pill carries four digits and a streak. Measured on `main`, `#spk`'s
   * right edge sat at 344 against a 320px viewport (24px off) and, with a four-figure purse and a streak, at
   * 388 against 360 (28px off) — a child on a small phone saw the read-aloud button sliced by the screen edge,
   * with horizontal scroll on every screen the shared topbar appears on. The empty-purse case at 360px happened
   * to fit on `main` (344/360), so both purses are checked at both widths rather than assuming one implies the
   * other.
   */
  test('the topbar fits a 320px and a 360px phone, empty purse and a four-figure one with a streak (#414)', async ({ page }) => {
    for (const [w, h] of [[320, 568], [360, 640]] as const) {
      for (const purse of [{ coins: 40, days: 0 }, { coins: 1250, days: 12 }]) {
        await page.addInitScript(save => {
          localStorage.removeItem('sna:v1');
          localStorage.setItem('sna:v1', save);
        }, JSON.stringify({ v: SAVE_VERSION, name: 'Ada', avatar: 'volt', coins: purse.coins, spent: 0, onboarded: true, streak: { last: '', days: purse.days } }));
        await page.setViewportSize({ width: w, height: h });
        await page.goto('/');
        await expect(page.locator('.home.map')).toBeVisible();
        const spk = await page.locator('#spk').boundingBox();
        expect(spk!.x + spk!.width, `${w}x${h}, ${purse.coins} coins/${purse.days}-day streak: the read-aloud button is sliced by the screen edge`)
          .toBeLessThanOrEqual(w);
        expect(spk!.height, 'and it still clears the 44px touch floor (`design-language` §4)').toBeGreaterThanOrEqual(44);
        // round 3 review, B1: `.icon-btn` had no `flex-shrink: 0`, so once `.hero` hit its own floor the
        // remaining deficit shrank #snd/#spk below the 44px touch floor (measured 41.5px) with no overflow to
        // catch it — height alone can't see a width-only shrink, so both buttons' width is checked too.
        expect(spk!.width, 'and the read-aloud button keeps its 44px width, not just its height').toBeGreaterThanOrEqual(44);
        const snd = await page.locator('#snd').boundingBox();
        expect(snd!.width, `${w}x${h}, ${purse.coins} coins/${purse.days}-day streak: the mute button is squeezed under the touch floor`)
          .toBeGreaterThanOrEqual(44);
        // round 1 review, B1: `.hero`'s `min-width: 0` alone let the shrink pressure fall on the fixed-size
        // portrait too (54px -> 12px at this exact scenario), not just on the text it was meant for.
        const portrait = await page.locator('.hero .portrait').boundingBox();
        expect(portrait!.width, `${w}x${h}, ${purse.coins} coins/${purse.days}-day streak: the ninja's portrait is squeezed instead of the text`)
          .toBeGreaterThanOrEqual(53);
        // round 2 review, B1: pinning the portrait moved 100% of the remaining shrink onto the identity text,
        // which collapsed to 0×0 (invisible, not truncated) at this exact scenario. The child's own name is
        // #414's explicit "name last" priority, so the name has to render at a non-zero width everywhere.
        const heroName = await page.locator('.hero b').boundingBox();
        expect(heroName!.width, `${w}x${h}, ${purse.coins} coins/${purse.days}-day streak: the ninja's name has vanished, not just truncated`)
          .toBeGreaterThan(0);
        await expectFitsViewport(page, `sky map at ${w}x${h}, ${purse.coins} coins/${purse.days}-day streak`);
      }
    }
  });

  /**
   * A store that takes every `setItem` and throws. Registered *after* `seedSiblings`, so the seed lands and
   * only the running game's writes are refused — `addInitScript`s run in registration order.
   */
  const refuseWrites = (page: Page) => page.addInitScript(() => {
    const proto = Object.getPrototypeOf(localStorage) as Storage;
    proto.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
  });
  /** Record every line handed to the engine, so a test can assert a sentence was *spoken* and not only printed. */
  const captureSpeech = (page: Page) => page.addInitScript(() => {
    window.__spoken = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false, pending: false, getVoices: () => [], cancel: () => {}, onvoiceschanged: null,
        speak: (u: SpeechSynthesisUtterance) => { window.__spoken!.push(u.text); },
      },
    });
  });

  /**
   * guard rail (#380 review B1 and B2), and the one fixture that holds both. A device whose store reads but
   * refuses writes is a decision this repo has already made twice — #151's `writeFailed`, #232's read-only
   * latch, `parents.ts`'s "This device is not saving progress right now" — and the answer is always that the
   * game degrades rather than stops. Before the picker, such a device booted to the sky map and the child
   * played unsaved.
   *
   * B1: `setActiveProfile` wrote the index even when `id` was already active, so every card on the launch
   * picker was refused — including the child's own — and the launch picker deliberately draws no back
   * control. Three cards, three refusals, no fourth thing to tap: the game became unreachable.
   *
   * B2: nothing at any layer rendered this screen, so both handlers' `refuse(...)` calls were untested code.
   * Deleting them left `tsc` clean and the whole suite green while a refused tap did nothing at all — no
   * hint, no sound, no spoken sentence — which to a pre-reader is indistinguishable from a broken game. The
   * unit rail can only read `refuse`'s *definition*; this is what reads the call.
   */
  test('a refusing store: the refusals are spoken, and the child still reaches their own game (#20 slice 2)', async ({ page }) => {
    await seedSiblings(page);
    await captureSpeech(page);
    await refuseWrites(page);
    await page.goto('/');
    await expect(page.locator('.profile-screen')).toBeVisible();
    await expect(page.locator('.profile-screen #back'), 'no way out but a card, which is why one of them must work').toHaveCount(0);

    // The sibling's card is honestly refused: that switch genuinely cannot be persisted, and the next launch
    // would put the child back on their own game with no explanation.
    await page.click('.avatar-card[data-profile="p2"]');
    await expect(page.locator('.profile-screen'), "and the child is not dropped into their sibling's game").toBeVisible();
    await expect(page.locator('#who-hint')).toHaveText('This browser will not let the game save, so it cannot swap ninja. 😕');
    await expect.poll(() => page.evaluate(() => window.__spoken ?? []), { message: 'read aloud, not only printed' })
      .toContain('This browser will not let the game save, so it cannot swap ninja. 😕');

    // "New ninja" the same, and with its own sentence — the two refusals are not one message (#335 item 2).
    await page.click('#new-ninja');
    await expect(page.locator('#who-hint')).toHaveText('This browser will not let the game save, so a new ninja cannot be added. 😕');
    await expect.poll(() => page.evaluate(() => window.__spoken ?? []))
      .toContain('This browser will not let the game save, so a new ninja cannot be added. 😕');

    // ...and their own card lets them through to a game that plays unsaved, as the device did before #20.
    await page.click('.avatar-card[data-profile="p1"]');
    await expect(page.locator('.home')).toBeVisible();
    await expect(page.locator('#change-av'), 'their own save, read from their own slot').toContainText('Ada');
    await expect(page.locator('#rewards')).toContainText('40');
  });

  test('the launch picker has no back control — it is the root screen (#20 slice 2)', async ({ page }) => {
    await seedSiblings(page);
    await page.goto('/');
    await expect(page.locator('.profile-screen')).toBeVisible();
    await expect(page.locator('.profile-screen #back'), 'back from the root leaves the app, as it does from the map').toHaveCount(0);
  });
});

/**
 * #20 slice 3 — rename and remove, from behind the grown-ups gate. Slice 1 gave each sibling a save and slice 2
 * a way to reach it; this is the first time a family can take a slot back, or fix a name typed by a five-year
 * old. Reuses `seedSiblings` above, so the index shape is stated in exactly one place.
 */
test.describe('ninjas on this device (#20 slice 3)', () => {
  test('a grown-up renames a sibling without leaving the dashboard, and the picker agrees', async ({ page }) => {
    await seedSiblings(page);                      // Ada in p1 (active, 40 coins), Bo in p2
    await page.goto('/');
    await page.click('.avatar-card[data-profile="p1"]');
    await openGrownUps(page);
    await expect(page.locator('.p-prof')).toHaveCount(2);
    await expect(page.locator('.p-prof[data-prof="p2"]')).toContainText('Bo');

    await page.fill('.p-prof-in[data-name="p2"]', 'Bobby');
    await page.click('button[data-rename="p2"]');
    await expect(page.locator('#prof-msg')).toHaveText('Renamed to Bobby.');
    await expect(page.locator('.p-prof[data-prof="p2"] b'), 'the row redraws from the store').toHaveText('Bobby');
    await expect(page.locator('.parents-dash'), 'and the child playing is untouched — the heading is still theirs').toContainText('Ada');

    // The rename is persisted, not merely rendered: it is on the launch picker at the next boot, and Bo's own
    // coins came through with it.
    await page.goto('/');
    await expect(page.locator('.avatar-card[data-profile="p2"]')).toContainText('Bobby');
    await page.click('.avatar-card[data-profile="p2"]');
    await expect(page.locator('#change-av')).toContainText('Bobby');
    await expect(page.locator('#rewards'), 'a rename is one field, not a reset').toContainText('7');
  });

  test("renaming the child holding the device changes the screens they are looking at", async ({ page }) => {
    await seedPlayer(page, 'volt', 'Ada');
    await openGrownUps(page);
    await expect(page.locator('.p-prof'), 'one profile is still a row — a name is worth fixing on any device').toHaveCount(1);
    await expect(page.locator('button[data-del="p1"]'), 'but the only ninja has no Remove: that is "Start again"').toHaveCount(0);
    await page.fill('.p-prof-in[data-name="p1"]', 'Ada Two');
    await page.click('button[data-rename="p1"]');
    await expect(page.locator('#prof-msg')).toHaveText('Renamed to Ada Two.');
    await expect(page.locator('.parents-dash'), 'the dashboard heading is drawn from the same save').toContainText('Ada Two');
    await page.click('.parents #back');
    await expect(page.locator('#change-av'), 'and so is the map, without a reload').toContainText('Ada Two');
  });

  test('a blank name is refused, and the refusal says so rather than clearing the row', async ({ page }) => {
    await seedPlayer(page, 'volt', 'Ada');
    await openGrownUps(page);
    await page.fill('.p-prof-in[data-name="p1"]', '   ');
    await page.click('button[data-rename="p1"]');
    await expect(page.locator('#prof-msg')).toHaveText('A ninja needs a name — type one in first.');
    await expect(page.locator('#prof-msg')).toHaveClass(/bad/);
    await expect(page.locator('.p-prof[data-prof="p1"] b')).toHaveText('Ada');
  });

  test('removing a sibling asks first, and cancelling changes nothing', async ({ page }) => {
    await seedSiblings(page);
    await page.goto('/');
    await page.click('.avatar-card[data-profile="p1"]');
    await openGrownUps(page);
    await page.click('button[data-del="p2"]');
    await expect(page.locator('.prof-modal h2'), 'named, so a grown-up can see which child this is').toHaveText('Remove Bo?');
    await page.click('#prof-cancel');
    await expect(page.locator('.prof-modal')).toHaveCount(0);
    await expect(page.locator('.p-prof')).toHaveCount(2);

    // Confirming removes the row, stays on the dashboard — this is not the child who is playing — and frees
    // the slot for a new ninja.
    await page.click('button[data-del="p2"]');
    await page.click('#prof-go');
    await expect(page.locator('.prof-modal')).toHaveCount(0);
    await expect(page.locator('.parents-dash'), 'the grown-up is still where they were').toBeVisible();
    await expect(page.locator('#prof-msg')).toHaveText('Bo was removed from this device.');
    await expect(page.locator('.p-prof')).toHaveCount(1);
    await expect(page.locator('button[data-del="p1"]'), 'and the last one left cannot be removed either').toHaveCount(0);

    // Gone from the store, not only from the list: one profile boots straight to the map, and the slot is reusable.
    await page.goto('/');
    await expect(page.locator('.profile-screen'), 'one profile, so no launch picker').toHaveCount(0);
    await expect(page.locator('#change-av')).toContainText('Ada');
    await page.click('#who');
    await expect(page.locator('.avatar-card[data-profile]')).toHaveCount(1);
    await expect(page.locator('#new-ninja'), 'the freed slot is genuinely free').toBeVisible();
  });

  /**
   * The one navigation rule slice 3 adds: a grown-up who removes the ninja this session is playing cannot be
   * left on a dashboard drawn from a save that no longer exists. Where they land is the boot decision re-run
   * (`main.ts`'s `relaunch`) — the picker while two or more profiles remain.
   */
  test('removing the child this session is playing lands on the picker, not on their empty dashboard', async ({ page }) => {
    await page.addInitScript(({ index, ada, bo, cass }) => {
      if (!localStorage.getItem('sna:profiles')) {
        localStorage.setItem('sna:v1', ada);
        localStorage.setItem('sna:v1:p2', bo);
        localStorage.setItem('sna:v1:p3', cass);
        localStorage.setItem('sna:profiles', index);
      }
    }, {
      index: JSON.stringify({ v: 1, active: 'p2', ids: ['p1', 'p2', 'p3'] }),
      ada: JSON.stringify({ v: SAVE_VERSION, name: 'Ada', avatar: 'volt', coins: 40, spent: 0, onboarded: true }),
      bo: JSON.stringify({ v: SAVE_VERSION, name: 'Bo', avatar: 'blaze', coins: 7, spent: 0, onboarded: true }),
      cass: JSON.stringify({ v: SAVE_VERSION, name: 'Cass', avatar: 'terra', coins: 3, spent: 0, onboarded: true }),
    });
    await page.goto('/');
    await page.click('.avatar-card[data-profile="p2"]');
    await expect(page.locator('#change-av')).toContainText('Bo');
    await openGrownUps(page);
    await page.click('button[data-del="p2"]');
    await page.click('#prof-go');
    await expect(page.locator('.profile-screen'), 'two children left, so the launch picker is the honest answer').toBeVisible();
    await expect(page.locator('.avatar-card[data-profile]')).toHaveCount(2);
    await expect(page.locator('.avatar-card[data-profile="p2"]')).toHaveCount(0);
    // **And it is the LAUNCH picker, with no way past the question** (#420 review B1). `relaunch()` draws on
    // top of the grown-ups screen, so `screenDrawn()` answered true and the picker got a `←`: one tap put the
    // remaining sibling into whoever the index called active — nobody chose them — earning that child's coins
    // and stars. The same defect #380 round 5 B3 spent a round fixing, by a new door. Slice 2 asserts this
    // three times for the boot picker; the post-delete one is the same screen and needs the same assertion.
    await expect(page.locator('.profile-screen #back'), 'no way out but choosing a child (#420 B1)').toHaveCount(0);
    // And the siblings' saves are theirs, not Bo's written over one of them on the way out.
    await page.click('.avatar-card[data-profile="p1"]');
    await expect(page.locator('#change-av')).toContainText('Ada');
    await expect(page.locator('#rewards')).toContainText('40');
  });

  /**
   * `relaunch()`'s other two branches, which nothing reached (#420 review note 5): with **two** profiles a
   * self-delete leaves one, so there is no picker to draw and the remaining child's own screen is the answer.
   * That is the shape most family tablets take, and replacing `nav.launch()` with `drawDash()` left every unit
   * test green.
   */
  test('with two profiles, removing the one playing lands on the sibling’s own map (#20 slice 3)', async ({ page }) => {
    await seedSiblings(page, 'p2');                 // Ada in p1 (40 coins), Bo in p2 and active
    await page.goto('/');
    await page.click('.avatar-card[data-profile="p2"]');
    await expect(page.locator('#change-av')).toContainText('Bo');
    await openGrownUps(page);
    await page.click('button[data-del="p2"]');
    await page.click('#prof-go');
    await expect(page.locator('.profile-screen'), 'one child left, so no picker to choose from').toHaveCount(0);
    await expect(page.locator('.home'), "and not the dashboard of a save that no longer exists").toBeVisible();
    await expect(page.locator('#change-av')).toContainText('Ada');
    await expect(page.locator('#rewards'), "Ada's own coins, not Bo's written over them").toContainText('40');
  });

  test('...and onto onboarding when the profile left has never been played (#20 slice 3)', async ({ page }) => {
    // p1 is a slot the ＋ card made and nothing ever played; p2 is Bo, active and playing.
    await page.addInitScript(({ index, bo }) => {
      if (!localStorage.getItem('sna:profiles')) {
        localStorage.setItem('sna:v1:p2', bo);
        localStorage.setItem('sna:profiles', index);
      }
    }, {
      index: JSON.stringify({ v: 1, active: 'p2', ids: ['p1', 'p2'] }),
      bo: JSON.stringify({ v: SAVE_VERSION, name: 'Bo', avatar: 'blaze', coins: 7, spent: 0, onboarded: true }),
    });
    await page.goto('/');
    await page.click('.avatar-card[data-profile="p2"]');
    await openGrownUps(page);
    await page.click('button[data-del="p2"]');
    await page.click('#prof-go');
    await expect(page.locator('.avatar-screen'), 'the wizard, because the slot left has no game yet').toBeVisible();
    await expect(page.locator('.home'), 'never the map with an empty profile (#67, #115)').toHaveCount(0);
  });

  /**
   * #420 review B2. `profileCard` blanks a save a newer build wrote, so the row drew ＋ / "Ninja 2" /
   * "Not started yet" / "No name yet — this ninja has not played" beside a Remove button — and the tap
   * destroyed 99 coins and all of that child's progress. Reachable by an APK rollback, a sideloaded older
   * build or a stale service worker: #232's whole scenario. The row must stop claiming the wrong reason, and
   * must not offer the tap.
   */
  test('a sibling’s newer-build save is not offered for renaming or removal, and says why (#20 slice 3)', async ({ page }) => {
    await page.addInitScript(({ index, ada, future }) => {
      if (!localStorage.getItem('sna:profiles')) {
        localStorage.setItem('sna:v1', ada);
        localStorage.setItem('sna:v1:p2', future);
        localStorage.setItem('sna:profiles', index);
      }
    }, {
      index: JSON.stringify({ v: 1, active: 'p1', ids: ['p1', 'p2'] }),
      ada: JSON.stringify({ v: SAVE_VERSION, name: 'Ada', avatar: 'volt', coins: 40, spent: 0, onboarded: true }),
      future: JSON.stringify({ v: SAVE_VERSION + 1, name: 'Bo', avatar: 'blaze', coins: 99, spent: 0, onboarded: true }),
    });
    await page.goto('/');
    await page.click('.avatar-card[data-profile="p1"]');
    await openGrownUps(page);
    const newer = page.locator('.p-prof[data-prof="p2"]');
    await expect(newer).toContainText('Saved by a newer version');
    await expect(newer, 'and never "this ninja has not played" about bytes it cannot read').not.toContainText('has not played');
    await expect(newer.locator('.p-prof-in'), 'no rename').toHaveCount(0);
    await expect(page.locator('button[data-del="p2"]'), 'and no Remove — 99 coins are behind it').toHaveCount(0);
    await expect(newer).toContainText('Open the game on the other device');
    // The bytes are still there, which is the whole point: the other device still reads them.
    expect(await page.evaluate(() => localStorage.getItem('sna:v1:p2'))).toContain('99');
  });

  /**
   * #446. The row above withholds Remove on the *future* slot itself — 99 coins behind it — but that alone
   * still let a grown-up remove the *readable* sibling and strand the family: with p2 unreadable by this
   * build, taking p1 out leaves an index whose one remaining id resolves to a save this build cannot open,
   * which sends the device into the first-run wizard over a store `readOnly` latches shut. Nothing typed into
   * that wizard is ever kept, so the family is stuck until the other device or an update comes back.
   */
  test('removing the readable ninja is withheld when the only sibling is a newer-build save (#446)', async ({ page }) => {
    await page.addInitScript(({ index, ada, future }) => {
      if (!localStorage.getItem('sna:profiles')) {
        localStorage.setItem('sna:v1', ada);
        localStorage.setItem('sna:v1:p2', future);
        localStorage.setItem('sna:profiles', index);
      }
    }, {
      index: JSON.stringify({ v: 1, active: 'p1', ids: ['p1', 'p2'] }),
      ada: JSON.stringify({ v: SAVE_VERSION, name: 'Ada', avatar: 'volt', coins: 40, spent: 0, onboarded: true }),
      future: JSON.stringify({ v: SAVE_VERSION + 1, name: 'Bo', avatar: 'blaze', coins: 99, spent: 0, onboarded: true }),
    });
    await page.goto('/');
    await page.click('.avatar-card[data-profile="p1"]');
    await openGrownUps(page);
    // p1 is readable and has a sibling, but that sibling is the only one and it is `future` — stranded.
    await expect(page.locator('button[data-del="p1"]'), 'removing Ada would leave only Bo\'s unreadable save').toHaveCount(0);
    await expect(page.locator('button[data-del="p2"]'), 'the future slot is still withheld on its own terms too').toHaveCount(0);
  });

  /**
   * The grown-ups list draws a slot the picker's ＋ created and nothing ever played — the same state #380
   * review B1 was about, one screen over. It must not offer a rename it would refuse, and it must still be
   * removable, because that is the only way the family gets the slot back.
   */
  test('an unplayed slot says so instead of offering a rename, and can still be removed', async ({ page }) => {
    await seedPlayer(page, 'volt', 'Ada');
    await page.click('#who');
    await page.click('#new-ninja');
    await expect(page.locator('.avatar-screen'), 'the ＋ card runs the wizard').toBeVisible();
    // Leave the wizard before a ninja is chosen: the slot is in the index with no save behind it.
    await page.goto('/');
    await expect(page.locator('.profile-screen')).toBeVisible();
    await page.click('.avatar-card[data-profile="p1"]');
    await openGrownUps(page);
    const unplayed = page.locator('.p-prof[data-prof="p2"]');
    await expect(unplayed).toContainText('Ninja 2');
    await expect(unplayed).toContainText('Not started yet');
    await expect(unplayed.locator('.p-prof-in'), 'no name to change').toHaveCount(0);
    await expect(unplayed).toContainText('No name yet');
    await page.click('button[data-del="p2"]');
    await expect(page.locator('.prof-modal h2')).toHaveText('Remove Ninja 2?');
    await page.click('#prof-go');
    await expect(page.locator('.p-prof')).toHaveCount(1);
    await page.goto('/');
    await expect(page.locator('.profile-screen'), 'back to a one-profile device').toHaveCount(0);
    await expect(page.locator('#change-av')).toContainText('Ada');
  });
});
