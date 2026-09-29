// Particles, projectiles and the visual trail (#559, split out of arena.ts): the effects tables and the pure
// shapes/maths a burst, a swish or a thrown star draws from. `Arena` still owns the particle array itself and
// the drawing methods — those read too much per-frame state (the trail, the fx skin, the canvas) to move.
import { hexA } from './bubbles';

type PKind = 'dot' | 'ring' | 'shard' | 'text' | 'ember' | 'drop' | 'bolt' | 'rock' | 'leaf' | 'crystal' | 'star' | 'smoke' | 'pixel' | 'slash';
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: PKind; text?: string; rot?: number }
// The one list every element-typed table derives from (#214): add an element here and `FxKind` gains it
// everywhere, so `FX_PARTICLE`/`FX_COLORS`/`SHOT_STYLE` below and `sliceFx` in `audio.ts` all fail to compile
// until they cover it too — a missing entry is a build error, not a silent runtime fallback.
export const ELEMENTS = ['fire', 'water', 'electric', 'earth', 'wind', 'ice', 'light', 'shadow', 'blade', 'robot'] as const;
export type Element = typeof ELEMENTS[number];
export type FxKind = Element | 'master';   // `master` draws from all of ELEMENTS
// #559 review: these three tables are shared, mutable-by-default `Record`s reached from anywhere that imports
// this module — `Readonly` catches `FX_PARTICLE.fire = 'star'` at compile time rather than letting it corrupt
// the one shared lookup for every `Arena` instance, the same guarantee `COLLIDE` (bubbles.ts) already carries.
export const FX_PARTICLE: Readonly<Record<FxKind, PKind>> = { fire: 'ember', water: 'drop', electric: 'bolt', earth: 'rock', wind: 'leaf', ice: 'crystal', light: 'star', shadow: 'smoke', blade: 'slash', robot: 'pixel', master: 'star' };
export const FX_COLORS: Readonly<Record<FxKind, string[]>> ={ fire: ['#ff7a1a', '#ffd23a', '#ff3b1a'], water: ['#3ec9ff', '#9fe6ff', '#1a7fff'], electric: ['#2ea8ff', '#ffffff', '#9fe6ff'], earth: ['#a0622a', '#7ddc3a', '#6b4220'], wind: ['#7fe8c8', '#c8ffe9', '#5fcf5a'], ice: ['#9fe6ff', '#ffffff', '#5bb8e8'], light: ['#ffd23a', '#ffffff', '#ffb020'], shadow: ['#a855ff', '#5a2aa0', '#2a1050'], blade: ['#ffffff', '#ff3b5c', '#d8dce8'], robot: ['#ff5252', '#ffffff', '#9aa5cf'], master: ['#ffd87a', '#ffffff', '#ffb020'] };
export const MAX_PARTICLES = 250;   // #29: safety cap so a pathological burst can never grow the per-frame draw loop unbounded

// A tap throws the ninja's own projectile (#48): it flies from the bottom of the arena to the bubble and pops
// it on arrival. Score, lives and the outcome reveal are all settled at the tap — only the pop waits for the
// landing, so the flight is decoration and never changes what the child earned.
/** What a shot actually touches on its target (#559 review): `shotPose`/`landShot` read `x`/`y`/`color`/
 *  `dead`/`mark`, never a label or a font size, so `target` is this narrow shape rather than the full
 *  `Bubble` — the same "only what this cares about" cut `Collidable` (bubbles.ts) already makes for
 *  collision. A real `Bubble` satisfies it structurally; `arena.ts`'s `throwAt` passes one in unchanged. */
export interface ShotTarget { x: number; y: number; color: string; dead: boolean; mark?: 'good' | 'bad' }
export interface Shot { target: ShotTarget; x0: number; y0: number; x: number; y: number; t: number; fx: FxKind; emit: number }
export const SHOT_FLIGHT = 0.15;   // seconds in the air
type ShotStyle = 'shuriken' | 'fireball' | 'orb' | 'bolt' | 'rock' | 'leaf' | 'shard' | 'star' | 'laser';
export const SHOT_STYLE: Readonly<Record<FxKind, ShotStyle>> = { blade: 'shuriken', shadow: 'shuriken', master: 'shuriken', fire: 'fireball', water: 'orb', electric: 'bolt', earth: 'rock', wind: 'leaf', ice: 'shard', light: 'star', robot: 'laser' };
/** Where a shot is `t` seconds after the throw: a straight line to the target's current spot, a touch faster as it goes. */
export function shotPose(x0: number, y0: number, tx: number, ty: number, t: number) {
  const k = Math.min(1, Math.max(0, t / SHOT_FLIGHT)); const e = k * (0.7 + 0.3 * k);
  return { x: x0 + (tx - x0) * e, y: y0 + (ty - y0) * e, angle: Math.atan2(ty - y0, tx - x0), done: k >= 1 };
}

// #29 glow-underlay colours: compile-time constants, hoisted out of the per-frame draw so drawParticle/drawBubble
// never rebuild an rgba() string (arena's #28 rule — no per-frame colour strings).
export const BOLT_HALO = hexA('#2ea8ff', 0.4), STAR_HALO = hexA('#ffd23a', 0.4);

/** The 8-point star silhouette a thrown star or a star particle's halo is filled with, at the current
 *  transform — a shuriken uses a tighter 4-point version of the same shape. Defined once (not a per-frame
 *  closure) so a star can be filled twice (a scaled halo copy, then the crisp copy) without allocating each
 *  frame (#29). Named `starPath` twice in this game on purpose: `Arena`'s own private copy draws the fixed
 *  8-point particle star from `drawParticle`, and never takes a point count — the two never collide because
 *  the class always spells its own as `this.starPath`. */
export function starPath(c: CanvasRenderingContext2D, points: number, ro: number, ri: number) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) { const r = i % 2 ? ri : ro, a = i * Math.PI / points; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.closePath();
}

/** Read `prefers-reduced-motion` once, when an `Arena` is built, never per frame (#900) — guarded for a test
 *  stub or an environment with no `matchMedia` at all, in which case motion is left full rather than thrown. */
export function prefersReducedMotion(w: { matchMedia?: (q: string) => { matches: boolean } }): boolean {
  return w.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** The dot/shard particles a slice burst throws (#900: `n` is already halved by the caller under reduced
 *  motion). The ring and whether element sparks fire at all stay `Arena.burst()`'s own call — the ring always
 *  shows, and sparks are a second, separate decision this pool has no say in. */
export function burstParticles(x: number, y: number, color: string, n: number): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 120 + Math.random() * 260;
    out.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0, max: 0.5 + Math.random() * 0.5, color, size: 3 + Math.random() * 5, kind: Math.random() < 0.3 ? 'shard' : 'dot', rot: Math.random() * 6 });
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
