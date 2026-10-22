// The three ways a play pack plays its game (#2205), one per input kind: bubbles, tracing and the keypad. Each takes
// the six moments the playtest skill names, in play order, and hands back what the page recorded. The page-side
// helpers (`window.__pk`) are installed by `packProbe` in scripts/playtest-pack.mjs; the game is driven only through
// the `window.__sna` hooks and real taps, as tests/e2e does. The real clock runs throughout.
import { ACTION_TIMEOUT } from './site-shots.mjs';

const FLIGHT_TIMEOUT = 60000;                        // a sequence wave relaunches its letters, so the first wave can run long
const REACH_TIMEOUT = 120000;                        // a required label's four flights have run 12 s each (#2251)
const RESULT_TIMEOUT = 240000;                        // the keypad's Tables Check is 28 cards at about 3 s each

/** Turn recording off and take what the page kept since the tap: the prompts, the spoken lines, the frames and bubbles. */
const collect = page => page.evaluate(() => {
  const pk = window.__pk; pk.on = false;
  return { collectedAt: performance.now(), voices: globalThis.speechSynthesis?.getVoices().length ?? 0, samples: pk.samples, frames: pk.frames, labels: pk.labels ?? [], promptAt: pk.prompts[0]?.t ?? null, speech: pk.speech.filter(e => e.at >= pk.onAt)[0] ?? null };
});
/** Wait, up to 10 s, for the first spoken line to finish, so a stroke's own feedback line does not interrupt it. */
const spoken = page => page.waitForFunction(() => { const e = window.__pk.speech.find(x => x.at >= window.__pk.onAt); return !e || e.end !== null || e.error; }, null, { timeout: 10000, polling: 100 }).then(() => false, () => true);
const lives = page => page.evaluate(() => window.__sna.state().lives);
const asked = page => page.evaluate(() => window.__pk.asked());
const waitNext = (page, n) => page.waitForFunction(k => window.__pk.asked() > k && window.__pk.ready(), n, { timeout: ACTION_TIMEOUT, polling: 100 });

/** Answer every question correctly until the stage result shows, then let its celebration settle and take the last shot. */
async function toResult(page, shot) {
  page.__at = 'answering to the stage result';
  const end = Date.now() + RESULT_TIMEOUT;
  for (;;) {
    if (Date.now() > end) throw new Error('no stage result in time');
    await page.waitForFunction(() => window.__pk.result() || window.__pk.ready(), null, { timeout: RESULT_TIMEOUT, polling: 100 });
    if (await page.evaluate(() => window.__pk.result())) break;
    await page.evaluate(() => window.__sna.answer());
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(1200);
  await shot('6-result.webp', 'the stage result');
  return page.evaluate(() => ({ kind: document.querySelector('.modal.results') ? 'results' : 'stage clear', stage: window.__sna.state().stage, lives: window.__sna.state().lives }));
}

/** One deliberate wrong answer on the second question, shot while the right answer is shown. */
async function wrongOnce(page, shot, act, moment) {
  const before = await lives(page);
  await act();
  await page.waitForTimeout(700);
  await shot('5-wrong.webp', moment);
  return { livesBeforeWrong: before, livesAfterWrong: await lives(page) };
}

export async function playBubbles(page, shot, readScreen) {
  await shot('2-prompt.webp', 'the first question as it appears');
  const screen = await readScreen(page);
  const q0 = await asked(page);
  page.__at = 'the first wave rising';
  await page.waitForFunction(() => window.__sna.bubbles().some(b => b.vy < 0 && b.y < window.__sna.arena.H * 0.8), null, { timeout: ACTION_TIMEOUT, polling: 'raf' });
  await shot('3-rising.webp', 'the first wave rising');
  page.__at = 'the first wave at its apex';
  await page.waitForFunction(() => window.__sna.bubbles().some(b => b.vy >= 0), null, { timeout: ACTION_TIMEOUT, polling: 'raf' });
  await shot('4-apex.webp', 'the first wave at the top of its arc');
  // Left alone until every bubble of the wave has risen and fallen out of reach once, or the game moved on.
  page.__at = 'the first wave falling out of reach';
  await page.waitForFunction(k => {
    const pk = window.__pk, a = window.__sna.arena, ids = Object.keys(pk.seen);
    return pk.asked() > k || (ids.length > 0 && !a.bubbles.some(b => !b.launched && !b.dead && !b.hit) && ids.every(id => pk.left[id]));
  }, q0, { timeout: FLIGHT_TIMEOUT, polling: 100 });
  const rec = await collect(page);
  const livesAfterFirstWave = await lives(page);
  const reach = screen.sequence ? await labelsRunOut(page, q0) : null;
  page.__at = 'the first question resolving';
  // A gentle year sends the answer back up, and a sequence its letters: finish the question now its flight is timed.
  for (let end = Date.now() + FLIGHT_TIMEOUT; (await asked(page)) === q0;) {
    if (Date.now() > end) throw new Error('the first question never finished');
    await page.waitForFunction(k => window.__pk.asked() > k || window.__pk.ready(), q0, { timeout: FLIGHT_TIMEOUT, polling: 100 });
    if ((await asked(page)) === q0) { await page.evaluate(() => window.__sna.answer()); await page.waitForTimeout(150); }
  }
  page.__at = 'a wrong bubble on screen';
  await page.waitForFunction(k => window.__pk.asked() > k && window.__pk.wrongReady(), q0, { timeout: ACTION_TIMEOUT, polling: 100 });
  const wrong = await wrongOnce(page, shot, () => page.evaluate(() => window.__sna.wrong()), 'just after one deliberate wrong slice');
  const result = await toResult(page, shot);
  const firstWave = reach ? 'left unanswered, to time its whole flight, then until a required label ran out of relaunches (labelReachMs)' : 'left unanswered, to time its whole flight';
  return { screen, ...rec, reach: reach?.rc ?? null, extra: { firstWave, livesStart: screen.lives, livesAfterFirstWave, ...(reach ? { livesAfterLabelsRanOut: reach.lives } : {}), ...wrong, result } };
}

/**
 * A sequence question's reach (#2251): still slicing nothing, wait until every required label has ended, which
 * happens once the label the game is waiting for falls on its last flight, so the question is missed. A child who
 * slices it earlier only ends its reach sooner; this times each label's whole chance, which is what reach means.
 */
async function labelsRunOut(page, q0) {
  page.__at = "the first question's required labels running out of relaunches";
  await page.waitForFunction(k => {
    const pk = window.__pk, ids = Object.keys(pk.reach.ids);
    return pk.asked() > k || (ids.length > 0 && ids.every(id => id in pk.reach.ends));
  }, q0, { timeout: REACH_TIMEOUT, polling: 100 });
  const rc = await page.evaluate(() => { const r = window.__pk.reach; r.on = false; return { ids: r.ids, ends: r.ends, samples: r.samples, frames: r.frames }; });
  return { rc, lives: await lives(page) };
}

export async function playTracing(page, shot, readScreen) {
  await page.waitForTimeout(700);                    // the pad draws its guide letter after the card
  const screen = await readScreen(page);
  await shot('2-prompt.webp', 'the first thing to trace, before any ink');
  const spokenWaitTimedOut = await spoken(page);     // ink before the line ends would cut it off, and speechMs with it
  const box = await page.locator('#trace').boundingBox();
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + box.height * 0.3); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x, box.y + box.height * (0.3 + i * 0.02));
  await page.mouse.up();
  await page.waitForTimeout(400);
  await shot('3-tracing.webp', 'part of one stroke drawn down the middle of the pad');
  const trace = await page.evaluate(() => { const t = window.__sna.tracer; return { text: t.text, brushPx: Math.round(t.brush), glyphPx: Math.round(t.brush / 0.09) }; });
  const q0 = await asked(page);
  await page.evaluate(() => window.__sna.answer());
  await page.waitForTimeout(500);
  await shot('4-traced.webp', 'the trace accepted: the script traces through the test hook, so no ink shows');
  await waitNext(page, q0);
  await page.waitForTimeout(500);
  const pad = await page.locator('#trace').boundingBox();
  const wrong = await wrongOnce(page, shot, async () => {
    await page.mouse.move(pad.x + 12, pad.y + 12); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(pad.x + 12 + i * 6, pad.y + 12 + (i % 2) * 10);
    await page.mouse.up();
    await page.click('#tcheck');
  }, 'a scribble off the letter, then Check: the feedback shown');
  const rec = await collect(page);
  const result = await toResult(page, shot);
  return { screen, ...rec, samples: null, extra: { trace: { ...trace, padPx: { width: Math.round(box.width), height: Math.round(box.height) } }, spokenWaitTimedOut, livesStart: screen.lives, ...wrong, result } };
}

export async function playKeypad(page, shot, readScreen) {
  await page.waitForTimeout(400);
  const screen = await readScreen(page);
  await shot('2-prompt.webp', 'the first card, before any key');
  const first = await page.evaluate(() => window.__sna.session.current.answer);
  const key = await page.locator('#keypad [data-key="1"]').boundingBox();
  await page.click(`#keypad [data-key="${first[0]}"]`);
  await shot('3-typing.webp', 'the first digit of the answer typed');
  await page.click('#keypad [data-key="back"]');
  // The Tables Check's first cards are practice, with no clock: answer them until a card arms its clock.
  let clock = null;
  for (let card = 0; card < 6 && clock === null; card++) {
    const n = await asked(page);
    if (card > 0) await waitNext(page, n - 1);
    const armed = await page.waitForFunction(() => window.__sna.state().questionLeft > 0, null, { timeout: 5000, polling: 50 }).then(() => true, () => false);
    if (armed) {
      clock = await page.evaluate(() => window.__sna.state().questionLeft);
      await page.waitForFunction(ms => window.__sna.state().questionLeft <= ms / 2, clock, { timeout: ACTION_TIMEOUT, polling: 100 });
      await shot('4-clock.webp', "the first timed card, half its time gone, nothing typed");
    }
    await page.evaluate(() => window.__sna.answer());
    await page.waitForFunction(k => window.__pk.asked() > k, n, { timeout: ACTION_TIMEOUT, polling: 100 });
  }
  if (clock === null) await shot('4-clock.webp', 'no card armed a clock: the next card, nothing typed');
  await page.waitForFunction(() => window.__pk.ready(), null, { timeout: ACTION_TIMEOUT, polling: 100 });
  const wrong = await wrongOnce(page, shot, () => page.evaluate(() => window.__sna.wrong()), 'just after one deliberate wrong answer typed');
  const rec = await collect(page);
  const result = await toResult(page, shot);
  return { screen, ...rec, samples: null, extra: { keypad: { keyPx: { width: Math.round(key.width), height: Math.round(key.height) }, questionClockMs: clock === null ? null : Math.ceil(clock / 100) * 100 }, livesStart: screen.lives, ...wrong, result } };
}
