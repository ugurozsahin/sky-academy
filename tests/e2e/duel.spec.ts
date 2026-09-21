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

async function startDuel(page: Page, dojoByDate?: Record<string, unknown>, coins = 0) {
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
    // #16 item 5, the certificate half: Player 1 won, so the album gets one — and it is filed the moment the
    // overlay is built, BEFORE the 🎓 button is pressed (#205's rule, the bug being a device where pressing it
    // does nothing). Read from the save, not the overlay: the button would be on screen with nothing recorded.
    await expect(page.locator('.duel-end #cert')).toBeVisible();
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
    return {
      a: box('#half-a'), b: box('#half-b'), strip: box('#strip'), rotate: box('.duel-rotate'),
      prompt: box('#prompt'), vis: box('#vis'), canvasA: box('#arena-a'), canvasB: box('#arena-b'),
    };
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
    // The tallest thing in the pool that REFLOWS rather than being a fixed box: twelve objects to count, three
    // rows of five. It is the case the `--slot` floor exists for, so it is deliberately not scaled — see the
    // `.vis.objs` rule. Three rows is what `fiveFrames(12)` produces.
    'twelve objects to count (three rows)': `<div class="vis objs"><div class="grp">${[5, 5, 2].map(n => `<span class="five">${Array.from({ length: 5 }, (_, i) => `<span class="slot">${i < n ? '<span class="obj">⭐</span>' : ''}</span>`).join('')}</span>`).join('')}</div></div>`,
    // A number line with two-digit labels and the hidden tick rightmost: `lineQ` picks the last tick about one
    // round in five, and this is the card that `overflow: hidden` cut the `?` off at 320px wide (24px of it; 4px
    // at 360px). It is here for its WIDTH, where every other fixture is here for its height.
    'number line, hidden tick rightmost': `<div class="vis"><div class="nline">${[10, 12, 14, 16, 18, 20].map((n, i) => `<span class="${i === 5 ? 'mark' : ''}">${i === 5 ? '?' : n}</span>`).join('')}</div></div>`,
  };
  /**
   * Deliberately taller than anything the pool can build. Its claim is the OPPOSITE of the fixtures above: here
   * the budget is supposed to clip, because the alternative is what it replaced — an unbounded visual taking the
   * whole screen and leaving the arenas 11px tall. So it is checked for the bound and never for clipping, and it
   * is kept separate rather than special-cased inside the loop, so neither claim can quietly be applied to the
   * other.
   */
  const ABSURD = '<div class="vis"><div style="width:120px;height:600px"></div></div>';
  /**
   * Dress the card with `html` and the longest prompt and hint the year-1 duel pool can actually produce, then
   * measure it — **in one `evaluate`**. One round trip is the point: a round can end between two of them,
   * `onQuestion` rewrites `#prompt`, `#vis` and `#hint`, and the measurement is then of the real question rather
   * than the dressed worst case — which reports GREEN, because a real question is smaller. That cost a red CI on
   * the full mobile suite while passing eight repeats in isolation, and this file already names the same hazard at
   * the `#hint` rail above: read the DOM and the state in ONE evaluate.
   *
   * The strings are 33 and 49 characters, from `y1-months` and `y1-length`, found by generating 200 questions for
   * each of the pool's 28 topics. Real strings, not invented ones: a hint half again as long as anything the pool
   * holds would cap the layout against a case no child ever sees. The text matters as much as the visual — in a
   * ROW the card wraps, and a long prompt with a long hint is another 20px of bar.
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

  const dressAndMeasure = (page: Page, html: string) => page.evaluate(h => {
    document.querySelector('#vis')!.innerHTML = h;
    document.querySelector('#prompt')!.textContent = 'Which day comes before Wednesday?';
    document.querySelector('#hint')!.textContent = 'yellow sunflower: 14 cm · purple sunflower: 10 cm';
    const box = (sel: string) => {
      const r = document.querySelector(sel)!.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, cx: r.x + r.width / 2 };
    };
    const wrap = document.querySelector('#vis') as HTMLElement;
    const cs = getComputedStyle(wrap);
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
      clipY: wrap.scrollHeight - wrap.clientHeight,
      overflowX: cs.overflowX,
      markPainted,
    };
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
      for (const [what, html] of [...Object.entries(VISUALS), ['taller than anything in the pool', ABSURD] as const]) {
        const L = await dressAndMeasure(page, html);
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
        // The two CANVASES, to the subpixel — the guard #389's issue asked for, because `layoutWave` derives `r`,
        // `g` and `vx` from geometry, so unequal boxes make the halves produce different arcs from one shared
        // seed and the fairness fix fails silently. A 1px divider BORDER on half B did exactly that (border-box
        // takes it out of Player 2's canvas and not Player 1's) and broke #389's rail; the divider is drawn with
        // a pseudo-element now. The 2px tolerance above is far too loose to have caught it.
        expect(Math.abs(L.canvasA.h - L.canvasB.h), `${where}: both arenas are the same height, to the subpixel`).toBeLessThan(0.5);
        expect(Math.abs(L.canvasA.w - L.canvasB.w), `${where}: both arenas are the same width, to the subpixel`).toBeLessThan(0.5);
        if (!html) continue;
        // The visual is scaled to fit the budget rather than the bar growing to fit the visual, so it is still on
        // screen — a bound that worked by hiding the picture would fail the question instead of the layout.
        // `L.vis.h`, not `L.strip.h`: the strip clears 40px on the prompt's own line box alone, so the old form
        // would have passed with `#vis` removed from the DOM entirely and its label would have been a lie.
        // > 5, not > 20: a number line is a short, wide visual (14.5px sideways) and a threshold tuned to the
        // tall ones would fail it. What this catches is the visual being gone altogether.
        expect(L.vis.h, `${where}: the visual is scaled into the bar, not dropped out of it`).toBeGreaterThan(5);
        // The bound applies to everything; "nothing is cut off" applies to what the pool can actually draw.
        if (html !== ABSURD) expectNothingClipped(L, where);
        // No assertion here that the prompt and the visual share a LINE. One was written and removed: whether the
        // row fits on one line depends on text metrics, Fredoka is fetched from Google Fonts, and CI has no
        // network — so `dots` wrapped there and not locally, 46px against 42px. That is the same
        // environment-sensitive rail the review blocked round 1 for, just with a different cause. Losing the row
        // is caught by the bar cap above instead, and caught properly: deleting the two rules that make it takes
        // the bar to 190px against this cap.
      }
    }
  });

  test('guard rail: nothing the screen floats over the arenas swallows a slice (#388)', async ({ page }) => {
    await startDuel(page);
    // The one rail here that uses REAL pointer input. Every other slice in this file goes through `window.__sna`,
    // which calls into the Arena directly and so cannot see anything sitting on top of the canvas. Floating the
    // toast to buy back 32px of arena put it OVER both halves at `z-index: 3`, and because it fades with
    // `opacity: 0` rather than `display: none` it stays there, full size, for the rest of the match: an invisible
    // 296x43 box across the bottom of both arenas in which a slice did nothing at all — no miss, no swish, no
    // feedback. Sideways it straddles the divider, so it took the same bite out of each player.
    await resizeTo(page, { width: 844, height: 390 });
    const dead = await page.evaluate(() => {
      // Make the toast carry text and stay up, exactly as a round announcement leaves it.
      const t = document.querySelector('.toast') as HTMLElement;
      t.textContent = 'Player 1 takes the round!';
      t.classList.add('show', 'good');
      const r = t.getBoundingClientRect();
      const hits: Record<string, number> = { a: 0, b: 0 };
      for (const p of ['a', 'b']) {
        document.querySelector(`#arena-${p}`)!.addEventListener('pointerdown', () => { hits[p]++; }, true);
      }
      (window as unknown as { __hits: Record<string, number> }).__hits = hits;
      return {
        w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2,
        // The toast really is over an arena, so this case is not vacuous.
        overA: r.bottom > document.querySelector('#arena-a')!.getBoundingClientRect().top,
      };
    });
    expect(dead.w, 'the toast is laid out, so there is something to swallow a slice').toBeGreaterThan(0);
    expect(dead.overA, 'the toast overlaps an arena, so this case is not vacuous').toBe(true);
    // What a child's hand does: an upward swipe begun in the arena's bottom inner corner.
    await page.mouse.move(dead.cx - 60, dead.cy);
    await page.mouse.down();
    await page.mouse.move(dead.cx - 40, dead.cy - 30, { steps: 4 });
    await page.mouse.up();
    const hits = await page.evaluate(() => (window as unknown as { __hits: Record<string, number> }).__hits);
    expect(hits.a + hits.b, 'a slice begun under the faded toast still reaches an arena').toBeGreaterThan(0);
    // And the element actually under that point is the canvas, not the thing floating over it.
    const at = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el ? el.tagName : 'null';
    }, [dead.cx, dead.cy]);
    expect(at, 'the arena is what is under the toast, not the toast').toBe('CANVAS');
  });

  test('portrait keeps the stacked duel as a fallback, and asks for a sideways screen (#388)', async ({ page }) => {
    await startDuel(page);
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
      for (const [what, html] of [...Object.entries(VISUALS), ['taller than anything in the pool', ABSURD] as const]) {
        const P = await dressAndMeasure(page, html);
        const where = `${vp.width}x${vp.height}, ${what}`;
        expect(P.b.bottom, `${where}: Player 2 keeps the top half`).toBeLessThanOrEqual(P.strip.y + 1);
        expect(P.strip.bottom, `${where}: Player 1 keeps the bottom half, the card between them`).toBeLessThanOrEqual(P.a.y + 1);
        expect(Math.abs(P.a.x - P.b.x), `${where}: the halves are stacked, not side by side`).toBeLessThan(2);
        expect(P.rotate.h, `${where}: portrait tells the players there is a better way round`).toBeGreaterThan(0);
        expect(Math.abs(P.canvasA.h - P.canvasB.h), `${where}: both arenas are the same height, to the subpixel`).toBeLessThan(0.5);
        expect(Math.abs(P.canvasA.w - P.canvasB.w), `${where}: both arenas are the same width, to the subpixel`).toBeLessThan(0.5);
        // Asserted here, not merely measured. The previous version computed a crop count in portrait and then
        // never looked at it, which is how a budget that cut every tablet's counting card shipped green.
        if (html !== ABSURD) expectNothingClipped(P, where);
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
      const P = await dressAndMeasure(page, VISUALS['twelve objects to count (three rows)']);
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
    // a frame or two of round 2; round 2's wave is in the air for well over 300 ms even at 4×.
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__sna.state().round), 'one wave end per arena, one advance per round').toBe(2);
    await page.click('#pause');
    await expect(page.locator('#resume')).toBeVisible();
    expect(await page.evaluate(() => window.__sna.arenas.a.paused && window.__sna.arenas.b.paused)).toBe(true);
    await page.click('#resume');
    expect(await page.evaluate(() => window.__sna.arenas.a.paused || window.__sna.arenas.b.paused)).toBe(false);
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
  });
});
