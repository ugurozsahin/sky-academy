/**
 * The camera, the lights and the background every stage shares (`.claude/rules/three.md`). One key light for
 * the two-tone split, a hemisphere fill so the dark tone is coloured rather than black, and one rim light for
 * the single highlight spot the decision record asks for (item 5) — objects add no lights of their own.
 * `createRig` is pure three.js scene graph and runs in Node; `createRenderer` is the one browser-only call.
 */
import { Color, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, WebGLRenderer, type ColorRepresentation } from 'three';
import { TIERS, type Tier } from './tiers';

export interface Rig {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly key: DirectionalLight;
  readonly rim: DirectionalLight;
  readonly fill: HemisphereLight;
}

export interface RigOptions {
  aspect: number;
  tier: Tier;
  /** The page behind the objects — `--ink` in the game, whatever the sketchbook wants; null for transparent. */
  background: ColorRepresentation | null;
  /** The sky and ground colours of the hemisphere fill; defaults to a cool sky over the background. */
  fill?: { sky: ColorRepresentation; ground: ColorRepresentation };
}

export const CAMERA_FOV = 32;   // a long lens: chibi volumes read best with little perspective distortion

export function createRig(o: RigOptions): Rig {
  const scene = new Scene();
  scene.background = o.background === null ? null : new Color(o.background);
  const camera = new PerspectiveCamera(CAMERA_FOV, o.aspect, 0.1, 50);
  camera.position.set(0, 1.2, 6.5); camera.lookAt(0, 0, 0);

  const key = new DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 5, 4);
  key.castShadow = TIERS[o.tier].shadows;
  const rim = new DirectionalLight(0xffffff, 1.1);   // from behind and above: the one gloss point on each object
  rim.position.set(-2.5, 3.5, -4);
  const bg = o.background === null ? 0x0d1226 : o.background;   // `--ink` when there is no page behind: the sketchbook's transparent frames
  const fill = new HemisphereLight(o.fill?.sky ?? 0x8fb8ff, o.fill?.ground ?? bg, 0.6);
  scene.add(key, rim, fill);
  return { scene, camera, key, rim, fill };
}

/** The renderer for `canvas` at `tier`'s cost. Throws where WebGL is unavailable — the mount keeps its 2-D fallback. */
export function createRenderer(canvas: HTMLCanvasElement, tier: Tier, pixelRatio = devicePixelRatio || 1): WebGLRenderer {
  const spec = TIERS[tier];
  const r = new WebGLRenderer({ canvas, antialias: spec.antialias, alpha: true, powerPreference: 'low-power' });
  r.setPixelRatio(Math.min(pixelRatio, spec.maxPixelRatio));
  r.shadowMap.enabled = spec.shadows;
  return r;
}

/** CSS size → drawing buffer, and the camera follows. `false` leaves the canvas's CSS size to the stylesheet. */
export function resize(rig: Rig, renderer: WebGLRenderer, width: number, height: number): void {
  renderer.setSize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), false);
  rig.camera.aspect = width / Math.max(1, height);
  rig.camera.updateProjectionMatrix();
}
