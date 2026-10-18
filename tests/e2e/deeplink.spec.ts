// #2027: a link opens a topic or an island once, after the profile exists, and Back never replays it.
// Real game speed: Back on a live mission opens Pause first (#887), a transient state a compressed clock would skip.
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const seed = (page: Page) => page.addInitScript(save => {
  window.__SNA_FAST = 1;
  if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save);
}, JSON.stringify({ v: 1, name: 'Ada', avatar: 'volt', onboarded: true, progress: { 'r-count': { stars: 1 } } }));

test.describe('deep links (#2027)', () => {
  test('?topic= opens that mission after the profile exists, and Back unwinds it without replaying', { tag: '@smoke' }, async ({ page }) => {
    await seed(page);
    await page.goto('/?topic=y1-bonds');
    await expect(page.locator('.play')).toBeVisible();
    await page.waitForFunction(() => window.__sna?.state().prompt);
    expect(new URL(page.url()).search).toBe('');   // the link left the address bar, so a reload cannot replay it either
    await page.goBack();   // #887: the first press pauses the live mission
    await page.goBack();
    await expect(page.locator('.island-screen')).toBeVisible();
    await page.goBack();
    await expect(page.locator('.home')).toBeVisible();
    await expect(page.locator('.play')).toHaveCount(0);
    await page.goBack().catch(() => {});   // one more press: nothing reopens the link
    await expect(page.locator('.play')).toHaveCount(0);
  });

  test('?topic=nope opens the home screen', async ({ page }) => {
    await seed(page);
    await page.goto('/?topic=nope');
    await expect(page.locator('.home')).toBeVisible();
    await expect(page.locator('.play, .island-screen')).toHaveCount(0);
  });

  test('?year= opens that island, and test switches still work beside a link', async ({ page }) => {
    await seed(page);
    await page.goto('/?year=year1&fast=8&three=off');
    await expect(page.locator('.island-screen')).toBeVisible();
    expect(new URL(page.url()).search).toBe('?fast=8&three=off');
    await page.goBack();
    await expect(page.locator('.home')).toBeVisible();
  });

  test('with no profile yet the link waits for onboarding, then opens once', async ({ page }) => {
    await page.goto('/?reset=1&topic=y1-bonds');
    await expect(page.locator('.avatar-screen')).toBeVisible();
    await page.click('.avatar-card[data-id="volt"]');
    await page.click('#next');
    await page.fill('#name', 'Ada');
    await page.click('#go');
    await page.click('#intro-skip');
    await expect(page.locator('.play')).toBeVisible();
    await page.waitForFunction(() => window.__sna?.state().prompt);
  });
});
