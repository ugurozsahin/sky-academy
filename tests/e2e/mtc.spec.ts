// #1118: Tables Check practice — Year 4 only, 3 practice + 25 check cards, "N out of 25", no records touched.
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { expectFitsViewport } from './viewport';

const open = async (page: Page, year: string) => {
  await page.addInitScript(save => {
    localStorage.setItem('sna:years', 'all');
    if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save);
  }, JSON.stringify({ v: 1, name: 'Ada', avatar: 'volt' }));
  await page.goto('/');
  await page.click(`.island[data-year="${year}"]`);
  await expect(page.locator('.island-screen')).toBeVisible();
};

test.describe('Tables Check practice (#1118)', () => {
  test('only the Year 4 island offers it', async ({ page }) => {
    await open(page, 'year3');
    await expect(page.locator('#mtc')).toHaveCount(0);
    await page.click('#back');
    await page.click('.island[data-year="year4"]');
    await expect(page.locator('#mtc')).toContainText('Tables Check practice');
    await expect(page.locator('#mtc small')).toContainText('25 questions · 6 seconds each');
  });

  test('28 cards answered by slicing end on "25 out of 25", with no stars and no Storm best', async ({ page }) => {
    await open(page, 'year4');
    await page.click('#mtc');
    await expect(page.locator('.play')).toBeVisible();
    await page.evaluate(() => window.__sna.setSpeed(20));
    for (let i = 1; i <= 28; i++) {
      await page.waitForFunction(n => { const s = window.__sna.state(); return s.ended || (window.__sna.session.questionsAsked === n && !s.waiting && window.__sna.bubbles().length > 0); }, i, { timeout: 30000 });
      if (i === 1) await expectFitsViewport(page, 'Tables Check card');
      while (!await page.evaluate(() => window.__sna.answer()) && !await page.evaluate(() => window.__sna.state().ended)) await page.waitForTimeout(50);
    }
    const results = page.locator('.results');
    await expect(results).toBeVisible();
    await expect(results).toContainText('Tables Check practice');
    await expect(results).toContainText('25 out of 25');
    await expect(results).toContainText('25/25');
    await expect(results.locator('.stars')).toHaveCount(0);
    await expect(results).not.toContainText(/official|pass|fail/i);
    await expectFitsViewport(page, 'Tables Check results');
    await page.click('#home');
    await expect(page.locator('#endless small')).toContainText('best 0');
  });
});
