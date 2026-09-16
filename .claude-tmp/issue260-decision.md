## Owner decision — 2026-09-15, in session

The decision below is the owner's, taken in session and recorded here on his instruction by `https://claude.ai/code/session_01JQR4uSJy85N2iGnxobfqZL`. No agent writes an `OWNER:` marker; this is an `owner-input` issue, not an `owner-approval` pull request.

**Chosen: E, with a prerequisite — not "change nothing".** A, B, C and D are not adopted as written. The window does change, but second, and not into a shorter timer.

### 1. Why the window is not the first thing to fix

The arithmetic in this issue is right and the latency is real. What decided it is that the worked example argues against the issue's own recommendation.

Had the 16:37Z run adopted and cleared the 12:56Z block under option C, **`main` would have taken the speed-cap defect** instead — the one the 18:37Z review found and posted at 18:54Z: a global `900 px/s` cap that already throttles an 800×1180 tablet at `speedK = 1`, and under the `__SNA_FAST = 4` that the whole e2e suite runs at clears a wave in 23 frames instead of 50, apex `y` 688 in a 760-high arena. **52/52 green on mobile and on desktop.**

#161 condition 3 asks the adopter to re-derive **the original objection**, not to review the pull request. So every hour cut off the window is an hour of second look removed — and in the single case this issue measures, the second look is what caught the bug. Shortening the window before the first review is complete buys throughput by spending correctness.

### 2. Lands first: acceptance criteria become assertions, triggered by path

The rule: **every acceptance criterion in the issue either becomes an assertion in the pull request, or the pull request states why it cannot be and what was measured instead.** #108 said in so many words that collisions must not make a wave measurably faster or slower to clear; #255 asserted that at one geometry and one speed, and it was false at the others.

The measurement matrix is **opened by the diff's paths, not run for every change** — the owner's constraint is explicit: running everything on every change is waste.

| the diff touches | what the author measures and the reviewer re-runs |
| --- | --- |
| motion or timing — `src/game/arena.ts`, `src/game/session.ts`, any timing constant | before/after apex `y`, frames to clear, `\|v₀\|` at launch, across {390×760, 800×1180} × {`speedK` 1, 4} × stage 3, plus a rail pinning what must not move |
| storage or migration | a save round-trip across every version step |
| a workflow | the #236 rail pattern |
| anything else | today's rules, unchanged |

It is unit-level and browserless — seconds, not a suite run.

**Why `speedK = 4` is named:** `tests/e2e/game.spec.ts:173` sets `__SNA_FAST = 4` for the whole suite with eight opt-outs, so a defect that makes the game *faster* makes the suite pass *sooner*. That is a blind spot with a name, and it is exactly where #255's defect lived.

### 3. Then the window: replace the clock with run ordering

- A block set by a **routine run** is adoptable as soon as a **strictly later routine run** is the one reviewing. No timer at all. Routine runs do not overlap — cron `37 */2 * * *`, a run lives ~20–45 minutes — so a later run existing is *proof* the setter has finished, where four hours was only a guess at it. The #255 setter ended at 12:58:21Z, two minutes after its block.
- A block set by **any other session** — interactive, owner-spawned — keeps the 4-hour window. Those can genuinely come back.
- **#161 condition 3 is strengthened in the same change:** the adopter re-derives the original objection *and* runs §2's triggered measurement for the diff's paths. Adoption must never be shallower than review — that is what makes §3 safe, and it is why §2 comes first.

This also deletes the misalignment this issue opens with. Tonight repeated it exactly: the 18:54Z block becomes adoptable at 22:54Z, the 22:37Z run misses by **17 minutes**, and the realistic unblock is 00:37Z — 5 h 43 m, the same shape as the 19-minute miss at 16:37Z. With run ordering there is no arithmetic left to misalign.

### 4. What happens to this issue

- **This issue keeps §3 only** — the window — and stays `owner-input`, out of the routine queue, **until §2 is in force**. It is still a loosening, and its safety is now conditional on §2 rather than on a number.
- **§2 is not filed yet** and needs its own issue; it is ordinary tightening, so `routine-ok`.
- When §3 is implemented it lands in `CLAUDE.md`, `BACKLOG.md` and `docs/ROUTINE-PROMPT.md` together with the rail in `tests/unit/guardrails.test.ts`, as this issue's closing section requires.
- Unchanged, as the issue says: clearing a block on your own pull request stays forbidden, and a block with no session id stays unadoptable.

The issue's own warning was taken seriously in reaching this — that an agent proposing to loosen the rule slowing its own pull request is the shape of reasoning these rules distrust. The measurements were checked against the pull request and the workflow file rather than taken on trust, and the recommendation was not followed.
