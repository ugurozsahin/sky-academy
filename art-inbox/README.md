# Art inbox — drop owner artwork here

Anything the owner draws for the game lands in this folder; a session or the routine converts it,
puts it under `public/`, and wires it into the code. Nothing here ships: the folder is an inbox,
not an asset directory.

## Celebration poses (#13)
One image per ninja, named by the ninja's **id** — not its display name:

    volt · blaze · splash · terra · gust · frost · sol · shadow · kai · bolt · master

    art-inbox/win-volt.png, art-inbox/win-blaze.png, …

**`shadow` keeps that filename** even though the character is now called *Dusk* (#68): the id is
what the save file stores, so renaming it would drop every player's chosen ninja.

- PNG (or WEBP) with a **transparent background**, square-ish, **512–1024 px** on the long side.
- The pose is read at ~200 px on a phone, so it wants to be legible small: big silhouette, clear
  gesture. Faces end up tiny.
- Same lighting and line weight as the existing portraits in `public/avatars/` — they are the
  reference, and consistency between them matters more than any single image.

## Islands (#12)
`art-inbox/island-reception.png`, `island-year1.png`, `island-year2.png` — wide (roughly 2:1),
transparent background. Note the islands are being drawn in code first (owner's decision,
2026-09-10); these replace that when they arrive.

## What happens next
Say in the session that files are here. They get converted to `.webp` (the existing portraits are
60–100 KB each — the whole game ships as one self-contained HTML file, so size is real), placed
under `public/`, referenced from the code, and the originals stay here for the next re-export.
