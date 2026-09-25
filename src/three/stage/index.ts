/**
 * The stage an object is built on (`.claude/skills/three-art/SKILL.md` §1): the material factories bound to
 * the palette and the outline width, so every object looks like every other — the stage owns the look
 * (`docs/decisions/010-3d-art-is-the-avatars-style.md`, Consequences). Objects receive a `Stage`; they never
 * construct a material, a light or a renderer of their own.
 */
import { Color, InstancedMesh, Mesh, type ColorRepresentation, type MeshToonMaterial, type Object3D } from 'three';
import { outline, outlineMaterial, OUTLINE_NAME } from './outline';
import { type Tier } from './tiers';
import { tokenColour, toonMaterial, type TokenReader } from './toon';

export interface Stage {
  readonly tier: Tier;
  /** The outline's ink and the rig's background: `--ink`. */
  readonly ink: Color;
  /** A cel-shaded material in `colour`: a design-language token (`'--accent'`), an avatar's `glow`, or any three.js colour. */
  toon(colour: ColorRepresentation): MeshToonMaterial;
  /** The inverted-hull outline for `mesh`, at the stage's one width; returns the hull, already a child of `mesh`. */
  outline(mesh: Mesh): Mesh;
}

export function createStage(tier: Tier, tokens: TokenReader): Stage {
  const ink = tokenColour('--ink', tokens);
  const hull = outlineMaterial(ink);   // one material for every hull on the stage: one draw-call state, one width
  return {
    tier,
    ink,
    toon: (colour) => toonMaterial(typeof colour === 'string' && colour.startsWith('--') ? tokenColour(colour as `--${string}`, tokens) : colour),
    outline: (mesh) => outline(mesh, hull),
  };
}

/** What the budget rail counts (`three-art` §3): triangles across every mesh, instances multiplied, and one draw
 *  call per material on anything drawn — meshes, hulls, lines, points and sprites alike. */
export interface Measure { triangles: number; drawCalls: number }

export function measure(root: Object3D): Measure {
  let triangles = 0, drawCalls = 0;
  root.traverse((o) => {
    const material = (o as { material?: unknown }).material;
    if (!material) return;   // a Group, a light, a camera: nothing drawn
    drawCalls += Array.isArray(material) ? material.length : 1;
    if (!(o instanceof Mesh)) return;   // a line, points or a sprite has a call and no triangles to count
    const g = o.geometry, pos = g.getAttribute('position');
    if (!pos) throw new Error(`${o.name || o.type} has a geometry with no position attribute — nothing to count`);
    const verts = g.index ? g.index.count : pos.count;
    triangles += Math.floor(verts / 3) * (o instanceof InstancedMesh ? o.count : 1);
  });
  return { triangles, drawCalls };
}

/** The hulls under `root`, for a sketchbook toggle or a count. */
export const hullsOf = (root: Object3D): Mesh[] => {
  const out: Mesh[] = [];
  root.traverse((o) => { if (o instanceof Mesh && o.name === OUTLINE_NAME) out.push(o); });
  return out;
};

