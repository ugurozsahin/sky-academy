import { test, expect, type Page } from '@playwright/test';
import { DUEL_HANDOVER, duelPool, seededRng } from '../../src/game/duel';
import { topicsFor, YEARS, type Question, type Topic, type Visual } from '../../src/curriculum';
import { renderVisual } from '../../src/ui/visuals';
import { dailyChallenges } from '../../src/game/dojo';
import { SAVE_VERSION } from '../../src/storage';
import type { DuelHooks } from '../../src/ui/hooks';
import { DUEL_TOAST_LONGEST } from '../../src/ui/duel';

// Ninja Duel (#16 items 2–4): two arenas on one screen, the same question in both, first correct slice wins
// the round. Driven through the duel screen's own `window.__sna` hooks, which name the player every call is for.
declare global { interface Window { __sna: DuelHooks; __SNA_FAST?: number; __said: string[]; __deadArenas: { time: number }[]; __seedMiss: boolean } }

// #748: same override as game.spec.ts's FAST — kept as its own constant here since the two files don't share
// module scope, so a CI trial can pass one PW_FAST and have both suites honour it identically.
const rawFast = process.env.PW_FAST;
if (rawFast !== undefined && !/^\d+$/.test(rawFast)) throw new Error(`PW_FAST must be a plain integer, got "${rawFast}"`);
const FAST = rawFast ? Number(rawFast) : 8;

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

/**
 * A store that takes every `setItem` and throws, the same fixture `game.spec.ts`'s profile-picker tests use
 * (#380 review) — registered as its own `addInitScript` so it runs AFTER `startDuel`'s seed write lands and
 * only refuses the running match's own writes.
 */
const refuseWrites = (page: Page) => page.addInitScript(() => {
  const proto = Object.getPrototypeOf(localStorage) as Storage;
  proto.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
});

async function startDuel(page: Page, dojoByDate?: Record<string, unknown>, coins = 0, opts?: { refuseWrites?: boolean }) {
  // The dojo seed is chosen by the PAGE's date, not this process's: `storage.ts`'s `today()` runs in the
  // browser, and a seed built against a different day is silently rolled over by `dojoFor()` — progress
  // gone, the case green for the wrong reason. The two clocks straddle midnight UTC in the general case,
  // so `dojoSeeds()` hands over every day the page could be on and the page picks.
  await page.addInitScript(({ save, dojoByDate, coins }) => {
    window.__seedMiss = false;
    if (localStorage.getItem('sna:v1')) return;
    const d = JSON.parse(save) as Record<string, unknown>;
    if (coins) d.coins = coins;
    if (dojoByDate) {
      const seed = dojoByDate[new Date().toISOString().slice(0, 10)];
      if (seed) d.dojo = seed; else window.__seedMiss = true;
    }
    localStorage.setItem('sna:v1', JSON.stringify(d));
  }, { save: JSON.stringify({ v: 1, name: 'Ada', avatar: 'volt' }), dojoByDate, coins });
  if (opts?.refuseWrites) await refuseWrites(page);   // after the seed above, so only the match's own writes are refused
  await page.addInitScript((fast) => { window.__SNA_FAST = fast; }, FAST);
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
  /**
   * guard rail (#389), found in play by the owner and his child. Each arena used to lay its own wave out from
   * `Math.random` and its own `performance.now()`, so the answer took a different slot in each side's launch
   * queue: at speed 1 one slot is 420 ms and a whole batch is over four seconds, and a four-option question
   * on a half-width arena batches at three — so the answer landing in batch 0 for one player and batch 1 for
   * the other was an ordinary draw. The match measured the shuffle rather than who was quicker.
   *
   * Every field compared here is fixed at spawn. `x`, `y` and `wobble` are deliberately not: all three are
   * advanced every frame (`arena.ts` — `b.x += b.vx * dt`, `b.wobble += dt * 3`), and the two arenas run
   * their own animation frames, so a snapshot of both mid-flight catches them a frame apart. The desktop
   * project caught exactly that on `wobble`, drifting by 0.0024 rad between the halves while the seeded
   * draw behind it was identical. `vx` and `g` carry the arc instead, and the *initial* wobble is held by
   * the deep-equality check in `tests/unit/duel.test.ts`, where no clock is running.
   */
  test('guard rail: the two halves pose the identical wave — same order, same moments, same arcs (#389)', async ({ page }) => {
    await startDuel(page, dojoSeeds('fresh'));
    await page.waitForFunction(() => window.__sna.bubbles('a').length > 0 && window.__sna.bubbles('b').length > 0);
    // Read off `arenas`, already on the hooks contract, rather than `bubbles()`: that one reports only the
    // bubbles in flight *now* and drops every field fixed at spawn, which is exactly what has to be compared.
    const wave = await page.evaluate(() => {
      const spawned = (p: 'a' | 'b') => window.__sna.arenas[p].bubbles.map(b =>
        ({ label: b.label, launchAt: b.launchAt, r: b.r, vx: b.vx, g: b.g, color: b.color }));
      return { a: spawned('a'), b: spawned('b'), answer: window.__sna.state().answer };
    });
    expect(wave.a.length, 'a real wave was captured, so the comparison below is not two empty lists').toBeGreaterThan(1);
    expect(wave.b, 'both halves are dealt from one seed and one clock origin').toEqual(wave.a);
    // Named on its own: the launch timetable is the half of it the children actually felt.
    expect(wave.b.map(b => [b.label, b.launchAt]), 'the answer rises at the same moment on both sides')
      .toEqual(wave.a.map(b => [b.label, b.launchAt]));
    expect(wave.a.map(b => b.label), 'and the answer is in the wave, so the rows above are not agreeing about its absence')
      .toContain(wave.answer);
  });

  test('both players see the same question, the first correct slice takes the round, and the match ends with the right winner', async ({ page }) => {
    await startDuel(page, dojoSeeds('fresh'));
    expect(await page.evaluate(() => window.__seedMiss), 'the page landed on a day dojoSeeds() did not build').toBe(false);
    await expect(page.locator('#round')).toHaveText('Round 1 of 10');
    await expectHandoverHeard(page);   // the second child's one instruction is in round 1's own utterance
    // The same wave in both arenas: each arena launches the ONE question's options, and the answer reaches
    // both. Since #389 the two are laid out from one draw, so the orders match as well as the sets — the
    // test below is the one that holds that; this one stays a check on the option set.
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
      // Round 2: Player 1 cuts a wrong bubble and then still takes the round. The round is won — a wrong slice
      // costs nothing — but Sensei is told what a mission would have scored, a miss, so this is the round that
      // makes `hits < tries` reach the save through the real arena (#374 review, B1).
      if (r === 2) {
        await page.waitForFunction(() => window.__sna.bubbles('a').some(b => b.label !== window.__sna.state().answer));
        expect(await page.evaluate(() => window.__sna.wrong('a'))).toBe(true);
      }
      await winRound(page, r <= 6 ? 'a' : 'b');
    }
    await expect(page.locator('.duel-end')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.duel-end h2')).toHaveText('Player 1 wins!');
    await expect(page.locator('.duel-end .speech')).toHaveText('Player 1 wins 6–4!');
    expect(await page.evaluate(() => window.__sna.state())).toMatchObject({
      ended: true, scoreA: 6, scoreB: 4, coins: 10, dojoCoins: 0,
      // #16 item 5, Sensei's half: Player 1 answered six rounds, each right first time, so six of six. Player
      // 2's round-1 wrong slice and four wins are NOT here — one shared profile, and only the bottom seat is
      // its own child's (`duelAccuracy()`). Ten decided rounds would be the coins' number, not this one.
      // Six rounds answered, five right first time: round 2 was won after a wrong cut, and `scoreA` is still 6,
      // so this also pins that `hits` is not a second copy of the score.
      taught: { hits: 5, tries: 6 },
    });
    // #16 item 5: the finished match pays the one shared save a coin per decided round — ten here, and not one
    // of them for winning. Ten is under the first sticker threshold (30), so the match unlocks nothing yet, and
    // ten correct answers is short of every volume challenge (15/20/25), so no dojo bonus — `dojoSave('fresh')`
    // is what makes that true on every date rather than on four days in five.
    await expect(page.locator('.duel-end .coin-gain')).toHaveText('+10 🪙');
    await expect(page.locator('.duel-end .unlock')).toHaveCount(0);
    await expect(page.locator('.duel-end .dojo-bonus')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!).coins), 'the coins reached the save, not just the overlay').toBe(10);
    // #355: a finished duel marks the daily streak, the same as every other finished game — coins are paid
    // and the day is marked from the same write, so this pins both stayed true together.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!).streak.last), "the duel marked today's streak")
      .toBe(new Date().toISOString().slice(0, 10));
    // The tally reached the topic Sensei ranks by, and not as a `play`: a duel earns no stars, so `plays` stays
    // 0 and `accuracy()` reads null for a duel-only topic. Read from the save rather than from the overlay —
    // the state hook would be green with `recordAccuracy()` never called.
    const learnt = await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!).progress[window.__sna.state().topic]);
    expect(learnt, "the six rounds Player 1 answered, five of them right first time").toMatchObject({ hits: 5, tries: 6, plays: 0, stars: 0 });
    // #16 item 5, the certificate half: Player 1 won, so the album gets one — and it is filed the moment the
    // overlay is built, BEFORE the 🎓 button is pressed (#205's rule, the bug being a device where pressing it
    // does nothing). Read from the save, not the overlay: the button would be on screen with nothing recorded.
    await expect(page.locator('.duel-end #cert')).toBeVisible();
    // #436: the certificate outcome used to report through the shared `#toast`, which sits BEHIND this results
    // overlay (`#toast` is `grid-area: q`, z-index 3; `.overlay` is z-index 5) — a child pressing 🎓 never saw
    // whether it worked. It now reports through `#cert-msg`, inside the modal itself, so nothing can cover it.
    // Forcing the 'save' route the same way `game.spec.ts`'s certificate test does, for a deterministic outcome
    // headless Chromium's real Web Share cannot give.
    await page.evaluate(() => { (navigator as any).canShare = () => false; });
    // (a) artifact viewer WITH the downloads grant → the save prompt (#409 item 2: the filename and the
    // disable/re-enable pair, neither of which the earlier version of this test checked at all — only that the
    // button existed and that *a* message appeared).
    // A deliberate delay in the fake `save`, not an instant resolve (pr-test-analyzer review of this PR): a
    // `toBeEnabled()` check taken only after `page.click()` returns would pass whether or not the handler ever
    // disabled the button at all, since Playwright's auto-retry keeps polling past a synchronous flip either
    // way. The delay gives a window in which `#cert` must genuinely be disabled before this test claims it saw it.
    await page.evaluate(() => {
      (window as any).__saved = null;
      (window as any).claude = { use: async (n: string) => n === 'downloads' ? { save: async (r: any) => { (window as any).__saved = r.filename; await new Promise(res => setTimeout(res, 60)); return { status: 'saved' }; } } : null };
    });
    await page.click('.duel-end #cert');
    // Disabled for the length of the delivery — the handler's own `b.disabled = true`, set synchronously before
    // its first `await`, checked while the fake `save` above is still mid-flight.
    await expect(page.locator('.duel-end #cert')).toBeDisabled();
    await expect(page.locator('.duel-end #cert-msg'), 'reported where the child is already looking, not behind the overlay').toHaveText('Certificate saved!');
    // ...and re-enabled once delivery settles — the handler's matching `b.disabled = false`.
    await expect(page.locator('.duel-end #cert')).toBeEnabled();
    expect(await page.evaluate(() => (window as any).__saved), "the duel handler's own filename, not the mission path's").toMatch(/^sky-ninja-duel-.*\.png$/);
    // (b) artifact viewer WITHOUT a downloads grant → the full-screen "press and hold" fallback (the 'shown'
    // route, the mission path's own second half of the same #50 rule: the button never silently does nothing).
    await page.evaluate(() => { (window as any).claude = { use: async () => null }; });
    await page.click('.duel-end #cert');
    const certView = page.locator('.cert-view');
    await expect(certView).toBeVisible();
    await expect(certView.locator('.cert-view-hint')).toContainText('Press and hold');
    await certView.getByRole('button', { name: 'Done' }).click();
    await expect(certView).toHaveCount(0);
    await page.evaluate(() => { delete (window as any).claude; });   // leave the runtime clean for the rest of the test
    // ...and the history takes the same match (#415 review, note 3). The loss test below proved a row is
    // filed with no certificate; this proves the win path files exactly one of each, not two rows or none.
    const won = await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!).duels);
    expect(won, 'a win files one history row, like every other outcome').toHaveLength(1);
    expect(won[0]).toMatchObject({ winner: 'a', scoreA: 6, scoreB: 4, rounds: 10 });
    const filed = await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!).certs);
    expect(filed, 'one entry per year, so a rematch upgrades rather than fills the album').toHaveLength(1);
    expect(filed[0]).toMatchObject({
      id: 'year1:duel', title: 'Ninja Duel', year: 'Year 1', name: 'Ada', duel: true,
      // Player 1's own five-of-six, not the 6–4 scoreline: 83% is two stars on the stage bar, and reading
      // `scoreA` as the tally would have filed three. `score` is the rounds this child took.
      stars: 2, score: 6, correct: 5, attempts: 6,
      // `avatar` and `date` are the two fields the caller supplies rather than copying out of `CertInfo`, so
      // they are the wiring nothing else checks — the mission path pins them for the same reason (#16 review,
      // B1). The seed is `avatar: 'volt'`; `avatarById` is total, so a dropped id redraws as the default ninja
      // in the album and nothing else goes red.
      avatar: 'volt',
    });
    expect(filed[0].date, 'the award day, not an empty string or a full ISO timestamp').toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // And the certificate the child actually keeps. `duel: true` used to be written twice by hand — here and
    // into the drawn `CertInfo` — so deleting it from the drawn one left every test green while the PNG read
    // "completed the Ninja Duel mission". `certToStored()` is now the single writer, so the assertions above
    // cover the drawn object too; this is the other half, that it really draws. A bare data-URL prefix is
    // satisfied by any canvas, drawn on or not, which is why the mission path carries the same length floor.
    const png = await page.evaluate(() => window.__sna.certificate());
    expect(png).toMatch(/^data:image\/png;base64,/);
    expect(png!.length, 'a blank canvas compresses far below this').toBeGreaterThan(20_000);
    // And *what* it draws. A byte count cannot tell one ninja's signature from another, which is how a wrong
    // `avatar` on the drawn certificate survived round 1's rails: the album said 'volt' and the keepsake was
    // signed by Sensei (#397 round 2, B1). These are read off the object `drawCertificate()` is handed.
    const words = await page.evaluate(() => window.__sna.certWords());
    expect(words).toMatchObject({ child: 'Ada', reason: 'won a Ninja Duel on Year 1 Island', stars: '★★☆' });
    expect(words!.signed, "the child's own ninja, not Sensei and not the default").toContain('Volt');
    expect(words!.detail, "Player 1's own slices, the same five-of-six the album stored").toBe('5/6 correct (83%) · score 6');
    // The drawn day and the stored day are one value now, not two reads of the clock a midnight apart.
    const longDate = new Date(`${filed[0].date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    expect(words!.date, 'the album entry and the keepsake agree about the day').toBe(longDate);
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
    // #354 finding 2: `state().coins` above is the new screen's own local score, 0 regardless of whether the
    // previous match's payout landed once or twice — `showResults()` has no re-entrancy guard of its own
    // (unreachable today: it is only ever called once, from `onMatchEnd`), so nothing before this re-read the
    // SAVE after a rematch started. Re-reading it here closes that: still the first match's 10, not 20.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!).coins), "the first match's payout landed once through the rematch route, not twice").toBe(10);
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

  test('guard rail: a certificate that resolves after the screen tears down is dropped, not written into the new one (#436 review, B2)', async ({ page }) => {
    await startDuel(page);
    for (let r = 1; r <= 10; r++) await winRound(page, 'a');
    await expect(page.locator('.duel-end #cert')).toBeVisible();
    // `deliverCertificate` carries real `await` points (fonts, canvas encode, a save-prompt round trip) long
    // enough for a child to leave mid-flight. Held open here so the test controls exactly when it resolves,
    // rather than racing the real timing.
    await page.evaluate(() => {
      (navigator as any).canShare = () => false;
      let release: (v: unknown) => void;
      (window as any).__certGate = new Promise(r => { release = r; });
      (window as any).__releaseCert = () => release!({ status: 'saved' });
      (window as any).claude = { use: async (n: string) => n === 'downloads' ? { save: async () => (window as any).__certGate } : null };
    });
    await page.click('.duel-end #cert');   // delivery is now suspended, awaiting the held gate
    await page.evaluate(() => { history.back(); });
    await expect(page.locator('.island-screen')).toBeVisible();
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.evaluate(() => (window as any).__releaseCert());
    await page.waitForTimeout(200);
    expect(errors, "a torn-down match's certificate outcome must not throw once it finally resolves").toEqual([]);
    expect(await page.locator('#cert-msg').count(), 'nor write its message into whatever screen replaced it').toBe(0);
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
    await resizeTo(page, { width: 844, height: 390 });   // through the helper: a bare resize reads the old layout
    const landscape = await page.evaluate(() => {
      const el = document.querySelector('#hint') as HTMLElement;
      return { h: el.getBoundingClientRect().height, dom: el.textContent, display: getComputedStyle(el).display };
    });
    expect(landscape.display, 'the duel hint survives the short-screen rule').not.toBe('none');
    expect(landscape.h, 'a landscape phone still shows the line the round is decided by').toBeGreaterThan(0);
    expect(landscape.dom).not.toBe('');
  });

  /**
   * Resize, then wait for the app to have taken the new height. `.play` is sized from `--vh`, which `src/main.ts`
   * sets from a `resize` listener, so a `getBoundingClientRect()` straight after `setViewportSize` reports the
   * PREVIOUS viewport's layout — which is how this rail first went green on a bar that was eating 177px.
   * The width is waited on as well: the interesting pair here is 844 against 1600 at the same height, and a
   * height-only predicate is satisfied instantly by the stale layout that the helper exists to rule out.
   */
  async function resizeTo(page: Page, vp: { width: number; height: number }) {
    await page.setViewportSize(vp);
    // `want` is the serialised argument, deliberately not the closed-over `vp`: a predicate that reads the outer
    // variable resolves it in Node, never in the page, and waits on nothing. tsc accepts both.
    await page.waitForFunction(want => {
      const vh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vh'));
      const box = document.querySelector('.duel-screen')!.getBoundingClientRect();
      return window.innerWidth === want.width && Math.abs(vh * 100 - want.height) < 2 && Math.abs(box.height - want.height) < 2;
    }, vp);
  }

  /** Where each piece of the duel screen actually sits, in viewport pixels. */
  const boxes = (page: Page) => page.evaluate(() => {
    const box = (s: string) => {
      const r = document.querySelector(s)!.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, cx: r.x + r.width / 2 };
    };
    // A measured box for the nudge too, not `getComputedStyle().display`: `visibility: hidden`, `display:
    // contents` or a typo all pass a `.not.toBe('none')`, and an unmeasured element is not on screen.
    return {
      a: box('#half-a'), b: box('#half-b'), strip: box('#strip'), rotate: box('.duel-rotate'),
      prompt: box('#prompt'), vis: box('#vis'), canvasA: box('#arena-a'), canvasB: box('#arena-b'),
    };
  });

  /**
   * Every visual a duel can actually put on the card, rendered by the app's OWN `renderVisual()` over the real
   * `duelPool(topicsFor(year), year.diffs[0])` for all three years — not hand-written markup.
   *
   * Hand-written fixtures are how this rail kept missing things. They covered six of the thirteen reachable
   * visual kinds, and one of the missing ones was `chart` — at `diffs[0]` that is the TALLY card from `y2-stats`,
   * and only that: block and pictogram never appear at this difficulty (0 of 40 draws per topic). The pool's
   * tallest card is `symmetry` at 165.6px at 844x390, not `chart` at 90.5-100.9px — an earlier version of this
   * comment claimed both, on no measurement. Two of the fixtures were not even the shape
   * `renderVisual` emits. Deriving them means the catalogue cannot drift from the app again: a new visual type
   * appears here the moment a generator can draw it.
   *
   * `diffs[0]` is deliberate and is the whole reachable set: `duelScreen` fixes a match at the year's gentlest
   * stage and `Duel` passes that one value to every round, so cards needing difficulty 2 or 3 — a 16- or
   * 20-object counting frame among them — cannot appear in a duel however the match runs.
   *
   * Seeded, so the catalogue is identical on every run and in both projects.
   */
  /**
   * Every card a duel can actually deal: the app's own `renderVisual()` output paired with the SAME question's
   * own prompt and hint, over the real `duelPool(topicsFor(year), year.diffs[0])` for all three years.
   *
   * Real triples, not a cross product. Pairing the pool's longest prompt with another topic's longest hint and a
   * third's tallest picture builds a card no child can be dealt, and a bound measured against it is a bound
   * about nothing — it read 180px here for a `scales` card whose real text is short. What a rail should hold is
   * what the generators can actually produce together.
   *
   * Derived rather than hand-written because hand-written is how this kept missing things: the previous
   * catalogue covered six of the thirteen reachable kinds and omitted `chart` — the tally, block and pictogram
   * cards. Two of its fixtures were not even the shape `renderVisual` emits. Derived, the catalogue cannot drift
   * from the app: a new visual kind appears the moment a generator can draw it.
   *
   * `diffs[0]` is the whole reachable set, not a sample: `duelScreen` fixes a match at the year's gentlest stage
   * and `Duel` passes that one value to every round, so a card needing difficulty 2 or 3 — a 16- or 20-object
   * counting frame among them — cannot appear in a duel however the match runs.
   *
   * Seeded, so the catalogue is byte-identical on every run and in both projects.
   */
  interface Card { what: string; kind: Visual['type'] | 'none'; topic: string; html: string; prompt: string; hint: string }
  /** One card, built in code from one question, so the "real triple" is a fact rather than a promise in a comment. */
  const cardFor = (topic: Topic, q: Question): Card => ({
    what: `${q.visual?.type ?? 'none'} (${topic.id})`, kind: q.visual?.type ?? 'none', topic: topic.id,
    html: q.visual ? renderVisual(q.visual) : '', prompt: q.prompt, hint: q.hint ?? '',
  });
  const POOL_CARDS: Card[] = (() => {
    const out: Card[] = [];
    const biggest = new Map<string, Card>();
    let plain: Card | null = null;
    let rightmostTick: Card | null = null;
    for (const year of YEARS) {
      for (const topic of duelPool(topicsFor(year.id), year.diffs[0])) {
        for (let seed = 1; seed <= 40; seed++) {
          const q = topic.gen(year.diffs[0], seededRng(seed));
          const card = cardFor(topic, q);
          if (card.kind === 'none') {
            if (!plain || q.prompt.length + card.hint.length > plain.prompt.length + plain.hint.length) plain = card;
            continue;
          }
          // The number line whose hidden tick is RIGHTMOST, by name. That is the card `overflow-y: clip` exists
          // for — `overflow: hidden` cut the `?` clean off it at 320px wide — and `markPainted` is vacuous
          // without it, on the very viewports this rail added for width.
          if (card.html.includes('class="mark">?</span></div></div>')) rightmostTick ??= { ...card, what: `${card.what} — hidden tick rightmost` };
          // Keyed by kind AND topic, never by kind alone, and kept by SIZE, not by seed order: the first two
          // cards seen used to win the slot, so `objects` kept `r-count`'s two stars and `y2-fractions`'s own
          // FOUR-star draw, never the pool's real twelve-star maximum — the card `src/style.css`'s 160px budget
          // and the portrait floor below are both written around, and both measured nothing (PR #428 review
          // round 4, B1a). `html.length` stands in for element count: every kind here repeats one child markup
          // per item (a `.slot`, an `<i>`, a `<circle>`...), so more items is a longer string.
          const key = `${card.kind}|${topic.id}`;
          const prev = biggest.get(key);
          if (!prev || card.html.length > prev.html.length) biggest.set(key, card);
        }
      }
    }
    out.push(...biggest.values());
    if (plain) out.unshift(plain);
    if (rightmostTick) out.push(rightmostTick);
    return out;
  })();

  test('guard rail: the fixture catalogue still covers what the pool can draw (#425)', () => {
    // A floor of its own, because the realistic degradations are SILENT. `POOL_CARDS = []` throws a TypeError
    // rather than failing an assertion, and `[plain]` — the one text-only card, which is what a `renderVisual`
    // or `duelPool` regression actually leaves — passes both sweeps green, every height and clipping and
    // subpixel claim in them then describing a card with no picture at all.
    expect(POOL_CARDS.length, 'the catalogue is not empty').toBeGreaterThan(20);
    const kinds = new Set(POOL_CARDS.map(c => c.kind));
    expect(kinds.size, 'every visual kind a duel can draw is represented').toBeGreaterThanOrEqual(14);
    expect(new Set(POOL_CARDS.map(c => c.topic)).size, 'drawn from many topics, not one').toBeGreaterThan(10);
    // The three cards the CSS comments are written around, by name rather than by hoping iteration order keeps
    // them. Each was absent from the first version of this catalogue.
    // By its SIZE, not merely its existence. `some(kind && topic)` is satisfied by a FOUR-star card, which is
    // exactly what the catalogue held while this line read green (PR #428 review round 4, B1a): the selection
    // above is what fixed it, and this is what keeps it fixed. Counted on the rendered output — one
    // `class="obj"` per star — so the claim in the message is the claim being checked.
    const stars = POOL_CARDS.filter(c => c.topic === 'y2-fractions' && c.kind === 'objects')
      .map(c => (c.html.match(/class="obj"/g) ?? []).length);
    expect(Math.max(0, ...stars), 'the TWELVE-star counting card the 160px budget exists for, not a smaller one of the same kind')
      .toBeGreaterThanOrEqual(12);
    expect(POOL_CARDS.some(c => c.what.endsWith('hidden tick rightmost')),
      "the number line whose `?` is rightmost, which `overflow-y: clip` exists for").toBe(true);
    expect(POOL_CARDS.some(c => c.kind === 'chart'), 'a chart card').toBe(true);
  });

  /**
   * Deliberately taller than anything the pool can build. Its claim is the OPPOSITE of the cards above: here the
   * budget is SUPPOSED to clip, because the alternative is what it replaced — an unbounded visual taking the
   * whole screen and leaving the arenas 11px tall. So it is checked for the bound and never for clipping, and it
   * is kept out of the derived catalogue so neither claim can quietly be applied to the other.
   */
  const ABSURD: Card = {
    what: 'taller than anything in the pool',
    // `kind` and `topic` are not optional on `Card` and were omitted, which `tsc` flags when pointed at this
    // file — it does not fail CI because `tsconfig.json`'s `include` is `["src", "tests/unit"]` and
    // `.claude/rules/e2e.md`'s compile check is a parse, not a typecheck (PR #428 review, note 2). `'none'`
    // and `'synthetic'` are honest: this card is built by hand and is deliberately out of the pool catalogue.
    kind: 'none', topic: 'synthetic',
    html: '<div class="vis"><div style="width:120px;height:600px"></div></div>',
    prompt: 'Which day comes before Wednesday?', hint: 'yellow sunflower: 14 cm',
  };
  /**
   * Put a real card — its own visual, prompt and hint — on the screen and measure it, **in one `evaluate`**. One round trip is the point: a round can end between two of them,
   * `onQuestion` rewrites `#prompt`, `#vis` and `#hint`, and the measurement is then of the real question rather
   * than the dressed worst case — which reports GREEN, because a real question is smaller. That cost a red CI on
   * the full mobile suite while passing eight repeats in isolation, and this file already names the same hazard at
   * the `#hint` rail above: read the DOM and the state in ONE evaluate.
   *
   * The text matters as much as the picture: in a ROW the card wraps, and a long prompt beside a long hint is
   * another 20px of bar. Both come from the same question as the visual — see `POOL_CARDS`.
   */
  /**
   * The budget must BOUND the bar without cutting the answer off, on either axis — asserted in both orientations,
   * because the first version of this only ran in landscape and only at viewports where nothing clipped.
   */
  function expectNothingClipped(m: { clipY: number; overflowX: string; markPainted: boolean }, where: string) {
    // Vertical: a cropped row of objects is a WRONG COUNT, not merely a small one — `y2-fractions` draws twelve
    // stars, and half a bottom row turns "1/4 of 12" into a card that reads as ten.
    expect(m.clipY, `${where}: the budget bounds the visual without cutting it off`).toBeLessThanOrEqual(0.5);
    // Horizontal: `overflow: hidden` clips x too, and it cut the `?` clean off a number line at 320px wide —
    // where the prompt is "Which number is hidden?". `overflow-y: clip` bounds y and leaves x alone; beside
    // `hidden`, `overflow-x: visible` would compute to `auto` and make a scroll container instead.
    expect(m.overflowX, `${where}: the budget does not clip the horizontal axis`).toBe('visible');
    expect(m.markPainted, `${where}: the '?' the question asks about is painted, not clipped away`).toBe(true);
  }

  const dressAndMeasure = (page: Page, card: { html: string; prompt: string; hint: string }) => page.evaluate(h => {
    // The round's toast is not this measurement's business, and a live match raises one whenever a round is
    // missed or drawn. Left up, it sits on the bar and `markPainted` reads IT at the `?`'s centre — which made
    // this sweep fail about one full-suite run in two, at whichever viewport the draw happened to collide with.
    // The toast's own placement is asserted by the sight loop, deliberately and with the toast lit.
    document.querySelector('.toast')!.classList.remove('show');
    document.querySelector('#vis')!.innerHTML = h.html;
    document.querySelector('#prompt')!.textContent = h.prompt;
    document.querySelector('#hint')!.textContent = h.hint;
    const box = (sel: string) => {
      const r = document.querySelector(sel)!.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, cx: r.x + r.width / 2 };
    };
    const wrap = document.querySelector('#vis') as HTMLElement;
    const cs = getComputedStyle(wrap);
    // Real descendant boxes, NOT `scrollHeight - clientHeight`. `scrollHeight` is an integer, so a 0.5px
    // threshold is finer than the metric — and worse, it counts the LAYOUT OVERFLOW of `.tal.five::after`, the
    // rotated tally stroke, which is decoration and not something a child counts. A real tally chart reads 2-21
    // that way while every countable mark is painted and no element's box passes the wrap's edge.
    const wrapBox = wrap.getBoundingClientRect();
    const kidsOverflow = Array.from(wrap.querySelectorAll('*'))
      .reduce((worst, k) => Math.max(worst, k.getBoundingClientRect().bottom - wrapBox.bottom), 0);
    // Whether the budget CLIPS, measured off the box's own content rather than a list of class names. The first
    // version counted `.five, .tenframe` overflowing — two of the thirteen visual types a duel can draw — so it
    // scored 0 while three elements hung over the edge, and `--duel-vis: 1px`, which crops every visual in the
    // pool, passed every rail in this file. `scrollHeight` against `clientHeight` is type-agnostic and cannot
    // drift from what the app renders.
    // Is the `?` tick — the thing the question asks about — actually painted where it sits? `overflow: hidden`
    // clips x as well as y, and it cut this clean off at 320px wide. Sampling the MARK rather than the widest
    // descendant on purpose: at 320px a two-digit number line is simply wider than the phone, so the container's
    // own outer edge runs past the viewport whatever the budget does, and asserting on that would fail for a
    // reason this stylesheet did not cause and cannot fix.
    const mark = wrap.querySelector('.mark');
    const mr = mark?.getBoundingClientRect();
    // Its CENTRE, not two pixels inside its right edge: the edge sample reads whatever overlaps the card there,
    // which is the same on `main` as here and so is not this diff's business. The centre discriminates exactly
    // the regression — `overflow: hidden` left it unpainted at 320px, `overflow-y: clip` paints it.
    const markPainted = !mr || (() => {
      const hit = document.elementFromPoint(mr.x + mr.width / 2, mr.y + mr.height / 2);
      return !!hit && (hit === mark || hit.closest('.mark') === mark);
    })();
    return {
      a: box('#half-a'), b: box('#half-b'), strip: box('#strip'), rotate: box('.duel-rotate'),
      prompt: box('#prompt'), vis: box('#vis'), canvasA: box('#arena-a'), canvasB: box('#arena-b'),
      // All measured here, in the same tick, for the same reason the boxes are.
      clipY: kidsOverflow,
      overflowX: cs.overflowX,
      markPainted,
    };
  }, card);

  test('sideways, the duel splits left and right with the question centred over the divider (#388)', async ({ page }) => {
    await startDuel(page);
    // The layout the owner and child could not play was two stacked halves: each arena had half the height, and
    // `layoutWave` spends a bubble radius twice over out of it, so the flight was ~270px on a phone. Pinned in
    // both projects at a phone on its side, a tablet, and a screen wider than two capped arenas.
    for (const vp of [{ width: 844, height: 390 }, { width: 1280, height: 800 }, { width: 1600, height: 900 }]) {
      await resizeTo(page, vp);
      const L = await boxes(page);
      expect(L.a.right, `${vp.width}px: Player 1 ends where Player 2 begins`).toBeLessThanOrEqual(L.b.x + 1);
      expect(Math.abs(L.a.y - L.b.y), `${vp.width}px: neither player is above the other`).toBeLessThan(2);
      expect(Math.abs(L.a.w - L.b.w), `${vp.width}px: the two halves are the same width`).toBeLessThan(2);
      expect(L.strip.bottom, `${vp.width}px: the question is a bar across the top, not a strip between them`).toBeLessThanOrEqual(L.a.y + 1);
      // The reason `--arena-w` had to move off the half and onto the pair: past two capped arenas a capped HALF
      // would leave the card floating over the gap between them instead of over the line where they meet.
      expect(Math.abs(L.strip.cx - L.a.right), `${vp.width}px: the card is centred over the divider`).toBeLessThan(2);
      // An exact width, not `<= 601`: at 844 the cap does not bind, so an upper bound there is met whether or not
      // the cap exists and its message would be a lie. Half the screen, or `--arena-w`, whichever is smaller.
      expect(Math.round(L.a.w), `${vp.width}px: a half is half the screen, capped at --arena-w`).toBe(Math.min(vp.width / 2, 600));
      expect(L.rotate.h, `${vp.width}px: nothing asks a player to turn a screen that is already sideways`).toBe(0);
    }
  });

  test('sideways, no question can take the height the split just won, whatever it puts on the card (#388)', async ({ page }) => {
    await startDuel(page);
    // Freeze both arenas for the sweep. This test measures LAYOUT over dozens of dressed cards and takes tens of
    // seconds; left running, the match reaches its tenth round part-way through and `showResults` puts a modal
    // over the whole screen, after which every hit test fails for a reason that has nothing to do with the
    // budget. Pausing the arenas is the screen's own mechanism — `syncPaused` sets exactly this — so no wave
    // ends, no round advances, and nothing rewrites the card underneath the measurements.
    await page.evaluate(() => { for (const p of ['a', 'b'] as const) window.__sna.arenas[p].paused = true; });
    // The bar has to be BOUNDED, not merely short on the question that came up. Before the cap: a clock question
    // took 165px of a 390px screen (42%) and handed each child 193px — worse than the 213px that made the stacked
    // layout unplayable — and a visual taller than the pool holds took the whole screen, leaving the arenas at 0.
    for (const vp of [{ width: 568, height: 320 }, { width: 640, height: 360 }, { width: 844, height: 390 }, { width: 1280, height: 800 }, { width: 1600, height: 900 }]) {
      await resizeTo(page, vp);
      for (const card of [...POOL_CARDS, ABSURD]) {
        const L = await dressAndMeasure(page, card);
        const where = `${vp.width}x${vp.height}, ${card.what}`;
        // Banded, because one number was a lie — and banded on the MEASUREMENTS, not on round figures. Over
        // every card the pool can deal the worst bar is `y2-symmetry`: 22.8% at 1600x900, 25.6% at 1280x800,
        // 42.5% at 844x390, 44.6% at 640x360 and **56.7%** at 568x320. So 0.45 holds everywhere except a 320px
        // phone turned over — which this diff's own nudge invites, and which genuinely cannot give a duel much
        // arena. The 0.5 band an earlier round used was padding: nothing real needed it at 844x390 or 640x360,
        // where the only thing breaching 0.45 was ABSURD, the deliberately-oversized synthetic card. ABSURD has
        // its own looser bound below instead, so the real cards keep the tight one.
        //
        // 390 and 360 are separate bands for one measured reason: `symmetry` is 42.5% at 844x390 but 44.6% here
        // and **45.2% on CI**, which has no Fredoka and so wraps the card differently. A flat 0.45 went red on
        // the runner at 162.59px against 162 — six tenths of a pixel — while passing on this machine. That is
        // the exact failure this file's own comment warned about two rounds earlier and then walked into by
        // taking a tightening at the one band with no room for it. The bound is set from the worst measured
        // ACROSS environments, not from the worst measured here.
        const cap = vp.height >= 700 ? 0.35 : vp.height >= 390 ? 0.45 : vp.height >= 360 ? 0.48 : 0.65;
        if (card === ABSURD) {
          // Its claim is only that the budget keeps the arenas usable when handed something absurd — the same
          // reason it is exempt from `expectNothingClipped`. Measured at 42.8% of the height at 844x390.
          expect(L.a.h, `${where}: even an absurd visual leaves the arenas usable`).toBeGreaterThan(vp.height * 0.3);
        } else {
          expect(L.strip.h, `${where}: the question bar stays inside the share of the height budgeted for it`).toBeLessThanOrEqual(vp.height * cap);
          expect(L.a.h, `${where}: each half keeps the height a stacked half gave away`).toBeGreaterThan(vp.height * (1 - cap));
        }
        expect(Math.abs(L.a.h - L.b.h), `${where}: both children get the same height`).toBeLessThan(2);
        // The two CANVASES, to the subpixel — the guard #389's issue asked for, because `layoutWave` derives `r`,
        // `g` and `vx` from geometry, so unequal boxes make the halves produce different arcs from one shared
        // seed and the fairness fix fails silently. A 1px divider BORDER on half B did exactly that (border-box
        // takes it out of Player 2's canvas and not Player 1's) and broke #389's rail; the divider is drawn with
        // a pseudo-element now. The 2px tolerance above is far too loose to have caught it.
        expect(Math.abs(L.canvasA.h - L.canvasB.h), `${where}: both arenas are the same height, to the subpixel`).toBeLessThan(0.5);
        expect(Math.abs(L.canvasA.w - L.canvasB.w), `${where}: both arenas are the same width, to the subpixel`).toBeLessThan(0.5);
        if (!card.html) continue;   // the text-only card has no picture to check
        // The visual is scaled to fit the budget rather than the bar growing to fit the visual, so it is still on
        // screen — a bound that worked by hiding the picture would fail the question instead of the layout.
        // `L.vis.h`, not `L.strip.h`: the strip clears 40px on the prompt's own line box alone, so the old form
        // would have passed with `#vis` removed from the DOM entirely and its label would have been a lie.
        // > 5, not > 20: a number line is a short, wide visual (14.5px sideways) and a threshold tuned to the
        // tall ones would fail it. What this catches is the visual being gone altogether.
        expect(L.vis.h, `${where}: the visual is scaled into the bar, not dropped out of it`).toBeGreaterThan(5);
        // The bound applies to everything; "nothing is cut off" applies to what the pool can actually draw.
        if (card !== ABSURD) expectNothingClipped(L, where);
        // No assertion here that the prompt and the visual share a LINE. One was written and removed: whether the
        // row fits on one line depends on text metrics, Fredoka is fetched from Google Fonts, and CI has no
        // network — so `dots` wrapped there and not locally, 46px against 42px. That is the same
        // environment-sensitive rail the review blocked round 1 for, just with a different cause. Losing the row
        // is caught by the bar cap above instead, and caught properly: deleting the two rules that make it takes
        // the bar to 190px against this cap.
      }
    }
  });

  test('guard rail: a pause inside the win hold holds the round — nothing advances behind the overlay (#301)', async ({ page }) => {
    // #301, found by PR #295's reviewer. `hold(true)` set `arena.paused` and nothing else, so the beats the
    // outcome schedules through `later()` kept running behind the pause overlay: `endWave`'s `clearWave` fired,
    // both waves ended, `duel.waveEnd()` advanced the round, and `onQuestion` wrote the strip, SPOKE the next
    // question and spawned its wave with `launchAt` already in the past. On resume two children found a wave
    // flying at a question neither had been shown.
    await startDuel(page);
    // Real game speed for this one, the way its play-screen twin in `game.spec.ts` opts out with
    // `__SNA_FAST = 1`: a compressed hold is not a hold anybody can press pause inside. At the time this was
    // written `startDuel` booted at `__SNA_FAST = 4`, which left ~362ms between the winning slice and the
    // round advancing for a `page.evaluate` round trip AND a real `page.click` — it measured 67-113ms of that
    // budget and passed six times out of six, but `playwright.config.ts` sets `retries: 0`, and a two-core
    // runner with two workers has far less headroom than this machine (PR #474 review, note 6). #748 raised
    // the suite's default to 8×, which halves that budget again (~181ms) — the override below matters even
    // more now, not less. `setSpeed` is read by `scaled()` at the moment each beat is armed, so taking it to
    // 1 here gives the hold below its full length.
    await page.evaluate(() => window.__sna.setSpeed(1));
    await winRound(page, 'a');
    const before = await page.evaluate(() => window.__sna.state());
    expect(before.decided, 'the round is decided and the hold has begun — this is the window the bug lives in').toBe(true);
    await page.click('#pause');
    await expect(page.locator('#resume')).toBeVisible();
    // Well past the won hold AND the 450ms breath after it. Before the fix the round had advanced by here.
    await page.waitForTimeout(3000);
    const held = await page.evaluate(() => window.__sna.state());
    expect(held.round, 'the round does not advance behind the overlay').toBe(before.round);
    expect(held.prompt, 'nor is the next question written onto the card').toBe(before.prompt);
    expect(await page.evaluate(() => window.__sna.arenas.a.frozen), "and Player 1's wave was never cleared").toBe(true);
    expect(await page.evaluate(() => window.__sna.arenas.b.frozen), "nor Player 2's").toBe(true);
    // And resuming spends the time the hold had LEFT, so the match carries on rather than stalling.
    await page.click('#resume');
    await page.waitForFunction(r => window.__sna.state().round === r + 1, before.round, { timeout: 5000 });
  });

  test('guard rail: nothing the screen floats over the arenas swallows a slice, or hides one (#388)', async ({ page }) => {
    await startDuel(page);
    // Two halves of one hazard, and this pull request fixed them one round apart. Floating the toast to buy back
    // 32px of arena put it OVER both canvases: first it swallowed a slice outright (input), then — once
    // `pointer-events: none` fixed that — it was still a 90%-opaque slab across one player's live bubbles and not
    // the other's (sight). `onRoundMiss` is where the second bites: `duel.ts` leaves the round RUNNING on a wrong
    // slice and still toasts for 900ms, so the two halves become unequal for the child who just erred, in the one
    // mode whose whole rule is that they are identical (#389).
    const viewports = [{ width: 844, height: 390 }, { width: 390, height: 844 }, { width: 568, height: 320 }, { width: 320, height: 568 }];
    for (const vp of viewports) {
      await resizeTo(page, vp);

      // SIGHT. A REAL wrong slice, and the toast must come up by itself: adding `.show` by hand would leave this
      // green if `onRoundMiss` stopped toasting, or toasted for 0ms, and then the whole loop would be asserting
      // about a box that is never on screen.
      // A REAL wrong slice, once. `onRoundMiss` raising the toast at all is the premise of everything below, and
      // forcing the class by hand would leave this green if it stopped toasting — that is why it is driven for
      // real. But it is driven for real ONCE, at the first viewport, and the arenas are frozen immediately
      // after: repeating it at all four kept a live match running through the whole loop, and a match that
      // reaches its tenth round mid-loop puts the results overlay over everything. The geometry of a lit toast
      // is the same whoever lit it.
      if (vp === viewports[0]) {
        await page.waitForFunction(() => {
          const st = window.__sna.state();
          return !st.decided && !st.ended && window.__sna.bubbles('a').some(b => b.label !== st.answer);
        });
        expect(await page.evaluate(() => window.__sna.wrong('a')), 'a real wrong slice raises the toast').toBe(true);
        await expect(page.locator('.toast')).toHaveClass(/show/);
        expect(await page.evaluate(() => window.__sna.state().decided), 'and leaves the round live, which is what makes this matter').toBe(false);
        await page.evaluate(() => { for (const p of ['a', 'b'] as const) window.__sna.arenas[p].paused = true; });
      }
      await page.evaluate(() => document.querySelector('.toast')!.classList.add('show'));
      // The shortest real hint in the pool: a long one wraps to more lines and is harder to swallow whole, so
      // the card most at risk is the briefest, not the wordiest.
      const card = POOL_CARDS.filter(c => c.hint).sort((a, b) => a.hint.length - b.hint.length)[0];
      // Asserted, not skipped in silence. The dressing below used to be guarded by a bare `if (c)`, so a pool
      // that stopped carrying hints would have measured whatever the live draw dealt and reported green
      // (PR #428 review, B3) — the sampling trap this very file names twice.
      expect(card, 'the pool still carries a hint to dress the card with').toBeTruthy();
      // The height probe below runs on a card of its own, and which card that is, is MEASURED at each viewport
      // rather than reasoned about: every card in the catalogue is dressed, its bar read, and the SHORTEST bar
      // wins — the bar a toast has the least room to grow into, which is the only thing that probe is about.
      //
      // Round 4's review was right that the pick was convenient rather than worst: it took the shortest-HINT
      // card, on reasoning about hints that says nothing about bars. Its proposed replacement — the card with
      // NO picture, on the argument that a bar carrying a 100-160px visual has slack a toast can never eat —
      // was landed and is the wrong way round. The catalogue's text-only card is selected for the LONGEST
      // text, so its prompt wraps the bar TALLER. Measured on that tree, room left for the toast:
      //
      //            844x390   390x844   568x320   320x568
      //   no-visual    82       125        67       200
      //   measured      8        71         8        64
      //
      // So the round-4 fix loosened this probe by up to a factor of ten while reading as a tightening. The
      // measured answer is neither card that was argued for, and is not the same card at every viewport —
      // `objects (r-count)` at three of the four — which is the reason it is chosen here by measurement and
      // not by reasoning about which card ought to be worst.
      const seen = await page.evaluate(([c, longest, all]) => {
        // Dressed inside the same evaluate as the measurement: the hint's share depends entirely on which card
        // is up, and sampling whatever the draw dealt is the trap this file has fallen into twice.
        document.querySelector('#vis')!.innerHTML = c.html;
        document.querySelector('#prompt')!.textContent = c.prompt;
        document.querySelector('#hint')!.textContent = c.hint;
        const t = document.querySelector('.toast') as HTMLElement;
        const tr = t.getBoundingClientRect();
        // A box that is missing or unlaid-out scores **-1**, not 0. It used to score 0 — the same value as
        // "the toast covers none of it" — and `.duel-half.a .duel-tag` is a two-class descendant selector
        // duplicated from the stylesheet, so renaming `.duel-tag` would have put both name-and-score
        // assertions permanently green while the toast sat on a child's live score (PR #428 review, B3).
        // -1 fails every `toBe(0)` below, so the rail now fails on a selector it cannot find.
        // Takes the toast's own box, because the entry-frame probe below measures against a DIFFERENT one:
        // closing over a single settled `tr` was how the fade's own geometry went unmeasured.
        const cover = (sel: string, box: DOMRect) => {
          const e = document.querySelector(sel);
          const r = e?.getBoundingClientRect();
          if (!r || !r.width || !r.height) return -1;
          const w = Math.max(0, Math.min(box.right, r.right) - Math.max(box.x, r.x));
          const h = Math.max(0, Math.min(box.bottom, r.bottom) - Math.max(box.y, r.y));
          return (w * h) / (r.width * r.height);          // the share of that box the toast hides
        };
        const covers = {
          arenaA: cover('#arena-a', tr), arenaB: cover('#arena-b', tr),
          tagA: cover('.duel-half.a .duel-tag', tr), tagB: cover('.duel-half.b .duel-tag', tr),
          hint: cover('#hint', tr),
        };
        // THE ENTRY FRAME — the one a child actually sees first, and the only reading that holds
        // `src/style.css`'s `.duel-screen > .toast { transform: none }`. Every measurement above is of the
        // SETTLED toast, so that rule was named by nothing in the repository: deleting the line left this whole
        // spec green at 12 passed, while the shared `.toast` entered from `translateY(-6px)` over its 200ms
        // transition — 6px ABOVE a bar the toast is aligned to the top of, which in portrait is inside Player
        // 2's arena, for the entry frames of every single round verdict (PR #428 review, B1).
        // Read with `.show` OFF and the transition suppressed. Both matter: `.toast.show` sets
        // `transform: none` ITSELF, so asserting it while shown measures the override twice and stays green
        // however line 413 changes — the same trap the height probe below avoids with `display: none`; and
        // without `transition: none` the box is wherever the 200ms happens to have reached, which is a
        // stopwatch, not a rail. `opacity: 0` costs no layout, so the un-shown box is still there to measure.
        const wasTransition = t.style.transition;
        t.style.transition = 'none';
        t.classList.remove('show');
        const entryBox = t.getBoundingClientRect();
        const entry = {
          transform: getComputedStyle(t).transform,
          arenaA: cover('#arena-a', entryBox), arenaB: cover('#arena-b', entryBox),
          tagA: cover('.duel-half.a .duel-tag', entryBox), tagB: cover('.duel-half.b .duel-tag', entryBox),
        };
        t.classList.add('show');
        t.style.transition = wasTransition;
        // The height probe, AFTER every coverage read above, because it rewrites the toast's own text — AND
        // the card. Re-dressed to whichever card in the catalogue lays out the shortest bar AT THIS VIEWPORT,
        // found by dressing all of them and reading `.duel-strip`, for the reason given where `all` is passed
        // in: both of the cards this was argued for — shortest hint, and no visual — leave more room than the
        // measured worst, and the no-visual one leaves ten times more (PR #428 review round 4, B1b).
        const dress = (d: { html: string; prompt: string; hint: string }) => {
          document.querySelector('#vis')!.innerHTML = d.html;
          document.querySelector('#prompt')!.textContent = d.prompt;
          document.querySelector('#hint')!.textContent = d.hint;
        };
        const stripH = () => document.querySelector('.duel-strip')!.getBoundingClientRect().height;
        let shortest = all[0], shortestH = Infinity;
        for (const d of all) { dress(d); const h = stripH(); if (h < shortestH) { shortestH = h; shortest = d; } }
        dress(shortest);
        // Measured against `display: none` rather than against `.show`: `.toast.show` is defined once, in
        // `src/style.css`, as `opacity: 1; transform: none` — neither is a layout property, so toggling the
        // class measured the identical layout twice and the assertion held however the CSS changed
        // (PR #428 review, B2). Taking the box out of the flow is what actually asks the question.
        // And measured on the arenas, the things that lose the height, rather than on `#strip`; and on the
        // LONGEST line this screen can raise, because a toast that wraps to a second line is the one way the
        // `q` row can outgrow the strip and take the 32px back off both children. `grid-area: q` has made
        // overlap impossible by construction, so this is the only harm the placement can still do.
        const arenas = () => [document.querySelector('#arena-a')!.getBoundingClientRect().height,
          document.querySelector('#arena-b')!.getBoundingClientRect().height];
        const wasText = t.textContent ?? '';
        t.textContent = longest;
        const withToast = arenas();
        const strip = stripH();
        const toastH = t.getBoundingClientRect().height;      // on `longest`, which is the line that has to fit
        t.style.display = 'none'; const withoutToast = arenas(); t.style.display = '';
        t.textContent = wasText;
        return {
          decided: window.__sna.state().decided, toastArea: Math.round(tr.width * tr.height),
          ...covers, entry, withToast, withoutToast, wrapped: Math.round(toastH),
          probed: shortest.what, margin: Math.round((strip - toastH) * 10) / 10,
        };
      }, [card, DUEL_TOAST_LONGEST, POOL_CARDS] as const);
      const at = `${vp.width}x${vp.height}`;
      expect(seen.toastArea, `${at}: the toast is laid out, so there is something to cover an arena with`).toBeGreaterThan(0);
      // The round is still live at every viewport, which is the premise of the whole loop: a slab over an
      // arena only matters while there are bubbles under it. Collected and never asserted before, so a match
      // that decided mid-loop would have had the rest of these readings taken over a settled arena (review,
      // note 3).
      expect(seen.decided, `${at}: the round is still live, so the arenas hold bubbles a slab can hide`).toBe(false);
      expect(seen.arenaA, `${at}: the toast covers none of Player 1's arena`).toBe(0);
      expect(seen.arenaB, `${at}: the toast covers none of Player 2's arena`).toBe(0);
      // TWO assertions, not a sum. `cover()` returns **-1** for a box it cannot find, so `tagA + tagB` went
      // green on a renamed `.duel-tag` on ONE half (-1) plus that half's partner fully covered (+1): the
      // sentinel that closed B3 opened a second road to the same green (review, note 2).
      expect(seen.tagA, `${at}: nor Player 1's name and score`).toBe(0);
      expect(seen.tagB, `${at}: nor Player 2's name and score`).toBe(0);
      // And the ENTRY frame, where the fade starts. `transform: none` is asserted on the un-shown toast, so it
      // is `src/style.css`'s `.duel-screen > .toast` rule being read and not `.toast.show`'s own override; the
      // coverage readings are the same question asked in pixels, at the 6px offset the shared `.toast` would
      // otherwise enter from (PR #428 review, B1).
      expect(seen.entry.transform, `${at}: the duel toast fades in PLACE — the shared 6px slide is overridden`).toBe('none');
      expect(seen.entry.arenaA, `${at}: and covers none of Player 1's arena in the frame it enters on`).toBe(0);
      expect(seen.entry.arenaB, `${at}: nor any of Player 2's, which is where a 6px slide upwards lands`).toBe(0);
      expect(seen.entry.tagA, `${at}: nor Player 1's name and score, entering`).toBe(0);
      expect(seen.entry.tagB, `${at}: nor Player 2's name and score, entering`).toBe(0);
      // The card it moved ONTO. Moving the slab off the arenas put it over the question, and covering the prompt
      // and the picture is the accepted trade — one child's live bubbles, asymmetrically, is worse than both
      // children's static card, symmetrically. `#hint` is not part of that trade: five pool topics carry the
      // values being compared there and NOWHERE else on the card, so swallowing it whole is a round of "Which is
      // fuller?" over two coloured bubbles. Measured on the pool's SHORTEST hint, which is the one a fixed-size
      // toast can cover entirely: 0% at three viewports and 25% at 568x320, against 100% when the toast was
      // centred in the bar rather than aligned to its top.
      expect(seen.hint, `${at}: the round's verdict never swallows the hint line whole`).toBeLessThan(0.5);
      expect(seen.hint, `${at}: there IS a hint box to measure, so 'covers none of it' means something`).toBeGreaterThanOrEqual(0);
      // And the overlay still costs no layout, which is the whole reason it is an overlay rather than a row of
      // its own — the 32px it bought back for the arenas. Both arenas, on the longest line the screen can
      // raise, against the toast taken out of the flow. Never asserted for real before; the margin at
      // 844x390 is 8px.
      expect(seen.withToast, `${at}: the toast on the bar costs the arenas no height, even wrapped`).toEqual(seen.withoutToast);
      expect(seen.wrapped, `${at}: the longest verdict is laid out, so the height probe measured something`).toBeGreaterThan(0);
      // The room the probe actually had, recorded rather than bounded: it is whatever the shortest bar in the
      // pool leaves, so a number of my own here would be a budget nobody chose. It is in the message so that
      // when the equality above goes red the next reader can see how much room there was, and on which card —
      // and so that a selection that quietly starts picking a roomier card shows up as a margin that grew.
      expect(seen.margin, `${at}: the shortest bar in the pool (${seen.probed}) still stands taller than the verdict on it`).toBeGreaterThan(0);
    }

    // INPUT — still load bearing, and now for a different target. When the toast sat over the arenas it
    // swallowed a slice; on the bar it covers `#qcard`, whose tap handler reads the question aloud again. A
    // child who taps the card during a round announcement would get nothing, which is the same defect one step
    // quieter. Asserted by what is actually under the point, and by driving a real pointer there: every other
    // slice in this file goes through `window.__sna`, which calls the `Arena` directly and so cannot see
    // anything sitting on top of anything.
    await resizeTo(page, { width: 844, height: 390 });
    const reach = await page.evaluate(() => {
      const t = document.querySelector('.toast') as HTMLElement;
      t.textContent = 'Player 1 takes the round!';
      t.classList.add('show', 'good');
      const r = t.getBoundingClientRect();
      let taps = 0;
      document.querySelector('#qcard')!.addEventListener('pointerdown', () => { taps++; }, true);
      (window as unknown as { __taps: () => number }).__taps = () => taps;
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return {
        cx: r.x + r.width / 2, cy: r.y + r.height / 2,
        onToast: hit === t || !!hit?.closest('.toast'),
        inCard: !!hit?.closest('#qcard'),
      };
    });
    expect(reach.onToast, 'the toast does not take the point for itself').toBe(false);
    expect(reach.inCard, 'the question card is what is under the toast, and is reachable').toBe(true);
    await page.mouse.move(reach.cx, reach.cy);
    await page.mouse.down();
    await page.mouse.up();
    const taps = await page.evaluate(() => (window as unknown as { __taps: () => number }).__taps());
    expect(taps, 'a tap where the toast is still reaches the card that reads the question aloud').toBeGreaterThan(0);
  });

  test('guard rail: a drawn round\'s verdict is shown, on the question it is about (#425)', async ({ page }) => {
    await startDuel(page);
    // Two failure modes, one rail, because the first fix for this swapped one for the other.
    //
    // MISTIMED: `waveEnd()` used to call `onRoundDraw` and then `advance()` in the same synchronous task, so the
    // toast text was set and the card rewritten before the browser painted — "Nobody sliced it — no point" faded
    // in on top of the NEXT question and sat there a full second.
    //
    // INVISIBLE: clearing the toast in `onQuestion` fixed that by never painting it at all. Same task, so the
    // class was added and removed between frames: two children got `sfx.miss()` and nothing to read, on the one
    // outcome that needs explaining. A rail asserting only "not shown once the card is rewritten" is green for
    // BOTH, which is exactly what the first version of this test did.
    //
    // So this watches the class itself, and records what the card said at the moment it was added.
    await page.evaluate(() => {
      const t = document.querySelector('.toast') as HTMLElement;
      const seen: { text: string; round: string; prompt: string }[] = [];
      new MutationObserver(() => {
        if (!t.classList.contains('show')) return;
        seen.push({
          text: t.textContent ?? '',
          round: document.querySelector('#round')!.textContent ?? '',
          prompt: document.querySelector('#prompt')!.textContent ?? '',
        });
      }).observe(t, { attributes: true, attributeFilter: ['class'] });
      (window as unknown as { __shown: typeof seen }).__shown = seen;
    });
    const before = await page.evaluate(() => ({ round: window.__sna.state().round, prompt: document.querySelector('#prompt')!.textContent ?? '' }));
    // Through the SCREEN's own path, not `duel.settleDraw()` directly. The defect lives in the wiring between
    // the scorer and the screen, so a rail that calls the scorer proves nothing about it: driving `settleDraw`
    // straight left both failure modes green under mutation. Clearing both waves is what an undecided wave
    // running out does — `endWave` does exactly this — and each arena's `onWaveEnd` then reaches the screen.
    await page.evaluate(() => { for (const p of ['a', 'b'] as const) window.__sna.arenas[p].clearWave('#ffffff'); });
    // Wait for the match to move on — which happens either way — and THEN look at what was shown, so a verdict
    // that was never painted fails on the assertion below with its reason, not as a bare timeout.
    await page.waitForFunction(r => window.__sna.state().round > r, before.round, { timeout: 15_000 });
    const shown = await page.evaluate(() => (window as unknown as { __shown: { text: string; round: string; prompt: string }[] }).__shown);
    const draw = shown.filter(s => s.text.includes('Nobody sliced it'));
    expect(draw.length, 'the drawn round is announced at all — it is the only thing telling two children why neither scored').toBeGreaterThan(0);
    expect(draw[0].round, 'the verdict names the round that is on the screen behind it').toBe(`Round ${before.round} of 10`);
    expect(draw[0].prompt, 'and that round\'s question, not the next one').toBe(before.prompt);

  });

  test('portrait keeps the stacked duel as a fallback, and asks for a sideways screen (#388)', async ({ page }) => {
    await startDuel(page);
    // Freeze both arenas for the sweep. This test measures LAYOUT over dozens of dressed cards and takes tens of
    // seconds; left running, the match reaches its tenth round part-way through and `showResults` puts a modal
    // over the whole screen, after which every hit test fails for a reason that has nothing to do with the
    // budget. Pausing the arenas is the screen's own mechanism — `syncPaused` sets exactly this — so no wave
    // ends, no round advances, and nothing rewrites the card underneath the measurements.
    await page.evaluate(() => { for (const p of ['a', 'b'] as const) window.__sna.arenas[p].paused = true; });
    // A rotate GATE was rejected: a tablet with its orientation locked would lose the mode outright. So portrait
    // still plays, stacked as before — Player 2 on top, the card between, Player 1 on the bottom.
    //
    // Three portrait sizes, not one. The first version of this test ran at 390x844 alone, which is the ONE
    // portrait width where `--slot` is 28px and nothing clips: `clamp(22px, min(7.2vw, 5vh), 40px)` reaches its
    // 40px maximum past ~556px wide, so twelve stars are 152px on every tablet in portrait and the old 132px
    // budget cut the bottom row in half there. 320px is the other end — narrow enough that a number line
    // overflows the card, which is the horizontal clip. No project in `playwright.config.ts` runs this file at
    // either size (`tablet` is `testMatch: /viewport\.spec\.ts/`), so the fixtures were unreachable by
    // construction and the rail could not have failed however wrong the CSS was.
    for (const vp of [{ width: 390, height: 844 }, { width: 800, height: 1280 }, { width: 320, height: 568 }]) {
      await resizeTo(page, vp);
      for (const card of [...POOL_CARDS, ABSURD]) {
        const P = await dressAndMeasure(page, card);
        const where = `${vp.width}x${vp.height}, ${card.what}`;
        expect(P.b.bottom, `${where}: Player 2 keeps the top half`).toBeLessThanOrEqual(P.strip.y + 1);
        expect(P.strip.bottom, `${where}: Player 1 keeps the bottom half, the card between them`).toBeLessThanOrEqual(P.a.y + 1);
        expect(Math.abs(P.a.x - P.b.x), `${where}: the halves are stacked, not side by side`).toBeLessThan(2);
        expect(P.rotate.h, `${where}: portrait tells the players there is a better way round`).toBeGreaterThan(0);
        expect(Math.abs(P.canvasA.h - P.canvasB.h), `${where}: both arenas are the same height, to the subpixel`).toBeLessThan(0.5);
        expect(Math.abs(P.canvasA.w - P.canvasB.w), `${where}: both arenas are the same width, to the subpixel`).toBeLessThan(0.5);
        // Asserted here, not merely measured. The previous version computed a crop count in portrait and then
        // never looked at it, which is how a budget that cut every tablet's counting card shipped green.
        if (card !== ABSURD) expectNothingClipped(P, where);
      }
      // The fallback's floor, once per viewport on the tallest card the pool can draw.
      //
      // 24%, measured rather than chosen, and it is a LOW bar on purpose. On the twelve-star card each arena is
      // 144px at 320x568, 180px at 360x640, 268.9px at 390x844 and 467.8px at 800x1280 — and on `main` the same
      // card gives 142.5 / 178.5 / 267.4 / 461.3, so this branch is ahead at every one of them: floating the
      // toast gives back more than the nudge line costs. Portrait on a small phone is cramped on `main` too,
      // which is exactly why #388 calls this layout the fallback and not the design. So the floor is set to catch
      // the card GROWING — the failure this pull request could plausibly cause — not to assert that a 320px phone
      // in portrait is a good place to duel, which it is not.
      // By kind and topic, not by prose in `what`, and with no `??` fallback: the previous form resolved to
      // `r-count`'s TWO butterflies in one row, while the 24% floor below was derived from the twelve-star
      // three-row card — a floor calibrated on one card and applied to another. A missing card is now a failure
      // here rather than a silent degradation to the text-only one.
      const tallest = POOL_CARDS.find(c => c.kind === 'objects' && c.topic === 'y2-fractions');
      expect(tallest, 'the twelve-star card the floor below is measured on').toBeDefined();
      const P = await dressAndMeasure(page, tallest!);
      expect(P.a.h, `${vp.width}x${vp.height}: the portrait fallback keeps a floor under each arena`).toBeGreaterThan(vp.height * 0.24);
    }
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
    // a frame or two of round 2; round 2's wave is in the air for well over 300 ms even at 8× (#748).
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__sna.state().round), 'one wave end per arena, one advance per round').toBe(2);
    await page.click('#pause');
    await expect(page.locator('#resume')).toBeVisible();
    expect(await page.evaluate(() => window.__sna.arenas.a.paused && window.__sna.arenas.b.paused)).toBe(true);
    await page.click('#resume');
    expect(await page.evaluate(() => window.__sna.arenas.a.paused || window.__sna.arenas.b.paused)).toBe(false);
  });

  /**
   * A draw earlier in the match, not the last round (#379 review, pr-test-analyzer). The quit-before-overlay
   * test below proves the LAST round's draw survives the early-commit path; this proves a draw's tally, once
   * recorded by `settleDraw()`, is carried forward inside `Duel`'s own `tally` object through every later round
   * and still reaches the real save at match end — through the real screen, not only the pure `Duel` class the
   * unit tests exercise.
   */
  test('a round nobody slices mid-match still tallies a try, no hit, for the seat that never answered — reaching the real save (#379)', async ({ page }) => {
    await startDuel(page, dojoSeeds('fresh'));
    expect(await page.evaluate(() => window.__seedMiss), 'the page landed on a day dojoSeeds() did not build').toBe(false);
    const topic = await page.evaluate(() => window.__sna.state().topic);
    // Round 1: nobody slices, same trigger as the pause test above — both waves fall untouched.
    await page.waitForFunction(() => window.__sna.state().round === 2, undefined, { timeout: 30_000 });
    // Rounds 2-10: Player 1 wins every one.
    for (let r = 2; r <= 10; r++) {
      await page.waitForFunction(r => window.__sna.state().round === r, r);
      await winRound(page, 'a');
    }
    await expect(page.locator('.duel-end')).toBeVisible({ timeout: 10_000 });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!));
    // Nine rounds won outright plus round 1's untouched draw: ten tries, nine hits — round 1 counts as a try
    // Player 1 never answered, the same shape a mission scores an untouched question.
    expect(saved.progress[topic], "round 1's draw reaches the save as a try with no hit, not as nothing")
      .toMatchObject({ hits: 9, tries: 10, plays: 0, stars: 0 });
    expect(saved.duels[0]).toMatchObject({ winner: 'a', scoreA: 9, scoreB: 0, rounds: 10 });
  });

  /**
   * The third `winner` arm (#397 round 2, note 1). `duelEarnsCertificate` is unit-pinned for all three values,
   * but the *call site* in `ui/duel.ts` is reachable only from a real match — and weakening it to
   * `r.winner === 'draw'` leaves every unit test green while a **defeat** files `year1:duel` into the child's
   * own album, carrying the loser's score and stars off a tally that is not theirs. The draw case is covered
   * by the Daily Dojo test below; this is the loss.
   */
  test('a match Player 2 wins earns the profile nothing — no button, no album entry (#16 item 5)', async ({ page }) => {
    await startDuel(page, dojoSeeds('fresh'));
    expect(await page.evaluate(() => window.__seedMiss), 'the page landed on a day dojoSeeds() did not build').toBe(false);
    for (let r = 1; r <= 10; r++) {
      await page.waitForFunction(r => window.__sna.state().round === r, r);
      await winRound(page, r <= 4 ? 'a' : 'b');        // 4-6: Player 1 loses, and is not merely held to a draw
    }
    await expect(page.locator('.duel-end')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.duel-end h2')).toHaveText('Player 2 wins!');
    expect(await page.evaluate(() => window.__sna.state())).toMatchObject({ ended: true, scoreA: 4, scoreB: 6 });
    await expect(page.locator('.duel-end #cert'), 'a loss offers no certificate').toHaveCount(0);
    expect(await page.evaluate(() => window.__sna.certificate()), 'and there is nothing to draw').toBeNull();
    expect(await page.evaluate(() => window.__sna.certWords())).toBeNull();
    // Read from the save, not the overlay: filing happens when the overlay is built, so a missing button is
    // not by itself evidence that nothing was written.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!).certs), 'the album is untouched').toEqual([]);
    // The coins still pay — a duel pays the device per decided round whoever won (#347) — so this test is
    // about the certificate alone and not about a results screen that did nothing.
    await expect(page.locator('.duel-end .coin-gain')).toHaveText('+10 🪙');
    // ...and the duel history DOES take it (#16, the last piece of item 5). This is the pair to the album
    // assertion three lines up, and the reason both are here: a loss earns no award but is still a match that
    // happened, so exactly one of the two writes must fire. A row filed only on a win would make the list
    // read as a run of victories.
    const duels = await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!).duels);
    expect(duels.length, 'a loss is still a match the history keeps').toBe(1);
    // The FULL stored shape (#415 round 2, B2): `year` is the title the row prints and `topic` the durable
    // id it does not, and neither was read back here — so `o.year.title` → `o.year.id` would have shipped
    // "year1" to a child with the suite green, and swapping `topic` and `title` would have passed too.
    expect(duels[0]).toMatchObject({ winner: 'b', scoreA: 4, scoreB: 6, rounds: 10, year: 'Year 1' });
    expect(typeof duels[0].at, 'stamped, so the list can order itself').toBe('number');
    expect(duels[0].topic, 'the topic id, which survives a rename').toMatch(/^y1-/);
    expect(duels[0].title, 'and the title a child reads, which does not').toBeTruthy();
    expect(duels[0].title).not.toBe(duels[0].topic);
  });

  /**
   * #470: `recordCert()`'s own `save()` swallows a refused `setItem` (#151) and the 🎓 row used to be drawn
   * from the in-memory `cert` regardless, offering a keepsake the album does not actually hold. A win on a
   * store that refuses every write must not offer the row at all — the same shape as the loss/draw cases
   * above, but reached because the store refused rather than because nothing was earned.
   */
  test('a won match on a refusing store offers no certificate row, and the album stays untouched (#470)', async ({ page }) => {
    await startDuel(page, dojoSeeds('fresh'), 0, { refuseWrites: true });
    expect(await page.evaluate(() => window.__seedMiss), 'the page landed on a day dojoSeeds() did not build').toBe(false);
    for (let r = 1; r <= 10; r++) {
      await page.waitForFunction(r => window.__sna.state().round === r, r);
      await winRound(page, 'a');   // Player 1 takes every round, so the certificate path is definitely reached
    }
    await expect(page.locator('.duel-end')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.duel-end h2')).toHaveText('Player 1 wins!');
    expect(await page.evaluate(() => window.__sna.state())).toMatchObject({ ended: true, scoreA: 10, scoreB: 0 });
    // The row a refused write must not offer — this is the fix's own point, not a side effect of the loss/draw
    // cases above: a certificate WAS earned here, and is still withheld because it was not kept.
    await expect(page.locator('.duel-end #cert'), 'a refused write earns no row, whatever was won').toHaveCount(0);
    // The seeded save from before `refuseWrites` took hold has no `certs` key at all — proving the album is
    // genuinely untouched rather than merely not re-read.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!).certs), 'nothing reached the store').toBeUndefined();
    // What was EARNED is unaffected by the store refusing it (#470's own scope: it does not touch `save()`'s
    // swallow) — the window hooks answer the match's own result, not the album's, same as every other test here.
    const png = await page.evaluate(() => window.__sna.certificate());
    expect(png, 'the match itself still earned one — only the album is missing it').toMatch(/^data:image\/png;base64,/);
    const words = await page.evaluate(() => window.__sna.certWords());
    expect(words?.child, 'the drawn certificate is unaffected — #470 only withholds the row that claims to have kept it').toBe('Ada');
  });

  /**
   * #470 review round 1 (silent-failure-hunter): the fix above only read `isWriteFailing()`, missing the
   * *other* refusal `recordCert()`'s own `save()` can hit — `isReadOnlySave()`'s latch (#232), set when the
   * active profile's stored blob is from a newer build. Reached through the same first-run wizard the
   * `game.spec.ts` mission-side sibling of this test walks through, since a future-build blob is unreadable
   * and cannot skip it the way `startDuel`'s own seed (an old-but-readable `v: 1`) does.
   */
  test('a won match earned under a newer-build save offers no certificate row (#470 review round 1)', async ({ page }) => {
    await page.addInitScript(v => localStorage.setItem('sna:v1', v), JSON.stringify({ v: SAVE_VERSION + 1, name: 'Bo', avatar: 'blaze', coins: 99 }));
    await page.addInitScript((fast) => { window.__SNA_FAST = fast; }, FAST);
    await recordingEngine(page);
    await page.goto('/');
    // The future blob is unreadable, so `load()` latches read-only and hands back `DEFAULT` — onboarded: false —
    // which sends this session through the first-run wizard.
    await expect(page.locator('.avatar-screen')).toBeVisible();
    await page.click('.avatar-card[data-id="volt"]');
    await page.click('#next');
    await page.fill('#name', 'Ada');
    await page.click('#go');
    await expect(page.locator('.intro-card')).toBeVisible();
    await page.click('#intro-go');
    await expect(page.locator('.home')).toBeVisible();
    await page.click('.island[data-year="year1"]');
    await page.click('#duel');
    await expect(page.locator('.duel-screen')).toBeVisible();
    await page.waitForFunction(() => window.__sna?.state().prompt);
    for (let r = 1; r <= 10; r++) {
      await page.waitForFunction(r => window.__sna.state().round === r, r);
      await winRound(page, 'a');   // Player 1 takes every round, so the certificate path is definitely reached
    }
    await expect(page.locator('.duel-end')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.duel-end h2')).toHaveText('Player 1 wins!');
    await expect(page.locator('.duel-end #cert'), 'a read-only latch earns no row, whatever was won').toHaveCount(0);
    // The stored blob is the untouched future save this build must never overwrite — not `Bo`'s bytes
    // rewritten as `Ada`'s session, and no `certs` key added to it.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!));
    expect(stored.name, 'the newer-build blob on disk must survive this session untouched').toBe('Bo');
    expect(stored.certs, 'nothing reached the store').toBeUndefined();
    // What was EARNED this session is unaffected — the window hooks answer the match's own result.
    const png = await page.evaluate(() => window.__sna.certificate());
    expect(png, 'the match itself still earned one — only the album is missing it').toMatch(/^data:image\/png;base64,/);
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
    // #16 item 5: five each is a DRAW, and a draw earns no certificate — nobody won, and the save has one
    // profile, so there is no second child to award. The negative case for the 6–4 test above: no button, no
    // album entry, and nothing for the hook to draw.
    await expect(page.locator('.duel-end #cert')).toHaveCount(0);
    expect(saved.certs, 'a drawn match files no certificate').toEqual([]);
    // But the history still takes it, and this is the only place `winner: 'draw'` is written by the real
    // screen rather than by a fixture (#415 review, note 3) — the value `duelHistoryLine` renders as "A draw".
    expect(saved.duels, 'a draw is still a match that happened').toHaveLength(1);
    expect(saved.duels[0]).toMatchObject({ winner: 'draw', scoreA: 5, scoreB: 5, rounds: 10 });
    expect(await page.evaluate(() => window.__sna.certificate())).toBeNull();
    expect(await page.evaluate(() => window.__sna.certWords()), 'nothing to draw, so no words either').toBeNull();
  });

  /**
   * guard rail (#398). The worst case needs a win (draws earn no certificate button), two dojo rows (the
   * volume challenge one answer short, its set finishing with it) and a starting purse that crosses a sticker
   * threshold when the match's own coins and the dojo bonus land — every row this overlay can show, at once,
   * on the shortest phone in the matrix. Before the fix `#again` sat off the bottom of a 390x664 viewport with
   * nothing on screen saying there was more to scroll to; `Rematch`/`Islands` is the only way off this screen.
   */
  test('Rematch/Islands stays reachable when the results overlay is at its tallest (#398)', async ({ page }) => {
    await startDuel(page, dojoSeeds('short'), 25);
    expect(await page.evaluate(() => window.__seedMiss), 'the page landed on a day dojoSeeds() did not build').toBe(false);
    for (let r = 1; r <= 10; r++) {
      await page.waitForFunction(r => window.__sna.state().round === r, r);
      await winRound(page, 'a');      // every round to Player 1: a win, not a draw, is what earns the certificate
    }
    await expect(page.locator('.duel-end')).toBeVisible({ timeout: 10_000 });
    // Every row this overlay can carry, confirmed present before the position is checked — a modal that is
    // short because a row silently failed to render would pass the bounding-box assertion for the wrong reason.
    await expect(page.locator('.duel-end .dojo-bonus')).toHaveCount(2);
    await expect(page.locator('.duel-end .unlock')).toHaveCount(2);   // 25 + 10 + 35 = 70 crosses both 30 and 70
    await expect(page.locator('.duel-end #cert')).toBeVisible();
    // Class-independent on purpose: the fix's own markup adds a class to this row, and a locator naming it
    // would stop failing on the un-fixed markup for the wrong reason (the class not existing) rather than for
    // the actual defect (the row laid out below the fold).
    await expect(page.locator('#again')).toBeInViewport();
    await expect(page.locator('#home')).toBeInViewport();
    // #398 round 2 review, non-blocking: `resultsModal()`'s own worst case got a click-target sweep for the
    // nav row painting over `#cert`; `.duel-end` is hand-maintained separately and received the identical
    // sticky→flex-sibling fix, so it needs the same sweep rather than trusting the shared CSS selector alone.
    // Settle `.modal`'s own pop-in first — see the matching comment in game.spec.ts's sweep for why.
    await page.waitForTimeout(500);
    const scroller = page.locator('.duel-end .scroll');
    const scrollerBox = (await scroller.boundingBox())!;
    const maxScroll = await scroller.evaluate(el => el.scrollHeight - el.clientHeight);
    let sawCertOnScreen = false;
    // See the matching sweep in game.spec.ts for why this tolerance is wider than one pixel.
    const slack = 24;
    // `maxScroll` itself is always swept explicitly (round 3 review, non-blocking B2) — see game.spec.ts.
    const steps = []; for (let top = 0; top < maxScroll; top += 15) steps.push(top); steps.push(maxScroll);
    for (const top of steps) {
      await scroller.evaluate((el, t) => { el.scrollTop = t; }, top);
      const certBox = (await page.locator('.duel-end #cert').boundingBox())!;
      const onScreen = certBox.y >= scrollerBox.y - slack && certBox.y + certBox.height <= scrollerBox.y + scrollerBox.height + slack;
      if (!onScreen) continue;
      sawCertOnScreen = true;
      const atCertTop = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el ? `${el.id} ${el.className}` : '';
      }, { x: certBox.x + certBox.width / 2, y: certBox.y + 2 });
      expect(atCertTop, `at scrollTop ${top}, the nav row must not paint over the certificate button`).not.toContain('nav');
      expect(atCertTop, `at scrollTop ${top}, the point must land on the certificate button itself`).toContain('cert');
    }
    expect(sawCertOnScreen, 'the sweep must actually see the certificate button visible at some scroll position').toBe(true);
  });

  /**
   * #375/#441: a finished match is committed at match end, so leaving before the overlay appears keeps it.
   *
   * Every write a duel produces used to sit inside `showResults()`, which `onMatchEnd` schedules ~1.3 s later
   * through the screen's scope-bound `later()`. That window is live and interactive — `hold()` is only reached
   * *inside* `showResults`, so both arenas are still running and `#pause` is still bound — and Pause → Quit
   * runs `cleanup()` → `scope.dispose()`, which clears every pending timer. A completed ten-round match paid
   * the child nothing: no coins, no dojo move, no accuracy, no certificate, no history row, and no toast or
   * log to tell it from a match that was never finished. A child who wins and immediately backs out to show
   * someone got nothing for it.
   *
   * **The quit here is at the EARLIEST point the window opens, not the latest** (#375 round 1, B1). Waiting
   * for `state().ended` would only prove the ~1.3 s the overlay's own timer holds, and miss the larger
   * ~1.45 s before it: winning the last round schedules `endWave` (~1 s) and then `waveEnd` (~450 ms), both
   * scope-bound, and only that second callback runs `duel.waveEnd()` → `end()` → `onMatchEnd`. Throughout it
   * `duel.ended` is false, so `syncPaused()` leaves both arenas running and `#pause` bound. So this polls for
   * `round === rounds && decided && !ended` — the instant the last round is won, before either timer — and
   * quits there. A commit that happened any later than that would fail this.
   *
   * The clicks after the poll are synchronous: `#pause` builds the pause modal in the same task, so `#quit`
   * is in the DOM by the time this asks for it.
   */
  test('a match left through Pause the instant the last round is won is still paid, recorded and filed (#375, #441)', async ({ page }) => {
    await startDuel(page, dojoSeeds('fresh'));
    expect(await page.evaluate(() => window.__seedMiss), 'the page landed on a day dojoSeeds() did not build').toBe(false);
    const topic = await page.evaluate(() => window.__sna.state().topic);
    for (let r = 1; r <= 9; r++) {
      await page.waitForFunction(r => window.__sna.state().round === r, r);
      await winRound(page, 'a');                     // rounds 1-9; round 10 is driven by hand below
    }
    // Round 10 is sliced, read and quit inside ONE page.evaluate, so no timer of any kind can run in between
    // (#375 round 2, B2). Polling for `decided && !ended` and quitting afterwards could not tell the winning
    // slice's commit from the `waveEnd` one 250 ms later: `{round: 10, decided: true, ended: false}` is true
    // of both, so the test passed either way and its pass depended on beating `endWave` on the runner. Here
    // `answer('a')` and the `state()` read are in the same synchronous task, so `coins: 10` can only have
    // been written by the commit inside `duel.hit()` itself.
    await page.waitForFunction(() => window.__sna.state().round === 10);
    await page.waitForFunction(p => { const s = window.__sna.state(); return !s.decided && !s.ended && window.__sna.bubbles(p).some(b => b.label === s.answer); }, 'a');
    const afterHit = await page.evaluate(() => {
      const t0 = performance.now();
      const ok = window.__sna.answer('a');
      const ms = performance.now() - t0;            // the slice's whole task, commit included (#375 round 2, B3)
      const s = window.__sna.state();
      (document.querySelector('#pause') as HTMLButtonElement).click();
      (document.querySelector('#quit') as HTMLButtonElement).click();
      return { ok, ms, ...s };
    });
    expect(afterHit, 'the winning slice commits in its own task, not on a timer')
      .toMatchObject({ ok: true, round: 10, decided: true, ended: false, coins: 10, taught: { hits: 10, tries: 10 } });
    // #375 round 2, B3: `commitMatch` now runs inside the slice handler, which `Arena.onHit` calls from the
    // render loop's own task. This is the measurement the game rules ask for before a change on that path is
    // pushed. The budget is a ceiling on the WHOLE handler — hit detection, the burst, `floatText`, the
    // toast and the four load/save round trips — and it only ever goes down (`.claude/rules/guardrails.md`).
    // Observed headless over four runs: 1.5, 2.2, 2.7, 4.4 ms. One frame at 60 fps is 16.7 ms, and this task
    // runs once per match. The render loop itself is held separately by `game.spec.ts`'s "still renders at
    // speed" rail, which reads fps=60.3 ratio=1.00 on this head — unchanged, since no arena code moved.
    console.log(`[guard rail] last-slice task = ${afterHit.ms.toFixed(1)} ms (commit included)`);
    expect(afterHit.ms, 'the commit must not cost the slice its frame').toBeLessThan(16);
    await expect(page.locator('.home'), 'the child is back on the islands').toBeVisible();
    // The overlay never ran: this is the window, not a test that quit after the results screen paid out.
    await expect(page.locator('.duel-end')).toHaveCount(0);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!));
    expect(saved.coins, 'a coin per decided round reached the save').toBe(10);
    expect(saved.progress[topic], 'and Sensei was told what Player 1 answered').toMatchObject({ hits: 10, tries: 10, plays: 0, stars: 0 });
    // Exactly one of the three volume ids is the day's, and `dojoSeeds('fresh')` leaves it untouched, so the
    // day's challenge carries this match's ten answers and the other two are absent.
    const volume = (['correct15', 'correct20', 'correct25'] as const).map(id => saved.dojo.progress[id]).filter((n: number | undefined) => n !== undefined);
    expect(volume, "the Daily Dojo heard about the match").toEqual([10]);
    expect(saved.duels, 'the match itself outlived the overlay that never opened').toHaveLength(1);
    expect(saved.duels[0]).toMatchObject({ winner: 'a', scoreA: 10, scoreB: 0, rounds: 10 });
    expect(saved.certs, 'and the win filed its certificate').toHaveLength(1);
    expect(saved.certs[0]).toMatchObject({ id: 'year1:duel', title: 'Ninja Duel', duel: true });
  });

  /**
   * The draw half of the same window (#375 round 2, B1): a last round **nobody slices**.
   *
   * The test above only ever exercises a last round that is WON, so the commit in `waveEnd` — the one that
   * covers an undecided last round — was dead code under the whole suite: deleting it left 1932 unit tests
   * and all eleven duel e2e tests green. Two children failing to slice the answer in time on the last round
   * is an ordinary way for a match to end, and quitting right then is exactly what #375/#441 are about.
   *
   * The quit is driven off `Arena`'s own `waveActive`, not off a timeout and not off anything the commit
   * writes. `waveActive` flips false in the same statement that calls `onWaveEnd` (`arena.ts`), which is what
   * sets `waveDone[p]`, so "both false" is precisely the moment the screen's own `waveEnd(p)` runs its body:
   * the early commit below, then `duel.settleDraw()` (#301/#425 — announced synchronously, not on a timer, so
   * the round is already `decided` by the time this reads `state()`), and only THEN the deferred
   * `duel.waveEnd()` — which would advance and end the match — is left sitting on its `HOLD.draw + 100` timer
   * when `dispose()` cancels it. Reading `bubbles()` instead would be wrong: a bubble that is fading is
   * already out of `bubbles()` while the arena still counts it live, so the poll could fire before the commit
   * and fail for a reason that is not the bug. It needs a cast because `waveActive` is private to `Arena` —
   * deliberately, since only this rail has any business reading it.
   */
  test('a last round nobody slices is still paid and recorded if the child quits before the overlay (#375, #441)', async ({ page }) => {
    await startDuel(page, dojoSeeds('fresh'));
    expect(await page.evaluate(() => window.__seedMiss), 'the page landed on a day dojoSeeds() did not build').toBe(false);
    const topic = await page.evaluate(() => window.__sna.state().topic);
    for (let r = 1; r <= 9; r++) {
      await page.waitForFunction(r => window.__sna.state().round === r, r);
      await winRound(page, 'a');
    }
    // Round 10 arrives and both waves launch; then nobody slices, and they run out.
    await page.waitForFunction(() => window.__sna.state().round === 10);
    const waveActive = (p: 'a' | 'b') => (window.__sna.arenas[p] as unknown as { waveActive: boolean }).waveActive;
    await page.waitForFunction(`(${waveActive})('a') && (${waveActive})('b')`);
    const quitState = await page.evaluate(async fn => {
      const active = eval(`(${fn})`) as (p: 'a' | 'b') => boolean;
      await new Promise<void>(done => {
        const tick = () => { if (!active('a') && !active('b')) done(); else requestAnimationFrame(tick); };
        tick();
      });
      const s = window.__sna.state();
      (document.querySelector('#pause') as HTMLButtonElement).click();
      (document.querySelector('#quit') as HTMLButtonElement).click();
      return s;
    }, waveActive.toString());
    // Decided (as a draw, by `settleDraw()` above) but unended: `duel.waveEnd()` — which would advance and
    // end the match — was still sitting on its deferred timer when `dispose()` cleared it. Only the early
    // commit in the screen's own `waveEnd(p)` can have paid this match.
    expect(quitState, 'quit with the last round drawn and the match not ended')
      .toMatchObject({ round: 10, decided: true, ended: false, coins: 9 });
    await expect(page.locator('.home'), 'the child is back on the islands').toBeVisible();
    await expect(page.locator('.duel-end')).toHaveCount(0);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!));
    // Nine decided rounds, not ten: the last one paid nobody, which is what makes this the draw path.
    expect(saved.coins, 'a coin per DECIDED round — round 10 decided nothing').toBe(9);
    // Ten tries, not nine (#379): round 10 is a genuine draw — nobody sliced it — and `settleDraw()` now tallies
    // that the same way a mission scores an untouched question, a try with no hit. This is also the proof the
    // early-commit ordering fix holds: `settleDraw()` runs before the screen's own `commitOnce(duel.result())`
    // for the last round, so this quit-before-overlay path is the one case that would have silently dropped
    // round 10's try forever if that ordering ever regressed.
    expect(saved.progress[topic], 'Player 1 answered nine rounds and round 10 counts as a tenth, unanswered')
      .toMatchObject({ hits: 9, tries: 10, plays: 0, stars: 0 });
    const volume = (['correct15', 'correct20', 'correct25'] as const).map(id => saved.dojo.progress[id]).filter((n: number | undefined) => n !== undefined);
    expect(volume, 'the Daily Dojo heard about the nine').toEqual([9]);
    expect(saved.duels, 'the match still happened, and a 9-0 is still a Player 1 win').toHaveLength(1);
    expect(saved.duels[0]).toMatchObject({ winner: 'a', scoreA: 9, scoreB: 0, rounds: 10 });
    expect(saved.certs, 'and a Player 1 win earns its certificate however the last round went').toHaveLength(1);
  });
});
