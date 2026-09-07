// Canvas arena: bubbles fly up from the bottom; the player taps or slices them.
export interface Bubble {
  id: number; label: string; x: number; y: number; vx: number; vy: number; r: number;
  launchAt: number; launched: boolean; hit: boolean; dead: boolean; color: string; wobble: number; scale: number;
  mark?: 'good' | 'bad'; markAt?: number; fade?: boolean;   // outcome reveal: spotlighted (✓/✗) or faded out
}
type PKind = 'dot' | 'ring' | 'shard' | 'text' | 'ember' | 'drop' | 'bolt' | 'rock' | 'leaf' | 'crystal' | 'star' | 'smoke' | 'pixel' | 'slash';
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: PKind; text?: string; rot?: number }
export type FxKind = 'fire' | 'water' | 'electric' | 'earth' | 'wind' | 'ice' | 'light' | 'shadow' | 'blade' | 'robot' | 'master';
const ELEMENTS: FxKind[] = ['fire', 'water', 'electric', 'earth', 'wind', 'ice', 'light', 'shadow', 'blade', 'robot'];   // `master` draws from all of these
const FX_PARTICLE: Record<FxKind, PKind> = { fire: 'ember', water: 'drop', electric: 'bolt', earth: 'rock', wind: 'leaf', ice: 'crystal', light: 'star', shadow: 'smoke', blade: 'slash', robot: 'pixel', master: 'star' };
const FX_COLORS: Record<FxKind, string[]> = { fire: ['#ff7a1a', '#ffd23a', '#ff3b1a'], water: ['#3ec9ff', '#9fe6ff', '#1a7fff'], electric: ['#2ea8ff', '#ffffff', '#9fe6ff'], earth: ['#a0622a', '#7ddc3a', '#6b4220'], wind: ['#7fe8c8', '#c8ffe9', '#5fcf5a'], ice: ['#9fe6ff', '#ffffff', '#5bb8e8'], light: ['#ffd23a', '#ffffff', '#ffb020'], shadow: ['#a855ff', '#5a2aa0', '#2a1050'], blade: ['#ffffff', '#ff3b5c', '#d8dce8'], robot: ['#ff5252', '#ffffff', '#9aa5cf'], master: ['#ffd87a', '#ffffff', '#ffb020'] };
export interface ArenaCallbacks {
  onHit: (b: Bubble, viaSwipe: boolean) => void;   // player touched/sliced a bubble
  onFall: (b: Bubble) => void;                       // an un-hit bubble fell off screen
  onWaveEnd: () => void;                             // no live bubbles remain
}
export interface WaveOpts { labels: string[]; speed: number; wide?: boolean; gravity?: number; ordered?: string[] /* sequence labels that must be sliced in this order */ }
const GOOD = '#66e07d', BAD = '#ff5f6d';

const PALETTE = ['#ff5f6d', '#ffa726', '#ffd54f', '#66e07d', '#40c4ff', '#b388ff', '#ff7ac6', '#4dd0e1'];

export class Arena {
  private ctx: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1; topInset = 120;
  bubbles: Bubble[] = [];
  private particles: Particle[] = [];
  private trail: { x: number; y: number; t: number }[] = [];
  private pointerDown = false; private downPos = { x: 0, y: 0 }; private lastPt = { x: 0, y: 0 }; private moved = 0;
  private raf = 0; private last = 0; private nextId = 1; private waveActive = false; private g = 600;
  private waveT = 4400; private batchSpan = 0;                  // this wave's flight time and one batch's stagger span (rush)
  paused = false; frozen = false; trailColor = '#7fe0ff'; trailCore?: string; fx: FxKind = 'blade'; private onSwish?: () => void; private trailEmit = 0;   // trailCore = shop skin's bright core (#6)
  time = 0;

  constructor(public canvas: HTMLCanvasElement, private cb: ArenaCallbacks, opts: { trailColor?: string; trailCore?: string; fx?: FxKind; onSwish?: () => void } = {}) {
    this.ctx = canvas.getContext('2d')!;
    if (opts.trailColor) this.trailColor = opts.trailColor;
    if (opts.trailCore) this.trailCore = opts.trailCore;
    if (opts.fx) this.fx = opts.fx;
    this.onSwish = opts.onSwish;
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
    this.W = Math.max(1, rect.width); this.H = Math.max(1, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.W * this.dpr); this.canvas.height = Math.round(this.H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  /** Bubble radius scales with viewport; words get wider bubbles. */
  radius(wide: boolean) {
    const base = Math.min(this.W, this.H) * 0.085;
    return Math.max(30, Math.min(wide ? 64 : 54, wide ? base * 1.25 : base));
  }

  spawnWave(o: WaveOpts) {
    this.bubbles = []; this.frozen = false;
    const n = o.labels.length;
    let r = Math.max(26, this.radius(!!o.wide) * (n >= 9 ? 0.8 : n >= 7 ? 0.9 : 1));
    r = Math.min(r, ((this.W - 16) / 3 - 10) / 2);                               // at least three always fit across
    const T = o.speed === 1 ? 5.6 : o.speed === 2 ? 4.4 : 3.4;              // seconds in the air
    this.waveT = T * 1000;
    const apexMin = this.topInset + r + 10;
    const usable = this.H - apexMin - r;
    const now = performance.now();
    const stagger = o.speed === 1 ? 420 : o.speed === 2 ? 330 : 260;
    // Long waves (a 7-word sentence plus decoys) launch in batches that fit across the width,
    // so bubbles never pile up on top of each other; each batch goes up as the previous one comes down.
    // A sequence must be sliced in order, so at most 4 bubbles ride each flight even on a wide screen:
    // otherwise a tablet puts all 10 words up at once and the child has one 4-second flight for the lot.
    const perBatch = Math.max(3, Math.min(o.ordered?.length ? 4 : n, Math.floor((this.W - 16) / (2 * r + 10))));
    const batchGap = T * 1000 * (perBatch < n && perBatch <= 4 ? 0.8 : 0.62);   // narrow screens: the row is mostly down before the next rises
    this.batchSpan = perBatch * stagger;
    const order = o.ordered?.length ? dealOrdered(o.labels, o.ordered, perBatch) : o.labels.map((_, i) => i).sort(() => Math.random() - 0.5);
    const margin = r + 8;
    const span = this.W - margin * 2;
    for (let k = 0; k < n; k++) {
      const i = order[k];
      const batch = Math.floor(k / perBatch), idx = k % perBatch, size = Math.min(perBatch, n - batch * perBatch);
      // spread x across the width in shuffled slots so bubbles don't overlap; a full row uses the whole span edge to edge
      const full = size >= perBatch && size > 1;
      const slot = full ? idx / (size - 1) : (idx + 0.5) / size;
      const x = margin + span * Math.min(1, Math.max(0, slot + (Math.random() - 0.5) * ((full ? 0.25 : 0.6) / size)));
      const apexY = apexMin + usable * (0.05 + Math.random() * 0.45);
      const h = this.H + r - apexY;
      const tUp = T / 2;
      const g = 2 * h / (tUp * tUp);
      const vy = -Math.sqrt(2 * g * h);
      const vx = ((this.W / 2 - x) / this.W) * 30 * (Math.random() * 0.6 + 0.4);
      const launchAt = now + batch * batchGap + idx * stagger * (size > 6 ? 0.6 : 1);
      this.bubbles.push({ id: this.nextId++, label: o.labels[i], x, y: this.H + r, vx, vy, r, launchAt, launched: false, hit: false, dead: false, color: PALETTE[(k * 3 + Math.floor(Math.random() * 3)) % PALETTE.length], wobble: Math.random() * Math.PI * 2, scale: 1 });
      (this.bubbles[this.bubbles.length - 1] as any)._g = g;
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
      this.bubbles.push({ id: this.nextId++, label: o.good, x, y, vx: 0, vy: 0, r, launchAt: now, launched: true, hit: true, dead: false, color: GOOD, wobble: 0, scale: 1, mark: 'good', markAt: now });
    }
  }
  /** Remove remaining bubbles (with a gentle fade) — used when the question is over. */
  clearWave(popColor?: string) {
    for (const b of this.bubbles) if (!b.dead) { b.dead = true; if (popColor && b.launched && !b.fade) this.burst(b.x, b.y, b.mark === 'good' ? GOOD : popColor, b.mark ? 14 : 6); }
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
    if (this.paused || this.frozen) return;
    this.pointerDown = true; this.moved = 0; this.downPos = this.pos(e); this.lastPt = this.downPos;
    this.trail = [{ ...this.downPos, t: performance.now() }];
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const b = this.bubbleAt(this.downPos.x, this.downPos.y);
    if (b) this.hitBubble(b, false);
  };
  private onMove = (e: PointerEvent) => {
    if (!this.pointerDown || this.paused || this.frozen) return;
    // Hit-test against the last pointer position, not the visual trail: the trail fades after 280ms,
    // so a finger that pauses mid-stroke (or slow pointer events) must not lose its slice segment.
    const p = this.pos(e); const prev = this.lastPt;
    const d = Math.hypot(p.x - prev.x, p.y - prev.y); this.moved += d; if (d < 2) return;
    this.lastPt = p;
    this.trail.push({ ...p, t: performance.now() });
    if (this.trail.length > 24) this.trail.shift();
    if (this.moved > 40 && this.trail.length % 6 === 0) this.onSwish?.();
    if (++this.trailEmit % 2 === 0) this.emitFx(p.x, p.y, 1, p.x - prev.x, p.y - prev.y);
    for (const b of this.bubbles) { if (this.frozen) break; if (b.launched && !b.hit && !b.dead && segCircle(prev.x, prev.y, p.x, p.y, b.x, b.y, b.r)) this.hitBubble(b, true); }
  };
  private onUp = () => { this.pointerDown = false; };
  private bubbleAt(x: number, y: number) {
    let best: Bubble | null = null, bd = Infinity;
    for (const b of this.bubbles) { if (!b.launched || b.hit || b.dead) continue; const d = Math.hypot(b.x - x, b.y - y); if (d < b.r * 1.15 && d < bd) { best = b; bd = d; } }
    return best;
  }
  private hitBubble(b: Bubble, viaSwipe: boolean) {
    b.hit = true;
    this.burst(b.x, b.y, b.color);
    this.cb.onHit(b, viaSwipe);
    if (!b.mark) b.dead = true;                     // reveal() may keep it on screen as the spotlighted outcome
  }

  // ---------- loop ----------
  private loop = (now: number) => {
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.5) dt = 0.016;                       // tab was hidden: don't jump
    dt = Math.min(dt, 0.1);
    if (!this.paused) { this.time += dt; for (let left = dt; left > 0; left -= 1 / 60) this.update(Math.min(left, 1 / 60), now); }
    this.render(now);
    this.raf = requestAnimationFrame(this.loop);
  };
  private update(dt: number, now: number) {
    let live = 0;
    for (const b of this.bubbles) {
      if (b.dead) continue;
      if (this.frozen) { live++; b.wobble += dt * 3; continue; }        // outcome reveal: everything holds still
      if (!b.launched) { if (now >= b.launchAt) b.launched = true; else { live++; continue; } }
      const g = (b as any)._g ?? this.g;
      b.vy += g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.wobble += dt * 3;
      if (b.y - b.r > this.H + 10 && b.vy > 0) { b.dead = true; this.cb.onFall(b); continue; }
      live++;
    }
    if (this.waveActive && live === 0) { this.waveActive = false; this.cb.onWaveEnd(); }
    for (const p of this.particles) { p.life += dt; const g = p.kind === 'ring' || p.kind === 'text' || p.kind === 'bolt' || p.kind === 'slash' ? 0 : p.kind === 'ember' || p.kind === 'smoke' ? -120 : p.kind === 'leaf' || p.kind === 'star' ? 80 : p.kind === 'drop' ? 700 : 500; p.vy += g * dt; if (p.kind === 'leaf') p.vx += Math.sin(p.life * 9) * 40 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.particles = this.particles.filter(p => p.life < p.max);
    const cutoff = now - 280; this.trail = this.trail.filter(t => t.t > cutoff);
  }
  private render(now: number) {
    const c = this.ctx; c.clearRect(0, 0, this.W, this.H);
    for (const b of this.bubbles) { if (b.dead || !b.launched || b.mark) continue; this.drawBubble(c, b, now); }
    for (const b of this.bubbles) { if (!b.dead && b.launched && b.mark) this.drawBubble(c, b, now); }   // spotlighted on top
    for (const p of this.particles) this.drawParticle(c, p);
    this.drawTrail(c, now);
  }
  private drawBubble(c: CanvasRenderingContext2D, b: Bubble, now: number) {
    const wob = Math.sin(b.wobble) * 0.04;
    c.save(); c.translate(b.x, b.y);
    let scale = b.scale;
    if (b.fade) { c.globalAlpha = 0.28; scale *= 0.9; }
    if (b.mark) {                                    // outcome spotlight: pop in, gentle pulse, a shake for a wrong slice
      const age = Math.max(0, now - (b.markAt ?? now)) / 1000;
      scale *= Math.min(1, age / 0.16) * (1.18 + 0.05 * Math.sin(age * 9));
      if (b.mark === 'bad') c.translate(Math.sin(age * 45) * 6 * Math.max(0, 0.45 - age) / 0.45, 0);
    }
    c.rotate(b.mark ? 0 : wob); c.scale(scale, scale);
    if (b.mark) {
      const col = b.mark === 'good' ? GOOD : BAD;
      c.strokeStyle = col; c.lineWidth = 6; c.shadowColor = col; c.shadowBlur = 18; c.beginPath(); c.arc(0, 0, b.r + 7, 0, Math.PI * 2); c.stroke(); c.shadowBlur = 0;
    }
    // glow (cached sprite — shadowBlur is too slow on low-end devices)
    const g = glowSprite(b.color, b.r); c.drawImage(g, -g.width / 2, -g.height / 2);
    const grd = c.createRadialGradient(-b.r * 0.35, -b.r * 0.4, b.r * 0.1, 0, 0, b.r);
    grd.addColorStop(0, lighten(b.color, 0.55)); grd.addColorStop(0.55, b.color); grd.addColorStop(1, darken(b.color, 0.35));
    c.fillStyle = grd; c.beginPath(); c.arc(0, 0, b.r, 0, Math.PI * 2); c.fill();
    // rim + highlight
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-b.r * 0.35, -b.r * 0.45, b.r * 0.28, b.r * 0.16, -0.6, 0, Math.PI * 2); c.fill();
    // label
    const text = b.label;
    let fs = b.r * (text.length <= 2 ? 1.05 : text.length <= 4 ? 0.7 : text.length <= 7 ? 0.5 : 0.4);
    c.font = `800 ${fs}px "Fredoka", "Baloo 2", "Nunito", system-ui, sans-serif`;
    while (c.measureText(text).width > b.r * 1.75 && fs > 10) { fs -= 1; c.font = `800 ${fs}px "Fredoka", "Baloo 2", "Nunito", system-ui, sans-serif`; }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineJoin = 'round'; c.lineWidth = Math.max(3, fs * 0.16); c.strokeStyle = 'rgba(20,20,40,.75)'; c.strokeText(text, 0, 2);
    c.fillStyle = '#fff'; c.fillText(text, 0, 2);
    if (b.mark) {                                    // ✓ / ✗ badge
      const col = b.mark === 'good' ? GOOD : BAD, br = b.r * 0.36, bx = b.r * 0.74, by = -b.r * 0.74;
      c.fillStyle = col; c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.stroke();
      c.font = `900 ${br * 1.5}px "Fredoka", "Baloo 2", system-ui, sans-serif`; c.lineWidth = 0; c.fillStyle = '#fff'; c.fillText(b.mark === 'good' ? '✓' : '✗', bx, by + 1);
    }
    c.restore();
  }
  private drawParticle(c: CanvasRenderingContext2D, p: Particle) {
    const k = 1 - p.life / p.max;
    c.save(); c.globalAlpha = Math.max(0, k);
    if (p.kind === 'ring') { c.strokeStyle = p.color; c.lineWidth = 4 * k + 1; c.beginPath(); c.arc(p.x, p.y, p.size + (1 - k) * 90, 0, Math.PI * 2); c.stroke(); }
    else if (p.kind === 'text') { c.font = `800 ${p.size}px "Fredoka", "Baloo 2", system-ui, sans-serif`; c.textAlign = 'center'; c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(p.text!, p.x, p.y); c.fillStyle = p.color; c.fillText(p.text!, p.x, p.y); }
    else if (p.kind === 'shard') { c.translate(p.x, p.y); c.rotate((p.rot ?? 0) + p.life * 6); c.fillStyle = p.color; c.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); }
    else if (p.kind === 'ember') { const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.4, p.color); g.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.size * (0.6 + 0.6 * k), 0, Math.PI * 2); c.fill(); }
    else if (p.kind === 'drop') { c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2); c.fillStyle = p.color; c.beginPath(); c.moveTo(0, -p.size * 1.6); c.quadraticCurveTo(p.size, 0, 0, p.size); c.quadraticCurveTo(-p.size, 0, 0, -p.size * 1.6); c.fill(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(-p.size * 0.3, -p.size * 0.2, p.size * 0.25, 0, Math.PI * 2); c.fill(); }
    else if (p.kind === 'bolt') { c.translate(p.x, p.y); c.rotate(p.rot ?? 0); c.strokeStyle = p.color; c.lineWidth = 2.5; c.lineJoin = 'miter'; c.shadowColor = '#2ea8ff'; c.shadowBlur = 8; c.beginPath(); c.moveTo(-p.size, 0); c.lineTo(-p.size * 0.3, -p.size * 0.5); c.lineTo(p.size * 0.1, p.size * 0.3); c.lineTo(p.size, -p.size * 0.4); c.stroke(); }
    else if (p.kind === 'rock') { c.translate(p.x, p.y); c.rotate((p.rot ?? 0) + p.life * 4); c.fillStyle = p.color; c.beginPath(); c.moveTo(-p.size, -p.size * 0.4); c.lineTo(-p.size * 0.3, -p.size); c.lineTo(p.size * 0.8, -p.size * 0.6); c.lineTo(p.size, p.size * 0.4); c.lineTo(p.size * 0.1, p.size); c.lineTo(-p.size * 0.9, p.size * 0.5); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.stroke(); }
    else if (p.kind === 'leaf') { c.translate(p.x, p.y); c.rotate((p.rot ?? 0) + Math.sin(p.life * 6)); c.fillStyle = p.color; c.beginPath(); c.moveTo(0, -p.size); c.quadraticCurveTo(p.size, 0, 0, p.size); c.quadraticCurveTo(-p.size, 0, 0, -p.size); c.fill(); c.strokeStyle = 'rgba(0,80,40,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -p.size * 0.8); c.lineTo(0, p.size * 0.8); c.stroke(); }
    else if (p.kind === 'crystal') { c.translate(p.x, p.y); c.rotate((p.rot ?? 0) + p.life * 3); c.fillStyle = p.color; c.beginPath(); c.moveTo(0, -p.size * 1.4); c.lineTo(p.size * 0.6, 0); c.lineTo(0, p.size * 1.4); c.lineTo(-p.size * 0.6, 0); c.closePath(); c.fill(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1; c.stroke(); }
    else if (p.kind === 'star') { c.translate(p.x, p.y); c.rotate((p.rot ?? 0) + p.life * 2); c.fillStyle = p.color; c.shadowColor = '#ffd23a'; c.shadowBlur = 10; c.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? p.size * 0.35 : p.size; const a = i * Math.PI / 4; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); }
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
export function dealOrdered(labels: string[], ordered: string[], perBatch: number): number[] {
  const pool = labels.map((l, i) => ({ l, i }));
  const targets: number[] = [];
  for (const label of ordered) { const k = pool.findIndex(x => x.l === label); if (k >= 0) targets.push(pool.splice(k, 1)[0].i); }
  const decoys = pool.map(x => x.i).sort(() => Math.random() - 0.5);
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
    out.push(...batch.sort(() => Math.random() - 0.5));
  }
  return out;
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
function segCircle(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number) {
  const dx = x2 - x1, dy = y2 - y1; const l2 = dx * dx + dy * dy;
  let t = l2 ? ((cx - x1) * dx + (cy - y1) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx, py = y1 + t * dy;
  return Math.hypot(px - cx, py - cy) <= r;
}
function hexToRgb(h: string) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function hexA(h: string, a: number) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
function lighten(h: string, k: number) { const [r, g, b] = hexToRgb(h); return `rgb(${r + (255 - r) * k | 0},${g + (255 - g) * k | 0},${b + (255 - b) * k | 0})`; }
function darken(h: string, k: number) { const [r, g, b] = hexToRgb(h); return `rgb(${r * (1 - k) | 0},${g * (1 - k) | 0},${b * (1 - k) | 0})`; }
