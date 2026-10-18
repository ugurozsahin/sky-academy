// The arena's per-substep moves that need no canvas and no `Arena` (#1431, split out of `Arena.update`).
import type { Bubble } from './bubbles';

/** Put a bubble back on its launch line, on its original arc — not a teleport into play (#591, #742). */
export function relaunchBubble(b: Bubble, H: number, launchAt: number) {
  b.launched = false; b.launchAt = launchAt;
  b.x = b.ox; b.y = H + b.r; b.vx = b.ovx; b.vy = b.ovy;
}

/** Mark the outcome on the live wave (#1433, split out of `Arena.reveal`): queued bubbles never launch, the right answer
 *  gets the ✓ (first match only), the sliced wrong one the ✗, the rest fade. True when the right answer was on screen. */
export function markOutcome(bubbles: Bubble[], o: { good?: string; bad?: string }, now: number): boolean {
  let shown = false;
  for (const b of bubbles) {
    if (b.dead) continue;
    if (!b.launched) { b.dead = true; continue; }
    if (o.good !== undefined && b.label === o.good && !shown) { b.mark = 'good'; b.markAt = now; shown = true; }
    else if (o.bad !== undefined && b.label === o.bad && b.hit && !b.mark) { b.mark = 'bad'; b.markAt = now; }
    else b.fade = true;
  }
  return shown;
}

/** Where the ghost right-answer bubble pops in: the arena's upper-middle, shoved aside if it would sit on the ✗ bubble. */
export function ghostX(W: number, r: number, bad: Bubble | undefined, y: number): number {
  const x = W / 2;
  if (!bad || Math.hypot(bad.x - x, bad.y - y) >= 2.2 * r) return x;
  return bad.x < W / 2 ? Math.min(W - r - 8, bad.x + 2.4 * r) : Math.max(r + 8, bad.x - 2.4 * r);
}
