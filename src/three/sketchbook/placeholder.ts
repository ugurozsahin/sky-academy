/**
 * The one object the sketchbook always has: a rounded tile in the stage's own style, so the page proves the
 * rig, the toon material and the outline on a checkout with no approved object yet. Not art, not registered
 * in `../objects` — it is the sketchbook's, and the first real object (#684) sits beside it, not in its place.
 * Built to the `three-art` contract all the same, so the contract is exercised from day one.
 */
import { Mesh } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { defineObject, n } from '../objects';

export const placeholder = defineObject({
  name: 'placeholder',
  avatar: 'kai',
  params: { size: n(1.6, 0.8, 2.4), radius: n(0.25, 0, 0.6) },
  variants: { sharp: { size: 1.6, radius: 0.02 }, pebble: { size: 1.8, radius: 0.6 } },
  budget: { triangles: 1200, drawCalls: 2 },
  build(p, stage) {
    const tile = new Mesh(new RoundedBoxGeometry(p.size, p.size, p.size, 3, p.radius), stage.toon('--accent-2'));
    stage.outline(tile);
    return tile;
  },
});
