// The one module that imports three.js (#684). Reached only through `import()` from `src/ui/solid.ts`, so
// Vite emits it as its own lazy chunk: the home screen and every non-3-D topic never download it. It imports
// nothing from `src/` on purpose — `scripts/bundle-single.mjs` inlines this chunk as a self-contained data
// URL, and a chunk that reached back into the main chunk could not be. A rail holds both properties.
//
// Geometry is code, not files: every solid is a three.js primitive, coloured from the design-language tokens
// read off `:root` at runtime (so no hex is written here and a palette change reaches the solids too).
import {
  AmbientLight, BoxGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight, EdgesGeometry, Group,
  LineBasicMaterial, LineSegments, Mesh, MeshLambertMaterial, PerspectiveCamera, Scene, SphereGeometry, WebGLRenderer,
  type BufferGeometry,
} from 'three';

export type SolidName = 'cube' | 'cuboid' | 'sphere' | 'cylinder' | 'cone' | 'pyramid';

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
    const spec = SOLIDS[name];
    const geo = spec.geo();
    const group = new Group();
    group.add(new Mesh(geo, new MeshLambertMaterial({ color: token(spec.tint), flatShading: spec.edges })));
    if (spec.edges) group.add(new LineSegments(new EdgesGeometry(geo), new LineBasicMaterial({ color: token('--ink') })));
    if (name === 'pyramid') group.rotation.y = Math.PI / 4;   // a face towards the camera, not a corner
    group.rotation.x = TILT;
    this.mesh = group; this.name = name; this.scene.add(group);
    this.fit(); this.start();
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
    this.mesh.traverse(o => { const m = o as Mesh; m.geometry?.dispose(); (m.material as { dispose?: () => void } | undefined)?.dispose?.(); });
    this.scene.remove(this.mesh); this.mesh = null;
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
