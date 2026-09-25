/**
 * The thick black outline (decision record 010, item 1): an inverted hull — a back-face copy of the mesh
 * pushed out along its normals in flat ink. No post-processing pass: the hull is one extra draw call and
 * needs no render target, which is what lets the `low` tier keep it. Width is one stage constant, chosen
 * by the style probe (#717); objects never pass their own.
 */
import { BackSide, Mesh, MeshBasicMaterial, type ColorRepresentation, type WebGLProgramParametersWithUniforms } from 'three';

/** Hull offset along the normal, in scene units. Chosen by the owner from the style probe: variant B (#717, PR #734). */
export const OUTLINE_WIDTH = 0.045;
export const OUTLINE_NAME = 'outline';

/**
 * Pushes every vertex out along its normal by `width`, in the vertex shader — so a long shaft gets the same
 * thickness as a sphere, which a uniform scale-up would not give it. `normal` is an attribute every three.js
 * vertex program declares, so this needs nothing `MeshBasicMaterial` does not already have. Exported so a
 * test can hand it a plain shader object: `onBeforeCompile` itself only runs inside a renderer.
 */
export function offsetAlongNormals(shader: Pick<WebGLProgramParametersWithUniforms, 'uniforms' | 'vertexShader'>, width: number): void {
  shader.uniforms.outlineWidth = { value: width };
  shader.vertexShader = `uniform float outlineWidth;\n${shader.vertexShader}`
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed += normal * outlineWidth;');
}

export function outlineMaterial(ink: ColorRepresentation, width = OUTLINE_WIDTH): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ color: ink, side: BackSide });
  m.onBeforeCompile = (shader) => offsetAlongNormals(shader, width);
  return m;
}

/**
 * The hull for `mesh`: shares its geometry (no copy of the vertices), added as a child so it follows every
 * transform, and named so a budget count or a sketchbook toggle can find it. Returns the hull.
 */
export function outline(mesh: Mesh, material: MeshBasicMaterial): Mesh {
  const hull = new Mesh(mesh.geometry, material);
  hull.name = OUTLINE_NAME;
  hull.castShadow = false; hull.receiveShadow = false;
  mesh.add(hull);
  return hull;
}
