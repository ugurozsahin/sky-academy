/**
 * #714: the 3-D flag, the stage and the objects registry — every layer of `threeEnabled()` on its own, the
 * stage's material factories in Node (three.js geometry and materials need no renderer), and the one key the
 * grown-ups screen writes and the mount reads without sharing a module.
 */
import { BackSide, BoxGeometry, BufferGeometry, Color, HemisphereLight, InstancedMesh, LineSegments, Mesh, MeshToonMaterial, NearestFilter, Scene, SphereGeometry, Sprite, Vector3, type Object3D } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SHAPES_3D } from '../../src/curriculum/util';
import { setThreeSetting, threeSetting, THREE_SETTINGS } from '../../src/storage';
import { BUDGET_CEILING, defaultsOf, defineObject, n, OBJECTS } from '../../src/three/objects';
import { createStage, hullsOf, measure } from '../../src/three/stage';
import { offsetAlongNormals, outline, outlineMaterial, OUTLINE_NAME, OUTLINE_WIDTH } from '../../src/three/stage/outline';
import { applyTier, CAMERA_FOV, createRig, resize, type TierTarget } from '../../src/three/stage/rig';
import { LOW_TIER_CORES, LOW_TIER_MEMORY, pickTier, readTierEnv, TIERS } from '../../src/three/stage/tiers';
import { gradientMap, tokenColour, toonMaterial, TONES } from '../../src/three/stage/toon';
import { capable, MIN_DEVICE_MEMORY, parseSetting, probeWebgl2, queryOff, readEnv, resetProbe, threeEnabled, THREE_SETTING_KEY, type BrowserLike, type ThreeEnv } from '../../src/three/mount/enabled';

// The same localStorage shim tests/unit/storage.test.ts uses.
const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

const ok: ThreeEnv = { built: true, search: '', setting: 'auto', webgl2: true, deviceMemory: 8, reducedMotion: false };

describe('threeEnabled — one decision, four layers (#713 decision 2)', () => {
  it('is on for a capable device with nothing set', () => { expect(threeEnabled(ok)).toBe(true); });
  it('the build-time switch wins over everything', () => { expect(threeEnabled({ ...ok, built: false, setting: 'on' })).toBe(false); });
  it('?three=off wins over the grown-up setting, and only `off` is a word the query knows', () => {
    expect(threeEnabled({ ...ok, search: '?three=off', setting: 'on' })).toBe(false);
    expect(threeEnabled({ ...ok, search: '?fast=4&three=off' })).toBe(false);
    expect(threeEnabled({ ...ok, search: '?three=on', deviceMemory: 1 })).toBe(false);   // not an override the other way: auto still decides
    expect(queryOff('?three=off')).toBe(true); expect(queryOff('')).toBe(false); expect(queryOff('?three=OFF')).toBe(false);
  });
  it('the grown-up setting: off is off, on overrules memory and motion but never a missing WebGL2', () => {
    expect(threeEnabled({ ...ok, setting: 'off' })).toBe(false);
    expect(threeEnabled({ ...ok, setting: 'on', deviceMemory: 0.5, reducedMotion: true })).toBe(true);
    expect(threeEnabled({ ...ok, setting: 'on', webgl2: false })).toBe(false);
  });
  it('auto is the device gate: WebGL2, enough memory where the browser says, and no reduced-motion preference', () => {
    expect(capable(ok)).toBe(true);
    expect(capable({ ...ok, webgl2: false })).toBe(false);
    expect(capable({ ...ok, reducedMotion: true })).toBe(false);
    expect(capable({ ...ok, deviceMemory: MIN_DEVICE_MEMORY - 0.5 })).toBe(false);
    expect(capable({ ...ok, deviceMemory: MIN_DEVICE_MEMORY })).toBe(true);
    expect(capable({ ...ok, deviceMemory: null }), 'Safari exposes no deviceMemory; that is not a low-end device').toBe(true);
    expect(threeEnabled({ ...ok, deviceMemory: 1 })).toBe(false);
  });
  it('parseSetting reads on/off and treats everything else as auto', () => {
    expect(parseSetting('on')).toBe('on'); expect(parseSetting('off')).toBe('off');
    for (const raw of [null, undefined, '', 'auto', 'ON', 'yes', 1, {}]) expect(parseSetting(raw)).toBe('auto');
  });
});

describe('readEnv — the only place the browser is read', () => {
  beforeEach(() => { resetProbe(); localStorage.clear(); });
  const lose = vi.fn(), getContext = vi.fn(() => gl);
  const gl = { getExtension: (name: string) => name === 'WEBGL_lose_context' ? { loseContext: lose } : null };
  const browser = (over: Partial<BrowserLike> = {}): BrowserLike => ({
    location: { search: '?fast=4' },
    localStorage,
    navigator: { deviceMemory: 4 },
    matchMedia: (q) => ({ matches: q.includes('reduced-motion') }),
    document: { createElement: () => ({ getContext }) },
    ...over,
  });
  it('reads every layer off the page', () => {
    localStorage.setItem(THREE_SETTING_KEY, 'on');
    expect(readEnv(browser())).toEqual({ built: true, search: '?fast=4', setting: 'on', webgl2: true, deviceMemory: 4, reducedMotion: true });
  });
  it('releases the probe context at once and asks only once per page', () => {
    lose.mockClear();
    const b = browser();
    expect(probeWebgl2(b)).toBe(true); expect(probeWebgl2(b)).toBe(true);
    expect(lose).toHaveBeenCalledTimes(1);
  });
  it('does not create a context when ?three=off or the setting is off already says no — the hatch must not poke a stuck GPU', () => {
    getContext.mockClear();
    expect(readEnv(browser({ location: { search: '?three=off' } }))).toMatchObject({ search: '?three=off', webgl2: false });
    localStorage.setItem(THREE_SETTING_KEY, 'off');
    expect(readEnv(browser())).toMatchObject({ setting: 'off', webgl2: false });
    expect(getContext).not.toHaveBeenCalled();
    localStorage.clear();
    expect(readEnv(browser()).webgl2).toBe(true);
    expect(getContext).toHaveBeenCalledTimes(1);
  });
  it('no WebGL2 context, a throwing canvas, or no document at all all read as no WebGL2, and say so once in the console', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(readEnv(browser({ document: { createElement: () => ({ getContext: () => null }) } })).webgl2).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1); expect(warn.mock.calls[0][0]).toMatch(/no WebGL2 context/);
      expect(readEnv(browser({ document: { createElement: () => ({ getContext: () => null }) } })).webgl2).toBe(false);
      expect(warn, 'memoised: one line per page, not one per ask').toHaveBeenCalledTimes(1);
      resetProbe();
      expect(readEnv(browser({ document: { createElement: () => { throw new Error('no canvas'); } } })).webgl2).toBe(false);
      expect(warn.mock.calls[1][0]).toMatch(/the probe threw: Error: no canvas/);
      resetProbe();
      expect(readEnv(browser({ document: undefined })).webgl2).toBe(false);
    } finally { warn.mockRestore(); }
  });
  it('a browser without the hints reads as: no memory figure, no reduced motion, auto', () => {
    const env = readEnv(browser({ navigator: {}, matchMedia: undefined, localStorage: undefined, location: undefined }));
    expect(env).toMatchObject({ search: '', setting: 'auto', deviceMemory: null, reducedMotion: false });
  });
  it('a blocked localStorage reads as auto rather than throwing', () => {
    expect(readEnv(browser({ localStorage: { getItem: () => { throw new Error('blocked'); } } })).setting).toBe('auto');
  });
  it('the key src/storage.ts writes is the key the mount reads — two spellings, one slot', () => {
    setThreeSetting('off');
    expect(readEnv(browser()).setting).toBe('off');
    setThreeSetting('on');
    expect(readEnv(browser()).setting).toBe('on');
    setThreeSetting('auto');
    expect(localStorage.getItem(THREE_SETTING_KEY), 'auto is the absence of a value').toBeNull();
    expect(readEnv(browser()).setting).toBe('auto');
  });
});

describe('storage: the grown-ups 3-D setting (#714)', () => {
  beforeEach(() => localStorage.clear());
  it('defaults to auto, round-trips on and off, and survives a nonsense value', () => {
    expect(threeSetting()).toBe('auto');
    for (const v of THREE_SETTINGS) { expect(setThreeSetting(v)).toBe(true); expect(threeSetting()).toBe(v); }
    localStorage.setItem('sna:three', 'maybe');
    expect(threeSetting()).toBe('auto');
  });
  it('a refused write leaves the previous answer standing and says so, so the control paints the store, not the tap', () => {
    setThreeSetting('off');
    const real = { set: localStorage.setItem, remove: localStorage.removeItem };
    (localStorage as any).setItem = () => { throw new Error('QuotaExceededError'); };
    (localStorage as any).removeItem = () => { throw new Error('SecurityError'); };
    try {
      expect(setThreeSetting('on')).toBe(false);
      expect(setThreeSetting('auto'), 'clearing the slot can be refused too').toBe(false);
      expect(threeSetting()).toBe('off');
      expect(setThreeSetting('off'), 'asking for what is already stored is a success').toBe(true);
    } finally { (localStorage as any).setItem = real.set; (localStorage as any).removeItem = real.remove; }
  });
});

describe('tiers — the stage\'s cost question, separate from the flag', () => {
  it('low keeps the look and drops what costs a render target or a shadow map', () => {
    expect(TIERS.low).toMatchObject({ shadows: false, bloom: false });
    expect(TIERS.high).toMatchObject({ shadows: true, bloom: true });
    expect(TIERS.low.maxPixelRatio).toBeLessThan(TIERS.high.maxPixelRatio);
  });
  it('picks low on little memory or few cores, high otherwise, and high where a browser says nothing', () => {
    expect(pickTier({ deviceMemory: LOW_TIER_MEMORY - 1, hardwareConcurrency: 8 })).toBe('low');
    expect(pickTier({ deviceMemory: 8, hardwareConcurrency: LOW_TIER_CORES - 1 })).toBe('low');
    expect(pickTier({ deviceMemory: LOW_TIER_MEMORY, hardwareConcurrency: LOW_TIER_CORES })).toBe('high');
    expect(pickTier({ deviceMemory: null, hardwareConcurrency: null })).toBe('high');
    expect(readTierEnv({ deviceMemory: 2, hardwareConcurrency: 4 })).toEqual({ deviceMemory: 2, hardwareConcurrency: 4 });
    expect(readTierEnv({})).toEqual({ deviceMemory: null, hardwareConcurrency: null });
  });
});

describe('toon — one gradient map, materials only from here', () => {
  it('the gradient map has TONES equal steps from black to white, nearest-filtered, and is shared', () => {
    const map = gradientMap();
    expect(map.image.width).toBe(TONES); expect(map.image.height).toBe(1);
    expect([...(map.image.data as Uint8Array)]).toEqual([0, 128, 255]);
    expect(map.minFilter).toBe(NearestFilter); expect(map.magFilter).toBe(NearestFilter);
    expect(gradientMap(), 'cached: one texture serves every material').toBe(map);
    expect([...(gradientMap(2).image.data as Uint8Array)]).toEqual([0, 255]);
    expect(() => gradientMap(1)).toThrow(/two steps/);
  });
  it('toonMaterial is a MeshToonMaterial in the colour, over the shared map', () => {
    const m = toonMaterial('#ff5f6d');
    expect(m).toBeInstanceOf(MeshToonMaterial);
    expect(m.color.getHexString()).toBe('ff5f6d');
    expect(m.gradientMap).toBe(gradientMap());
  });
  it('tokenColour reads a design-language token and refuses a blank one rather than painting white', () => {
    const read = (name: string) => ({ '--ink': '#0d1226', '--accent': ' #ffb020 ' } as Record<string, string>)[name] ?? '';
    expect(tokenColour('--ink', read).getHexString()).toBe('0d1226');
    expect(tokenColour('--accent', read).getHexString()).toBe('ffb020');
    expect(() => tokenColour('--nope', read)).toThrow(/--nope/);
  });
});

describe('outline — the inverted hull', () => {
  it('pushes vertices out along the normal in the vertex shader, by one stage-wide width', () => {
    const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: 'void main() {\n#include <begin_vertex>\n}' };
    offsetAlongNormals(shader, 0.05);
    expect(shader.uniforms.outlineWidth).toEqual({ value: 0.05 });
    expect(shader.vertexShader).toMatch(/^uniform float outlineWidth;/);
    expect(shader.vertexShader).toContain('#include <begin_vertex>\n\ttransformed += normal * outlineWidth;');
    expect(OUTLINE_WIDTH).toBeGreaterThan(0);
  });
  it('the hull shares the geometry, faces backwards in ink, casts no shadow, and follows the mesh as its child', () => {
    const ink = outlineMaterial('#0d1226');
    expect(ink.side).toBe(BackSide);
    expect(ink.color.getHexString()).toBe('0d1226');
    const mesh = new Mesh(new SphereGeometry(1, 8, 6), toonMaterial('#66e07d'));
    const hull = outline(mesh, ink);
    expect(hull.parent).toBe(mesh);
    expect(hull.geometry).toBe(mesh.geometry);
    expect(hull.material).toBe(ink);
    expect(hull.name).toBe(OUTLINE_NAME);
    expect(hull.castShadow).toBe(false);
  });
});

describe('rig — camera, lights and background', () => {
  it('has one key, one rim and one hemisphere fill, no more, and the key shadows only on high', () => {
    const rig = createRig({ aspect: 1.5, tier: 'high', background: '#0d1226' });
    expect(rig.scene).toBeInstanceOf(Scene);
    expect(rig.scene.children).toHaveLength(3);
    expect(rig.fill).toBeInstanceOf(HemisphereLight);
    expect(rig.key.castShadow).toBe(true);
    expect(createRig({ aspect: 1, tier: 'low', background: '#0d1226' }).key.castShadow).toBe(false);
    expect(rig.camera.fov).toBe(CAMERA_FOV); expect(rig.camera.aspect).toBe(1.5);
    expect((rig.scene.background as Color).getHexString()).toBe('0d1226');
    expect(createRig({ aspect: 1, tier: 'low', background: null }).scene.background).toBeNull();
  });
  it('resize sizes the buffer without touching the CSS size, and the camera follows', () => {
    const rig = createRig({ aspect: 1, tier: 'low', background: null });
    const setSize = vi.fn();
    resize(rig, { setSize } as any, 300.4, 150);
    expect(setSize).toHaveBeenCalledWith(300, 150, false);
    expect(rig.camera.aspect).toBeCloseTo(300.4 / 150);
  });
  // Round 2 of #715's review: the sketchbook set the pixel-ratio cap once, from a hardcoded `high`, so a low
  // frame was never rendered at low's cost. `applyTier` is what construction and a tier change both call.
  it('applyTier caps the pixel ratio and sets the shadow map for the tier, and can be applied again', () => {
    const setPixelRatio = vi.fn();
    const r: TierTarget = { setPixelRatio, shadowMap: { enabled: true } };
    applyTier(r, 'low', 3);
    expect(setPixelRatio).toHaveBeenLastCalledWith(TIERS.low.maxPixelRatio);
    expect(r.shadowMap.enabled).toBe(false);
    applyTier(r, 'high', 3);
    expect(setPixelRatio).toHaveBeenLastCalledWith(TIERS.high.maxPixelRatio);
    expect(r.shadowMap.enabled).toBe(true);
    applyTier(r, 'high', 1);   // a 1× screen is never upscaled to the cap
    expect(setPixelRatio).toHaveBeenLastCalledWith(1);
    expect(TIERS.low.maxPixelRatio, 'the two caps differ, or the test above proves nothing').toBeLessThan(TIERS.high.maxPixelRatio);
  });
});

describe('stage — the factories an object builds with', () => {
  const tokens = (name: string) => ({ '--ink': '#0d1226', '--accent': '#ffb020', '--good': '#66e07d' } as Record<string, string>)[name] ?? '';
  it('binds the palette: a token or a plain colour, and every hull in the same ink at the same width', () => {
    const stage = createStage('low', tokens);
    expect(stage.tier).toBe('low');
    expect(stage.ink.getHexString()).toBe('0d1226');
    expect(stage.toon('--good').color.getHexString()).toBe('66e07d');
    expect(stage.toon(0xff0000).color.getHexString()).toBe('ff0000');
    const a = new Mesh(new BoxGeometry(), stage.toon('--accent')), b = new Mesh(new BoxGeometry(), stage.toon('--accent'));
    expect(stage.outline(a).material).toBe(stage.outline(b).material);
    expect(hullsOf(a)).toHaveLength(1);
  });
  it('measure counts triangles from the index and one draw call per material', () => {
    const stage = createStage('high', tokens);
    const root = new Mesh(new BoxGeometry(), stage.toon('--accent'));
    expect(measure(root)).toEqual({ triangles: 12, drawCalls: 1 });
    stage.outline(root);
    expect(measure(root)).toEqual({ triangles: 24, drawCalls: 2 });
  });
  it('measure multiplies instances, counts lines and sprites as calls, ignores groups, and refuses a geometry with no positions', () => {
    const stage = createStage('high', tokens);
    const root = new Mesh(new BoxGeometry(), stage.toon('--accent'));
    root.add(new InstancedMesh(new BoxGeometry(), stage.toon('--good'), 5));   // 5 × 12
    root.add(new LineSegments(new BufferGeometry()));                          // a call, no triangles
    root.add(new Sprite());                                                    // a call, no geometry to count
    root.add(new Scene());                                                     // nothing drawn
    expect(measure(root)).toEqual({ triangles: 72, drawCalls: 4 });
    expect(() => measure(new Mesh(new BufferGeometry(), stage.toon('--accent')))).toThrow(/no position attribute/);
  });
});

describe('objects registry — the contract the first object builds to', () => {
  it('n() keeps its default inside the range; defaultsOf is a full parameter set', () => {
    expect(n(1.6, 1, 2.4)).toEqual({ default: 1.6, min: 1, max: 2.4 });
    expect(() => n(3, 1, 2)).toThrow(/inside the range/);
    expect(defaultsOf({ a: n(1, 0, 2), b: n(5, 5, 9) })).toEqual({ a: 1, b: 5 });
  });
  it('holds the style probe (#717) and the 3-D Shapes solids (#684), under a ceiling the skill states', () => {
    expect(OBJECTS.map(o => o.name)).toEqual(['hammer', 'cube', 'cuboid', 'sphere', 'cylinder', 'cone', 'pyramid']);
    expect(BUDGET_CEILING).toEqual({ triangles: 2000, drawCalls: 8 });
  });
  it('defineObject infers the schema, so a variant is a full parameter set at compile time and the spec comes back unchanged', () => {
    const stage = createStage('high', () => '#0d1226');
    const spec = defineObject({
      name: 'probe', avatar: 'kai',
      params: { size: n(1, 0.5, 2) },
      variants: { big: { size: 2 } },
      build: (p, s) => new Mesh(new BoxGeometry(p.size), s.toon('--accent')),
      budget: { triangles: 12, drawCalls: 1 },
    });
    expect(spec.name).toBe('probe');
    expect(measure(spec.build(defaultsOf(spec.params), stage))).toEqual({ triangles: 12, drawCalls: 1 });
    // @ts-expect-error — a partial variant does not type-check through defineObject
    defineObject({ name: 'x', avatar: 'kai', params: { a: n(1, 0, 2), b: n(1, 0, 2) }, variants: { half: { a: 1 } }, budget: { triangles: 0, drawCalls: 0 }, build: () => new Scene() });
  });
});

/**
 * #684: a child counts a solid's faces on the card ("identify and describe the properties of 3-D shapes"), and
 * the style eases every edge (decision record 010, item 4) — so easing must never cost a face. A flat face is
 * a set of triangles sharing one plane's normal; a curved side splits into many thin strips, none of them big.
 * Each solid must show exactly as many big flat faces as `SHAPES_3D` says it has, at every variant.
 */
describe('the solids keep the flat faces the curriculum counts (#684)', () => {
  /** Big planar regions: triangles grouped by their geometric normal, kept when a group is over 5 % of the area. */
  function flatFaces(root: Object3D): number {
    const areas = new Map<string, number>();
    let total = 0;
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!(o instanceof Mesh) || o.name === 'outline') return;
      const pos = o.geometry.getAttribute('position'), idx = o.geometry.index;
      const count = idx ? idx.count : pos.count;
      const v = [new Vector3(), new Vector3(), new Vector3()];
      for (let t = 0; t < count; t += 3) {
        for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, idx ? idx.getX(t + k) : t + k);
        const cross = new Vector3().subVectors(v[1], v[0]).cross(new Vector3().subVectors(v[2], v[0]));
        const area = cross.length() / 2;
        if (area < 1e-9) continue;
        const nrm = cross.normalize();
        const key = [nrm.x, nrm.y, nrm.z].map(c => c.toFixed(2)).join(',');
        areas.set(key, (areas.get(key) ?? 0) + area);
        total += area;
      }
    });
    return [...areas.values()].filter(a => a > total * 0.05).length;
  }
  const solids = OBJECTS.filter(o => SHAPES_3D.some(s => s[1] === o.name));
  it('covers every solid SHAPES_3D names', () => {
    expect(solids.map(o => o.name).sort()).toEqual(SHAPES_3D.map(s => s[1]).sort());
  });
  it.each(solids.map(o => [o.name, o] as const))('%s has as many flat faces as SHAPES_3D says, at every variant', (name, o) => {
    const flat = SHAPES_3D.find(s => s[1] === name)![2].flat;
    for (const p of [defaultsOf(o.params), ...Object.values(o.variants)])
      expect(flatFaces(o.build(p, createStage('high', () => '#0d1226'))), `${name} at bevel ${p.bevel}`).toBe(flat);
  });
});
