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

test.describe('Tables Check on the number pad (#1120)', () => {
  const start = async (page: Page) => { await open(page, 'year4'); await page.click('#mtcpad'); await expect(page.locator('#keypad')).toBeVisible(); };
  const card = (page: Page, n: number) => page.waitForFunction(k => { const s = window.__sna.state(); return s.ended || (window.__sna.session.questionsAsked === k && !s.waiting); }, n, { timeout: 30000 });

  test('the Year 4 menu offers it beside the bubble row', async ({ page }) => {
    await open(page, 'year3');
    await expect(page.locator('#mtcpad')).toHaveCount(0);
    await page.click('#back');
    await page.click('.island[data-year="year4"]');
    await expect(page.locator('#mtcpad')).toContainText('Tables Check on the number pad');
    await expect(page.locator('#mtc')).toContainText('Tables Check practice');
  });

  test('28 cards typed on the pad end on "25 out of 25", and the pad fits the phone', async ({ page }) => {
    await start(page);
    await page.evaluate(() => window.__sna.setSpeed(20));
    for (let i = 1; i <= 28; i++) {
      await card(page, i);
      if (i === 1) await expectFitsViewport(page, 'Tables Check pad card');
      while (!await page.evaluate(() => window.__sna.answer()) && !await page.evaluate(() => window.__sna.state().ended)) await page.waitForTimeout(50);
    }
    const results = page.locator('.results');
    await expect(results).toContainText('25 out of 25');
    await expect(results.locator('.stars')).toHaveCount(0);
    await expect(results).not.toContainText(/official|pass|fail/i);
    await page.click('#home');
    await expect(page.locator('#endless small')).toContainText('best 0');
  });

  test('right digits typed without Enter count as right when the clock runs out', async ({ page }) => {
    await start(page);
    await page.evaluate(() => window.__sna.setSpeed(20));
    for (let i = 1; i <= 3; i++) { await card(page, i); await page.evaluate(() => window.__sna.answer()); }
    await card(page, 4);
    const right = await page.evaluate(() => window.__sna.session.correct);
    await page.keyboard.type(await page.evaluate(() => window.__sna.state().answer as string));
    await page.waitForFunction(r => window.__sna.session.correct === r + 1, right, { timeout: 10000 });
  });

  test('the pause overlay freezes the 6 s clock on the pad', async ({ page }) => {
    test.setTimeout(60000);
    await start(page);
    for (let i = 1; i <= 3; i++) { await card(page, i); await page.evaluate(() => window.__sna.answer()); }
    await card(page, 4);
    await page.click('#pause');
    await page.waitForTimeout(7000);
    await page.click('#resume');
    expect(await page.evaluate(() => window.__sna.state().questionLeft)).toBeGreaterThan(0);
  });
});
