import { test, expect } from '@playwright/test';
import { shoot } from '../../scripts/sketch-shot.mjs';

/**
 * #715: the sketchbook's tests, run as the `sketchbook` Playwright project against the same preview the game's
 * e2e uses (`dist/sketchbook/` is built by `npm run build`) and never as part of `mobile`, so the game's
 * pull-request leg does not pay for them. The first test IS the screenshot script (epic #713 decision 5).
 */
test('every object × variant × tier renders a non-blank frame into docs/sketchbook (#715)', async ({ page, baseURL }) => {
  const { shots, blank, inks } = await shoot({ page, base: baseURL! });
  expect(shots.length, 'the placeholder alone is 3 variants × 2 tiers').toBeGreaterThanOrEqual(6);
  expect(blank, 'a blank frame means the stage drew nothing — the rig, the material or the outline is broken').toEqual([]);
  // Bounded from above too: a frame that is ALL ink means the background read is wrong (the corner sat on the
  // object, or the background stopped being flat), and the blank check could then never fire again.
  const buffer = 512 * 2 * 512 * 2;   // the `?shot=1` canvas at deviceScaleFactor 2
  for (const [file, ink] of Object.entries(inks)) expect(ink, `${file}: ink pixels`).toBeLessThan(buffer * 0.5);
});

// The interactive page — what a session opens to do the look pass — is the branch `?shot=1` skips: the list,
// the lil-gui panel, and a deep link. Without this nothing exercises controls.ts at all (pr-test-analyzer).
test('the interactive page lists the objects, mounts the panel, honours a deep link and follows a pick', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/sketchbook/sketchbook.html?object=placeholder&variant=pebble&tier=low`);
  await page.waitForFunction(() => window.__sketch?.ready === true);
  const model = await page.evaluate(() => window.__sketch.model());
  expect(model, 'a deep link draws the variant it names, at the tier it names').toMatchObject({ object: 'placeholder', variant: 'pebble', tier: 'low', params: { size: 1.8, radius: 0.6 } });
  await expect(page.locator('.lil-gui.root'), 'one panel (folders carry the class too)').toHaveCount(1);
  const objects = await page.evaluate(() => window.__sketch.objects());
  await expect(page.locator('#list button')).toHaveCount(objects.length);
  await expect(page.locator('#list button.on')).toHaveText('placeholder');
  await page.locator('#list button').first().click();
  expect(await page.evaluate(() => window.__sketch.model()), 'a pick resets to the defaults').toMatchObject({ object: objects[0].name, variant: 'default' });
  // The panel's variant dropdown must still reach the handler after a rebuild (lil-gui's options() replaces
  // the controller): pick a variant through the same select lil-gui renders and watch the params follow.
  await page.locator('.lil-gui select').nth(1).selectOption('sharp');
  expect(await page.evaluate(() => window.__sketch.model())).toMatchObject({ variant: 'sharp', params: { size: 1.6, radius: 0.02 } });
  await page.goto(`${baseURL}/sketchbook/sketchbook.html?object=nope&variant=bogus&tier=x`);
  await page.waitForFunction(() => window.__sketch?.ready === true);
  expect(await page.evaluate(() => window.__sketch.model()), 'nonsense in the query falls to the defaults').toMatchObject({ object: 'placeholder', variant: 'default' });
});
