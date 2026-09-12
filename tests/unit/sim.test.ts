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
import { SHOT_FLIGHT } from '../../src/game/arena';
import { Session } from '../../src/game/session';
import { BOMB } from '../../src/ui/play-session';   // #142: the real TNT label, so a scenario cannot pass against one the game never spawns
import { YEARS } from '../../src/curriculum';
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
      { mode: 'mission', year, topic: { id: 't', title: 't', icon: 't', gen: () => ({ prompt: 'q', answer, options: labels }) } as never, rng: rngFor(1) },
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
    ['while building the constructor argument (an opts getter)', { arena: { get fx(): never { throw new Error('opts exploded'); } } as never }],
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
      { mode, year, topic: { id: 't', title: 't', icon: 't', gen: () => ({ prompt: 'q', answer: '7', options: ['7', '9'] }) } as never, rng: rngFor(2) },
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
