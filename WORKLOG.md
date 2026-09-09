# Worklog

**Nothing reads this file.** It is a write-only record: a run appends a short entry so a human can read back
what happened and why, and then never opens it again. It used to be the handoff between runs, from before the
backlog moved to GitHub Issues — by 2026-09-07 it had reached 95 KB and ~24,000 tokens, every run read all of
it at STEP 1, and a run finally died on the token limit doing so. An unbounded thing that every run must
consume is the same failure this project has hit in five other places.

Everything a run actually needs is somewhere bounded:

| what a run needs | where it is |
|---|---|
| what to work on next | issue #46, the owner's ordered list |
| what is already in flight | the open pull requests |
| why a change was made the way it was | that PR's description and its review comments |
| what happened when | `git log`, and the PRs it references |
| whether the routine is alive | the `routine: heartbeat` issue (the watchdog reads it) |
| whether the watchdog is alive | the `watchdog: heartbeat` issue (the routine reads it) |

Older entries are archived per month under `docs/worklog/`. Archive the current month and start a fresh file
whenever this one passes ~40 KB; nothing depends on its contents, so archiving can never break a run.

<!-- Entries below, newest at the bottom. Keep them short: PRs reviewed/merged, item developed + PR link,
     tests, guard-rail budgets changed. Anything a future run must act on belongs in an issue, not here. -->

## 2026-09-09 ~12:1x (reviewer session — a different agent from the #132 developer)

- **PR #132 merged to `main` (`3615850`, squash) — #48 tap-to-pop ninja star.** Re-application of the closed PR #60 on today's `main`, per the owner's 2026-09-09 decisions on #48. A single tap throws the avatar's own projectile from the bottom of the arena; it flies 150 ms (`SHOT_FLIGHT`) and pops the bubble on landing. Score, lives, the outcome reveal and the `__sna` hooks all settle **at the tap**, so the flight is decoration; a tapped bubble that falls off screen mid-flight is not a miss. Swipes are untouched. Ten per-element `SHOT_STYLE` projectiles (shuriken for Kai/Dusk/Master, fireball, orb, bolt, rock, leaf, shard, star, laser), element-particle wake, `sfx.whoosh()` on throw and the element slice + haptic on landing. `PlayState.shots` added to the `__sna` contract.
- **The #60 review's blocking TNT bug is designed out, not patched.** `hitBubble` consults `throwFor(b)` *before* `cb.onHit`; `play.ts` answers `false` for the `BOMB`, so a tapped 💣 never creates a `Shot` — one burst, immediately, `life` sound only. No double explosion, no slice sound rewarding the hit, no exploded bomb flying on. The bomb knowledge stays in `play.ts`; the arena stays generic. `clearWave()` also drops shots, and `landShot` bursts *and* sounds only when the bubble really pops.
- **Four review passes, three of them blocking** (reviewer ≠ developer, per the scrum rule). Worth recording because two of the three were invisible to `npm test` and `tsc`:
  1. The TNT e2e pinned "question 6" once, but a bomb never rides a sequence question and Sky Storm draws its topic at random — 2 of the 29 year-2 topics are sequences, so a ~7% per-project flake that failed *hard* (lives run out before the next bomb wave). Fixed with a retry that resets `questionsAsked` each attempt.
  2. The replacement wait returned `JSON.stringify({bomb:false})` — **truthy** — so it resolved on the first frame a bubble launched, before anything could be in range. Deterministic red. Fixed to boolean/`null` predicates reading `arena.bubbles` (which includes unlaunched bubbles, so a bomb riding the second batch is seen).
  3. The edit that fixed (2) ran past the end of the function and **deleted `solveCurrent`, `waitForWrongOrEnd` and `answerAll`** — 15 call sites across 10 of the 38 tests. `tsconfig.json` includes only `src` and `tests/unit`, so `tsc` never reads the e2e spec and Vitest never loads it: both local checks stayed green. **`npx playwright test --list` compiles every spec without launching a browser** and catches exactly this; it is now part of the pre-push checks. Worth considering as a CI step or a rail in its own right.
- **Owner-approval gate armed for the first time in anger.** The PR needed the owner's sign-off on the projectile art but carried only the area labels `art`/`playtest`; the `owner-approval` label did not exist in the repo. Created and applied, so `scripts/review-gate.mjs` held the merge red until he wrote `OWNER: APPROVED` (he did, himself, 12:08:12Z, after playing the preview build).
- **A relayed `OWNER: APPROVED` was blocked and withdrawn.** An agent posted the marker as a clearly-flagged relay of the owner's session message. CLAUDE.md's *"No agent ever writes those markers"* has no relay exception, and the reason is structural rather than about honesty: a flagged relay and a fabrication are the same bytes to every later reviewer, and the gate had *already* gone from three block reasons to two on the strength of it. The reviewer kept the block; the relay was edited to drop the marker; the owner posted his own. `review-gate.mjs:24-30` already names the durable fix — a second identity (machine account) so agents cannot produce his markers at all. **That deserves its own issue.**
- Tests on the merged head: CI green (unit + guard rails, build, **e2e mobile + desktop**). Mac: `playwright test --list` 74, `tsc --noEmit` clean, `npm test` **438/438**, build ok. **No guard-rail budget moved** — `shadowBlur` 0, `as any` 0, `drawBubble` still free of per-frame gradients/`measureText`; no dependency added.
- **PR #60 confirmed closed as superseded** (closed 10:33:12Z, never merged); its diff and review comment stay readable as the reference. Issue #48 closed by the merge, all six checklist boxes ticked.
- **Not done here, by instruction:** the artifact was **not** republished — the scheduled publisher task owns that, and it will pick this up from `main`.
