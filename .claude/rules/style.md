---
paths:
  - "src/style.css"
  - "src/ui/**"
---

# Visual style and UI (#101)

- See the `design-language` skill for the full brief before touching CSS or building a screen/component:
  palette, the `clamp()` sizing families, the 600px tablet breakpoint, touch targets sized for a five-year-old.
- `frontend-design` (vendored, gated) applies only to an issue labelled `new-ui` — a screen built from nothing.
  Every other UI change follows `design-language` alone; on any conflict, `design-language` wins.
- `three-art` (own skill, gated the same way) applies only to an issue labelled `3d` — a 3-D object, built to
  `docs/decisions/010-3d-art-is-the-avatars-style.md` under `.claude/rules/three.md`.
- A new element reuses an existing class before inventing one — the screen-class CSS-collision guard rail
  exists because two unrelated screens once shared a class name by accident.
- Little text, read-aloud everywhere, British English copy (`tests/unit/british.test.ts` enforces the spelling
  half of this).
