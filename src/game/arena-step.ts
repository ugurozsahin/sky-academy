// The arena's per-substep moves that need no canvas and no `Arena` (#1431, split out of `Arena.update`).
import type { Bubble } from './bubbles';

/** Put a bubble back on its launch line, on its original arc — not a teleport into play (#591, #742). */
export function relaunchBubble(b: Bubble, H: number, launchAt: number) {
  b.launched = false; b.launchAt = launchAt;
  b.x = b.ox; b.y = H + b.r; b.vx = b.ovx; b.vy = b.ovy;
}
