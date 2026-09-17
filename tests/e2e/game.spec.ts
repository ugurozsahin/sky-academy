import { test, expect, type Page } from '@playwright/test';
import { TOPICS } from '../../src/curriculum';
import { SAVE_VERSION } from '../../src/storage';
import type { PlayHooks, MemoryHooks } from '../../src/ui/hooks';

declare global {
  interface Window { __lastVoiceLine?: SpeechSynthesisUtterance }   // #65: the stubbed engine parks the last line here for a test to start by hand
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
  await expect(page.locator('#go')).toBeDisabled();
  await page.click(`.avatar-card[data-id="${id}"]`);
  await page.fill('#name', name);
  await page.click('#go');
  await expect(page.locator('.intro-card')).toBeVisible();   // #67: first run continues into the introduction
  await page.click('#intro-go');
  await expect(page.locator('.home')).toBeVisible();
}
/**
 * #138: land on the sky map with the avatar already chosen, by writing the save `avatarScreen` would have
 * written (`src/storage.ts`: key `sna:v1`, `save({ avatar })` then `save({ name })`) before the app boots.
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
 * Bring up a Sky Storm wave carrying a TNT. Bombs ride every third question (`play.ts`), but never a
 * sequence one, and Storm draws its topic at random — so each attempt resets the counter to 5 and a sequence
 * draw simply costs one question. Whether a wave carries a bomb is read straight off `arena.bubbles`, which
 * includes bubbles that have not launched yet: `bubbles()` shows only launched ones, and a bomb can ride the
 * second batch seconds later, so waiting on that would time out on a wave that does have one. Every predicate
 * here returns a boolean — a JSON string would be truthy on the first frame and resolve the wait immediately.
 */
async function nextWaveWithBomb(page: Page) {
  for (let k = 0; k < 3; k++) {
    await page.evaluate(() => { window.__sna.session.questionsAsked = 5; });
    await solveCurrent(page);                                            // the wave this spawns is "question 6"
    const deadline = Date.now() + 12000;
    let carries = false, settled = false;
    while (Date.now() < deadline && !settled) {
      const w = await page.evaluate(() => {
        const s = window.__sna; if (!s || s.state().ended) return 'ended';
        if (s.state().waiting) return null;
        const all = s.arena!.bubbles; if (!all.length) return null;
        if (all.every((b: any) => b.dead)) return null;                  // the previous wave, cleared but not yet replaced
        return { bomb: all.some((b: any) => b.label === '💣'), allUp: all.every((b: any) => b.launched || b.dead) };
      });
      if (w === 'ended') throw new Error('the Storm ended before a TNT wave came up');
      if (w) { carries = w.bomb; settled = w.bomb || w.allUp; }
      if (!settled) await page.waitForTimeout(150);
    }
    if (!carries) continue;                                              // no TNT this time: answer it and retry
    await page.waitForFunction(() => window.__sna.bubbles()              // now let it rise into a tappable spot
      .some((b: any) => b.label === '💣' && b.vy < 0 && b.y > 80 && b.y < window.innerHeight - 40), null, { timeout: 15000 });
    return;
  }
  throw new Error('no TNT wave after 3 attempts');
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
    await expect(page.locator('#go')).toBeDisabled();                                 // a locked card never selects
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

  test('avatar screen: the last card row is never left under the sticky Let\'s go! button (#51)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 664 });        // the shortest phone we support
    await page.goto('/?reset=1');
    await expect(page.locator('.avatar-card')).toHaveCount(11);
    const clearance = () => page.evaluate(() => {
      const cards = document.querySelectorAll('.avatar-card');
      const last = cards[cards.length - 1].getBoundingClientRect();  // Master, bottom-right
      const go = (document.querySelector('#go') as HTMLElement).getBoundingClientRect();
      return Math.round(go.top - last.bottom);                       // px between the last card and the button (≥ 0 = clear)
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
   * #110, both halves. The field used to be the last thing on the page, under all eleven cards, and
   * `Let's go!` only ever asked for an avatar — so a child could walk straight past it and every screen
   * downstream fell back to the literal "Ninja", the printed certificate included.
   *
   * "Visible without hunting for it" is measured as *on screen at first paint, before anything scrolls*,
   * which is the thing the old layout failed; `toBeInViewport` on its own would pass after a scroll.
   */
  test('avatar screen: the name field is on screen from the start, and is required (#110)', async ({ page }) => {
    await page.goto('/?reset=1');
    await expect(page.locator('.avatar-screen')).toBeVisible();
    await expect(page.locator('.avatar-card')).toHaveCount(11);

    // On screen at first paint — no scrolling, and above the first row of cards rather than below the last.
    expect(await page.evaluate(() => window.scrollY), 'the screen must not have scrolled yet').toBe(0);
    await expect(page.locator('#name')).toBeInViewport({ ratio: 1 });
    const [nameBottom, gridTop] = await page.evaluate(() => [
      document.querySelector('#name')!.getBoundingClientRect().bottom,
      document.querySelector('.avatar-grid')!.getBoundingClientRect().top,
    ]);
    expect(nameBottom, 'the name field must sit above the avatar grid, not below it (#110)').toBeLessThanOrEqual(gridTop);
    await expect(page.locator('#name-hint')).toHaveText(/name/i);   // a friendly nudge, not an error

    // Required: an avatar alone is not enough, and a space bar is not a name.
    await expect(page.locator('#go')).toBeDisabled();
    await page.click('.avatar-card[data-id="volt"]');
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

  test('onboarding: hardware/browser back moves between the avatar step and the introduction', async ({ page }) => {
    await page.goto('/?reset=1');
    await page.click('.avatar-card[data-id="volt"]');
    await page.fill('#name', 'Ada');
    await page.click('#go');
    await expect(page.locator('.intro-card')).toBeVisible();

    await page.goBack();
    await expect(page.locator('.avatar-screen')).toBeVisible();
    await expect(page.locator('.avatar-card.sel')).toHaveAttribute('data-id', 'volt');   // the pick was not lost

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
    await page.waitForFunction((n) => window.__sna.arena.bubbles.length >= n, words.length);
    const batches = await page.evaluate((ws) => {
      const bs = window.__sna.arena.bubbles, t0 = Math.min(...bs.map((b: any) => b.launchAt)), used = new Set<number>();
      return ws.map((w: string) => { const k = bs.findIndex((b: any, i: number) => b.label === w && !used.has(i)); if (k < 0) throw new Error(`no bubble for "${w}"`); used.add(k); return Math.round(bs[k].launchAt - t0); });
    }, words);
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
    await expect(page.locator('#go')).toBeDisabled();
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
  // in avatarScreen() both throw on a non-string — "Change ninja" from the map is a screen every returning
  // player can reach, not an edge case.
  // #67 update: "Change ninja" (`#change-av`, returning players) is now `changeAvatarScreen`, which never
  // renders `d.name` at all — the crash this rail guarded against cannot occur on that screen any more. The
  // name field now lives only on the first-run `avatarScreen` (unchanged), so that half of the rail moves
  // there rather than being dropped.
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

  test('guard rail: the first-run avatar screen still opens on a save with a wrong-typed name (#171)', async ({ page }) => {
    const failed: string[] = [];
    page.on('pageerror', e => failed.push(`page error: ${e.message}`));

    await page.addInitScript(save => {
      if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save);
    }, JSON.stringify({ v: 1, name: 123, sound: 'yes', tutorialSeen: 'true' }));   // no avatar → not onboarded
    await page.goto('/');
    await expect(page.locator('.avatar-screen')).toBeVisible();
    await expect(page.locator('#name')).toHaveValue('');   // the corrupted name was dropped, not rendered as "123"
    expect(failed, `while opening the first-run avatar screen${failed.length ? ':\n  ' + failed.join('\n  ') : ''}`).toEqual([]);
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
  test('guard rail: the game still loads and plays with the network off', async ({ page, context }) => {
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
    page.on('response', r => { if (r.url().startsWith('http://localhost:4173') && !r.fromServiceWorker()) fromNetwork.push(r.url()); });
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
