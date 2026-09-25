# 010 — 3-D art is the avatars' style, translated

**Status:** accepted — owner, in session, 2026-09-25. Epic #713 decision 1; filed by #716. Every 3-D
object the game gets (#684 solids, #685 islands, later arena objects) is built to this record; the
`three-art` skill says *how*, this file says *what*. (009 was claimed by an open pull request when this was
written, so this record took the next number — `.claude/rules/governance.md` has the numbering rule.)

## Context

The owner wants the visual jump he sees in three.js work, produced the way that work is produced: models as
procedural code, no asset files, no Blender (research on #684, 2026-09-24). The first draft of #684 asked for
"flat bright toy-like materials"; the second conversation asked for the cinematic look of the demos —
physically based materials, ACES tone mapping, bloom. Both were wrong for the same reason: neither looked at
the art the game already has.

The game's characters are owner-supplied 2-D art (`public/avatars/*.webp`; `public/avatars/kai.webp`,
`public/avatars/sensei.webp` and `public/avatars/hammer.webp` are the reference images). Read as a style, they
are one thing: thick black vector outlines; flat colour fields with two, at most three, tones of cel shading
and no gradients; a small saturated palette per character (Kai red-black-white-gold, Hammer Man
grey-purple-brown); chibi proportions — big head, big eyes, chunky hands, rounded volumes; one or two hard
white highlight spots; element effects drawn as stylised swooshes. A photoreal cube next to Kai reads as a
different game.

## Decision

3-D objects are drawn in the avatars' style. Concretely, and in the order a reviewer checks them:

1. **Outline.** Every object carries a thick black outline, drawn as an inverted hull (a back-face copy,
   scaled out, in flat black). Width is one stage constant, chosen by the style probe (#717), not per object.
   No post-processing outline pass: the hull is cheap on a low-end tablet and needs no render target.
2. **Cel shading.** `MeshToonMaterial` with a gradient map of two or three steps (the probe decides which).
   No `MeshStandardMaterial` / `MeshPhysicalMaterial`, no roughness or metalness, no environment maps.
3. **Palette.** Flat, saturated, few colours. The base colours come from the `design-language` tokens and
   from the avatar an object belongs to (its `glow` in `src/avatars.ts` is that element's colour). A colour
   outside those needs the same one-line reason `design-language` asks for in CSS.
4. **Volume.** Chibi: rounded, oversized, bevelled. A cube is a rounded box, a cone has a soft tip, a pyramid's
   edges are eased. Nothing in the game is razor-edged, because nothing in the avatars is.
5. **Highlight.** One specular highlight spot per object — a small white disc or a rim light — matching the
   avatars' single gloss point. Not a full specular lobe.
6. **Effects.** Element FX (fire, water, lightning, leaf) are stylised swooshes: flat-shaded ribbons and
   sprites in the element colour. Bloom is allowed there and nowhere else, and only on the `high` tier.
7. **Motion.** Slow idle rotation or bob; eased camera moves; nothing snaps. Motion obeys
   `prefers-reduced-motion` through the stage, not per object.
8. **What stays 2-D.** The avatars themselves, the Sensei, Hammer Man as a character. The 3-D world is built
   around the drawn characters, never instead of them.

Explicitly **not** the style: physically based materials, HDR environment lighting, ACES/filmic tone mapping,
depth of field, ambient occlusion passes, photographic textures. Those are the look of the demos the owner
first pointed at, and they are rejected because they would not sit beside the avatars.

## Consequences

- The stage (`src/three/stage/**`, #714) owns the outline width, the gradient map and the highlight; objects
  inherit them and cannot override them. That is what makes every object look like every other.
- The style is cheap: toon shading and an inverted hull cost less than PBR, which is why the `low` tier can
  keep the full look and only drop shadow and bloom.
- The style probe (#717) is where the two open numbers — outline width, tone count — are chosen by the owner
  from rendered variants beside the avatar art. Until it lands, objects use the stage's provisional values.
- A pull request that adds a 3-D object states, item by item, how it meets 1–7; the reviewer checks the
  screenshots against the avatar the object belongs to. The `three-art` skill has the checklist.

## Considered and dropped

- **Cinematic PBR** (the first research pass): rejected above; also the most expensive look on a tablet.
- **Converting the avatars to 3-D**: the drawn faces are the owner's art and the game's identity; a 3-D
  approximation would be worse than the drawing and would cost the one thing the game already has.
- **Per-object style freedom**: rejected because one badly matched object breaks the set; the stage owns the
  look.
