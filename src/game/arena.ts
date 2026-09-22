// Canvas arena: bubbles fly up from the bottom; the player taps or slices them.
import { shuffle } from '../curriculum/util';   // uniform Fisher–Yates; `Math.random` is a valid Rng () => number (#42)
import type { Rng } from '../curriculum/types';
import { gameSpeed } from './speed';   // #32: test-only multiplier — divides flight time and stagger, never the clock
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
}
type PKind = 'dot' | 'ring' | 'shard' | 'text' | 'ember' | 'drop' | 'bolt' | 'rock' | 'leaf' | 'crystal' | 'star' | 'smoke' | 'pixel' | 'slash';
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: PKind; text?: string; rot?: number }
export type FxKind = 'fire' | 'water' | 'electric' | 'earth' | 'wind' | 'ice' | 'light' | 'shadow' | 'blade' | 'robot' | 'master';
const ELEMENTS: FxKind[] = ['fire', 'water', 'electric', 'earth', 'wind', 'ice', 'light', 'shadow', 'blade', 'robot'];   // `master` draws from all of these
const FX_PARTICLE: Record<FxKind, PKind> = { fire: 'ember', water: 'drop', electric: 'bolt', earth: 'rock', wind: 'leaf', ice: 'crystal', light: 'star', shadow: 'smoke', blade: 'slash', robot: 'pixel', master: 'star' };
export const FX_COLORS: Record<FxKind, string[]> ={ fire: ['#ff7a1a', '#ffd23a', '#ff3b1a'], water: ['#3ec9ff', '#9fe6ff', '#1a7fff'], electric: ['#2ea8ff', '#ffffff', '#9fe6ff'], earth: ['#a0622a', '#7ddc3a', '#6b4220'], wind: ['#7fe8c8', '#c8ffe9', '#5fcf5a'], ice: ['#9fe6ff', '#ffffff', '#5bb8e8'], light: ['#ffd23a', '#ffffff', '#ffb020'], shadow: ['#a855ff', '#5a2aa0', '#2a1050'], blade: ['#ffffff', '#ff3b5c', '#d8dce8'], robot: ['#ff5252', '#ffffff', '#9aa5cf'], master: ['#ffd87a', '#ffffff', '#ffb020'] };
const MAX_PARTICLES = 250;   // #29: safety cap so a pathological burst can never grow the per-frame draw loop unbounded
// A tap throws the ninja's own projectile (#48): it flies from the bottom of the arena to the bubble and pops
// it on arrival. Score, lives and the outcome reveal are all settled at the tap — only the pop waits for the
// landing, so the flight is decoration and never changes what the child earned.
export interface Shot { target: Bubble; x0: number; y0: number; x: number; y: number; t: number; fx: FxKind; emit: number }
export const SHOT_FLIGHT = 0.15;   // seconds in the air
type ShotStyle = 'shuriken' | 'fireball' | 'orb' | 'bolt' | 'rock' | 'leaf' | 'shard' | 'star' | 'laser';
export const SHOT_STYLE: Record<FxKind, ShotStyle> = { blade: 'shuriken', shadow: 'shuriken', master: 'shuriken', fire: 'fireball', water: 'orb', electric: 'bolt', earth: 'rock', wind: 'leaf', ice: 'shard', light: 'star', robot: 'laser' };
/** Where a shot is `t` seconds after the throw: a straight line to the target's current spot, a touch faster as it goes. */
export function shotPose(x0: number, y0: number, tx: number, ty: number, t: number) {
  const k = Math.min(1, Math.max(0, t / SHOT_FLIGHT)); const e = k * (0.7 + 0.3 * k);
  return { x: x0 + (tx - x0) * e, y: y0 + (ty - y0) * e, angle: Math.atan2(ty - y0, tx - x0), done: k >= 1 };
}
export interface ArenaCallbacks {
  onHit: (b: Bubble, viaSwipe: boolean) => void;   // player touched/sliced a bubble
  onFall: (b: Bubble) => void;                       // an un-hit bubble fell off screen
  onWaveEnd: () => void;                             // no live bubbles remain
}
export interface ArenaOpts {
  trailColor?: string; trailCore?: string; fx?: FxKind;
  onSwish?: () => void;
  onThrow?: () => void;                        // a projectile has just left the ninja's hand
  onLand?: () => void;                         // it has reached the bubble and popped it
  throwFor?: (b: Bubble) => boolean;           // false = pop this bubble instantly instead of throwing at it
}
export interface WaveOpts { labels: string[]; speed: number; wide?: boolean; gravity?: number; ordered?: string[] /* sequence labels that must be sliced in this order */ }
const GOOD = '#66e07d', BAD = '#ff5f6d';
// #29 glow-underlay colours: compile-time constants, hoisted out of the per-frame draw so drawParticle/drawBubble
// never rebuild an rgba() string (arena's #28 rule — no per-frame colour strings). hexA/hexToRgb are hoisted fns.
const BOLT_HALO = hexA('#2ea8ff', 0.4), STAR_HALO = hexA('#ffd23a', 0.4);
const GOOD_HALO = hexA(GOOD, 0.35), BAD_HALO = hexA(BAD, 0.35);

const PALETTE = ['#ff5f6d', '#ffa726', '#ffd54f', '#66e07d', '#40c4ff', '#b388ff', '#ff7ac6', '#4dd0e1'];

export class Arena {
  private ctx: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1; topInset = 120;
  bubbles: Bubble[] = [];
  private particles: Particle[] = [];
  shots: Shot[] = []; shotsThrown = 0;                          // projectiles in flight / thrown so far (the e2e reads the count)
  private trail: { x: number; y: number; t: number }[] = [];
  private downPos = { x: 0, y: 0 }; private lastPt = { x: 0, y: 0 }; private moved = 0;
  private activeId: number | null = null;         // the pointer that is down on THIS canvas, null = no stroke (#16: two arenas share one window)
  private strokeStale = false;                    // #331: a freeze happened since `lastPt` — the next move resumes the stroke, it does not continue it
  private raf = 0; private last = 0; private nextId = 1; private waveActive = false; private g = 600; private orderedWave = false;
  private waveT = 4400; private batchSpan = 0;                  // this wave's flight time and one batch's stagger span (rush)
  paused = false; frozen = false; trailColor = '#7fe0ff'; trailCore?: string; fx: FxKind = 'blade'; private onSwish?: () => void; private trailEmit = 0;   // trailCore = shop skin's bright core (#6)
  private onThrow?: () => void; private onLand?: () => void;
  /** Which bubbles a tap throws a projectile at; anything else pops instantly, like a swipe (the TNT does — #48). */
  private throwFor?: (b: Bubble) => boolean;
  time = 0;

  constructor(public canvas: HTMLCanvasElement, private cb: ArenaCallbacks, opts: ArenaOpts = {}) {
    this.ctx = canvas.getContext('2d')!;
    if (opts.trailColor) this.trailColor = opts.trailColor;
    if (opts.trailCore) this.trailCore = opts.trailCore;
    if (opts.fx) this.fx = opts.fx;
    this.onSwish = opts.onSwish; this.onThrow = opts.onThrow; this.onLand = opts.onLand;
    this.throwFor = opts.throwFor;
    this.resize();
    window.addEventListener('resize', this.resize);
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
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
  }
  resize = () => {
    const rect = this.canvas.getBoundingClientRect();
    const from: ArenaBox = { W: this.W, H: this.H };
    this.W = Math.max(1, rect.width); this.H = Math.max(1, rect.height);
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
    this.topInset = Math.min(this.topInset * sy, to.H * 0.5);
    this.strokeStale = true;   // #331's rule, at the other boundary that invalidates coordinates: `lastPt` is
                                // in the OLD box and nothing above rescales it, so the next move must re-seat
                                // the anchor rather than draw from a point that no longer means anything (#463)
  }

  /** Bubble radius scales with viewport; words get wider bubbles. */
  radius(wide: boolean) { return bubbleRadius(this.W, this.H, wide); }

  /**
   * `shared` is how two arenas put up **the same wave** — the Ninja Duel's two halves (#389). Both of
   * `layoutWave`'s impure inputs have to come from the caller for that, not just the draw: the two calls run
   * in one loop but `performance.now()` still moves between them, and `now` is the origin every `launchAt` is
   * measured from. Each caller passes its *own* generator off one seed rather than one shared generator —
   * an `Rng` is stateful, so a single instance handed to both calls would deal the second arena the first's
   * leftovers, which is the bug with extra steps.
   *
   * Left out, every wave outside the duel keeps `Math.random` and the live clock: a seeded arena in ordinary
   * play would put the same wave up twice (#389's "deliberately does not do").
   */
  spawnWave(o: WaveOpts, shared?: { rng: Rng; now: number }) {
    this.bubbles = []; this.shots = []; this.frozen = false;
    this.orderedWave = !!o.ordered?.length;         // #108: damp collisions so a sequence bubble is never stranded
    // #43: every number below — radius, air time, batching, each bubble's arc, colour and launch moment —
    // comes from the pure layoutWave() so it can be unit-tested without a canvas. All this method still does
    // is fit each label to the measured font (#28, needs the 2D context) and push the bubbles.
    const plan = layoutWave(o, { W: this.W, H: this.H, topInset: this.topInset }, gameSpeed(), shared?.now ?? performance.now(), shared?.rng ?? Math.random);
    this.waveT = plan.waveT; this.batchSpan = plan.batchSpan;
    for (const p of plan.bubbles) {
      const fit = fitLabelLines(p.label, plan.r, (font, text) => { this.ctx.font = font; return this.ctx.measureText(text).width; });   // #28: fit once here, not every frame
      warnUnfitLabel(p.label, plan.r, fit);
      this.bubbles.push({ id: this.nextId++, label: p.label, x: p.x, y: this.H + plan.r, vx: p.vx, vy: p.vy, g: p.g, r: plan.r, launchAt: p.launchAt, launched: false, hit: false, dead: false, color: p.color, wobble: p.wobble, fontSize: fit.fs, lines: fit.lines, labelState: fit.state });
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
    this.frozen = true; const now = performance.now(); let shown = false;
    for (const b of this.bubbles) {
      if (b.dead) continue;
      if (!b.launched) { b.dead = true; continue; }                       // still queued: never launch
      if (o.good !== undefined && b.label === o.good && !shown) { b.mark = 'good'; b.markAt = now; shown = true; }
      else if (o.bad !== undefined && b.label === o.bad && b.hit && !b.mark) { b.mark = 'bad'; b.markAt = now; }
      else b.fade = true;
    }
    if (o.good !== undefined && !shown) {
      const r = this.radius(o.good.length > 3);
      let x = this.W / 2; const y = this.topInset + (this.H - this.topInset) * 0.42;
      const bad = this.bubbles.find(b => b.mark === 'bad' && !b.dead);
      if (bad && Math.hypot(bad.x - x, bad.y - y) < 2.2 * r) x = bad.x < this.W / 2 ? Math.min(this.W - r - 8, bad.x + 2.4 * r) : Math.max(r + 8, bad.x - 2.4 * r);   // don't sit on the ✗ bubble
      const fit = fitLabelLines(o.good, r, (font, text) => { this.ctx.font = font; return this.ctx.measureText(text).width; });
      warnUnfitLabel(o.good, r, fit);
      this.bubbles.push({ id: this.nextId++, label: o.good, x, y, vx: 0, vy: 0, g: this.g, r, launchAt: now, launched: true, hit: true, dead: false, color: GOOD, wobble: 0, mark: 'good', markAt: now, fontSize: fit.fs, lines: fit.lines, labelState: fit.state });
    }
  }
  /** Remove remaining bubbles (with a gentle fade) — used when the question is over. */
  clearWave(popColor?: string) {
    for (const b of this.bubbles) if (!b.dead) { b.dead = true; if (popColor && b.launched && !b.fade) this.burst(b.x, b.y, b.mark === 'good' ? GOOD : popColor, b.mark ? 14 : 6); }
    this.shots = [];                                // the question is over: a projectile still in the air is dropped (#48)
    this.frozen = false;
    if (this.waveActive) { this.waveActive = false; this.cb.onWaveEnd(); }
  }
  /** Programmatic hit (tests / accessibility). */
  hitLabel(label: string) {
    if (this.frozen) return false;
    const b = this.bubbles.find(x => x.label === label && x.launched && !x.hit && !x.dead);
    if (b) this.hitBubble(b, false);
    return !!b;
  }
  floatText(x: number, y: number, text: string, color: string) {
    this.particles.push({ x, y, vx: 0, vy: -60, life: 0, max: 1.1, color, size: 26, kind: 'text', text });
  }
  burst(x: number, y: number, color: string, n = 18) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 120 + Math.random() * 260;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0, max: 0.5 + Math.random() * 0.5, color, size: 3 + Math.random() * 5, kind: Math.random() < 0.3 ? 'shard' : 'dot', rot: Math.random() * 6 });
    }
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.45, color, size: 10, kind: 'ring' });
    if (n >= 12) this.emitFx(x, y, 8, 0, 0);
  }
  /** Element-flavoured particles (trail wake or hit burst). */
  emitFx(x: number, y: number, n: number, dx: number, dy: number) {
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
  private onDown = (e: PointerEvent) => {
    this.activeId = e.pointerId; this.moved = 0; this.downPos = this.pos(e); this.lastPt = this.downPos;
    this.trail = [{ ...this.downPos, t: performance.now() }];
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (this.paused || this.frozen) { this.strokeStale = true; return; }   // #464: a press during the outcome hold is a
    // real intent, not nothing — record it as this canvas's stroke so `onMove` can pick it up, but stale, so the first
    // move after the freeze arms it (same #331 contract) rather than cashing in the bubble under the finger right now,
    // which belongs to the wave that is about to clear.
    this.strokeStale = false;                       // #331: a stroke that starts here spans no freeze — never skip its first segment
    const b = this.bubbleAt(this.downPos.x, this.downPos.y);
    if (b) this.hitBubble(b, false);
  };
  private onMove = (e: PointerEvent) => {
    if (this.activeId === null || this.paused || this.frozen) { if (this.activeId === e.pointerId) this.strokeStale = true; return; }
    if (e.pointerId !== this.activeId) return;      // a second finger's drift is not this stroke (#16: the move half of the rule below)
    const p = this.pos(e);
    // #331: a freeze is not a pause mid-stroke, it is a gap in the game. A finger that never lifts kept
    // `lastPt` from before the outcome hold, and a wave ending is reveal() → clearWave() → the next
    // spawnWave(), so the first move afterwards closed a segment drawn a whole wave ago — a line straight
    // across the new wave, the right answer among it. Re-seating `lastPt` during the freeze is not enough
    // (the finger may have drifted, and a perfectly still one sends no move at all): the first move after a
    // freeze RESUMES the stroke, seating a fresh start point and slicing nothing. The stroke itself lives on.
    if (this.strokeStale) { this.strokeStale = false; this.lastPt = p; this.trail = [{ ...p, t: performance.now() }]; return; }
    // Hit-test against the last pointer position, not the visual trail: the trail fades after 280ms,
    // so a finger that pauses mid-stroke (or slow pointer events) must not lose its slice segment.
    const prev = this.lastPt;
    const d = Math.hypot(p.x - prev.x, p.y - prev.y); this.moved += d; if (d < 2) return;
    this.lastPt = p;
    this.trail.push({ ...p, t: performance.now() });
    if (this.trail.length > 24) this.trail.shift();
    if (this.moved > 40 && this.trail.length % 6 === 0) this.onSwish?.();
    if (++this.trailEmit % 2 === 0) this.emitFx(p.x, p.y, 1, p.x - prev.x, p.y - prev.y);
    for (const b of this.bubbles) { if (this.frozen) break; if (b.launched && !b.hit && !b.dead && segCircle(prev.x, prev.y, p.x, p.y, b.x, b.y, b.r)) this.hitBubble(b, true); }
  };
  // `pointerup`/`pointercancel` arrive on the window, so every arena on the page hears every finger lift. Only
  // the pointer that went down on this canvas may end its stroke, and only it may extend it: in Ninja Duel
  // (#16) two arenas share the window, and Player 2's tap used to cut Player 1's swipe mid-stroke; a second
  // finger resting on the same canvas re-seats the trail (the newest finger owns the stroke), so the first
  // finger's next move must not be hit-tested from that point (PR #295 review). One finger, one id, in play.
  // One stroke per canvas is a policy with a known edge: a newer finger takes over, so when IT lifts the older
  // finger's continuing swipe is orphaned until it touches again — a stroke per pointer would serve both
  // orderings, and is a follow-up under #16.
  private onUp = (e: PointerEvent) => {
    if (this.activeId !== null && e.pointerId !== this.activeId) return;
    this.activeId = null;
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
    // #331: the home of the rule. A freeze lasting at least one frame stales the stroke whichever field caused
    // it and whoever set it — `paused` is assigned from the play screen and has no entry point of its own — so
    // a finger held perfectly still through the outcome hold, sending no pointermove at all, is caught here.
    if (this.paused || this.frozen) this.strokeStale = true;
    if (!this.paused) { this.time += dt; for (let left = dt; left > 0; left -= 1 / 60) this.update(Math.min(left, 1 / 60), now); }
    this.cull(now);
    this.render(now);
    this.raf = requestAnimationFrame(this.loop);
  };
  private update(dt: number, now: number) {
    let live = 0;
    for (const b of this.bubbles) {
      if (b.dead) continue;
      if (this.frozen) { live++; b.wobble += dt * 3; continue; }        // outcome reveal: everything holds still
      if (!b.launched) { if (now >= b.launchAt) b.launched = true; else { live++; continue; } }
      b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.wobble += dt * 3;
      if (b.y - b.r > this.H + 10 && b.vy > 0) { b.dead = true; if (!b.hit) this.cb.onFall(b); continue; }   // a tapped bubble with a shot on the way is not a miss
      live++;
    }
    // #108: bubbles collide with each other. Skipped while `frozen` — the outcome reveal holds everything
    // still, and the e2e freeze helper predicts a bubble's position from its fixed `g`, which only stays true
    // while nothing else can move it. `ordered` sequence waves bounce softly so a required label cannot be
    // knocked out of reach before its batch is up.
    if (!this.frozen) resolveCollisions(this.bubbles, { W: this.W, H: this.H, topInset: this.topInset }, this.orderedWave ? COLLIDE.damped : COLLIDE.bounce);
    if (this.waveActive && live === 0) { this.waveActive = false; this.cb.onWaveEnd(); }
    for (const s of this.shots) {                   // shots fly on even while the wave is frozen for the reveal
      if (s.t >= SHOT_FLIGHT) continue;             // already landed this frame; cull() takes it out below (#31)
      const p = shotPose(s.x0, s.y0, s.target.x, s.target.y, s.t += dt);
      if (++s.emit % 2 === 0) this.emitFx(s.x, s.y, 1, (p.x - s.x) * 0.2, (p.y - s.y) * 0.2);   // element wake
      s.x = p.x; s.y = p.y;
      if (p.done) this.landShot(s);
    }
    for (const p of this.particles) { p.life += dt; const g = p.kind === 'ring' || p.kind === 'text' || p.kind === 'bolt' || p.kind === 'slash' ? 0 : p.kind === 'ember' || p.kind === 'smoke' ? -120 : p.kind === 'leaf' || p.kind === 'star' ? 80 : p.kind === 'drop' ? 700 : 500; p.vy += g * dt; if (p.kind === 'leaf') p.vx += Math.sin(p.life * 9) * 40 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
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
    const empty = !this.bubbles.length && !this.particles.length && !this.shots.length && !this.trail.length;
    if (!this.dirty && (this.paused || (empty && !this.painted))) return;
    const c = this.ctx; c.clearRect(0, 0, this.W, this.H);
    this.painted = !empty; this.dirty = false;
    if (empty) return;
    for (const b of this.bubbles) { if (b.dead || !b.launched || b.mark) continue; this.drawBubble(c, b, now); }
    for (const b of this.bubbles) { if (!b.dead && b.launched && b.mark) this.drawBubble(c, b, now); }   // spotlighted on top
    for (const p of this.particles) this.drawParticle(c, p);
    for (const s of this.shots) this.drawShot(c, s);
    this.drawTrail(c, now);
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
  private drawBubble(c: CanvasRenderingContext2D, b: Bubble, now: number) {
    const wob = Math.sin(b.wobble) * 0.04;
    c.save(); c.translate(b.x, b.y);
    let scale = 1;
    if (b.fade) { c.globalAlpha = 0.28; scale *= 0.9; }
    if (b.mark) {                                    // outcome spotlight: pop in, gentle pulse, a shake for a wrong slice
      const age = Math.max(0, now - (b.markAt ?? now)) / 1000;
      scale *= Math.min(1, age / 0.16) * (1.18 + 0.05 * Math.sin(age * 9));
      if (b.mark === 'bad') c.translate(Math.sin(age * 45) * 6 * Math.max(0, 0.45 - age) / 0.45, 0);
    }
    c.rotate(b.mark ? 0 : wob); c.scale(scale, scale);
    if (b.mark) {
      const col = b.mark === 'good' ? GOOD : BAD;
      // #29: a soft translucent underlay ring instead of shadowBlur (per-pixel blur is too slow on low-end phones).
      c.beginPath(); c.arc(0, 0, b.r + 7, 0, Math.PI * 2);
      c.strokeStyle = b.mark === 'good' ? GOOD_HALO : BAD_HALO; c.lineWidth = 18; c.stroke();   // the halo
      c.strokeStyle = col; c.lineWidth = 6; c.stroke();                // the crisp ring
    }
    // glow + body: both cached offscreen sprites keyed `color|round(r)`. A per-frame radial gradient (two colour
    // strings + a gradient object per bubble) and a shadowBlur are too slow on low-end devices (#28/#29).
    const g = glowSprite(b.color, b.r); c.drawImage(g, -g.width / 2, -g.height / 2);
    const body = bodySprite(b.color, b.r); c.drawImage(body, -body.width / 2, -body.height / 2);
    // label — font size and line break fitted once at spawn (#28/#348), never in this per-frame path
    const lines = b.lines; const fs = b.fontSize;
    c.font = labelFont(fs);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const lh = fs * 1.02, top = 2 - (lines.length - 1) * lh / 2;   // the block of lines stays centred on the disc
    c.lineJoin = 'round'; c.lineWidth = Math.max(3, fs * 0.16); c.strokeStyle = 'rgba(20,20,40,.75)';
    for (let i = 0; i < lines.length; i++) c.strokeText(lines[i], 0, top + i * lh);
    c.fillStyle = '#fff';
    for (let i = 0; i < lines.length; i++) c.fillText(lines[i], 0, top + i * lh);
    if (b.mark) {                                    // ✓ / ✗ badge
      const col = b.mark === 'good' ? GOOD : BAD, br = b.r * 0.36, bx = b.r * 0.74, by = -b.r * 0.74;
      c.fillStyle = col; c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.stroke();
      // No Fredoka here on purpose: it has no ✓ or ✗ glyph, so this text has always come from the fallback
      // stack, where 900 is a real designed weight. Naming Fredoka only invited someone to "fix" the 900.
      c.font = `900 ${br * 1.5}px "Baloo 2", system-ui, sans-serif`; c.lineWidth = 0; c.fillStyle = '#fff'; c.fillText(b.mark === 'good' ? '✓' : '✗', bx, by + 1);
    }
    c.restore();
  }
  // The 8-point star silhouette, built at the current transform. Defined once (not a per-frame closure) so the
  // star particle can fill it twice — a scaled halo copy then the crisp copy — without allocating each frame (#29).
  private starPath(c: CanvasRenderingContext2D, size: number) {
    c.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? size * 0.35 : size; const a = i * Math.PI / 4; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath();
  }
  private drawParticle(c: CanvasRenderingContext2D, p: Particle) {
    const k = 1 - p.life / p.max;
    c.save(); c.globalAlpha = Math.max(0, k);
    if (p.kind === 'ring') { c.strokeStyle = p.color; c.lineWidth = 4 * k + 1; c.beginPath(); c.arc(p.x, p.y, p.size + (1 - k) * 90, 0, Math.PI * 2); c.stroke(); }
    else if (p.kind === 'text') { c.font = `700 ${p.size}px "Fredoka", "Baloo 2", system-ui, sans-serif`; c.textAlign = 'center'; c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(p.text!, p.x, p.y); c.fillStyle = p.color; c.fillText(p.text!, p.x, p.y); }
    else if (p.kind === 'shard') { c.translate(p.x, p.y); c.rotate((p.rot ?? 0) + p.life * 6); c.fillStyle = p.color; c.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); }
    else if (p.kind === 'ember') { const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.4, p.color); g.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.size * (0.6 + 0.6 * k), 0, Math.PI * 2); c.fill(); }
    else if (p.kind === 'drop') { c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2); c.fillStyle = p.color; c.beginPath(); c.moveTo(0, -p.size * 1.6); c.quadraticCurveTo(p.size, 0, 0, p.size); c.quadraticCurveTo(-p.size, 0, 0, -p.size * 1.6); c.fill(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(-p.size * 0.3, -p.size * 0.2, p.size * 0.25, 0, Math.PI * 2); c.fill(); }
    else if (p.kind === 'bolt') { c.translate(p.x, p.y); c.rotate(p.rot ?? 0); c.lineJoin = 'miter'; c.beginPath(); c.moveTo(-p.size, 0); c.lineTo(-p.size * 0.3, -p.size * 0.5); c.lineTo(p.size * 0.1, p.size * 0.3); c.lineTo(p.size, -p.size * 0.4); c.strokeStyle = BOLT_HALO; c.lineWidth = 7; c.stroke(); c.strokeStyle = p.color; c.lineWidth = 2.5; c.stroke(); }   // #29: halo underlay, not shadowBlur
    else if (p.kind === 'rock') { c.translate(p.x, p.y); c.rotate((p.rot ?? 0) + p.life * 4); c.fillStyle = p.color; c.beginPath(); c.moveTo(-p.size, -p.size * 0.4); c.lineTo(-p.size * 0.3, -p.size); c.lineTo(p.size * 0.8, -p.size * 0.6); c.lineTo(p.size, p.size * 0.4); c.lineTo(p.size * 0.1, p.size); c.lineTo(-p.size * 0.9, p.size * 0.5); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.stroke(); }
    else if (p.kind === 'leaf') { c.translate(p.x, p.y); c.rotate((p.rot ?? 0) + Math.sin(p.life * 6)); c.fillStyle = p.color; c.beginPath(); c.moveTo(0, -p.size); c.quadraticCurveTo(p.size, 0, 0, p.size); c.quadraticCurveTo(-p.size, 0, 0, -p.size); c.fill(); c.strokeStyle = 'rgba(0,80,40,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -p.size * 0.8); c.lineTo(0, p.size * 0.8); c.stroke(); }
    else if (p.kind === 'crystal') { c.translate(p.x, p.y); c.rotate((p.rot ?? 0) + p.life * 3); c.fillStyle = p.color; c.beginPath(); c.moveTo(0, -p.size * 1.4); c.lineTo(p.size * 0.6, 0); c.lineTo(0, p.size * 1.4); c.lineTo(-p.size * 0.6, 0); c.closePath(); c.fill(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1; c.stroke(); }
    else if (p.kind === 'star') { c.translate(p.x, p.y); c.rotate((p.rot ?? 0) + p.life * 2); c.fillStyle = STAR_HALO; c.save(); c.scale(1.35, 1.35); this.starPath(c, p.size); c.fill(); c.restore(); c.fillStyle = p.color; this.starPath(c, p.size); c.fill(); }   // #29: halo = a scaled fill of the star, NOT a stroke — stroking this concave path is slower than the old shadowBlur (measured)
    else if (p.kind === 'smoke') { c.globalAlpha = Math.max(0, k) * 0.55; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size * (0.5 + (1 - k)), 0, Math.PI * 2); c.fill(); }
    else if (p.kind === 'pixel') { c.fillStyle = p.color; c.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }
    else if (p.kind === 'slash') { c.translate(p.x, p.y); c.rotate(p.rot ?? 0); c.strokeStyle = p.color; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(-p.size, 0); c.lineTo(p.size, 0); c.stroke(); }
    else { c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size * k, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  private drawTrail(c: CanvasRenderingContext2D, now: number) {
    if (this.trail.length < 2) return;
    const fx = this.fx; const cols = FX_COLORS[fx];
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    const wide = fx === 'fire' || fx === 'shadow' || fx === 'water' ? 22 : fx === 'blade' ? 8 : 14;
    const core = fx === 'blade' ? 2 : fx === 'electric' ? 3 : 5;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1], b = this.trail[i];
        const age = Math.max(0, 1 - (now - b.t) / 280);
        const w = (pass === 0 ? wide : core) * age * (i / this.trail.length);
        c.strokeStyle = pass === 0 ? hexA(this.trailColor, (fx === 'shadow' ? 0.5 : 0.35) * age) : this.trailCore ? hexA(this.trailCore, 0.9 * age) : (fx === 'fire' ? `rgba(255,230,150,${0.9 * age})` : fx === 'shadow' ? hexA(cols[1], 0.9 * age) : `rgba(255,255,255,${0.9 * age})`);
        c.lineWidth = Math.max(0.5, w);
        c.beginPath();
        if (fx === 'electric' && pass === 1) { // jagged lightning core
          c.moveTo(a.x, a.y); const mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * 14, my = (a.y + b.y) / 2 + (Math.random() - 0.5) * 14; c.lineTo(mx, my); c.lineTo(b.x, b.y);
        } else { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
        c.stroke();
      }
    }
    if (fx === 'blade') { // red edge highlight on the katana slash
      const last = this.trail[this.trail.length - 1], prev = this.trail[Math.max(0, this.trail.length - 4)];
      c.strokeStyle = 'rgba(255,59,92,.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(prev.x, prev.y + 3); c.lineTo(last.x, last.y + 3); c.stroke();
    }
    c.restore();
  }
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

/** Drop the entries `keep` rejects, in place and in order, allocating nothing — `arr = arr.filter(keep)`
 *  without the new array (#31). The order matters: the trail is drawn as a polyline from oldest to newest,
 *  and the particle cap drops the oldest from the front. Returns the array so a call reads as an expression. */
export function compact<T>(arr: T[], keep: (v: T) => boolean): T[] {
  let w = 0;
  for (let r = 0; r < arr.length; r++) if (keep(arr[r])) arr[w++] = arr[r];
  arr.length = w;
  return arr;
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
export function reanchorBubble(b: { x: number; y: number; vx: number; vy: number; g: number; r: number }, from: ArenaBox, to: ArenaBox) {
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
  // frame two bubbles were airborne, and at the `__SNA_FAST = 4` the e2e suite runs at, a phone wave cleared
  // in 23 frames instead of 50 with an apex of 688 in a 760-high arena — bubbles that barely left the launch
  // line. #138 made `speedK` a pure time compression ("same apex, same landing x, less time") and a fixed
  // px/s number silently undid it. A constant cannot be right when the quantity it bounds is a function of
  // `H` and `speedK`; the bound belongs on the impulse, relative to the pair it acts on. See `capToPair`.
  /** Separation passes per frame. Six, not one: a three-body pile needs more than a single sweep to come
   *  apart, and the wall clamp inside the loop can push a bubble back into a neighbour that a later pass
   *  then has to undo. At <= 6 live bubbles this is ~90 distance checks a frame. */
  iters: 6,
} as const;

/** The part of a bubble collision cares about — so a test can build one without a label or a font size. */
export interface Collidable { x: number; y: number; vx: number; vy: number; g: number; r: number; launched: boolean; dead: boolean }

/**
 * A bubble is in flight when something is still moving it. A bubble with no gravity and no velocity has been
 * *pinned* — which is what `freezeWave` in the e2e spec does to make a wave's coordinates predictable before
 * it clicks one, and #108 requires that those tests stay deterministic. Nothing in play is ever pinned: every
 * launched bubble carries its own `g`, fixed at launch and never zero, so this excludes the test's frozen
 * wave and nothing else. (The outcome reveal is handled separately, by `frozen` in `update`.)
 */
const inFlight = (b: Collidable) => b.g !== 0 || b.vx !== 0 || b.vy !== 0;

/**
 * Separate every overlapping pair and bounce them apart, in place. Equal masses, so the impulse is the
 * symmetric one; an approaching pair only.
 *
 * Bubbles that have not launched yet are still parked below the floor and are left alone — colliding them
 * there would shove the queue sideways before the child ever sees it. So are pinned ones; see `inFlight`.
 */
export function resolveCollisions(
  bubbles: readonly Collidable[],                 // elements are mutated; the array never is
  geom: WaveGeom,
  restitution: typeof COLLIDE.bounce | typeof COLLIDE.damped = COLLIDE.bounce,   // only these two are meaningful
) {
  const live = bubbles.filter(b => b.launched && !b.dead && inFlight(b));
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
    for (const b of live) clampIntoArena(b, geom);
  }
}

/** Keep a bubble inside the play area and below the HUD (#108). Position only — see `COLLIDE` on why no
 *  absolute speed cap lives here. */
function clampIntoArena(b: Collidable, geom: WaveGeom) {
  b.x = Math.min(geom.W - b.r, Math.max(b.r, b.x));
  const ceiling = geom.topInset + b.r;
  if (b.y < ceiling) { b.y = ceiling; if (b.vy < 0) b.vy = 0; }   // never above topInset, never still climbing there
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
  const T = (o.speed === 1 ? 5.6 : o.speed === 2 ? 4.4 : 3.4) / speedK;        // seconds in the air
  const apexMin = topInset + r + 10;
  const usable = H - apexMin - r;
  const stagger = (o.speed === 1 ? 420 : o.speed === 2 ? 330 : 260) / speedK;
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

/** The smallest a bubble label is ever drawn: the shrink loop clamps to this and never steps below it. */
export const LABEL_MIN_FS = 10;
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
/** How much of `r` one line may spend across the middle of the bubble. */
const LINE_BUDGET = 1.75;
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

// Called once per bubble in spawnWave (#28) — `measure` sets the font and returns the text width — instead
// of running the shrink loop in drawBubble every frame. Pure and canvas-free so it unit-tests directly.
export function fitLabel(label: string, r: number, measure: (font: string, text: string) => number): number {
  let fs = startFs(label, r);
  // `fs` starts fractional, so a bare `fs -= 1` used to step *past* the bound and return 9.56 from a
  // constant documented as the smallest size ever drawn. Clamp, so the floor is one (#348 review note 1).
  while (measure(labelFont(fs), label) > r * LINE_BUDGET && fs > LABEL_MIN_FS) fs = Math.max(LABEL_MIN_FS, fs - 1);
  return fs;
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
  if (!split) return one;
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
function glowSprite(color: string, r: number): HTMLCanvasElement {
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
function bodySprite(color: string, r: number): HTMLCanvasElement {
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
// True when the slice segment (x1,y1)→(x2,y2) passes within `r` of the bubble centre (cx,cy) — the swipe
// hit test. Exported so the geometry is unit-tested directly rather than only through the slow e2e (#43).
function starPath(c: CanvasRenderingContext2D, points: number, ro: number, ri: number) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) { const r = i % 2 ? ri : ro, a = i * Math.PI / points; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.closePath();
}
export function segCircle(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number) {
  const dx = x2 - x1, dy = y2 - y1; const l2 = dx * dx + dy * dy;
  let t = l2 ? ((cx - x1) * dx + (cy - y1) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx, py = y1 + t * dy;
  return Math.hypot(px - cx, py - cy) <= r;
}
function hexToRgb(h: string) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function hexA(h: string, a: number) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
function lighten(h: string, k: number) { const [r, g, b] = hexToRgb(h); return `rgb(${r + (255 - r) * k | 0},${g + (255 - g) * k | 0},${b + (255 - b) * k | 0})`; }
function darken(h: string, k: number) { const [r, g, b] = hexToRgb(h); return `rgb(${r * (1 - k) | 0},${g * (1 - k) | 0},${b * (1 - k) | 0})`; }
