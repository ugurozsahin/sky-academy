---
paths:
  - "src/three/**"
  - "sketchbook.html"
  - "vite.sketchbook.config.ts"
  - "tests/sketch/**"
  - "scripts/sketch-shot.mjs"
  - "scripts/sketch-gallery.mjs"
---

# three.js 3-D (epic #713)

Written before the tree existed (#716); #714 landed the tree, the flag and the rails, #715 the sketchbook. The
scripts are listed above by name because the rail in `tests/unit/governance.test.ts` cannot resolve a glob
inside a file name.

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
- **Flag**: `threeEnabled()` = build-time `VITE_THREE` ∧ not `?three=off` ∧ the grown-ups' setting ∧ device
  capability. Quality tier is the stage's question, not the flag's. With the flag off the game is
  pixel-identical to `main`. Nothing mounts behind it yet — the #684 spike in `src/three/mount/solids.ts`
  predates it and obeys only the build-time layer — so the mobile e2e sets nothing today; the pull request
  that lands the first flag-gated mount gives the `mobile` project `?three=off` and one small spec the flag on
  (epic decision 5).
- **Rails** (`tests/unit/guardrails.test.ts`, landed by #714 and #715): `three` imported only under
  `src/three/**`; import direction as above, resolved from the decoded specifier, not its spelling; 250-line
  cap under `src/three/**`; the ratchet on existing files; no three.js code in the main chunk; a
  `VITE_THREE=off` build has no three chunk; every registered object under its declared budget at the `high`
  tier, defaults and every variant; no `Material` or `Light` constructed under the objects tree and no value
  import of the stage from there — materials come from the stage, which is what keeps every object in one
  style; the game carries nothing of the sketchbook (its own build, out of the precache, imported by nothing).
- **Tests**: `npm run test:sketch` (the screenshot script as the `sketchbook` Playwright project, #715) is
  what a pull request runs while its diff stays inside `src/three/stage|objects|sketchbook/`, `sketchbook.html`,
  `vite.sketchbook.config.ts`, `tests/sketch/` and the two scripts above; a diff reaching `src/three/mount/`
  or anything else under `src/` runs the game's e2e as before, and one touching both runs both. The routing
  is `ci.yml`'s scope step, proved on its real script by `tests/unit/workflows.test.ts`.
- **Files stay small**: 250 lines is the cap, not the target; split by part (geometry) and assembly.
