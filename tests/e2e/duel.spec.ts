import { test, expect, type Page } from '@playwright/test';
import type { DuelHooks } from '../../src/ui/hooks';

// Ninja Duel (#16 items 2–4): two arenas on one screen, the same question in both, first correct slice wins
// the round. Driven through the duel screen's own `window.__sna` hooks, which name the player every call is for.
declare global { interface Window { __sna: DuelHooks; __SNA_FAST?: number } }

async function startDuel(page: Page) {
  await page.addInitScript(save => { if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save); }, JSON.stringify({ v: 1, name: 'Ada', avatar: 'volt' }));
  await page.addInitScript(() => { window.__SNA_FAST = 4; });
  await page.goto('/');
  await expect(page.locator('.home')).toBeVisible();
  await page.click('.island[data-year="year1"]');
  await page.click('#duel');
  await expect(page.locator('.duel-screen')).toBeVisible();
  await page.waitForFunction(() => window.__sna?.state().prompt);
}
/** Wait until player `p`'s arena has the answer in flight, then slice it there. */
async function winRound(page: Page, p: 'a' | 'b') {
  await page.waitForFunction(p => { const s = window.__sna.state(); return !s.decided && !s.ended && window.__sna.bubbles(p).some(b => b.label === s.answer); }, p);
  expect(await page.evaluate(p => window.__sna.answer(p), p)).toBe(true);
}

test.describe('Ninja Duel', () => {
  test('both players see the same question, the first correct slice takes the round, and the match ends with the right winner', async ({ page }) => {
    await startDuel(page);
    await expect(page.locator('#round')).toHaveText('Round 1 of 10');
    // The same wave in both arenas: each arena launches the ONE question's options (in its own batch order —
    // a snapshot of the two in-flight sets need not match, the option set does), and the answer reaches both.
    await page.waitForFunction(() => window.__sna.bubbles('a').length > 0 && window.__sna.bubbles('b').length > 0);
    const seen = await page.evaluate(() => ({
      options: window.__sna.duel.current!.options, a: window.__sna.bubbles('a').map(b => b.label), b: window.__sna.bubbles('b').map(b => b.label),
    }));
    for (const l of [...seen.a, ...seen.b]) expect(seen.options).toContain(l);
    await page.waitForFunction(() => { const s = window.__sna.state(); return (['a', 'b'] as const).every(p => window.__sna.bubbles(p).some(b => b.label === s.answer)); });
    // Player 2 slices a wrong bubble: no point, the round goes on; Player 1 then takes it.
    await page.waitForFunction(() => window.__sna.bubbles('b').some(b => b.label !== window.__sna.state().answer));
    expect(await page.evaluate(() => window.__sna.wrong('b'))).toBe(true);
    await winRound(page, 'a');
    await expect(page.locator('#score-a')).toHaveText('1');
    await expect(page.locator('#score-b')).toHaveText('0');
    // Once a round is decided, the other player's slice of the same answer is ignored — no second point.
    expect(await page.evaluate(() => window.__sna.duel.hit('b', window.__sna.state().answer!))).toBe('ignored');
    // Play out the match: Player 1 wins 6 rounds, Player 2 takes the rest.
    for (let r = 2; r <= 10; r++) {
      await page.waitForFunction(r => window.__sna.state().round === r, r);
      await winRound(page, r <= 6 ? 'a' : 'b');
    }
    await expect(page.locator('.duel-end')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.duel-end h2')).toHaveText('Player 1 wins!');
    await expect(page.locator('.duel-end .speech')).toHaveText('Player 1 wins 6–4!');
    expect(await page.evaluate(() => window.__sna.state())).toMatchObject({ ended: true, scoreA: 6, scoreB: 4 });
    // Islands tears the duel down: the hooks go with it (#73 — no arena may leak across screens).
    await page.click('.duel-end #home');
    await expect(page.locator('.island-screen')).toBeVisible();
    expect(await page.evaluate(() => window.__sna === undefined)).toBe(true);
  });

  test('a duel is played on a bubble topic of the island, and the pause overlay holds both arenas', async ({ page }) => {
    await startDuel(page);
    const topic = await page.evaluate(() => window.__sna.state().topic);
    expect(topic.startsWith('y1-')).toBe(true);
    await page.click('#pause');
    await expect(page.locator('#resume')).toBeVisible();
    expect(await page.evaluate(() => window.__sna.arenas.a.paused && window.__sna.arenas.b.paused)).toBe(true);
    await page.click('#resume');
    expect(await page.evaluate(() => window.__sna.arenas.a.paused || window.__sna.arenas.b.paused)).toBe(false);
  });
});
