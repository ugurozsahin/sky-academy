/**
 * Where a shown object stands (#740, #684): a holder whose origin is the object's base, so a beat squashes it
 * onto the ground, and the contact shadow under it. The sketchbook's view and the game's card both show objects
 * this way, so it lives in the stage once rather than in each of them — the same beat and the same shadow
 * everywhere an object appears. Add `group` and `shadow` to the scene; call `update` once a frame.
 */
import { Group, type ColorRepresentation, type Mesh, type Object3D } from 'three';
import { contactShadow, footprint, shadowScale } from './ground';
import { beatPose, HOP, idleBob, REST, type Beat, type Pose } from './motion';

export interface Stand {
  readonly group: Group;
  readonly shadow: Mesh;
  /** The pose the last `update` applied — REST between beats. */
  readonly pose: Pose;
  /** The beat playing, or the last one until the next starts; null before any. */
  readonly lastBeat: Beat | null;
  /** Stand `object` here (measured at rest, so its base is where it rests), or clear the stand with null. */
  set(object: Object3D | null): void;
  /** Start `kind` at `now` (ms, the same clock `update` is given). */
  beat(kind: Beat, now: number): void;
  /** Apply the beat at `now`, and the idle bob when `motion` is allowed; without motion the stand stays at rest. */
  update(now: number, motion: boolean): void;
  dispose(): void;
}

export function createStand(ink: ColorRepresentation): Stand {
  const group = new Group(), shadow = contactShadow(ink);
  let shown: Object3D | null = null, base = 0, radius = 0, pose: Pose = REST;
  let playing: { kind: Beat; start: number } | null = null, lastBeat: Beat | null = null;
  return {
    group, shadow,
    get pose() { return pose; },
    get lastBeat() { return lastBeat; },
    set(object) {
      if (shown) group.remove(shown);
      playing = null; pose = REST;
      group.position.set(0, 0, 0); group.scale.set(1, 1, 1); group.rotation.set(0, 0, 0);
      shown = object;
      shadow.visible = !!object;
      if (!object) return;
      ({ base, radius } = footprint(object));
      object.position.y -= base;
      group.add(object);
    },
    beat(kind, now) { if (shown) { playing = { kind, start: now }; lastBeat = kind; } },
    update(now, motion) {
      const elapsed = playing ? (now - playing.start) / 1000 : 0;
      pose = motion && playing ? beatPose(playing.kind, elapsed) : REST;
      if (playing && (!motion || (pose === REST && elapsed > 0))) playing = null;
      const lift = pose.y + (motion ? idleBob(now / 1000) : 0);
      group.position.y = base + lift; group.scale.set(pose.sx, pose.sy, pose.sx); group.rotation.z = pose.rz;
      shadow.position.y = base + 0.002;
      shadow.scale.setScalar(shadowScale(radius, Math.max(0, lift), HOP));
    },
    dispose() {
      shadow.geometry.dispose();
      (shadow.material as { dispose(): void }).dispose();
    },
  };
}
