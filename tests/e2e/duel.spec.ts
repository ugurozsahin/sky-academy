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
    // The tally reached the topic Sensei ranks by, and not as a `play`: a duel earns no stars, so `plays` stays
    // 0 and `accuracy()` reads null for a duel-only topic. Read from the save rather than from the overlay —
    // the state hook would be green with `recordAccuracy()` never called.
    const learnt = await page.evaluate(() => JSON.parse(localStorage.getItem('sna:v1')!).progress[window.__sna.state().topic]);
    expect(learnt, "the six rounds Player 1 answered, five of them right first time").toMatchObject({ hits: 5, tries: 6, plays: 0, stars: 0 });
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
    return { a: box('#half-a'), b: box('#half-b'), strip: box('#strip'), rotate: box('.duel-rotate'), prompt: box('#prompt'), vis: box('#vis') };
  });

  /**
   * What a question can put in the card, keyed by the class that SIZES it in `style.css` — plus one deliberately
   * taller than anything the pool holds. The duel draws its topic with `Math.random()`, so measuring whatever
   * round 1 happens to deal is a sample of one: the first version of this rail quoted a 62–106px bar from six
   * such samples and missed `y1-time`, whose fixed 120px `.clock` made it 165px. Overwriting `#vis` makes the
   * worst case reachable on demand, and the absurd row is what makes the bound structural rather than
   * "big enough for a clock" — an unbounded visual once left the arenas at ZERO height.
   */
  const VISUALS: Record<string, string> = {
    'no visual': '',
    'clock (120px, the pool\'s tallest)': '<div class="vis"><svg viewBox="0 0 100 100" class="clock"><circle cx="50" cy="50" r="47" class="face"/></svg></div>',
    'frac (110px)': '<div class="vis"><svg viewBox="0 0 100 100" class="frac"><path d="M0 0H100V100H0Z"/></svg></div>',
    'dots (100px)': '<div class="vis"><svg viewBox="0 0 120 80" class="dots"><circle cx="20" cy="20" r="9"/></svg></div>',
    'two ten-frames': `<div class="vis">${'<div class="tenframe">' + '<i></i>'.repeat(10) + '</div>'}</div>`,
    'taller than anything in the pool': '<div class="vis"><div style="width:120px;height:600px"></div></div>',
  };
  /**
   * Put `html` in the card's visual slot, along with the longest prompt and hint the year-1 duel pool can
   * actually produce — 33 and 49 characters, from `y1-months` and `y1-length`, found by generating 200 questions
   * for each of the pool's 28 topics. Real strings, not invented ones: a hint half again as long as anything the
   * pool holds would cap the layout against a case no child ever sees. The text matters as much as the visual —
   * in a ROW the card wraps, and a long prompt with a long hint is another 20px of bar.
   */
  const dressCard = (page: Page, html: string) => page.evaluate(h => {
    document.querySelector('#vis')!.innerHTML = h;
    document.querySelector('#prompt')!.textContent = 'Which day comes before Wednesday?';
    document.querySelector('#hint')!.textContent = 'yellow sunflower: 14 cm · purple sunflower: 10 cm';
  }, html);

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
    // The bar has to be BOUNDED, not merely short on the question that came up. Before the cap: a clock question
    // took 165px of a 390px screen (42%) and handed each child 193px — worse than the 213px that made the stacked
    // layout unplayable — and a visual taller than the pool holds took the whole screen, leaving the arenas at 0.
    for (const vp of [{ width: 844, height: 390 }, { width: 1280, height: 800 }, { width: 1600, height: 900 }]) {
      await resizeTo(page, vp);
      for (const [what, html] of Object.entries(VISUALS)) {
        await dressCard(page, html);
        const L = await boxes(page);
        const where = `${vp.width}x${vp.height}, ${what}`;
        // The measured worst case is a clock question carrying the pool's longest prompt AND hint at 844x390:
        // 141px of bar, 249px of arena — 36% and 64%. The thresholds sit clear of that rather than hugging it,
        // deliberately: text metrics differ between here and CI (no Fredoka there), so a bound 7px off the
        // measurement is a rail that goes red on the runner and not on the desk. Loose enough to survive that,
        // tight enough to still catch both regressions it exists for — deleting the visual budget takes the bar
        // to 439px, deleting the row rules to 190px, and each fails here with room to spare.
        // The two are deliberate complements — the bar may take at most 45%, each arena keeps at least 55%.
        expect(L.strip.h, `${where}: the question bar stays inside the share of the height budgeted for it`).toBeLessThanOrEqual(vp.height * 0.45);
        expect(L.a.h, `${where}: each half keeps the height a stacked half gave away`).toBeGreaterThan(vp.height * 0.55);
        expect(Math.abs(L.a.h - L.b.h), `${where}: both children get the same height`).toBeLessThan(2);
        if (!html) continue;
        // The visual is scaled to fit the budget rather than the bar growing to fit the visual, so it is still on
        // screen — a bound that worked by hiding the picture would fail the question instead of the layout.
        expect(L.strip.h, `${where}: the visual is scaled into the bar, not dropped out of it`).toBeGreaterThan(40);
        // No assertion here that the prompt and the visual share a LINE. One was written and removed: whether the
        // row fits on one line depends on text metrics, Fredoka is fetched from Google Fonts, and CI has no
        // network — so `dots` wrapped there and not locally, 46px against 42px. That is the same
        // environment-sensitive rail the review blocked round 1 for, just with a different cause. Losing the row
        // is caught by the bar cap above instead, and caught properly: deleting the two rules that make it takes
        // the bar to 190px against this cap.
      }
    }
  });

  test('portrait keeps the stacked duel as a fallback, and asks for a sideways screen (#388)', async ({ page }) => {
    await startDuel(page);
    // A rotate GATE was rejected: a tablet with its orientation locked would lose the mode outright. So portrait
    // still plays, stacked as before — Player 2 on top, the card between, Player 1 on the bottom — and the only
    // new thing on the card is the nudge.
    await resizeTo(page, { width: 390, height: 844 });
    for (const [what, html] of Object.entries(VISUALS)) {
      await dressCard(page, html);
      const P = await boxes(page);
      expect(P.b.bottom, `${what}: Player 2 keeps the top half`).toBeLessThanOrEqual(P.strip.y + 1);
      expect(P.strip.bottom, `${what}: Player 1 keeps the bottom half, the card between them`).toBeLessThanOrEqual(P.a.y + 1);
      expect(Math.abs(P.a.x - P.b.x), `${what}: the halves are stacked, not side by side`).toBeLessThan(2);
      expect(P.rotate.h, `${what}: portrait tells the players there is a better way round`).toBeGreaterThan(0);
      // The fallback has a floor of its own. It was never measured before, so the nudge's own line came out of the
      // arenas unnoticed (361px per half before this pull request, ~346px after) and nothing watched any further
      // growth of the card. Portrait is the layout #388 calls too cramped already; it may not quietly get worse.
      // 240px: the measured worst case is a portrait clock question, 251px. The floor exists because nothing
      // measured this before, so the nudge's own line came off both arenas unnoticed (~10px each) and any further
      // growth of the card would have gone the same way. Portrait is the fallback #388 already calls cramped.
      expect(P.a.h, `${what}: the portrait fallback keeps a floor under each arena`).toBeGreaterThan(240);
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
