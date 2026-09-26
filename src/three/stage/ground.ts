/**
 * The contact shadow (#740): a flat, hard-edged disc in `--ink` under an object, so it stands on something
 * instead of floating like a sticker. Hard-edged because the style is flat fields, not gradients (decision
 * record 010, items 2–3). One draw call and no shadow map, so the `low` tier keeps it. It belongs to whoever
 * shows the object — the sketchbook's view, the game's mount — never to the object, and it is not counted in
 * an object's budget.
 */
import { Box3, CircleGeometry, Mesh, MeshBasicMaterial, Vector3, type ColorRepresentation, type Object3D } from 'three';

export const SHADOW_NAME = 'contact-shadow';
export const SHADOW_OPACITY = 0.3;
/** How much of the object's footprint the disc covers: a little under, so it reads as contact, not a plate. */
export const SHADOW_SPREAD = 0.45;

/**
 * Where `object` stands and how wide: the bottom of its bounding box and the larger of its two ground extents.
 * An object with no mesh geometry gives `Box3` an empty box (`min=+Inf, max=-Inf`) rather than a real extent, and
 * a mesh with a genuinely non-finite vertex fares no better: `Box3.setFromObject()` carries the box through the
 * object's `matrixWorld` (`Box3.applyMatrix4`), whose affine row multiplies the infinite coordinate by an exact
 * `0` on the way to a homogeneous divide — `0 * Infinity` is `NaN`, and it poisons every axis, not just the
 * offending one. `min.y` alone catches both shapes. Every registered solid always has real, finite geometry, but
 * a future malformed `ObjectSpec` would otherwise stand at `Infinity` (or NaN) with nothing thrown, the silent
 * kind of bug this stage exists to avoid (#764).
 */
export function footprint(object: Object3D): { base: number; radius: number } {
  const box = new Box3().setFromObject(object);
  if (!Number.isFinite(box.min.y)) {
    console.warn('footprint(): object has no measurable geometry; standing it at the origin instead of Infinity');
    return { base: 0, radius: 0 };
  }
  const size = box.getSize(new Vector3());
  return { base: box.min.y, radius: Math.max(size.x, size.z) * SHADOW_SPREAD };
}

/** A unit disc lying flat, drawn before the object and never hiding it; scale it to the footprint's radius. */
export function contactShadow(ink: ColorRepresentation): Mesh {
  const disc = new Mesh(new CircleGeometry(1, 40), new MeshBasicMaterial({ color: ink, transparent: true, opacity: SHADOW_OPACITY, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  disc.name = SHADOW_NAME;
  disc.renderOrder = -1;
  return disc;
}

/** The disc's scale while the object is `lift` units off the ground: a hop shrinks it, never below half. */
export const shadowScale = (radius: number, lift: number, hop: number) => radius * Math.max(0.5, 1 - 0.5 * (lift / hop));
