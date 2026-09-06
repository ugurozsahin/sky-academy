# Sky Ninja Academy — project context

Slice-the-answer learning game for UK Reception / Year 1 / Year 2. Mobile-first, also desktop. English only.
Owner priorities: playability, fun, visuals must look professional (art supplied by owner), tests at every step, low token use.

## Stack
Vite + vanilla TypeScript (no framework), canvas arena, DOM HUD, localStorage. Vitest (unit) + Playwright (e2e, mobile + desktop projects).
`npm run dev` · `npm test` · `npm run build` · `npm run test:e2e` · `npm run test:all` · `node scripts/bundle-single.mjs` (single-file build).

## Layout (read only what you need)
- `src/curriculum/` — `types.ts` (Question/Topic model, YEARS), `maths.ts`, `writing.ts` (pure generators `(difficulty, rng) => Question`), `util.ts` (numQ/wordQ/distractors), `index.ts` (registry). See `docs/CURRICULUM.md` for the NC map.
- `src/game/` — `arena.ts` (bubbles, slicing, particles), `session.ts` (stages/lives/score, pure logic), `tracing.ts` (letter tracing).
- `src/ui/` — `avatar.ts`, `home.ts` (mapScreen = islands, islandScreen = topics), `play.ts` (HUD + overlays + `window.__sna` test hooks), `visuals.ts` (ten-frames, coins, clocks…), `dom.ts`.
- `src/avatars.ts` (roster, `fx` element style, praise lines; art in `public/avatars/*.webp`), `src/audio.ts` (synth SFX + speech), `src/storage.ts`, `src/style.css`.
- `tests/unit/*.test.ts`, `tests/e2e/game.spec.ts`, `scripts/` (screenshots, single-file bundle, art extraction).

## Rules
- Every topic generator must pass `tests/unit/curriculum.test.ts` (answer in options, unique options, arithmetic verified, KS1 ranges). Add a topic = add generator + registry entry (see `.claude/skills/add-topic`).
- Difficulty 1/2/3 = mission stages. Reception is "gentle" (missed bubbles cost no life). Keep numbers within NC ranges (R ≤10, Y1 ≤20, Y2 ≤100).
- `window.__sna` hooks (`answer()`, `wrong()`, `bubbles()`, `state()`) are the e2e contract — keep them working.
- Don't add dependencies without reason; no external assets except Google Fonts (Fredoka) and `public/avatars`.
- Keep files small; prefer editing existing modules over new abstractions. Run `npm test` after logic changes, `npm run test:e2e` after UI changes.
- Backlog lives in `BACKLOG.md` — the owner prioritises it; don't reorder it yourself.
- Env note: on the Mac-side Linux VM used by scheduled runs, Playwright browsers cannot be downloaded (network allowlist) — run unit tests + tsc there; e2e runs in cloud sessions.
- Git remote: github.com/ugurozsahin/sky-academy (branch main). Hourly routine clones it in the cloud and pushes to main; after it runs, refresh this folder with `git pull --ff-only`.
- Never delete or unset `.git/github-credentials` / `credential.helper store --file=.git/github-credentials` in the owner's Mac folder — it is the owner's token file that lets Claude sessions pull/push from the Mac-side VM.
