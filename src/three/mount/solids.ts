// The 3-D Shapes solids in the game (#684): the stage objects of `src/three/objects/solids/`, the owner's pick
// (PR #738, bevel 0.1 in PR #745), on the question card and baked into spin sheets for the answer bubbles. It
// replaced the spike that lived here, which drew its own Lambert solids with its own lights: now the card and
// the bubbles are in the avatars' toon style (decision record 010), stand on the stage's contact shadow, pop
// in with each question and cheer on a right answer (#740).
//
// Reached only through `import()` from `src/ui/solid.ts`, and only when `threeEnabled()` says yes (#753): with
// the flag off a child sees the emoji, the game as it was before #684. So this module is its own lazy chunk,
// and it imports nothing from `src/` outside this tree — `scripts/bundle-single.mjs` inlines the chunk as a
// self-contained data URL, which a chunk reaching back into the main chunk could not be. The six solids are
// imported one by one, not through the objects registry, so the sketchbook's hammer never ships in the game.
import { WebGLRenderTarget, type Mesh, type MeshToonMaterial, type Object3D } from 'three';
import { defaultsOf, type ObjectSpec } from '../objects/define';
import { cone } from '../objects/solids/cone';
import { cube } from '../objects/solids/cube';
import { cuboid } from '../objects/solids/cuboid';
import { cylinder } from '../objects/solids/cylinder';
import { pyramid } from '../objects/solids/pyramid';
import { sphere } from '../objects/solids/sphere';
import { createStage } from '../stage';
import type { Beat } from '../stage/motion';
import { OUTLINE_NAME } from '../stage/outline';
import { createRenderer, createRig, type Rig } from '../stage/rig';
import { createStand, type Stand } from '../stage/stand';
import { pickTier, readTierEnv, type Tier } from '../stage/tiers';
import { cssTokens, tokenColour } from '../stage/toon';

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

/** Each solid is the stage object of the same name, built at its defaults — the look the owner approved. */
const SOLIDS: Readonly<Record<SolidName, ObjectSpec>> = { cube, cuboid, sphere, cylinder, cone, pyramid };
const IDLE_SPIN = 0.55;         // rad/s, slow enough to count faces as it turns
const DRAG_GAIN = 0.012;        // rad per CSS px dragged
const MAX_TIP = 1.3;            // how far a drag may tip it, either way

const build = (name: SolidName, tier: Tier): Object3D => {
  const o = SOLIDS[name];
  return o.build(defaultsOf(o.params), createStage(tier, cssTokens));
};
/** For a spin sheet: every body white, so the caller tints the sheet per bubble colour; the ink outline stays ink. */
const whiten = (root: Object3D) => root.traverse((o) => {
  const m = o as Mesh;
  if (m.isMesh && m.name !== OUTLINE_NAME) (m.material as MeshToonMaterial).color.set(0xffffff);
});
const dispose = (root: Object3D) => root.traverse((o) => {
  const m = o as Mesh; m.geometry?.dispose();
  const mat = m.material; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach(x => x.dispose());
});

/**
 * One renderer, one canvas, one solid at a time. `show()` swaps the solid; `hide()` parks the loop; `destroy()`
 * releases the GL context (a context per play screen would hit the browser's cap after a few play → back →
 * play round trips — the same class of leak the arena teardown rail exists for).
 */
export class SolidView {
  readonly el: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly tier: Tier = pickTier(readTierEnv());
  private readonly renderer;
  private readonly rig: Rig;
  private readonly stand: Stand;
  private object: Object3D | null = null;
  private name: SolidName | null = null;
  private frames = 0;
  private raf = 0; private last = 0;
  private drag: { x: number; y: number; moved: boolean } | null = null;
  private moved = false;
  private readonly ro: ResizeObserver | null;

  constructor() {
    this.el = document.createElement('div'); this.el.className = 'vis solid';
    this.canvas = document.createElement('canvas'); this.canvas.setAttribute('aria-hidden', 'true');
    this.el.appendChild(this.canvas);
    // Throws when WebGL is unavailable — the caller keeps the emoji and reports `webgl: false`.
    this.renderer = createRenderer(this.canvas, this.tier);
    // Nothing on the card can receive a cast shadow — the stand's contact shadow is the one it shows — so no
    // shadow map is rendered, whatever the tier allows.
    this.renderer.shadowMap.enabled = false;
    this.rig = createRig({ aspect: 1, tier: this.tier, background: null });   // transparent: the card shows through
    this.rig.camera.position.set(0, 0.9, 5.6); this.rig.camera.lookAt(0, -0.1, 0);   // closer than the sketchbook's: the card is small
    this.stand = createStand(tokenColour('--ink', cssTokens));
    this.rig.scene.add(this.stand.group, this.stand.shadow);
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onUp);
    this.canvas.addEventListener('click', this.onClick, true);
    this.ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.fit()) : null;
    this.ro?.observe(this.el);
  }
  /** The hook's view of this renderer: null until a solid is shown. `beat` is the last one played (#740). */
  get state(): { name: SolidName; frames: number; webgl: true; error: null; beat: Beat | null } | null {
    return this.name ? { name: this.name, frames: this.frames, webgl: true, error: null, beat: this.stand.lastBeat } : null;
  }
  /** Stands `name` on the card, and it pops in. */
  show(name: SolidName) {
    this.clear();
    this.object = build(name, this.tier); this.name = name;
    this.stand.set(this.object);
    this.fit(); this.start();
    this.stand.beat('pop', performance.now());
  }
  /** Plays a beat on the solid shown — `cheer` when the child answers right. Nothing shown, nothing plays. */
  beat(kind: Beat) { if (this.object) this.stand.beat(kind, performance.now()); }
  /**
   * A spin sheet for the bubbles (#684): `frames` views of `name`, a full turn apart, side by side, `cell` px
   * tall, the body white so the caller can tint it per bubble colour without another render, the outline ink.
   * Returned as plain pixels, not a canvas: each view is drawn into an off-screen render target at twice the
   * size and read back once, explicitly, then box-filtered down in JS (the anti-aliasing) and encoded to sRGB.
   * Copying the WebGL canvas into 2-D canvases instead made every later copy out of them force a GPU read-back —
   * in Chromium's software GL it stalled the page outright. Nothing here touches the card's canvas or its size.
   */
  sheet(name: SolidName, frames: number, cell: number): SpinSheet {
    const big = cell * 2;
    const target = new WebGLRenderTarget(big, big);
    const solid = build(name, this.tier);
    whiten(solid);
    const base = solid.rotation.y;
    const { group: card, shadow } = this.stand;
    card.visible = false; shadow.visible = false;
    this.rig.scene.add(solid);
    const camera = this.rig.camera, camAspect = camera.aspect;
    camera.aspect = 1; camera.updateProjectionMatrix();
    const read = new Uint8Array(big * big * 4);
    const out = new Uint8ClampedArray(cell * frames * cell * 4);
    // A throw partway through the loop (render, read-back, or the target allocation above) must still restore
    // the renderer's shared state — the visible card's own tick() keeps rendering into it every frame after.
    try {
      this.renderer.setRenderTarget(target);
      for (let f = 0; f < frames; f++) {
        solid.rotation.y = base + (f / frames) * Math.PI * 2;
        this.renderer.clear();
        this.renderer.render(this.rig.scene, camera);
        this.renderer.readRenderTargetPixels(target, 0, 0, big, big, read);
        downsampleInto(read, big, out, cell * frames, f * cell);
      }
    } finally {
      this.renderer.setRenderTarget(null);
      camera.aspect = camAspect; camera.updateProjectionMatrix();
      this.rig.scene.remove(solid); dispose(solid); target.dispose();
      card.visible = true; shadow.visible = !!this.object;
    }
    return { width: cell * frames, height: cell, data: out };
  }
  hide() { this.stop(); this.clear(); this.name = null; this.el.remove(); }
  destroy() {
    this.hide(); this.ro?.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
    this.canvas.removeEventListener('click', this.onClick, true);
    this.stand.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss();
  }
  private clear() {
    if (!this.object) return;
    this.stand.set(null); dispose(this.object); this.object = null;
  }
  /** The canvas is CSS-sized (`--solid` in style.css); the drawing buffer follows it at the device ratio. */
  private fit() {
    const px = Math.max(1, Math.round(this.el.clientWidth || 120));
    this.renderer.setSize(px, px, false);
  }
  private start() { if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.tick); } }
  private stop() { if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; } }
  // Motion is always allowed here: under `prefers-reduced-motion` `threeEnabled()` is false and no view exists.
  private readonly tick = (t: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = this.last ? Math.min(0.1, (t - this.last) / 1000) : 0; this.last = t;
    if (this.object && !this.drag) this.object.rotation.y += IDLE_SPIN * dt;
    this.stand.update(t, true);
    this.renderer.render(this.rig.scene, this.rig.camera); this.frames++;
  };
  private readonly onDown = (e: PointerEvent) => { this.drag = { x: e.clientX, y: e.clientY, moved: false }; this.canvas.setPointerCapture(e.pointerId); };
  private readonly onMove = (e: PointerEvent) => {
    if (!this.drag || !this.object) return;
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) this.drag.moved = true;
    this.object.rotation.y += dx * DRAG_GAIN;
    this.object.rotation.x = Math.max(-MAX_TIP, Math.min(MAX_TIP, this.object.rotation.x + dy * DRAG_GAIN));
    this.drag.x = e.clientX; this.drag.y = e.clientY;
  };
  private readonly onUp = () => { this.moved = this.drag?.moved ?? false; this.drag = null; };
  // A drag that turned the solid is not a tap on the card (which would read the question again): swallow that click.
  private readonly onClick = (e: MouseEvent) => { if (this.moved) { e.stopPropagation(); this.moved = false; } };
}
