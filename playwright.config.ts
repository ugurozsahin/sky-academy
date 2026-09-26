import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
// The cloud dev container ships Chromium at a fixed path and blocks `playwright install`; a GitHub runner
// (and a laptop) has its own download under ~/.cache/ms-playwright. Point at the bundled binary only when it
// is really there, or CI launches nothing and every e2e test fails (ugurozsahin/sky-academy-private-archive#74
// review). PW_CHROMIUM overrides both.
const bundled = '/opt/pw-browsers/chromium';
const executablePath = process.env.PW_CHROMIUM || (existsSync(bundled) ? bundled : undefined);
// #123: this used to be a bare `4173` shared by `baseURL` and `webServer`, with `reuseExistingServer: true`.
// Two worktrees (the reviewer workflow `.claude/skills/using-git-worktrees` recommends) then attach to
// whichever server happened to start first, so the second worktree's tests silently run against the FIRST
// worktree's build — no error, a green or red run that is evidence about the wrong tree. `PW_PORT`/`PORT`
// still override it for anyone who wants one explicit port back; the default is derived from `process.cwd()`
// so two different checkouts get two different ports and mostly cannot collide, while re-running inside the
// SAME checkout still lands on the same port and keeps `reuseExistingServer`'s fast local loop.
// This narrows the collision, it does not by itself prove the served build is the right one — that is what
// `tests/e2e/00-build-identity.spec.ts` checks, loudly, every run (#123's "make the failure loud, not silent").
// Review of #187 (#123): `Number(x) || fallback` on a typo'd override (`PW_PORT=abc`) used to fail
// silently back to the hashed default with no warning that the explicit override was rejected — the exact
// "absence read as fine" shape this project keeps guard rails against. A malformed override is now a loud
// startup error instead.
const portOverride = process.env.PW_PORT || process.env.PORT;
if (portOverride !== undefined && !/^\d+$/.test(portOverride)) {
  throw new Error(`PW_PORT/PORT must be a plain integer port, got "${portOverride}"`);
}
const port = portOverride ? Number(portOverride) :
  4200 + (parseInt(createHash('sha1').update(process.cwd()).digest('hex').slice(0, 4), 16) % 300);
const baseURL = `http://localhost:${port}`;
/**
 * Epic #713 decision 5, and the owner's rule (2026-09-25): the game's e2e runs with 3-D off — the grown-ups'
 * setting `sna:three` stored as `off`, exactly as a parent sets it — so every test checks the game as it was
 * before #684, and none pays for software WebGL. The one flag-on group (`3-D solids …` in game.spec.ts) opts back
 * to `auto` with `test.use(THREE_AUTO)`. `tests/unit/guardrails.test.ts` holds every game project to it.
 */
// The key through a constant, never a `name: '…'` literal: the #141 rail reads every such literal in this file
// as a project name.
const THREE_KEY = 'sna:three';   // `THREE_SETTING_KEY` in src/three/mount/enabled.ts; the rail checks they agree
export const THREE_OFF = { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: THREE_KEY, value: 'off' }] }] };
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,   // #32: the suite now runs at 8× (tests/e2e set window.__SNA_FAST), so a flake is a real race to fix, not to silently retry
  // #483. Playwright's default parallelises across FILES only: the tests inside one file are a single
  // sequential chain on one worker. 97 of this project's 104 mobile tests live in tests/e2e/game.spec.ts, so
  // the whole e2e step was as long as that one chain no matter how many workers the runner offered — CI's
  // second worker finished duel.spec.ts inside the first minute and then idled for about six.
  // What the flag fixes is unambiguous, and it is worker UTILISATION rather than wall clock. Run
  // 35640634022, flag off: 107 tests summing 466 s of test time against a 416 s step on 2 workers — 56 %,
  // the idle worker. The same tree with the flag on reaches 98-99 % on every attempt.
  // What that is WORTH is much smaller on a runner than on a laptop, and the difference is contention:
  //   - the owner's Mac, --project=mobile at 2 workers: 204 s -> 120/123/123 s, and the test-time sum barely
  //     moves (226 -> 243 s). A big box runs two browsers for almost the price of one.
  //   - a 4-vCPU GitHub runner, the same commit re-run three times: 374 / 292 / 254 s, against a twelve-run
  //     flag-off baseline of 340-437 s (median 406 s). The test-time sum goes 466 s -> 575-731 s, so most of
  //     the reclaimed idle time is spent again on tests slowing each other down.
  // So: a real but noisy ~25 % there, ~40 % on a developer machine, and the mechanism is sound in both.
  // The honest reading of the runner numbers is that it is CPU-bound, not worker-bound — one Chromium plus
  // the preview server already uses most of 4 vCPUs. More parallelism on ONE runner cannot fix that; more
  // runners (--shard) could, and that is #81's territory and the owner's call, not this file's.
  // `workers` is deliberately left at Playwright's default (half the logical cores) — the numbers above are
  // what the runner already picks, and raising it is a separate decision to be measured on a runner.
  // What this costs: two tests now share a CPU, so a test whose assertion depends on real wall-clock pacing
  // can expose a race it used to hide (the frame counters below game.spec.ts:1184 and :1325, the 400 ms
  // flight sampling at :890). With `retries: 0` (#32) that surfaces as a red build, which is the intent —
  // a flake here is a race to fix, and the alternative is a green tick that means less.
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure', launchOptions: executablePath ? { executablePath } : {} },
  webServer: { command: `npx vite preview --port ${port} --strictPort`, url: baseURL, reuseExistingServer: true, timeout: 30_000 },
  // #116: a portrait tablet is neither of the two projects this file used to have. It is ~800 px wide, so it
  // crosses every `min-width: 600px` / `720px` rule the desktop layout uses (the island grid goes to three
  // columns, the parent dashboard to four stat tiles), but it is tall and touch-driven like the phone.
  // Nothing in CI had ever rendered one, which is the shared blind spot behind #107, #109 and #110.
  //
  // Each tablet project runs `tests/e2e/viewport.spec.ts` and nothing else, and mobile/desktop skip that one
  // file. The pairing is cost control, not tidiness: Playwright's `workers` defaults to half the logical
  // cores and an ubuntu-latest runner has 2, so a project runs end to end as its own sequential leg — #141
  // measured mobile at 2m43s and desktop at 4m00s. Two unrestricted tablet legs would be ~8 min a night on
  // the very bill #119 is about; restricted to one small spec they are seconds. The patterns and the touch
  // flags are written out per project rather than hoisted into a shared const so the guard rail in
  // tests/unit/guardrails.test.ts reads what each project actually declares, not the name of a variable.
  //
  // #486: at worker count >1 (#483) `00-build-identity.spec.ts` sorting first no longer means it RUNS first —
  // a second worker starts `game.spec.ts` in the same instant, so a wrong served build now prints its one
  // clear message alongside the fifty mysterious ones it exists to prevent instead of before them. `setup` is
  // Playwright's own answer: a project every other project `dependencies` on, which blocks them all until it
  // passes, at any worker count. It runs the identity spec ONLY (`testMatch`), and every other project now
  // excludes that file (`testIgnore`) so it is not also run a second time as part of their own leg.
  projects: [
    { name: 'setup', testMatch: /00-build-identity\.spec\.ts/, testIgnore: /viewport\.spec\.ts/, use: { defaultBrowserType: 'chromium' } },
    { name: 'mobile', testIgnore: [/viewport\.spec\.ts/, /00-build-identity\.spec\.ts/], dependencies: ['setup'], use: { storageState: THREE_OFF, ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    { name: 'desktop', testIgnore: [/viewport\.spec\.ts/, /00-build-identity\.spec\.ts/], dependencies: ['setup'], use: { storageState: THREE_OFF, ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'tablet', testMatch: /viewport\.spec\.ts/, dependencies: ['setup'], use: { storageState: THREE_OFF, defaultBrowserType: 'chromium', viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: 'tablet-landscape', testMatch: /viewport\.spec\.ts/, dependencies: ['setup'], use: { storageState: THREE_OFF, defaultBrowserType: 'chromium', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    // #715: the sketchbook's one spec — the screenshot script — under its own `testDir`, so `mobile`,
    // `desktop` and the tablets (all scoped to `tests/e2e`) never see it and the pull-request leg stays the
    // suite it was. It runs on the nightly with every other project (#141's rail) and on a pull request
    // only through ci.yml's sketch step, when the diff stays inside the sketchbook's paths. The `testIgnore`
    // is the #116 rail's shape for a non-tablet project; with its own `testDir` it has nothing to ignore. It
    // depends on `setup` like every other leg (#486): the identity spec proves the preview serves this dist/.
    { name: 'sketchbook', testDir: 'tests/sketch', testIgnore: /viewport\.spec\.ts/, dependencies: ['setup'], use: { defaultBrowserType: 'chromium', viewport: { width: 600, height: 600 }, deviceScaleFactor: 2 } },
  ],
});
