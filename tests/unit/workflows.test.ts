import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { code, e2eSpecFiles, workflow, workflowFiles } from './helpers/sources';

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
    // array of them, never a glob string — so that is the only shape this helper judges. A glob string would
    // silently read as "no pattern" if merely filtered out (type-design-analyzer review of this PR), so an
    // unexpected one throws instead of letting this rail's verdict pass on a shape it never actually checked.
    const asRegexes = (pattern: string | RegExp | (string | RegExp)[] | undefined): RegExp[] => {
      const list = Array.isArray(pattern) ? pattern : pattern ? [pattern] : [];
      const glob = list.find((p): p is string => typeof p === 'string');
      if (glob !== undefined) throw new Error(`this rail only judges RegExp testMatch/testIgnore, not a glob string ('${glob}') — extend it before trusting its verdict here`);
      return list as RegExp[];
    };
    const runsHere = (proj: ReturnType<typeof byName>, file: string) => {
      const ignore = asRegexes(proj?.testIgnore);
      if (ignore.some((r) => r.test(file))) return false;
      const match = asRegexes(proj?.testMatch);
      return match.length ? match.some((r) => r.test(file)) : true;   // no testMatch: Playwright's own "everything in testDir"
    };

    const setup = byName('setup');
    expect(setup, 'a `setup` project must exist to run the identity spec before every other project (#486)').toBeTruthy();
    expect(runsHere(setup, filename), '`setup`\'s own patterns must actually select the identity spec, or nothing runs it at all')
      .toBe(true);
    // pr-test-analyzer review of this PR: a widened (or dropped) `testMatch` would still pass the assertion
    // above while quietly turning `setup` into a second full e2e leg every project now depends on — the exact
    // per-night cost #116's tablet rail already guards its own narrow spec against, with nothing here yet
    // doing the same for this one. Checked against the REAL spec files on disk, not a hard-coded guess at
    // their names, so a future spec file is covered the moment it exists.
    const specFiles = readdirSync(new URL('../../tests/e2e/', import.meta.url)).filter((f) => f.endsWith('.spec.ts') && f !== filename);
    expect(specFiles.length, 'tests/e2e/ must still have other spec files, or this exclusivity check covers nothing')
      .toBeGreaterThan(0);
    for (const other of specFiles) {
      expect(runsHere(setup, other), `'setup' must run the identity spec ONLY — it also selects '${other}', which ` +
        'would make every project a second, unrestricted e2e leg deep (#486)').toBe(false);
    }

    for (const name of ['mobile', 'desktop']) {
      const p = byName(name);
      expect(p, `'${name}' must still be declared`).toBeTruthy();
      expect(runsHere(p, filename), `'${name}' must no longer run the identity spec itself — 'setup' already does, and running it ` +
        'twice is dead weight the nightly pays for every night (#486)').toBe(false);
      expect(p?.dependencies ?? [], `'${name}' must depend on 'setup', or nothing stops it starting before the identity ` +
        'check has run — exactly the #486 regression this project exists to close').toContain('setup');
    }
    for (const name of ['tablet', 'tablet-landscape', 'sketchbook']) {   // the sketchbook (#715) is a leg on the same preview
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

/**
 * #765: the #147 rail above (`CI drops the Google Chrome apt source before installing browsers`) reads
 * `ci.yml` by name, so it never saw `.github/workflows/e2e-speed-trial.yml` land with its own copy of the same
 * two steps. Generalised here to every workflow file that installs Playwright browsers at all, rather than
 * hand-copying the check per file — the same #111 lesson (a flat per-file list drifts the moment a new
 * workflow file is added) applied to this incident instead.
 *
 * Prove it red: swap the order of the two steps in e2e-speed-trial.yml (install before the apt-source drop)
 * and this rail fails; put them back and it passes. Also prove it red on a *second* install step with no drop
 * of its own: a two-job fixture where job A correctly drops-then-installs and job B installs with no drop
 * anywhere before it — `.indexOf()` on a single first-occurrence pair would lock onto job A's (correct) pair
 * and pass regardless of job B, which is exactly the vacuous-pass shape a `silent-failure-hunter` review of
 * this rail found before it ever reached a human reviewer. Every install is walked in file order instead,
 * each requiring its own drop that has not already been used to justify an earlier install (`cursor` below) —
 * still a whole-file text check rather than a real per-job parse (this file's rails are documented as exactly
 * that, `.claude/rules/guardrails.md`), but no longer one that a second, undropped install can hide behind.
 */
describe('every workflow file that installs Playwright browsers drops the Google Chrome apt source first (#147, #765)', () => {
  // Comments are stripped first, same reason as the #147 rail above: a workflow's own comment can name the
  // very step it is missing (#129).
  const withInstall = workflowFiles()
    .map(({ name, text }) => ({ name, steps: text.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n') }))
    .filter(({ steps }) => steps.includes('playwright install'));

  const allIndicesOf = (haystack: string, needle: string): number[] => {
    const at: number[] = [];
    for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + 1)) at.push(i);
    return at;
  };

  // Extracted so the #809 fixture test below walks the exact same logic the per-file rail runs, rather than a
  // second hand-written copy that could drift from it.
  const dropsBeforeEveryInstall = (steps: string): boolean => {
    const installs = allIndicesOf(steps, 'playwright install');
    const drops = allIndicesOf(steps, 'sources.list.d/google-chrome');
    if (drops.length === 0) return false;
    let cursor = -1;
    for (const install of installs) {
      if (!drops.some((drop) => drop > cursor && drop < install)) return false;
      cursor = install;
    }
    return true;
  };

  it('at least one workflow file installs Playwright browsers, or this rail checks nothing (#765)', () => {
    expect(withInstall.length).toBeGreaterThan(0);
  });

  for (const { name, steps } of withInstall) {
    it(`${name} drops the google-chrome apt source before every 'playwright install' step (#147, #765)`, () => {
      expect(dropsBeforeEveryInstall(steps),
        `${name}: some 'playwright install' step has no apt-source drop of its own since the previous install — ` +
        'a drop already used to justify an earlier install does not count twice (#147)').toBe(true);
    });
  }

  // #809: against today's two real files (one install, one drop, each) the cursor walk above is
  // indistinguishable from the weaker "a drop exists somewhere in the file" check it replaced — a regression
  // that reverted it to a single first-occurrence check would pass this suite today, silently. Proved here
  // instead, against a synthetic two-job fixture: job a drops then installs (correct); job b installs with no
  // drop of its own anywhere before it.
  it('the cursor walk catches a second install with no drop of its own, which a single-drop check would miss (#809)', () => {
    const twoJobs =
      'jobs:\n' +
      '  a:\n' +
      '    steps:\n' +
      '      - run: sudo rm -fv /etc/apt/sources.list.d/google-chrome*.list\n' +
      '      - run: npx playwright install --with-deps chromium\n' +
      '  b:\n' +
      '    steps:\n' +
      '      - run: npx playwright install --with-deps chromium\n';

    expect(dropsBeforeEveryInstall(twoJobs), 'job b has no drop of its own — the real rail must go red here')
      .toBe(false);

    // The weaker check this rail replaced: "a drop exists somewhere before this install", with no cursor
    // stopping one drop being reused to justify every later install. It would wrongly pass this same fixture,
    // which is what makes the fixture worth having rather than only reasoning about it in prose.
    const singleDropReusedWouldWronglyPass = allIndicesOf(twoJobs, 'playwright install')
      .every((install) => allIndicesOf(twoJobs, 'sources.list.d/google-chrome').some((drop) => drop < install));
    expect(singleDropReusedWouldWronglyPass, 'the fixture must actually exercise the gap the cursor logic closes')
      .toBe(true);

    // silent-failure-hunter review of this PR: the red assertion above alone can't tell "correctly caught job
    // b" apart from "detects nothing, ever" — an always-`false` stub of `dropsBeforeEveryInstall` passes it
    // too. Giving job b its own drop must flip the result to `true`, which only the real cursor walk does.
    const twoJobsFixed = twoJobs.replace(
      '  b:\n    steps:\n      - run: npx playwright install --with-deps chromium\n',
      '  b:\n    steps:\n      - run: sudo rm -fv /etc/apt/sources.list.d/google-chrome*.list\n' +
        '      - run: npx playwright install --with-deps chromium\n',
    );
    expect(dropsBeforeEveryInstall(twoJobsFixed), 'job b now has its own drop — the real rail must go green here')
      .toBe(true);
  });
});

/**
 * #765: `tests/e2e/game.spec.ts` and `tests/e2e/duel.spec.ts` each carry their own copy of the `PW_FAST`
 * validation (module scope is not shared between the two files), so nothing stopped one file's regex or error
 * message drifting from the other's — e.g. one accepting `PW_FAST=8.5` while the other rejects it. Pinned as
 * byte-identical rather than merged into a shared helper: `type-design-analyzer` found the duplication itself
 * sound when #765 was filed, so this only pins the two copies together.
 *
 * Prove it red: edit either file's validation line (the regex or the thrown message) without the other, and
 * this rail fails; make them match again and it passes.
 *
 * Comments are stripped first, the same #129 reason the apt-source rail above already strips them: a comment
 * quoting this exact line (as both files' own surrounding prose already comes close to doing) must not let
 * `indexOf` lock onto the comment instead of the real declaration.
 */
describe('the two PW_FAST validation blocks stay identical between game.spec.ts and duel.spec.ts (#765)', () => {
  const files = e2eSpecFiles().map(({ name, text }) => ({ name, text: code(text) }));

  const validationBlock = (name: string) => {
    const f = files.find((f) => f.name === name);
    expect(f, `${name} must exist under tests/e2e/`).toBeTruthy();
    const at = f!.text.indexOf('const rawFast = process.env.PW_FAST;');
    expect(at, `${name} must still carry the PW_FAST validation block`).toBeGreaterThan(-1);
    const end = f!.text.indexOf('\n', f!.text.indexOf('\n', at) + 1);
    expect(end, `${name}'s PW_FAST validation block must span two lines`).toBeGreaterThan(at);
    return f!.text.slice(at, end);
  };

  it('game.spec.ts and duel.spec.ts validate PW_FAST with byte-identical code', () => {
    expect(validationBlock('duel.spec.ts')).toBe(validationBlock('game.spec.ts'));
  });
});


/**
 * #715 (epic #713 decision 5): the scope step now answers two questions — does the diff reach the game
 * (`e2e`), and does it touch the sketchbook (`sketch`) — and the two must not be confused: a diff confined to
 * `src/three/stage|objects|sketchbook/`, `sketchbook.html`, `tests/sketch/` or the two sketch scripts runs the
 * sketchbook's one spec and not the game's e2e; `src/three/mount/` is the game's surface and stays a game
 * path; a diff touching both runs both; a diff the step cannot read runs both. Rather than re-implement the
 * shell in TypeScript and test the copy (#129's failure), this runs the step's REAL script with a `git` shim
 * on PATH that prints the file list — the same text GitHub would feed it.
 */
describe('the scope step routes a diff to e2e, to the sketchbook, or to neither (#715)', () => {
  const yml = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const lines = yml.split('\n');
  const at = lines.findIndex(l => l.includes('id: scope'));
  const runAt = lines.findIndex((l, i) => i > at && /^\s*run:\s*\|\s*$/.test(l));
  expect(at, 'ci.yml must still have the scope step').toBeGreaterThan(-1);
  expect(runAt, 'the scope step must be a `run: |` block').toBeGreaterThan(at);
  const indent = /^\s*/.exec(lines[runAt + 1])![0].length;
  let end = runAt + 1;
  while (end < lines.length && (lines[end].trim() === '' || /^\s*/.exec(lines[end])![0].length >= indent)) end++;
  const script = lines.slice(runAt + 1, end).map(l => l.slice(indent)).join('\n');

  /** Run the step against `files` (or a git that fails), and read what it wrote to GITHUB_OUTPUT. */
  const scope = (files: string[] | 'git-fails', event = 'pull_request') => {
    const dir = mkdtempSync(join(tmpdir(), 'sna-scope-'));
    try {
      const shim = join(dir, 'git');
      writeFileSync(shim, files === 'git-fails' ? '#!/bin/sh\necho "fatal: bad object" >&2\nexit 128\n' : `#!/bin/sh\nprintf '%s\\n' ${files.map(f => `'${f}'`).join(' ')}\n`);
      chmodSync(shim, 0o755);
      const out = join(dir, 'out'), summary = join(dir, 'summary');
      writeFileSync(out, ''); writeFileSync(summary, '');
      execFileSync('bash', ['-c', script], { stdio: 'pipe', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, BASE: 'b', HEAD: 'h', EVENT: event, GITHUB_OUTPUT: out, GITHUB_STEP_SUMMARY: summary } });
      const kv = Object.fromEntries(readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map(l => l.split('=') as [string, string]));
      return { e2e: kv.e2e, sketch: kv.sketch, summary: readFileSync(summary, 'utf8') };
    } finally { rmSync(dir, { recursive: true, force: true }); }
  };

  it('the script was extracted whole, and the shim is what it calls', () => {
    expect(script).toContain('GAME_PATHS=');
    expect(script).toContain('SKETCH_PATHS=');
    expect(script).toContain('git diff --name-only');
  });
  // One file per case where the claim is about that file: a two-file case proves only its union (silent-failure review).
  it.each([
    [['src/three/stage/toon.ts'], { e2e: 'false', sketch: 'true' }],
    [['src/three/objects/index.ts'], { e2e: 'false', sketch: 'true' }],
    [['src/three/sketchbook/main.ts'], { e2e: 'false', sketch: 'true' }],
    [['sketchbook.html'], { e2e: 'false', sketch: 'true' }],
    [['vite.sketchbook.config.ts'], { e2e: 'false', sketch: 'true' }],   // a `base:` change 404s the page under preview: the sketch spec is what catches it
    [['tests/sketch/shot.spec.ts'], { e2e: 'false', sketch: 'true' }],
    [['scripts/sketch-shot.mjs'], { e2e: 'false', sketch: 'true' }],      // one file each: a typo in one name inside SKETCH_PATHS must not hide behind the other
    [['scripts/sketch-gallery.mjs'], { e2e: 'false', sketch: 'true' }],
    [['src/ui/parents.ts'], { e2e: 'true', sketch: 'false' }],
    [['src/three/mount/enabled.ts'], { e2e: 'true', sketch: 'false' }],   // the game's one surface into src/three/
    [['playwright.config.ts'], { e2e: 'true', sketch: 'false' }],
    [['package.json'], { e2e: 'true', sketch: 'false' }],
    [['src/three/objects/index.ts', 'src/ui/play.ts'], { e2e: 'true', sketch: 'true' }],
    [['docs/ROUTINE-PROMPT.md', 'CLAUDE.md'], { e2e: 'false', sketch: 'false' }],
  ])('%j → %j', (files, want) => {
    expect(scope(files)).toMatchObject(want);
  });
  it('a diff that cannot be read runs both; a non-pull-request event runs e2e and leaves the sketchbook to the full matrix', () => {
    expect(scope('git-fails')).toMatchObject({ e2e: 'true', sketch: 'true' });
    expect(scope(['src/three/stage/toon.ts'], 'schedule')).toMatchObject({ e2e: 'true', sketch: 'false' });
  });
  it('the summary says which files put the sketchbook in, and which the game', () => {
    const r = scope(['src/three/objects/index.ts', 'src/ui/play.ts']);
    const [e2e, sketch] = r.summary.split('### sketchbook');
    expect(sketch, 'the sketchbook section names the sketchbook file').toMatch(/\*\*running\*\*[\s\S]*- src\/three\/objects\/index\.ts/);
    expect(e2e).toMatch(/e2e: \*\*running\*\*[\s\S]*- src\/ui\/play\.ts/);
    expect(e2e, 'a sketchbook file is not what puts e2e on').not.toMatch(/- src\/three\/objects/);
    const only = scope(['src/three/stage/toon.ts']).summary;
    expect(only).toMatch(/### e2e: \*\*skipped\*\*/);
    expect(only).toMatch(/### sketchbook: \*\*running\*\*/);
  });

  // The output is consumed, or the whole routing above is decoration: the sketchbook step exists, runs on a
  // pull request when the scope step says so, and the two browser-setup steps run for it too — delete the
  // step and the tree would otherwise stay green with the spec running on the nightly alone (pr-test-analyzer).
  const stepOf = (needle: string) => {
    const at = lines.findIndex(l => l.includes(needle));
    expect(at, `ci.yml must have a step containing ${needle}`).toBeGreaterThan(-1);
    let from = at; while (from >= 0 && !/^\s*- /.test(lines[from])) from--;
    const dash = lines[from].indexOf('- '), sibling = new RegExp(`^\\s{${dash}}- `);
    let to = from + 1; while (to < lines.length && !sibling.test(lines[to])) to++;
    return lines.slice(from, to).join('\n');
  };
  it('a Sketchbook step consumes the sketch output, and the browser-setup steps read it as well', () => {
    const sketchStep = stepOf('playwright test --project=sketchbook');
    expect(sketchStep).toMatch(/if:.*github\.event_name == 'pull_request'/);
    expect(sketchStep).toMatch(/if:.*steps\.scope\.outputs\.sketch == 'true'/);
    expect(sketchStep, 'one project, no ternary — the nightly carries it through the full matrix').toMatch(/run:\s*npx playwright test --project=sketchbook\s*$/m);
    for (const needle of ['playwright install', 'sources.list.d/google-chrome'])
      expect(stepOf(needle), `the ${needle} step must also run for a sketch-only pull request`).toMatch(/steps\.scope\.outputs\.sketch == 'true'/);
    expect(lines.find(l => /playwright test \$\{\{/.test(l)), 'the full-matrix arm carries the sketchbook project').toMatch(/--project=sketchbook'/);
  });

  // #600: a syntax error under tests/e2e/ was invisible to every pull request whose OWN diff did not touch
  // it — tablet/tablet-landscape are the only projects that load viewport.spec.ts, and they run nightly only.
  // Delete this step, or re-gate it on the scope output, and the tree stays green with a broken spec file
  // undetected until the nightly (pr-test-analyzer). Round 1 (a real reviewer, not this repo's own agents)
  // found the first version of this rail pinned a hand-typed four-project list, the same shape that hid #598
  // in the first place: a project added later with its own restricted testMatch would again be invisible,
  // both to the CI step it pinned as correct and to this rail's own literal strings. The fix drops the
  // `--project=` filter from the step entirely — every declared project parses at the same near-zero cost —
  // so this rail instead pins that no filter exists to drift back in, rather than pinning today's list of them.
  it('an e2e-spec-parse step runs on every pull request, gated on nothing but the event, with no --project filter to go stale (#600)', () => {
    const step = stepOf('playwright test --list');
    expect(step).toMatch(/if:\s*github\.event_name == 'pull_request'\s*$/m);
    expect(step, 'must not be re-gated on the scope step — the point is to catch a break the diff never touches')
      .not.toMatch(/steps\.scope\.outputs/);
    expect(step, 'must carry no --project filter — a named subset is the shape that hid #598').not.toMatch(/--project=/);
  });
});

/**
 * #750: a `@smoke` subset for a fast pre-push signal. The class this rail guards against is #750's own
 * naming of it — a `--grep` that matches nothing exits 0 with `0 passed`, which reads exactly like a pass.
 * `--list` resolves the real config (projects, `dependencies`, `testIgnore`) without launching a browser or
 * the webServer (proven below by wall-clock: it returns in about a second), so this asks Playwright itself
 * what `npm run test:e2e:smoke` would run rather than re-implementing its project-resolution rules against a
 * `@smoke` grep of the source text, which would drift the moment `playwright.config.ts` does.
 */
describe('the @smoke e2e subset is non-empty and actually reachable by npm run test:e2e:smoke (#750)', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

  it('package.json carries the exact script #750 specifies', () => {
    expect(pkg.scripts['test:e2e:smoke']).toBe('playwright test --project=mobile --grep @smoke');
  });

  it('at least one test file under tests/e2e/ carries the @smoke tag', () => {
    const files = e2eSpecFiles();
    const tagged = files.filter((f) => /\{\s*tag:\s*['"]@smoke['"]\s*\}/.test(f.text));
    expect(tagged.length, 'no file tags a test @smoke — the sweep this rail exists to check never ran')
      .toBeGreaterThan(0);
  });

  // #750's own acceptance criterion: the script must resolve to a non-empty, non-erroring list. Run through
  // `npm run` (not `npx playwright` directly) so a rewrite of the script string above is what this exercises,
  // not a hand-typed duplicate of it.
  it('npm run test:e2e:smoke resolves to a non-empty list of real tests, every one from tests/e2e/', () => {
    const out = execFileSync('npm', ['run', '--silent', 'test:e2e:smoke', '--', '--list'], {
      cwd: new URL('../../', import.meta.url),
      encoding: 'utf8',
      timeout: 15_000,   // --list resolves in ~1s; a hang here (silent-failure-hunter, pr-test-analyzer,
                          // PR #750 review) must fail loudly with a clear timeout, not stall the whole suite
    });
    const totalLine = out.match(/^Total:\s*(\d+)\s+tests?\s+in\s+(\d+)\s+files?/m);
    expect(totalLine, 'Playwright must report a "Total: N tests in M files" line, or nothing here can be trusted')
      .toBeTruthy();
    const [, testCount, fileCount] = totalLine!;
    // The exact failure #750 names: `--grep` matching nothing still exits 0 and still prints a Total line —
    // "Total: 0 tests in 0 files" — so the count itself, not merely the exit code, is the check.
    expect(Number(testCount), 'a @smoke grep that matches nothing is the silent-pass shape #750 exists to catch')
      .toBeGreaterThan(0);
    expect(Number(fileCount)).toBeGreaterThan(0);
    // Every listed test must come from a file `--project=mobile`'s own dependency graph (`setup` + `mobile`
    // itself) would run — i.e. not `viewport.spec.ts`, the one tests/e2e file both `testIgnore` (mobile's
    // own list already includes it; `setup`'s `testMatch` is 00-build-identity.spec.ts only, which excludes
    // it too). `tests/sketch/**` is a different testDir and never appears in tests/e2e/ output at all.
    const specFiles = [...out.matchAll(/›\s([\w.-]+\.spec\.ts):\d+:\d+/g)].map((m) => m[1]);
    expect(specFiles.length).toBeGreaterThan(0);
    expect(specFiles, 'viewport.spec.ts only runs under the tablet projects, never under mobile/setup')
      .not.toContain('viewport.spec.ts');
    // #854: since #751 this subset is ALL the e2e a pull request's CI runs, so the paths it walks are pinned by
    // title, read from Playwright's own list. Untagging one of these, or renaming it, turns this red rather than
    // quietly narrowing what every pull request is checked on.
    for (const [path, title] of [
      ['build identity', 'the e2e server is serving the build on disk here'],
      ['one slice round', 'real swipe slices the correct bubble and scores'],
      ['tracing', 'letter tracing passes when the glyph is covered'],
      ['save code', 'For grown-ups: the save code copies out and restores back'],
      ['onboarding', 'avatar selection is required, saved and shown on the home screen'],
      ['a wrong answer', 'wrong slice loses a life and shows the answer; correct then continues'],
      ['a won mission', 'a full mission (5 stages) ends with results, medal, coins, a sticker and saved stars'],
      ['a duel starting, both arenas dealt one wave', 'the two halves pose the identical wave — same order, same moments, same arcs'],
    ]) expect(out, `the @smoke subset must still walk ${path} (#854)`).toContain(title);
    expect(Number(testCount), 'the eight paths above, one test each (#854)').toBe(8);
  });
});

/**
 * #758: PR #754 raised the `test` job's `timeout-minutes` from 30 to 45 as a stop-gap for the nightly
 * full-matrix job outgrowing the old ceiling (#718 — a cancelled run reports nothing, which hid the whole
 * check rather than catching a runaway job), and left a comment beside the number promising it comes back
 * down once #749/#748/#750 shrink the suite. Nothing enforced either half of that promise: `grep -rn
 * "timeout-minutes" tests/` returned nothing before this rail, so the number could drift up again, or the
 * comment explaining why it is 45 could be deleted, both with the whole suite green. This is the same shape
 * as the byte budgets this repository already rails elsewhere: a number that may only go down, with a ledger
 * comment beside it saying what paid for the last move.
 */
describe("ci.yml's test-job timeout-minutes is a budget, not a bare number (#758)", () => {
  const ci = workflow('ci.yml');
  const jobs = ci.slice(ci.indexOf('\njobs:'));
  // Bounded the same way as the #755 rail in guardrails.test.ts: `branch-name` is the next job after `test`,
  // and the end anchor is checked for `-1` before it is used to slice, so a renamed neighbour job fails loudly
  // here rather than silently widening the read scope to include it.
  const branchNameAt = jobs.indexOf('\n  branch-name:');

  it('the `test` job still exists, bounding the slice this whole describe block reads', () => {
    // silent-failure-hunter review of this rail: `ci.indexOf('\njobs:')` feeds `.slice()` two lines up with no
    // guard of its own — a missing/moved `jobs:` key would still fail below (`jobs` could not then contain
    // `\n  test:` either), but on the wrong assertion's message, pointing a maintainer at "the test job" when
    // the real cause is the anchor above it never being found at all.
    expect(ci.indexOf('\njobs:'), 'ci.yml must have a top-level `jobs:` key, or every slice below reads nothing')
      .toBeGreaterThan(0);
    expect(jobs.indexOf('\n  test:'), 'the `test` job must exist').toBeGreaterThan(0);
    expect(branchNameAt, "the `branch-name` job must still exist, to bound the `test` job's own slice")
      .toBeGreaterThan(0);
  });

  const testJob = jobs.slice(jobs.indexOf('\n  test:'), branchNameAt);
  // The comment wraps across several `# `-prefixed lines, so a pinned sentence can straddle a line break —
  // this joins them the way `flatten()` does for Markdown prose elsewhere in this repository's rails, with the
  // comment marker treated as whitespace too, or a sentence broken across two `#` lines would never match a
  // plain `toMatch`/`toContain` against the raw YAML text.
  const flatComment = (t: string) => t.replace(/\n\s*#\s?/g, ' ').replace(/\s+/g, ' ').trim();

  // pr-test-analyzer review of this rail: reading the phrase checks below off `testJob` whole would search the
  // job's ~200 lines of steps too — every unrelated `#96`/`#483`/`#715` step comment in there — so a phrase
  // could keep matching by accident even if the stop-gap comment itself were deleted (or a plausible future
  // step comment could make `#749` match for an unrelated reason). Narrowed to the comment block that actually
  // sits above `timeout-minutes:`, nowhere else in the job.
  const timeoutAt = testJob.indexOf('timeout-minutes:');

  it('the ceiling has not been raised past the #754 stop-gap value of 45', () => {
    expect(timeoutAt, "the test job's `timeout-minutes:` line must exist, to bound the comment block above it")
      .toBeGreaterThan(0);
    const m = /timeout-minutes:\s*(\d+)/.exec(testJob);
    expect(m, "the test job's timeout-minutes must be a readable number, or this rail proves nothing").toBeTruthy();
    // A ceiling on the ceiling: a future reduction (#749/#748/#750 landing) passes, a future raise fails —
    // same direction as `ROUTINE_PROMPT_BUDGET` and the longest-line rails in governance.test.ts.
    expect(Number(m![1]), 'this ceiling may only go down from the #754 stop-gap value — raising it to make a '
      + "slow suite fit is exactly what .claude/rules/guardrails.md's budget-rail rule refuses")
      .toBeLessThanOrEqual(45);
  });

  it("the stop-gap comment keeps its reason: names the fix, says the number comes back down, and bans raising it to fit a slow suite", () => {
    const comment = flatComment(testJob.slice(0, timeoutAt));
    expect(comment, 'must name #749 as (part of) the fix, so a future author has somewhere to look before raising the number')
      .toContain('#749');
    expect(comment, 'must say the number is meant to come back down, not merely that it is raisable')
      .toMatch(/meant to come back down/);
    expect(comment, 'must ban raising it again to make a slow suite fit — the one sentence standing between '
      + 'this number and an ordinary raise-to-pass')
      .toMatch(/never raise it again to make a slow suite fit/);
  });

  // What this deliberately does not do (#758's own scope): it does not touch the `sketchbook` job's own
  // `timeout-minutes: 5`, which has never been near its limit and carries no such promise to keep, and it does
  // not lower the number itself — that waits for #749/#748/#750 to land and a measured job duration to lower
  // it to, per #758's stated intent.
});
