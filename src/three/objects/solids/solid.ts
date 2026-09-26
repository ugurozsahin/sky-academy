/**
 * The 3-D Shapes solids (#684, epic #713): the factory every solid shares, and the shapes it turns. The
 * curriculum asks a child to count faces, edges and vertices ("identify and describe the properties of 3-D
 * shapes"), and the style asks for chibi volumes with eased edges (decision record 010, item 4) — so each solid
 * keeps its faces flat, and one toon tone each, and rounds only its edges and corners. `bevel` is how far: the
 * owner picked the default, 0.1, from crisp (0.04), default and chunky (0.22) in session on 2026-09-25 (#684),
 * and the other two are gone.
 *
 * Colours are the spike's design-language tokens (`src/three/mount/solids.ts`), so no hex is written here.
 */
import { Group, LatheGeometry, Mesh, SphereGeometry, Vector2, Vector3, type BufferGeometry } from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Measure } from '../../stage';
import { defineObject, n } from '../define';

/** Tipped towards the camera, so the top face is always in view — three faces of a cube at once. */
export const TILT = 0.42;
const RADIAL = 32;   // around a turned solid: fewer shows facets in the toon bands on a curved side

const params = { size: n(1.5, 1, 2), bevel: n(0.1, 0.02, 0.3) };

/** A shape's geometry at `size` (its largest extent, roughly) with edges eased by `bevel`. */
export type Shape = (size: number, bevel: number) => BufferGeometry;

/**
 * One solid: its geometry in one toon colour, the stage's outline, turned by `turn` about its own axis so a
 * face — not a corner — meets the camera, and tilted by `TILT` so the idle turn spins it about its own upright.
 */
export function solid(name: string, colour: `--${string}`, shape: Shape, budget: Measure, turn = 0) {
  return defineObject({
    name,
    avatar: 'kai',   // a solid belongs to no character; the sketchbook shows it beside the player's own
    params,
    variants: {},   // the owner's pick is the defaults; the sliders still reach the range for a later look
    budget,
    build(p, stage) {
      const mesh = new Mesh(shape(p.size, Math.min(p.bevel, p.size / 4)), stage.toon(colour));
      mesh.castShadow = true;
      mesh.rotation.y = turn;
      stage.outline(mesh);
      const group = new Group();
      group.add(mesh);
      group.rotation.x = TILT;
      return group;
    },
  });
}

/** A box `w`×`h`×`d` in units of `size`: flat faces, rounded edges and corners. */
export const boxShape = (w: number, h: number, d: number): Shape => (size, bevel) =>
  new RoundedBoxGeometry(w * size, h * size, d * size, 3, bevel);

/** A quarter-ish arc of `steps` points about `centre`, from angle `from` to `to` (radians), as lathe points. */
function arc(cx: number, cy: number, r: number, from: number, to: number, steps: number): [number, number][] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / steps;
    return [Math.max(0, cx + r * Math.cos(a)), cy + r * Math.sin(a)];
  });
}
const lathe = (profile: [number, number][]) => new LatheGeometry(profile.map(([x, y]) => new Vector2(x, y)), RADIAL);

/** A cylinder: flat discs top and bottom, a straight side, the two rims rounded by `bevel`. */
export const cylinderShape = (radius: number, height: number): Shape => (size, b) => {
  const r = radius * size, h = (height * size) / 2;
  return lathe([[0, -h], ...arc(r - b, -h + b, b, -Math.PI / 2, 0, 4), ...arc(r - b, h - b, b, 0, Math.PI / 2, 4), [0, h]]);
};

/** A cone: a flat disc underneath, a straight slant, the rim rounded by `bevel` and the tip softened. */
export const coneShape = (radius: number, height: number): Shape => (size, b) => {
  const r = radius * size, h = (height * size) / 2;
  const slope = Math.atan2(r, 2 * h);   // how far the slant's outward normal tips up from horizontal
  const tip = b * 0.6;   // the tip's radius: soft, but still a point a child calls a vertex
  return lathe([[0, -h], ...arc(r - b, -h + b, b, -Math.PI / 2, slope, 4),
    ...arc(0, h - tip, tip, slope, Math.PI / 2, 3), [0, h]]);
};

/** A sphere; no edge to ease. `bevel` is ignored — the same params keep every solid's controls alike. */
export const ballShape = (radius: number): Shape => (size) => new SphereGeometry(radius * size, 24, 16);

/**
 * A square-based pyramid with eased edges: the convex hull of small spheres at its five corners (a Minkowski
 * sum). Its five faces stay single flat planes — one toon tone each, countable — and only the rims between them
 * round. `ConvexGeometry` writes a flat normal per triangle, which is what keeps the faces flat.
 */
export const pyramidShape = (half: number, height: number): Shape => (size, b) => {
  const a = half * size - b, h = (height * size) / 2 - b;
  const corners = [new Vector3(a, -h, a), new Vector3(-a, -h, a), new Vector3(a, -h, -a), new Vector3(-a, -h, -a), new Vector3(0, h, 0)];
  const points: Vector3[] = [];
  for (const c of corners) for (const d of SPHERE_DIRS) points.push(c.clone().addScaledVector(d, b));
  return new ConvexGeometry(points);
};

/** Directions spread evenly over a sphere (a Fibonacci lattice): enough that a rounded rim reads as round. */
const DIRS = 40;
const SPHERE_DIRS: Vector3[] = Array.from({ length: DIRS }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / DIRS, r = Math.sqrt(1 - y * y), t = i * Math.PI * (3 - Math.sqrt(5));
  return new Vector3(r * Math.cos(t), y, r * Math.sin(t));
});
