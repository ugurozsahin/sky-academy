// #1233: Arithmetic practice — Year 6 only, ten paper-style questions on a 450 s clock, a recap of every miss, no records touched.
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

test.describe('Arithmetic practice (#1233)', () => {
  test('only the Year 6 island offers it, labelled in the style of Paper 1', async ({ page }) => {
    await open(page, 'year4');
    await expect(page.locator('#paper')).toHaveCount(0);
    await page.click('#back');
    await page.click('.island[data-year="year6"]');
    await expect(page.locator('#paper')).toContainText('Arithmetic practice');
    await expect(page.locator('#paper small')).toContainText('in the style of Paper 1');
  });

  test('ten questions, one missed: the recap gives its answer and the records stay put', async ({ page }) => {
    await open(page, 'year6');
    await page.click('#paper');
    await expect(page.locator('.play')).toBeVisible();
    await page.evaluate(() => window.__sna.setSpeed(20));
    let missed = '';
    for (let i = 1; i <= 10; i++) {
      await page.waitForFunction(n => { const s = window.__sna.state(); return s.ended || (window.__sna.session.questionsAsked === n && !s.waiting && window.__sna.bubbles().length > 0); }, i, { timeout: 30000 });
      if (i === 1) { await expectFitsViewport(page, 'Arithmetic practice card'); expect(await page.evaluate(() => window.__sna.session.secondsLeft)).toBeGreaterThan(440); }
      if (i === 2) {
        missed = await page.evaluate(() => window.__sna.session.current!.prompt);
        await page.evaluate(() => window.__sna.wrong());
        await page.waitForFunction(() => window.__sna.state().waiting);
        continue;
      }
      while (!await page.evaluate(() => window.__sna.answer()) && !await page.evaluate(() => window.__sna.state().ended)) await page.waitForTimeout(50);
    }
    const results = page.locator('.results');
    await expect(results).toBeVisible();
    await expect(results).toContainText('Practice paper done!');
    await expect(results).toContainText('Paper pace: 45 s a question');
    await expect(results.locator('.dojo-bonus', { hasText: missed })).toContainText('Answer:');
    await expectFitsViewport(page, 'Arithmetic practice results');
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!));
    expect(save.endless ?? {}).toEqual({}); expect(save.sprint ?? {}).toEqual({}); expect(save.boss ?? {}).toEqual({});
    await page.click('#home');
    await expect(page.locator('#endless small')).toContainText('best 0');
  });

  test('Play again deals a fresh paper of ten questions (#1233 review)', async ({ page }) => {
    await open(page, 'year6');
    await page.click('#paper');
    await page.evaluate(() => window.__sna.setSpeed(20));
    for (let i = 1; i <= 10; i++) {
      await page.waitForFunction(n => { const s = window.__sna.state(); return s.ended || (window.__sna.session.questionsAsked === n && !s.waiting && window.__sna.bubbles().length > 0); }, i, { timeout: 30000 });
      while (!await page.evaluate(() => window.__sna.answer()) && !await page.evaluate(() => window.__sna.state().ended)) await page.waitForTimeout(50);
    }
    await expect(page.locator('.results')).toBeVisible();
    await page.click('#again');
    await expect(page.locator('.play')).toBeVisible();
    await page.waitForFunction(() => window.__sna.session.current !== null);
    expect(await page.evaluate(() => window.__sna.session.o.deck?.length)).toBe(10);
    expect(await page.evaluate(() => window.__sna.session.o.mode)).toBe('paper');
  });
});
