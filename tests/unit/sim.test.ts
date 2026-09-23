// Browserless simulation of the arena's state machine (#142).
//
// Every scenario here drives the REAL `Arena` (and, where the question is about the game's rules rather than
// the arena's timing, the real `Session`) with a clock the test advances by hand. Nothing models a game rule:
// the harness stubs the canvas, `performance.now`, `requestAnimationFrame` and `Math.random`, and that is all.
//
// The two regression scenarios at the top are the reason the issue exists. Both were found through e2e, over
// three review passes on PR #132, and both reproduce here in microseconds. Each was proved red by restoring
// the original bug in `src/game/arena.ts` and watching only the matching test fail — the exact edits and the
// counts are in the PR body.
import { afterEach, describe, expect, it } from 'vitest';
import { SHOT_FLIGHT, type ArenaOpts } from '../../src/game/arena';
import { Session, type SessionResult } from '../../src/game/session';
import { BOMB, waveOptsFor } from '../../src/ui/play-session';   // #142: the real TNT label, so a scenario cannot pass against one the game never spawns; #126: the real spawn-options bridge, so a scenario cannot pass against a shape the game never sends
import { YEARS, type Generator, type Topic, type YearInfo } from '../../src/curriculum';
import { ARENA_LISTENERS, FRAME, advanceUntil, createSim, rngFor, type Sim } from './sim/harness';

// Captured at module load, before any scenario has had the chance to install a stub. A baseline taken inside
// the leak test would already be poisoned by whatever ran before it, which made the one test advertised as
// the leak detector blind to every leak except its own.
const PRISTINE = {
  random: Math.random,
  requestAnimationFrame: globalThis.requestAnimationFrame,
  cancelAnimationFrame: globalThis.cancelAnimationFrame,
  performance: globalThis.performance,
};

let sim: Sim | null = null;
afterEach(() => {
  try { sim?.destroy(); } finally { sim = null; }

  // Read what the scenario left behind, then put everything back, and only THEN assert. Detecting a leak
  // without repairing it is how one failure becomes a false accusation against the next test: the following
  // createSim would capture the stub into its own `saved` and faithfully reinstall it afterwards. So the
  // repair is unconditional and the report is separate.
  const left = {
    random: Math.random,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    performance: globalThis.performance,
  };
  Object.assign(globalThis, {
    requestAnimationFrame: PRISTINE.requestAnimationFrame,
    cancelAnimationFrame: PRISTINE.cancelAnimationFrame,
    performance: PRISTINE.performance,
  });
  Math.random = PRISTINE.random;

  expect(left.random, 'a scenario left Math.random seeded').toBe(PRISTINE.random);
  expect(left.requestAnimationFrame, 'a scenario left the fake rAF installed').toBe(PRISTINE.requestAnimationFrame);
  expect(left.cancelAnimationFrame).toBe(PRISTINE.cancelAnimationFrame);
  expect(left.performance, 'a scenario left the frozen clock installed').toBe(PRISTINE.performance);
});

/** Spawn a wave and run frames until `label` is in the air, so a scenario can act on a real bubble. */
function launched(s: Sim, label: string) {
  advanceUntil(s, () => s.live().some(b => b.label === label), `${label} never launched`);
  return s.live().find(b => b.label === label)!;
}

/** When the arena plans to launch `label` — a bubble the wave was dealt but that may still be queued. */
function launchAtOf(s: Sim, label: string) {
  const b = s.all().find(x => x.label === label);
  if (!b) throw new Error(`${label} is not in the wave at all`);
  return b.launchAt;
}

/**
 * A fully typed `Topic` for a scenario that only cares about the generator. An `as never` on the literal
 * would also compile a misspelt field (`answre`, `sequance`) clean, which for a file whose whole purpose is
 * to catch what the browser tests miss is the wrong trade.
 */
const topicOf = (id: string, gen: Generator, extra: Partial<Topic> = {}): Topic => ({ id, title: id, icon: '🥷', subject: 'maths', year: 'year1', nc: 'test', gen, ...extra });

describe('#48 regression: a projectile must not land on a wave that has already been cleared', () => {
  // The bug: `hitBubble` throws a projectile that takes SHOT_FLIGHT (150 ms) to arrive, and the pop — the
  // burst and the `onLand` sound — happens on arrival. If the question ended in between, `clearWave` used to
  // leave the shot in the air, so it landed on a bubble that was no longer on screen: a pop the child hears
  // with nothing to see, on top of the next question. The fix is one line in `clearWave` — `this.shots = []`.
  it('drops a shot still in flight when the question ends, and stays silent', () => {
    sim = createSim();
    sim.spawn({ labels: ['4', '5', '6'], speed: 2 });
    const b = launched(sim, '5');

    sim.arena.hitLabel(b.label);                       // a tap: the projectile is thrown, the pop waits
    expect(sim.events.throws).toBe(1);
    expect(sim.arena.shots).toHaveLength(1);

    sim.frame();                                       // one frame of flight — well inside the 150 ms
    expect(sim.arena.shots.length, 'the shot should still be travelling').toBe(1);
    expect(sim.events.lands).toBe(0);

    sim.arena.clearWave('#ffffff');                    // the question is over while it is in the air
    expect(sim.arena.shots, 'a shot in flight is dropped with the wave').toHaveLength(0);

    sim.advance(SHOT_FLIGHT * 1000 * 3);               // long past when it would have arrived
    expect(sim.events.lands, 'nothing may land after the wave was cleared').toBe(0);
  });

  it('a shot whose question does NOT end still lands and pops, so the fix did not silence the game', () => {
    sim = createSim();
    sim.spawn({ labels: ['4', '5', '6'], speed: 2 });
    const b = launched(sim, '5');

    sim.arena.hitLabel(b.label);
    sim.advance(SHOT_FLIGHT * 1000 + 2 * (1000 / 60));
    expect(sim.events.lands, 'the ordinary path must still pop and sound').toBe(1);
    expect(sim.arena.shots).toHaveLength(0);
  });

  it('the spotlighted answer survives its own landing — a reveal keeps the bubble, the shot still pops it', () => {
    // `landShot` pops but must not kill a bubble the reveal is holding on screen (`if (!t.mark) t.dead = true`).
    sim = createSim();
    sim.spawn({ labels: ['7', '8'], speed: 2 });
    const b = launched(sim, '7');
    sim.arena.hitLabel('7');
    sim.arena.reveal({ good: '7' });
    sim.advance(SHOT_FLIGHT * 1000 + 2 * (1000 / 60));
    expect(sim.events.lands).toBe(1);
    expect(b.dead, 'the spotlighted bubble must stay on screen for the child to see').toBe(false);
    expect(b.mark).toBe('good');
  });
});

describe('#48 regression: a poll between clearWave and the next spawn must not read the previous wave', () => {
  // The bug: `clearWave` only *marks* bubbles dead; the array itself is replaced later, by the next
  // `spawnWave`, a frame or more afterwards. Anything that polls `arena.bubbles` in that gap — the e2e's
  // `window.__sna.bubbles()` hook did — reads the question that has just finished and asserts against the
  // wrong wave. The contract that makes the gap safe is that every bubble is dead the instant clearWave
  // returns, so the hook's own predicate sees none.
  it('every bubble is dead the moment clearWave returns, though the array is still full', () => {
    sim = createSim();
    sim.spawn({ labels: ['1', '2', '3'], speed: 2 });
    advanceUntil(sim, () => sim!.live().length >= 2, 'two bubbles never reached the air');

    sim.arena.clearWave('#ffffff');

    expect(sim.live(), 'the hook predicate must see nothing between the waves').toEqual([]);
    expect(sim.all().length, 'while the array itself is still the old wave — this is the trap').toBeGreaterThan(0);
    expect(sim.all().every(b => b.dead), 'so every one of them must be dead').toBe(true);
  });

  it('and it stays empty across the gap, however many frames the next spawn takes to arrive', () => {
    sim = createSim();
    sim.spawn({ labels: ['1', '2', '3'], speed: 2 });
    advanceUntil(sim, () => sim!.live().length >= 2, 'two bubbles never reached the air');
    sim.arena.clearWave('#ffffff');

    for (let f = 0; f < 30; f++) { sim.frame(); expect(sim.live(), `frame ${f} after the clear`).toEqual([]); }

    sim.spawn({ labels: ['8', '9'], speed: 2 });
    expect(sim.all(), 'an empty array would satisfy the every() below vacuously').toHaveLength(2);
    expect(sim.all().every(b => b.label === '8' || b.label === '9'),
      'the new wave replaces the array outright').toBe(true);
  });

  it('clearWave reports the wave end exactly once, however often it is called', () => {
    sim = createSim();
    sim.spawn({ labels: ['1', '2'], speed: 2 });
    advanceUntil(sim, () => sim!.live().length >= 1, 'nothing ever launched, so there was no wave to clear');
    sim.arena.clearWave();
    sim.arena.clearWave();
    sim.advance(500);
    expect(sim.events.waveEnds, 'a second clear must not start another question').toBe(1);
  });
});

describe('the wave launches on its own timetable', () => {
  /**
   * Run frames until every bubble has launched, returning the **observed** launch time of each: the value of
   * `sim.now()` in the frame where `b.launched` first became true.
   *
   * This is the whole point of both scenarios below, and their first version missed it. They passed with the
   * launch timetable *deleted* — `if (!b.launched) { b.launched = true; }`, every bubble airborne on frame one.
   * One read `launchAt` off the freshly spawned plan without running a single frame, so it tested `layoutWave`'s
   * arithmetic (already covered, more strictly, in `arena.test.ts`) rather than the arena. The other built its
   * "launch order" by walking `sim.all()` in array order every frame and comparing it to that same array order,
   * so anything that launched, in any frame, was appended in the expected order by construction.
   *
   * Observed time, compared against each bubble's own `launchAt`, is what cannot be satisfied by launching
   * everything at once.
   */
  function observeLaunches(s: Sim, limitFrames = 900) {
    const seen = new Map<string, number>();
    for (let f = 0; f < limitFrames && seen.size < s.all().length; f++) {
      s.frame();
      for (const b of s.all()) if (b.launched && !seen.has(b.label)) seen.set(b.label, s.now());
    }
    expect(seen.size, 'not every bubble launched within the frame budget').toBe(s.all().length);
    return s.all().map(b => ({ label: b.label, planned: b.launchAt, observed: seen.get(b.label)! }));
  }

  it('each bubble launches in the frame its own launchAt falls in — not before it', () => {
    sim = createSim({ seed: 7 });
    sim.spawn({ labels: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], speed: 2 });
    expect(sim.live(), 'a wave is queued, not instantly on screen').toEqual([]);

    for (const { label, planned, observed } of observeLaunches(sim)) {
      // The frame it launched in must have reached its launchAt...
      expect(observed, `${label} launched before its turn`).toBeGreaterThanOrEqual(planned);
      if (observed > FRAME) {
        // ...and the frame before must NOT have, which is what "on time" rather than "late" means.
        expect(observed - FRAME, `${label} launched late, or the timetable is not being read`)
          .toBeLessThan(planned);
      } else {
        // A bubble that went up in the very first frame has no preceding frame to compare against — the
        // clock starts at the spawn moment and `update` does not run then, so `observed - FRAME` is the
        // spawn instant itself and `< planned` is false for the first bubble, whose launchAt IS that
        // instant. The meaningful claim for these is that they were genuinely due by the first frame.
        expect(planned, `${label} rose in the first frame but was not due until later`)
          .toBeLessThanOrEqual(FRAME);
      }
    }
  });

  /**
   * #490: `update()` is skipped entirely while `paused` (the pause overlay), so nothing launches DURING a
   * pause — but nothing shifted `launchAt` either, so every bubble whose moment passed behind the overlay
   * became due all at once on the first resumed frame. A wave a child left climbing one bubble at a time
   * came back as a clump.
   *
   * Both scenarios below pause mid-wave for a full second — long enough that every un-launched bubble's
   * original `launchAt` has already passed by the time the pause lifts, which is exactly what makes
   * `now >= b.launchAt` true for all of them at once without the fix. The un-fixed arena fails both: every
   * remaining bubble reports `launched` on the very first resumed frame.
   */
  it('a pause mid-wave does not collapse the rest of a 4-option wave onto the resume frame', () => {
    sim = createSim({ seed: 7 });
    sim.spawn({ labels: ['1', '2', '3', '4'], speed: 2 });
    const plannedAt = new Map(sim.all().map(b => [b.label, b.launchAt]));

    advanceUntil(sim, () => sim!.now() >= 200, 'never reached the pause point');
    sim.arena.paused = true;
    sim.advance(1000);                                      // well past every bubble's own (pre-pause) launchAt
    sim.arena.paused = false;
    sim.frame();                                             // the first resumed frame

    const dueBeforePause = [...plannedAt].filter(([, at]) => at <= 200).map(([label]) => label).sort();
    const launchedNow = sim.all().filter(b => b.launched).map(b => b.label).sort();
    expect(launchedNow, 'only the bubbles already due before the pause may be airborne on the resume frame')
      .toEqual(dueBeforePause);

    // And the rest still rise on their own staggered schedule from here — not together either.
    const seen = new Map<string, number>();
    const remaining = 4 - dueBeforePause.length;
    for (let f = 0; f < 600 && seen.size < remaining; f++) {
      sim.frame();
      for (const b of sim.all()) if (b.launched && !dueBeforePause.includes(b.label) && !seen.has(b.label)) seen.set(b.label, sim.now());
    }
    expect(seen.size, 'the remaining bubbles never all launched').toBe(remaining);
    const times = [...seen.values()].sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) {
      expect(times[i] - times[i - 1], 'consecutive bubbles still launched a stagger interval apart, not together')
        .toBeGreaterThan(FRAME);
    }
  });

  it('the same holds for a 6-option wave, across two launch batches', () => {
    sim = createSim({ seed: 11 });
    sim.spawn({ labels: ['1', '2', '3', '4', '5', '6'], speed: 2 });
    const plannedAt = new Map(sim.all().map(b => [b.label, b.launchAt]));

    advanceUntil(sim, () => sim!.now() >= 200, 'never reached the pause point');
    sim.arena.paused = true;
    sim.advance(1000);
    sim.arena.paused = false;
    sim.frame();

    const dueBeforePause = [...plannedAt].filter(([, at]) => at <= 200).map(([label]) => label).sort();
    const launchedNow = sim.all().filter(b => b.launched).map(b => b.label).sort();
    expect(launchedNow, 'the second batch (well past the pause) must not launch early either').toEqual(dueBeforePause);
  });

  it('a wave that never pauses is unaffected — the shift is inert when paused never becomes true', () => {
    sim = createSim({ seed: 7 });
    sim.spawn({ labels: ['1', '2', '3', '4'], speed: 2 });
    const before = sim.all().map(b => b.launchAt);
    sim.frame();
    expect(sim.all().map(b => b.launchAt), 'a frame with no pause must not move launchAt at all').toEqual(before);
  });

  it('a long wave really does rise in batches, measured by when bubbles appear', () => {
    // Note what this does NOT claim. A draft asserted that fewer than nine bubbles are ever airborne at once,
    // and it failed — correctly. `batchGap` is 0.62 of the flight time here, so the second batch goes up while
    // the first is still climbing, and all nine can be on screen together. The batching is in the launch
    // timetable, not in a cap on what is visible. The gaps below are therefore *observed* launch times, not the
    // planned ones: a wave that launched everything on frame one has no gaps at all.
    sim = createSim({ seed: 11 });
    sim.spawn({ labels: Array.from({ length: 9 }, (_, i) => String(i + 1)), speed: 2 });

    const t0 = sim.now();
    const times = observeLaunches(sim).map(x => x.observed - t0).sort((a, b) => a - b);
    const gaps = times.slice(1).map((t, i) => t - times[i]).filter(g => g > 0);
    expect(gaps.length, 'every bubble launching in the same frame is not a wave').toBeGreaterThan(1);
    const within = Math.min(...gaps), between = Math.max(...gaps);

    expect(times[0], 'the first bubble goes up in the first frame').toBeLessThanOrEqual(FRAME);
    expect(between, 'a batch boundary is a much longer wait than one bubble to the next')
      .toBeGreaterThan(within * 3);
    expect(gaps.filter(g => g > within * 3).length, 'nine labels make more than one batch')
      .toBeGreaterThanOrEqual(1);
  });

  it('an un-hit bubble reports exactly one fall, and the wave ends once they are all gone', () => {
    sim = createSim();
    sim.spawn({ labels: ['2', '4'], speed: 3 });
    advanceUntil(sim, () => sim!.events.waveEnds === 1, 'the wave never ended');
    expect(sim.events.falls.sort()).toEqual(['2', '4']);
    expect(sim.events.hits).toEqual([]);
  });

  // #152 review note 3, and the PR's own review (pr-test-analyzer): `resolveCollisions`/`clampIntoArena` are
  // exercised directly with a hand-built `counts` object elsewhere (`tests/unit/arena.test.ts`), but the
  // actual integration point — `Arena.clampCounts` threaded through the real `update()` loop — had no test of
  // its own, unlike `shotsThrown`, the sibling field it mirrors (asserted via `sim.arena.shotsThrown` above).
  // This drives a real multi-bubble wave through a real `Arena` and checks the field the e2e hook would read.
  it('Arena.clampCounts is actually wired through update(), and stays at zero ceiling for a real wave', () => {
    sim = createSim();
    expect(sim.arena.clampCounts, 'a fresh arena starts at zero').toEqual({ left: 0, right: 0, ceiling: 0 });
    // A nine-label wave, not four: this is what makes the test able to fail. A small wave never reaches
    // either wall in this 390-wide harness (checked directly), so a `ceiling === 0` assertion alone would
    // read the same whether update() passes clampCounts through or the wiring was dropped entirely — the
    // field starts at zero either way. Nine bubbles collide often enough to push some against a wall for
    // real (measured: low hundreds of left/right hits), so asserting that traffic too is what actually
    // proves this field is the one update() writes to, not merely one that shares its shape.
    sim.spawn({ labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], speed: 3 });
    advanceUntil(sim, () => sim!.events.waveEnds === 1, 'the wave never ended');
    expect(sim.arena.clampCounts.left + sim.arena.clampCounts.right, 'proof the field update() writes to is this one').toBeGreaterThan(0);
    expect(sim.arena.clampCounts.ceiling, 'the true invariant — see tests/unit/arena.test.ts for why only this one').toBe(0);
  });

  it('a bubble tapped on its way down crosses the bottom mid-flight, and is still not a miss', () => {
    // `update` guards this: a bubble past the bottom edge only calls `onFall` `if (!b.hit)`.
    //
    // The timing is the whole test, and the first version of it got this wrong — it tapped immediately after
    // launch, so `landShot` killed the bubble while it was still climbing and the guard was never reached.
    // Deleting `if (!b.hit)` from arena.ts left all 19 scenarios green. The case that matters is a tap on a
    // bubble already falling and close to the floor: the 150 ms projectile flight is still in the air when the
    // bubble crosses `b.y - b.r > H + 10`, which is the one moment a sliced answer can be scored as a miss.
    sim = createSim();
    sim.spawn({ labels: ['5', '6'], speed: 3 });
    const b = launched(sim, '5');

    // Let it rise, turn over, and come back down to where the remaining drop takes LESS than one projectile
    // flight — derived from the bubble's own fall speed rather than a guessed pixel margin, because a guess
    // is what made the first attempt miss: 120 px looked close to the floor, but the bubble only falls about
    // 88 px in the 150 ms the shot is airborne, so it died before the shot landed and the race never ran.
    const floor = sim.arena.H + 10 + b.r;
    advanceUntil(sim, () => b.vy > 0 && floor - b.y < b.vy * SHOT_FLIGHT * 0.6,
      'the bubble never came back down near the floor');
    expect(b.dead, 'it must still be alive when the child taps it').toBe(false);
    const yAtTap = b.y;

    sim.arena.hitLabel('5');
    expect(sim.arena.shots, 'the tap must put a projectile in the air, or the race cannot happen').toHaveLength(1);

    // Now prove the bubble really does cross the bottom while that shot is still travelling — otherwise this
    // scenario would quietly go back to being the one that tests nothing.
    let crossedWithShotInFlight = false;
    for (let f = 0; f < 60 && sim.arena.shots.length > 0; f++) {
      sim.frame();
      if (b.y - b.r > sim.arena.H + 10) { crossedWithShotInFlight = true; break; }
    }
    expect(crossedWithShotInFlight,
      `the bubble must cross the bottom edge with the shot still in flight (tapped at y=${yAtTap.toFixed(0)}, H=${sim.arena.H})`).toBe(true);

    advanceUntil(sim, () => sim!.events.waveEnds === 1, 'the wave never ended');
    expect(sim.events.falls, 'the bubble the child hit must not be scored as missed').not.toContain('5');
    expect(b.hit).toBe(true);
    // And the other half of the same moment, which this scenario is the only place in the suite to create:
    // the shot lands on a bubble that is already dead and unmarked, so `landShot`'s
    // `pops = !t.dead || !!t.mark` must make it SILENT. That guard is the whole subject of this file's first
    // describe block — "a pop the child hears with nothing to see" — and mutating it to `pops = true` used
    // to leave all 20 scenarios green, because nothing looked at `lands` here.
    expect(sim.events.lands,
      'the shot arrived at a bubble the child can no longer see, so it must not pop or sound').toBe(0);
  });
});

describe('the outcome reveal freezes the wave', () => {
  it('frozen bubbles stop moving, and a queued one is killed rather than launched into the reveal', () => {
    sim = createSim({ seed: 3 });
    sim.spawn({ labels: ['3', '4', '5', '6', '7', '8', '9'], speed: 1 });
    // '3' outright: nothing is live before the first launch, so the old `sim.live()[0]?.label ?? '3'`
    // always took the literal and the lookup read as a choice that was never made.
    const b = launched(sim, '3');

    // Hold the identities, not a count. The previous version asserted
    //   `all().some(x => !x.launched && !x.dead) === false`
    // which is satisfied by a queued bubble being KILLED *or* by it being LAUNCHED — the two outcomes its
    // own message claimed to distinguish. Flipping `reveal`'s `b.dead = true` to `b.launched = true` (a
    // queued bubble popping up under the outcome overlay, a real player-visible bug) left all 20 green.
    const queued = sim.all().filter(x => !x.launched && !x.dead);
    expect(queued.length, 'this scenario needs bubbles still waiting their turn').toBeGreaterThan(0);

    sim.arena.reveal({ good: b.label });
    const y = b.y, x = b.x;
    sim.advance(600);

    expect(b.y, 'the spotlighted bubble holds still').toBeCloseTo(y, 6);
    expect(b.x).toBeCloseTo(x, 6);
    expect(queued.every(q => q.dead), 'every bubble still queued at the reveal must be killed').toBe(true);
    expect(queued.every(q => !q.launched), 'and none of them may launch into the reveal').toBe(true);
  });

  it('a frozen wave accepts no further hits', () => {
    sim = createSim();
    sim.spawn({ labels: ['1', '2', '3'], speed: 2 });
    advanceUntil(sim, () => sim!.live().length >= 2, 'two bubbles never reached the air');
    const other = sim.live()[1].label;
    sim.arena.reveal({ good: sim.live()[0].label });
    expect(sim.arena.hitLabel(other), 'the reveal is not a moment the child can score in').toBe(false);
  });

  it('reveals the right answer as a ghost bubble when it is no longer on screen', () => {
    sim = createSim();
    sim.spawn({ labels: ['1', '2'], speed: 2 });
    advanceUntil(sim, () => sim!.live().length >= 1, 'nothing was on screen to reveal against');
    sim.arena.reveal({ good: '42' });                  // a label this wave never had
    const ghost = sim.all().find(b => b.label === '42');
    expect(ghost, 'the child must still be shown the answer').toBeTruthy();
    expect(ghost!.mark).toBe('good');
    expect(ghost!.launched).toBe(true);
  });
});

describe('the arena and the session together', () => {
  // The three-line bridge below is the one `src/ui/play.ts` makes. Every rule still comes from `Session`.
  function play(labels: string[], answer: string, gentle: boolean) {
    const year = { ...YEARS[gentle ? 0 : 1], lives: 3, gentle };
    const events: string[] = [];
    const session = new Session(
      { mode: 'mission', year, topic: topicOf('t', () => ({ prompt: 'q', answer, options: labels }), { year: year.id }), rng: rngFor(1) },
      {
        onQuestion: () => {}, onCorrect: () => { events.push('correct'); }, onWrong: () => { events.push('wrong'); },
        onMiss: () => { events.push('miss'); }, onProgress: () => {}, onLives: (n) => { events.push(`lives:${n}`); },
        onStageClear: () => {}, onEnd: () => { events.push('end'); },
      });
    session.start();
    return { session, events };
  }

  it('a bubble that falls past the bottom costs a life in Year 1, but not in gentle Reception', () => {
    for (const gentle of [true, false]) {
      const { session, events } = play(['2', '4'], '2', gentle);
      sim?.destroy();
      sim = createSim({ arena: {} });
      // the bridge: the arena reports, the session decides
      const s = sim;
      const bridge = () => { for (const l of s.events.falls.splice(0)) session.fall(l); };
      sim.spawn({ labels: ['2', '4'], speed: 3 });
      advanceUntil(sim, () => { bridge(); return s.events.waveEnds === 1; }, 'the wave never ended');
      bridge();
      expect(events.includes('miss'), 'a missed answer is a miss either way').toBe(true);
      expect(events.some(e => e.startsWith('lives:')), `gentle=${gentle} life handling`).toBe(!gentle);
      expect(session.lives).toBe(gentle ? 3 : 2);
    }
  });

  it('slicing the answer scores it, and the arena is the thing that says which label was cut', () => {
    const { session, events } = play(['2', '4', '6'], '4', false);
    sim = createSim();
    const s = sim;
    sim.spawn({ labels: ['2', '4', '6'], speed: 2 });
    launched(sim, '4');
    sim.arena.hitLabel('4');
    for (const h of s.events.hits.splice(0)) session.hit(h.label);
    expect(events).toContain('correct');
    expect(session.score).toBeGreaterThan(0);
    expect(session.lives, 'a correct slice costs nothing').toBe(3);
  });

  it('slicing a decoy is wrong and costs a life', () => {
    const { session, events } = play(['2', '4', '6'], '4', false);
    sim = createSim();
    const s = sim;
    sim.spawn({ labels: ['2', '4', '6'], speed: 2 });
    launched(sim, '6');
    sim.arena.hitLabel('6');
    for (const h of s.events.hits.splice(0)) session.hit(h.label);
    expect(events).toContain('wrong');
    expect(session.lives).toBe(2);
  });
});

describe('the harness itself', () => {
  it('is deterministic: the same seed lays out the same wave, twice', () => {
    // try/finally, because an assertion that threw between construction and destroy() used to strand the
    // stubs: afterEach's `sim?.destroy()` sees null for a sim it was never given, and the NEXT createSim
    // then captures the stubbed clock into its own `saved`, so its restore() reinstalls it. The poisoning
    // is self-perpetuating, and the first visible symptom is a failure in unrelated, correct code.
    const layout = (seed: number) => {
      const s = createSim({ seed });
      try {
        s.spawn({ labels: ['a', 'b', 'c', 'd', 'e'], speed: 2 });
        return s.all().map(b => `${b.label}@${b.x.toFixed(4)},${b.vy.toFixed(4)},${b.launchAt.toFixed(2)}`);
      } finally {
        s.destroy();
      }
    };
    expect(layout(99)).toEqual(layout(99));
    expect(layout(99), 'and a different seed really does lay out differently').not.toEqual(layout(100));
  });

  it('costs no real time: a full wave plays out in virtual milliseconds', () => {
    sim = createSim();
    sim.spawn({ labels: ['1', '2', '3', '4'], speed: 1 });
    const started = Date.now();
    advanceUntil(sim, () => sim!.events.waveEnds === 1, 'the wave never ended');
    expect(sim.now(), 'several seconds of game time').toBeGreaterThan(3000);
    expect(Date.now() - started, 'but no real time to speak of').toBeLessThan(2000);
  });

  it('restores the globals and unhooks all five listeners on destroy', () => {
    // The count is exact, and it has to be. `Arena` splits its listeners across two objects — pointerdown and
    // pointermove on the canvas, resize, pointerup and pointercancel on the window — so a `> 0` assertion
    // over the canvas alone passed while three of the five went unwatched. #31's leak was a *partial*
    // removal, which is exactly the case a loose count cannot see.
    const s = sim = createSim();      // tracked, so a failure below cannot strand the stubs for the next test
    expect(Math.random, 'seeded while the sim is live').not.toBe(PRISTINE.random);
    expect(s.listeners(), 'all five of the arena\'s listeners must be visible to this test').toBe(ARENA_LISTENERS);
    s.destroy();
    expect(Math.random).toBe(PRISTINE.random);
    expect(globalThis.requestAnimationFrame).toBe(PRISTINE.requestAnimationFrame);
    expect(s.listeners(), 'a leaked listener is how one scenario poisons the next').toBe(0);
  });

  // The stubs are installed before `new Arena(...)` runs, so a throw in between strands them: no Sim exists,
  // afterEach's `sim?.destroy()` sees null, and every later scenario runs against a seeded Math.random and a
  // frozen clock — failing somewhere else with a message pointing at the wrong code.
  //
  // Both spellings below are covered, and the distinction is the point. The first version of this scenario used
  // an `opts.arena` getter, which fires during the `{ ...opts.arena }` spread that builds the constructor's
  // *argument* — before the constructor is entered. It proved the restore, but not from where its name claimed:
  // guarding only the spread and leaving `new Arena(...)` bare left the suite 181/181 green. A broken canvas
  // throws from inside `Arena`'s own `resize()` call, which is the case that actually worries us — `arena.ts`
  // reaching for a `navigator`, `matchMedia` or `document.fonts` this harness does not stub.
  it.each([
    ['inside the Arena constructor (a canvas with no layout)', { failCanvas: 'rect' } as const],
    ['inside the Arena constructor (getContext returns null)', { failCanvas: 'getContext' } as const],
    ['while building the constructor argument (an opts getter)', { arena: { get fx(): never { throw new Error('opts exploded'); } } satisfies ArenaOpts }],
  ])('puts the globals back when construction throws %s', (_where, opts) => {
    expect(() => createSim(opts)).toThrow();
    // afterEach asserts this too, but naming it here is what makes the scenario legible on its own.
    expect(Math.random, 'a failed construction must not leave Math.random seeded').toBe(PRISTINE.random);
    expect(globalThis.performance, 'nor the frozen clock installed').toBe(PRISTINE.performance);
    expect(globalThis.requestAnimationFrame, 'nor the fake rAF').toBe(PRISTINE.requestAnimationFrame);
  });
});

/**
 * #142, the TNT path — the second of the four behaviours the issue's Develop row still lists.
 *
 * The TNT is the one bubble whose *tap* behaves like a swipe: it pops under the finger instead of waiting for
 * the ninja's projectile, because chasing it with a star would burst it twice and reward the hit (#48, and
 * the comment at `src/ui/play.ts:117` says so in those words). That rule lives in two places — `throwFor` in
 * the arena, `Session.bomb()` in the rules — and the seam between them is exactly the shape e2e is slowest at
 * and this harness is fastest at: a pop, a projectile that is or is not thrown, and a life lost without the
 * question ending.
 *
 * `BOMB` is imported rather than retyped so a scenario cannot pass against a label the game does not use.
 */
describe('#142: the TNT pops under the finger, costs a life, and does not end the question', () => {
  /** The predicate `src/ui/play.ts:118` hands the arena, quoted rather than invented. */
  const throwFor = (b: { label: string }) => b.label !== BOMB;

  it('a tapped TNT pops here and now — no projectile is thrown', () => {
    sim = createSim({ arena: { throwFor } });
    sim.spawn({ labels: ['7', BOMB, '9'], speed: 2 });
    const tnt = launched(sim, BOMB);

    expect(sim.arena.hitLabel(tnt.label), 'the tap found the TNT').toBe(true);

    // All three in the same frame: the burst is immediate, nothing is in the air, and the bubble is gone.
    expect(sim.events.throws, 'a tapped TNT must not throw the ninja’s star').toBe(0);
    expect(sim.arena.shots, 'nor leave one in flight').toHaveLength(0);
    expect(sim.arena.shotsThrown, 'the counter the e2e hook reads stays put').toBe(0);
    expect(tnt.dead, 'it pops under the finger rather than on arrival').toBe(true);
    expect(sim.live().some(b => b.label === BOMB), 'and leaves the screen at once').toBe(false);
    expect(sim.events.hits, 'reported as a tap, not a swipe').toEqual([{ label: BOMB, viaSwipe: false }]);
  });

  it('an ordinary bubble in the SAME wave still throws, and pops only when the star lands', () => {
    sim = createSim({ arena: { throwFor } });
    sim.spawn({ labels: ['7', BOMB, '9'], speed: 2 });
    const b = launched(sim, '7');

    sim.arena.hitLabel(b.label);
    expect(sim.events.throws, 'a tap on an ordinary bubble throws one star').toBe(1);
    expect(b.dead, 'which has not arrived yet, so nothing has popped').toBe(false);
    expect(sim.events.lands).toBe(0);

    // SHOT_FLIGHT is in seconds; the pop is on arrival, not on the tap.
    sim.advance(SHOT_FLIGHT * 1000 + FRAME);
    expect(sim.events.lands, 'the pop is the landing').toBe(1);
    expect(b.dead).toBe(true);

    // The predicate is consulted per bubble, so one wave really can hold both behaviours.
    const tnt = launched(sim, BOMB);
    sim.arena.hitLabel(tnt.label);
    expect(sim.events.throws, 'and the TNT beside it still throws nothing').toBe(1);
  });

  it('with no throwFor at all, every tap throws — the TNT rule is opt-in, not the default', () => {
    sim = createSim();                                   // no `throwFor`: the arena knows nothing about TNT
    sim.spawn({ labels: ['7', BOMB, '9'], speed: 2 });
    const tnt = launched(sim, BOMB);
    sim.arena.hitLabel(tnt.label);
    expect(sim.events.throws, 'the exclusion is the screen’s decision, not the arena’s').toBe(1);
    expect(tnt.dead, 'so it waits for the star like anything else').toBe(false);
  });

  /**
   * The seam. The arena reports the hit; `play.ts` reads the label and calls `session.bomb()`; the session
   * decides what that costs. Written as the same three-line bridge `src/ui/play.ts` makes, so a scenario
   * cannot pass because the harness modelled a rule the screen does not.
   */
  function bridged(mode: 'mission' | 'sprint', gentle: boolean) {
    const year = { ...YEARS[gentle ? 0 : 1] };
    const events: string[] = [];
    const session = new Session(
      { mode, year, topic: topicOf('t', () => ({ prompt: 'q', answer: '7', options: ['7', '9'] }), { year: year.id }), rng: rngFor(2) },
      {
        onQuestion: () => { events.push('question'); }, onCorrect: () => { events.push('correct'); },
        onWrong: () => { events.push('wrong'); }, onMiss: () => { events.push('miss'); }, onProgress: () => {},
        onLives: (n) => { events.push(`lives:${n}`); }, onStageClear: () => {}, onEnd: () => { events.push('end'); },
      });
    session.start();
    return { session, events };
  }

  it('a TNT in a live wave costs a life and leaves the question standing', () => {
    const { session, events } = bridged('mission', false);
    // A correct slice, then the next question — the beat the screen actually plays. `hit()` leaves the session
    // `waiting` for the outcome reveal, and `bomb()` returns early while it is: a TNT in that gap is ignored,
    // which is right (the wave the child is touching has already been cleared) and is asserted below.
    session.hit('7');
    expect(session.waiting, 'a correct slice parks the session on the reveal').toBe(true);
    session.bomb();
    expect(session.lives, 'so a TNT in that gap costs nothing').toBe(session.o.year.lives);
    session.nextQuestion();
    expect(session.combo, 'the combo survives the question boundary and is worth losing').toBe(1);
    const livesBefore = session.lives;

    sim = createSim({ arena: { throwFor } });
    sim.spawn({ labels: ['7', '9', BOMB], speed: 2 });
    const tnt = launched(sim, BOMB);
    sim.arena.hitLabel(tnt.label);

    // The bridge: play.ts reads the label off the hit and routes the TNT away from `hit()` (src/ui/play.ts:98).
    for (const h of sim.events.hits.splice(0)) { if (h.label === BOMB) session.bomb(); else session.hit(h.label); }

    expect(session.lives, 'the TNT costs a life').toBe(livesBefore - 1);
    expect(session.combo, 'and breaks the combo').toBe(0);
    expect(events.includes('wrong'), 'but it is never a wrong answer').toBe(false);
    expect(events.includes('miss'), 'nor a miss').toBe(false);
    expect(session.waiting, 'the question continues — the child can still slice the answer').toBe(false);
    expect(session.current, 'and it is the same question').not.toBeNull();

    // Which the child then does, and it still scores.
    expect(session.hit('7'), 'the answer is still there to be sliced').toBe('correct');
  });

  it('a sprint has no lives, so the same TNT costs nothing but the combo', () => {
    const { session } = bridged('sprint', false);
    session.hit('7'); session.nextQuestion();
    const combo = session.combo, lives = session.lives;
    expect(combo, 'the combo is worth losing').toBeGreaterThan(0);

    session.bomb();

    expect(session.lives, 'loseLife() returns early when the mode has no lives').toBe(lives);
    expect(session.combo, 'the combo still goes').toBe(0);
    expect(session.ended, 'and a sprint is not ended by a TNT').toBe(false);
  });

  it('the last life ends the run, and a TNT after that changes nothing', () => {
    const { session, events } = bridged('mission', false);
    for (let i = 0; i < session.o.year.lives; i++) session.bomb();

    expect(session.lives).toBe(0);
    expect(session.ended, 'the run is over').toBe(true);
    expect(events.filter(e => e === 'end'), 'exactly once').toHaveLength(1);

    // Counting the life events, not just reading `lives`, is what makes this test about the `ended` guard.
    // Without it the assertions below all still hold: `loseLife` clamps at zero and `end()` refuses to run
    // twice, so the only trace a TNT after the whistle leaves is one more `onLives(0)` the HUD would redraw
    // for. Asserting the count was green against the guard's removal until this line was added.
    const lifeEvents = events.filter(e => e.startsWith('lives:')).length;
    session.bomb();
    expect(events.filter(e => e === 'end'), 'a TNT after the end must not end it twice').toHaveLength(1);
    expect(events.filter(e => e.startsWith('lives:')), 'nor report a life it did not take').toHaveLength(lifeEvents);
    expect(session.lives).toBe(0);
  });
});

describe('#142: sequence progress rushes only the next earned batch', () => {
  const sequence = ['one', 'two', 'three', 'four', 'five', 'six'];
  const options = [...sequence, 'red', 'blue', 'green', 'gold', 'black', 'white'];

  /**
   * An ordered spelling question, Session ⟷ Arena, with nothing in between modelled. The spawn side of the
   * bridge is `waveOptsFor` (#126), the real one `src/ui/play-session.ts` calls — a change to the screen's
   * spawn shape now fails to compile here instead of diverging silently. `rush(sequence[done])` on progress
   * has no screen-side equivalent to import; that half is still written out.
   */
  function orderedSequence(seed: number) {
    const progress: string[] = [];
    const speeds: number[] = [];
    let correct = 0;
    const s = sim = createSim({ seed });
    const session = new Session(
      {
        // `speeds: [2]`, so the sequence handicap (`MODES.mission.speed`: one step slower for a sequence) is
        // visible in what reaches the arena; at 1 both branches yield 1 and the handicap is unobservable.
        mode: 'mission', year: { ...YEARS[1], perStage: 1, speeds: [2], diffs: [1] },
        topic: topicOf('sequence', () => ({ prompt: 'Build it', answer: sequence.join(' '), options, sequence, wide: true }), { subject: 'writing' }),
        rng: rngFor(seed), stages: 1,
      },
      {
        onQuestion: (q, info) => { speeds.push(info.speed); s.spawn(waveOptsFor(q, info, session.seqIndex)); },
        onCorrect: () => { correct++; }, onWrong: () => {}, onMiss: () => {},
        onProgress: (label, done, total) => {
          progress.push(label);
          if (done < total) s.arena.rush(session.current!.sequence![done]);
        },
        onLives: () => {}, onStageClear: () => {}, onEnd: () => {},
      });
    session.start();
    expect(speeds, 'a sequence plays one speed step below the stage speed').toEqual([1]);
    return { s, session, progress, correct: () => correct };
  }

  it('pulls the next word forward through the play bridge and completes in order', () => {
    const { s, session, progress, correct } = orderedSequence(23);

    const hitNext = (label: string) => {
      const bubble = launched(s, label);
      expect(s.arena.hitLabel(label), `${label} must be hittable when its turn arrives`).toBe(true);
      const hit = s.events.hits.shift();
      expect(hit, 'the arena must report the slice to the session bridge').toEqual({ label, viaSwipe: false });
      return { bubble, result: session.hit(hit!.label) };
    };

    expect(hitNext('one').result).toBe('step');
    const nextBefore = launchAtOf(s, 'three');
    const laterBefore = launchAtOf(s, 'five');

    expect(hitNext('two').result).toBe('step');
    const nextAfter = launchAtOf(s, 'three');
    const laterAfter = launchAtOf(s, 'five');
    expect(nextAfter, 'earning word three pulls its batch forward').toBeLessThan(nextBefore);
    expect(laterAfter, 'a later batch waits until it is earned in turn').toBe(laterBefore);

    // Moving earlier is only the direction; the guard is the apex clamp in `Arena.rush` ("that is how waves
    // used to pile up"). Deleting that line leaves `toBeLessThan` green — the batch simply arrives at `now`
    // instead — so assert where it lands: after everything already in the air has stopped climbing. `vy < 0`
    // is rising (canvas y grows downwards), and the clamp's `launchAt + waveT/2` is exactly each bubble's
    // apex, since `layoutWave` gives every arc `vy = -g * T / 2`.
    const airborne = s.all().filter(b => b.launched && !b.dead && !b.hit);
    expect(airborne.length, 'nothing in the air = nothing for the rush to wait for').toBeGreaterThan(0);
    const lastUp = airborne.reduce((a, b) => (b.launchAt > a.launchAt ? b : a));
    expect(lastUp.vy, 'the wave above must still be climbing here, or the clamp is not being exercised').toBeLessThan(0);
    launched(s, 'three');
    expect(lastUp.vy, 'the earned batch rose through a wave that was still going up').toBeGreaterThanOrEqual(0);

    // Every remaining step, not only the first two: the review found `rush` could stop working after two calls
    // with the suite green, because `launched()` waits up to 20 s and an un-rushed batch arrives on its own.
    // `dealOrdered` puts two words in each batch, so a word whose batch is already up is not rushed — its
    // launch time must then be untouched, which is the "moves only that one batch" half of the contract.
    for (const word of sequence.slice(2, -1)) {
      const next = sequence[sequence.indexOf(word) + 1];
      const queued = !s.all().find(b => b.label === next)!.launched;
      const before = launchAtOf(s, next);
      expect(hitNext(word).result).toBe('step');
      if (queued) expect(launchAtOf(s, next), `earning ${next} must pull its batch forward`).toBeLessThan(before);
      else expect(launchAtOf(s, next), `${next} was already up — nothing to rush`).toBe(before);
    }
    expect(hitNext(sequence.at(-1)!).result).toBe('correct');
    expect(progress, 'each earned word is reported once, in the order the child earned them').toEqual(sequence);
    expect(correct(), 'the whole ordered sequence settles exactly once').toBe(1);
    expect(session.seqIndex).toBe(sequence.length);
    expect(s.events.hits, 'every slice was reported exactly once').toEqual([]);
  });

  it('rush moves the batch holding the earned word, not merely the earliest batch still queued', () => {
    // In every scenario above "the batch holding the next word" and "the earliest queued batch" coincide,
    // because `dealOrdered` lays the words out in order — so a `rush` that ignored its label and moved
    // whatever was queued first stayed green. Ask for a word two batches down while the batch before it is
    // still queued: that batch must move, and the one in front of it must not.
    const { s } = orderedSequence(23);
    const three = launchAtOf(s, 'three'), five = launchAtOf(s, 'five');
    expect(s.all().find(b => b.label === 'three')!.launched, 'the batch before is still queued').toBe(false);
    expect(three, 'the layout must put three before five for this to test anything').toBeLessThan(five);
    expect(s.arena.rush('five')).toBe(true);
    expect(launchAtOf(s, 'five'), 'the batch holding the earned word moved').toBeLessThan(five);
    expect(launchAtOf(s, 'three'), 'the batch in front of it did not').toBe(three);
  });

  it('a later word of the sequence sliced out of turn is wrong, not quiet progress', () => {
    // `progress` above is a transcript of the test's own input — every hit is asserted to return 'step', which
    // only happens when the label IS the target — so the ordering rule the whole `ordered`/`rush` machinery
    // exists to serve was untested: crediting any sequence word out of turn (`q.sequence.includes(label)` in
    // place of `label === target`, src/game/session.ts:95) left the entire unit suite green. It is reachable
    // in real play: `perBatch` is 4 and `dealOrdered` puts two targets in the same batch, so word 2 is on
    // screen — here it even rises first, at +840 ms against word 1's +1260 ms — while word 1 is still
    // unearned. This needs its own scenario: a wrong answer sets `waiting`, which would strand the one above.
    const { s, session, progress } = orderedSequence(23);
    launched(s, 'two');
    expect(session.seqIndex, 'word 1 is still unearned — that is what makes this slice out of turn').toBe(0);

    expect(s.arena.hitLabel('two'), 'the child reaches the second word first').toBe(true);
    const hit = s.events.hits.shift();
    expect(hit).toEqual({ label: 'two', viaSwipe: false });
    expect(session.hit(hit!.label), 'word 2 before word 1 is a wrong answer').toBe('wrong');
    expect(session.seqIndex, 'and earns no step').toBe(0);
    expect(progress, 'nor reports progress the child has not made').toEqual([]);
    expect(s.events.hits, 'one slice, one report').toEqual([]);
  });
});

describe('#142: the arena drives the whole mission stage machine', () => {
  it('advances questions and stages, tops up lives, records stars, and ends once', () => {
    // No `lives` override: `YEARS[1].lives` is what the top-up below is capped by, and the scenario's numbers
    // are worked out against it, so pin it rather than restate it.
    const year: YearInfo = { ...YEARS[1], perStage: 2, speeds: [1, 3], diffs: [1, 3] };
    expect(year.lives, 'the top-up arithmetic below assumes a three-life year').toBe(3);
    const questions: { stage: number; index: number; speed: number }[] = [];
    const clears: { stage: number; stars: number; accuracy: number }[] = [];
    const lives: number[] = [];
    const misses: string[] = [];
    const results: SessionResult[] = [];
    let serial = 0;

    sim = createSim({ seed: 31 });
    const session = new Session(
      {
        mode: 'mission', year, stages: 2, rng: rngFor(31),
        // Every wave is self-identifying — `a3` can only have come from question 3 — so a bubble left over
        // from the previous wave can never satisfy an assertion meant for this one.
        topic: topicOf('mission', () => { const n = ++serial; return { prompt: `q${n}`, answer: `a${n}`, options: [`a${n}`, `x${n}`] }; }),
      },
      {
        onQuestion: (q, info) => {
          questions.push({ stage: info.stage, index: info.index, speed: info.speed });
          sim!.spawn(waveOptsFor(q, info, session.seqIndex));
        },
        onCorrect: () => {}, onWrong: () => {}, onProgress: () => {},
        onMiss: q => { misses.push(q.answer); },
        onLives: n => { lives.push(n); },
        onStageClear: (stage, stars, accuracy) => { clears.push({ stage, stars, accuracy }); },
        onEnd: result => { results.push(result); },
      });

    // The bridge `src/ui/play-session.ts` makes, in the arena's own order: falls are reported as they happen,
    // the wave end after the last of them. `drainWaveEnds()` both reads and resets the count (#126), so
    // "exactly one since I last checked" is the assertion itself rather than a hand-maintained running total.
    const endWave = () => {
      expect(sim!.drainWaveEnds(), 'the arena must report exactly one wave end per question').toBe(1);
      for (const label of sim!.take('falls')) session.fall(label);
      session.waveEnd();
    };
    /**
     * Let the wave fall off the bottom un-sliced: the arena-driven miss, the one edge a slice never reaches.
     * `waiting` is checked between the fall and the wave end because `Session.waveEnd` has its own "nothing
     * was decided" fallback that also scores a miss — a `fall()` that did nothing would look identical by
     * the end of the wave, and only the moment in between tells the two apart.
     */
    const letFall = (target: string, decoy: string) => {
      const before = sim!.events.waveEnds;
      // The decoy first, on its own, before the target has fallen: `Session.fall`'s "not the target — ignore
      // it" branch is only observable while `waiting` is still false. Draining both falls in array order let
      // the target latch `waiting` first and the decoy be swallowed by that instead, so deleting the guard
      // (`if (!isTarget) return`) left the suite green.
      const missesBefore = misses.length, livesBefore = session.lives;
      session.fall(decoy);
      expect(misses.length, 'a decoy falling past the bottom is not a miss').toBe(missesBefore);
      expect(session.lives, 'and costs nothing').toBe(livesBefore);
      expect(session.waiting, 'nor decides the question').toBe(false);
      advanceUntil(sim!, () => sim!.events.falls.includes(target), `${target} never fell`);
      for (const label of sim!.take('falls')) session.fall(label);
      expect(session.waiting, 'the question is decided by the fall itself, not by the wave ending').toBe(true);
      advanceUntil(sim!, () => sim!.events.waveEnds > before, 'the wave never fell off the screen');
      endWave();
    };
    const slice = (n: number, right: boolean) => {
      const label = right ? `a${n}` : `x${n}`;
      launched(sim!, label);
      expect(sim!.arena.hitLabel(label)).toBe(true);
      const hit = sim!.events.hits.shift();
      expect(hit).toEqual({ label, viaSwipe: false });
      expect(session.hit(hit!.label)).toBe(right ? 'correct' : 'wrong');
      sim!.arena.clearWave();
      endWave();
    };

    session.start();
    letFall('a1', 'x1');
    expect(misses, 'a target that falls past the bottom is a miss, reported through the arena').toEqual(['a1']);
    expect(session.lives, 'a first-stage miss costs one life').toBe(2);
    // Both stage-1 questions go, on purpose. With one slip the top-up reaches `year.lives` anyway
    // (`min(3, 2 + 1)`), so the assertion below could not tell `Math.min(year.lives, lives + 1)` from the
    // gentle branch's `this.lives = year.lives` leaking to every year: replacing the line outright left
    // 789/789 green. Two slips separate them — a top-up gives 2, a refill would give 3.
    slice(2, false);
    expect(session.lives, 'and so does a wrong slice').toBe(1);
    expect(clears).toEqual([{ stage: 1, stars: 1, accuracy: 0 }]);
    expect(session.stage, 'the stage-clear overlay owns the transition').toBe(1);

    session.nextStage();
    expect(session.stage).toBe(2);
    expect(session.lives, 'Year 1 gets ONE life back between stages, not a full refill').toBe(2);
    slice(3, true);
    slice(4, true);
    expect(clears).toEqual([
      { stage: 1, stars: 1, accuracy: 0 },
      { stage: 2, stars: 3, accuracy: 1 },
    ]);

    session.nextStage();
    expect(session.ended).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ won: true, stageStars: [1, 3], stars: 2, correct: 2, attempts: 4, questions: 4 });
    expect(questions).toEqual([
      { stage: 1, index: 0, speed: 1 }, { stage: 1, index: 1, speed: 1 },
      { stage: 2, index: 0, speed: 3 }, { stage: 2, index: 1, speed: 3 },
    ]);
    expect(lives, 'a miss, a slip and one between-stage top-up are reported').toEqual([2, 1, 2]);
    expect(sim.events.hits, 'every slice was reported exactly once').toEqual([]);
    expect(sim.events.falls, 'every fall was bridged').toEqual([]);

    session.nextStage();
    expect(results, 'the finished mission cannot end twice').toHaveLength(1);
  });
});

/**
 * Bubble collisions are wired into the running arena (#108).
 *
 * These exist because of a review finding, and the finding was bad enough to be worth writing down: every
 * other test of this feature calls `resolveCollisions` directly, so all three of these mutations left the
 * whole 942-test suite green and `tsc` clean —
 *
 *   1. delete the `resolveCollisions(...)` call in `update()` — bubbles pass through each other again;
 *   2. invert the restitution ternary — ordered waves bounce hard and ordinary waves damp;
 *   3. `this.orderedWave = false` in `spawnWave` — damping never applies to anything.
 *
 * The entire feature could be removed from the game with nothing going red. The e2e was no backstop either:
 * its only overlap assertion tolerates a quarter of a bubble and passed on `main` before the feature existed.
 * These three scenarios drive the REAL `Arena` frame by frame and each mutation above turns one of them red.
 */
describe('bubbles collide in the running arena, not just in the pure function (#108)', () => {
  /** Two live bubbles, placed overlapping by hand, and the arena stepped one frame over them. */
  const twoOverlapping = (opts: { ordered?: string[] }, vx: number) => {
    sim?.destroy(); sim = null;          // a scenario that builds two sims must not leak the first one
    sim = createSim({ W: 390, H: 760 });
    sim.spawn({ labels: ['1', '2', '3', '4'], speed: 2, ...opts });
    sim.advance(1200);                                   // let the first batch get airborne
    const up = sim.all().filter(b => b.launched && !b.dead);
    expect(up.length, 'need two bubbles in the air to collide').toBeGreaterThanOrEqual(2);
    const [a, b] = up;
    // Put them head-on and overlapping. These are the arena's own Bubble objects, so the next frame runs the
    // real update() over them — nothing here re-implements a rule.
    a.x = 180; a.y = 400; a.vx = vx; a.vy = 0;
    b.x = 180 + (a.r + b.r) * 0.6; b.y = 400; b.vx = -vx; b.vy = 0;
    sim.frame();
    return { a, b, gap: Math.hypot(b.x - a.x, b.y - a.y), min: a.r + b.r };
  };

  it('separates an overlapping pair — the resolver is actually called from update()', () => {
    // Mutation 1 (delete the call) leaves the pair exactly where it was put, and this goes red.
    const { gap, min } = twoOverlapping({}, 0);
    expect(gap, 'the arena pushed them apart').toBeGreaterThanOrEqual(min - 0.05);
  });

  it('bounces an ordinary wave harder than an ordered one — the restitution actually reaches the solver', () => {
    // Kills mutation 2 (inverted ternary) and mutation 3 (`orderedWave` never set): both make these equal,
    // or swap them. Measured through the real arena, not by reading a constant.
    const p = twoOverlapping({}, 240); const plain = p.b.vx - p.a.vx;       // how fast they part
    const s = twoOverlapping({ ordered: ['1', '2'] }, 240); const seq = s.b.vx - s.a.vx;
    expect(plain, 'an ordinary wave bounces').toBeGreaterThan(0);
    expect(seq, 'an ordered wave still bounces, just softly').toBeGreaterThan(0);
    expect(seq, 'a sequence wave must bounce LESS, so a required label is not knocked out of reach')
      .toBeLessThan(plain * 0.9);
  });

  it('holds the no-overlap invariant across a whole wave in the real arena', () => {
    sim = createSim({ W: 390, H: 760 });
    sim.spawn({ labels: ['1', '2', '3', '4', '5', '6', '7', '8'], speed: 3 });
    for (let f = 0; f < 600; f++) {
      sim.frame();
      const up = sim.all().filter(b => b.launched && !b.dead);
      for (let i = 0; i < up.length; i++) for (let j = i + 1; j < up.length; j++) {
        const p = up[i], q = up[j];
        expect(Math.hypot(q.x - p.x, q.y - p.y), `frame ${f}: ${p.label} and ${q.label} overlap in the arena`)
          .toBeGreaterThanOrEqual(p.r + q.r - 0.05);
      }
      if (up.length === 0 && f > 60) break;
    }
  });
});

// #16 review (PR #295): `pointerup`/`pointercancel` are window listeners, so with two arenas on one page every
// finger lift reached both, and `onUp` ignored `pointerId` — Player 2's tap flipped Player 1's `pointerDown`
// off mid-swipe and the rest of that stroke hit nothing. A lift by another pointer must leave a stroke alone.
describe('a pointer that did not go down on this canvas cannot end its stroke (#16)', () => {
  function frozenWave(s: Sim) {
    s.spawn({ labels: ['1', '2', '3', '4'], speed: 1 });
    advanceUntil(s, () => s.live().length === 4, 'the wave never fully launched');
    for (const b of s.arena.bubbles) { b.vx = 0; b.vy = 0; b.g = 0; b.y = s.arena.H * 0.5; }   // hold still so a swipe can cross a known spot
    s.frame();
    return s.live();
  }
  it('another pointer\'s lift leaves the stroke alive: the swipe still slices', () => {
    sim = createSim({ seed: 7 });
    const [b] = frozenWave(sim);
    sim.pointer('pointerdown', { x: 5, y: 5, pointerId: 1 });      // Player 1 starts a swipe in an empty corner
    sim.pointer('pointerup', { x: 300, y: 300, pointerId: 2 });     // Player 2 taps and lifts in the other arena
    sim.pointer('pointermove', { x: b.x - b.r - 20, y: b.y, pointerId: 1 });
    sim.pointer('pointermove', { x: b.x + b.r + 20, y: b.y, pointerId: 1 });   // the segment crosses the bubble
    expect(sim.take('hits'), 'the swipe crossed a bubble after the foreign lift').toEqual([{ label: b.label, viaSwipe: true }]);
  });
  it('a second finger down on the same canvas takes the stroke over; the first finger\'s move slices nothing', () => {
    // PR #295 review, round 2: `onDown` re-seats the trail at the second finger, and `onMove` used to accept the
    // first finger's next move from there — a segment neither finger drew, awarded as a slice.
    sim = createSim({ seed: 7 });
    const live = frozenWave(sim); const b = live.reduce((r, x) => (x.x > r.x ? x : r), live[0]);   // the rightmost bubble
    sim.pointer('pointerdown', { x: 5, y: 5, pointerId: 1 });
    sim.pointer('pointerdown', { x: b.x, y: b.y + b.r + 30, pointerId: 2 });     // rests just below it: no tap hit
    expect(sim.take('hits'), 'the resting finger touched nothing').toEqual([]);
    sim.pointer('pointermove', { x: b.x, y: b.y - b.r - 30, pointerId: 1 });     // finger 1 is now the foreign one
    expect(sim.take('hits'), 'a segment neither finger drew must not slice').toEqual([]);
    sim.pointer('pointermove', { x: b.x, y: b.y - b.r - 30, pointerId: 2 });     // the finger that owns the stroke does
    expect(sim.take('hits')).toEqual([{ label: b.label, viaSwipe: true }]);
    // The older finger lifting changes nothing for the owner: the takeover is complete, not shared.
    const [c] = sim.live();
    sim.pointer('pointerup', { x: 5, y: 5, pointerId: 1 });
    sim.pointer('pointermove', { x: c.x, y: c.y - c.r - 30, pointerId: 2 });   // along the clear lane above the row
    sim.take('hits');
    sim.pointer('pointermove', { x: c.x, y: c.y + c.r + 20, pointerId: 2 });   // straight down through c alone
    expect(sim.take('hits'), 'the owning finger keeps slicing after the older one lifts').toEqual([{ label: c.label, viaSwipe: true }]);
  });
  it('pointercancel follows the same rule: a foreign one is ignored, the stroke\'s own one ends it', () => {
    sim = createSim({ seed: 7 });
    const [b] = frozenWave(sim);
    sim.pointer('pointerdown', { x: 5, y: 5, pointerId: 1 });
    sim.pointer('pointercancel', { x: 5, y: 5, pointerId: 2 });
    sim.pointer('pointermove', { x: b.x - b.r - 20, y: b.y, pointerId: 1 });
    sim.pointer('pointermove', { x: b.x + b.r + 20, y: b.y, pointerId: 1 });
    expect(sim.take('hits'), 'still sliced after the foreign cancel').toEqual([{ label: b.label, viaSwipe: true }]);
    sim.pointer('pointercancel', { x: 5, y: 5, pointerId: 1 });
    const [c] = sim.live();
    sim.pointer('pointermove', { x: c.x - c.r - 20, y: c.y, pointerId: 1 });
    sim.pointer('pointermove', { x: c.x + c.r + 20, y: c.y, pointerId: 1 });
    expect(sim.take('hits'), 'nothing after its own cancel').toEqual([]);
  });
  it('the same pointer\'s lift still ends it: nothing is sliced afterwards', () => {
    sim = createSim({ seed: 7 });
    const [b] = frozenWave(sim);
    sim.pointer('pointerdown', { x: 5, y: 5, pointerId: 1 });
    sim.pointer('pointerup', { x: 5, y: 5, pointerId: 1 });
    sim.pointer('pointermove', { x: b.x - b.r - 20, y: b.y, pointerId: 1 });
    sim.pointer('pointermove', { x: b.x + b.r + 20, y: b.y, pointerId: 1 });
    expect(sim.take('hits')).toEqual([]);
  });
});

// #331: `onMove` returned early while `paused || frozen` WITHOUT updating `lastPt`, so the point a finger was
// at when the freeze began survived the freeze. A wave ending is `reveal()` → `clearWave()` → `spawnWave()`,
// and the first move after it hit-tested the segment from that stale point to the current one — a line drawn
// across the whole of the NEXT wave, the correct answer among it. Pre-existing on `main`; Ninja Duel is where
// it decides the round, because the player who has just lost is the one still holding the glass.
describe('a stroke held through a freeze does not draw a line through time (#331)', () => {
  /** A wave of four, launched and pinned in a row at mid-height so a swipe crosses a known lane. */
  function pinnedRow(s: Sim) {
    s.spawn({ labels: ['1', '2', '3', '4'], speed: 1 });
    advanceUntil(s, () => s.live().length === 4, 'the wave never fully launched');
    for (const b of s.arena.bubbles) { b.vx = 0; b.vy = 0; b.g = 0; b.y = s.arena.H * 0.5; }
    s.frame();
    return s.live();
  }

  it('a finger that never lifts across a wave end slices nothing of the next wave', () => {
    sim = createSim({ seed: 7 });
    const row = pinnedRow(sim);
    const lane = row[0].y;
    sim.pointer('pointerdown', { x: 2, y: lane, pointerId: 1 });     // down in the empty left margin, on the row's lane
    expect(sim.take('hits'), 'the finger went down on nothing').toEqual([]);

    sim.arena.reveal({ good: row[0].label });                        // the question is answered: the wave freezes
    sim.pointer('pointermove', { x: 40, y: lane, pointerId: 1 });    // the finger drifts while everything is held
    sim.take('hits');
    sim.arena.clearWave();                                           // wave over, arena unfreezes
    const next = pinnedRow(sim);

    sim.pointer('pointermove', { x: sim.arena.W - 2, y: lane, pointerId: 1 });   // one twitch, right across the arena
    expect(sim.take('hits'), 'the twitch sliced the next wave from a point the finger left a wave ago')
      .toEqual([]);
    expect(sim.live().length, 'the next wave is still up, unsliced').toBe(next.length);
  });

  it('a finger perfectly still through the hold, sending no move at all, is caught too', () => {
    // The case the early return in `onMove` cannot see: no pointermove arrives during the freeze, so the only
    // thing that observes it is the frame loop. Real holds last over a second, so frames are what actually
    // happen; a finger resting on the glass is the commonest way this bug is met.
    sim = createSim({ seed: 7 });
    const row = pinnedRow(sim);
    const lane = row[0].y;
    sim.pointer('pointerdown', { x: 2, y: lane, pointerId: 1 });
    sim.take('hits');
    sim.arena.reveal({ good: row[0].label });
    sim.advance(1300);                                               // the outcome hold, and not one pointer event in it
    sim.arena.clearWave();
    pinnedRow(sim);
    sim.pointer('pointermove', { x: sim.arena.W - 2, y: lane, pointerId: 1 });
    expect(sim.take('hits'), 'the still finger\'s first twitch sliced the next wave').toEqual([]);
  });

  it('the same is true of a pause: the finger keeps its stroke, not its old position', () => {
    sim = createSim({ seed: 7 });
    const row = pinnedRow(sim);
    const lane = row[0].y;
    sim.pointer('pointerdown', { x: 2, y: lane, pointerId: 1 });
    sim.take('hits');
    sim.arena.paused = true;
    sim.pointer('pointermove', { x: 40, y: lane, pointerId: 1 });    // drifts behind the pause overlay
    sim.arena.paused = false;
    sim.pointer('pointermove', { x: sim.arena.W - 2, y: lane, pointerId: 1 });
    expect(sim.take('hits'), 'a pause is not a licence to slice the row').toEqual([]);
  });

  it('a stroke that starts after the freeze keeps its first segment', () => {
    // The other way the fix could be wrong: staleness belongs to the stroke that spanned the freeze, not to
    // the arena. A child who lifts during the outcome hold and swipes afresh at the new wave has drawn no
    // line through time, and must not be charged one — without the reset in `onDown` their opening segment
    // is swallowed, which is the fix quietly eating a real slice.
    sim = createSim({ seed: 7 });
    const row = pinnedRow(sim);
    const lane = row[0].y;
    sim.pointer('pointerdown', { x: 2, y: lane, pointerId: 1 });
    sim.take('hits');
    sim.arena.reveal({ good: row[0].label });
    sim.advance(1300);
    sim.pointer('pointerup', { x: 2, y: lane, pointerId: 1 });       // the finger lifts during the hold
    sim.arena.clearWave();
    const next = pinnedRow(sim);
    const b = next.reduce((r, x) => (x.x < r.x ? x : r), next[0]);   // the leftmost bubble of the new row

    sim.pointer('pointerdown', { x: b.x, y: b.y - b.r - 30, pointerId: 2 });   // a fresh stroke, starting clear of the row
    expect(sim.take('hits'), 'the new stroke went down on nothing').toEqual([]);
    sim.pointer('pointermove', { x: b.x, y: b.y + b.r + 20, pointerId: 2 });   // straight down through b alone
    expect(sim.take('hits'), 'a fresh stroke\'s first segment still slices').toEqual([{ label: b.label, viaSwipe: true }]);
  });

  it('the stroke itself survives: the next real swipe still slices', () => {
    // The fix must not end the stroke — a child who holds the glass through the outcome hold and then swipes
    // properly is still playing. Only the segment spanning the freeze is dropped.
    sim = createSim({ seed: 7 });
    const row = pinnedRow(sim);
    const lane = row[0].y;
    sim.pointer('pointerdown', { x: 2, y: lane, pointerId: 1 });
    sim.arena.reveal({ good: row[0].label });
    sim.pointer('pointermove', { x: 40, y: lane, pointerId: 1 });
    sim.arena.clearWave();
    const next = pinnedRow(sim);
    const b = next.reduce((r, x) => (x.x < r.x ? x : r), next[0]);   // the leftmost bubble of the new row
    sim.take('hits');

    sim.pointer('pointermove', { x: b.x, y: b.y - b.r - 30, pointerId: 1 });   // move up into the clear lane: no hit
    expect(sim.take('hits'), 'the lane above the row is empty').toEqual([]);
    sim.pointer('pointermove', { x: b.x, y: b.y + b.r + 20, pointerId: 1 });   // then straight down through b alone
    expect(sim.take('hits'), 'a swipe drawn after the freeze still counts').toEqual([{ label: b.label, viaSwipe: true }]);
  });
});

// #463: #331's mechanism, at the other boundary that invalidates coordinates. `reanchor` moves every
// coordinate-bearing thing the arena holds into the resized box — bubbles, particles, shots, the trail — except
// `lastPt`, the point slice segments are actually drawn from. Rotating the phone (or the address bar collapsing
// on first scroll) with a finger down leaves `lastPt` in the OLD box, so the next twitch draws a segment from a
// point that no longer means anything to one that does — a line across the whole of the new, resized wave.
describe('a stroke held through a resize does not slice from a point the old box left behind (#463)', () => {
  function pinnedRow(s: Sim) {
    s.spawn({ labels: ['1', '2', '3', '4'], speed: 1 });
    advanceUntil(s, () => s.live().length === 4, 'the wave never fully launched');
    for (const b of s.arena.bubbles) { b.vx = 0; b.vy = 0; b.g = 0; b.y = s.arena.H * 0.5; }
    s.frame();
    return s.live();
  }
  /** Halves the arena's box and fires the resize `Arena` itself listens for — the same call `window`'s own
   *  `resize` event drives, so this exercises `reanchor` exactly as a real rotation or address-bar collapse
   *  would, not a shortcut around it. */
  function halveBox(s: Sim) {
    const canvas = s.arena.canvas as unknown as { getBoundingClientRect: () => { left: number; top: number; width: number; height: number; right: number; bottom: number; x: number; y: number } };
    const w = s.arena.W / 2, h = s.arena.H;
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: w, height: h, right: w, bottom: h, x: 0, y: 0 });
    s.arena.resize();
  }

  it('a finger down before a resize slices nothing of the row from a two-pixel twitch after it', () => {
    sim = createSim({ seed: 7 });
    const row = pinnedRow(sim);
    const lane = row[0].y;
    sim.pointer('pointerdown', { x: sim.arena.W - 2, y: lane, pointerId: 1 });   // down in the empty right margin
    expect(sim.take('hits'), 'the finger went down on nothing').toEqual([]);

    halveBox(sim);                                                              // e.g. a rotation, finger still down

    sim.pointer('pointermove', { x: 2, y: lane, pointerId: 1 });                 // one twitch, into the new box's own left margin
    expect(sim.take('hits'), 'the twitch sliced the row from a point the old box left behind').toEqual([]);
    expect(sim.live().length, 'the row is still up, unsliced').toBe(row.length);
  });

  it('a finger perfectly still through a resize, sending no move at all, is caught too', () => {
    // The case a `pointermove` handler alone cannot see: nothing moves during the resize itself, so only the
    // resize's own reanchor can observe it — the same asymmetry #331 found in the freeze/frame relationship.
    sim = createSim({ seed: 7 });
    const row = pinnedRow(sim);
    const lane = row[0].y;
    sim.pointer('pointerdown', { x: sim.arena.W - 2, y: lane, pointerId: 1 });
    sim.take('hits');

    halveBox(sim);

    sim.pointer('pointermove', { x: 2, y: lane, pointerId: 1 });
    expect(sim.take('hits'), 'the still finger\'s first twitch after the resize sliced the row').toEqual([]);
  });

  it('the stroke itself survives a resize: the next real swipe still slices', () => {
    // The fix must not end the stroke — a child who rotates the phone mid-hold and then swipes properly is
    // still playing. Only the segment spanning the resize is dropped.
    sim = createSim({ seed: 7 });
    const row = pinnedRow(sim);
    const lane = row[0].y;
    sim.pointer('pointerdown', { x: sim.arena.W - 2, y: lane, pointerId: 1 });
    sim.take('hits');

    halveBox(sim);
    const resized = sim.live();
    const b = resized.reduce((r, x) => (x.x < r.x ? x : r), resized[0]);         // the leftmost bubble, post-reanchor

    sim.pointer('pointermove', { x: b.x, y: b.y - b.r - 30, pointerId: 1 });     // the dropped segment: into the clear lane above
    expect(sim.take('hits'), 'the lane above the row is empty').toEqual([]);
    sim.pointer('pointermove', { x: b.x, y: b.y + b.r + 20, pointerId: 1 });     // then straight down through b alone
    expect(sim.take('hits'), 'a swipe drawn after the resize still counts').toEqual([{ label: b.label, viaSwipe: true }]);
  });
});

// #464: `onDown` returned early while `paused || frozen` WITHOUT taking `activeId` at all, so a press that
// landed mid-hold left the canvas with no owned stroke — every `pointermove` after it (`activeId === null`)
// was silently dropped until the finger lifted completely and pressed again, which is not something a child
// knows to do. The wrong-answer hold is 1.8s, exactly the moment a frustrated child presses the glass, and the
// next wave keeps rising underneath a dead finger the whole time. The fix reuses #331's `strokeStale`
// contract: a press during a freeze is now recorded (armed), so the same "first move after the thaw re-seats,
// slices nothing; the next one slices for real" rule that already covers a stroke spanning the freeze also
// covers one that starts inside it.
describe('a finger pressed during the outcome hold is not dead once it thaws (#464)', () => {
  function pinnedRow(s: Sim) {
    s.spawn({ labels: ['1', '2', '3', '4'], speed: 1 });
    advanceUntil(s, () => s.live().length === 4, 'the wave never fully launched');
    for (const b of s.arena.bubbles) { b.vx = 0; b.vy = 0; b.g = 0; b.y = s.arena.H * 0.5; }
    s.frame();
    return s.live();
  }

  it('a press 900ms into the hold is armed, and the next wave\'s first real swipe still slices', () => {
    // The issue's own reproduction: pinned row, reveal(), press mid-hold, clearWave(), a fresh wave, then a
    // genuine swipe through a bubble.
    sim = createSim({ seed: 7 });
    const row = pinnedRow(sim);
    const lane = row[0].y;
    sim.arena.reveal({ good: row[0].label });                       // the wave freezes for the outcome
    sim.advance(900);                                               // partway through the 1.8s hold
    sim.pointer('pointerdown', { x: 2, y: lane, pointerId: 1 });    // the finger presses while everything is held
    expect(sim.take('hits'), 'a press during the freeze must not hit-test anything').toEqual([]);

    sim.arena.clearWave();
    const next = pinnedRow(sim);
    const b = next.reduce((r, x) => (x.x < r.x ? x : r), next[0]);  // the leftmost bubble of the new row

    sim.pointer('pointermove', { x: b.x, y: b.y - b.r - 30, pointerId: 1 });   // first move after the thaw: re-seats, slices nothing (#331)
    expect(sim.take('hits'), 'the re-seating move must not itself slice').toEqual([]);
    sim.pointer('pointermove', { x: b.x, y: b.y + b.r + 20, pointerId: 1 });   // straight down through b alone
    expect(sim.take('hits'), 'a finger held dead through the freeze must be live again for the next wave')
      .toEqual([{ label: b.label, viaSwipe: true }]);
  });

  it('a press landing on a bubble during the freeze does not hit it — the tap test is skipped entirely while frozen', () => {
    // Not "cashed in later": `bubbleAt`/`hitBubble` are only ever reached from inside `onDown` itself, once,
    // synchronously. A stale press has no second chance to hit anything — the guarantee is that the immediate
    // tap-hit test never runs at all while `stalls()` is true, on empty space or squarely on a bubble alike.
    sim = createSim({ seed: 7 });
    const row = pinnedRow(sim);
    sim.arena.reveal({ good: row[0].label });
    sim.advance(900);
    const b = row[1];                                               // press directly on a bubble the freeze is holding
    sim.pointer('pointerdown', { x: b.x, y: b.y, pointerId: 1 });
    expect(sim.take('hits'), 'a press during the freeze must not hit-test anything, on a bubble or off it').toEqual([]);
  });
});
