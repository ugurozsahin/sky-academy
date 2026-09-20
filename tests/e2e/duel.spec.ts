import { test, expect, type Page } from '@playwright/test';
import { DUEL_HANDOVER } from '../../src/game/duel';
import { dailyChallenges } from '../../src/game/dojo';
import type { DuelHooks } from '../../src/ui/hooks';

// Ninja Duel (#16 items 2–4): two arenas on one screen, the same question in both, first correct slice wins
// the round. Driven through the duel screen's own `window.__sna` hooks, which name the player every call is for.
declare global { interface Window { __sna: DuelHooks; __SNA_FAST?: number; __said: string[]; __deadArenas: { time: number }[]; __seedMiss: boolean } }

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

async function startDuel(page: Page, dojoByDate?: Record<string, unknown>) {
  // The dojo seed is chosen by the PAGE's date, not this process's: `storage.ts`'s `today()` runs in the
  // browser, and a seed built against a different day is silently rolled over by `dojoFor()` — progress
  // gone, the case green for the wrong reason. The two clocks straddle midnight UTC in the general case,
  // so `dojoSeeds()` hands over every day the page could be on and the page picks.
  await page.addInitScript(({ save, dojoByDate }) => {
    window.__seedMiss = false;
    if (localStorage.getItem('sna:v1')) return;
    const d = JSON.parse(save) as Record<string, unknown>;
    if (dojoByDate) {
      const seed = dojoByDate[new Date().toISOString().slice(0, 10)];
      if (seed) d.dojo = seed; else window.__seedMiss = true;
    }
    localStorage.setItem('sna:v1', JSON.stringify(d));
  }, { save: JSON.stringify({ v: 1, name: 'Ada', avatar: 'volt' }), dojoByDate });
  await page.addInitScript(() => { window.__SNA_FAST = 4; });
  await recordingEngine(page);
  await page.goto('/');
  await expect(page.locator('.home')).toBeVisible();
  await page.click('.island[data-year="year1"]');
  await page.click('#duel');
  await expect(page.locator('.duel-screen')).toBeVisible();
  await page.waitForFunction(() => window.__sna?.state().prompt);
}
/**
 * Dojo saves in which **only the volume challenge can move**, one per day the page could be on.
 *
 * Six of the fourteen challenges have no mode gate, and two of them — `maths10` (goal 10) and `writing6`
 * (goal 6) — are completed outright by a full ten-round duel, since a match plays one topic and the whole
 * count lands in that topic's subject. One day in five draws one of those as its focus challenge (`maths10`
 * 21.1%, `writing6` 19.9% over 730 days), and whether the day's random duel topic is that subject is another
 * coin toss — so a case that seeds only the volume ids is a calendar lottery that goes red on about one run
 * in five. Seeding the day's mode and focus challenges as already done takes the date out of it: neither can
 * complete twice, whatever the draw and whatever topic the match lands on.
 *
 * `volume` says where to leave the day's volume challenge: `'short'` is one answer from its goal (a single
 * decided round finishes it, and with the other two already done that finishes the day's set), `'fresh'` is
 * untouched (ten correct answers cannot reach 15, 20 or 25).
 */
function dojoSeeds(volume: 'short' | 'fresh'): Record<string, unknown> {
  const seeds: Record<string, unknown> = {};
  for (const offset of [0, 1]) {                       // today and tomorrow: the page's clock decides which
    const dt = new Date(); dt.setUTCDate(dt.getUTCDate() + offset);
    const date = dt.toISOString().slice(0, 10);
    const others = dailyChallenges(date).filter(c => c.group !== 'volume');
    const progress: Record<string, number> = Object.fromEntries(others.map(c => [c.id, c.goal]));
    // All three volume ids, since which one the day draws is the date's business, not this test's.
    if (volume === 'short') Object.assign(progress, { correct15: 14, correct20: 19, correct25: 24 });
    seeds[date] = { date, progress, done: others.map(c => c.id), setDone: false, streak: { last: '', days: 0 }, total: others.length };
  }
  return seeds;
}

/** Wait until player `p`'s arena has the answer in flight, then slice it there. */
async function winRound(page: Page, p: 'a' | 'b') {
  await page.waitForFunction(p => { const s = window.__sna.state(); return !s.decided && !s.ended && window.__sna.bubbles(p).some(b => b.label === s.answer); }, p);
  expect(await page.evaluate(p => window.__sna.answer(p), p)).toBe(true);
}

test.describe('Ninja Duel', () => {
  test('both players see the same question, the first correct slice takes the round, and the match ends with the right winner', async ({ page }) => {
    await startDuel(page, dojoSeeds('fresh'));
    expect(await page.evaluate(() => window.__seedMiss), 'the page landed on a day dojoSeeds() did not build').toBe(false);
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
    expect(await page.evaluate(() => window.__sna.state())).toMatchObject({
      ended: true, scoreA: 6, scoreB: 4, coins: 10, dojoCoins: 0,
      // #16 item 5, Sensei's half: Player 1 sliced six answers and nothing else, so six of six. Player 2's
      // round-1 wrong slice and four wins are NOT here — one shared profile, and only the bottom seat is its
      // own child's (`duelAccuracy()`). Ten decided rounds would be the coins' number, not this one.
      taught: { hits: 6, tries: 6 },
    });
    // #16 item 5: the finished match pays the one shared save a coin per decided round — ten here, and not one
    // of them for winning. Ten is under the first sticker threshold (30), so the match unlocks nothing yet, and
    // ten correct answers is short of every volume challenge (15/20/25), so no dojo bonus — `dojoSave('fresh')`
    // is what makes that true on every date rather than on four days in five.
    await expect(page.locator('.duel-end .coin-gain')).toHaveText('+10 🪙');
    await expect(page.locator('.duel-end .unlock')).toHaveCount(0);
    await expect(page.locator('.duel-end .dojo-bonus')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!).coins), 'the coins reached the save, not just the overlay').toBe(10);
    // The tally reached the topic Sensei ranks by, and not as a `play`: a duel earns no stars, so `plays` stays
    // 0 and `accuracy()` reads null for a duel-only topic. Read from the save rather than from the overlay —
    // the state hook would be green with `recordAccuracy()` never called.
    const learnt = await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!).progress[window.__sna.state().topic]);
    expect(learnt, "Player 1's own six slices, in the save").toMatchObject({ hits: 6, tries: 6, plays: 0, stars: 0 });
    // Rematch routes back into the same screen (the #73 class): a fresh match, both scores at 0. The recording
    // is cleared BEFORE the click: round 1's line goes out on the task after the old screen's cancel(), and it
    // is what the assertion after the scores must find.
    await page.evaluate(() => { window.__said = []; });
    await page.click('.duel-end #again');
    await expect(page.locator('.duel-screen')).toBeVisible();
    await expect(page.locator('#round')).toHaveText('Round 1 of 10');
    await expect(page.locator('#score-a')).toHaveText('0');
    await expect(page.locator('#score-b')).toHaveText('0');
    expect(await page.evaluate(() => window.__sna.state())).toMatchObject({ round: 1, ended: false, scoreA: 0, scoreB: 0, coins: 0, dojoCoins: 0, taught: { hits: 0, tries: 0 } });
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

  test('a finished match moves the day\'s Daily Dojo challenge and pays its bonus into the same save (#16 item 5)', async ({ page }) => {
    // The day's volume challenge one answer short and its other two already done, so a single decided round
    // finishes both the challenge and the day's set — on every date, not on the four days in five where the
    // focus challenge happens to be one a duel cannot move.
    await startDuel(page, dojoSeeds('short'));
    expect(await page.evaluate(() => window.__seedMiss), 'the page landed on a day dojoSeeds() did not build').toBe(false);
    for (let r = 1; r <= 10; r++) {
      await page.waitForFunction(r => window.__sna.state().round === r, r);
      await winRound(page, r % 2 ? 'a' : 'b');      // five rounds each: the bonus does not depend on who won
    }
    await expect(page.locator('.duel-end')).toBeVisible({ timeout: 10_000 });
    // The challenge row and the set row, in the place every other results overlay puts them: immediately
    // after the coin row. The adjacency selector is the assertion — a count alone passes with the rows moved
    // above the coins or below the stickers, and the position is this change's stated point.
    await expect(page.locator('.duel-end .dojo-bonus')).toHaveCount(2);
    await expect(page.locator('.duel-end .coin-row + .dojo-bonus')).toHaveCount(1);
    await expect(page.locator('.duel-end .dojo-bonus:not(.set) .gain')).toHaveText('+10 🪙');
    await expect(page.locator('.duel-end .dojo-bonus.set .gain')).toHaveText('+25 🪙');
    // Five rounds each, so the dojo hears about ten correct answers while Sensei hears about five: the two
    // numbers a duel reports are deliberately different, and this is the case where they diverge.
    expect(await page.evaluate(() => window.__sna.state())).toMatchObject({ ended: true, scoreA: 5, scoreB: 5, coins: 10, dojoCoins: 35, taught: { hits: 5, tries: 5 } });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!));
    expect(saved.coins, 'the match coins AND the dojo bonus reached the save').toBe(45);
    expect(saved.dojo.done.length, 'the completed challenge is recorded, so it cannot be paid twice').toBe(3);
    expect(saved.dojo.setDone, "the day's set is finished by a duel").toBe(true);
    expect(saved.dojo.total).toBe(3);
  });
});
