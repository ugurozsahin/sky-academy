# Worklog — autonomous runs

Append one dated entry per run (newest at the bottom). Keep entries short: what changed, tests, commits, next.

## 2026-09-06 00:30 (interactive session)
- v0.3 pushed to GitHub (ugurozsahin/sky-academy, main). Hourly routine to be created on claude.ai/code/routines with this repo attached.

## 2026-09-06 03:40 (hourly routine, cloud)
- Backlog #5 done: first-play tutorial — `#tutorial` element (CSS hand + demo bubble pop + "Slice the bubble!"), spoken cue, first wave held 1.8 s, hides on first hit (or after 9 s); `tutorialSeen` flag in save data (old saves migrate to `false`).
- Backlog #6 done: `voiceScore`/`chooseVoice` in `audio.ts` rank en-GB child/warm/natural voices first (Maisie > Libby/Sonia/Google UK Female > …), Apple novelty voices excluded; voices-not-loaded-yet no longer pins `null`. Tap anywhere on the question card = repeat aloud (pulse animation).
- Bug found & fixed in `arena.ts`: slice hit-test used the fading visual trail, so a finger that paused >280 ms lost its next segment. Now tracks `lastPt` separately.
- e2e: "real swipe" test was flaky on baseline (3/4 fails here) — pointer round trips take 400–800 ms under headless software rendering so bubbles drifted through/away from the stroke. Test now freezes the wave via the arena hook and approaches from a clear side; 8/8 passes.
- Skipped (owner input): #1 playtest, #2/#3 owner art, #4 bubble skins (visual style decision).
- Tests: unit 191/191, tsc clean, e2e mobile 14/14, e2e desktop 14/14. Commit 2a84fda (main).
- Next: Proposed P1 (Ninja Sprint) or Next #9 (Y1/Y2 shape/measure/statistics topics) — both need no owner input.

## 2026-09-06 04:40 (hourly routine, cloud)
- Backlog P1 done: **Ninja Sprint** — `mode: 'sprint'` in `session.ts` (60 s clock via `tick(ms)`/`onTime`, no lives, 10 pts + combo bonus, difficulty ramps 1→2→3 at Q5/Q12, steady stage-2 speed; stars 1/6/12 correct, coins = correct + 5×stars). `storage.sprint` per-year best + `recordSprint()` (old saves migrate). Island screen: "Ninja Sprint" button under Sky Storm showing best. Play HUD: timer pill replaces hearts, turns red + pulses at ≤10 s, ticks at 3-2-1; clock freezes while paused. Results: "Time's up!", stars, "🏆 New best!" pill.
- Tests: unit 196/196 (+4 sprint session, +1 storage), tsc clean, e2e mobile 15/15 (+1 sprint test: no lives lost, clock pauses, fast-forward → results → best saved).
- Skipped (owner input): #1 playtest, #2/#3 owner art, #4 bubble skins.
