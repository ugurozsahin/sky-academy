import type { Page } from '@playwright/test';
import { test, expect } from '../e2e/fixtures';
import { serve } from '../../scripts/site-serve.mjs';

/**
 * #2174: the Curriculum menu once website/nav.js has run (the W3C APG disclosure navigation pattern). Opens with
 * the mouse and with Enter or Space; closes on Escape (focus back to the button), on a press outside and when Tab
 * or Shift+Tab leaves it; aria-expanded follows; the header keeps its height; nothing scrolls sideways; and the
 * open list never covers the element that has focus. At the site project's 360 px phone, at 900 px (the breakpoint where the open panel changes shape, #2181), and at 1280 px.
 * Without the script the <details> still opens: the last test. #2178: the years in two key-stage lists.
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

for (const width of [360, 900, 1280]) {
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

    test('the years sit in two lists named by their labels: stacked at 360 px, side by side at 1280 px (#2178)', async ({ page }) => {
      await button(page).click();
      await expanded(page, true);
      const ks1 = list(page).getByRole('list', { name: 'Reception and Key Stage 1', exact: true });
      const ks2 = list(page).getByRole('list', { name: 'Key Stage 2', exact: true });
      await expect(ks1.getByRole('link')).toHaveText(['Reception', 'Year 1', 'Year 2']);
      await expect(ks2.getByRole('link')).toHaveText(['Year 3', 'Year 4', 'Year 5', 'Year 6']);
      for (const label of ['Reception and Key Stage 1', 'Key Stage 2']) await expect(list(page).getByText(label, { exact: true }), 'a visible label').toBeVisible();
      // Inside a group: two years to a row on a phone, one to a row from 900 px.
      const [y3, y4] = [(await ks2.getByRole('link').nth(0).boundingBox())!, (await ks2.getByRole('link').nth(1).boundingBox())!];
      if (width < 900) expect([y4.y, y4.x > y3.x], 'Year 4 beside Year 3').toEqual([y3.y, true]);
      else expect(y4.y, 'Year 4 under Year 3').toBeGreaterThanOrEqual(y3.y + y3.height);
      const all = (await list(page).getByRole('link', { name: 'All years' }).boundingBox())!;
      const [a, b] = [(await ks1.boundingBox())!, (await ks2.boundingBox())!];
      expect(a.y, 'All years sits above both groups').toBeGreaterThan(all.y + all.height - 1);
      if (width < 900) {
        expect(b.y, 'Key Stage 2 under Reception and Key Stage 1').toBeGreaterThanOrEqual(a.y + a.height);
        expect(b.x).toBe(a.x);
      } else {
        expect(b.y, 'side by side').toBe(a.y);
        expect(b.x, 'Key Stage 2 to the right').toBeGreaterThanOrEqual(a.x + a.width);
      }
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

    test('a page shown again from the back-forward cache shows it closed; the first load\'s pageshow does not', async ({ page }) => {
      await button(page).click();
      await expanded(page, true);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false })));
      await expanded(page, true);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      await expanded(page, false);
    });

    test('opened while pictures are still loading, it stays open when the page finishes loading (#2175 review)', async ({ page }) => {
      let release!: () => void;
      const held = new Promise<void>(r => { release = r; });
      await page.route('**/*.webp', async route => { await held; await route.continue(); });
      await page.goto(`${site.origin}/`, { waitUntil: 'domcontentloaded' });
      await button(page).click();
      await expanded(page, true);
      expect(await page.evaluate(() => document.readyState), 'the page is still loading when the menu opens').not.toBe('complete');
      const loaded = page.waitForFunction(() => document.readyState === 'complete');
      release();
      await loaded;
      await page.evaluate(() => new Promise(r => setTimeout(r, 50)));   // pageshow follows load in its own task
      await expanded(page, true);
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
    // #2178: the two named lists, their labels shown, each year under the one before.
    for (const label of ['Reception and Key Stage 1', 'Key Stage 2']) {
      await expect(details.getByText(label, { exact: true })).toBeVisible();
      await expect(details.getByRole('list', { name: label, exact: true })).toBeVisible();
    }
    const [r, y1] = [(await details.getByRole('link', { name: 'Reception' }).boundingBox())!, (await details.getByRole('link', { name: 'Year 1' }).boundingBox())!];
    expect(y1.y, 'Year 1 under Reception').toBeGreaterThanOrEqual(r.y + r.height);
  });
});

/**
 * #2170: opening the no-script list moves nothing else in the header. `contain: inline-size` on the list stops its
 * <li> widening (Features, Guides and About would slide sideways); `align-items: start` on the 900 px+ header row
 * stops the brand and Play now dropping down. Held as behaviour, at 360 px and 1280 px, on four pages.
 */
for (const width of [360, 1280]) {
  test.describe(`without JavaScript, at ${width} px`, () => {
    test.use({ javaScriptEnabled: false, viewport: { width, height: 800 } });
    for (const path of ['/', '/curriculum/', '/curriculum/year-3/', '/about/']) {
      test(`opening the Curriculum list moves no header element on ${path}`, async ({ page }) => {
        await page.goto(`${site.origin}${path}`);
        const boxes = () => page.evaluate(() => [...document.querySelectorAll('.site-header .brand, .site-header .site-nav > ul > li, .site-header .site-nav > ul > li > a, .site-header .btn')]
          .filter(el => !el.closest('.nav-years'))
          .map(el => { const r = el.getBoundingClientRect(); return [el.className || el.tagName, Math.round(r.x), Math.round(r.y), Math.round(r.width)]; }));   // not height: the Curriculum item's own <li> grows with its list
        const before = await boxes();
        expect(before.length, 'the header elements it measures').toBe(11);
        await page.locator('.site-nav details.nav-years > summary').click();
        await expect(page.locator('.site-nav details.nav-years a').first()).toBeVisible();
        expect(await boxes(), 'no brand, nav item or Play now moved').toEqual(before);
        const { scroll, view } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, view: document.documentElement.clientWidth }));
        expect(scroll, 'no sideways scroll').toBeLessThanOrEqual(view);
      });
    }
  });
}
