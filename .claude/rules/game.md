---
paths:
  - "src/game/**"
  - "src/ui/play.ts"
---

# Game arena and play screen (#101)

- `src/game/arena.ts` owns bubbles, slicing and particles on the canvas; `src/game/session.ts` is the pure
  stages/lives/score logic, kept free of DOM and canvas so it stays unit-testable.
- `src/ui/play.ts` is the HUD, overlays, and `window.__sna` test hooks (`answer()`, `wrong()`, `bubbles()`,
  `state()`) — the e2e contract. Keep these working; e2e tests drive the game entirely through them.
- Never set `shadowBlur` on a canvas context — it is a render-rate guard rail (`tests/unit/guardrails.test.ts`),
  costed once and never re-added.
- The render loop has a frame-rate guard rail: a change here that could affect it is proved against the rail
  before it is pushed, not after CI catches it.
- A screen must tear down its running arena on a route change — leaking one across screens is a guard-rail
  incident, not a hypothetical.
