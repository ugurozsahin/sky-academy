---
paths:
  - "src/three/**"
  - "sketchbook.html"
  - "tests/sketch/**"
---

# three.js 3-D (epic #713)

Written before the tree exists (#716): #714 creates `src/three/` and #715 the sketchbook, and each drops its
paths from the future-path allowances in `tests/unit/governance.test.ts` and `tests/unit/instructions.test.ts`
as it lands. #715 also adds its scripts to the `paths:` above by name — the rail cannot resolve a glob such as
`sketch-*.mjs` inside a file name, so none is declared here.

- **Style**: `docs/decisions/010-3d-art-is-the-avatars-style.md` is binding; the `three-art` skill (gated
  to the `3d` label) is how an object is built to it.
- **Tree, feature-based** — the only feature-based tree in the repo; the layer-based `src/game` / `src/ui`
  stay as they are:
  - `src/three/stage/` — `rig.ts` (camera, lights, background), `tiers.ts` (`low`/`high`), `toon.ts`
    (gradient-map material factory), `outline.ts` (inverted hull). The stage owns the look.
  - `src/three/objects/` — `<feature>/<object>.ts` + an `index.ts`: one object per file, registered once.
  - `src/three/mount/` — the only surface `src/ui` may import, and only with a dynamic `import()`.
    Its `enabled.ts` holds `threeEnabled()`; every mount point falls back to today's 2-D rendering.
  - `src/three/sketchbook/` — the sketchbook page (`sketchbook.html`, its own Vite input); never imported
    by anything under `src/`.
- **Flag**: `threeEnabled()` = build-time `VITE_THREE` ∧ device capability ∧ parent setting ∧ not
  `?three=off`. Quality tier is the stage's question, not the flag's. With the flag off the game is
  pixel-identical to `main`; the mobile e2e runs with it off.
- **Rails** (`tests/unit/guardrails.test.ts`, landed by #714): `three` imported only under `src/three/**`;
  import direction as above; 250-line cap under `src/three/**`; the ratchet on existing files; no three.js
  code in the main chunk; a `VITE_THREE=off` build has no three chunk; every registered object under its
  declared budget at the `high` tier; no `Material` constructed under the objects tree — materials come
  from the stage, which is what keeps every object in one style.
- **Tests**: `npm run test:sketch` (the screenshot script as a Playwright project, #715) while a diff stays
  inside the paths above; the game's e2e only when a diff reaches `src/ui` or `src/game`.
- **Files stay small**: 250 lines is the cap, not the target; split by part (geometry) and assembly.
