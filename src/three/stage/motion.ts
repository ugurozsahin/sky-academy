/**
 * Motion (decision record 010, item 7; #740): the beats an object performs — `pop` as it arrives, `bounce` when
 * tapped, `cheer` for a correct answer — and a gentle idle bob. They live in the stage, not in any object, so
 * every object moves alike and `prefers-reduced-motion` is obeyed in one place: the caller starts no beat and
 * adds no bob when it is set.
 *
 * Pure functions of time. A pose is applied to a holder whose origin is the object's base, so a squash
 * flattens it onto the ground instead of shrinking it towards its middle. Squash and stretch keep the volume:
 * whatever `sy` does, `sx` (and `sz`, which equals it) answers with `1/√sy`.
 */

export type Beat = 'pop' | 'bounce' | 'cheer';
export const BEATS: readonly Beat[] = ['pop', 'bounce', 'cheer'];

/** Lift in scene units, the horizontal and vertical scale, and a sideways lean in radians. */
export interface Pose { readonly y: number; readonly sx: number; readonly sy: number; readonly rz: number }
export const REST: Pose = { y: 0, sx: 1, sy: 1, rz: 0 };

/** Seconds: long enough to read, short enough that a child's next tap is never kept waiting. */
export const BEAT_SECONDS: Readonly<Record<Beat, number>> = { pop: 0.55, bounce: 0.6, cheer: 0.9 };
export const HOP = 0.45;   // scene units: how high a bounce lifts the object

/** Overall scale `s`, squashed (`k` < 1) or stretched (`k` > 1) at constant volume. */
const squash = (s: number, k: number, y = 0, rz = 0): Pose => ({ y, sx: s / Math.sqrt(k), sy: s * k, rz });

/** Rises past 1 and settles back — the arrival overshoot every cartoon pop has. `easeOutBack(1)` is exactly 1. */
const easeOutBack = (u: number) => { const c = 1.7; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; };

/** The pose `t` seconds into `beat`; before it is REST, and at or after its end exactly REST again. */
export function beatPose(beat: Beat, t: number): Pose {
  const u = t / BEAT_SECONDS[beat];
  if (u >= 1 || u < 0) return REST;
  switch (beat) {
    case 'pop':   // grows from nothing, overshoots, and wobbles tall-then-flat as it lands at full size
      return squash(easeOutBack(u), 1 + 0.25 * Math.sin(Math.PI * 2 * u) * (1 - u));
    case 'bounce': {   // crouch, hop with a stretch, land with a squash
      const crouch = 0.18, land = 0.72;
      if (u < crouch) return squash(1, 1 - 0.22 * Math.sin((Math.PI / 2) * (u / crouch)));
      if (u < land) {
        const v = (u - crouch) / (land - crouch);
        const k = (0.78 + 0.22 * Math.min(1, v * 4)) * (1 + 0.12 * Math.sin(Math.PI * v));
        return squash(1, k, HOP * 4 * v * (1 - v));
      }
      const w = (u - land) / (1 - land);
      return squash(1, 1 - 0.18 * Math.sin(Math.PI * w) * (1 - w));
    }
    case 'cheer': {   // two small hops with a side-to-side lean, dying away
      const fade = 1 - u;
      return squash(1, 1 + 0.08 * Math.sin(4 * Math.PI * u) * fade, 0.22 * Math.abs(Math.sin(2 * Math.PI * u)) * fade, 0.22 * Math.sin(4 * Math.PI * u) * fade);
    }
  }
}

/** The idle bob's lift at `t` seconds: slow and small, so a child can still count faces while it moves. */
export const idleBob = (t: number) => 0.035 * Math.sin(t * 1.8);
