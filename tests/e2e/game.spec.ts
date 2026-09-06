import { test, expect, type Page } from '@playwright/test';

declare global { interface Window { __sna: any } }

async function pickAvatar(page: Page, id = 'volt', name = 'Ada') {
  await page.goto('/?reset=1');
  await expect(page.locator('.avatar-screen')).toBeVisible();
  await expect(page.locator('#go')).toBeDisabled();
  await page.click(`.avatar-card[data-id="${id}"]`);
  await page.fill('#name', name);
  await page.click('#go');
  await expect(page.locator('.home')).toBeVisible();
}
async function startTopic(page: Page, year: string, topic: string) {
  if (await page.locator('.island-screen').count()) await page.click('#back');
  await page.click(`.island[data-year="${year}"]`);
  await expect(page.locator('.island-screen')).toBeVisible();
  const subjectTab = topic.includes('trace') || /-(sounds|capitals|build|digraphs|spelling|plurals|suffix|punct|days|contractions|homophones)$/.test(topic) ? 'writing' : 'maths';
  await page.click(`.tab[data-s="${subjectTab}"]`);
  await page.click(`.topic[data-id="${topic}"]`);
  await expect(page.locator('.play')).toBeVisible();
  await page.waitForFunction(() => window.__sna?.state().prompt);
}
/**
 * Real-pointer slice through the correct bubble. Pointer round trips are slow under headless software
 * rendering (hundreds of ms each), so the wave is frozen in place first: this test checks the pointer →
 * canvas → segment hit → session path, not the physics (the other tests cover flight and falling).
 */
async function swipeAnswer(page: Page) {
  const b = await page.waitForFunction(() => {
    const s = window.__sna; if (!s || s.state().waiting) return null;
    const label = s.session.current.sequence ? s.session.current.sequence[s.session.seqIndex] : s.session.current.answer;
    const hit = s.bubbles().find((x: any) => x.label === label && x.y > 60 && x.y < window.innerHeight - 20);
    return hit ? JSON.stringify(hit) : null;
  }, null, { timeout: 15000 });
  const label = JSON.parse(await b.jsonValue() as string).label as string;
  const others = await page.evaluate(() => { // freeze every bubble where it is; never launch the rest of the wave
    for (const x of window.__sna.arena.bubbles) { if (x.launched) { x.vx = 0; x.vy = 0; x._g = 0; } else x.launchAt = Infinity; }
    return window.__sna.bubbles();
  });
  const target = others.find((x: any) => x.label === label);   // position after the freeze, not before the round trip
  // Approach from a side with no other bubble in the way (a stroke through a decoy counts as a wrong answer).
  const decoys = others.filter((x: any) => x.label !== target.label);
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const clear = (dx: number, dy: number) => decoys.every((o: any) => [1.6, 1.1, 0.6].every(k => Math.hypot(o.x - (target.x + dx * target.r * k), o.y - (target.y + dy * target.r * k)) > o.r * 1.2 + 4));
  const [dx, dy] = dirs.find(([x, y]) => clear(x, y)) ?? dirs[0];
  await page.mouse.move(target.x + dx * target.r * 1.6, target.y + dy * target.r * 1.6);
  await page.mouse.down();
  for (let i = 1; i <= 4; i++) { const k = 1.6 - (1.8 * i) / 4; await page.mouse.move(target.x + dx * target.r * k, target.y + dy * target.r * k); }
  await page.mouse.up();
}
const answer = (page: Page) => page.evaluate(() => window.__sna.answer());
const waitForTarget = (page: Page) => page.waitForFunction(() => { const s = window.__sna?.state(); if (!s || s.waiting) return false; const c = window.__sna.session.current; const label = c.sequence ? c.sequence[window.__sna.session.seqIndex] : c.answer; return window.__sna.bubbles().some((b: any) => b.label === label); }, null, { timeout: 20000 });
const state = (page: Page) => page.evaluate(() => window.__sna.state());
async function answerAll(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    await page.waitForFunction(() => { const s = window.__sna?.state(); return s && !s.waiting && window.__sna.bubbles().some((b: any) => b.label === (window.__sna.session.current.sequence ? window.__sna.session.current.sequence[window.__sna.session.seqIndex] : s.answer)); });
    expect(await answer(page)).toBe(true);
    await page.waitForFunction((i) => { const s = window.__sna?.state(); return s && (s.index > i || s.ended || document.querySelector('.celebrate')); }, i);
  }
}

test.describe('Sky Ninja Academy', () => {
  test('avatar selection is required, saved and shown on the home screen', async ({ page }) => {
    await pickAvatar(page, 'blaze', 'Zoe');
    await expect(page.locator('.hero b')).toHaveText('Zoe');
    await expect(page.locator('.hero small')).toContainText('Blaze');
    await page.goto('/');
    await expect(page.locator('.home')).toBeVisible(); // remembered
  });

  test('every year has maths and writing topics listed', async ({ page }) => {
    await pickAvatar(page);
    for (const y of ['reception', 'year1', 'year2']) {
      await page.click(`.island[data-year="${y}"]`);
      await expect(page.locator('.isl-head b')).toContainText(y === 'reception' ? 'Reception' : y === 'year1' ? 'Year 1' : 'Year 2');
      await page.click('.tab[data-s="maths"]'); expect(await page.locator('.topic').count()).toBeGreaterThanOrEqual(6);
      await page.click('.tab[data-s="writing"]'); expect(await page.locator('.topic').count()).toBeGreaterThanOrEqual(3);
      await page.click('#back'); await expect(page.locator('.map')).toBeVisible();
    }
  });

  test('real swipe slices the correct bubble and scores', async ({ page }) => {
    await pickAvatar(page);
    await startTopic(page, 'year1', 'y1-add');
    await swipeAnswer(page);
    await expect(page.locator('#score')).not.toHaveText('0');
    await expect(page.locator('.toast.good')).toBeVisible();
  });

  test('wrong slice loses a life and shows the answer; correct then continues', async ({ page }) => {
    await pickAvatar(page);
    await startTopic(page, 'year2', 'y2-tables');
    await page.waitForFunction(() => window.__sna.bubbles().length > 1);
    expect(await page.evaluate(() => window.__sna.wrong())).toBe(true);
    await expect(page.locator('.toast.bad')).toContainText('it was');
    await expect(page.locator('.lives span.off')).toHaveCount(1);
    await page.waitForFunction(() => window.__sna.state().index === 1);
  });

  test('completing stage 1 shows the avatar celebrating with a praise line', async ({ page }) => {
    await pickAvatar(page, 'kai', 'Sam');
    await startTopic(page, 'year1', 'y1-bonds');
    await answerAll(page, 6);
    const modal = page.locator('.celebrate');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h2')).toContainText('Stage 1 clear');
    await expect(modal.locator('img')).toHaveAttribute('src', /kai\.webp/);
    await expect(modal.locator('.speech')).toContainText('Sam');
    await expect(modal.locator('.stars')).toContainText('★★★');
    await page.click('#next');
    await page.waitForFunction(() => window.__sna.state().stage === 2);
  });

  test('a full mission (5 stages) ends with results, medal, coins, a sticker and saved stars', async ({ page }) => {
    test.setTimeout(150_000);
    await pickAvatar(page, 'terra');
    await startTopic(page, 'reception', 'r-count');
    const stages = await page.evaluate(() => window.__sna.session.stages);
    expect(stages).toBe(5);
    for (let stage = 1; stage <= stages; stage++) {
      await answerAll(page, 5);
      const modal = page.locator('.celebrate');
      await expect(modal).toBeVisible();
      await expect(modal.locator('h2')).toContainText(`Stage ${stage} clear`);
      await page.click('#next');
    }
    const results = page.locator('.results');
    await expect(results).toBeVisible();
    await expect(results.locator('h2')).toHaveText('Mission complete!');
    await expect(results.locator('.medal')).toHaveText('🥇');
    await expect(results.locator('.coin-gain')).toContainText('+120');   // 25 correct + 15 stars×5 + 20 mission
    await expect(results.locator('.unlock')).toHaveCount(3);              // 120 coins → stickers at 30, 70, 120
    await page.click('#home');
    await expect(page.locator('.island-screen')).toBeVisible();
    await expect(page.locator('.topic[data-id="r-count"] .stars')).toContainText('★★★');
    await page.click('#back');
    await expect(page.locator('.island[data-year="reception"] .isl-stars')).toContainText('★ 3/');
    await expect(page.locator('#rewards b')).toHaveText('120');
    await page.click('#rewards');
    await expect(page.locator('.rewards')).toBeVisible();
    await expect(page.locator('.sticker.got')).toHaveCount(3);
  });

  test('reception is gentle: missed bubbles re-ask without losing lives', async ({ page }) => {
    await pickAvatar(page);
    await startTopic(page, 'reception', 'r-onemore');
    await page.waitForFunction(() => window.__sna.bubbles().length > 0);
    await page.waitForFunction(() => window.__sna.bubbles().length === 0, null, { timeout: 30000 }); // let the wave fall
    await expect(page.locator('.lives span.off')).toHaveCount(0);
    await page.waitForFunction(() => window.__sna.state().index === 1 && !window.__sna.state().waiting);
  });

  test('spelling: letters must be sliced in order', async ({ page }) => {
    await pickAvatar(page);
    await startTopic(page, 'reception', 'r-build');
    const word = (await state(page)).answer as string;
    await expect(page.locator('.prompt .seq span')).toHaveCount(word.length);
    for (let i = 0; i < word.length; i++) {
      await page.waitForFunction(() => window.__sna.bubbles().some((b: any) => b.label === window.__sna.session.current.sequence[window.__sna.session.seqIndex]));
      expect(await answer(page)).toBe(true);
      if (i < word.length - 1) await expect(page.locator('.prompt .seq .got')).toHaveCount(i + 1);
    }
    await expect(page.locator('.toast.good')).toBeVisible();
  });

  test('letter tracing passes when the glyph is covered', async ({ page }) => {
    await pickAvatar(page);
    await startTopic(page, 'reception', 'r-trace');
    await expect(page.locator('#trace')).toBeVisible();
    await page.click('#tcheck');
    await expect(page.locator('.toast.bad')).toBeVisible();          // nothing traced yet
    expect(await answer(page)).toBe(true);                            // auto-trace
    await expect(page.locator('.toast.good')).toBeVisible();
    await page.waitForFunction(() => window.__sna.state().index === 1);
  });

  test('endless Sky Storm ramps up and ends when lives run out', async ({ page }) => {
    await pickAvatar(page);
    await page.click('.island[data-year="year2"]');
    await page.click('#endless');
    await expect(page.locator('.villain img')).toBeVisible();
    for (let i = 0; i < 4; i++) { await waitForTarget(page); expect(await answer(page)).toBe(true); await page.waitForFunction((n) => window.__sna.session.questionsAsked > n, i + 1); }
    for (let i = 0; i < 3; i++) { await waitForTarget(page); await page.waitForFunction(() => window.__sna.bubbles().length > 1); expect(await page.evaluate(() => window.__sna.wrong())).toBe(true); await page.waitForFunction((n) => window.__sna.session.questionsAsked > n || window.__sna.state().ended, i + 5); }
    await expect(page.locator('.results h2')).toHaveText('Storm over!');
    await page.click('#home');
    await expect(page.locator('#endless small')).toContainText('best');
  });

  test('Ninja Sprint: timed run with no lives ends on the clock and saves a best score', async ({ page }) => {
    await pickAvatar(page);
    await page.click('.island[data-year="year1"]');
    await expect(page.locator('#sprint small')).toContainText('best 0');
    await page.click('#sprint');
    await expect(page.locator('.play')).toBeVisible();
    await expect(page.locator('#timer')).toContainText(/⏱ (60|59|58)/);
    await expect(page.locator('#lives')).toHaveCount(0);
    await expect(page.locator('#stage')).toHaveText('Q1');
    await waitForTarget(page); expect(await answer(page)).toBe(true);
    await expect(page.locator('#score')).toHaveText('10');
    await page.waitForFunction(() => window.__sna.session.questionsAsked > 1);
    await waitForTarget(page); await page.waitForFunction(() => window.__sna.bubbles().length > 1);
    expect(await page.evaluate(() => window.__sna.wrong())).toBe(true);
    await expect(page.locator('.toast.bad')).toContainText('it was');
    expect((await state(page)).lives).toBe(3);                              // a slip costs time, never a life
    await page.click('#pause');
    const frozen = (await state(page)).timeLeft;
    await page.waitForTimeout(400);
    expect((await state(page)).timeLeft).toBe(frozen);                      // the clock stops while paused
    await page.click('#resume');
    await page.waitForFunction((t) => window.__sna.state().timeLeft < t, frozen);
    await page.evaluate(() => window.__sna.session.tick(60_000));            // fast-forward to the whistle
    await expect(page.locator('#timer')).toHaveText('⏱ 0');
    const results = page.locator('.results');
    await expect(results.locator('h2')).toHaveText("Time's up!");
    await expect(results.locator('.best-pill')).toBeVisible();
    await expect(results.locator('.coin-gain')).toContainText('+6');         // 1 correct + 1 star × 5
    await page.click('#home');
    await expect(page.locator('#sprint small')).toContainText('best 10');
  });

  test('first play shows the slice tutorial hand, which goes away after the first slice for good', async ({ page }) => {
    await pickAvatar(page);
    await startTopic(page, 'reception', 'r-count');
    const tut = page.locator('#tutorial');
    await expect(tut).toBeVisible();
    await expect(tut).toContainText('Slice the bubble');
    await page.waitForFunction(() => window.__sna.bubbles().some((b: any) => b.label === window.__sna.state().answer));
    expect(await answer(page)).toBe(true);
    await expect(tut).toBeHidden();
    await page.click('#pause'); await page.click('#quit');
    await startTopic(page, 'reception', 'r-count');
    await expect(page.locator('#tutorial')).toHaveCount(0);                 // remembered: no demo on the second play
  });

  test('tapping the question card repeats it aloud (pulse feedback)', async ({ page }) => {
    await pickAvatar(page);
    await startTopic(page, 'year1', 'y1-add');
    await page.click('#qcard .prompt');
    await expect(page.locator('#qcard')).toHaveClass(/pulse/);
  });

  test('pause and quit return home', async ({ page }) => {
    await pickAvatar(page);
    await startTopic(page, 'year1', 'y1-time');
    await page.click('#pause');
    await expect(page.locator('.modal h2')).toHaveText('Paused');
    await page.click('#quit');
    await expect(page.locator('.island-screen')).toBeVisible();
  });

  test('question visuals render for pictorial topics', async ({ page }) => {
    await pickAvatar(page);
    await startTopic(page, 'year1', 'y1-coins');
    await expect(page.locator('.vis .coin')).toHaveCount(1);
    await page.click('#pause'); await page.click('#quit');
    await startTopic(page, 'year2', 'y2-time');
    await expect(page.locator('.vis .clock')).toBeVisible();
  });
});
