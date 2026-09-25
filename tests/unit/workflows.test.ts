import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workflowFiles } from './helpers/sources';

const E2E_DIR = new URL('../../tests/e2e/', import.meta.url);
/** Every `tests/e2e/*.spec.ts` file, name plus text — `readdirSync` throws rather than the vacuous []
 *  (`sources.ts`'s own rule, #417): a rail below asserting "at least one @smoke tag" must not pass because
 *  it read no files at all. `tests/sketch/` is a different `testDir` entirely (its own `sketchbook` project,
 *  not a dependency of `mobile`), so it is out of scope for a `--project=mobile` smoke run and not read here. */
const e2eSpecFiles = (): { name: string; text: string }[] => {
  const names = readdirSync(E2E_DIR).filter((f) => f.endsWith('.spec.ts'));
  if (names.length === 0) throw new Error('no tests/e2e/*.spec.ts files found — the @smoke rail would pass vacuously');
  return names.map((name) => ({ name, text: readFileSync(new URL(name, E2E_DIR), 'utf8') }));
};

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
  it('a Sketchbook step consumes the sketch output, and the browser-setup steps read it as well', () => {
    const stepOf = (needle: string) => {
      const at = lines.findIndex(l => l.includes(needle));
      expect(at, `ci.yml must have a step containing ${needle}`).toBeGreaterThan(-1);
      let from = at; while (from >= 0 && !/^\s*- /.test(lines[from])) from--;
      const dash = lines[from].indexOf('- '), sibling = new RegExp(`^\\s{${dash}}- `);
      let to = from + 1; while (to < lines.length && !sibling.test(lines[to])) to++;
      return lines.slice(from, to).join('\n');
    };
    const sketchStep = stepOf('playwright test --project=sketchbook');
    expect(sketchStep).toMatch(/if:.*github\.event_name == 'pull_request'/);
    expect(sketchStep).toMatch(/if:.*steps\.scope\.outputs\.sketch == 'true'/);
    expect(sketchStep, 'one project, no ternary — the nightly carries it through the full matrix').toMatch(/run:\s*npx playwright test --project=sketchbook\s*$/m);
    for (const needle of ['playwright install', 'sources.list.d/google-chrome'])
      expect(stepOf(needle), `the ${needle} step must also run for a sketch-only pull request`).toMatch(/steps\.scope\.outputs\.sketch == 'true'/);
    expect(lines.find(l => /playwright test \$\{\{/.test(l)), 'the full-matrix arm carries the sketchbook project').toMatch(/--project=sketchbook'/);
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
  });
});
