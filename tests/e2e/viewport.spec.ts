import { test, expect, type Page } from '@playwright/test';
import { expectFitsViewport, outsideItsBox, overrideSafeAreaInsets } from './viewport';
import { AVATARS, VILLAIN } from '../../src/avatars';
import type { StoredCert, StoredDuel } from '../../src/storage';

/**
 * The tablet specs (#116). This file is the whole of what the `tablet` and `tablet-landscape` projects
 * run, and the `mobile` and `desktop` projects skip it — see the `testMatch`/`testIgnore` pair in
 * `playwright.config.ts` and the note there about metered minutes.
 *
 * Three bugs arrived from one tablet playtest (#107 objects overflowing their five-frame slots, #109 the
 * grown-ups dashboard not fitting, #110 the opening screen's buried name field) and nothing in CI had
 * ever rendered a tablet. Where a check fails on one of those three it is `test.fixme` naming the issue,
 * not weakened or deleted: fixing the bug flips the test on, which is the only way this file can tell a
 * bug that is still there from a check that stopped looking.
 *
 * The navigation helpers below are a deliberate small duplicate of the ones in `game.spec.ts`. Moving
 * those out of that file would be the tidier change and it is not this issue's: a guard rail reads
 * `seedPlayer` out of `game.spec.ts` by name to prove the seeded start still writes the save slot
 * `storage.ts` reads (#138), so hoisting it silently turns that rail into a check on nothing.
 */

/**
 * Land on the sky map with the avatar already chosen, exactly as `game.spec.ts` does (#138). `extra`
 * mirrors that file's own `seedPlayer` signature (same optional fourth argument) rather than inventing a
 * shape of its own — the #399 `.cert-view` test below needs a seeded `certs` array.
 */
async function seedPlayer(page: Page, id = 'volt', name = 'Ada', extra: Record<string, unknown> = {}) {
  await page.addInitScript(save => {
    if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save);
  }, JSON.stringify({ v: 1, name, avatar: id, ...extra }));
  await page.goto('/');
  await expect(page.locator('.home')).toBeVisible();
}
/**
 * The same, with progress in the save (#109). An empty dashboard passes a fits-the-viewport check
 * vacuously: the "trickiest topics" and "going well" lists are not rendered at all until there is
 * something to put in them, and every stat reads 0 or "—", which is the narrowest the cards ever are.
 * Seeded, the widest strings the dashboard can produce are on screen when it is measured.
 */
async function seedProgress(page: Page, name = 'Ada') {
  const progress: Record<string, { stars: number; best: number; plays: number; hits: number; tries: number }> = {};
  for (const [i, id] of ['r-count', 'r-add', 'r-sub', 'y1-bonds', 'y1-add', 'y1-coins', 'y2-pv', 'y2-tables'].entries())
    progress[id] = { stars: (i % 3) + 1, best: 40 + i, plays: 3 + i, hits: 30 + i, tries: 40 + i * 3 };
  await page.addInitScript(save => {
    if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save);
  }, JSON.stringify({
    v: 1, name, avatar: 'volt', progress,
    endless: { reception: 120, year1: 340, year2: 980 }, sprint: { reception: 45, year1: 88 },
    boss: { reception: 2, year1: 7 }, memory: { reception: 4 }, training: { reception: 6, year2: 11 },
    coins: 1250, streak: { last: '', days: 12 },
  }));
  await page.goto('/');
  await expect(page.locator('.home')).toBeVisible();
}

/** Through the grown-ups maths gate and onto the dashboard (#109). */
async function openDashboard(page: Page) {
  await page.click('#grownups');
  await expect(page.locator('.parents .gate')).toBeVisible();
  const q = await page.locator('#gate-q').textContent();          // e.g. "6 × 8"
  const [a, b] = q!.split('×').map(s => parseInt(s.trim(), 10));
  await page.fill('#gate-input', String(a * b));
  await page.click('#gate-go');
  await expect(page.locator('.parents-dash')).toBeVisible();
  await expect(page.locator('.p-year').first()).toBeVisible();     // the cards are drawn, not an empty shell
}

async function startTopic(page: Page, year: string, topic: string, subject = 'maths') {
  await page.click(`.island[data-year="${year}"]`);
  await expect(page.locator('.island-screen')).toBeVisible();
  await page.click(`.tab[data-s="${subject}"]`);
  await page.click(`.topic[data-id="${topic}"]`);
  await expect(page.locator('.play')).toBeVisible();
  await expect(page.locator('#prompt')).not.toBeEmpty();   // the first question is drawn: measured from the DOM, so this file needs no `window.__sna`
}

/**
 * Reaches Ninja Duel's landscape screen on top of `seedPlayer`, deliberately smaller than `duel.spec.ts`'s
 * own `startDuel` (#399's safe-area tests below only need `.play.duel-screen` to render, never a round
 * played, so this skips that file's speech-recording stub and dojo seeding).
 */
async function startDuel(page: Page) {
  await seedPlayer(page);
  await page.click('.island[data-year="year1"]');
  await page.click('#duel');
  await expect(page.locator('.duel-screen')).toBeVisible();
}

test.describe('tablet viewports (#116)', () => {
  test('the choose-ninja step fits across', async ({ page }) => {
    await page.goto('/?reset=1');
    await expect(page.locator('.avatar-screen')).toBeVisible();
    await expectFitsViewport(page, 'choose-ninja step');
    await expect(page.locator('.avatar-card')).toHaveCount(11);
    expect(await page.evaluate(() => window.scrollY), 'the screen must not have scrolled yet').toBe(0);
  });

  /*
   * #110's vertical half, and an honest note about where it bit before #67 split the wizard onto two screens.
   * Measured on `main` before that fix, the field sat at y=906 in an 844 px phone — off screen — but at
   * y=582 on an 800x1280 tablet and y=571 at 768x1024, which is low but *on* screen. So "below the fold" was
   * the phone's failure, and an in-viewport assertion here would have passed before the fix.
   *
   * Now that the name field is the whole of its own step (`nameScreen`), there is nothing left to be below —
   * this test holds that structurally rather than by ordering. The phone's own version lives in `game.spec.ts`.
   */
  test('the name step fits across, with nothing for the field to sit below', async ({ page }) => {
    await page.goto('/?reset=1');
    await page.click('.avatar-card[data-id="volt"]');
    await page.click('#next');
    await expect(page.locator('#name')).toBeVisible();
    await expectFitsViewport(page, 'name step');
    await expect(page.locator('.avatar-grid'), '#110: the name step must never render the avatar grid').toHaveCount(0);
    expect(await page.evaluate(() => window.scrollY), 'the screen must not have scrolled yet').toBe(0);
    await expect(page.locator('#name'), '#110: the name field is below the fold on a tablet').toBeInViewport({ ratio: 1 });
  });

  test('the sky map and an island fit across', async ({ page }) => {
    await seedPlayer(page);
    await expectFitsViewport(page, 'sky map');
    await page.click('.island[data-year="reception"]');
    await expect(page.locator('.island-screen')).toBeVisible();
    await expectFitsViewport(page, 'island screen');
  });

  test('the play screen fits across', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'reception', 'r-count');
    await expectFitsViewport(page, 'play screen');
  });

  /**
   * #109, fixed. This was `test.fixme` on the portrait project: the dashboard laid itself out 936 px wide
   * inside an 800 px viewport, so the page scrolled sideways and the right-hand column of every row was
   * off screen. It is on now, and seeded with progress — an empty dashboard is the narrowest the cards
   * ever are and would have passed this vacuously.
   *
   * The 936 px never depended on the viewport, which is why it was identical at 800x1280, 768x1024 and
   * 810x1080: `.p-year-row span { min-width: 130px }` is a floor a flex item cannot shrink below, so the
   * card's min-content width was 300 px, and a `1fr` grid track is `minmax(auto, 1fr)` — it never goes
   * under min-content. `repeat(3, 1fr)` therefore came out 3x300 px at every width.
   */
  test('the grown-ups dashboard fits across (#109)', async ({ page }) => {
    await seedProgress(page);
    await openDashboard(page);
    await expectFitsViewport(page, 'grown-ups dashboard');
  });

  /**
   * The other two portrait-tablet geometries the issue names (#109). They are one test rather than two
   * projects on purpose: a project costs a whole sequential leg of the nightly (see `playwright.config.ts`),
   * and `setViewportSize` costs a reload.
   */
  for (const [w, h] of [[768, 1024], [810, 1080]] as const)
    test(`the grown-ups dashboard fits a ${w}x${h} tablet (#109)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await seedProgress(page);
      await openDashboard(page);
      await expectFitsViewport(page, `grown-ups dashboard at ${w}x${h}`);
    });

  /**
   * The second half of #109 — "scrolling does not work well" — and the reason `touch-action: pan-y` is
   * *not* in the fix. A vertical drag can only be swallowed by a nested scroller that is actually
   * scrollable, and at tablet widths the modes table is not: it is narrower than its wrapper. Measured
   * rather than assumed, because that measurement is what decides whether the wrapper needs defending.
   */
  test('nothing nested scrolls sideways under the dashboard (#109)', async ({ page }) => {
    await seedProgress(page);
    await openDashboard(page);
    expect(await page.evaluate(() => Array.from(document.querySelectorAll('.parents *'))
      .filter(el => el.scrollWidth > el.clientWidth + 1)
      .map(el => `${el.className} ${el.scrollWidth}>${el.clientWidth}`)),
      'a horizontal scroller inside the dashboard can capture a vertical drag on a touch screen (#109)')
      .toEqual([]);
  });

  /**
   * #107, fixed: the five-frame now has one size, `--slot`, and the glyph is `calc(var(--slot) * 0.78)`.
   * This measures the two rendered boxes rather than reading the CSS, so it stays true whatever units a
   * later change lands on.
   *
   * One correction to what the `test.fixme` here used to say, because it would have sent the fix to the
   * wrong place: it recorded "the arithmetic alone does not produce a visible overflow at any viewport CI
   * can render, because `@media (max-height: 640px)` already pins both the slot and the font to 20 px".
   * The block pins the slot to 20 px, but it set the font **twice** — `16px`, then `20px` eight lines
   * later — so the effective pairing was a 20 px glyph in a 20 px box, and an emoji advances 1.248 em.
   * Measured at 844x390 before the fix: **4.97 px outside the slot** for a single group and **9.95 px**
   * for the two-group layout, which is half a slot and lands the glyph in its neighbour. That is the
   * spill the owner reported, it is pure arithmetic, and it reproduces in headless Chromium.
   */
  test('objects stay inside their five-frame slots (#107)', async ({ page }) => {
    await seedPlayer(page);
    await startTopic(page, 'reception', 'r-count');
    await expect(page.locator('.objs .slot .obj').first()).toBeVisible();
    expect(await outsideItsBox(page, '.objs .slot', '.obj'),
      'an object painted outside its five-frame slot (#107)').toEqual([]);
  });

  /**
   * The same containment in the band the bug was actually reported from (#107). `@media (max-height: 640px)`
   * is a separate set of rules, and it was the worst offender of the lot — a tablet held in landscape lands
   * here, so a check that only ever runs at 1280x800 would have left the real spill in place.
   */
  test('objects stay inside their slots on a short screen too (#107)', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await seedPlayer(page);
    await startTopic(page, 'reception', 'r-count');
    await expect(page.locator('.objs .slot .obj').first()).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.five')!).getPropertyValue('--slot').trim()),
      'the short-screen block must still set --slot, or this test is measuring the default (#107)').toBe('24px');
    expect(await outsideItsBox(page, '.objs .slot', '.obj'),
      'an object painted outside its five-frame slot on a short screen (#107)').toEqual([]);
  });

  /**
   * #18 slice 2, group A — the DOM-screen width cap, and the third of group A that carries no look decision.
   *
   * The slice-1 audit measured `.screen` capped at 820 px on a 1280 px landscape window: 460 px empty, 36 %
   * of the screen, on the map, the island, both onboarding steps, rewards, shop and the grown-ups dashboard.
   * Nothing overflowed — every #107/#109/#116 fit check passed at both sizes — so an overflow check could
   * never have caught this. What it costs is space, which is why the assertion below is a ratio.
   *
   * Both numbers are asserted on purpose. `> 820` is the defect itself, and would still pass if a later
   * change capped the column at 830; the ratio is the acceptance the owner wrote ("uses the width available
   * rather than a fixed column"). 0.9 is under both real readings — 1180/1280 = 0.92, 984/1024 = 0.96 —
   * so it leaves room for the gutter to be retuned without this file having to be edited to stay true.
   *
   * The arena (`--arena-w`, 600 px) and the tracing pad (`.trace-wrap`, 560 px) are group A's other two caps
   * and are NOT measured here: widening them changes the look, so they carry `owner-approval` and wait for
   * him. `.play` and `.memory` are excluded from the CSS rule for the same reason.
   */
  const OLD_CAP = 820;

  async function expectUsesTheWindow(page: Page, selector: string, what: string) {
    const seen = await page.evaluate(sel => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(sel));
      if (els.length !== 1) return { count: els.length, screen: 0, win: window.innerWidth };
      return { count: 1, screen: Math.round(els[0].getBoundingClientRect().width), win: window.innerWidth };
    }, selector);
    expect(seen.count, `${what}: expected exactly one ${selector} on screen, or this measures nothing`).toBe(1);
    expect(seen.screen, `${what}: still the ${OLD_CAP} px phone column (#18 group A)`).toBeGreaterThan(OLD_CAP);
    expect(seen.screen / seen.win,
      `${what}: ${seen.win - seen.screen} px of a ${seen.win} px window left empty (#18 group A)`)
      .toBeGreaterThanOrEqual(0.9);
  }

  for (const [w, h] of [[1280, 800], [1024, 768]] as const) {
    test(`onboarding uses a ${w}x${h} landscape window, not an 820 px column (#18)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/?reset=1');
      await expect(page.locator('.choose-ninja-screen')).toBeVisible();
      await expectUsesTheWindow(page, '.choose-ninja-screen', 'choose-ninja step');
      await page.click('.avatar-card[data-id="volt"]');
      await page.click('#next');
      await expect(page.locator('#name')).toBeVisible();
      await expectUsesTheWindow(page, '.name-screen', 'name step');
    });

    test(`the map, island, rewards, shop and dashboard use a ${w}x${h} landscape window (#18)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await seedProgress(page);                        // seeded: the widest strings these screens can draw
      await expectUsesTheWindow(page, '.map', 'sky map');

      await page.click('.island[data-year="reception"]');
      await expect(page.locator('.island-screen')).toBeVisible();
      await expectUsesTheWindow(page, '.island-screen', 'island screen');
      await expectFitsViewport(page, `island screen at ${w}x${h}`);   // widening must not start an overflow

      // Back through the app's own router rather than `goto('/')`: a reload keeps `history.state`, and the
      // screen it restores is not reliably the map (this landed on rewards, seen once in this file's own run).
      await page.click('#back');
      await expect(page.locator('.map')).toBeVisible();
      await page.click('#rewards');
      await expect(page.locator('.rewards')).toBeVisible();
      await expectUsesTheWindow(page, '.rewards', 'rewards screen');

      await page.click('#shop');
      await expect(page.locator('.shop')).toBeVisible();
      await expectUsesTheWindow(page, '.shop', 'shop screen');
      await expectFitsViewport(page, `shop screen at ${w}x${h}`);

      await page.click('#back');                       // shop → rewards
      await expect(page.locator('.rewards')).toBeVisible();
      await page.click('#back');                       // rewards → map
      await expect(page.locator('.map')).toBeVisible();
      await openDashboard(page);
      await expectUsesTheWindow(page, '.parents.dash', 'grown-ups dashboard');
      await expectFitsViewport(page, `grown-ups dashboard at ${w}x${h}`);
    });
  }

  /**
   * #18 slice 2, group A — the tracing pad, group A's second look-changing cap. The arena and the tracing
   * pad each carry their own, independent rule (`.play:not(.tracing):not(.duel-screen) { --arena-w }` vs.
   * `.play.tracing .hud, .play.tracing .trace-wrap`), so the cross-navigation check below now confirms the
   * arena has ALSO widened (group A's third cap, landed after this test was first written) rather than
   * that it stayed at the old 600 px — what it still proves is that the two mechanisms are independent:
   * a revert of one cannot silently take the other with it.
   *
   * #534 review (pr-test-analyzer): a bare `> 560` bound here (and in the matching guard rail) stayed green
   * against a hand-edit of the shipped CSS down to `min(600px, ...)` — barely more than the old phone column
   * and nowhere near what the fix actually ships. `.trace-wrap`'s rendered width is 816px, not the 880px the
   * CSS source names, because it sits inside `.hud`'s own `min(880px, 100% - 40px)` and then applies its own
   * `100% - 40px` branch against that already-narrower container (measured directly, both viewports below).
   * `TRACE_TARGET`/`TRACE_TOLERANCE` pin that rendered value rather than merely ruling out the old one.
   *
   * `#arena` carries no such nesting — `max-width: min(880px, 100% - 40px)` applies directly, with nothing
   * else narrowing it, so it lands on exactly 880px at both viewports (measured directly). `ARENA_TOLERANCE`
   * is 3px, not `TRACE_TOLERANCE`'s 30: a wider band here would still pass a regression that shaved off up
   * to 19px — a stray margin, an extra inset — with no nested calculation to blame it on the way the tracing
   * pad's own comment can.
   */
  const TRACE_TARGET = 816, TRACE_TOLERANCE = 30;
  const ARENA_TARGET = 880, ARENA_TOLERANCE = 3;

  for (const [w, h] of [[1280, 800], [1024, 768]] as const) {
    test(`the tracing pad uses a ${w}x${h} landscape window, not a 560 px column (#18 group A)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await seedPlayer(page);
      await startTopic(page, 'reception', 'r-trace', 'writing');
      await expect(page.locator('.trace-wrap')).toBeVisible();
      const wrap = await page.locator('.trace-wrap').boundingBox();
      expect(wrap!.width, `.trace-wrap at ${w}x${h}: should be close to ${TRACE_TARGET}px, not the 560px phone column or some other regressed value (#18 group A)`)
        .toBeGreaterThanOrEqual(TRACE_TARGET - TRACE_TOLERANCE);
      expect(wrap!.width, `.trace-wrap at ${w}x${h}: should be close to ${TRACE_TARGET}px, not wider than intended (#18 group A)`)
        .toBeLessThanOrEqual(TRACE_TARGET + TRACE_TOLERANCE);
      await expectFitsViewport(page, `tracing screen at ${w}x${h}`);   // widening must not start an overflow

      // the bubble arena is a different screen, widened by its own independent rule (#18 group A's third
      // cap) — this checks the two mechanisms don't depend on each other, not that either is disabled.
      // `up` (play.ts's goHome) pops history back to the island rather than the map, since the island push is
      // still on the stack from startTopic's own navigation.
      await page.click('#pause');
      await page.click('#quit');
      await expect(page.locator('.island-screen')).toBeVisible();
      await page.click('.tab[data-s="maths"]');
      await page.click('.topic[data-id="r-count"]');
      await expect(page.locator('.play')).toBeVisible();
      const arena = await page.locator('#arena').boundingBox();
      expect(arena!.width, `#arena at ${w}x${h}: should be close to ${ARENA_TARGET}px too, independently of the tracing-pad fix (#18 group A)`)
        .toBeGreaterThanOrEqual(ARENA_TARGET - ARENA_TOLERANCE);
      expect(arena!.width, `#arena at ${w}x${h}: should be close to ${ARENA_TARGET}px, not wider than intended (#18 group A)`)
        .toBeLessThanOrEqual(ARENA_TARGET + ARENA_TOLERANCE);
    });
  }

  /**
   * #18 slice 2, group A — the bubble arena, group A's last and sharpest cap (owner's 11:54Z pick: 680 px
   * empty at 1280×800, "the screen the child plays on"). `#arena` and `.hud` both read `max-width:
   * var(--arena-w)` with no further nesting, so — unlike the tracing pad's `.trace-wrap`, which sits a
   * layer inside `.hud` — the rendered width should land on the 880 px the CSS source names, not some
   * smaller value a nested container would produce. `ARENA_TARGET`/`ARENA_TOLERANCE` (declared above, by
   * the tracing pad's own test) pin that, the same shape #534's review asked for on the tracing pad: a
   * bound that only rules out the old 600 px would still pass a hand-edit down to, say, 620 px.
   */
  for (const [w, h] of [[1280, 800], [1024, 768]] as const) {
    test(`the bubble arena uses a ${w}x${h} landscape window, not a 600 px column (#18 group A)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await seedPlayer(page);
      await startTopic(page, 'reception', 'r-count');
      const arena = await page.locator('#arena').boundingBox();
      expect(arena!.width, `#arena at ${w}x${h}: should be close to ${ARENA_TARGET}px, not the 600px phone column or some other regressed value (#18 group A)`)
        .toBeGreaterThanOrEqual(ARENA_TARGET - ARENA_TOLERANCE);
      expect(arena!.width, `#arena at ${w}x${h}: should be close to ${ARENA_TARGET}px, not wider than intended (#18 group A)`)
        .toBeLessThanOrEqual(ARENA_TARGET + ARENA_TOLERANCE);
      await expectFitsViewport(page, `play screen at ${w}x${h}`);   // widening must not start an overflow

      // the tracing pad is a different screen and keeps its own cap, set directly rather than through
      // --arena-w (#18 group A's tracing-pad fix) — this pull request never touches it.
      await page.click('#pause');
      await page.click('#quit');
      await expect(page.locator('.island-screen')).toBeVisible();
      await page.click('.tab[data-s="writing"]');
      await page.click('.topic[data-id="r-trace"]');
      await expect(page.locator('.trace-wrap')).toBeVisible();
      const wrap = await page.locator('.trace-wrap').boundingBox();
      expect(wrap!.width, `.trace-wrap at ${w}x${h}: must stay at its own 816px, untouched by the arena fix (#18 group A) — a specificity fight between the two rules could shrink it as easily as leave it too wide`)
        .toBeGreaterThanOrEqual(TRACE_TARGET - TRACE_TOLERANCE);
      expect(wrap!.width, `.trace-wrap at ${w}x${h}: must stay at its own 880px cap, untouched by the arena fix (#18 group A)`)
        .toBeLessThanOrEqual(TRACE_TARGET + TRACE_TOLERANCE);
    });
  }

  /**
   * #18 slice 2, group C — the three defects the owner's 11:54Z pick said carry no look decision: two tap
   * targets, five long lines, and one nested scroller. None of these wait on group A/B, and none is gated to
   * a landscape viewport — `#grownups.foot-link` was already fixed in flight by PR #380 before the picks
   * landed (`min-height: 44px`, unrelated to this issue), so only `#speak` is measured here.
   */
  for (const [w, h] of [[1280, 800], [1024, 768]] as const) {
    test(`the read-aloud button meets the 44px floor at ${w}x${h} (#18 group C)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await seedPlayer(page);
      await startTopic(page, 'reception', 'r-count');
      const play = await page.locator('#speak').boundingBox();
      expect(play?.width, '#speak on the play screen (#18 group C)').toBeGreaterThanOrEqual(44);
      expect(play?.height, '#speak on the play screen (#18 group C)').toBeGreaterThanOrEqual(44);
    });

    test(`long informational lines wrap under a readable width at ${w}x${h} (#18 group C)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await seedProgress(page);
      await page.click('#rewards');
      await expect(page.locator('.rewards')).toBeVisible();
      // the "rest of the album" copy is the long one (81 chars); seeded progress has no stickers yet.
      const sticker = await page.locator('.next-sticker').boundingBox();
      expect(sticker!.width, `.next-sticker at ${w}x${h} (#18 group C)`).toBeLessThan(700);
      const certEmpty = await page.locator('.cert-empty').boundingBox();
      expect(certEmpty!.width, `.cert-empty at ${w}x${h} (#18 group C)`).toBeLessThan(700);
      const duelEmpty = await page.locator('.duel-empty').boundingBox();
      expect(duelEmpty!.width, `.duel-empty at ${w}x${h} (#18 group C)`).toBeLessThan(700);

      await page.click('#back');
      await expect(page.locator('.map')).toBeVisible();
      await openDashboard(page);
      const note = await page.locator('.p-note').first().boundingBox();
      expect(note!.width, `.p-note at ${w}x${h} (#18 group C)`).toBeLessThan(700);
      const resetSay = await page.locator('.p-reset-say').boundingBox();
      expect(resetSay!.width, `.p-reset-say at ${w}x${h} (#18 group C)`).toBeLessThan(700);
    });

    test(`the save code does not nest a scroller inside the dashboard's own scroll at ${w}x${h} (#18 group C)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await seedProgress(page);
      await openDashboard(page);
      const overflow = await page.locator('#save-code').evaluate(el => (el as HTMLTextAreaElement).scrollHeight - (el as HTMLTextAreaElement).clientHeight);
      expect(overflow, `#save-code scrolls internally on top of the dashboard's own scroll at ${w}x${h} (#18 group C)`).toBeLessThanOrEqual(0);
    });
  }

  /**
   * #564 (#18 group B): rewards and shop, measured on a seeded save with progress, stickers, certificates
   * and duels — not a fresh one, which is the narrowest either screen ever is and would pass this
   * vacuously (#109's own reasoning for `seedProgress`, above). The per-element breakdown on the issue
   * found a fresh-save read of 1040px for rewards was an empty-state artefact; this is the re-measure it
   * asked for. `cert`/`match` mirror `game.spec.ts`'s own row shapes rather than inventing new ones.
   */
  async function seedRewardsData(page: Page) {
    // Typed against the real StoredCert/StoredDuel shapes (type-design-analyzer, #564 review) — a future
    // required field would otherwise go uncaught here exactly as it already does in game.spec.ts's own
    // untyped builders of the same shape.
    const cert = (id: string, title: string, year: string, date: string): StoredCert =>
      ({ id, name: 'Ada', avatar: 'volt', year, title, stars: 3, score: 250, correct: 20, attempts: 20, date });
    const match = (at: number, extra: Partial<StoredDuel> = {}): StoredDuel =>
      ({ at, topic: 'y1-bonds', title: 'Number bonds', year: 'Year 1', winner: 'a', scoreA: 6, scoreB: 4, rounds: 10, ...extra });
    await page.addInitScript(save => {
      if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save);
    }, JSON.stringify({
      v: 1, name: 'Ada', avatar: 'volt',
      coins: 1250, streak: { last: '', days: 12 },
      stickers: [...AVATARS.slice(0, 5).map(a => a.id), VILLAIN.id],
      certs: [
        cert('reception:r-count', 'Counting to 10', 'Reception', '2026-09-10'),
        cert('year1:y1-bonds', 'Number bonds to 20', 'Year 1', '2026-09-12'),
        cert('year2:y2-tables', 'Times tables', 'Year 2', '2026-09-15'),
      ],
      duels: [
        match(1_757_100_000_000, { topic: 'y1-days', title: 'Days of the week', winner: 'b', scoreA: 3, scoreB: 7 }),
        match(1_757_000_000_000),
        match(1_756_900_000_000, { topic: 'y2-tables', title: 'Times tables', winner: 'a', scoreA: 9, scoreB: 5 }),
      ],
    }));
    await page.goto('/');
    await expect(page.locator('.home')).toBeVisible();
  }

  const REWARDS_TOLERANCE = 20;
  // Real, measured with "My certificates" and "Recent duels" now side by side at ≥900px (`.rewards-cols`,
  // #564's own open question, same `display: contents` → grid pattern as `.mode-grid`, #563's precedent):
  // 1159px at 1280x800, 1202px at 1024x768 — down from the stacked 1475/1518px this replaces, but still past
  // one viewport at both sizes. The remainder is the stats tiles + next-sticker banner + sticker album above
  // the two-column split, none of which this slice touches (the album's own grid already reflows by content,
  // not by a stacking bug the way the shop's does — see SHOP_CASES below). Pinned directly, not as a
  // "less than the old value" bound, for the same reason #563's island target is.
  const REWARDS_CASES = [
    { w: 1280, h: 800, target: 1159 },
    { w: 1024, h: 768, target: 1202 },
  ] as const;

  for (const { w, h, target } of REWARDS_CASES) {
    test(`the rewards screen's content height is pinned at ${w}x${h}, on a seeded save (#564)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await seedRewardsData(page);
      await page.click('#rewards');
      await expect(page.locator('.rewards')).toBeVisible();
      await expect(page.locator('.cert-row')).toHaveCount(6);   // 3 certs + 3 duels (both share .cert-row)
      const grid = await page.locator('.rewards-cols').evaluate(el => getComputedStyle(el).display);
      expect(grid, `.rewards-cols at ${w}x${h}: must be a grid at the ≥900px breakpoint (#564)`).toBe('grid');
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(total, `rewards content height at ${w}x${h}: expected close to ${target}px (#564)`)
        .toBeGreaterThanOrEqual(target - REWARDS_TOLERANCE);
      expect(total, `rewards content height at ${w}x${h}: expected close to ${target}px (#564)`)
        .toBeLessThanOrEqual(target + REWARDS_TOLERANCE);
    });
  }

  /**
   * The other half of the acceptance criterion, same as `.mode-grid`'s #563 precedent: a phone stays a
   * single-column stack. `display: contents` on `.rewards-cols` should make the wrapper invisible to layout
   * below 900px, so this is the only place that is proven rather than assumed from the CSS rule alone
   * (pr-test-analyzer, #563 review, same reasoning applied here).
   */
  test("the rewards screen's certificates and duels stay a single-column stack below the 900px breakpoint, on a phone (#564)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedRewardsData(page);
    await page.click('#rewards');
    await expect(page.locator('.rewards')).toBeVisible();

    const display = await page.locator('.rewards-cols').evaluate(el => getComputedStyle(el).display);
    expect(display, '.rewards-cols on a phone: must stay `contents`, not switch to the ≥900px grid (#564)').toBe('contents');
  });

  const SHOP_TOLERANCE = 20;
  // Real, measured: 1130px at 1280x800, 1145px at 1024x768 — matches the issue's own audit. `.shop-grid`
  // already reflows (`repeat(auto-fill, minmax(140px, 1fr))`); the remainder is the Slice trails grid's real
  // item count needing two rows, which is content rather than a stacking bug, so there is nothing group-B
  // shaped to fix here.
  const SHOP_CASES = [
    { w: 1280, h: 800, target: 1130 },
    { w: 1024, h: 768, target: 1145 },
  ] as const;

  for (const { w, h, target } of SHOP_CASES) {
    test(`the shop screen's content height is pinned at ${w}x${h} (#564)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await seedPlayer(page);
      await page.click('#rewards');
      await expect(page.locator('.rewards')).toBeVisible();
      await page.click('#shop');
      await expect(page.locator('.shop')).toBeVisible();
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(total, `shop content height at ${w}x${h}: expected close to ${target}px (#564) — the 12-item trail grid needing two rows, content rather than a stacking bug`)
        .toBeGreaterThanOrEqual(target - SHOP_TOLERANCE);
      expect(total, `shop content height at ${w}x${h}: expected close to ${target}px (#564)`)
        .toBeLessThanOrEqual(target + SHOP_TOLERANCE);
    });
  }
});

/**
 * #399's own item 4: a real inset, injected via CDP (`overrideSafeAreaInsets`), read back as real computed
 * padding — not the text-only grep the `tests/unit/guardrails.test.ts` rails already run at pull-request
 * time (`env()` has no notch to resolve under either project, which is why those rails exist at all). This
 * covers all four sites the issue's own sweep named: `.hud` (PR #530), the landscape duel screen (PR #542),
 * `.villain` (PR #551) and `.cert-view` below. An earlier slice assumed `.cert-view` "needs a full mission
 * played to completion" and left it uncovered on that basis — it does not: `game.spec.ts`'s own "My
 * certificates" test already reaches it cheaply via a seeded `certs` row on the rewards album, which is the
 * path used here too.
 *
 * Each test uses its own distinct inset value per side, on purpose: a transposed pair (top swapped for
 * left, `--sar` read where `--sal` was meant) would still pass a same-value check.
 */
test.describe('a real safe-area inset becomes real padding, not just a declared calc() (#399)', () => {
  test('.hud pads by the real --sat/--sar/--sal values, not the env() fallback', async ({ page }) => {
    await overrideSafeAreaInsets(page, { top: 30, right: 40, bottom: 20, left: 50 });
    await seedPlayer(page);
    await startTopic(page, 'reception', 'r-count');
    const hud = await page.locator('.hud').evaluate(el => {
      const s = getComputedStyle(el);
      return { top: s.paddingTop, right: s.paddingRight, bottom: s.paddingBottom, left: s.paddingLeft };
    });
    // src/style.css: `padding: calc(10px + var(--sat)) calc(12px + var(--sar)) 0 calc(12px + var(--sal))`
    expect(hud, '.hud padding must reach the CDP-overridden insets, not the env() fallback of 0').toEqual({
      top: '40px', right: '52px', bottom: '0px', left: '62px',
    });
  });

  test('the landscape duel screen insets the arena PAIR by the real --sal/--sar values', async ({ page }) => {
    await overrideSafeAreaInsets(page, { left: 55, right: 35 });
    await page.setViewportSize({ width: 1280, height: 800 });   // orientation: landscape gates this rule
    await startDuel(page);
    const pad = await page.locator('.play.duel-screen').evaluate(el => {
      const s = getComputedStyle(el);
      return { left: s.paddingLeft, right: s.paddingRight };
    });
    // src/style.css: `.play.duel-screen { padding-left: var(--sal); padding-right: var(--sar) }`
    expect(pad, '.play.duel-screen padding must reach the CDP-overridden insets').toEqual({ left: '55px', right: '35px' });
  });

  test('.villain reads the real --sar on its right offset, same as its already-correct --sab on bottom', async ({ page }) => {
    await overrideSafeAreaInsets(page, { right: 45, bottom: 25 });
    await seedPlayer(page, 'blaze', 'Ivy');
    await page.click('.island[data-year="year2"]');
    await page.click('#endless');
    await expect(page.locator('.villain img')).toBeVisible();
    const pos = await page.locator('.villain').evaluate(el => {
      const s = getComputedStyle(el);
      return { right: s.right, bottom: s.bottom };
    });
    // src/style.css: `.villain { right: calc(10px + var(--sar)); bottom: calc(12px + var(--sab)) }`
    expect(pos, '.villain must reach the CDP-overridden --sar/--sab, not the env() fallback').toEqual({ right: '55px', bottom: '37px' });
  });

  test('.cert-view pads by the real --sar/--sab/--sal values; top has no --sat and stays a flat 16px', async ({ page }) => {
    await overrideSafeAreaInsets(page, { top: 60, right: 25, bottom: 45, left: 15 });
    const cert = { id: 'reception:r-count', name: 'Ada', avatar: 'volt', year: 'Reception', title: 'Counting to 10', stars: 3, score: 250, correct: 20, attempts: 20, date: '2026-09-10' };
    await seedPlayer(page, 'volt', 'Ada', { certs: [cert] });
    await page.click('#rewards');
    await expect(page.locator('.rewards')).toBeVisible();
    await page.click('.cert-open');
    const view = page.locator('.cert-view');
    await expect(view).toBeVisible();
    const pad = await view.evaluate(el => {
      const s = getComputedStyle(el);
      return { top: s.paddingTop, right: s.paddingRight, bottom: s.paddingBottom, left: s.paddingLeft };
    });
    // src/style.css: `.cert-view { padding: 16px calc(16px + var(--sar, 0px)) calc(16px + var(--sab, 0px)) calc(16px + var(--sal, 0px)) }`
    expect(pad, '.cert-view padding must reach the CDP-overridden --sar/--sab/--sal; top is a fixed 16px, not --sat').toEqual({
      top: '16px', right: '41px', bottom: '61px', left: '31px',
    });
  });
});
