// Letter / word tracing: the child paints over a faint glyph; we measure how much of it they covered.
export interface TraceResult { coverage: number; outside: number; pass: boolean; glyphs: number[] /* coverage per letter */; weakest: number /* index of the least-covered letter */ }
/** Pass rule (pure, unit-tested): every letter must be mostly covered — tracing 2 of 3 letters is not a word. */
export const GLYPH_MIN = 0.55, WORD_MIN = 0.65, OUTSIDE_MAX = 0.45;
export function scoreTrace(glyphHits: number[], glyphTotals: number[], insidePts: number, outsidePts: number): TraceResult {
  const glyphs = glyphTotals.map((t, i) => (t ? glyphHits[i] / t : 1));
  const total = glyphTotals.reduce((a, b) => a + b, 0), hits = glyphHits.reduce((a, b) => a + b, 0);
  const coverage = total ? hits / total : 0;
  const pts = insidePts + outsidePts; const outside = pts ? outsidePts / pts : 0;
  let weakest = 0; glyphs.forEach((g, i) => { if (g < glyphs[weakest]) weakest = i; });
  return { coverage, outside, glyphs, weakest, pass: coverage >= WORD_MIN && outside <= OUTSIDE_MAX && glyphs.every(g => g >= GLYPH_MIN) };
}

/** The mask is built at half the canvas resolution, so a canvas point maps to `x * MASK_SCALE` in the grid. */
export const MASK_SCALE = 0.5;
/** The faint glyph the child is tracing over, and how much of it they have covered.
 *  `mask[i]` is the letter index + 1 (0 = blank paper); `covered[i]` is 1 once a stroke has claimed that cell. */
export interface TraceGrid { mask: Uint8Array; covered: Uint8Array; mw: number; mh: number }
/** What the pixel accounting has counted so far: cells covered per letter, and points on / off the glyph. */
export interface TraceTally { glyphHits: number[]; insidePts: number; outsidePts: number }
/** A point in canvas coordinates. */
export interface TracePt { x: number; y: number }

/**
 * Mark one painted point (canvas coordinates) against the glyph (#43). The brush scans a square of half-res
 * cells around the point, but only claims the ones inside its disc — so a stroke that merely grazes the
 * glyph counts as *on* it without covering it, which is what stops a scribble passing. Cells are claimed at
 * most once each, so re-tracing a letter cannot inflate its coverage.
 *
 * Mutates `grid.covered` and `tally` in place, and touches nothing else — no canvas, no clock, no randomness.
 */
export function markPoint(grid: TraceGrid, tally: TraceTally, x: number, y: number, brush: number): void {
  const cx = Math.round(x * MASK_SCALE), cy = Math.round(y * MASK_SCALE);
  const r = Math.ceil(brush * MASK_SCALE);
  // The "inside" test (below) and the claim disc must agree on one radius (#592): `tol` used to be `r * 2`,
  // a bound with no relation to `claimR2`, so a point could be judged "on the glyph" — and so exempted from
  // OUTSIDE_MAX — from up to a full brush-width clear of it. `tol` is now just the claim disc's own radius,
  // rounded out to the next cell, so the search square is the smallest one that can still reach every
  // claimable cell and nothing scores "inside" that the disc itself would reject.
  const claimR2 = r * r * 1.2, tol = Math.ceil(Math.sqrt(claimR2));
  let inside = false;
  for (let dy = -tol; dy <= tol; dy++) for (let dx = -tol; dx <= tol; dx++) {
    const px = cx + dx, py = cy + dy; if (px < 0 || py < 0 || px >= grid.mw || py >= grid.mh) continue;
    const i = py * grid.mw + px;
    if (grid.mask[i]) { inside = true; if (dx * dx + dy * dy <= claimR2 && !grid.covered[i]) { grid.covered[i] = 1; tally.glyphHits[grid.mask[i] - 1]++; } }
  }
  if (inside) tally.insidePts++; else tally.outsidePts++;
}

/** Paint one stroke segment, sampled about every 4px so a fast swipe leaves no gaps (#43). Both endpoints are
 *  marked, so a segment of length L marks `ceil(L/4) + 1` points and a tap (`a` and `b` the same point) marks
 *  its one point twice — it counts 2 towards the inside/outside ratio. Pure apart from `grid`/`tally`. */
export function paintStroke(grid: TraceGrid, tally: TraceTally, a: TracePt, b: TracePt, brush: number): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
  for (let i = 0; i <= steps; i++) markPoint(grid, tally, a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps, brush);
}

export class Tracer {
  private ctx: CanvasRenderingContext2D;
  private grid!: TraceGrid; private tally!: TraceTally;
  private glyphTotals: number[] = [];   // cells in each letter's mask; the denominator scoreTrace divides by
  private drawing = false; private last: { x: number; y: number } | null = null; private W = 0; private H = 0; private brush = 14;
  strokes = 0; done = false;
  constructor(public canvas: HTMLCanvasElement, public text: string, private onProgress: (r: TraceResult) => void, public color = '#7fe0ff') {
    this.ctx = canvas.getContext('2d')!;
    this.setup();
    canvas.addEventListener('pointerdown', this.down); canvas.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up); window.addEventListener('pointercancel', this.up);
    window.addEventListener('resize', this.resize);
  }
  destroy() { this.canvas.removeEventListener('pointerdown', this.down); this.canvas.removeEventListener('pointermove', this.move); window.removeEventListener('pointerup', this.up); window.removeEventListener('pointercancel', this.up); window.removeEventListener('resize', this.resize); }
  /** #592: `setup()` re-reads the canvas box and rebuilds the mask for it — same fix as Arena's own `resize`.
   *  Assigning `canvas.width` below wipes the bitmap, so this also clears the child's ink; that is deliberate,
   *  not a side effect to work around — scoring the old strokes against a mask built for a different box is
   *  the bug this closes, and a rotation mid-letter is rare enough that starting the letter over is the
   *  honest outcome, not a silent one (`onProgress` reports the reset zero straight away). */
  private resize = () => { this.setup(); this.onProgress(this.result()); };
  private font(size: number) { return `700 ${size}px "Fredoka", "Baloo 2", "Nunito", system-ui, sans-serif`; }
  setup() {
    const rect = this.canvas.getBoundingClientRect();
    this.W = Math.max(1, rect.width); this.H = Math.max(1, rect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = this.W * dpr; this.canvas.height = this.H * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // fit font
    let size = Math.min(this.H * 0.7, 260);
    this.ctx.font = this.font(size);
    while (this.ctx.measureText(this.text).width > this.W * 0.85 && size > 20) { size -= 4; this.ctx.font = this.font(size); }
    this.brush = Math.max(10, size * 0.09);
    // build mask at half resolution
    const s = MASK_SCALE, mw = Math.ceil(this.W * s), mh = Math.ceil(this.H * s);
    const off = document.createElement('canvas'); off.width = mw; off.height = mh;
    const oc = off.getContext('2d')!; oc.fillStyle = '#000'; oc.font = this.font(size * s); oc.textAlign = 'left'; oc.textBaseline = 'middle';
    // one letter at a time, so coverage is judged per letter (mask value = letter index + 1)
    const chars = [...this.text]; const left = mw / 2 - oc.measureText(this.text).width / 2, y = mh / 2 + size * s * 0.05;
    const mask = new Uint8Array(mw * mh);
    this.grid = { mask, covered: new Uint8Array(mw * mh), mw, mh };
    this.glyphTotals = chars.map(() => 0);
    chars.forEach((ch, gi) => {
      if (ch === ' ') return;
      oc.clearRect(0, 0, mw, mh); oc.fillText(ch, left + oc.measureText(this.text.slice(0, gi)).width, y);
      const data = oc.getImageData(0, 0, mw, mh).data;
      for (let i = 0; i < mask.length; i++) if (data[i * 4 + 3] > 100 && !mask[i]) { mask[i] = gi + 1; this.glyphTotals[gi]++; }
    });
    this.tally = { glyphHits: chars.map(() => 0), insidePts: 0, outsidePts: 0 };
    this.strokes = 0; this.done = false;
    this.drawing = false; this.last = null;   // #592: a stroke in progress when the box changes must not resume against the new mask
    this.redraw(size);
  }
  private redraw(size: number) {
    const c = this.ctx; c.clearRect(0, 0, this.W, this.H);
    c.save(); c.font = this.font(size); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 2; c.setLineDash([6, 6]); c.strokeStyle = 'rgba(255,255,255,.55)'; c.fillStyle = 'rgba(255,255,255,.10)';
    c.fillText(this.text, this.W / 2, this.H / 2 + size * 0.05); c.strokeText(this.text, this.W / 2, this.H / 2 + size * 0.05);
    // start dot on the first letter
    const w = c.measureText(this.text).width; c.setLineDash([]);
    c.fillStyle = '#66e07d'; c.beginPath(); c.arc(this.W / 2 - w / 2 + size * 0.12, this.H / 2 - size * 0.28, Math.max(5, size * 0.04), 0, Math.PI * 2); c.fill();
    c.restore();
  }
  clear() { this.setup(); this.onProgress(this.result()); }
  private pos(e: PointerEvent) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  private down = (e: PointerEvent) => { if (this.done) return; this.drawing = true; this.last = this.pos(e); this.strokes++; try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ } this.paint(this.last, this.last); };
  private move = (e: PointerEvent) => { if (!this.drawing || !this.last) return; const p = this.pos(e); this.paint(this.last, p); this.last = p; };
  private up = () => { if (!this.drawing) return; this.drawing = false; this.last = null; const r = this.result(); if (r.pass) this.done = true; this.onProgress(r); };
  private paint(a: { x: number; y: number }, b: { x: number; y: number }) {
    const c = this.ctx; c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = this.color;
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
    c.globalAlpha = 0.35; c.lineWidth = this.brush * 2 + 8; c.stroke();   // #29: soft halo underlay instead of shadowBlur
    c.globalAlpha = 1; c.lineWidth = this.brush * 2; c.stroke(); c.restore();
    // #43: the pixel accounting is the pure paintStroke/markPoint above — all this method does is the drawing.
    paintStroke(this.grid, this.tally, a, b, this.brush);
  }
  result(): TraceResult { return scoreTrace(this.tally.glyphHits, this.glyphTotals, this.tally.insidePts, this.tally.outsidePts); }
  /** Test hook: trace the glyph programmatically by painting over every mask pixel (optionally only some letters). */
  autoTrace(letters?: number[]) {
    const { mask, mw, mh } = this.grid;
    for (let y = 0; y < mh; y += 2) for (let x = 0; x < mw; x += 2) { const g = mask[y * mw + x]; if (g && (!letters || letters.includes(g - 1))) markPoint(this.grid, this.tally, x / MASK_SCALE, y / MASK_SCALE, this.brush); }
    this.strokes++; const r = this.result(); if (r.pass) this.done = true; this.onProgress(r);
  }
}
