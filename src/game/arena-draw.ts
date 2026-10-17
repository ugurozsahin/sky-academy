// The Arena's per-frame canvas drawing (#1432, split out of arena.ts): a bubble, a particle and the swipe trail,
// as pure functions of the context and the model. `Arena` keeps the frame decisions (what to skip, in what
// order); nothing here holds state, so every function stays inside the lint limits. No shadowBlur and no
// per-frame gradient on a bubble (#28/#29) — the guard rails in `guardrails.test.ts` read this file for both.
import { GOOD, BAD, GOOD_HALO, BAD_HALO, glowSprite, bodySprite, labelFont, hexA } from './bubbles';
import type { Bubble } from './bubbles';
import { FX_COLORS, BOLT_HALO, STAR_HALO } from './particles';
import type { Particle, FxKind } from './particles';

/** One square cell of a baked solid, to draw in place of a bubble's label (#684). */
export type LabelArt = { readonly img: CanvasImageSource; readonly sx: number; readonly size: number };
type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

// ---- bubble -------------------------------------------------------------------------------------------------
/** The outcome spotlight's pop-in, gentle pulse and wrong-slice shake; returns the extra scale (1 when unmarked). */
function spotlight(c: Ctx, b: Bubble, now: number): number {
  if (!b.mark) return 1;
  const age = Math.max(0, now - (b.markAt ?? now)) / 1000;
  if (b.mark === 'bad') c.translate(Math.sin(age * 45) * 6 * Math.max(0, 0.45 - age) / 0.45, 0);
  return Math.min(1, age / 0.16) * (1.18 + 0.05 * Math.sin(age * 9));
}
function markRing(c: Ctx, b: Bubble) {
  const good = b.mark === 'good';
  // #29: a soft translucent underlay ring instead of shadowBlur (per-pixel blur is too slow on low-end phones).
  c.beginPath(); c.arc(0, 0, b.r + 7, 0, TAU);
  c.strokeStyle = good ? GOOD_HALO : BAD_HALO; c.lineWidth = 18; c.stroke();   // the halo
  c.strokeStyle = good ? GOOD : BAD; c.lineWidth = 6; c.stroke();              // the crisp ring
}
/** The fitted label lines, centred on the disc — font size and line break were fitted once at spawn (#28/#348). */
function drawLabel(c: Ctx, b: Bubble) {
  const lines = b.lines; const fs = b.fontSize;
  c.font = labelFont(fs);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const lh = fs * 1.02, top = 2 - (lines.length - 1) * lh / 2;   // the block of lines stays centred on the disc
  c.lineJoin = 'round'; c.lineWidth = Math.max(3, fs * 0.16); c.strokeStyle = 'rgba(20,20,40,.75)';
  for (let i = 0; i < lines.length; i++) c.strokeText(lines[i], 0, top + i * lh);
  c.fillStyle = '#fff';
  for (let i = 0; i < lines.length; i++) c.fillText(lines[i], 0, top + i * lh);
}
function markBadge(c: Ctx, b: Bubble) {   // ✓ / ✗ badge
  const col = b.mark === 'good' ? GOOD : BAD, br = b.r * 0.36, bx = b.r * 0.74, by = -b.r * 0.74;
  c.fillStyle = col; c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.stroke();
  // No Fredoka here on purpose: it has no ✓ or ✗ glyph, so this text has always come from the fallback
  // stack, where 900 is a real designed weight. Naming Fredoka only invited someone to "fix" the 900.
  c.font = `900 ${br * 1.5}px "Baloo 2", system-ui, sans-serif`; c.lineWidth = 0; c.fillStyle = '#fff'; c.fillText(b.mark === 'good' ? '✓' : '✗', bx, by + 1);
}
/** `art` is the baked solid of a 3-D Shapes bubble, or null for the label (#684); the phase offset by id lives in the caller. */
export function drawBubble(c: Ctx, b: Bubble, now: number, art: LabelArt | null) {
  c.save(); c.translate(b.x, b.y);
  let scale = spotlight(c, b, now);
  if (b.fade) { c.globalAlpha = 0.28; scale *= 0.9; }
  c.rotate(b.mark ? 0 : Math.sin(b.wobble) * 0.04); c.scale(scale, scale);
  if (b.mark) markRing(c, b);
  // glow + body: both cached offscreen sprites keyed `color|round(r)`. A per-frame radial gradient (two colour
  // strings + a gradient object per bubble) and a shadowBlur are too slow on low-end devices (#28/#29).
  const g = glowSprite(b.color, b.r); c.drawImage(g, -g.width / 2, -g.height / 2);
  const body = bodySprite(b.color, b.r); c.drawImage(body, -body.width / 2, -body.height / 2);
  if (art) { const s = b.r * 1.5; c.drawImage(art.img, art.sx, 0, art.size, art.size, -s / 2, -s / 2, s, s); }
  else drawLabel(c, b);
  if (b.mark) markBadge(c, b);
  c.restore();
}

// ---- particle -----------------------------------------------------------------------------------------------
type PDraw = (c: Ctx, p: Particle, k: number) => void;
const POINTS = (c: Ctx, pts: number[]) => { c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); };
// The 8-point star silhouette, built at the current transform. Defined once (not a per-frame closure) so the
// star particle can fill it twice — a scaled halo copy then the crisp copy — without allocating each frame (#29).
function starShape(c: Ctx, size: number) {
  c.beginPath();
  for (let i = 0; i < 8; i++) { const r = i % 2 ? size * 0.35 : size; const a = i * Math.PI / 4; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.closePath();
}
const at = (c: Ctx, p: Particle, rot: number) => { c.translate(p.x, p.y); c.rotate(rot); };
const circle = (c: Ctx, x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
// The six-point rock outline, shared by a thrown rock's particle; x/y are in the particle's own frame.
function rockPath(c: Ctx, s: number) {
  c.beginPath(); c.moveTo(-s, -s * 0.4); c.lineTo(-s * 0.3, -s); c.lineTo(s * 0.8, -s * 0.6); c.lineTo(s, s * 0.4); c.lineTo(s * 0.1, s); c.lineTo(-s * 0.9, s * 0.5); c.closePath();
}
const PARTICLE_DRAW: Readonly<Record<string, PDraw>> = {
  ring: (c, p, k) => { c.strokeStyle = p.color; c.lineWidth = 4 * k + 1; c.beginPath(); c.arc(p.x, p.y, p.size + (1 - k) * 90, 0, TAU); c.stroke(); },
  text: (c, p) => { c.font = `700 ${p.size}px "Fredoka", "Baloo 2", system-ui, sans-serif`; c.textAlign = 'center'; c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(p.text!, p.x, p.y); c.fillStyle = p.color; c.fillText(p.text!, p.x, p.y); },
  shard: (c, p) => { at(c, p, (p.rot ?? 0) + p.life * 6); c.fillStyle = p.color; c.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); },
  ember: (c, p, k) => { const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.4, p.color); g.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = g; circle(c, p.x, p.y, p.size * (0.6 + 0.6 * k)); },
  drop: (c, p) => {
    at(c, p, Math.atan2(p.vy, p.vx) + Math.PI / 2); c.fillStyle = p.color;
    c.beginPath(); c.moveTo(0, -p.size * 1.6); c.quadraticCurveTo(p.size, 0, 0, p.size); c.quadraticCurveTo(-p.size, 0, 0, -p.size * 1.6); c.fill();
    c.fillStyle = 'rgba(255,255,255,.6)'; circle(c, -p.size * 0.3, -p.size * 0.2, p.size * 0.25);
  },
  bolt: (c, p) => {   // #29: halo underlay, not shadowBlur
    at(c, p, p.rot ?? 0); c.lineJoin = 'miter'; c.beginPath();
    POINTS(c, [-p.size, 0, -p.size * 0.3, -p.size * 0.5, p.size * 0.1, p.size * 0.3, p.size, -p.size * 0.4]);
    c.strokeStyle = BOLT_HALO; c.lineWidth = 7; c.stroke(); c.strokeStyle = p.color; c.lineWidth = 2.5; c.stroke();
  },
  rock: (c, p) => { at(c, p, (p.rot ?? 0) + p.life * 4); c.fillStyle = p.color; rockPath(c, p.size); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.stroke(); },
  leaf: (c, p) => {
    at(c, p, (p.rot ?? 0) + Math.sin(p.life * 6)); c.fillStyle = p.color;
    c.beginPath(); c.moveTo(0, -p.size); c.quadraticCurveTo(p.size, 0, 0, p.size); c.quadraticCurveTo(-p.size, 0, 0, -p.size); c.fill();
    c.strokeStyle = 'rgba(0,80,40,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -p.size * 0.8); c.lineTo(0, p.size * 0.8); c.stroke();
  },
  crystal: (c, p) => {
    at(c, p, (p.rot ?? 0) + p.life * 3); c.fillStyle = p.color;
    c.beginPath(); c.moveTo(0, -p.size * 1.4); c.lineTo(p.size * 0.6, 0); c.lineTo(0, p.size * 1.4); c.lineTo(-p.size * 0.6, 0); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1; c.stroke();
  },
  // #29: halo = a scaled fill of the star, NOT a stroke — stroking this concave path is slower than the old shadowBlur (measured)
  star: (c, p) => {
    at(c, p, (p.rot ?? 0) + p.life * 2); c.fillStyle = STAR_HALO;
    c.save(); c.scale(1.35, 1.35); starShape(c, p.size); c.fill(); c.restore();
    c.fillStyle = p.color; starShape(c, p.size); c.fill();
  },
  smoke: (c, p, k) => { c.globalAlpha = Math.max(0, k) * 0.55; c.fillStyle = p.color; circle(c, p.x, p.y, p.size * (0.5 + (1 - k))); },
  pixel: (c, p) => { c.fillStyle = p.color; c.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); },
  slash: (c, p) => { at(c, p, p.rot ?? 0); c.strokeStyle = p.color; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(-p.size, 0); c.lineTo(p.size, 0); c.stroke(); },
};
const dot: PDraw = (c, p, k) => { c.fillStyle = p.color; circle(c, p.x, p.y, p.size * k); };
export function drawParticle(c: Ctx, p: Particle) {
  const k = 1 - p.life / p.max;
  c.save(); c.globalAlpha = Math.max(0, k);
  (PARTICLE_DRAW[p.kind] ?? dot)(c, p, k);
  c.restore();
}

// ---- trail --------------------------------------------------------------------------------------------------
export interface TrailPoint { x: number; y: number; t: number }
export interface TrailSkin { fx: FxKind; color: string; core?: string }
const TRAIL_FADE = 280;   // ms a trail point lives; `Arena.cull` drops a point older than this
const wideWidth = (fx: FxKind) => fx === 'fire' || fx === 'shadow' || fx === 'water' ? 22 : fx === 'blade' ? 8 : 14;
const coreWidth = (fx: FxKind) => fx === 'blade' ? 2 : fx === 'electric' ? 3 : 5;
function trailStroke(skin: TrailSkin, pass: number, age: number): string {
  const { fx, color, core } = skin;
  if (pass === 0) return hexA(color, (fx === 'shadow' ? 0.5 : 0.35) * age);
  if (core) return hexA(core, 0.9 * age);
  if (fx === 'fire') return `rgba(255,230,150,${0.9 * age})`;
  return fx === 'shadow' ? hexA(FX_COLORS[fx][1], 0.9 * age) : `rgba(255,255,255,${0.9 * age})`;
}
function trailSegment(c: Ctx, a: TrailPoint, b: TrailPoint, jagged: boolean) {
  c.beginPath(); c.moveTo(a.x, a.y);
  if (jagged) c.lineTo((a.x + b.x) / 2 + (Math.random() - 0.5) * 14, (a.y + b.y) / 2 + (Math.random() - 0.5) * 14);   // jagged lightning core
  c.lineTo(b.x, b.y); c.stroke();
}
export function drawTrail(c: Ctx, trail: readonly TrailPoint[], skin: TrailSkin, now: number) {
  if (trail.length < 2) return;
  const fx = skin.fx;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    const width = pass === 0 ? wideWidth(fx) : coreWidth(fx), jagged = fx === 'electric' && pass === 1;
    for (let i = 1; i < trail.length; i++) {
      const age = Math.max(0, 1 - (now - trail[i].t) / TRAIL_FADE);
      c.strokeStyle = trailStroke(skin, pass, age);
      c.lineWidth = Math.max(0.5, width * age * (i / trail.length));
      trailSegment(c, trail[i - 1], trail[i], jagged);
    }
  }
  if (fx === 'blade') {   // red edge highlight on the katana slash
    const last = trail[trail.length - 1], prev = trail[Math.max(0, trail.length - 4)];
    c.strokeStyle = 'rgba(255,59,92,.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(prev.x, prev.y + 3); c.lineTo(last.x, last.y + 3); c.stroke();
  }
  c.restore();
}
