import { test, expect, type Page } from '@playwright/test';
import { DUEL_HANDOVER } from '../../src/game/duel';
import type { DuelHooks } from '../../src/ui/hooks';

// Ninja Duel (#16 items 2–4): two arenas on one screen, the same question in both, first correct slice wins
// the round. Driven through the duel screen's own `window.__sna` hooks, which name the player every call is for.
declare global { interface Window { __sna: DuelHooks; __SNA_FAST?: number; __said: string[]; __deadArenas: { time: number }[] } }

/**
 * A speech engine that records what it was asked to say, and when it was cancelled, in order (#16 review). It
 * also models the drop `src/audio.ts` documents: a `speak()` in the same task as a `cancel()` is recorded as
 * `<dropped>`, not as the line — so a line that only *looks* spoken because the stub is synchronous is caught.
 */
const recordingEngine = (page: Page) => page.addInitScript(() => {
  window.__said = [];
  let cancelling = false;
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      speaking: false, pending: false, getVoices: () => [], onvoiceschanged: null,
      cancel: () => { window.__said.push('<cancel>'); cancelling = true; setTimeout(() => { cancelling = false; }, 0); },
      speak: (u: SpeechSynthesisUtterance) => { window.__said.push(cancelling ? `<dropped> ${u.text}` : u.text); },
    },
  });
});
/** The hand-over line was spoken for this round 1 — not dropped into a cancel — and nothing cancelled it afterwards. */
async function expectHandoverHeard(page: Page) {
  await page.waitForFunction(() => window.__said.some(l => l.includes('Ninja Duel!')));
  const said = await page.evaluate(() => window.__said);
  const at = said.findLastIndex(l => l.includes('Ninja Duel!'));
  expect(said[at].startsWith(`${DUEL_HANDOVER} `), 'one utterance, actually spoken: the instruction, then the question').toBe(true);
  expect(said.slice(at + 1), 'no cancel() after it').not.toContain('<cancel>');
}

async function startDuel(page: Page) {
  await page.addInitScript(save => { if (!localStorage.getItem('sna:v1')) localStorage.setItem('sna:v1', save); }, JSON.stringify({ v: 1, name: 'Ada', avatar: 'volt' }));
  await page.addInitScript(() => { window.__SNA_FAST = 4; });
  await recordingEngine(page);
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
    await expectHandoverHeard(page);   // the second child's one instruction is in round 1's own utterance
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
    expect(await page.evaluate(() => window.__sna.state())).toMatchObject({ ended: true, scoreA: 6, scoreB: 4, coins: 10 });
    // #16 item 5: the finished match pays the one shared save a coin per decided round — ten here, and not one
    // of them for winning. Ten is under the first sticker threshold (30), so the match unlocks nothing yet.
    await expect(page.locator('.duel-end .coin-gain')).toHaveText('+10 🪙');
    await expect(page.locator('.duel-end .unlock')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!).coins), 'the coins reached the save, not just the overlay').toBe(10);
    // Rematch routes back into the same screen (the #73 class): a fresh match, both scores at 0. The recording
    // is cleared BEFORE the click: round 1's line goes out on the task after the old screen's cancel(), and it
    // is what the assertion after the scores must find.
    await page.evaluate(() => { window.__said = []; });
    await page.click('.duel-end #again');
    await expect(page.locator('.duel-screen')).toBeVisible();
    await expect(page.locator('#round')).toHaveText('Round 1 of 10');
    await expect(page.locator('#score-a')).toHaveText('0');
    await expect(page.locator('#score-b')).toHaveText('0');
    expect(await page.evaluate(() => window.__sna.state())).toMatchObject({ round: 1, ended: false, scoreA: 0, scoreB: 0, coins: 0 });
    await expectHandoverHeard(page);   // the rematch's line is not dropped into the old screen's cancel()
    expect(await page.evaluate(() => window.__said.indexOf('<cancel>')), 'the old screen was hushed first, then the line went out').toBeGreaterThanOrEqual(0);
    // Leaving tears the duel down: the hooks go with it and BOTH render loops stop (#73 — no arena may leak
    // across screens; the game.spec `__deadArena` pattern, once per arena). The exit is the hardware/browser
    // back on an UNPAUSED screen, deliberately: `Arena.time` only advances while not paused, so leaving through
    // the pause overlay's Quit would read a leaked loop as a stopped one (PR #295 review, round 3). It is also
    // the `'duel'` popstate branch main.ts added.
    await page.evaluate(() => { window.__deadArenas = [window.__sna.arenas.a, window.__sna.arenas.b]; history.back(); });
    await expect(page.locator('.island-screen')).toBeVisible();
    const leaked = await page.evaluate(() => new Promise<{ advanced: number[]; sna: string }>(res => {
      const t0 = window.__deadArenas.map(a => a.time);
      setTimeout(() => res({ advanced: window.__deadArenas.map((a, i) => +(a.time - t0[i]).toFixed(2)), sna: typeof window.__sna }), 500);
    }));
    expect(leaked).toEqual({ advanced: [0, 0], sna: 'undefined' });
  });

  test('the card carries the line the round is decided by, every round (#65, PR #295 review)', async ({ page }) => {
    await startDuel(page);
    // The pool's comparison topics (length, mass, capacity, temperature) put the values being compared in
    // `q.hint` and nowhere else on the card, so a card without this line is ten rounds of "Which is fuller?"
    // over two coloured bubbles. Read the DOM and the state in ONE evaluate: a round can end between two.
    for (let r = 1; r <= 3; r++) {
      await page.waitForFunction(r => window.__sna.state().round === r && !!window.__sna.state().prompt, r);
      const seen = await page.evaluate(() => {
        const el = document.querySelector('#hint') as HTMLElement;
        return { hint: window.__sna.state().hint, own: window.__sna.duel.current?.hint ?? null, dom: el.textContent, shown: el.getBoundingClientRect().height };
      });
      expect(seen.dom, `round ${r}: the card shows the line the screen says it is showing`).toBe(seen.hint);
      expect(seen.hint, `round ${r}: no round leaves the strip's hint line empty`).not.toBe('');
      expect(seen.shown, `round ${r}: the line is laid out, not collapsed to nothing`).toBeGreaterThan(0);
      if (seen.own) expect(seen.dom, `round ${r}: the question's own hint, not a generic instruction`).toBe(seen.own);
      if (r < 3) await winRound(page, 'a');
    }
    // A phone turned sideways lands in the `max-height: 640px` band, where the shared `.hint` rule is
    // `display: none` to buy the play screen room. The duel card cannot take that: the line IS the question
    // there. Pinned in both projects, because neither project's own viewport is in the band.
    await page.setViewportSize({ width: 844, height: 390 });
    const landscape = await page.evaluate(() => {
      const el = document.querySelector('#hint') as HTMLElement;
      return { h: el.getBoundingClientRect().height, dom: el.textContent, display: getComputedStyle(el).display };
    });
    expect(landscape.display, 'the duel hint survives the short-screen rule').not.toBe('none');
    expect(landscape.h, 'a landscape phone still shows the line the round is decided by').toBeGreaterThan(0);
    expect(landscape.dom).not.toBe('');
  });

  test('a duel is played on a bubble topic of the island, a round nobody slices is a draw, and pause holds both arenas', async ({ page }) => {
    await startDuel(page);
    const topic = await page.evaluate(() => ({ id: window.__sna.state().topic, input: window.__sna.duel.o.topic.input, sequence: window.__sna.duel.current?.sequence }));
    expect(topic.id.startsWith('y1-')).toBe(true);
    expect(topic.input).not.toBe('tracing');
    expect(topic.sequence).toBeUndefined();
    // Nobody slices round 1: both waves fall, the round is a draw (no point either way) and round 2 follows —
    // the natural wave-end path and the both-arenas gate, which winning every round never reaches.
    await page.waitForFunction(() => window.__sna.state().round === 2, undefined, { timeout: 30_000 });
    expect(await page.evaluate(() => window.__sna.state())).toMatchObject({ round: 2, scoreA: 0, scoreB: 0, decided: false, ended: false });
    // The both-arenas gate: one advance per round, not one per arena. Advancing twice would show round 3 within
    // a frame or two of round 2; round 2's wave is in the air for well over 300 ms even at 4×.
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__sna.state().round), 'one wave end per arena, one advance per round').toBe(2);
    await page.click('#pause');
    await expect(page.locator('#resume')).toBeVisible();
    expect(await page.evaluate(() => window.__sna.arenas.a.paused && window.__sna.arenas.b.paused)).toBe(true);
    await page.click('#resume');
    expect(await page.evaluate(() => window.__sna.arenas.a.paused || window.__sna.arenas.b.paused)).toBe(false);
  });
});
