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

## 2026-09-06 06:40 (hourly routine, cloud)
- Backlog P4 done: **Memory Match** — `src/game/memory.ts` (pure `Memory` class: flip/hide/match, turns, streak bonus score, stars by turns-per-pair, coins = 2×pairs + 5×stars; `THEMES` decks per island with distinct faces: R count/shapes/words, Y1 words/coins/2-D shapes/doubles, Y2 words 21–99/coins incl. £1 £2/3-D shapes/2-5-10 tables) + `src/ui/memory.ts` (DOM card grid with 3-D flip, each face spoken on flip, toasts, results modal with stars/coins/stickers/streak, `__sna.cards()/flip()/state()` hooks). `storage.memory` counts boards per year (`recordMemory`); island screen gets a "Memory Match" button.
- Backlog P5 done (and Next #10 as the same feature): **Story Sentences** — `sentenceQ()` in `writing.ts` builds word-bubble sequence questions (`r-sentence`, `y1-sentence`, `y2-sentence`; 3–7 words, 1–3 decoys, never a repeated label). Reception always sees the sentence on the card; Y1/Y2 see it at d1, then listen-and-build (picture emoji only). Generic curriculum test now accepts space-joined sequences; targeted test checks word uniqueness, capital/end mark, decoys and length.
- Test hygiene: pool-based session tests (sprint, boss) sliced `answer` on whatever the seeded pool drew; they now use a `solve()` helper that slices sequences item by item, so adding topics can't break them.
- Tests: unit 227/227, tsc clean; e2e mobile full run 17/17 after Memory Match; after Story Sentences the 6 sequence-affected tests (sentence, spelling, Storm, Sprint, Boss, Memory) 6/6 and sentence+Storm ×2 4/4 (Storm was flaky once on the first run, passed on retry — same renderer timing as before). Desktop e2e not run (time).
- Commits: cc84fea (Memory Match), 8401e7e (Story Sentences) — main.
- Skipped (owner input): #1 playtest, #2/#3 owner art, #4 bubble skins, P9 costumes (art).
- Next: P6 Sound Hunt (phonics by ear, no owner input) or Next #9 (Y1/Y2 measurement & statistics topics); P7 adaptive practice after that.

## 2026-09-06 07:40 (hourly routine, cloud)
- Backlog P6 done: **Sound Hunt** — `r-soundhunt` (d1 phase 2 sets 1–4, d2 all single-letter sounds + qu/x, d3 phase 3 digraphs/trigraphs) and `y1-soundhunt` (d1 phase 3, d2 phase 5 alternatives ay/ou/ie/ea/oy/ir/ue/aw/wh/ph/ew/oe/au, d3 + split digraphs a-e/i-e/o-e/u-e). Three keyword words are spoken ("Listen: sun, sock, sad. Which sound do they start with?"), the card shows only "🔊 Listen!" + a position hint, no visual. Decoys never share the answer's phoneme family (c/k, ai/ay/a-e, ee/ea, oi/oy, ur/ir/er, or/aw/au, oo/ue/ew, w/wh, f/ph). New `Question.listen`: with read-aloud off the card shows the three words instead (play.ts).
- Backlog P7 done: **Train with Sensei** — `src/game/sensei.ts` `weakestTopics()` (accuracy ↑, stars ↑, plays ↑; unplayed topics fill in; never tracing). Island button "Train with Sensei" (icons of the 3 picked topics, session count) starts a normal 5-stage mission over that pool; the card names each question's topic. `Session.byTopic` tallies hits/tries per topic in every mode and results call `recordAccuracy()` (new `TopicProgress.hits/tries`, old saves fall back to stars); `storage.training` counts completed sessions.
- Housekeeping: deleted `undefined/*.png` (2.6 MB of screenshots committed by the 04:40 run with an unset output dir).
- Tests: unit 239/239 (+7 Sound Hunt, +3 sensei, +1 session, +1 storage), tsc clean, e2e mobile 19/19 after Sound Hunt and 20/20 after Sensei (full runs). Desktop e2e not run (time).
- Commits: 58f335a (Sound Hunt + cleanup), b9da44a (Sensei) — main.
- Skipped (owner input): #1 playtest, #2/#3 owner art, #4 bubble skins, P9 costumes (art).
- Next: P8 Dojo challenges (daily 3 missions, bonus coins, streak multiplier — no owner input) or Next #9 (Y1/Y2 measurement & statistics topics); P10 Ninja Duel after that.

## 2026-09-06 08:40 (hourly routine, cloud)
- Backlog P8 done: **Daily Dojo** — `src/game/dojo.ts` (pure): 14-challenge pool in three groups (volume: answer 15/20/25 right · mode: 2 missions / Sprint / Boss KO / Storm 80 / Memory board / Sensei · focus: 5-combo / 3 stars / no slips / 6 writing / 10 maths), three picked per day from a date-seeded rng (same set for every island), `applyEvent()` moves progress from a finished game's result (capped at the goal), pays +10 🪙 per challenge once and +25 🪙 for the set, multiplied ×1.25 per consecutive completed dojo day (carried streak, cap ×2). `storage.dojo` rolls over per day (streak/lifetime total survive), `dojoToday()`/`recordDojo()`. Sky map gets a Daily Dojo card (progress bars, ✓ + bonus, streak pill, set-bonus footer); play and Memory results show "Dojo challenge done!" / "Daily Dojo complete!" rows; bonus coins go through `addCoins` so stickers unlock. The session's own `.coin-gain` stays separate.
- Backlog P11 done: **Mission certificate** — `src/ui/certificate.ts`: `certificateText()` (pure wording, en-GB long date) + `drawCertificate()` (1200×850 canvas: sky, parchment card in the avatar's glow colour, auto-fitted name, mission/island line, stars, accuracy, date, avatar art) + `shareCertificate()` (Web Share with files on phones, else download). "🎓 Certificate" button on the results of a won mission / Sensei session; `__sna.certificate()` returns the PNG data URL. Rendered and eyeballed in headless Chromium (Fredoka falls back to the system font there because Google Fonts is blocked in the sandbox; on devices the web font is used).
- Next #15 done: **Haptics** — `haptic(kind)` in `audio.ts` with patterns for slice / correct / wrong / life / stage, gated by the sound toggle, never throws; wired to swipe hits, wrong slices, lost lives and stage clears.
- e2e fixes: the full-mission test now adds today's dojo bonus to the expected coin total (bonuses ≤ 55 so the sticker count stays 3); `waitForWrongOrEnd` waits for a real decoy in flight — at Q6 of Sky Storm only the target and the TNT bubble may be launched, and `wrong()` refuses the bomb (failed twice in the full run before the fix, 2/2 after).
- Tests: unit 248/248 (+6 dojo, +2 certificate, +1 haptics), tsc clean; e2e mobile full run 19/21 before the two test fixes, then the affected tests (full mission, Storm, Dojo) 6/6 with `--repeat-each 2`, full mission again 1/1 with the certificate, play-path smoke after haptics (see commit). Desktop e2e not run (time).
- Commits: e1a7b9b (Daily Dojo), cf2d748 (certificate), 33d84d1 (haptics + worklog) — main.
- Skipped (owner input): #1 playtest, #2/#3 owner art, #4 bubble skins, P9 costumes (art).
- Next: P10 Ninja Duel (two-player split screen — sketch: two `Arena`s stacked on one canvas or two canvases, same question, first correct slice wins the point, best of 10; needs a duel HUD and a pure `Duel` scorer) — a full run's worth; alternatives if time is short: Next #9 (Y1/Y2 shape, measurement, statistics topics), #13 PWA.
## 2026-09-06 08:00–09:40 (interactive session with the owner)
- Reviewed the night's runs; unit 239/239, tsc clean, e2e mobile 20/20 + desktop 19/20 (1 flaky: gentle-reception wave took >30 s to fall under software rendering, passed on retry). Artifact republished from 029eeb7.
- Owner prioritisation (AskUserQuestion): top items = playtest, Dojo, Y1/Y2 shape-measure-statistics, parent dashboard; Y3–Y6 by the routine in the background; reward system judged insufficient (nothing to spend coins on); routine continues hourly, no Vercel.
- Playtest round 1 fixes → 85711b9: **outcome beat** (`arena.reveal()`: frozen wave, ✓/✗ spotlight, ghost bubble, card fills the answer via `fillAnswer`, HOLD 1 s/1.8 s/1.5 s + gap; sprint brisk), **batched waves** for long sentences (no overlap; next word always in the first batch), Master Ninja art → `public/avatars/sensei.webp`. Tests: unit 241, e2e mobile 22/22.
- Code review (separate subagent; debt / performance / maintainability): 20 findings → issues #26–#45.
- **Backlog moved to GitHub Issues** (#1–#47, order in #46, labels + scrum checklist in every issue: Develop → Review/QA by a different agent → Owner action → Done). `BACKLOG.md` is now a pointer; new routine prompt in `docs/ROUTINE-PROMPT.md` (owner must paste it into the routine and set `GITHUB_TOKEN` on it).
- Open owner feedback captured as issues: Trace Words too lenient (#4), British English audit (#47), Lessons concept (#10, plan together later), Master Ninja role = Sensei + unlockable avatar (#5), coin shop scope (#6).
- Next (this session): #4 tracing fix, review/QA of 85711b9 by a fresh subagent, then #5.
- 10:15 — #4 Trace Words: per-letter masks (`mask[i] = letter+1`), pure `scoreTrace()` (every letter ≥ 55 %, word ≥ 65 %, outside ≤ 45 %), hint names the skipped letter, `autoTrace(letters?)` hook, Tracer removes its canvas listeners (review #39). Unit +5, e2e +1 (all-but-last letter must fail). Rebased onto the 08:40 run (Dojo, certificate, haptics → issues #7/#17/#19 closed, QA pending by the next run).
