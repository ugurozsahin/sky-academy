---
name: qa-screenshot
description: Bounded visual QA for a Sky Ninja Academy pull request. Use when reviewing or verifying a player-visible change and a screenshot would settle it faster than reading the diff.
---
# QA screenshot

Bounded means bounded: this is a quick look, not a visual test suite. It exists for the review duty
`CLAUDE.md` already sets — a change whose look must *not* change is the reviewer's to verify with
before/after evidence, never the owner's — and for the times a diff is easier to judge by eye than by reading
CSS. It is not e2e coverage; `tests/e2e/game.spec.ts` still owns that.

## The tooling (already in the repo, just never written up)

`scripts/shot.mjs` drives one page and saves one screenshot:

```
node scripts/shot.mjs <url> <out.png> [w=390] [h=844] [script-file]
```

It launches the same bundled Chromium the e2e suite uses, opens `<url>` at a phone-sized viewport by default
(390×844 — the iPhone 13 size `playwright.config.ts`'s `mobile` project already uses, so a screenshot at the
default size matches what CI actually renders), and if given a `script-file`, runs its default-exported
`async (page) => {...}` before capturing — that is how a shot reaches a screen past the avatar picker or mid-
game rather than the boot screen.

`scripts/flow-*.mjs` are those navigation scripts, one per destination, each written the same way: pick an
avatar, `#go`, click through to the target screen, `waitForSelector` on it. Reuse one before writing a new
one:

| Script | Reaches |
| --- | --- |
| `flow-home.mjs` | the map, freshly onboarded |
| `flow-play.mjs` | mid-arena on a Year 1 topic |
| `flow-results.mjs` | the results screen after a full mission (also grabs a mid-mission `/tmp/stage2.png`) |
| `flow-cert.mjs` | the certificate full-screen fallback (#50), built on `flow-results.mjs` |
| `flow-clear.mjs` | the celebrate overlay after a Reception stage |
| `flow-parents.mjs` | the grown-ups dashboard, seeded with realistic progress so it does not look empty |
| `flow-fx.mjs` | a slice mid-swipe, for the particle/effect trail itself |

## Running it

The dev server is not enough — `shot.mjs` wants a built app, the same one CI checks:

```
npm run build && npm run preview &      # vite preview on :4173, same port playwright.config.ts uses
node scripts/shot.mjs http://localhost:4173/ /tmp/before.png 390 844 scripts/flow-play.mjs
```

For a screen none of the existing flows reaches, write a new `flow-<screen>.mjs` next to the others rather
than a one-off inline script — the pattern above is the whole convention, and the next PR that touches the
same screen gets it for free. It is source, not an artefact, so it is committed with the PR like any other
file under `scripts/`.

## The bounds

- **`--project=mobile`'s viewport only** (390×844, `shot.mjs`'s default). This is a quick look, not the
  viewport-sensitivity check `CLAUDE.md` asks for separately when a change could behave differently by
  size — that is a real `--project=desktop` e2e run, not a wider screenshot.
- **Only the screens the diff actually touches.** A CSS change to `.shop` does not earn a shot of the map.
- **At most three screenshots.** A before/after pair for the screen that changed, plus one more only if the
  diff plausibly reaches a second screen (a shared class, a token in `design-language`).
- **A hard time cap.** Build once, keep the preview server up for every shot in the same review, then kill it
  — do not rebuild per screenshot. If reaching the screen needs more than a `flow-*.mjs` script and a couple
  of minutes of waiting, the diff needs the real e2e suite, not this skill.
- **Screenshots are PR/review evidence, never repository content.** Save them under `/tmp` (every existing
  `flow-*.mjs` already does) and attach them to the review comment or PR body; nothing under `scripts/output/`
  or similar gets committed.

## Before/after, not just after

`CLAUDE.md`'s two verdicts need different evidence:

- **The look must not change** (most performance and refactor work) — shoot the same screen on `main` and on
  the branch, at the same viewport, with the same seeded state (`flow-parents.mjs`'s seeded progress exists
  exactly so two runs are comparable), and say whether they differ. If they do not, that is the review's
  before/after evidence — merge it yourself, per `CLAUDE.md`, rather than asking the owner to approve a
  picture identical to the last one.
- **A genuinely new look** (art, skins, a redesigned effect) is `owner-approval`, decided by the owner looking
  at the real thing, not by a screenshot standing in for his verdict. A shot here is for your own review
  judgement on the way to labelling it, not a substitute for his `OWNER: APPROVED`.

## Owner-approval PRs: send the shot, don't just say how to make one (#184)

No cloud/routine session has a way to attach a binary image to a GitHub PR body, and screenshots are
explicitly never repository content (above) — so a `Closes`/`Part of` line reading "run `shot.mjs` yourself to
see it" is a real gap when nobody is watching the run that opened the PR. `SendUserFile` closes it: it
delivers a file into *the session*, not into a live chat specifically, so it is there whenever the owner next
opens that session — attended or not, exactly like the rest of a routine run's transcript.

So whenever a PR is labelled `owner-approval`, **in addition to** the reproduction steps a reviewer would use
(the `shot.mjs` command, per "Running it" above — that stays, and stays first):

1. Take the shot(s) yourself, following the bounds above (mobile viewport, at most three, only the screens
   the diff touches).
2. Call `SendUserFile` on the resulting PNG(s) before or right after opening the PR, with a one-line caption
   naming the PR.
3. Say in the PR body that the screenshots were sent to the session, so a reviewer reading it later (who
   cannot see that session) understands why there is no attached image on GitHub itself.

This is additive to the existing owner-approval process (`CLAUDE.md`), not a replacement for it: the owner's
verdict is still his own `OWNER: APPROVED`/`OWNER: REJECTED` comment, never inferred from anything a screenshot
shows.
