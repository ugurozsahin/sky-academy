// A browserless simulation harness for the game's state machines (#142).
//
// The arena is the one module whose bugs are all about *time*: a shot that lands after the wave it belonged
// to was cleared, a bubble that falls one frame either side of a reveal, a batch that launches while the
// previous one is still in the air. Those are minutes of Playwright each, and the scheduled routine cannot
// run Playwright at all (CLAUDE.md: browsers cannot be downloaded on the Mac-side VM), so until now the only
// verification a run could actually execute was blind to them.
//
// What this stubs, and nothing else:
//   * the clock — `performance.now()` and `requestAnimationFrame`, so a frame costs no real time and the same
//     script gives the same answer every run;
//   * the canvas — `getContext('2d')` returns a recorder whose draw calls are no-ops, plus the two measuring
//     calls the arena genuinely reads back (`measureText`, `getBoundingClientRect`);
//   * `Math.random` — seeded, because `Arena.spawnWave` passes the global straight into `layoutWave`.
//
// What it deliberately does NOT do is model any game rule. Every number here comes from the real `Arena` and
// the real `Session`; if a scenario passes because the harness re-implemented a behaviour the game does not
// have, the test is worse than no test at all. It owns no bridge to the session either: every scenario that
// needs one writes its own few lines, next to its assertions, so a reader can check them against the screen
// (`src/ui/play-session.ts`) rather than trust a helper.
import { Arena, type ArenaOpts, type Bubble, type WaveOpts } from '../../../src/game/arena';

/** A small seeded PRNG (mulberry32): same seed, same stream, no dependency. */
export function rngFor(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Everything the arena asks a 2-D context for. The draws are no-ops; the logic is what is under test. */
function stubContext(charWidth: number) {
  const noop = () => {};
  const ctx: Record<string, unknown> = {
    // measurement — the only two calls whose return value the arena actually uses
    measureText: (t: string) => ({ width: sizeOf(String(ctx.font)) * t.length * charWidth }),
    createRadialGradient: () => ({ addColorStop: noop }),
    // state the arena sets and never reads back
    font: '10px sans-serif', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
    textAlign: 'start', textBaseline: 'alphabetic', lineJoin: 'miter', lineCap: 'butt',
  };
  for (const m of ['setTransform', 'clearRect', 'save', 'restore', 'translate', 'rotate', 'scale',
    'beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'arc', 'ellipse', 'fill', 'stroke',
    'fillRect', 'fillText', 'strokeText', 'drawImage']) ctx[m] = noop;
  return ctx;
}
/** The `NNpx` out of a CSS font string — how the stub turns a font size into a width. */
const sizeOf = (font: string) => parseFloat(/([\d.]+)px/.exec(font)?.[1] ?? '10');

/**
 * An `addEventListener`/`removeEventListener` pair that actually remembers what is attached.
 *
 * Both the canvas AND the window need this. `Arena` splits its listeners across the two — `pointerdown`
 * and `pointermove` on the canvas, `resize`, `pointerup` and `pointercancel` on the window — so a window
 * stub with no-op handlers makes the teardown assertion blind to three of the five, which is precisely the
 * shape of #31's leak: a *partial* removal, not a wholesale one. The existing text rail in guardrails.test.ts
 * catches deleting all three `window.removeEventListener` lines; only a live count catches dropping one.
 */
function listenerRecorder() {
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  return {
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: (e: unknown) => void) => { listeners.get(type)?.delete(fn); },
    listenerCount: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
    dispatch: (type: string, e: unknown) => { for (const fn of [...(listeners.get(type) ?? [])]) fn(e); },
  };
}

function stubCanvas(W: number, H: number, charWidth: number, fail?: SimOpts['failCanvas']) {
  const ctx = stubContext(charWidth);
  return {
    ...listenerRecorder(),
    width: W, height: H,
    // `Arena`'s constructor reads both of these through resize(), so either failure throws from inside it.
    getContext: () => { if (fail === 'getContext') return null; return ctx; },
    getBoundingClientRect: () => {
      if (fail === 'rect') throw new Error('canvas has no layout');
      return { left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0 };
    },
    setPointerCapture: () => {},
  };
}

/** How many listeners `Arena` attaches across the canvas and the window: 2 + 3. Asserted, not assumed. */
export const ARENA_LISTENERS = 5;

export interface SimOpts {
  /** Arena size in CSS pixels. Defaults to a portrait phone, which is the project's default viewport. */
  W?: number; H?: number;
  /** Seed for the stubbed `Math.random`, so a scenario is reproducible. */
  seed?: number;
  /** Average glyph width as a fraction of the font size — only `fitLabel` reads it. */
  charWidth?: number;
  /**
   * Test-only: break the canvas so the throw happens INSIDE `new Arena(...)`.
   *
   * The restore-on-throw path needs a scenario, and the obvious way to write one — an `opts.arena` getter that
   * throws — fires during the `{ ...opts.arena }` spread that builds the constructor's argument, *before* the
   * constructor is entered. The restore still happens (same `try`), but a scenario named after the constructor
   * never reaches it: proof is that guarding only the spread, and leaving `new Arena(...)` bare, left the suite
   * 181/181 green. `Arena`'s constructor calls `resize()`, which reads the canvas — so breaking the canvas is
   * what puts the throw where it belongs.
   */
  failCanvas?: 'rect' | 'getContext';
  /** Passed straight to the real `Arena`. */
  arena?: ArenaOpts;
}

/** What the arena told the outside world, in order. Scenarios assert on these rather than on private state. */
export interface SimEvents {
  hits: { label: string; viaSwipe: boolean }[];
  falls: string[];
  waveEnds: number;
  throws: number;
  lands: number;
}

export interface Sim {
  readonly arena: Arena;
  readonly events: SimEvents;
  /** Virtual milliseconds since the harness was installed. */
  now(): number;
  /** Run one animation frame (1/60 s). */
  frame(): void;
  /** Run whole frames until at least `ms` of virtual time has passed. Returns the frames run. */
  advance(ms: number): number;
  /** Spawn a wave through the real `Arena`, at the current virtual time. */
  spawn(o: WaveOpts): void;
  /** The bubbles a player (or the `window.__sna.bubbles()` hook) can currently see. */
  live(): Bubble[];
  /** Bubbles the arena is still holding, live or not — what a naive poll would read. */
  all(): Bubble[];
  /** Listeners still attached, across the canvas and the window; 0 after `destroy()`. */
  listeners(): number;
  /** True once `destroy()` has run. `destroy()` is idempotent, so a tracked sim may also tear itself down. */
  readonly destroyed: boolean;
  destroy(): void;
}

/** One animation frame, ms. Exported so a scenario can assert a launch happened in ITS frame, not a neighbour's. */
export const FRAME = 1000 / 60;

/**
 * Build a simulated arena. Remember to call `destroy()` — it tears the arena down AND restores the globals,
 * so a leaked harness cannot make the next test in the file non-deterministic.
 */
export function createSim(opts: SimOpts = {}): Sim {
  const W = opts.W ?? 390, H = opts.H ?? 844;
  const canvas = stubCanvas(W, H, opts.charWidth ?? 0.55, opts.failCanvas);
  const rng = rngFor(opts.seed ?? 0x5ade);

  let t = 0;                                        // virtual clock, ms
  let nextRaf = 1;
  let destroyed = false;
  const raf = new Map<number, (now: number) => void>();

  const saved = {
    performance: globalThis.performance, window: (globalThis as { window?: unknown }).window,
    document: (globalThis as { document?: unknown }).document,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    random: Math.random,
  };
  const g = globalThis as unknown as Record<string, unknown>;

  // The sprite caches in arena.ts call document.createElement('canvas'); nothing reads the pixels back.
  const doc = { createElement: () => stubCanvas(64, 64, opts.charWidth ?? 0.55) };
  const win = { ...listenerRecorder(), devicePixelRatio: 1 };

  /**
   * Put the real globals back. Called on `destroy()`, and on any throw while installing (see below).
   *
   * One assignment per line, deliberately: a guard rail reads this block to check that every stub is restored
   * from its own saved key, and it reads line by line. Crowding two onto a line hides the second from it.
   */
  const restore = () => {
    g.performance = saved.performance;
    g.window = saved.window;
    g.document = saved.document;
    g.requestAnimationFrame = saved.requestAnimationFrame;
    g.cancelAnimationFrame = saved.cancelAnimationFrame;
    Math.random = saved.random;
  };

  g.performance = { now: () => t };
  g.window = win;
  g.document = doc;
  g.requestAnimationFrame = (fn: (now: number) => void) => { const id = nextRaf++; raf.set(id, fn); return id; };
  g.cancelAnimationFrame = (id: number) => { raf.delete(id); };
  Math.random = rng;

  const events: SimEvents = { hits: [], falls: [], waveEnds: 0, throws: 0, lands: 0 };

  // The globals are already installed, so a throw from here on must put them back before it propagates.
  // Without this, `new Arena(...)` failing leaves no `Sim` for afterEach to destroy, and every later scenario
  // in the file runs against a seeded Math.random and a frozen clock — failing somewhere else entirely, with
  // a message pointing at the wrong code. That is a worse day than the original error.
  let arena: Arena;
  try {
    arena = new Arena(canvas as unknown as HTMLCanvasElement, {
      onHit: (b, viaSwipe) => { events.hits.push({ label: b.label, viaSwipe }); },
      onFall: (b) => { events.falls.push(b.label); },
      onWaveEnd: () => { events.waveEnds++; },
    }, {
      ...opts.arena,
      onThrow: () => { events.throws++; opts.arena?.onThrow?.(); },
      onLand: () => { events.lands++; opts.arena?.onLand?.(); },
    });
  } catch (e) {
    restore();
    throw e;
  }

  const frame = () => {
    t += FRAME;
    for (const [id, fn] of [...raf]) { raf.delete(id); fn(t); }
  };

  return {
    arena, events,
    now: () => t,
    frame,
    advance(ms: number) {
      const until = t + ms;
      let n = 0;
      while (t < until) { frame(); n++; }
      return n;
    },
    spawn(o: WaveOpts) { arena.spawnWave(o); },
    // Exactly the predicate `window.__sna.bubbles()` uses in src/ui/play.ts — a scenario asking "what can the
    // child see?" must ask it the same way the e2e does, or the two disagree about the same moment.
    live: () => arena.bubbles.filter(b => b.launched && !b.dead && !b.hit && !b.fade),
    all: () => arena.bubbles,
    // Both halves: Arena splits its five listeners across the canvas and the window.
    listeners: () => canvas.listenerCount() + win.listenerCount(),
    get destroyed() { return destroyed; },
    destroy() {
      // Idempotent: a scenario that tears its own sim down AND is tracked by `afterEach` would otherwise
      // destroy twice, and the second `arena.destroy()` would call a `cancelAnimationFrame` the first
      // restore had already put back to Node's (absent) original — throwing from teardown, which is the
      // last place a useful error comes from. Tracking every sim is what makes a leak impossible; this is
      // what makes tracking free.
      if (destroyed) return;
      destroyed = true;
      // `finally`, because a throw from arena.destroy() must not strand the globals either.
      try { arena.destroy(); } finally { restore(); }
    },
  };
}

/**
 * Advance the clock until `pred` holds. **Throws** if it never does within `limitMs` of virtual time.
 *
 * Loud by default, and that is the whole point. This used to return a boolean, and six of its call sites
 * discarded it: the helper gave up quietly after 20 s of virtual time and the assertions underneath were then
 * satisfied by an empty sky. Three scenarios passed with nothing ever on screen — proved by breaking
 * launching outright in `Arena.update` and watching them stay green while 13 others went red. A test that
 * reports a pass about a moment it never observed is the exact defect this harness exists to prevent, so the
 * failure mode is now impossible to reach by forgetting something: `what` is required, and it names what
 * never happened.
 */
export function advanceUntil(sim: Sim, pred: () => boolean, what: string, limitMs = 20000): void {
  const until = sim.now() + limitMs;
  while (!pred() && sim.now() < until) sim.frame();
  if (!pred()) throw new Error(`advanceUntil gave up after ${limitMs} ms of game time: ${what}`);
}
