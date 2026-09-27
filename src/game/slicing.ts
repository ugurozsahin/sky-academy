// Pointer strokes and hit-testing (#559, split out of arena.ts): the part of a slice that is pure geometry,
// independent of the canvas, the wave or any bubble's own physics. `Arena` still owns the strokes map itself
// and the onDown/onMove/onUp handlers — those read and mutate too much of the arena's own state (bubbles,
// trail, particles, callbacks) to move without becoming Arena again under another name.

/** One finger's own swipe (#561), keyed by `pointerId`; `stale` is #331's freeze flag, now per finger. */
export interface Stroke { lastPt: { x: number; y: number }; moved: number; stale: boolean }

// True when the slice segment (x1,y1)→(x2,y2) passes within `r` of the bubble centre (cx,cy) — the swipe
// hit test. Exported so the geometry is unit-tested directly rather than only through the slow e2e (#43).
export function segCircle(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number) {
  const dx = x2 - x1, dy = y2 - y1; const l2 = dx * dx + dy * dy;
  let t = l2 ? ((cx - x1) * dx + (cy - y1) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx, py = y1 + t * dy;
  return Math.hypot(px - cx, py - cy) <= r;
}
