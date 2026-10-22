// #2196: a game the catalogue hides leaves the island, its choosers, its rows and the map's star total, and the
// island's other games still play. The catalogue is bundled, so this test serves the built game with two nodes of
// it switched off — `y4-tables` globally, `y4-pronouns` for Year 4 — exactly as an edited `catalogue.json` would.
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { TOPICS } from '../../src/curriculum';

const OFF: [string, RegExp, string][] = [
  ['y4-tables', /"y4-tables":\{"visible":true/g, '"y4-tables":{"visible":false'],
  ['y4-pronouns', /("y4-pronouns":\{"visible":true,"settings":\{\},"groupSettings":\{\},"years":\{"year4":\{"visible":)true/g, '$1false'],
];
const y1Writing = TOPICS.filter(t => t.year === 'year1' && t.subject === 'writing' && !t.drill).map(t => t.id);
const y1Maths = TOPICS.filter(t => t.year === 'year1' && t.subject === 'maths' && !t.drill).map(t => t.id);
const core = (subject: 'maths' | 'writing') => TOPICS.filter(t => t.year === 'year4' && t.subject === subject && !t.drill);

/** Serve the game's entry chunk with each `OFF` node switched off; fail loudly unless each matched exactly once. */
const hideGames = (page: Page, off = OFF) => page.route(/\/assets\/index-[^/]*\.js$/, async route => {
  const res = await route.fetch();
  let body = await res.text();
  for (const [id, re, to] of off) {
    const n = body.match(re)?.length ?? 0;
    if (n !== 1) throw new Error(`hidden-games e2e: ${id}'s catalogue node matched ${n} times in the bundle, not once — the bundle's shape changed`);
    body = body.replace(re, to);
  }
  await route.fulfill({ response: res, body });
});

test.use({ serviceWorkers: 'block' });   // the entry chunk comes from the network, through the route, never a worker cache

test.describe('hidden games (#2196)', () => {
  test('a hidden maths game and a hidden writing game leave Year 4; the rest still play', async ({ page }) => {
    await hideGames(page);
    await page.addInitScript(save => { if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save); },
      JSON.stringify({ v: 1, name: 'Ada', avatar: 'volt', onboarded: true, progress: { 'r-count': { stars: 1 } } }));
    await page.goto('/');
    const shownCount = core('maths').length + core('writing').length - 2;
    await expect(page.locator('.island[data-year="year4"] .isl-stars')).toHaveText(`★ 0/${shownCount * 3}`);

    await page.click('.island[data-year="year4"]');
    await expect(page.locator('.island-screen')).toBeVisible();
    await expect(page.locator('.topic[data-id="y4-tables"]')).toHaveCount(0);
    await expect(page.locator('#topics .topic')).toHaveCount(core('maths').length - 1);
    await expect(page.locator('#mtc, #mtcpad')).toHaveCount(0);   // Tables Check is dealt under y4-tables
    await page.click('#sprint');
    await expect(page.locator('#island-overlay .topic[data-id]').first()).toBeVisible();
    await expect(page.locator('#island-overlay .topic[data-id="y4-tables"]')).toHaveCount(0);
    await page.click('#chooser-back');

    await page.click('.tab[data-s="writing"]');
    await expect(page.locator('#topics .topic')).toHaveCount(core('writing').length - 1);
    await expect(page.locator('.topic[data-id="y4-pronouns"]')).toHaveCount(0);

    const next = core('maths').find(t => t.id !== 'y4-tables' && !t.input)!;
    await page.click('.tab[data-s="maths"]');
    await page.click(`.topic[data-id="${next.id}"]`);
    await expect(page.locator('.play')).toBeVisible();
    await page.waitForFunction(() => window.__sna?.state().prompt);
    expect(await page.evaluate(() => { const s = window.__sna.session; while (!s.ended) s.nextStage(); return s.ended; })).toBe(true);
    await expect(page.locator('.results')).toBeVisible();
  });

  test('a deep link to a hidden game lands on its island with the notice (#2197)', async ({ page }) => {
    await hideGames(page);
    await page.addInitScript(save => { if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save); },
      JSON.stringify({ v: 1, name: 'Ada', avatar: 'volt', onboarded: true, progress: { 'r-count': { stars: 1 } } }));
    await page.goto('/?topic=y4-tables');
    await expect(page.locator('.island-screen')).toBeVisible();
    await expect(page.locator('#island-notice')).toHaveText('This game is switched off in the grown-ups settings.');
    await expect(page.locator('.play')).toHaveCount(0);
  });

  test('Year 1 with every writing game hidden draws no Writing tab, and Sprint stays maths (#2238)', async ({ page }) => {
    await hideGames(page, y1Writing.map(id => [id, new RegExp(`"${id}":\\{"visible":true`, 'g'), `"${id}":{"visible":false`]));
    await page.addInitScript(save => { if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save); },
      JSON.stringify({ v: 1, name: 'Ada', avatar: 'volt', onboarded: true, progress: { 'r-count': { stars: 1 } } }));
    await page.goto('/');
    await page.click('.island[data-year="year1"]');
    await expect(page.locator('.island-screen')).toBeVisible();
    await expect(page.locator('.tab')).toHaveCount(1);
    await expect(page.locator('.tab[data-s="maths"]')).toHaveClass(/on/);
    await expect(page.locator('#topics .topic').first()).toBeVisible();
  });

  test('Year 1 with every maths game hidden opens on Writing, and Sprint lists writing topics (#2238)', async ({ page }) => {
    await hideGames(page, y1Maths.map(id => [id, new RegExp(`"${id}":\\{"visible":true`, 'g'), `"${id}":{"visible":false`]));
    await page.addInitScript(save => { if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save); },
      JSON.stringify({ v: 1, name: 'Ada', avatar: 'volt', onboarded: true, progress: { 'r-count': { stars: 1 } } }));
    await page.goto('/');
    await page.click('.island[data-year="year1"]');
    await expect(page.locator('.island-screen')).toBeVisible();
    await expect(page.locator('.tab')).toHaveCount(1);
    await expect(page.locator('.tab[data-s="writing"]')).toHaveClass(/on/);
    await expect(page.locator('#topics .topic').first()).toBeVisible();
    await page.click('#sprint');
    const ids = await page.locator('#island-overlay .topic[data-id]').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.id));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter(id => y1Maths.includes(id!))).toEqual([]);
  });
});
