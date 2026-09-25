import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { workflowFiles } from './helpers/sources';

/**
 * WORKFLOW RAILS (#321, split out of `guardrails.test.ts`) — everything that reads `.github/workflows/**`
 * and `playwright.config.*`. Unchanged by the split.
 *
 * The readers come from `tests/unit/helpers/sources.ts`, which is where every rail file gets them: Vite's
 * glob does not reach `.github/`, so these files are read from disk, and `workflowFiles()` throws rather than
 * returning `[]` — an empty read would make every rail here pass vacuously, which is the exact failure they
 * exist to prevent.
 *
 * A handful of workflow assertions still sit inside the `guard rails` describe in `guardrails.test.ts`,
 * interleaved with `src/` rails in the same `it`. Extracting those would mean rewriting them, and #321 is
 * explicitly a move and not a rewrite, so they stayed.
 */


/**
 * #123: `playwright.config.ts` used to hard-code `localhost:4173` in both `use.baseURL` and `webServer`,
 * with `reuseExistingServer: true`. Two worktrees reviewing two pull requests then attach to whichever
 * server happened to start first — the served app comes from one checkout, the spec file from another, and
 * nothing anywhere says they disagree. It cost a routine run four fabricated test failures before it was
 * caught (see the issue). These two rails hold the fix in place: the port must be derived rather than a bare
 * literal shared with `reuseExistingServer`, and a real e2e test must fail loudly the moment the served build
 * and the local `dist/` disagree, so the failure mode becomes impossible to miss instead of merely rarer.
 */
describe('the e2e server proves it is serving the build on disk, not a leftover from elsewhere (#123)', () => {
  const config = readFileSync(new URL('../../playwright.config.ts', import.meta.url), 'utf8');
  const spec = readFileSync(new URL('../../tests/e2e/00-build-identity.spec.ts', import.meta.url), 'utf8');

  it('reuseExistingServer is still true — this is a port-collision fix, not a removal of the fast local loop', () => {
    expect(config).toMatch(/reuseExistingServer:\s*true/);
  });

  // Review of this PR (#187): matching the derivation tokens anywhere in the file — including the comment
  // above the code, which already contains all three — let a partial revert that guts the actual wiring
  // while leaving the prose pass every check here. `use:`/`webServer:` must be built from the SAME
  // identifier (`baseURL`, `port` or the raw expression), not merely mention derivation somewhere.
  it('baseURL and webServer are wired to the same derived value, and it is not the bare literal 4173', () => {
    expect(config, 'the exact incident #123 names: one hard-coded port two checkouts can both bind')
      .not.toMatch(/localhost:4173/);
    expect(config, 'a derivation must exist — cwd-based by default, with an env override')
      .toMatch(/createHash|process\.env\.PW_PORT|process\.env\.PORT/);
    const useBlock = config.match(/use:\s*\{[^}]*\}/)?.[0];
    const serverBlock = config.match(/webServer:\s*\{[^}]*\}/)?.[0];
    expect(useBlock, '`use: {...}` must exist and be read from disk').toBeTruthy();
    expect(serverBlock, '`webServer: {...}` must exist and be read from disk').toBeTruthy();
    // `baseURL` is used as a shorthand property (`{ baseURL, ... }`), so a colon is not required — what must
    // NOT be true is a hard-coded `http://localhost:<port>` string literal sitting where the identifier
    // belongs, which is exactly what a partial revert (fix the comment, forget the wiring) would leave behind.
    expect(useBlock, 'use.baseURL must reference the derived value, not a re-typed literal').toMatch(/\bbaseURL\b/);
    expect(useBlock, 'and must not be a hard-coded URL string sitting next to it').not.toMatch(/baseURL:\s*['"`]http/);
    expect(serverBlock, 'webServer.url/command must reference the same derived value').toMatch(/baseURL|\$\{port\}/);
    expect(serverBlock, 'and must not hard-code a URL/port string either').not.toMatch(/url:\s*['"`]http:\/\/localhost:\d/);
  });

  // Review of this PR (#187): checking that ingredient substrings appear (the hash regex, the fetch call)
  // never confirmed the actual comparison exists — a regression swapping `.toBe(local)` for e.g. `.toBeTruthy()`
  // on `served` alone would still pass every check that only grepped for ingredients.
  it('the identity spec actually compares served vs local, not just gathers both and stops', () => {
    expect(spec.length, 'must be a real test, not an empty placeholder').toBeGreaterThan(500);
    expect(spec, 'the comparison is the build-sw.mjs cache name, not a weaker liveness check')
      .toMatch(/sna-\[0-9a-f\]\{12\}/);
    expect(spec, 'must read the locally built service worker').toMatch(/dist.*sw\.js/);
    expect(spec, 'must actually fetch the served one over the network, not just assume it')
      .toMatch(/page\.request\.get/);
    expect(spec, 'and the failure message must tell a human what to do about it, per #123\'s own ask')
      .toMatch(/vite preview/);
    expect(spec, 'must assert served equals local — gathering both and never comparing them is not a check')
      .toMatch(/\)\.toBe\(local\)/);
  });

  // #486: at worker count >1 (#483) the identity spec sorting first no longer means it RUNS first — a
  // second worker starts `game.spec.ts` in the same instant, so the one clear message it exists to print
  // arrives alongside the fifty mysterious ones instead of before them. The fix is a `setup` project every
  // other project `dependencies` on: nothing starts until it passes, at any worker count. This test replaces
  // the old #123-era one, whose invariant it inverts — the identity spec used to have to run INSIDE
  // `mobile`/`desktop`'s own leg; it must now run OUTSIDE it, exactly once, in `setup`. It reads the
  // RESOLVED config object (the way the #483 rail above it does), not the source text, so a glob string or
  // an array of patterns is judged the way Playwright itself would judge it, not the way one particular
  // spelling of a regex would print.
  it('the identity spec runs once, in a setup project every leg depends on, not inside the legs themselves (#486)', async () => {
    const cfg = (await import('../../playwright.config')).default;
    const filename = '00-build-identity.spec.ts';
    const byName = (n: string) => cfg.projects?.find((proj) => proj.name === n);
    // This repository's own convention (every testMatch/testIgnore in the file today) is a bare RegExp or an
    // array of them, never a glob string — so that is the only shape this helper has to judge correctly.
    const asRegexes = (pattern: string | RegExp | (string | RegExp)[] | undefined) =>
      (Array.isArray(pattern) ? pattern : pattern ? [pattern] : []).filter((p): p is RegExp => p instanceof RegExp);
    const runsHere = (proj: ReturnType<typeof byName>) => {
      const ignore = asRegexes(proj?.testIgnore);
      if (ignore.some((r) => r.test(filename))) return false;
      const match = asRegexes(proj?.testMatch);
      return match.length ? match.some((r) => r.test(filename)) : true;   // no testMatch: Playwright's own "everything in testDir"
    };

    const setup = byName('setup');
    expect(setup, 'a `setup` project must exist to run the identity spec before every other project (#486)').toBeTruthy();
    expect(runsHere(setup), '`setup`\'s own patterns must actually select the identity spec, or nothing runs it at all')
      .toBe(true);

    for (const name of ['mobile', 'desktop']) {
      const p = byName(name);
      expect(p, `'${name}' must still be declared`).toBeTruthy();
      expect(runsHere(p), `'${name}' must no longer run the identity spec itself — 'setup' already does, and running it ` +
        'twice is dead weight the nightly pays for every night (#486)').toBe(false);
      expect(p?.dependencies ?? [], `'${name}' must depend on 'setup', or nothing stops it starting before the identity ` +
        'check has run — exactly the #486 regression this project exists to close').toContain('setup');
    }
    for (const name of ['tablet', 'tablet-landscape']) {
      expect(byName(name)?.dependencies ?? [], `'${name}' must depend on 'setup' too, the same as the other legs (#486)`)
        .toContain('setup');
    }
  });
});


/**
 * #111 — the "Android APK" run carried two warning annotations on every run: six actions pinned at a major
 * that GitHub was forcing onto Node 24 despite targeting Node 20, plus `setup-java@v4` specifically flagged as
 * no longer receiving updates. Bumped every one of those six, in all three workflow files (`ci.yml` and
 * `review-gate.yml` share `actions/checkout` and pick up their own Node-20-only actions too), to the first
 * major release of each that ships `runs.using: node24` (confirmed against each action's own `action.yml` on
 * GitHub, not assumed from a changelog): `actions/checkout` v4→v5, `actions/setup-node` v4→v5,
 * `actions/setup-java` v4→v5, `actions/upload-artifact` v4→v6 (v5 still targets Node 20 — the jump is
 * deliberate, not a typo), `android-actions/setup-android` v3→v4, `gradle/actions/setup-gradle` v4→v5,
 * `softprops/action-gh-release` v2→v3, `actions/github-script` v7→v8. Checked each bump's `inputs:` against
 * what this repository actually passes (`distribution`/`java-version` for setup-java, `name`/`path`/
 * `retention-days` for upload-artifact) before landing it — none of the inputs this repo uses changed shape.
 *
 * This rail is deliberately a flat pinned-version list, not a "some Node-20-only major" pattern: the next
 * deprecation will name a *different* set of majors, and a rail that already knew today's list would need
 * editing to catch a new one anyway. What it prevents is today's list creeping back via a copy-paste from an
 * old workflow file or an example in an issue body.
 *
 * Prove it red: put any one of the OLD pins back into any workflow file.
 */
describe('no workflow pins an action major GitHub has deprecated for Node 20 (#111)', () => {
  const workflows = workflowFiles().map(({ name, text }) => ({ f: name, text }));

  const RETIRED = [
    'actions/checkout@v4',
    'actions/setup-node@v4',
    'actions/setup-java@v4',
    'actions/upload-artifact@v4',
    'actions/upload-artifact@v5',
    'android-actions/setup-android@v3',
    'gradle/actions/setup-gradle@v4',
    'softprops/action-gh-release@v2',
    'actions/github-script@v7',
  ];

  it('reads at least three workflow files, or this rail checks nothing', () => {
    expect(workflows.length).toBeGreaterThanOrEqual(3);
  });

  for (const pin of RETIRED) {
    it(`no workflow file pins the retired ${pin}`, () => {
      const offenders = workflows.filter(({ text }) => text.includes(pin)).map(({ f }) => f);
      expect(offenders, `${pin} is a Node-20-only major GitHub is deprecating (#111) — bump it`).toEqual([]);
    });
  }

  it('android.yml, ci.yml and review-gate.yml each still reference actions/checkout, at a current major', () => {
    for (const f of ['android.yml', 'ci.yml', 'review-gate.yml']) {
      const w = workflows.find((w) => w.f === f);
      expect(w, `${f} must exist under .github/workflows/, or this rail checks the wrong directory`).toBeDefined();
      expect(w!.text, `${f} must still check out the repo`).toMatch(/actions\/checkout@v\d+/);
    }
  });
});
