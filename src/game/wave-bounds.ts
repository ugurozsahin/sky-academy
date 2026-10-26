// The bounds every wave's arc is held to (#2184), split out of `bubbles.ts` and `arena.ts`, both at their #714
// line caps. Pure maths plus one DOM read (`cardInset`); `layoutWave`, `Arena.spawnWave` and `Arena.reanchor`
// are the callers.
//
// What went wrong. `layoutWave` derives a bubble's gravity from the rise it has: the box height less the question
// card's bottom (`topInset`). A KS2 card taller than a landscape phone put that bottom below the floor, so the
// rise and `g` came out negative and the bubbles crept upwards for ever (six topics at 667×375). A wave laid out
// in a box the arena had not caught up with — the 300×150 canvas default, a 1×1 hidden canvas, a phone whose
// toolbar settles after the first wave — kept that box's arc: re-anchored, it either flew off at once or, from a
// box taller than the one it played in, rose past the card and off the top of the screen.

/** The most of the box the question card may take from the flight — the same cap `Arena.reanchor` applies. */
export const TOP_INSET_MAX = 0.5;
/** A tall, narrow box (a phone held upright) can give a tall card more, so `y5-transform`'s 534 px card on 844 px no longer
 *  caps the card line at 422 and lets an arc end behind it (#2278); 0.35 of the box still flies. Landscape keeps `TOP_INSET_MAX`. */
export const TALL_INSET_MAX = 0.65, TALL_BOX = 1.6;
/** The most of an `W`×`H` box the card may take: `TALL_INSET_MAX` of a box at least `TALL_BOX` times as tall as it is wide. */
export const insetMax = (W: number, H: number) => H * (H >= W * TALL_BOX ? TALL_INSET_MAX : TOP_INSET_MAX);
/** The least and most of the box a bubble may rise, as shares of its height. */
export const RISE_MIN = 0.25, RISE_MAX = 0.95;

/**
 * The rise `layoutWave` draws for one bubble, held inside the box. `raw` is the drawn rise; `topInset` is already
 * capped at `TOP_INSET_MAX`. Between a quarter and 95 % of the box, `g` is always positive and a re-anchor (which
 * scales the rise by the height ratio) keeps the apex inside whatever box the wave lands in; at most `H - topInset`,
 * the apex is never above the card line `topInset + r`. With `topInset ≤ H/2` the drawn rise is above H/4 + r − 5
 * and below both 0.95 H − 3 and `H - topInset - 10`, so none of the three moves a bubble of an ordinary wave —
 * `tests/unit/wave-gravity.test.ts` holds that against the formula as it was.
 */
export const boundedRise = (raw: number, H: number, topInset: number) => Math.min(H * RISE_MAX, H - topInset, Math.max(H * RISE_MIN, raw));

/**
 * Keep one bubble's arc at or below the card line `ceiling` (= `topInset + r`) in a box of height `H`.
 *
 * A re-anchor scales an arc with the box, but the question card does not scale, so a wave laid out in a box taller
 * than the one it plays in keeps its share of the box and rises past the card. Two cases, by where the bubble is:
 * - **Queued, on the launch line** (`y ≥ H + r`): its whole flight is still ahead, so `vy`, `g` and the remembered
 *   launch speed `ovy` scale by one factor `k`, as `reanchorBubble` does — the rise scales by `k`, the time to the
 *   apex does not. `k` is bounded: the room above the launch line is at least half the box while `topInset ≤ H/2`.
 * - **In flight**: only `vy` is lowered, to `-√(2·g·room)`, and `g` is left alone. Scaling `g` here too would keep
 *   the time to the apex but take `k` towards 0 for a bubble just under the line, and the fall would then run
 *   `1/√k` slower — 47 s instead of 9 s after a mid-wave rotation (PR #2186 review, round 1). The apex comes a
 *   little sooner instead, and the fall is the normal one. A bubble already above the line stops climbing.
 * The relaunch arc (`ovy`, #591) is then held to the same line with `g` as it is, by `ovy` alone, so a sequence
 * word comes back as high as the line allows, never as a sliver at the floor.
 */
export function keepUnderCard(b: { y: number; vy: number; g: number; r: number; ovy?: number }, ceiling: number, H: number) {
  if (!(b.g > 0)) return;
  const rise = (v: number) => (v * v) / (2 * b.g);
  const launchRoom = H + b.r - ceiling;
  if (b.vy < 0) {
    const room = b.y - ceiling;
    if (room <= 0) b.vy = 0;
    else if (rise(b.vy) > room) {
      if (b.y >= H + b.r) { const k = room / rise(b.vy); b.vy *= k; b.g *= k; if (b.ovy !== undefined) b.ovy *= k; }   // queued: exact, k bounded
      else b.vy = -Math.sqrt(2 * b.g * room);                                                                       // in flight: g untouched
    }
  }
  if (b.ovy !== undefined && b.ovy < 0 && launchRoom > 0 && rise(b.ovy) > launchRoom) b.ovy = -Math.sqrt(2 * b.g * launchRoom);
}

/** `keepUnderCard` for every live bubble, under a card ending at `topInset`. */
export function holdUnderCard(bubbles: readonly { y: number; vy: number; g: number; r: number; ovy?: number; dead?: boolean }[], topInset: number, H: number) {
  for (const b of bubbles) if (!b.dead) keepUnderCard(b, topInset + b.r, H);
}

/**
 * The card line for the arena's next box: the live measurement when the screen can give one, else the old line
 * scaled with the box — and never more than `TOP_INSET_MAX` of it. The card does not scale with the box, so a
 * live read is the true line; a scaled one (the duel's fixed 8 px, a test arena) is the best guess there is.
 */
export function nextInset(live: number | undefined, old: number, sy: number, W: number, H: number) {
  return Math.min(live !== undefined && Number.isFinite(live) ? live : old * sy, insetMax(W, H));
}

/** Whether a measured rect is a different box from the whole-px `W`×`H` the arena holds: compared as `resize` rounds it,
 *  so two duel halves whose rects round to the same pixel always reach the same decision (#389/#400, #678, #2188). */
export const boxMoved = (rect: { width: number; height: number }, W: number, H: number) =>
  Math.max(1, Math.round(rect.width)) !== W || Math.max(1, Math.round(rect.height)) !== H;

/**
 * Where the question card ends, as the arena's `topInset`: read in the same frame as the layout it bounds
 * (`play-session.ts`), and again by the arena on every resize (`ArenaOpts.measureInset`), never scaled from an
 * older measurement. A card with no box (`display: none`) is no reading — `NaN`, which the `topInset` setter and
 * `nextInset` both ignore — not a card line 6 px from the top (PR #2186 review, round 1).
 */
export const cardInset = (card: HTMLElement) => { const r = card.getBoundingClientRect(); return r.height > 0 ? r.bottom + 6 : NaN; };
