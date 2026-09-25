import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  // Review of this PR (#187): the original version of this rail compared two string literals defined inside
  // itself ('00-build-identity.spec.ts' against /viewport\.spec\.ts/) — true by construction, and green
  // whatever `playwright.config.ts` actually declares. This reads the REAL `testIgnore`/`testMatch` patterns
  // out of the config text and tests the real filename against them, the way the #116 tablet rail above does.
  it('the identity spec is not excluded from either default project, by the config\'s ACTUAL patterns (#123)', () => {
    const filename = '00-build-identity.spec.ts';
    const parts = config.slice(config.indexOf('projects:')).split(/(?=\{\s*name:\s*')/).filter(p => /^\{\s*name:\s*'/.test(p));
    expect(parts.length, 'playwright.config.ts must declare its projects, and be read from disk').toBeGreaterThanOrEqual(4);
    const defaultProjects = parts.filter(p => /name:\s*'(mobile|desktop)'/.test(p));
    expect(defaultProjects.length, 'both default projects must be found by name').toBe(2);
    for (const p of defaultProjects) {
      const name = p.match(/name:\s*'([^']+)'/)![1];
      const ignore = p.match(/testIgnore:\s*\/([^/]+)\//);
      if (ignore) {
        expect(new RegExp(ignore[1]).test(filename), `'${name}''s real testIgnore (/${ignore[1]}/) must not exclude the identity spec`)
          .toBe(false);
      }
      const match = p.match(/testMatch:\s*\/([^/]+)\//);
      if (match) {
        expect(new RegExp(match[1]).test(filename), `'${name}' declares testMatch — the identity spec must match it, or it never runs there`)
          .toBe(true);
      }
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
