// #1055: the school-year question on a brand-new child's map, and the grown-ups setting that changes it.
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { expectFitsViewport, gateProduct } from './viewport';

const seed = (page: Page, extra: Record<string, unknown> = {}) => page.addInitScript(save => {
  if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save);
}, JSON.stringify({ v: 1, name: 'Ada', avatar: 'volt', ...extra }));
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!));

test.describe('school year (#1055)', () => {
  test('a new child is asked once, and the tap stores ks2.schoolYear', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await expect(page.locator('.home .section-title')).toHaveText('Tap your school year');
    await expectFitsViewport(page, 'school-year map');
    await page.click('.island[data-year="year2"]');
    await expect(page.locator('.island-screen')).toBeVisible();
    const s = await stored(page);
    expect(s.ks2.schoolYear).toBe('year2');
    expect(s.year).toBe('year2');
    await page.click('#back');
    await expect(page.locator('.home .section-title')).toHaveText('Where will you train today?');
  });

  test('a child with progress is never asked', async ({ page }) => {
    await seed(page, { progress: { 'r-count': { stars: 1 } } });
    await page.goto('/');
    await expect(page.locator('.home .section-title')).toHaveText('Where will you train today?');
  });

  test('grown-ups set the year from a birthday, and the date is stored nowhere', async ({ page }) => {
    await seed(page, { onboarded: true });
    await page.goto('/');
    await page.click('#grownups');
    const q = await page.locator('#gate-q').textContent();
    await page.fill('#gate-input', String(gateProduct(q!)));
    await page.click('#gate-go');
    await expect(page.locator('.parents-dash')).toBeVisible();
    await page.fill('#school-birth', '2000-01-01');   // far outside Reception–Year 6: leaves the select alone
    await expect(page.locator('#school-year')).toHaveValue('');
    const year = new Date().getFullYear() - 7;
    await page.fill('#school-birth', `${year}-03-01`);
    await expect(page.locator('#school-year')).not.toHaveValue('');
    const s = await stored(page);
    expect(s.ks2.schoolYear).toBeTruthy();
    expect(JSON.stringify(await page.evaluate(() => ({ ...localStorage })))).not.toContain(`${year}-03-01`);
    await page.selectOption('#school-year', '');
    expect((await stored(page)).ks2.schoolYear).toBeUndefined();
  });
});
