// The #684 spike's solids, moved here verbatim from `src/game/solids.ts` by #714 so that `three` is imported
// under `src/three/` alone (`.claude/rules/three.md`). Reached only through `import()` from `src/ui/solid.ts`,
// so Vite emits it as its own lazy chunk: the home screen and every non-3-D topic never download it. It
// imports nothing from `src/` outside this tree on purpose — `scripts/bundle-single.mjs` inlines this chunk
// as a self-contained data URL, and a chunk that reached back into the main chunk could not be. The rails
// in `tests/unit/guardrails.test.ts` hold both properties.
//
// This is the spike's look, not the stage's: it builds its own Lambert materials and edge lines. It is behind
// both layers of the flag — `src/ui/solid.ts`'s loader asks `threeEnabled()` (`./enabled.ts`) before it
// downloads this chunk, and `VITE_THREE=off` removes it from the build — so with the flag off a child sees the
// emoji, as before #684. #684 rebuilds the solids as stage objects (`src/three/objects/solids/`) and mounts
// them in place of this file, which retires then.
//
// Geometry is code, not files: every solid is a three.js primitive, coloured from the design-language tokens
// read off `:root` at runtime (so no hex is written here and a palette change reaches the solids too).
import {
  AmbientLight, BoxGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight, EdgesGeometry, Group,
  LineBasicMaterial, LineSegments, Mesh, MeshLambertMaterial, PerspectiveCamera, Scene, SphereGeometry, WebGLRenderer,
  WebGLRenderTarget, type BufferGeometry,
} from 'three';

export type SolidName = 'cube' | 'cuboid' | 'sphere' | 'cylinder' | 'cone' | 'pyramid';
/** A white-lit spin sheet as straight-alpha sRGB pixels, `ImageData`'s shape without needing a DOM to build one. */
export interface SpinSheet { width: number; height: number; data: Uint8ClampedArray }
/**
 * One `big`×`big` GL read-back (rows bottom-up, linear light) into a cell of `out` (rows top-down, sRGB, straight
 * alpha), `big / 2` px square at column `x0` of a row `outWidth` px wide. Each output pixel is the mean of a 2×2
 * block, averaged premultiplied so a transparent neighbour does not darken an edge — the anti-aliasing. Pure, so
 * a unit test can hand it a buffer.
 */
export function downsampleInto(read: Uint8Array, big: number, out: Uint8ClampedArray, outWidth: number, x0: number): void {
  const cell = big / 2, rowOut = outWidth * 4;
  for (let y = 0; y < cell; y++) {
    const r0 = (big - 1 - y * 2) * big * 4, r1 = (big - 2 - y * 2) * big * 4;
    for (let x = 0; x < cell; x++) {
      const i = x * 8, o = y * rowOut + (x0 + x) * 4;
      const a = read[r0 + i + 3] + read[r0 + i + 7] + read[r1 + i + 3] + read[r1 + i + 7];
      for (let ch = 0; ch < 3; ch++) {
        const sum = read[r0 + i + ch] * read[r0 + i + 3] + read[r0 + i + 4 + ch] * read[r0 + i + 7]
          + read[r1 + i + ch] * read[r1 + i + 3] + read[r1 + i + 4 + ch] * read[r1 + i + 7];
        out[o + ch] = a ? TO_SRGB[Math.round(sum / a)] : 0;
      }
      out[o + 3] = a / 4;
    }
  }
}
/** A render target holds linear light; the screen shows sRGB. One table, built once, for the encoding. */
const TO_SRGB = Uint8ClampedArray.from({ length: 256 }, (_, i) => {
  const v = i / 255;
  return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
});

/** Each solid: its geometry, the palette token it is painted with, and whether its edges are drawn (polyhedra only). */
const SOLIDS: Record<SolidName, { geo: () => BufferGeometry; tint: string; edges: boolean }> = {
  cube: { geo: () => new BoxGeometry(1.5, 1.5, 1.5), tint: '--accent-2', edges: true },
  cuboid: { geo: () => new BoxGeometry(2.1, 1.1, 1.3), tint: '--accent', edges: true },
  sphere: { geo: () => new SphereGeometry(0.95, 40, 28), tint: '--bad', edges: false },
  cylinder: { geo: () => new CylinderGeometry(0.75, 0.75, 1.7, 48), tint: '--good', edges: false },
  cone: { geo: () => new ConeGeometry(0.9, 1.7, 48), tint: '--accent', edges: false },
  // Four radial segments make a square base; `ConeGeometry` is a pyramid whenever the base is a polygon.
  pyramid: { geo: () => new ConeGeometry(1.15, 1.5, 4), tint: '--accent-2', edges: true },
};
const IDLE_SPIN = 0.55;         // rad/s, slow enough to count faces as it turns
const TILT = 0.42;              // rad, so the top face is always in view — three faces of a cube at once
const DRAG_GAIN = 0.012;        // rad per CSS px dragged

const token = (name: string) => {
  const v = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : '';
  return new Color(v || '#ffffff');
};

/** One solid as a group: the body in `colour`, edge lines in `--ink` on the polyhedra, turned to face the camera. */
function build(name: SolidName, colour: Color): Group {
  const spec = SOLIDS[name];
  const geo = spec.geo();
  const group = new Group();
  group.add(new Mesh(geo, new MeshLambertMaterial({ color: colour, flatShading: spec.edges })));
  if (spec.edges) group.add(new LineSegments(new EdgesGeometry(geo), new LineBasicMaterial({ color: token('--ink') })));
  if (name === 'pyramid') group.rotation.y = Math.PI / 4;   // a face towards the camera, not a corner
  group.rotation.x = TILT;
  return group;
}
const dispose = (g: Group) => g.traverse(o => { const m = o as Mesh; m.geometry?.dispose(); (m.material as { dispose?: () => void } | undefined)?.dispose?.(); });

/**
 * One renderer, one canvas, one solid at a time. `show()` swaps the mesh; `hide()` parks the loop; `destroy()`
 * releases the GL context (a context per play screen would hit the browser's cap after a few play → back →
 * play round trips — the same class of leak the arena teardown rail exists for).
 */
export class SolidView {
  readonly el: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(32, 1, 0.1, 20);
  private mesh: Group | null = null;
  private name: SolidName | null = null;
  private frames = 0;
  private raf = 0; private last = 0;
  private drag: { x: number; y: number; moved: boolean } | null = null;
  private readonly ro: ResizeObserver | null;

  constructor() {
    this.el = document.createElement('div'); this.el.className = 'vis solid';
    this.canvas = document.createElement('canvas'); this.canvas.setAttribute('aria-hidden', 'true');
    this.el.appendChild(this.canvas);
    // Throws when WebGL is unavailable — the caller keeps the emoji and reports `webgl: false`.
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.camera.position.set(0, 0.35, 5.2); this.camera.lookAt(0, 0, 0);
    this.scene.add(new AmbientLight(0xffffff, 1.4));
    const key = new DirectionalLight(0xffffff, 2.2); key.position.set(2.5, 4, 4); this.scene.add(key);
    const fill = new DirectionalLight(0xffffff, 0.6); fill.position.set(-3, -1, 2); this.scene.add(fill);
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onUp);
    this.canvas.addEventListener('click', this.onClick, true);
    this.ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.fit()) : null;
    this.ro?.observe(this.el);
  }
  /** The hook's view of this renderer: null until a solid is shown. */
  get state(): { name: SolidName; frames: number; webgl: true; error: null } | null {
    return this.name ? { name: this.name, frames: this.frames, webgl: true, error: null } : null;
  }
  show(name: SolidName) {
    this.clearMesh();
    const group = build(name, token(SOLIDS[name].tint));
    this.mesh = group; this.name = name; this.scene.add(group);
    this.fit(); this.start();
  }
  /**
   * A spin sheet for the bubbles (#684): `frames` views of `name`, a full turn apart, side by side, `cell` px
   * tall, lit in white so the caller can tint it per bubble colour without another render. Returned as plain
   * pixels, not a canvas: each view is drawn into an off-screen render target at twice the size and read back
   * once, explicitly, then box-filtered down in JS (the anti-aliasing) and encoded to sRGB. The first cut copied
   * the WebGL canvas into 2-D canvases instead, and every later copy out of those forced a GPU read-back — in
   * Chromium's software GL it stalled the page outright. Nothing here touches the card's canvas or its size.
   */
  sheet(name: SolidName, frames: number, cell: number): SpinSheet {
    const big = cell * 2;
    const target = new WebGLRenderTarget(big, big);
    const group = build(name, new Color(0xffffff));
    const base = group.rotation.y;
    const card = this.mesh; if (card) card.visible = false;
    this.scene.add(group);
    const camAspect = this.camera.aspect; this.camera.aspect = 1; this.camera.updateProjectionMatrix();
    const read = new Uint8Array(big * big * 4);
    const out = new Uint8ClampedArray(cell * frames * cell * 4);
    // A throw partway through the loop (render, read-back, or the target allocation above) must still restore
    // the renderer's shared state — the visible card's own tick() keeps rendering into it every frame after.
    try {
      this.renderer.setRenderTarget(target);
      for (let f = 0; f < frames; f++) {
        group.rotation.y = base + (f / frames) * Math.PI * 2;
        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);
        this.renderer.readRenderTargetPixels(target, 0, 0, big, big, read);
        downsampleInto(read, big, out, cell * frames, f * cell);
      }
    } finally {
      this.renderer.setRenderTarget(null);
      this.camera.aspect = camAspect; this.camera.updateProjectionMatrix();
      this.scene.remove(group); dispose(group); target.dispose();
      if (card) card.visible = true;
    }
    return { width: cell * frames, height: cell, data: out };
  }
  hide() { this.stop(); this.clearMesh(); this.name = null; this.el.remove(); }
  destroy() {
    this.hide(); this.ro?.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
    this.canvas.removeEventListener('click', this.onClick, true);
    this.renderer.dispose(); this.renderer.forceContextLoss();
  }
  private clearMesh() {
    if (!this.mesh) return;
    dispose(this.mesh); this.scene.remove(this.mesh); this.mesh = null;
  }
  /** The canvas is CSS-sized (`--solid` in style.css); the drawing buffer follows it at the device ratio. */
  private fit() {
    const px = Math.max(1, Math.round(this.el.clientWidth || 120));
    this.renderer.setSize(px, px, false);
  }
  private start() { if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.tick); } }
  private stop() { if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; } }
  private readonly tick = (t: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = this.last ? Math.min(0.1, (t - this.last) / 1000) : 0; this.last = t;
    if (this.mesh && !this.drag) this.mesh.rotation.y += IDLE_SPIN * dt;
    this.renderer.render(this.scene, this.camera); this.frames++;
  };
  private readonly onDown = (e: PointerEvent) => { this.drag = { x: e.clientX, y: e.clientY, moved: false }; this.canvas.setPointerCapture(e.pointerId); };
  private readonly onMove = (e: PointerEvent) => {
    if (!this.drag || !this.mesh) return;
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) this.drag.moved = true;
    this.mesh.rotation.y += dx * DRAG_GAIN;
    this.mesh.rotation.x = Math.max(-1.3, Math.min(1.3, this.mesh.rotation.x + dy * DRAG_GAIN));
    this.drag.x = e.clientX; this.drag.y = e.clientY;
  };
  private readonly onUp = () => { this.moved = this.drag?.moved ?? false; this.drag = null; };
  // A drag that turned the solid is not a tap on the card (which would read the question again): swallow that click.
  private moved = false;
  private readonly onClick = (e: MouseEvent) => { if (this.moved) { e.stopPropagation(); this.moved = false; } };
}
