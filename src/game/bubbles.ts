// Bubble spawn, launch stagger and layout (#559, split out of arena.ts): the data model, the pure wave
// layout, bubble-to-bubble collision, label fitting, and the offscreen sprite caches drawBubble draws from.
// Nothing here touches a canvas event or the render loop — `Arena` still owns those.
import { shuffle } from '../curriculum/util';   // uniform Fisher–Yates; `Math.random` is a valid Rng () => number (#42)
import type { Rng } from '../curriculum/types';

export interface Bubble {
  id: number; label: string; x: number; y: number; vx: number; vy: number; g: number; r: number;   // g = per-bubble gravity (its arc is fixed at launch); the e2e freeze helper reads it
  launchAt: number; launched: boolean; hit: boolean; dead: boolean; color: string; wobble: number;
  fontSize: number;   // label font size, fitted once at spawn (#28) so the per-frame draw never runs a measureText loop
  // The label as drawn: one line, or two when a single line would be squeezed (#348). `label` stays the
  // answer key (`hit()`, play.ts) and is never read from here — a space break drops its separator and a
  // hyphen break keeps it, so `lines.join()` does not reconstruct `label` and must never be used as if it did.
  lines: string[];
  labelState: LabelState;   // #348: `small` or `overflow` says this bubble's label did not fit readably
  mark?: 'good' | 'bad'; markAt?: number; fade?: boolean;   // outcome reveal: spotlighted (✓/✗) or faded out
  // #591: the arc this bubble launched on, kept so a re-launch (below) starts it exactly as it first went up
  // rather than from wherever a collision had carried it — `x`/`vx`/`vy` drift from spawn during flight, `g`
  // never does (nothing but `resolveCollisions` and gravity touch a bubble's motion, and neither reassigns it).
  ox: number; ovx: number; ovy: number;
  relaunches: number;   // how many times a required sequence label has already been sent back up (max 3)
}
/** A bubble the player can still slice or tap: launched, and not already resolved by a hit, a miss, or the
 *  outcome fade (#304). Both screens' `window.__sna.bubbles()` hooks and the sim harness's `live()` spelled
 *  this out separately; `Arena.hitLabel` had a fourth copy missing `!fade` — harmless in practice (a `fade`
 *  bubble only exists while `reveal()` has also set `frozen`, which `hitLabel` already refuses outright) but
 *  a silent way for a fifth copy to miss it for real. Not `inFlight` below: that one is arena-internal physics
 *  (is this bubble still moving, for collision resolution), a different question with the same name.
 */
export const hittable = (b: Bubble) => b.launched && !b.dead && !b.hit && !b.fade;

export const GOOD = '#66e07d', BAD = '#ff5f6d';
// #29 glow-underlay colours: compile-time constants, hoisted out of the per-frame draw so drawParticle/drawBubble
// never rebuild an rgba() string (arena's #28 rule — no per-frame colour strings). hexA/hexToRgb are hoisted fns.
export const GOOD_HALO = hexA(GOOD, 0.35), BAD_HALO = hexA(BAD, 0.35);

export const PALETTE = ['#ff5f6d', '#ffa726', '#ffd54f', '#66e07d', '#40c4ff', '#b388ff', '#ff7ac6', '#4dd0e1'];

// #591: how long a re-launched sequence bubble waits below the floor before it rises again — long enough to
// read as the word coming back up, not a flicker, short enough that the child is not left waiting on it.
export const RELAUNCH_DELAY = 300;
// #591: a required sequence label gets this many free trips back up before a departure is finally a miss —
// "the first three departures", the owner's own words on the issue.
export const MAX_RELAUNCHES = 3;

export interface WaveOpts {
  labels: string[]; speed: number; wide?: boolean; gravity?: number;
  ordered?: string[];   // sequence labels that must be sliced in this order
  // #700: a non-sequence question's correct-answer label, for a gentle year only — it gets one free trip
  // back up if it falls unhit, the same idea as `ordered` above but for a single label and a single trip.
  gentleTarget?: string;
}

/** Deal a sequence wave: the words that must be sliced in order are spread across the batches IN ORDER
 *  (batch 1 gets the first few, batch 2 the next few…), decoys fill the remaining slots, and the position
 *  inside a batch stays random. Without this the child slices word 1 and then waits seconds for word 2.
 *  `ordered` must be a subset of `labels` (labels not present are skipped). */
export function dealOrdered(labels: string[], ordered: string[], perBatch: number, rng: Rng): number[] {
  const pool = labels.map((l, i) => ({ l, i }));
  const targets: number[] = [];
  for (const label of ordered) { const k = pool.findIndex(x => x.l === label); if (k >= 0) targets.push(pool.splice(k, 1)[0].i); }
  const decoys = shuffle(rng, pool.map(x => x.i));
  const batches = Math.max(1, Math.ceil(labels.length / perBatch));
  const perBatchTargets = Math.max(1, Math.ceil(targets.length / batches));
  const out: number[] = [];
  let t = 0, d = 0;
  for (let b = 0; b < batches; b++) {
    const slots = Math.min(perBatch, labels.length - out.length);
    const batch: number[] = [];
    while (batch.length < Math.min(perBatchTargets, slots) && t < targets.length) batch.push(targets[t++]);
    while (batch.length < slots && d < decoys.length) batch.push(decoys[d++]);
    while (batch.length < slots && t < targets.length) batch.push(targets[t++]);
    out.push(...shuffle(rng, batch));
  }
  return out;
}

// 700 is the heaviest weight Fredoka actually has: Google Fonts answers a request for `wght@800` with HTTP
// 400. Asking for 800 here therefore asked for a face that does not exist — and, measured, changed nothing:
// Chromium picks the nearest declared face, so 700/800/900 render identically (same advance width, zero
// differing pixels; 500 differs plainly, so the axis really is live). Nothing was ever smeared, and fitLabel
// measured exactly what it draws. The reason to write 700 is that the identical render is luck of the engine
// rather than construction — the spec permits synthesising a heavier face, and WebKit and older Android
// WebView do — plus nobody should read "800" here and infer a heavier Fredoka exists.
// Same reasoning at every other Fredoka call site: the ✓/✗ badge below, visuals.ts, and style.css.
export const labelFont = (fs: number) => `700 ${fs}px "Fredoka", "Baloo 2", "Nunito", system-ui, sans-serif`;

// Fit a bubble label to its radius: a size from the character count, then shrunk until it fits `r * 1.75`.
/** Bubble radius for a viewport; words get wider bubbles. Pure so layoutWave needs no Arena instance. */
export function bubbleRadius(W: number, H: number, wide: boolean): number {
  const base = Math.min(W, H) * 0.085;
  return Math.max(30, Math.min(wide ? 64 : 54, wide ? base * 1.25 : base));
}

/** The arena's drawable box, in CSS pixels. */
export interface ArenaBox { W: number; H: number }
/**
 * Re-anchor one in-flight bubble from the box it was laid out in into the box the arena now has (#146).
 *
 * A bubble's whole flight is fixed at launch (`layoutWave`): it starts on the launch line just below the
 * bottom edge, at `y = H + r`, and rises on a parabola set by `vy` and `g`. So the move that keeps the
 * picture the child is watching is to map that launch line onto the new one and scale the height risen
 * from it — `x` and `vx` by the width ratio, the rise and `vy`/`g` by the height ratio.
 *
 * Scaling `vy` and `g` by the same factor is what makes this a re-anchor rather than a teleport: the rise
 * `vy²/2g` scales by `sy` exactly, while the time to the apex (`vy/g`) and the time still left in the air
 * are both unchanged, so a bubble lands on the beat it was always going to land on. The radius deliberately
 * does not scale — the label's font size was fitted to it once at spawn (#28), and a bubble that changed
 * size mid-flight would re-open that.
 */
export function reanchorBubble(b: { x: number; y: number; vx: number; vy: number; g: number; r: number; ox?: number; ovx?: number; ovy?: number }, from: ArenaBox, to: ArenaBox) {
  const sx = to.W / from.W, sy = to.H / from.H;
  const risen = (from.H + b.r) - b.y;                      // height above the launch line, which may be negative on the way out
  b.y = to.H + b.r - risen * sy;
  b.vy *= sy; b.g *= sy;
  // A narrower box must not leave a bubble hanging off either side. The left bound is the one play reaches:
  // `layoutWave` starts the leftmost bubble at `margin = r + 8`, so landscape → portrait scales x below `r`.
  // Where the box is narrower than the bubble (`to.W < 2 * b.r`) the two bounds cross and the right one wins,
  // putting x below `b.r` — `bubbleRadius` caps r at 64, so that needs a viewport under 128 CSS px.
  b.x = Math.min(to.W - b.r, Math.max(b.r, b.x * sx));
  b.vx *= sx;
  // #591: a bubble mid-relaunch-wait remembers its spawn arc in ox/ovx/ovy so a re-launch is not left running
  // an arc sized for a box that no longer exists — optional here (a plain `Collidable` in a test has none) so
  // only a real `Bubble` carries the extra work.
  if (b.ox !== undefined) b.ox = Math.min(to.W - b.r, Math.max(b.r, b.ox * sx));
  if (b.ovx !== undefined) b.ovx *= sx;
  if (b.ovy !== undefined) b.ovy *= sy;
}
/** The arena's shape, as much of it as the wave layout depends on. */
export interface WaveGeom { W: number; H: number; topInset: number }

/**
 * Bubble-to-bubble collision (#108).
 *
 * Until this, two bubbles were two independent ballistic arcs and nothing stopped them crossing: overlap was
 * only ever avoided *statistically*, by the slot layout in `layoutWave` and by batching, so on a busy wave
 * they slid through each other on screen. This resolves them for real.
 *
 * Kept pure and out of the draw path on purpose, like `layoutWave` above (#43): it takes plain numbers and a
 * geometry, so the no-overlap invariant is unit-testable frame by frame without a canvas or a browser.
 *
 * `n` is small — at most ~10 live bubbles — so the O(n²) pair sweep the issue sanctions is what this does,
 * with no broad phase. `ITERS` passes let a three-body pile converge instead of leaving a pair still sunk
 * into each other after one pass; the bounds clamp runs inside the loop, so a bubble pushed off the side is
 * put back and the *next* pass fixes any overlap that reintroduced.
 */
export const COLLIDE = {
  /** Restitution stays below 1 so a pile loses energy instead of gaining it. */
  bounce: 0.75,
  /** `ordered` sequence waves bounce softly: the issue's instruction is to damp them rather than drop the
   *  feature, because a stranded sequence bubble is unplayable in a way a dull bounce is not. */
  damped: 0.35,
  // There is deliberately NO absolute speed cap here. The first cut had one (900 px/s) and it was a bug:
  // `clampIntoArena` applied it to every live bubble whether or not it had touched anything, so it was not a
  // limit on what a bounce may add — it was a global speed limit on the wave, and `layoutWave` launches
  // faster than it. `|v0| = 4h/T` with `T = base / speedK`, so launch speed grows with arena height and with
  // `speedK`: an 800x1180 tablet at stage 3 already launches at 931 px/s and was throttled from the first
  // frame two bubbles were airborne, and at `__SNA_FAST = 4` (pre-#748; now 8), a phone wave cleared in 23
  // frames instead of 50 with an apex of 688 in a 760-high arena — bubbles that barely left the launch line.
  // #138 made `speedK` a pure time compression ("same apex, same landing x, less time") and a fixed
  // px/s number silently undid it. A constant cannot be right when the quantity it bounds is a function of
  // `H` and `speedK`; the bound belongs on the impulse, relative to the pair it acts on. See `capToPair`.
  /** Separation passes per frame. Six, not one: a three-body pile needs more than a single sweep to come
   *  apart, and the wall clamp inside the loop can push a bubble back into a neighbour that a later pass
   *  then has to undo. At <= 6 live bubbles this is ~90 distance checks in a healthy frame — but `update()`
   *  runs up to six 1/60s substeps when `dt` is capped at 0.1 (a recovered/janky frame), so the honest worst
   *  case is up to ~540, still cheap at this `n` (#152 review note 5). */
  iters: 6,
} as const;

/** The part of a bubble collision cares about — so a test can build one without a label or a font size.
 *  `mark` is optional and structural, not behavioural here: `resolveCollisions` excludes a marked bubble (see
 *  below) whether or not the caller ever sets it, the same way `dead`/`launched` already gate participation. */
export interface Collidable { x: number; y: number; vx: number; vy: number; g: number; r: number; launched: boolean; dead: boolean; mark?: 'good' | 'bad' }

/**
 * A bubble is in flight when something is still moving it. A bubble with no gravity and no velocity has been
 * *pinned* — which is what `freezeWave` in `tests/e2e/game.spec.ts` does to make a wave's coordinates
 * predictable before it clicks one, and #108 requires that those tests stay deterministic. Nothing in play is
 * ever pinned: every launched bubble carries its own `g`, fixed at launch and never zero, so this excludes
 * `freezeWave`'s frozen wave and nothing else. (The outcome reveal is handled separately, by `frozen` in
 * `update`.) If a future e2e helper ever pins a bubble by some other means — rather than zeroing `g`/`vx`/`vy`
 * the way `freezeWave` does — this contract silently stops holding and the symptom is a flaky click target,
 * not a red test (#152 review note 2).
 */
const inFlight = (b: Collidable) => b.g !== 0 || b.vx !== 0 || b.vy !== 0;

/**
 * Separate every overlapping pair and bounce them apart, in place. Equal masses, so the impulse is the
 * symmetric one; an approaching pair only.
 *
 * Bubbles that have not launched yet are still parked below the floor and are left alone — colliding them
 * there would shove the queue sideways before the child ever sees it. So are pinned ones; see `inFlight`.
 * So is a spotlighted outcome bubble (`mark` set, by `hitBubble`'s tap-hit or `reveal`'s ghost): it is placed
 * deliberately, including a nudge away from the other spotlighted one, and a resolver moving it afterwards
 * would be a visible defect. Today every `frozen = true` write happens before a mark is set and `clearWave`
 * kills every bubble before the next wave's marks, so "never resolve a marked bubble" already held in
 * practice; excluding it here makes that structural rather than resting on every future caller of `frozen`
 * staying correct (#152 review note 1).
 *
 * `counts`, when given, is incremented once per `left`/`right`/`ceiling` clamp `clampIntoArena` applies below —
 * which otherwise silently discards what it corrects, the only symptom an illegal wave layout would produce
 * (#152 review note 3). The wall clamps see real, legitimate traffic (a bubble pushed sideways by a collision
 * near the edge), so only `ceiling` is a true zero-in-normal-play invariant — see `tests/unit/arena.test.ts`
 * for the measurement. Passing `counts` turns a regression there into a sim test assertion, rather than
 * something a reviewer has to notice and derive from launch-speed arithmetic by hand.
 */
export function resolveCollisions(
  bubbles: readonly Collidable[],                 // elements are mutated; the array never is
  geom: WaveGeom,
  restitution: typeof COLLIDE.bounce | typeof COLLIDE.damped = COLLIDE.bounce,   // only these two are meaningful
  counts?: ClampCounts,
) {
  const live = bubbles.filter(b => b.launched && !b.dead && !b.mark && inFlight(b));
  // Two-or-fewer live bubbles skip the whole pass, clamps included — which is also why the *last* bubble of a
  // wave (where `live.length` drops to 1) is never wall/ceiling-clamped on its own, unlike the five before it.
  // #255's blocking finding was exactly this asymmetry catching an illegal launch speed on bubble 6 of 6 and
  // not on bubble 1: whatever this function becomes, that edge is worth re-deriving deliberately rather than
  // rediscovering it the same way again (#152 review note 4).
  if (live.length < 2) return;
  for (let pass = 0; pass < COLLIDE.iters; pass++) {
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j];
        const min = a.r + b.r;
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        // `!(d < min)`, not `d >= min`: with a NaN coordinate `d >= min` is false, so the pair would NOT be
        // skipped and both positions would be overwritten with NaN, which six passes then spread across the
        // wave — and a NaN bubble never satisfies the cull test in `update`, so the wave would never end.
        // No live path produces NaN today; this is the cheap direction to be wrong in.
        if (!(d < min)) continue;
        // Exactly concentric: there is no direction to separate along, so pick one. `d` stays 0 so the pair
        // is pushed the full `min` apart — deriving the normal from a faked `d` would leave them on top of
        // each other with `half` computed as zero.
        const nx = d === 0 ? 1 : dx / d, ny = d === 0 ? 0 : dy / d, half = (min - d) / 2;
        a.x -= nx * half; a.y -= ny * half;
        b.x += nx * half; b.y += ny * half;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) {                                   // approaching — separating pairs keep their velocity
          const fastest = Math.max(Math.hypot(a.vx, a.vy), Math.hypot(b.vx, b.vy));   // BEFORE the impulse
          const jn = (-(1 + restitution) * vn) / 2;
          a.vx -= jn * nx; a.vy -= jn * ny;
          b.vx += jn * nx; b.vy += jn * ny;
          capToPair(a, fastest); capToPair(b, fastest);
        }
      }
    }
    for (const b of live) clampIntoArena(b, geom, counts);
  }
}

/** How many times each of the three position clamps in `clampIntoArena` has fired — none of them ever should,
 *  in a legal wave layout (#152 review note 3). `resolveCollisions` mutates the caller's object in place, the
 *  same convention `Collidable`'s own fields use, rather than returning a fresh one every pass. */
export interface ClampCounts { left: number; right: number; ceiling: number }

/** Keep a bubble inside the play area and below the HUD (#108). Position only — see `COLLIDE` on why no
 *  absolute speed cap lives here. `counts`, when given, is told which of the three clamps fired — see
 *  `resolveCollisions`'s own doc comment for why a caller would want that. */
function clampIntoArena(b: Collidable, geom: WaveGeom, counts?: ClampCounts) {
  if (counts) {
    if (b.x < b.r) counts.left++;
    if (b.x > geom.W - b.r) counts.right++;
  }
  b.x = Math.min(geom.W - b.r, Math.max(b.r, b.x));
  const ceiling = geom.topInset + b.r;
  if (b.y < ceiling) { b.y = ceiling; if (b.vy < 0) b.vy = 0; if (counts) counts.ceiling++; }   // never above topInset, never still climbing there
}

/**
 * A bounce may not leave a bubble faster than the faster of the two was *before* it (#108).
 *
 * Scale-free on purpose: it is expressed in terms of the pair's own speeds, so it means the same thing on a
 * phone and on a tablet, at 1x and at 4x, and it can never touch a bubble that has not collided. An equal-mass
 * impulse with restitution below 1 cannot raise the pair's kinetic energy, but it can move energy between the
 * two, so a glancing hit can leave one of them at up to `hypot(v1, v2)` — faster than either arrived. This is
 * the guard for that, and nothing more.
 */
function capToPair(b: Collidable, fastest: number) {
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > fastest && sp > 0) { const k = fastest / sp; b.vx *= k; b.vy *= k; }
}
/** One bubble's whole flight, fixed at launch: where it starts, its arc, when it goes up and what it wears. */
export interface BubblePlan { label: string; x: number; vx: number; vy: number; g: number; launchAt: number; color: string; wobble: number }
/** A laid-out wave: the values the arena keeps for itself, plus one plan per bubble in launch order. */
export interface WavePlan { r: number; waveT: number; batchSpan: number; perBatch: number; batchGap: number; stagger: number; bubbles: BubblePlan[] }

/**
 * Lay out one wave (#43). Every number spawnWave used to compute inline lives here, and nothing here touches
 * a canvas, a clock or `Math.random` — `now` and `rng` are arguments — so the batch layout, the arcs and the
 * launch timetable are unit-testable instead of being reachable only through a 20-minute e2e run.
 *
 * `speedK` is the #32 test-only multiplier: it divides the air time and the stagger (and so batchGap, which
 * derives from T), never the clock. Bubbles come back in launch order, so `bubbles[k]` is the k-th to rise.
 */
export function layoutWave(o: WaveOpts, geom: WaveGeom, speedK: number, now: number, rng: Rng): WavePlan {
  const { W, H, topInset } = geom;
  const n = o.labels.length;
  let r = Math.max(26, bubbleRadius(W, H, !!o.wide) * (n >= 9 ? 0.8 : n >= 7 ? 0.9 : 1));
  r = Math.min(r, ((W - 16) / 3 - 10) / 2);                                    // at least three always fit across
  const T = (o.speed === 0 ? 7.5 : o.speed === 1 ? 5.6 : o.speed === 2 ? 4.4 : 3.4) / speedK;   // seconds in the air — 0 is Reception's gentle float (#700)
  const apexMin = topInset + r + 10;
  const usable = H - apexMin - r;
  const stagger = (o.speed === 0 ? 500 : o.speed === 1 ? 420 : o.speed === 2 ? 330 : 260) / speedK;
  // Long waves (a 7-word sentence plus decoys) launch in batches that fit across the width,
  // so bubbles never pile up on top of each other; each batch goes up as the previous one comes down.
  // A sequence must be sliced in order, so at most 4 bubbles ride each flight even on a wide screen:
  // otherwise a tablet puts all 10 words up at once and the child has one 4-second flight for the lot.
  const perBatch = Math.max(3, Math.min(o.ordered?.length ? 4 : n, Math.floor((W - 16) / (2 * r + 10))));
  const batchGap = T * 1000 * (perBatch < n && perBatch <= 4 ? 0.8 : 0.62);   // narrow screens: the row is mostly down before the next rises
  const order = o.ordered?.length ? dealOrdered(o.labels, o.ordered, perBatch, rng) : shuffle(rng, o.labels.map((_, i) => i));
  const margin = r + 8;
  const span = W - margin * 2;
  const bubbles: BubblePlan[] = [];
  for (let k = 0; k < n; k++) {
    const i = order[k];
    const batch = Math.floor(k / perBatch), idx = k % perBatch, size = Math.min(perBatch, n - batch * perBatch);
    // spread x across the width in shuffled slots so bubbles don't overlap; a full row uses the whole span edge to edge
    const full = size >= perBatch && size > 1;
    const slot = full ? idx / (size - 1) : (idx + 0.5) / size;
    const x = margin + span * Math.min(1, Math.max(0, slot + (rng() - 0.5) * ((full ? 0.25 : 0.6) / size)));
    const apexY = apexMin + usable * (0.05 + rng() * 0.45);
    const h = H + r - apexY;
    const tUp = T / 2;
    const g = 2 * h / (tUp * tUp);
    const vy = -Math.sqrt(2 * g * h);
    // #138: `* speedK` is what makes fast mode a pure time compression. vx is px/SECOND and the flight lasts
    // T/k seconds, so an unscaled vx drifts the bubble 1/k of the way across — a path no child ever sees.
    // Scaling it keeps the whole trajectory identical at any speed: same apex, same landing x, less time.
    const vx = ((W / 2 - x) / W) * 30 * (rng() * 0.6 + 0.4) * speedK;
    const launchAt = now + batch * batchGap + idx * stagger * (size > 6 ? 0.6 : 1);
    bubbles.push({ label: o.labels[i], x, vx, vy, g, launchAt, color: PALETTE[(k * 3 + Math.floor(rng() * 3)) % PALETTE.length], wobble: rng() * Math.PI * 2 });
  }
  return { r, waveT: T * 1000, batchSpan: perBatch * stagger, perBatch, batchGap, stagger, bubbles };
}

/**
 * The smallest a bubble label is ever drawn **when a wrap is available to try instead** — `fitLabel`'s own
 * shrink loop clamps to this and never steps below it. `LABEL_HARD_MIN_FS` below is lower still, for the one
 * case (#348) this floor cannot rescue: a label with no space or hyphen for `fitLabelLines` to break on.
 */
export const LABEL_MIN_FS = 10;
/**
 * The smallest an **unbreakable** label — no space or hyphen for `fitLabelLines` to wrap onto a second line —
 * may shrink to, when it is still wider than its bubble at `LABEL_MIN_FS` (#348 owner decision, 2026-09-24).
 * A label that has a break never reaches this: it always has the two-line attempt to try first, however that
 * turns out, so `fitLabelLines` never shrinks a breakable label below `LABEL_MIN_FS`. See `fitLabelLines`.
 */
export const LABEL_HARD_MIN_FS = 8;
/**
 * The smallest a label may be and still be *read* by a five-to-seven-year-old on a moving bubble (#348).
 *
 * The floor above is where the loop stops; this is where the issue's complaint starts. #348 measured
 * `£1 and 50p` at **10.6px** and called that too small — "one step above `fitLabel`'s hard `fs > 10`
 * floor" — while `9 o'clock` at 13.6px has never been complained about and is not what the issue is for.
 * 13 separates them, and it is the only thing that decides which labels a wrap may touch.
 *
 * **The structure is settled; this exact number is not** (PR #467 review addendum). What is
 * metric-independent, and what B1 was about, is that the gate asks "is this label too small to read?"
 * rather than "did it lose a pixel?" — the latter caught every label that shrank at all. Where between
 * the floor and comfortable the line sits can only be chosen against real `measureText` widths, which is
 * #348's own deferred piece 1; the unit measure here is a stand-in that puts `£1 and 50p` two pixels
 * above where the running game does. Until that lands, moving this constant moves which labels wrap, and
 * the sweep in the pull request body is the evidence for where it is now.
 */
export const LABEL_READABLE_FS = 13;
/** How much of `r` one line may spend. Exported for the R-LBL rail (#1046, `tests/unit/helpers/r-lbl.ts`). */
export const LINE_BUDGET = 1.75;
/** A wrapped line sits above or below the centre, where the disc's chord is a shade narrower. */
const WRAP_BUDGET = 1.7;
/** Two lines of this size stack to at most `WRAP_STACK * r`, so both stay inside the disc. */
const WRAP_MAX_FS = 0.62;
/** What two lines of `WRAP_MAX_FS * r` actually occupy vertically, as a share of `r` — pinned by a test. */
export const WRAP_STACK = 1.3;
/** The size a label starts at, from its character count, before anything is measured. */
const startFs = (label: string, r: number) => r * (label.length <= 2 ? 1.05 : label.length <= 4 ? 0.7 : label.length <= 7 ? 0.5 : 0.4);

/**
 * How a fitted label came out (#348), separating two conditions the first cut of this ran together:
 * `overflow` is wider than its bubble and spills onto the background; `small` is inside the bubble but
 * below `LABEL_READABLE_FS`, which is what #348 was filed about. `ok` is neither.
 */
export type LabelState = 'ok' | 'small' | 'overflow';

/** A fitted bubble label: the lines to draw, the size they share, and how it came out (#348). */
export interface LabelFit { fs: number; lines: string[]; state: LabelState }

// Shared by `fitLabel` and `fitLabelLines`'s unbreakable-overflow branch (#348 review): shrink `fs` by 1
// while still over budget, clamped so it never steps past `floor` — a bare `fs -= 1` used to step past a
// fractional start and return 9.56 from a floor documented as the smallest size ever drawn (review note 1).
// One loop, one clamp; only the floor passed in differs between the two callers.
function shrinkToFit(label: string, r: number, measure: (font: string, text: string) => number, fs: number, floor: number): number {
  while (measure(labelFont(fs), label) > r * LINE_BUDGET && fs > floor) fs = Math.max(floor, fs - 1);
  return fs;
}

// Called once per bubble in spawnWave (#28) — `measure` sets the font and returns the text width — instead
// of running the shrink loop in drawBubble every frame. Pure and canvas-free so it unit-tests directly.
export function fitLabel(label: string, r: number, measure: (font: string, text: string) => number): number {
  return shrinkToFit(label, r, measure, startFs(label, r), LABEL_MIN_FS);
}

/**
 * Break a label into two lines at the point that leaves the longer line shortest (#348).
 *
 * A space is the natural break; a hyphen is the fallback, kept on the first line the way a hyphenated word
 * is normally broken, because `a three-quarter turn` is one long *word* away from fitting and a space-only
 * rule leaves `three-quarter` — the whole problem — on a line of its own. `null` when there is neither.
 */
export function splitLabel(label: string): [string, string] | null {
  const breaks: [string, string][] = [];
  for (let i = 0; i < label.length; i++) {
    if (label[i] === ' ' && i > 0 && i < label.length - 1) breaks.push([label.slice(0, i), label.slice(i + 1)]);
    else if (label[i] === '-' && i > 0 && i < label.length - 1) breaks.push([label.slice(0, i + 1), label.slice(i + 1)]);
  }
  if (!breaks.length) return null;
  const longest = (b: [string, string]) => Math.max(b[0].length, b[1].length);
  // `<=` makes a tie take the **later** break, which is a real choice and not an accident: `£1 and 5p` ties
  // at 6 either way, and `£1 and` / `5p` reads as English where `£1` / `and 5p` does not (review note 6).
  return breaks.reduce((best, b) => longest(b) <= longest(best) ? b : best);
}

/**
 * Fit a label into its bubble, wrapping onto a second line when one line would be squeezed (#348).
 *
 * `fitLabel` shrinks until the label fits and then gives up at `LABEL_MIN_FS` **whether or not it does** —
 * so `£1 and 50p` was drawn at the floor and `a three-quarter turn` spilled out of the bubble onto the
 * background, and nothing anywhere said so. Two lines buy nearly twice the width at the same size, and
 * `state` reports what neither line count could rescue rather than discarding it.
 *
 * **Only a label #348 complains about is a wrap candidate**: one drawn below `LABEL_READABLE_FS`, or one
 * spilling out of its bubble. The first cut of this gated on "had to shrink at all", which is a far wider
 * net — it caught every `twenty-five` and every `9 o'clock`, 215 labels at the phone radius that were
 * already drawn comfortably on one line. Changing those is a look decision and not this issue's.
 */
export function fitLabelLines(label: string, r: number, measure: (font: string, text: string) => number): LabelFit {
  const state = (fs: number, width: number, budget: number): LabelState =>
    width > r * budget ? 'overflow' : fs < LABEL_READABLE_FS ? 'small' : 'ok';
  const oneFs = fitLabel(label, r, measure);
  const one: LabelFit = { fs: oneFs, lines: [label], state: state(oneFs, measure(labelFont(oneFs), label), LINE_BUDGET) };
  if (one.state === 'ok') return one;
  const split = splitLabel(label);
  if (!split) {
    // No space or hyphen to wrap on — the only path down from here is smaller still, to LABEL_HARD_MIN_FS
    // (#348 owner decision). A label that fits (or is merely 'small') at LABEL_MIN_FS stops right there; only
    // one still wider than its bubble at that floor shrinks further.
    if (one.state !== 'overflow') return one;
    const fs = shrinkToFit(label, r, measure, oneFs, LABEL_HARD_MIN_FS);
    return { fs, lines: [label], state: state(fs, measure(labelFont(fs), label), LINE_BUDGET) };
  }
  const widest = (fs: number) => Math.max(measure(labelFont(fs), split[0]), measure(labelFont(fs), split[1]));
  // Seed from the *longer* line: the shorter one would start too big and the loop would only walk back down
  // to the same place, but a step of 1 from a larger start can overshoot it (#348 review note 5).
  let fs = Math.min(fitLabel(split[0].length >= split[1].length ? split[0] : split[1], r, measure), r * WRAP_MAX_FS);
  while (widest(fs) > r * WRAP_BUDGET && fs > LABEL_MIN_FS) fs = Math.max(LABEL_MIN_FS, fs - 1);
  const two: LabelFit = { fs, lines: split, state: state(fs, widest(fs), WRAP_BUDGET) };
  // Take the wrap when it earns something: a better outcome than one line managed, a bigger label, or —
  // when neither is ok — the same size across narrower lines, which is less of the bubble overflowed.
  // `one.state` is never 'ok' here — the early return above took that case — so any improvement is a win,
  // and at equal rank equal size still is: the same font across two narrower lines is less cramped.
  const rank = (s: LabelState) => s === 'ok' ? 2 : s === 'small' ? 1 : 0;
  if (rank(two.state) !== rank(one.state)) return rank(two.state) > rank(one.state) ? two : one;
  return two.fs >= one.fs ? two : one;
}

/**
 * Say out loud that a label did not fit (#348). `visuals.ts` already warns for exactly this class of
 * condition — a picture the code drew differently from how it was asked to — and the whole of #348 is that
 * this one had no voice at all. Deduped by label and rounded radius so a ten-bubble wave warns once.
 */
const warnedLabels = new Set<string>();
export function warnUnfitLabel(label: string, r: number, fit: LabelFit) {
  if (fit.state === 'ok') return;
  const key = `${label}|${Math.round(r)}|${fit.state}`;
  if (warnedLabels.has(key)) return;
  warnedLabels.add(key);
  const how = fit.state === 'overflow' ? `is wider than its bubble (r ${r.toFixed(1)})` : `is drawn at ${fit.fs.toFixed(1)}px, under the ${LABEL_READABLE_FS}px a child can read`;
  console.warn(`bubble label "${label}" ${how} — drawn on ${fit.lines.length} line${fit.lines.length === 1 ? '' : 's'}`);
}

const glowCache = new Map<string, HTMLCanvasElement>();
export function glowSprite(color: string, r: number): HTMLCanvasElement {
  const key = `${color}|${Math.round(r)}`;
  let cv = glowCache.get(key);
  if (cv) return cv;
  const size = Math.ceil(r * 3.2); cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d')!; const grd = g.createRadialGradient(size / 2, size / 2, r * 0.8, size / 2, size / 2, size / 2);
  grd.addColorStop(0, hexA(color, 0.55)); grd.addColorStop(1, hexA(color, 0));
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  glowCache.set(key, cv); return cv;
}

// The bubble body — a radial-shaded disc with a white rim and a top-left highlight — is identical for every
// bubble of the same colour and (rounded) radius, so bake it once into an offscreen sprite keyed `color|round(r)`
// like glowSprite (#28), rather than rebuilding the gradient and re-stroking the disc every frame. Only the
// label and the outcome ✓/✗ badge, which vary per bubble/frame, stay in drawBubble.
const bodyCache = new Map<string, HTMLCanvasElement>();
export function bodySprite(color: string, r: number): HTMLCanvasElement {
  const key = `${color}|${Math.round(r)}`;
  let cv = bodyCache.get(key);
  if (cv) return cv;
  const size = Math.ceil(r * 2 + 6);   // room for the 2px rim and its anti-aliasing
  cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d')!; c.translate(size / 2, size / 2);
  const grd = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  grd.addColorStop(0, lighten(color, 0.55)); grd.addColorStop(0.55, color); grd.addColorStop(1, darken(color, 0.35));
  c.fillStyle = grd; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-r * 0.35, -r * 0.45, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2); c.fill();
  bodyCache.set(key, cv); return cv;
}

// Shared colour helpers (#29/#28): every sprite gradient and every halo underlay goes through these instead
// of building an rgba() string or a lighten/darken by hand at each call site. `particles.ts` imports `hexA`
// for its own halo constants, which is why they live on this side rather than the other — a dependency the
// other way would cycle the two files.
export function hexToRgb(h: string) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function hexA(h: string, a: number) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
export function lighten(h: string, k: number) { const [r, g, b] = hexToRgb(h); return `rgb(${r + (255 - r) * k | 0},${g + (255 - g) * k | 0},${b + (255 - b) * k | 0})`; }
export function darken(h: string, k: number) { const [r, g, b] = hexToRgb(h); return `rgb(${r * (1 - k) | 0},${g * (1 - k) | 0},${b * (1 - k) | 0})`; }
