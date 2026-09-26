/**
 * #740: the stage's motion beats, contact shadow and gloss spot. Its own file, apart from `three.test.ts`, so
 * this and the solids (#684) never edit the same lines.
 */
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, Object3D, type MeshBasicMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { contactShadow, footprint, SHADOW_OPACITY, shadowScale } from '../../src/three/stage/ground';
import { BEAT_SECONDS, BEATS, beatPose, HOP, idleBob, REST } from '../../src/three/stage/motion';
import { addGloss, GLOSS_EDGE, toonMaterial } from '../../src/three/stage/toon';
import { createStand } from '../../src/three/stage/stand';

describe('the stage brings objects to life (#740)', () => {
  it.each(BEATS)('%s starts and ends at rest, keeps its volume, and never jumps between frames', (beat) => {
    const d = BEAT_SECONDS[beat], step = 1 / 120;   // a 120 Hz screen: the finest a child will see it
    expect(beatPose(beat, d), 'ends exactly at rest').toBe(REST);
    expect(beatPose(beat, -0.1)).toBe(REST);
    let prev = beatPose(beat, 0);
    for (let t = step; t < d; t += step) {
      const p = beatPose(beat, t);
      const s = beat === 'pop' ? Math.cbrt(p.sx * p.sx * p.sy) : 1;
      expect(p.sx * p.sx * p.sy, `${beat} at ${t.toFixed(3)}s keeps volume`).toBeCloseTo(s ** 3, 6);
      expect(Math.abs(p.y - prev.y) + Math.abs(p.sy - prev.sy) + Math.abs(p.rz - prev.rz), `${beat} jumps at ${t.toFixed(3)}s`).toBeLessThan(0.12);
      expect(p.y, 'never below the ground').toBeGreaterThanOrEqual(-1e-9);
      prev = p;
    }
    const end = beatPose(beat, d - step);
    expect(Math.abs(end.y) + Math.abs(end.sy - 1) + Math.abs(end.sx - 1) + Math.abs(end.rz), `${beat} lands near rest before it snaps to it`).toBeLessThan(0.08);
  });
  it('pop grows from nothing and overshoots; bounce lifts by HOP; the idle bob stays small', () => {
    expect(beatPose('pop', 0).sy).toBeCloseTo(0);
    const scales = Array.from({ length: 50 }, (_, i) => beatPose('pop', (i / 50) * BEAT_SECONDS.pop)).map(p => Math.cbrt(p.sx * p.sx * p.sy));
    expect(Math.max(...scales), 'the cartoon overshoot').toBeGreaterThan(1.05);
    const lifts = Array.from({ length: 200 }, (_, i) => beatPose('bounce', (i / 200) * BEAT_SECONDS.bounce).y);
    expect(Math.max(...lifts)).toBeCloseTo(HOP, 1);
    for (let t = 0; t < 10; t += 0.05) expect(Math.abs(idleBob(t))).toBeLessThanOrEqual(0.035);
  });
  it('the gloss is one hard spot from the key light, added once to every toon material', () => {
    const shader = { fragmentShader: 'void main() {\n\t#include <opaque_fragment>\n}' };
    addGloss(shader);
    expect(shader.fragmentShader.match(/#include <opaque_fragment>/g), 'the include survives, once').toHaveLength(1);
    expect(shader.fragmentShader).toContain('directionalLights[ 0 ]');
    expect(shader.fragmentShader).toContain(`step( ${GLOSS_EDGE.toFixed(3)}`);
    expect(shader.fragmentShader.indexOf('glossHalf'), 'before the fragment is written').toBeLessThan(shader.fragmentShader.indexOf('#include <opaque_fragment>'));
    expect(toonMaterial('#ff5f6d').onBeforeCompile).toBe(addGloss);
  });
  it('the contact shadow is a flat ink disc under the footprint that shrinks on a hop, never below half', () => {
    const disc = contactShadow('#0d1226');
    const m = disc.material as MeshBasicMaterial;
    expect(m.transparent && !m.depthWrite).toBe(true);
    expect(m.opacity).toBe(SHADOW_OPACITY);
    expect(m.color.getHexString()).toBe('0d1226');
    const box = new Mesh(new BoxGeometry(2, 1, 1));
    box.position.y = 0.5;
    expect(footprint(box)).toEqual({ base: 0, radius: 2 * 0.45 });
    expect(shadowScale(1, 0, HOP)).toBe(1);
    expect(shadowScale(1, HOP, HOP)).toBe(0.5);
    expect(shadowScale(1, HOP * 4, HOP), 'never below half').toBe(0.5);
  });
  it('an object with no mesh geometry stands at the origin instead of Infinity, and says so once (#764)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const empty = new Group();   // Box3().setFromObject() on this is min=+Inf, max=-Inf: no geometry to measure
      expect(footprint(empty)).toEqual({ base: 0, radius: 0 });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/no measurable geometry/);
    } finally { warn.mockRestore(); }
  });
  // A different shape of degenerate box from the empty-Group case above: real, present geometry, but with one
  // non-finite vertex. `Box3.setFromObject()` still catches it — carrying the box through the mesh's identity
  // `matrixWorld` multiplies the infinite coordinate by an exact 0 on the projective-divide row, which is NaN,
  // and NaN spreads to every axis of the transformed box, not just the one the bad vertex is on.
  it('a mesh with one non-finite vertex also stands at the origin, not at Infinity (#764)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const geom = new BufferGeometry();
      geom.setAttribute('position', new Float32BufferAttribute([Infinity, 0, 0, 0, 1, 0, 0, 0, 1], 3));
      const bad = new Mesh(geom);
      expect(footprint(bad)).toEqual({ base: 0, radius: 0 });
      expect(warn).toHaveBeenCalledTimes(1);
    } finally { warn.mockRestore(); }
  });
  // A third shape, found in review (#807): real geometry, no bad vertex, but a non-finite position — a
  // translation is added, not multiplied against the other coordinates, so it only ever moves the axis it's on.
  // min.y stayed finite here while min.x/max.x went to Infinity; a min.y-only guard let this one through.
  it('an object standing at a non-finite position on one axis alone also stands at the origin (#764 review)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const bad = new Mesh(new BoxGeometry(1, 1, 1));
      bad.position.set(Infinity, 0, 0);
      expect(footprint(bad)).toEqual({ base: 0, radius: 0 });
      expect(warn).toHaveBeenCalledTimes(1);
    } finally { warn.mockRestore(); }
  });
});

describe('the stand: where the sketchbook and the game card show an object (#684, #740)', () => {
  it('stands an object on its base, beats it, lands it at rest, and keeps it still without motion', () => {
    const stand = createStand('#0d1226');
    const box = new Mesh(new BoxGeometry(1, 2, 1));
    box.position.y = 0.3;   // its bottom at -0.7
    stand.set(box);
    stand.update(0, true);
    expect(stand.group.position.y, 'the holder sits at the base, the idle bob aside').toBeCloseTo(-0.7, 1);
    expect(stand.shadow.visible).toBe(true);
    expect(stand.lastBeat).toBeNull();
    stand.beat('bounce', 1000);
    stand.update(1000 + BEAT_SECONDS.bounce * 450, true);
    expect(stand.pose, 'mid-bounce').not.toBe(REST);
    expect(stand.lastBeat).toBe('bounce');
    stand.update(1000 + BEAT_SECONDS.bounce * 1000 + 1, true);
    expect(stand.pose, 'landed').toBe(REST);
    stand.beat('cheer', 5000);
    stand.update(5200, false);
    expect(stand.pose, 'without motion no beat plays').toBe(REST);
    expect(stand.group.position.y, 'and no bob either').toBeCloseTo(-0.7, 6);
    stand.set(null);
    expect(stand.shadow.visible, 'nothing shown, no shadow').toBe(false);
    stand.beat('pop', 6000);
    expect(stand.lastBeat, 'nothing shown, nothing to beat').toBe('cheer');
  });
  it('an object with no mesh geometry is stood at the origin, not Infinity (#764)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const stand = createStand('#0d1226');
      stand.set(new Object3D());   // no geometry anywhere under it
      stand.update(0, true);
      expect(Number.isFinite(stand.group.position.y), 'never Infinity').toBe(true);
      expect(stand.group.position.y).toBeCloseTo(0, 6);
    } finally { warn.mockRestore(); }
  });
});
