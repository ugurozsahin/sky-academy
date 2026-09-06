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
- Backlog P2 done: **Boss Battle** — `mode: 'boss'` (`BOSS_HP = 8`): correct slice → `bossHp−1` + `onBoss('hit')` (villain shake, white flash), wrong/miss → heal +1 capped at max + taunt; lives work as in missions (Reception gentle); `enraged` at ≤3 HP → stage-3 speed; TNT bubbles like Sky Storm; KO ends won, stars by accuracy (90/70 %), coins = correct + 5×stars + 20. `storage.boss` counts KOs per year (`recordBossWin`). Island button "Boss Battle · KOs n"; HUD health bar over Hammer Man (turns amber when low); results: "Knock-out!" + Hammer Man tumbling off with a K.O. stamp, or "Hammer Man wins this round".
- Tests: unit 199/199 (+2 boss, +1 storage), tsc clean, e2e mobile 16/16 (+1 boss test), e2e desktop 16/16.
- Commits: 915dd6b (Ninja Sprint), fdbde37 (Boss Battle) — both on main.
- Next: P3 Balance the Scales (new topic + scales visual) — no owner input needed.

## 2026-09-06 05:40 (hourly routine, cloud)
- Backlog P3 done: **Balance the Scales** — new `scales` visual (`{ type: 'scales', left, right }`: beam + fulcrum SVG, two hanging pans, pillar) in `visuals.ts`/`style.css`; `balanceQ()` helper + three topics: `r-balance` (objects on one pan, `?` on the other; d3 `a = b + ?` with objects), `y1-balance` (d1 `a + b = ?` / `? = a + b`; d2 `a + b = c + ?`; d3 adds `a − b = ? + c`, `a + b = ? − c`, all within 20), `y2-balance` (d1 within 20; d2 2-digit ± ones/tens vs `c + ?`; d3 adds `n × t = ? + c` for 2/5/10 tables and `a + b = ? − c`, within 100). Distractors include the classic mistake (answer = left total) and the other operand.
- Tests: targeted unit test evaluates both sides of every balance prompt with `?` filled in (200 × 3 difficulties × 3 topics) and checks year ranges; e2e visuals test now also opens `y1-balance`, expects two pans and scores via the hook.
- Fixed a fragile unit test: endless-session test sliced `answer` for sequence questions (Order Up), silently losing lives before the deliberate wrong slices; it now slices sequences letter by letter and asserts full lives first.
- Docs: `docs/CURRICULUM.md` lists the three topics.
- e2e robustness: the random-pool tests (Sky Storm, Sprint, Boss) sliced `answer` once per question, which hangs on an Order Up / spelling sequence and, when the headless renderer stalls and a wave is missed, the "3 wrong slices" loop waited on a game that had already ended (seen once here: stuck at Q6 "Is it raining_"). New `solveCurrent()` / `waitForWrongOrEnd()` helpers slice sequences letter by letter and stop when the game ends.
- Commit: c54d6db (main).
- Tests: unit 209/209, tsc clean, e2e mobile: full run 14/16 before the e2e fixes (both failures analysed above), then the 4 touched tests 8/8 with `--repeat-each 2`. Desktop e2e not run (time).
- Skipped (owner input): #1 playtest, #2/#3 owner art, #4 bubble skins.
- Next: P4 Memory Match (non-slice card mode; needs a new screen, no owner input) or Next #9 (Y1/Y2 measurement & statistics topics).
