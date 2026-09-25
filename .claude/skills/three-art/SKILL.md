---
name: three-art
description: Build a 3-D object for Sky Ninja Academy in the avatars' toon style — object module, stage contract, look pass, mobile budget, sketchbook variants, screenshots and the gallery the owner approves from. Use when an issue labelled 3d asks for a 3-D object, and only then.
---
# three-art

Gated: this skill applies only to an issue labelled `3d` (`CLAUDE.md`), the way `frontend-design` applies only
to `new-ui`. The style itself lives in `docs/decisions/010-3d-art-is-the-avatars-style.md` — read it first and
do not restate it here; this file is *how* to build to it. The folder structure, the feature flag and the rails
are in `.claude/rules/three.md`. Where this file and either of those disagree, they win and this file is the
bug. The stage (#714) and the sketchbook (#715) exist; the contracts below are what they enforce. Write an
object with `defineObject(...)` from `src/three/objects/index.ts` rather than annotating it `ObjectSpec<P>`:
the schema is inferred from `params`, so a partial or misspelt variant is a compile error.

## 1. Where an object lives and what it exports

One object per file under `src/three/objects/<feature>/<object>.ts`, registered once in the objects tree's
`index.ts`. Never more than 250 lines; a bigger object is two files (parts + assembly).

```ts
export const hammer: ObjectSpec<HammerParams> = {
  name: 'hammer',                       // the sketchbook's list entry and the screenshot folder
  avatar: 'hammer',                     // the 2-D avatar it belongs to; the sketchbook shows it alongside
  params: { headLength: n(1.6, 1, 2.4), shaftLength: n(3, 2, 4) },   // schema: n(default, min, max) drives the controls
  variants: { thin: { ... }, chunky: { ... } },                      // full param sets (every key) the gallery renders
  budget: { triangles: 1200, drawCalls: 4 },                         // declared; a rail asserts the built mesh
  build(p, stage) { ... return group; },                             // pure: three.js only, no DOM, no game
};
```

`build` takes the stage's material factories (`stage.toon(colour)`, `stage.outline(mesh)`) and returns an
`Object3D`. It never creates a material of its own, never reads `window`, never imports `src/ui` or
`src/game`. Colours come from `design-language` tokens or the avatar's `glow` (`src/avatars.ts`); a hex
literal needs a one-line reason in the file. A variant is a full `P`, never a partial one; the `n()` defaults
are the sketchbook's starting values until #717, after which the chosen variant's values replace them and the
defaults are the only ones (§4).

## 2. The look pass — check in this order, against the avatar

For every object, before screenshots, walk the decision record's items 1–7 and answer each in the PR body:

1. Outline on every mesh, via `stage.outline` — never a hand-rolled hull, so the width stays one constant.
2. Every material from `stage.toon`; no `MeshStandardMaterial`, no env map, no roughness/metalness.
3. Palette: list the colours used and where each comes from.
4. Volume: bevelled and rounded (`RoundedBoxGeometry`, eased `LatheGeometry` profiles, `ExtrudeGeometry`
   with `bevelEnabled`). If a straight primitive is used, say why.
5. One highlight spot, from the stage's rim light; no extra lights inside an object.
6. FX only as flat ribbons/sprites in the element colour; bloom only via the stage's `high` tier.
7. Motion via the stage's idle animator; the object exposes no timers of its own.

## 3. Mobile budget

Declare `budget` honestly and keep the object under it: the budget rail (#714, `tests/unit/guardrails.test.ts`)
builds every registered object on a headless stage at the `high` tier — the dearer one — and counts triangles
and draw calls. Merge geometry that
shares a material (`BufferGeometryUtils.mergeGeometries`) — the outline hull doubles draw calls, so four parts
with one material and one hull is two draw calls, not eight. Ceilings: 2 000 triangles and 8 draw calls per
object unless the issue says otherwise, and it must say why.

## 4. Variants, screenshots, gallery

- Add at least two `variants` that differ in what the issue leaves open — never in outline width or tone
  count, which the stage owns after #717.
- `npm run sketch:shot` (#715) renders every object × variant × tier to `docs/sketchbook/<object>/`; a blank
  frame fails. `npm run test:sketch` is the same script as a Playwright spec; run it, not the game e2e, while
  the diff stays inside `src/three/**` and the sketchbook paths `.claude/rules/three.md` lists.
- `node scripts/sketch-gallery.mjs <object>` builds one HTML page from the PNGs; publish it as a Claude
  artifact and put the link and the images inline in the PR body, "beside the avatar" view included.
- The PR is labelled `owner-approval` and `art`. The owner answers with his marker and a variant name; the
  chosen variant becomes the object's default params, the others are deleted, and only then does a separate
  PR mount the object in the game behind `threeEnabled()`.

## 5. What the PR body carries

The look pass answers (§2), the declared budget and the measured numbers, the gallery link, the screenshot
grid, and the tests run — on top of everything the `open-pr` skill asks of any pull request. A 3-D object PR
never touches `src/ui` or `src/game`; the mount PR never touches the objects tree.
