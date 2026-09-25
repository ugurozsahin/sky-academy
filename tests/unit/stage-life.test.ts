/**
 * #740: the stage's motion beats, contact shadow and gloss spot. Its own file, apart from `three.test.ts`, so
 * this and the solids (#684) never edit the same lines.
 */
import { BoxGeometry, Mesh, type MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { contactShadow, footprint, SHADOW_OPACITY, shadowScale } from '../../src/three/stage/ground';
import { BEAT_SECONDS, BEATS, beatPose, HOP, idleBob, REST } from '../../src/three/stage/motion';
import { addGloss, GLOSS_EDGE, toonMaterial } from '../../src/three/stage/toon';

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
});
