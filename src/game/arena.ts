// Canvas arena: bubbles fly up from the bottom; the player taps or slices them. #559 split the data model,
// the pure wave/collision/label-fit maths and the effects tables out into bubbles.ts, slicing.ts and
// particles.ts (below); this file re-exports all of it, so nothing outside `src/game/` need change its
// import path, the same shape #558 used for `src/style.css`'s own split. `Arena` stays the one public seam:
// every event handler, the physics update and the render loop live here, unmoved.
import { gentleRelaunchSet } from './gentleRelaunch';   // #742: which bubbles a gentle relaunch brings back together
import { watchBox } from './box-watch'; import { gameSpeed } from './speed';   // #32: test-only multiplier — divides flight time and stagger, never the clock
import type { Rng } from '../curriculum/types'; import { boxMoved, holdUnderCard, insetMax, nextInset } from './wave-bounds';   // #2184
import {
  hittable, GOOD, RELAUNCH_DELAY, MAX_RELAUNCHES, COLLIDE,
  layoutWave, reanchorBubble, bubbleRadius, resolveCollisions,
  fitLabelLines, warnUnfitLabel,
} from './bubbles';
import type { Bubble, WaveOpts, ArenaBox, ClampCounts } from './bubbles';
import {
  FX_PARTICLE, FX_COLORS, MAX_PARTICLES, SHOT_FLIGHT, SHOT_STYLE, shotPose, starPath, compact, ELEMENTS, burstParticles, prefersReducedMotion, stepParticle,
} from './particles';
import type { Particle, Shot, FxKind } from './particles';
import { drawBubble, drawParticle, drawTrail } from './arena-draw';
import { advanceStroke, slicedBy } from './slicing';
import { relaunchBubble, markOutcome, ghostX } from './arena-step';
import type { Stroke } from './slicing';

export * from './bubbles';
export * from './slicing';
export * from './particles';

export interface ArenaCallbacks {
  onHit: (b: Bubble, viaSwipe: boolean) => void;   // player touched/sliced a bubble
  onFall: (b: Bubble) => void;                       // an un-hit bubble fell off screen
  onWaveEnd: () => void;                             // no live bubbles remain
}
export interface ArenaOpts {
  trailColor?: string; trailCore?: string; fx?: FxKind; reducedMotion?: boolean;   // #900: the option if given, else read from matchMedia once, at construction
  onSwish?: () => void;
  onThrow?: () => void;                        // a projectile has just left the ninja's hand
  onLand?: () => void;                         // it has reached the bubble and popped it
  throwFor?: (b: Bubble) => boolean; isHazard?: (label: string) => boolean;   // throwFor false=pop instantly; #742: a hazard never enters a gentle relaunch set
  /** One square cell of `img`, from `(sx, 0)`, to draw in place of a bubble's label, or null for the label (#684).
   *  The object may be reused by the next call — draw it at once, never keep it. */
  labelArt?: (label: string, color: string, phase: number) => { readonly img: CanvasImageSource; readonly sx: number; readonly size: number } | null;
  measureInset?: () => number;                 // #2184: the question card's live bottom (`topInset`), read on a resize instead of scaling the old one
}

export class Arena {
  private ctx: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1; private inset = 120;
  get topInset() { return Math.min(this.inset, insetMax(this.W, this.H)); } set topInset(v: number) { if (Number.isFinite(v)) this.inset = v; holdUnderCard(this.bubbles, this.topInset, this.H); }   // #2184: the card line, at most half the box — no apex rises past topInset + r, even one already up
  bubbles: Bubble[] = [];
  private particles: Particle[] = [];
  shots: Shot[] = []; shotsThrown = 0;                          // projectiles in flight / thrown so far (the e2e reads the count)
  // #152: lifetime count of `clampIntoArena`'s three clamps, applied during collision resolution only — a sim
  // test asserts .ceiling stays zero across a normal wave; the wall clamps see real traffic. `reanchor()`'s
  // own x-position bound on resize (below) is a separate, uncounted clamp of the same shape — not this field
  // (silent-failure-hunter review): folding it in would need `resize`/`reanchor` to carry `clampCounts`
  // through, which is a real extension, not a one-line fix, and out of this pull request's scope.
  clampCounts: ClampCounts = { left: 0, right: 0, ceiling: 0 };
  private trail: { x: number; y: number; t: number }[] = [];
  private strokes: Map<number, Stroke> = new Map();   // #561: one Stroke per pointer (#16: two arenas share one window)
  private mostRecentId: number | null = null;          // which stroke the shared visual trail/swish/fx follows — every stroke still hit-tests
  private raf = 0; private unwatch: () => void; private last = 0; private nextId = 1; private waveActive = false; private g = 600; private orderedWave = false;
  private orderedLabels: Set<string> = new Set();   // #591: this wave's required sequence labels — a re-launch candidate on fall, unlike a decoy
  // #700: this wave's gentle-year single-relaunch target; #742 extends it — who it comes back WITH (gentleRelaunch.ts).
  private gentleTarget: string | undefined; private gentleUsed = false; private gentleTargetFallen: Bubble | null = null; private gentleDecoys: Bubble[] = [];
  private waveT = 4400; private batchSpan = 0;                  // this wave's flight time and one batch's stagger span (rush)
  private _paused = false; frozen = false; trailColor = '#7fe0ff'; trailCore?: string; fx: FxKind = 'blade'; private onSwish?: () => void; private trailEmit = 0;   // trailCore = shop skin's bright core (#6)
  private pausedSince: number | null = null;       // #883: when the CURRENT pause began — stamped by the `paused` setter below, not the loop
  private onThrow?: () => void; private onLand?: () => void;
  /** #883: the pause edge is read HERE, not in the render loop, so a pause set and lifted with no frame in
   *  between still shifts every un-launched bubble's `launchAt` by the pause length (same clock the loop's
   *  own `now` uses). A same-value write is a no-op. */
  get paused() { return this._paused; }
  set paused(v: boolean) {
    if (v === this._paused) return;
    this._paused = v;
    if (v) { this.pausedSince = performance.now(); return; }
    if (this.pausedSince === null) return;
    const shift = Math.max(0, performance.now() - this.pausedSince);
    for (const b of this.bubbles) if (!b.launched && !b.dead) b.launchAt += shift;
    this.pausedSince = null;
  }
  /** Which bubbles a tap throws a projectile at; anything else pops instantly, like a swipe (the TNT does — #48). */
  private throwFor?: (b: Bubble) => boolean;
  private labelArt?: ArenaOpts['labelArt']; private isHazard?: ArenaOpts['isHazard']; private measureInset?: ArenaOpts['measureInset'];
  private reducedMotion = false;   // #900: resolved once in the constructor, never re-read per frame
  time = 0;

  constructor(public canvas: HTMLCanvasElement, private cb: ArenaCallbacks, opts: ArenaOpts = {}) {
    this.ctx = canvas.getContext('2d')!;
    if (opts.trailColor) this.trailColor = opts.trailColor;
    if (opts.trailCore) this.trailCore = opts.trailCore;
    if (opts.fx) this.fx = opts.fx;
    this.onSwish = opts.onSwish; this.onThrow = opts.onThrow; this.onLand = opts.onLand;
    this.throwFor = opts.throwFor; this.labelArt = opts.labelArt; this.isHazard = opts.isHazard; this.measureInset = opts.measureInset;
    this.reducedMotion = opts.reducedMotion ?? prefersReducedMotion(window);
    this.resize();
    this.unwatch = watchBox(canvas, this.resize);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.unwatch();
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
  }
  resize = () => {
    const rect = this.canvas.getBoundingClientRect();
    const from: ArenaBox = { W: this.W, H: this.H };
    this.W = Math.max(1, Math.round(rect.width)); this.H = Math.max(1, Math.round(rect.height));   // whole CSS px: the duel halves settle a sub-pixel apart and must derive the same `g` (#389/#400, #678)
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.W * this.dpr); this.canvas.height = Math.round(this.H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // #146: a wave is laid out once, at spawn, for the arena it was spawned in. Rotating the phone used to
    // leave every bubble at coordinates from the old box — below the shorter canvas, so the arena painted
    // nothing while the wave played on invisibly, and `update`'s fall test below fired at once for every
    // bubble already on its way down, costing a life per bubble in Year 1 and Year 2. Re-anchor instead.
    if (from.W > 0 && from.H > 0) this.reanchor(from, { W: this.W, H: this.H });
    this.dirty = true;                              // setting canvas.width wipes the bitmap — repaint once (#31)
  };
  /** Move everything the arena is holding into the resized box (#146). Pure maths lives in `reanchorBubble`. */
  private reanchor(from: ArenaBox, to: ArenaBox) {
    const sx = to.W / from.W, sy = to.H / from.H;
    if (sx === 1 && sy === 1) return;
    for (const b of this.bubbles) reanchorBubble(b, from, to);
    for (const p of this.particles) { p.x *= sx; p.y *= sy; p.vx *= sx; p.vy *= sy; }
    for (const s of this.shots) { s.x *= sx; s.y *= sy; s.x0 *= sx; s.y0 *= sy; }
    for (const t of this.trail) { t.x *= sx; t.y *= sy; }
    // The question card moves too, and its measured bottom is what bounds the next wave's apex
    // (`play-session.ts` re-measures on the next question; this keeps the one in between in the box).
    this.topInset = nextInset(this.measureInset?.(), this.inset, sy, to.W, to.H);   // #2184: read live where it can be — the card does not scale with the box
    for (const s of this.strokes.values()) s.stale = true;   // #331/#463: every stroke's `lastPt` is in the OLD,
    // unrescaled box, so each one's next move must re-seat its anchor rather than draw from a stale point
  }

  scale = 1; radius(wide: boolean) { return Math.min(bubbleRadius(this.W, this.H, wide) * this.scale, ((this.W - 16) / 3 - 10) / 2); }   // viewport-scaled, times the wave's year scale (#2288) so a ghost bubble matches; words get wider bubbles

  /**
   * `shared` is how two arenas put up **the same wave** — the Ninja Duel's two halves (#389). Two of
   * `layoutWave`'s impure inputs have to come from the caller for that, not just the draw: the two calls run
   * in one loop but `performance.now()` still moves between them, and `now` is the origin every `launchAt` is
   * measured from. Each caller passes its *own* generator off one seed rather than one shared generator —
   * an `Rng` is stateful, so a single instance handed to both calls would deal the second arena the first's
   * leftovers, which is the bug with extra steps. `gameSpeed()` is a *third* impure input, read fresh below
   * for each call — safe only because both calls sit in the caller's one synchronous loop (#400).
   * Left out, every wave outside the duel keeps `Math.random` and the live clock: a seeded arena in ordinary
   * play would put the same wave up twice (#389's "deliberately does not do").
   */
  spawnWave(o: WaveOpts, shared?: { rng: Rng; now: number }) {
    this.bubbles = []; this.shots = []; this.frozen = false;
    const inset = this.inset; if (boxMoved(this.canvas.getBoundingClientRect(), this.W, this.H)) this.resize(); this.topInset = inset;   // #2184: lay out for the box as it is now, not as the observer last reported it (wave-bounds.ts); the caller's card line is fresh, so not scaled
    this.orderedWave = !!o.ordered?.length;         // #108: damp collisions so a sequence bubble is never stranded
    this.orderedLabels = new Set(o.ordered);        // #591: same set, for the fall re-launch below
    this.gentleTarget = o.gentleTarget; this.gentleUsed = false; this.gentleTargetFallen = null; this.gentleDecoys = [];   // #700/#742: a fresh trip for this wave
    // #43: every number below — radius, air time, batching, each bubble's arc, colour and launch moment —
    // comes from the pure layoutWave() so it can be unit-tested without a canvas. All this method still does
    // is fit each label to the measured font (#28, needs the 2D context) and push the bubbles.
    this.scale = o.scale ?? 1; const plan = layoutWave(o, { W: this.W, H: this.H, topInset: this.topInset }, gameSpeed(), shared?.now ?? performance.now(), shared?.rng ?? Math.random);
    this.waveT = plan.waveT; this.batchSpan = plan.batchSpan;
    for (const p of plan.bubbles) {
      const fit = fitLabelLines(p.label, plan.r, (font, text) => { this.ctx.font = font; return this.ctx.measureText(text).width; });   // #28: fit once here, not every frame
      warnUnfitLabel(p.label, plan.r, fit);
      this.bubbles.push({ id: this.nextId++, label: p.label, x: p.x, y: this.H + plan.r, vx: p.vx, vy: p.vy, g: p.g, r: plan.r, launchAt: p.launchAt, launched: false, hit: false, dead: false, color: p.color, wobble: p.wobble, fontSize: fit.fs, lines: fit.lines, labelState: fit.state, ox: p.x, ovx: p.vx, ovy: p.vy, relaunches: 0 });
    }
    this.waveActive = true;
  }
  /** Bring the batch holding `label` up now — used when the child has earned the next word of a sequence.
   *  Never launches it under bubbles that are still rising (that is how waves used to pile up), and moves
   *  only that one batch: the batches behind it are rushed in their own turn. */
  rush(label?: string) {
    const b = label ? this.bubbles.find(x => x.label === label && !x.launched && !x.dead) : undefined;
    if (!b) return false;
    const now = performance.now(), cutoff = b.launchAt;
    let earliest = now;
    for (const x of this.bubbles) if (x.launched && !x.dead && !x.hit) earliest = Math.max(earliest, x.launchAt + this.waveT / 2);   // wait for what is in the air to pass its apex
    const shift = Math.max(0, cutoff - Math.max(now, earliest));
    if (!shift) return false;
    const end = cutoff + this.batchSpan;
    for (const x of this.bubbles) if (!x.launched && !x.dead && x.launchAt >= cutoff && x.launchAt < end) x.launchAt -= shift;      // keep the batch's own stagger
    return true;
  }
  /** Freeze the wave and show the outcome: the sliced bubble stays put with a ✓ (or ✗ beside the glowing right answer),
   *  the rest fade. If the right answer is no longer on screen (it fell, or is still queued) it pops in as a ghost bubble. */
  reveal(o: { good?: string; bad?: string }) {
    this.frozen = true; const now = performance.now();
    const shown = markOutcome(this.bubbles, o, now);
    if (o.good !== undefined && !shown) {
      const r = this.radius(o.good.length > 3);
      const y = this.topInset + (this.H - this.topInset) * 0.42;
      const x = ghostX(this.W, r, this.bubbles.find(b => b.mark === 'bad' && !b.dead), y);   // don't sit on the ✗ bubble
      const fit = fitLabelLines(o.good, r, (font, text) => { this.ctx.font = font; return this.ctx.measureText(text).width; });
      warnUnfitLabel(o.good, r, fit);
      this.bubbles.push({ id: this.nextId++, label: o.good, x, y, vx: 0, vy: 0, g: this.g, r, launchAt: now, launched: true, hit: true, dead: false, color: GOOD, wobble: 0, mark: 'good', markAt: now, fontSize: fit.fs, lines: fit.lines, labelState: fit.state, ox: x, ovx: 0, ovy: 0, relaunches: 0 });
    }
  }
  /** Remove remaining bubbles (with a gentle fade) — used when the question is over. */
  clearWave(popColor?: string) {
    for (const b of this.bubbles) if (!b.dead) { b.dead = true; if (popColor && b.launched && !b.fade) this.burst(b.x, b.y, b.mark === 'good' ? GOOD : popColor, b.mark ? 14 : 6); }
    this.shots = [];                                // the question is over: a projectile still in the air is dropped (#48)
    this.frozen = false;
    if (this.gentleTargetFallen) { this.cb.onFall(this.gentleTargetFallen); this.gentleTargetFallen = null; this.gentleDecoys = []; }   // #742: the round ended another way — report it now, don't drop it
    if (this.waveActive) { this.waveActive = false; this.cb.onWaveEnd(); }
  }
  hitLabel(label: string) {   // programmatic hit (tests / accessibility)
    if (this.frozen) return false;
    const b = this.bubbles.find(x => x.label === label && hittable(x));
    if (b) this.hitBubble(b, false);
    return !!b;
  }
  floatText(x: number, y: number, text: string, color: string) {
    this.particles.push({ x, y, vx: 0, vy: -60, life: 0, max: 1.1, color, size: 26, kind: 'text', text });
  }
  burst(x: number, y: number, color: string, n = 18) {
    // #900: half the dots/shards (rounded up) and no sparks under reduced motion; the ring always shows.
    this.particles.push(...burstParticles(x, y, color, this.reducedMotion ? Math.ceil(n / 2) : n));
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.45, color, size: 10, kind: 'ring' });
    if (n >= 12 && !this.reducedMotion) this.emitFx(x, y, 8, 0, 0);
  }
  emitFx(x: number, y: number, n: number, dx: number, dy: number) {   // element-flavoured particles (trail wake or hit burst)
    for (let i = 0; i < n; i++) {
      const fx = this.fx === 'master' ? ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)] : this.fx;   // the Master mixes every element
      const kind = FX_PARTICLE[fx]; const cols = FX_COLORS[fx];
      const c = cols[Math.floor(Math.random() * cols.length)];
      const a = Math.random() * Math.PI * 2, sp = n > 1 ? 80 + Math.random() * 220 : 20 + Math.random() * 60;
      let vx = Math.cos(a) * sp - dx * 2, vy = Math.sin(a) * sp - dy * 2, max = 0.5 + Math.random() * 0.4, size = 3 + Math.random() * 4;
      if (kind === 'ember') { vy -= 120; size = 4 + Math.random() * 6; }
      if (kind === 'smoke') { vy -= 30; size = 10 + Math.random() * 14; max = 0.8 + Math.random() * 0.4; }
      if (kind === 'leaf' || kind === 'star') { size = 6 + Math.random() * 6; max = 0.9; }
      if (kind === 'crystal' || kind === 'rock') { size = 5 + Math.random() * 7; }
      if (kind === 'bolt') { size = 8 + Math.random() * 10; max = 0.18 + Math.random() * 0.12; }
      if (kind === 'slash') { size = 12 + Math.random() * 16; max = 0.22; vx *= 0.3; vy *= 0.3; }
      if (kind === 'pixel') { size = 3 + Math.random() * 3; }
      this.particles.push({ x, y, vx, vy, life: 0, max, color: c, size, kind, rot: Math.random() * 6.3 });
    }
  }

  // ---------- input ----------
  private pos(e: PointerEvent) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  // #464: one predicate for "the game is not accepting real input right now", read at every site that must
  // agree on it (`onDown`, `onMove`, the loop's per-frame poll below) — #464 was exactly `onDown` alone not
  // yet enforcing the rule the other two already did, so a fourth site copying the condition by hand is
  // precisely the failure mode to close off, not repeat.
  private stalls() { return this.paused || this.frozen; }
  private onDown = (e: PointerEvent) => {
    const p = this.pos(e), stale = this.stalls();
    this.strokes.set(e.pointerId, { lastPt: p, moved: 0, stale });
    this.mostRecentId = e.pointerId;                 // #561: the newest finger is the one the visual trail follows
    this.trail = [{ ...p, t: performance.now() }];
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (stale) return;   // #464: a press during the freeze is real intent — record it, but stale, so the first move after it arms (#331)
    const b = this.bubbleAt(p.x, p.y);
    if (b) this.hitBubble(b, false);
  };
  private onMove = (e: PointerEvent) => {
    const s = this.strokes.get(e.pointerId);         // #561: this pointer's own entry, or none if foreign/already lifted
    if (!s) return;
    if (this.stalls()) { s.stale = true; return; }
    const p = this.pos(e);
    // #331: a freeze is not a pause mid-stroke, it is a gap in the game. A finger that never lifts kept
    // `lastPt` from before the outcome hold, and a wave ending is reveal() → clearWave() → the next
    // spawnWave(), so the first move afterwards closed a segment drawn a whole wave ago — a line straight
    // across the new wave, the right answer among it. Re-seating `lastPt` during the freeze is not enough
    // (the finger may have drifted, and a perfectly still one sends no move at all): the first move after a
    // freeze RESUMES the stroke, seating a fresh start point and slicing nothing. The stroke itself lives on.
    if (s.stale) { s.stale = false; s.lastPt = p; if (e.pointerId === this.mostRecentId) this.trail = [{ ...p, t: performance.now() }]; return; }
    // Hit-test against the last pointer position, not the visual trail: the trail fades after 280ms,
    // so a finger that pauses mid-stroke (or slow pointer events) must not lose its slice segment.
    const prev = s.lastPt;
    if (!advanceStroke(s, p)) return;
    if (e.pointerId === this.mostRecentId) this.extendTrail(s, p, prev);   // #561: only the most recent stroke draws
    for (const b of slicedBy(this.bubbles, prev, p)) { if (this.frozen) break; this.hitBubble(b, true); }
  };
  /** The shared trail, its swish and its wake follow the newest finger only (#561). */
  private extendTrail(s: Stroke, p: { x: number; y: number }, prev: { x: number; y: number }) {
    this.trail.push({ ...p, t: performance.now() });
    if (this.trail.length > 24) this.trail.shift();
    if (s.moved > 40 && this.trail.length % 6 === 0) this.onSwish?.();
    if (!this.reducedMotion && ++this.trailEmit % 2 === 0) this.emitFx(p.x, p.y, 1, p.x - prev.x, p.y - prev.y);   // #900: no wake sparks
  }
  // `pointerup`/`pointercancel` are WINDOW listeners, so every arena hears every lift; only the pointer that
  // went down on this canvas has an entry to remove (#16, PR #295's foreign-lift rule). #561's own Stroke per
  // pointer closes PR #295's named follow-up: no single stroke is left for a second finger to take and strand.
  private onUp = (e: PointerEvent) => {
    this.strokes.delete(e.pointerId);
    if (this.mostRecentId !== e.pointerId) return;
    const remaining = [...this.strokes.keys()];      // hand the trail to another still-down finger, else null for the next onDown
    this.mostRecentId = remaining.length ? remaining[remaining.length - 1] : null;
    const s = this.mostRecentId !== null && this.strokes.get(this.mostRecentId);
    if (s) this.trail = [{ ...s.lastPt, t: performance.now() }];   // else it ages out (#446): no pointer to hand off to
  };
  private bubbleAt(x: number, y: number) {
    let best: Bubble | null = null, bd = Infinity;
    for (const b of this.bubbles) { if (!b.launched || b.hit || b.dead) continue; const d = Math.hypot(b.x - x, b.y - y); if (d < b.r * 1.15 && d < bd) { best = b; bd = d; } }
    return best;
  }
  private hitBubble(b: Bubble, viaSwipe: boolean) {
    b.hit = true;
    // A tap throws the ninja's projectile and the bubble pops when it lands; a swipe (and anything throwFor
    // excludes, such as the TNT) pops here and now, exactly as before (#48).
    const thrown = !viaSwipe && (this.throwFor ? this.throwFor(b) : true);
    if (thrown) this.throwAt(b); else this.burst(b.x, b.y, b.color);
    this.cb.onHit(b, viaSwipe);
    if (!thrown && !b.mark) b.dead = true;          // reveal() may keep it on screen as the spotlighted outcome
  }
  /** Throw the avatar's projectile from the bottom of the arena (the ninja's side), leaning towards the bubble. */
  private throwAt(b: Bubble) {
    const x0 = this.W / 2 + (b.x - this.W / 2) * 0.3, y0 = this.H + 12;
    this.shots.push({ target: b, x0, y0, x: x0, y: y0, t: 0, fx: this.fx, emit: 0 });
    this.shotsThrown++; this.onThrow?.();
  }
  private landShot(s: Shot) {
    const t = s.target;
    // The target may have been resolved while the star flew — cleared with the question, or fallen off screen.
    // It burst then, so this landing is silent: the sound belongs to a pop the child can actually see.
    const pops = !t.dead || !!t.mark;
    if (pops) this.burst(t.x, t.y, t.color);
    if (!t.mark) t.dead = true;
    if (pops) this.onLand?.();
  }

  // ---------- loop ----------
  private loop = (now: number) => {
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.5) dt = 0.016;                       // tab was hidden: don't jump
    dt = Math.min(dt, 0.1);
    // #331: the home of the rule. A freeze lasting at least one frame stales every live stroke (#561: one per
    // pointer), whichever field caused it — caught here, once a frame, since a stroke can go stale with no
    // pointer event at all: a finger held perfectly still sends no pointermove.
    if (this.stalls()) for (const s of this.strokes.values()) s.stale = true;
    if (!this.paused) { this.time += dt; for (let left = dt; left > 0; left -= 1 / 60) this.update(Math.min(left, 1 / 60), now); }
    this.cull(now);
    this.render(now);
    this.raf = requestAnimationFrame(this.loop);
  };
  private update(dt: number, now: number) {
    const live = this.moveBubbles(dt, now);   // bubbles still live or waiting to launch
    if (!this.frozen) resolveCollisions(this.bubbles, { W: this.W, H: this.H, topInset: this.topInset }, this.orderedWave ? COLLIDE.damped : COLLIDE.bounce, this.clampCounts);   // #108: skipped while `frozen`; `ordered` waves bounce softly
    if (this.waveActive && live === 0) this.endWave(now);
    for (const s of this.shots) {                   // shots fly on even while the wave is frozen for the reveal
      if (s.t >= SHOT_FLIGHT) continue;             // already landed this frame; cull() takes it out below (#31)
      const p = shotPose(s.x0, s.y0, s.target.x, s.target.y, s.t += dt);
      if (!this.reducedMotion && ++s.emit % 2 === 0) this.emitFx(s.x, s.y, 1, (p.x - s.x) * 0.2, (p.y - s.y) * 0.2);   // element wake, none under #900
      s.x = p.x; s.y = p.y; if (p.done) this.landShot(s);
    }
    for (const p of this.particles) stepParticle(p, dt);
  }
  private moveBubbles(dt: number, now: number): number {
    let live = 0;
    for (const b of this.bubbles) {
      if (b.dead) continue;
      if (this.frozen) { live++; b.wobble += dt * 3; continue; }        // outcome reveal: everything holds still
      if (!b.launched) { if (now >= b.launchAt) b.launched = true; else { live++; continue; } }
      b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.wobble += dt * 3;
      if (b.y - b.r > this.H + 10 && b.vy > 0) { if (this.fell(b, now)) live++; } else live++;
    }
    return live;
  }
  // true when the bubble is back in play (#591)
  private fell(b: Bubble, now: number): boolean {
    // #591: a required sequence bubble that leaves un-hit is re-launched (up to MAX_RELAUNCHES), not punished; a decoy or a `hit` one is a miss.
    const seqRelaunch = this.orderedLabels.has(b.label) && b.relaunches < MAX_RELAUNCHES;
    if (!b.hit && seqRelaunch) { b.relaunches++; relaunchBubble(b, this.H, now + RELAUNCH_DELAY); return true; }
    b.dead = true; if (b.hit) return false;
    if (!seqRelaunch && this.gentleTarget === b.label && !this.gentleUsed) { this.gentleTargetFallen = b; return false; }   // #742: deferred to wave-end, not a miss yet
    this.cb.onFall(b);
    if (this.gentleTarget !== undefined && !this.gentleUsed && b.label !== this.gentleTarget && !this.isHazard?.(b.label)) this.gentleDecoys.push(b);
    return false;
  }
  // #742: unless the answer fell un-hit this wave, the free trip is a set (gentleRelaunch.ts)
  private endWave(now: number) {
    if (!this.gentleTargetFallen) { this.waveActive = false; this.cb.onWaveEnd(); return; }
    for (const b of gentleRelaunchSet(this.gentleTargetFallen, this.gentleDecoys, Math.random)) { b.dead = false; relaunchBubble(b, this.H, now + RELAUNCH_DELAY); }
    this.gentleUsed = true; this.gentleTargetFallen = null; this.gentleDecoys.length = 0;
  }
  /** Drop what is finished — once a frame, not once a substep (#31). `update()` runs up to six times per
   *  frame, and each `filter()` there built a fresh array, so a busy frame threw away 18 of them for the
   *  garbage collector to find. `compact` rewrites in place instead, and nothing between the substeps and
   *  the draw can see the difference: the trail's cutoff is derived from `now`, which does not move within a
   *  frame; a dead particle drawn one substep later would be at alpha 0 anyway, and it is gone before
   *  `render` runs; and a landed shot is skipped by the `s.t >= SHOT_FLIGHT` guard in `update`, so deferring
   *  its removal cannot land it twice. Runs even while paused, so the trail still ages out. */
  private cull(now: number) {
    compact(this.shots, s => s.t < SHOT_FLIGHT);
    compact(this.particles, p => p.life < p.max);
    if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES);   // #29: hard cap, drop the oldest
    const cutoff = now - 280; compact(this.trail, t => t.t > cutoff);
  }
  /** Whether the canvas currently holds anything — set by `render`, so the clear that empties it still happens
   *  exactly once after the final bubble goes (#31). Without it, skipping the draw would leave the last frame
   *  painted for ever. */
  private painted = false;
  /** The bitmap no longer matches the model and must be repainted once, whatever the pause state. Only
   *  `resize` sets it: assigning `canvas.width` wipes the bitmap, and a resize can arrive while paused. */
  private dirty = true;
  private render(now: number) {
    // Nothing to draw, or nothing that can change: keep the rAF loop alive (the e2e frame-rate rail counts
    // frames, and the loop is what tears down cleanly) but leave the canvas alone. While paused the arena is
    // frozen under an overlay, so the pixels already there are the correct picture (#31).
    const empty = this.isEmpty();
    if (!this.dirty && (this.paused || (empty && !this.painted))) return;
    const c = this.ctx; c.clearRect(0, 0, this.W, this.H);
    this.painted = !empty; this.dirty = false;
    if (!empty) this.drawScene(c, now);
  }
  private isEmpty() { return !this.bubbles.length && !this.particles.length && !this.shots.length && !this.trail.length; }
  private drawScene(c: CanvasRenderingContext2D, now: number) {
    for (const b of this.bubbles) { if (!b.dead && b.launched && !b.mark) this.drawBubble(c, b, now); }
    for (const b of this.bubbles) { if (!b.dead && b.launched && b.mark) this.drawBubble(c, b, now); }   // spotlighted on top
    for (const p of this.particles) drawParticle(c, p);
    for (const s of this.shots) this.drawShot(c, s);
    drawTrail(c, this.trail, { fx: this.fx, color: this.trailColor, core: this.trailCore }, now);
  }
  private drawBubble(c: CanvasRenderingContext2D, b: Bubble, now: number) {
    // #684: a 3-D Shapes bubble draws its solid instead of the glyph, once the screen has baked one; the phase is
    // offset by id so a wave does not turn in lock-step. Anything else, or a solid not baked yet, keeps its label.
    drawBubble(c, b, now, this.labelArt ? this.labelArt(b.label, b.color, now / 1000 + b.id * 0.37) : null);
  }
  /** The projectile in flight, in the avatar's element (#48): a spinning shuriken for Kai / Dusk / the Master,
   *  a fireball, a water orb, a bolt… No shadowBlur here — the #29 rail forbids it in a per-frame path. */
  private drawShot(c: CanvasRenderingContext2D, s: Shot) {
    const style = SHOT_STYLE[s.fx], cols = FX_COLORS[s.fx], r = 16;
    const angle = shotPose(s.x0, s.y0, s.target.x, s.target.y, s.t).angle, spin = s.t * 40;
    c.save(); c.translate(s.x, s.y);
    if (style === 'shuriken') {
      c.rotate(spin);
      c.fillStyle = s.fx === 'blade' ? '#d8dce8' : s.fx === 'shadow' ? '#3a1a60' : '#ffd23a';
      starPath(c, 4, r * 1.3, r * 0.4); c.fill();
      c.strokeStyle = s.fx === 'shadow' ? cols[0] : 'rgba(255,255,255,.85)'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = s.fx === 'blade' ? '#5a6070' : s.fx === 'shadow' ? cols[0] : '#fff6c4';
      c.beginPath(); c.arc(0, 0, r * 0.28, 0, Math.PI * 2); c.fill();
    } else if (style === 'fireball') {
      c.fillStyle = cols[0]; c.beginPath(); c.arc(0, 0, r * 0.85, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff6c0'; c.beginPath(); c.arc(0, 0, r * 0.45, 0, Math.PI * 2); c.fill();
    } else if (style === 'orb') {
      c.fillStyle = cols[0]; c.beginPath(); c.arc(0, 0, r * 0.8, 0, Math.PI * 2); c.fill();
      c.strokeStyle = cols[1]; c.lineWidth = 2; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(-r * 0.3, -r * 0.3, r * 0.25, 0, Math.PI * 2); c.fill();
    } else if (style === 'bolt') {
      c.rotate(angle); c.strokeStyle = cols[1]; c.lineWidth = 3; c.lineJoin = 'miter';
      c.beginPath(); c.moveTo(-r * 1.4, 0); c.lineTo(-r * 0.4, -r * 0.6); c.lineTo(r * 0.2, r * 0.5); c.lineTo(r * 1.4, -r * 0.2); c.stroke();
      c.strokeStyle = cols[0]; c.lineWidth = 1.2; c.stroke();
    } else if (style === 'rock') {
      c.rotate(spin * 0.4); c.fillStyle = cols[0];
      c.beginPath(); c.moveTo(-r, -r * 0.4); c.lineTo(-r * 0.3, -r); c.lineTo(r * 0.8, -r * 0.6); c.lineTo(r, r * 0.4); c.lineTo(r * 0.1, r); c.lineTo(-r * 0.9, r * 0.5); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.stroke();
    } else if (style === 'leaf') {
      c.rotate(angle + Math.PI / 2); c.fillStyle = cols[0];
      c.beginPath(); c.moveTo(0, -r * 1.4); c.quadraticCurveTo(r, 0, 0, r * 1.4); c.quadraticCurveTo(-r, 0, 0, -r * 1.4); c.fill();
      c.strokeStyle = 'rgba(0,80,40,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -r * 1.1); c.lineTo(0, r * 1.1); c.stroke();
    } else if (style === 'shard') {
      c.rotate(angle + Math.PI / 2); c.fillStyle = cols[0];
      c.beginPath(); c.moveTo(0, -r * 1.5); c.lineTo(r * 0.55, 0); c.lineTo(0, r * 1.5); c.lineTo(-r * 0.55, 0); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.2; c.stroke();
    } else if (style === 'star') {
      c.rotate(spin); c.fillStyle = cols[0]; starPath(c, 8, r * 1.2, r * 0.5); c.fill();
      c.fillStyle = cols[1]; c.beginPath(); c.arc(0, 0, r * 0.3, 0, Math.PI * 2); c.fill();
    } else {                                        // laser: a short capsule along the flight line
      c.rotate(angle); c.strokeStyle = cols[0]; c.lineCap = 'round'; c.lineWidth = 7;
      c.beginPath(); c.moveTo(-r * 1.2, 0); c.lineTo(r * 1.2, 0); c.stroke();
      c.strokeStyle = cols[1]; c.lineWidth = 2.5; c.stroke();
    }
    c.restore();
  }
}
