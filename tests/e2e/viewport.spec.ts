import { test, expect, type Page } from '@playwright/test';
import { expectFitsViewport, outsideItsBox } from './viewport';

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

/** Land on the sky map with the avatar already chosen, exactly as `game.spec.ts` does (#138). */
async function seedPlayer(page: Page, id = 'volt', name = 'Ada') {
  await page.addInitScript(save => {
    if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save);
  }, JSON.stringify({ v: 1, name, avatar: id }));
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

test.describe('tablet viewports (#116)', () => {
  test('the avatar screen fits across', async ({ page }) => {
    await page.goto('/?reset=1');
    await expect(page.locator('.avatar-screen')).toBeVisible();
    await expectFitsViewport(page, 'avatar screen');
    /*
     * #110's vertical half, and an honest note about where it bites. Measured on `main` before the fix, the
     * field sat at y=906 in an 844 px phone — off screen — but at y=582 on an 800x1280 tablet and y=571 at
     * 768x1024, which is low but *on* screen. So "below the fold" is the phone's failure, and an
     * in-viewport assertion here would have passed before the fix: it is kept because a tablet grid gains
     * rows as cards or avatars are added, and paired with the ordering check, which is the thing that
     * cannot pass vacuously at any viewport. The phone's own version lives in `game.spec.ts`.
     */
    await expect(page.locator('.avatar-card')).toHaveCount(11);
    expect(await page.evaluate(() => window.scrollY), 'the screen must not have scrolled yet').toBe(0);
    await expect(page.locator('#name'), '#110: the name field is below the fold on a tablet').toBeInViewport({ ratio: 1 });
    const [nameBottom, gridTop] = await page.evaluate(() => [
      document.querySelector('#name')!.getBoundingClientRect().bottom,
      document.querySelector('.avatar-grid')!.getBoundingClientRect().top,
    ]);
    expect(nameBottom, '#110: the name field must be above the avatar grid, not after all eleven cards')
      .toBeLessThanOrEqual(gridTop);
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
});
