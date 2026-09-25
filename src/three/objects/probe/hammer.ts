/**
 * The style probe (#717, epic #713): Hammer Man's hammer, the one calibration object built in the sketchbook
 * beside its 2-D avatar (`public/avatars/hammer.webp`) so the owner can pick the stage's two open numbers —
 * the outline width and the tone count — from rendered variants. After his pick those become the constants in
 * `stage/outline.ts` and `stage/toon.ts`, the `outlineWidth`/`tones` params go, and the hammer stays as the
 * sketchbook's reference piece. Not a game object: nothing mounts it.
 *
 * Two parts by material, each merged into one mesh so the hull doubles two draw calls, not five
 * (`three-art` §3): the stone head with its collar, and the wood — shaft, pommel and the ridged grip.
 */
import { Group, LatheGeometry, Mesh, Vector2, type BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { defaultsOf, defineObject, n, type Params } from '../define';

// Sampled from `public/avatars/hammer.webp` (the dominant lit tone of each area): the avatar an object belongs
// to is one of the palette's two sources (decision record 010, item 3), and no design-language token is grey
// or brown. His purple is the scarf's and the cape's; the drawn hammer carries none, so neither does this.
const STONE = '#84848c';   // the head and collar's stone grey
const WOOD = '#845436';    // the shaft and grip's brown

const params = {
  headLength: n(1.5, 1.1, 1.9),
  headHeight: n(0.85, 0.6, 1.1),
  bevel: n(0.12, 0.04, 0.24),
  shaftLength: n(1.7, 1.3, 2.1),
  shaftRadius: n(0.13, 0.09, 0.18),
  grips: n(4, 3, 5),
  tilt: n(0.4, 0, 0.8),
  // The two numbers the probe exists to choose; the stage's provisional constants are the defaults.
  tones: n(3, 2, 3),
  outlineWidth: n(0.045, 0.02, 0.09),
};
type P = Params<typeof params>;
/** A variant: the default shape, at one outline width and tone count — the probe varies nothing else. */
const look = (outlineWidth: number, tones: number): P => ({ ...defaultsOf(params), outlineWidth, tones });

const BURIED = 0.14;   // how far the collar reaches into the head: past `outlineWidth`'s maximum
const RADIAL = 12;   // around every turned part: fewer shows facets in the toon bands, more costs the budget
/** A turned part from its profile, `[radius, height]` from the bottom up; a radius of 0 closes a pole. */
const lathe = (profile: readonly (readonly [number, number])[]) =>
  new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), RADIAL);

/** The wood from the pommel up: a ball at the foot, then a plain shaft whose top hides inside the collar. */
function wood(r: number, bottom: number, top: number): BufferGeometry {
  const pr = r * 1.5, c = bottom + pr;   // the pommel is half again as wide as the shaft, as in the drawing
  const ball = [-90, -55, -20, 15, 50].map((deg): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [pr * Math.cos(a), c + pr * Math.sin(a)];
  });
  return lathe([...ball, [r, c + pr * 1.05], [r, top], [0, top]]);
}

/** The grip: `count` rounded ridges over the lower half of the shaft, creased between — the drawing's bands. */
function grip(r: number, from: number, span: number, count: number): BufferGeometry {
  const h = span / count, ridge = r * 1.28, crease = r * 1.08;
  const profile: [number, number][] = [[r * 0.9, from], [crease, from]];
  for (let i = 0; i < count; i++) profile.push([ridge, from + h * (i + 0.3)], [ridge, from + h * (i + 0.7)], [crease, from + h * (i + 1)]);
  profile.push([r * 0.9, from + span]);
  return lathe(profile);
}

/** The collar: the squat stone socket the shaft enters, rounded at its foot, its top buried in the head deeper
 *  than the thickest outline — or the collar's hull shows through the head's underside as a black crescent. */
function collar(r: number, bottom: number, height: number): BufferGeometry {
  const w = r * 1.75;
  return lathe([[0, bottom], [w * 0.8, bottom], [w, bottom + height * 0.3], [w, bottom + height], [0, bottom + height]]);
}

export const hammer = defineObject({
  name: 'hammer',
  avatar: 'hammer',
  params,
  variants: {
    // A — thin line, three tones: the softest; the object carries its own shading.
    'a-thin-3': look(0.025, 3),
    // B — the stage's provisional values (#714), as a variant so the gallery names it.
    'b-medium-3': look(0.045, 3),
    // C — thick line, two tones: closest to the drawing's heavy ink and flat fields.
    'c-thick-2': look(0.07, 2),
  },
  budget: { triangles: 1950, drawCalls: 4 },   // 1 800 at the defaults; 1 944 with the grip slider at its top
  build(p, stage) {
    const tones = Math.round(p.tones), r = p.shaftRadius;
    const bottom = -p.shaftLength / 2, top = p.shaftLength / 2, collarH = 0.24;

    // A chunky block with eased edges, lying across the top of the shaft; two segments: one gives hard normals the hull splits along.
    const head = new RoundedBoxGeometry(p.headLength, p.headHeight, p.headHeight, 2, p.bevel)
      .translate(0, top + collarH + p.headHeight / 2 - 0.04, 0);
    // `RoundedBoxGeometry` is unindexed and a lathe indexed; a merge needs both one way.
    const stone = mergeGeometries([head, collar(r, top - 0.02, collarH + 0.02 + BURIED).toNonIndexed()]);
    const timber = mergeGeometries([wood(r, bottom, top), grip(r, bottom + r * 3, p.shaftLength * 0.5, Math.round(p.grips))]);

    const hammer = new Group();
    for (const [geometry, colour] of [[stone, STONE], [timber, WOOD]] as const) {
      if (!geometry) throw new Error('hammer: a part failed to merge — its geometries disagree on attributes');
      const mesh = new Mesh(geometry, stage.toon(colour, tones));
      mesh.castShadow = true;
      stage.outline(mesh, p.outlineWidth);
      hammer.add(mesh);
    }
    // Centred on its own middle so the idle turn stays in frame, and turned three-quarters to the key light so
    // the head shows a lit face and a shaded one — a head-on block is one flat tone and says nothing about tones.
    hammer.position.y = -(p.headHeight + collarH) / 2;
    hammer.rotation.y = -0.6;
    const pose = new Group();   // leaning, the way he holds it; the sketchbook's idle turn spins this one
    pose.add(hammer);
    pose.rotation.z = p.tilt;
    return pose;
  },
});
