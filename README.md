# Sky Ninja Academy

A slice-the-answer maths and writing game for **Reception, Year 1 and Year 2** — England's EYFS and Key
Stage 1 National Curriculum. Questions rise as bubbles; the player swipes through the right one. Mobile-first
and touch-driven, and it works on a desktop browser too.

87 topics across the three years, split between maths and writing. Every question is generated rather than
listed, so a topic is a small pure function of a difficulty and a seeded random number generator — a child
does not meet the same worksheet twice. `docs/CURRICULUM.md` maps them onto the curriculum.

It is offline-first: no accounts, no server, no runtime dependencies, and progress lives in `localStorage`.

## Running it

```
npm install
npm run dev        # http://localhost:5173 — use the Network URL to open it on a phone
npm run build      # type-check, then dist/
npm run preview    # serve the built dist/
```

`npm run dev` binds to every interface on purpose: the game is designed for a phone, and the fastest way to
judge a change is to open the Network URL on one.

## Tests

```
npm test           # Vitest: question generators, session logic, guard rails
npm run test:e2e   # Playwright: real play-throughs
npm run test:all   # unit + build + e2e
```

The e2e suite drives a real browser through whole sessions across four viewport projects — a phone, a
desktop, and a tablet in both orientations. It runs at 4× speed through a test hook rather than by waiting,
and it does not retry: a flake here is a race worth fixing.

## Building for a phone

```
node scripts/bundle-single.mjs
```

That inlines the JavaScript, the CSS and the fonts into one self-contained HTML file with no external
requests at all — the form to hand someone directly, or open from a file manager with no network.

For a real Android package, the "Android APK" workflow builds one through Capacitor; `docs/ANDROID.md` has
the setup and the signing story.

## Where things are

| | |
|---|---|
| `src/curriculum/` | the question generators, one module per subject, and the topic registry |
| `src/game/` | the arena (bubbles, slicing, particles), session logic, letter tracing |
| `src/ui/` | screens, HUD, overlays, avatars, the drawn visuals — ten-frames, coins, clocks |
| `public/avatars/` | the twelve ninja characters |
| `tests/` | unit tests and the Playwright specs |
| `scripts/` | the single-file bundler, screenshots, and operational tooling |

`CLAUDE.md` has the project context and the conventions a change is held to.

## Licence

**The code is MIT.** See [`LICENSE`](LICENSE) — take it, build something with it.

**The artwork and the game's written content are not.** The twelve character illustrations under
`public/avatars/` and the icons under `public/icons/` are **not licensed**: all rights in them are reserved,
along with the name "Sky Ninja Academy", the game's visual identity and its written text. The split is
deliberate and it is the usual one for a game: the engine is worth sharing, the characters are not mine to
give away twice. `LICENSE` states exactly what falls each side of the line.

Planning a commercial adaptation? Please get in touch first — that is an ask, not a licence condition.

Two third-party components carry their own licences, and they apply whatever the above says: **Fredoka**
under the SIL Open Font License 1.1 (`public/fonts/OFL.txt`), and a vendored `frontend-design` skill under
the Apache License 2.0 (`.claude/skills/frontend-design/LICENSE.txt`).
