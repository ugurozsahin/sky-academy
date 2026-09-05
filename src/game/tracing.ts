// Letter / word tracing: the child paints over a faint glyph; we measure how much of it they covered.
export interface TraceResult { coverage: number; outside: number; pass: boolean }

export class Tracer {
  private ctx: CanvasRenderingContext2D;
  private mask!: Uint8Array; private covered!: Uint8Array; private mw = 0; private mh = 0; private total = 0; private hits = 0; private outsidePts = 0; private insidePts = 0;
  private drawing = false; private last: { x: number; y: number } | null = null; private W = 0; private H = 0; private brush = 14;
  strokes = 0; done = false;
  constructor(public canvas: HTMLCanvasElement, public text: string, private onProgress: (r: TraceResult) => void, public color = '#7fe0ff') {
    this.ctx = canvas.getContext('2d')!;
    this.setup();
    canvas.addEventListener('pointerdown', this.down); canvas.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up); window.addEventListener('pointercancel', this.up);
  }
  destroy() { window.removeEventListener('pointerup', this.up); window.removeEventListener('pointercancel', this.up); }
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
    const s = 0.5; this.mw = Math.ceil(this.W * s); this.mh = Math.ceil(this.H * s);
    const off = document.createElement('canvas'); off.width = this.mw; off.height = this.mh;
    const oc = off.getContext('2d')!; oc.fillStyle = '#000'; oc.font = this.font(size * s); oc.textAlign = 'center'; oc.textBaseline = 'middle';
    oc.fillText(this.text, this.mw / 2, this.mh / 2 + size * s * 0.05);
    const data = oc.getImageData(0, 0, this.mw, this.mh).data;
    this.mask = new Uint8Array(this.mw * this.mh); this.covered = new Uint8Array(this.mw * this.mh); this.total = 0;
    for (let i = 0; i < this.mask.length; i++) if (data[i * 4 + 3] > 100) { this.mask[i] = 1; this.total++; }
    this.hits = 0; this.outsidePts = 0; this.insidePts = 0; this.strokes = 0; this.done = false;
    this.redraw(size);
    (this as any)._size = size;
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
    const c = this.ctx; c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = this.color; c.lineWidth = this.brush * 2; c.shadowColor = this.color; c.shadowBlur = 10;
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.restore();
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
    for (let i = 0; i <= steps; i++) this.mark(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps);
  }
  private mark(x: number, y: number) {
    const s = 0.5, cx = Math.round(x * s), cy = Math.round(y * s), r = Math.ceil(this.brush * s), tol = r * 2;
    let inside = false;
    for (let dy = -tol; dy <= tol; dy++) for (let dx = -tol; dx <= tol; dx++) {
      const px = cx + dx, py = cy + dy; if (px < 0 || py < 0 || px >= this.mw || py >= this.mh) continue;
      const i = py * this.mw + px;
      if (this.mask[i]) { inside = true; if (dx * dx + dy * dy <= r * r * 1.2 && !this.covered[i]) { this.covered[i] = 1; this.hits++; } }
    }
    if (inside) this.insidePts++; else this.outsidePts++;
  }
  result(): TraceResult {
    const coverage = this.total ? this.hits / this.total : 0;
    const pts = this.insidePts + this.outsidePts;
    const outside = pts ? this.outsidePts / pts : 0;
    return { coverage, outside, pass: coverage >= 0.6 && outside <= 0.45 };
  }
  /** Test hook: trace the glyph programmatically by painting over every mask pixel. */
  autoTrace() {
    for (let y = 0; y < this.mh; y += 2) for (let x = 0; x < this.mw; x += 2) if (this.mask[y * this.mw + x]) this.mark(x / 0.5, y / 0.5);
    this.strokes++; const r = this.result(); if (r.pass) this.done = true; this.onProgress(r);
  }
}
