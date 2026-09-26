/**
 * The sketchbook's canvas: one renderer, the stage rig, an idle turn, the stage's beats and contact shadow
 * (#740), and `ink()` — the read-back the screenshot script uses to refuse a blank frame. Motion obeys
 * `prefers-reduced-motion` through the rig's caller here, as the decision record asks (item 7), not per object:
 * under it nothing turns, bobs or beats.
 */
import type { Object3D } from 'three';
import type { Beat, Pose } from '../stage/motion';
import { createStand } from '../stage/stand';
import { applyTier, createRenderer, createRig, resize, type Rig } from '../stage/rig';
import type { Tier } from '../stage/tiers';
import type { TokenReader } from '../stage/toon';

export interface View {
  /** Swap the shown object; the previous one's geometry is released. */
  set(object: Object3D, tier: Tier): void;
  /** Renders once and counts the pixels that differ from the background: 0 is a blank frame. */
  ink(): number;
  /** Frames drawn so far — the screenshot script waits for this to move before it looks. */
  readonly frames: number;
  readonly tier: Tier;
  /** What the renderer draws at — `min(devicePixelRatio, the tier's cap)`, and it follows a tier change. */
  readonly pixelRatio: number;
  /** Play a stage beat on the shown object; false under reduced motion, where none plays. */
  beat(kind: Beat): boolean;
  /** The pose applied on the last frame — REST between beats (the idle bob is a lift, not a beat). */
  readonly pose: Pose;
  dispose(): void;
}

export const IDLE_TURN = 0.4;   // rad/s — slow, the decision record's "nothing snaps"
/** Radians per CSS pixel of drag, and how far a drag may tip the object towards or away from the camera. */
export const DRAG_TURN = 0.012, MAX_TIP = 0.9;
/** CSS pixels a press may wander and still count as a tap. */
export const TAP_SLOP = 6;

/**
 * A drag's turn (#717, the owner in session: "rotate it by touch"): sideways spins it, up and down tips it,
 * clamped so the object never flips over and hides the side the look pass is judged on. Pure, for a test.
 */
export function dragTurn(rot: { x: number; y: number }, dx: number, dy: number): void {
  rot.y += dx * DRAG_TURN;
  rot.x = Math.max(-MAX_TIP, Math.min(MAX_TIP, rot.x + dy * DRAG_TURN));
}

export function createView(host: HTMLElement, tokens: TokenReader, reducedMotion: boolean, initialTier: Tier, size = () => host.clientWidth || 512): View {
  const canvas = document.createElement('canvas');
  host.replaceChildren(canvas);
  let tier: Tier = initialTier;   // the model's real tier, never a hardcoded one: a `?tier=low` first frame is low (review of #715)
  // `--panel-2`, not `--ink`: the outline is ink, and ink on ink is invisible — the game draws its cards on a panel too.
  let rig: Rig = createRig({ aspect: 1, tier, background: tokens('--panel-2') });
  const renderer = createRenderer(canvas, tier);
  let shown: Object3D | null = null;
  let frames = 0, raf = 0, last = 0;
  // The stage's stand (#740): the object on its base, the shadow under it, the beats. It moves to a new scene
  // when a tier change rebuilds the rig.
  const stand = createStand(tokens('--ink'));
  const place = () => rig.scene.add(stand.group, stand.shadow);
  place();
  const beat = (kind: Beat) => { if (reducedMotion || !shown) return false; stand.beat(kind, performance.now()); return true; };
  // A finger or mouse turns the object; the idle turn waits while it is held, so the two never fight. A press
  // that barely moves is a tap, and a tap bounces it (#740).
  let held: { id: number; x: number; y: number; moved: number } | null = null;
  canvas.style.touchAction = 'none';   // a drag on the canvas turns the object instead of scrolling the page
  canvas.addEventListener('pointerdown', (e) => { held = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!held || e.pointerId !== held.id || !shown) return;
    dragTurn(shown.rotation, e.clientX - held.x, e.clientY - held.y);
    held.moved += Math.abs(e.clientX - held.x) + Math.abs(e.clientY - held.y);
    held.x = e.clientX; held.y = e.clientY;
  });
  const letGo = (e: PointerEvent) => {
    if (held?.id !== e.pointerId) return;
    if (e.type === 'pointerup' && held.moved < TAP_SLOP) beat('bounce');
    held = null;
  };
  canvas.addEventListener('pointerup', letGo); canvas.addEventListener('pointercancel', letGo);

  const fit = () => { const px = size(); resize(rig, renderer, px, px); };
  const release = (o: Object3D) => o.traverse(x => {
    const m = x as { geometry?: { dispose(): void }; material?: { dispose(): void } | { dispose(): void }[] };
    m.geometry?.dispose();
    // Materials are the stage's, shared across hulls, and the stage is rebuilt with the object: safe to drop.
    (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach(mat => mat.dispose());
  });
  const tick = (t: number) => {
    raf = requestAnimationFrame(tick);
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
    if (shown && !reducedMotion && !held) shown.rotation.y += IDLE_TURN * dt;
    stand.update(t, !reducedMotion);
    renderer.render(rig.scene, rig.camera); frames++;
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  ro?.observe(host);
  fit();
  raf = requestAnimationFrame(tick);

  return {
    get frames() { return frames; },
    get tier() { return tier; },
    get pixelRatio() { return renderer.getPixelRatio(); },
    get pose(): Pose { return stand.pose; },
    beat,
    set(object, next) {
      if (shown) release(shown);
      if (next !== tier) {
        tier = next;
        rig = createRig({ aspect: rig.camera.aspect, tier, background: tokens('--panel-2') });
        place();
        applyTier(renderer, tier);   // pixel-ratio cap and shadow map both follow, not the shadow map alone
        fit();
      }
      stand.set(object);
      shown = object;
    },
    ink() {
      renderer.render(rig.scene, rig.camera);
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      // The background is whatever the corner shows; a frame is inked where a pixel leaves it by more than noise.
      let count = 0;
      for (let i = 0; i < px.length; i += 4)
        if (Math.abs(px[i] - px[0]) + Math.abs(px[i + 1] - px[1]) + Math.abs(px[i + 2] - px[2]) > 24) count++;
      return count;
    },
    dispose() {
      cancelAnimationFrame(raf); ro?.disconnect();
      if (shown) release(shown);
      stand.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
