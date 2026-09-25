import { test, expect } from '@playwright/test';
import { shoot } from '../../scripts/sketch-shot.mjs';
import { TIERS } from '../../src/three/stage/tiers';

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
  // #717: `show()` sets the model behind the panel's back; the object field must follow, not keep naming the old one.
  const last = objects[objects.length - 1];
  await page.evaluate(([n]) => window.__sketch.show(n, 'default', 'high'), [last.name]);
  await expect(page.locator('.lil-gui select').first(), 'the panel names the object show() drew').toHaveValue(last.name);
  // A drag on the canvas turns the object. Under reduced motion the idle turn is off, so the frame holds still
  // until the drag — without that, any two screenshots differ and the check proves nothing.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseURL}/sketchbook/sketchbook.html?object=${last.name}`);
  await page.waitForFunction(() => window.__sketch?.ready === true);
  const canvas = page.locator('#stage canvas');
  const still = await canvas.screenshot();
  expect((await canvas.screenshot()).equals(still), 'reduced motion: no idle turn').toBe(true);
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 150, box.y + box.height / 2, { steps: 6 }); await page.mouse.up();
  expect((await canvas.screenshot()).equals(still), 'a drag turns what is drawn').toBe(false);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseURL}/sketchbook/sketchbook.html?object=nope&variant=bogus&tier=x`);
  await page.waitForFunction(() => window.__sketch?.ready === true);
  expect(await page.evaluate(() => window.__sketch.model()), 'nonsense in the query falls to the defaults').toMatchObject({ object: 'placeholder', variant: 'default' });
  // `show()` is the script's way in and must refuse a frame that would be filed under a name the object has not got.
  await expect(page.evaluate(() => window.__sketch.show('nope', 'default', 'low'))).rejects.toThrow('no object named nope');
  await expect(page.evaluate(() => window.__sketch.show('placeholder', 'bogus', 'low'))).rejects.toThrow('placeholder has no variant bogus');
  await expect(page.evaluate(() => window.__sketch.show('placeholder', 'default', 'x' as never))).rejects.toThrow('no tier x');
});

// Round 2 of #715's review: the renderer's pixel ratio was set once from a hardcoded `high`, so a low-tier
// frame was never drawn at low's cost. The project's deviceScaleFactor is 2: at high's cap, above low's.
test('the pixel ratio follows the tier, from the first frame of a deep link and across a change', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/sketchbook/sketchbook.html?tier=low`);
  await page.waitForFunction(() => window.__sketch?.ready === true);
  expect(await page.evaluate(() => devicePixelRatio), 'the project must run at or above both caps').toBeGreaterThanOrEqual(TIERS.high.maxPixelRatio);
  expect(await page.evaluate(() => window.__sketch.pixelRatio()), 'a ?tier=low first frame').toBe(TIERS.low.maxPixelRatio);
  await page.evaluate(() => window.__sketch.show('placeholder', 'default', 'high'));
  expect(await page.evaluate(() => window.__sketch.pixelRatio())).toBe(TIERS.high.maxPixelRatio);
  await page.evaluate(() => window.__sketch.show('placeholder', 'default', 'low'));
  expect(await page.evaluate(() => window.__sketch.pixelRatio()), 'and back down').toBe(TIERS.low.maxPixelRatio);
});

// Round 2 of #715's review: only the first wait rethrew the page's own error; a stage that threw inside the
// frame loop on a later shot surfaced as Playwright's "timeout exceeded". This stands in for that: after the
// first `show()`, the frame counter the script reads freezes at the value it read last (the real loop keeps
// running underneath, so freezing at the *current* count would race it) and, when asked, the page throws.
const stallAfterShow = (page: import('@playwright/test').Page, throwToo: boolean) => page.addInitScript((throwToo) => {
  let real: any, lastRead = 0, frozen: number | null = null;
  Object.defineProperty(window, '__sketch', {
    configurable: true,
    get: () => real && new Proxy(real, { get(t, k) {
      if (k === 'frames') { if (frozen !== null) return frozen; lastRead = t.frames; return lastRead; }
      if (k === 'show') return (...a: unknown[]) => {
        (t as any).show(...a); frozen = lastRead;
        if (throwToo) setTimeout(() => { throw new Error('boom during a later shot'); });
      };
      return Reflect.get(t, k);
    } }),
    set: (v) => { real = v; },
  });
}, throwToo);

test('a page error during a later shot is what shoot() throws, not the wait\'s own timeout', async ({ page, baseURL }) => {
  await stallAfterShow(page, true);
  await expect(shoot({ page, base: baseURL!, out: test.info().outputPath('shots'), readyMs: 1500 })).rejects.toThrow('boom during a later shot');
});

test('a frame loop that merely stalls still fails, as the wait\'s own timeout', async ({ page, baseURL }) => {
  await stallAfterShow(page, false);
  await expect(shoot({ page, base: baseURL!, out: test.info().outputPath('shots'), readyMs: 1500 })).rejects.toThrow(/[Tt]imeout/);
});
