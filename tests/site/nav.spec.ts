import type { Page } from '@playwright/test';
import { test, expect } from '../e2e/fixtures';
import { serve } from '../../scripts/site-serve.mjs';

/**
 * #2174: the Curriculum menu once website/nav.js has run (the W3C APG disclosure navigation pattern). Opens with
 * the mouse and with Enter or Space; closes on Escape (focus back to the button), on a press outside and when Tab
 * or Shift+Tab leaves it; aria-expanded follows; the header keeps its height; nothing scrolls sideways; and the
 * open list never covers the element that has focus. At the site project's 360 px phone, and at 1280 px.
 * Without the script the <details> still opens: the last test.
 */
let site: { origin: string; close: () => Promise<void> };
test.beforeAll(async () => { site = await serve(); });
test.afterAll(async () => { await site?.close(); });

const button = (page: Page) => page.locator('.site-nav .nav-years > button');
const list = (page: Page) => page.locator('#nav-years-list');
const headerHeight = (page: Page) => page.locator('.site-header').evaluate(h => h.getBoundingClientRect().height);
const expanded = async (page: Page, open: boolean) => {
  await expect(button(page)).toHaveAttribute('aria-expanded', String(open));
  await (open ? expect(list(page)).toBeVisible() : expect(list(page)).toBeHidden());
};
/** The element at the centre of the focused one is that element (or inside it): nothing lies over it (2.4.11). */
const focusUncovered = (page: Page) => page.evaluate(() => {
  const el = document.activeElement as HTMLElement, r = el.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!top && (el === top || el.contains(top));
});

for (const width of [360, 1280]) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });
    test.beforeEach(async ({ page }) => {
      await page.goto(`${site.origin}/`);
      await expect(button(page)).toBeVisible();
    });

    test('the summary is a button that controls the list, closed, and hover does not open it', async ({ page }) => {
      await expect(page.locator('.site-nav details')).toHaveCount(0);
      await expect(button(page)).toHaveText('Curriculum');
      await expect(button(page)).toHaveAttribute('aria-controls', 'nav-years-list');
      await expanded(page, false);
      await button(page).hover();
      await expanded(page, false);
      await expect(list(page).locator('a')).toHaveText(['All years', 'Reception', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6']);
    });

    test('opens with the mouse over the page: same header height, no sideways scroll, 44 px targets; a press outside closes it', async ({ page }) => {
      const closed = await headerHeight(page);
      await button(page).click();
      await expanded(page, true);
      expect(await headerHeight(page), 'the open list must not push the header down').toBe(closed);
      const { scroll, view } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, view: document.documentElement.clientWidth }));
      expect(scroll, 'no sideways scroll with the list open').toBeLessThanOrEqual(view);
      const box = (await list(page).boundingBox())!;
      expect(box.x, 'inside the page').toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(view);
      for (const h of await list(page).locator('a').evaluateAll(as => as.map(a => a.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44);
      const b = (await button(page).boundingBox())!;
      expect(box.y, 'the list hangs below the button, never over it').toBeGreaterThanOrEqual(b.y + b.height);
      // A press on plain page, below the list, in the left gutter: nothing there to follow.
      const outside = { x: 4, y: box.y + box.height + 24 };
      expect(await page.evaluate(({ x, y }) => !document.elementFromPoint(x, y)?.closest('a, button, summary, header'), outside), 'a plain spot').toBe(true);
      await page.mouse.click(outside.x, outside.y);
      await expanded(page, false);
      // Safari and iOS give a pressed button no focus, so no focus leaves when the reader presses outside: the
      // press itself must close it. dispatchEvent clicks without focusing, as they do.
      await button(page).dispatchEvent('click');
      await expanded(page, true);
      await expect(button(page)).not.toBeFocused();
      await page.mouse.click(outside.x, outside.y);
      await expanded(page, false);
      await button(page).dispatchEvent('click');
      await page.touchscreen.tap(outside.x, outside.y);
      await expanded(page, false);
      await button(page).click();
      await button(page).click();
      await expanded(page, false);
    });

    test('Enter and Space toggle it, Escape closes it and puts focus back on the button', async ({ page }) => {
      await button(page).focus();
      await page.keyboard.press('Enter');
      await expanded(page, true);
      await page.keyboard.press('Space');
      await expanded(page, false);
      await page.keyboard.press('Space');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await expect(list(page).locator('a').nth(1)).toBeFocused();
      await page.keyboard.press('Escape');
      await expanded(page, false);
      await expect(button(page)).toBeFocused();
      // Escape while it is closed leaves focus where it is; Escape after a press that gave the button no focus
      // (Safari, iOS) still closes it and puts focus on the button.
      const features = page.locator('.site-nav a[href="/features/"]');
      await features.focus();
      await page.keyboard.press('Escape');
      await expect(features).toBeFocused();
      await button(page).dispatchEvent('click');
      await expanded(page, true);
      await page.keyboard.press('Escape');
      await expanded(page, false);
      await expect(button(page)).toBeFocused();
    });

    test('a page shown again from the back-forward cache shows it closed', async ({ page }) => {
      await button(page).click();
      await expanded(page, true);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      await expanded(page, false);
    });

    test('Tab walks the eight links uncovered and closes it on leaving; Shift+Tab out of the button closes it too', async ({ page }) => {
      await button(page).focus();
      await page.keyboard.press('Enter');
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Tab');
        await expect(list(page).locator('a').nth(i)).toBeFocused();
        expect(await focusUncovered(page), `link ${i + 1} is not covered`).toBe(true);
      }
      await page.keyboard.press('Tab');
      await expect(page.locator('.site-nav a[href="/features/"]')).toBeFocused();
      await expanded(page, false);
      expect(await focusUncovered(page), 'the next link is not covered').toBe(true);
      await button(page).focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Shift+Tab');
      await expect(page.locator('.site-nav a[href="/"]')).toBeFocused();
      await expanded(page, false);
    });
  });
}

test('on a year page the button reads as current and its own year is marked', async ({ page }) => {
  await page.goto(`${site.origin}/curriculum/year-2/`);
  await button(page).click();
  await expect(list(page).locator('[aria-current="page"]')).toHaveText('Year 2');
  await expect(button(page)).toHaveCSS('text-decoration-line', 'underline');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the <details> still opens the list', async ({ page }) => {
    await page.goto(`${site.origin}/`);
    const details = page.locator('.site-nav details.nav-years');
    await expect(details.locator('a').first()).toBeHidden();
    await details.locator('summary').click();
    await expect(details.locator('a')).toHaveCount(8);
    await expect(details.locator('a').first()).toBeVisible();
  });
});
