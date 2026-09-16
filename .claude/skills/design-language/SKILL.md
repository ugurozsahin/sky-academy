---
name: design-language
description: Sky Ninja Academy's visual tokens and UI constraints. Use before touching CSS or building a new screen/component, to keep the look consistent without opening every existing file.
---
# Design language

The tokens and constraints below are extracted from `src/style.css` and the game — they are not a new
ruleset, just this file's existing conventions collected in one place so a change doesn't have to be
rediscovered by reading the whole stylesheet. Where this file and `src/style.css` ever disagree, the CSS is
the truth and this file is the bug — file an issue or fix it in the same PR.

This is the brief `frontend-design` is gated against (`CLAUDE.md`): a genuinely new screen may use that skill,
but on any conflict between the two, this file wins.

## 1. Palette — custom properties on `:root`, never a hard-coded hex for these

```
--ink: #0d1226        page/arena background
--panel: rgba(16, 22, 48, .78)     card / panel fill
--panel-2: rgba(28, 36, 74, .9)    a slightly denser panel (tabs, buttons)
--line: rgba(255,255,255,.12)      hairline borders
--text: #f4f6ff       body text
--muted: #9aa5cf      secondary text (small, captions)
--accent: #ffb020     warm highlight — stars, praise, primary CTA
--accent-2: #3ec9ff   cool highlight — selection glow, links
--good: #66e07d       correct / positive
--bad: #ff5f6d        wrong / negative
--glow: #3ec9ff       selection ring / focus glow
--font: "Fredoka", "Baloo 2", "Nunito", system-ui, -apple-system, "Segoe UI", sans-serif
--radius: 22px         the large card radius (panels, avatar cards)
```

A colour outside this list needs a reason in the same PR (a visual's own SVG palette — clock hands, scale
pans — is the one accepted exception, because those are drawn to look like the real object, not themed).

## 2. Sizing — `clamp()`, not a fixed pixel value, for anything that shares the screen with game content

Fixed pixels on a HUD or visual element are how a five-line word wraps to three, or a ten-frame counter grows
past its box on a small phone. The pattern throughout `style.css` is `clamp(min, preferred-vw-or-vh, max)`:

- `.five { --slot: clamp(22px, min(7.2vw, 5vh), 40px); }` — a ten-frame/array slot. `--obj` (the glyph inside
  it) is derived from `--slot`, never given its own clamp, so the two can't drift apart (the comment above
  `.slot` in `style.css` explains the `0.78` ratio and why `line-height: 1`).
- `.objs .obj { font-size: var(--obj); }` — always follows `--slot`, the same reason.
- `.scales .pan { font-size: clamp(18px, 5vw, 24px); }`, tightened by a `.pan.many` variant
  (`clamp(15px, 4vw, 20px)`) once a pan holds enough items to need it — a second clamp tier for "this got
  crowded", not a fixed shrink.
- `.wordcard .txt { font-size: clamp(26px, 7vw, 40px); }` — same idea for the read-aloud word card.

**When you add a new sized element that lives inside a shared container** (a frame, a card row, a HUD strip),
give it a `clamp()` derived from a `vw`/`vh` term, and derive any child glyph size from the container's
variable rather than clamping it separately — that is what keeps a slot and its contents in lock-step.

## 3. Breakpoints — three, each with a reason, not a device guess

- **`min-width: 720px`** — the general "wide enough for a two-column layout" tier (avatar/results cards,
  `.cards` on the home screen).
- **`min-width: 900px`** — desktop grids that need real width: parents' stats go four-up, year cards three-up.
- **`min-width: 600px` (parents dashboard only, `#109`)** — the portrait-tablet tier, added because going
  straight from 600px to the 900px desktop layout put a 1280px grid on an ~800px tablet with nowhere for the
  cards to go. Two-up, not the desktop layout, until 900px. **This is the shape to copy** for anything that
  needs a tablet-specific step rather than a straight phone→desktop jump: don't reuse the desktop breakpoint's
  layout at a tablet width just because both are "≥ 600px".
- The **play arena** is capped, not breakpointed: `--arena-w: 600px` on `.play`, so `#arena` is `width: 100%`
  up to 600px (a phone, unchanged) and centred at a fixed 600px beyond it (tablet/desktop) — a cap, not a
  responsive grid, because the arena is a fixed aspect play area, not a document that reflows.

## 4. Touch, text and voice — built for a Reception child, not an adult reading fast

- **Touch targets**: `min-height: 44px` on tappable controls (`.shop .item .btn` is the concrete example) —
  the Apple/WCAG accessible minimum, not the browser default. A new tap target under a HUD or in a list needs
  the same floor.
- **Little text, big glyphs**: body copy sits around 13–17px (`.stars`, `.hero small`, `.btn` at `font-size:
  17px`); the content a child reads to answer a question (word cards, ten-frame glyphs, clock faces) is sized
  by §2's `clamp()`s instead, deliberately larger and never smaller than the UI chrome around it.
- **Read-aloud everywhere**: any text a Reception/Year1 child needs to answer a question has a spoken form —
  `say` on a generated `Question` (`src/curriculum/types.ts`), read through `src/audio.ts`. A new question
  visual or card that shows words needs a `say` path before it needs a font-size decision; a child who cannot
  read yet is the baseline user, not an edge case.
- **British English**: every string a child can see or hear is UK spelling and usage — `tests/unit/british.test.ts`
  is the enforced list (colour, grey, metre, practise the verb, learnt, trousers not pants, and so on). Check
  new copy against that file's `AMERICAN` map before adding a word that might be on it.

## 5. Reuse a class before inventing one

`#27` is the incident this rule exists for: island art and grid columns were once keyed by per-index classes
(`.i0`/`.i1`/`.i2`) with a hard `repeat(3, 1fr)`, so a fourth island had nowhere to go without a new class and
a new CSS rule (`tests/e2e/game.spec.ts`, "guard rail: island art and grid come from year data, not a
per-index CSS class (#27)"). The fix that stuck: art and tint come from the data (`YearInfo`, set inline as a
CSS custom property), and the grid reads a `--cols` variable — no per-item class, so a new year or a new card
needs no new CSS at all.

Before adding a class, check whether an existing one (`.btn`, `.card`, `.panel`-backed component, `.chart` for
tabular data) already does the job with a modifier (`.btn.big`, `.btn.primary`) or a data-driven CSS variable,
the way `--tint`/`--cols`/`--slot` already do. A new class earns its place when the shape is genuinely new, not
when an existing one is merely inconvenient to extend.

## 6. What this file does not cover

It is a brief for staying consistent with what already exists, not a rule that a change must look identical —
`CLAUDE.md` is explicit that a genuinely new look (art, skins, a redesigned effect) is the owner's call via
`owner-approval`, while a change whose look must *not* change is the reviewer's to verify with before/after
evidence. This file tells you the tokens to reach for either way; it does not decide which of the two a given
PR is.
