// #2200: the grown-ups' "Years and games" settings. A game switched off leaves its island, an island set to Hide
// leaves the map, the last island and a year's last game cannot be switched off, and Reset brings everything back.
// Every change is written to the child's own patch (`sna:catalogue:<profile>`, #2199) and read by the map on return.
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { TOPICS, YEARS } from '../../src/curriculum';
import { gateProduct } from './viewport';

const SAVE = JSON.stringify({ v: 1, name: 'Ada', avatar: 'volt', onboarded: true, progress: { 'r-count': { stars: 1 } } });
const PATCH_KEY = 'sna:catalogue:p1';
const core = (year: string) => TOPICS.filter(t => t.year === year && !t.drill);

async function seed(page: Page, patch?: object) {
  await page.addInitScript(([save, key, p]) => {
    if (localStorage.getItem('sna:v1')) return;   // once: a reload keeps what the test wrote
    localStorage.setItem('sna:v1', save);
    if (p) localStorage.setItem(key, p);
  }, [SAVE, PATCH_KEY, patch ? JSON.stringify(patch) : ''] as const);
  await page.goto('/');
  await expect(page.locator('.home')).toBeVisible();
}

async function openSettings(page: Page) {
  await page.click('#grownups');
  const q = await page.locator('#gate-q').textContent();
  await page.fill('#gate-input', String(gateProduct(q!)));
  await page.click('#gate-go');
  await expect(page.locator('#cat')).toBeVisible();
}

test.describe('Years and games settings (#2200)', () => {
  test('a game switched off leaves its island, and switched on comes back; each change is announced', async ({ page }) => {
    await seed(page);
    const game = core('year1').find(t => t.subject === 'maths')!;
    await page.click('.island[data-year="year1"]');
    await expect(page.locator(`.topic[data-id="${game.id}"]`)).toHaveCount(1);
    await page.click('#back');
    await openSettings(page);
    await page.selectOption('#cat-year', 'year1');
    const sw = page.locator(`button[role="switch"][data-game="${game.id}"]`);
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(sw).toHaveAccessibleName(game.title);
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await expect(sw).toBeFocused();   // the redraw puts focus back on the control that was used
    await expect(page.locator('#cat-msg')).toHaveText(`${game.title} is off for Year 1.`);
    await page.click('#back');
    await page.click('.island[data-year="year1"]');
    await expect(page.locator('#topics .topic').first()).toBeVisible();
    await expect(page.locator(`.topic[data-id="${game.id}"]`)).toHaveCount(0);
    // and back on: the switch undoes itself without a reset
    await page.click('#back');
    await openSettings(page);
    await page.selectOption('#cat-year', 'year1');
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#cat-msg')).toHaveText(`${game.title} is on for Year 1.`);
    await page.click('#back');
    await page.click('.island[data-year="year1"]');
    await expect(page.locator(`.topic[data-id="${game.id}"]`)).toHaveCount(1);
  });

  test('an island set to Hide leaves the map', async ({ page }) => {
    await seed(page);
    await expect(page.locator('.island[data-year="year2"]')).toHaveCount(1);
    await openSettings(page);
    await expect(page.locator('button[data-isl="year2"][data-v="auto"]')).toHaveText('Automatic (shown)');
    await page.click('button[data-isl="year2"][data-v="hide"]');
    await expect(page.locator('button[data-isl="year2"][data-v="hide"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#cat-msg')).toHaveText('Year 2: Hide. It is hidden from the map.');
    await page.click('#back');
    await expect(page.locator('.island[data-year="year1"]')).toHaveCount(1);
    await expect(page.locator('.island[data-year="year2"]')).toHaveCount(0);
  });

  test('the last island and a year\'s last game cannot be switched off, and say why', async ({ page }) => {
    const keep = core('reception')[0];
    const years = Object.fromEntries(YEARS.filter(y => y.id !== 'reception').map(y => [y.id, { visible: false }]));
    const games = Object.fromEntries(core('reception').filter(t => t.id !== keep.id).map(t => [t.id, { years: { reception: { visible: false } } }]));
    await seed(page, { version: 1, years, games });
    await expect(page.locator('.island')).toHaveCount(1);
    await openSettings(page);
    await expect(page.locator('#cat-year')).toHaveValue('reception');
    const hide = page.locator('button[data-isl="reception"][data-v="hide"]');
    await expect(hide).toBeDisabled();
    await expect(page.locator('#cat-isl-why-reception')).toHaveText('Reception is the only island left on the map, so it stays.');
    await expect(hide).toHaveAccessibleDescription('Reception is the only island left on the map, so it stays.');
    const last = page.locator(`button[data-game="${keep.id}"]`);
    await expect(last).toBeDisabled();
    await expect(last).toHaveAttribute('aria-checked', 'true');
    await expect(last).toHaveAccessibleDescription('This is the last Reception game switched on. To take Reception off the map, hide its island instead.');
    // A drill never keeps an island on the map, so it is never held on.
    for (const d of TOPICS.filter(t => t.year === 'reception' && t.drill)) await expect(page.locator(`button[data-game="${d.id}"]`)).toBeEnabled();
    // Showing a second island lifts the island guard.
    await page.click('button[data-isl="year1"][data-v="show"]');
    await expect(hide).toBeEnabled();
  });

  test('Reset asks first, then brings every island and game back', async ({ page }) => {
    const off = core('year1')[0];
    await seed(page, { version: 1, years: { year2: { visible: false } }, games: { [off.id]: { years: { year1: { visible: false } } } } });
    await expect(page.locator('.island[data-year="year2"]')).toHaveCount(0);
    await openSettings(page);
    await page.click('#cat-reset');
    await expect(page.locator('#reset-overlay .modal h2')).toHaveText('Reset years and games?');
    await page.click('#cat-cancel');
    await expect(page.locator('#reset-overlay')).toBeHidden();
    expect(await page.evaluate(k => localStorage.getItem(k), PATCH_KEY)).not.toBeNull();
    await page.click('#cat-reset');
    await page.click('#cat-go');
    await expect(page.locator('#cat-msg')).toHaveText('Years and games are back to how they started.');
    await expect(page.locator('button[data-isl="year2"][data-v="auto"]')).toHaveAttribute('aria-checked', 'true');
    expect(await page.evaluate(k => localStorage.getItem(k), PATCH_KEY)).toBeNull();
    await page.click('#back');
    await expect(page.locator('.island[data-year="year2"]')).toHaveCount(1);
    await page.click('.island[data-year="year1"]');
    await expect(page.locator(`.topic[data-id="${off.id}"]`)).toHaveCount(1);
  });
});
