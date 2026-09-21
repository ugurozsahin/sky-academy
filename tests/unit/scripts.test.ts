import { readdirSync, readFileSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';
import { code } from './helpers/sources';

/**
 * SCRIPT RAILS (#321, split out of `guardrails.test.ts`) — everything that reads or executes `scripts/**`:
 * the service-worker build, the single-file bundle, and the browserless simulation harness. Unchanged by the
 * split.
 *
 * Several of these run a script for real in a temporary directory. They are the slowest rails in the suite
 * and the most valuable, because a build script that fails silently produces a shippable-looking `dist/`.
 */


/*
 * #142 — the browserless simulation layer stays browserless, and stays honest.
 *
 * `tests/unit/sim/harness.ts` drives the real `Arena` with a stubbed clock and canvas, so the scheduled
 * routine — which cannot download a Playwright browser at all (CLAUDE.md) — can still verify the timing bugs
 * that used to need one. Two ways that value quietly evaporates, and one rail each.
 *
 * First, scope creep in what is faked. The harness is trustworthy exactly to the extent that it stubs the
 * clock, the canvas and the entropy and NOTHING else; the day someone stubs a fourth thing to make a scenario
 * pass, the suite starts testing the harness's idea of the game instead of the game. So the list below is the
 * allow-list, the same way #180's is: add a stub and you edit this list in the same pull request, where a
 * reviewer can ask why. Every stub must also be restored on `destroy()`, or one scenario poisons the next.
 *
 * Second, a unit suite that reaches for a browser. That is what makes `npm test` unrunnable on the VM.
 *
 * Prove it red: stub a fourth global in the harness, drop a line from the restore block, or import
 * `@playwright/test` into any unit test.
 */
describe('the browserless simulation harness stubs the clock, the canvas and the entropy — and nothing else (#142)', () => {
  const harness = readFileSync(new URL('../../tests/unit/sim/harness.ts', import.meta.url), 'utf8');

  /** The only globals the harness may replace. Adding one is a decision, not a detail. */
  const STUBBED = ['performance', 'window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'];

  it('reads the harness it claims to check', () => {
    expect(harness.length, 'an empty read would make every rail below pass vacuously').toBeGreaterThan(2000);
    expect(harness).toContain("from '../../../src/game/arena'");       // it drives the real arena, not a copy
  });

  it('replaces exactly the globals on the list, plus Math.random', () => {
    // NOT line-anchored, for the reason the built-in rail below now also records: `^\s*` examines only the
    // first assignment on its line, so `const fakeNav = {…}; g.navigator = fakeNav;` stubbed a sixth global
    // and left this rail — the one carrying the whole "and nothing else" claim — 161/161 green. The commit
    // that de-anchored the built-in rail said the lesson was "written down twice" and left THIS one anchored,
    // two rails above it. Third time: the anchor is the defect, not the regex around it.
    const assigned = [...code(harness).matchAll(/(?<![.\w])g\.(\w+)\s*=[^=]/g)].map((m) => m[1]);
    expect([...new Set(assigned)].sort(), 'stub a fourth global and this list must grow with it')
      .toEqual([...STUBBED].sort());
    expect(code(harness), 'the seeded rng is the third thing stubbed, and the only other one')
      .toMatch(/Math\.random = rng/);
  });

  // The list above reads `g.<name> =` and nothing else, so every OTHER way of reaching a global walked
  // straight past it — `vi.stubGlobal` (the idiomatic Vitest spelling, and the first thing a future author
  // would reach for), `Object.defineProperty(globalThis, …)`, a computed `g['name'] =`, a second assignment
  // sharing a line. Each was verified to escape the list check. Enumerating assignment syntaxes is a losing
  // game, so the spellings are banned instead: there is one way to stub a global here, and it is the one the
  // list can see. A rail that advertises a contract it does not enforce is worse than no rail, because the
  // next reader stops looking.
  it.each([
    ['vi.stubGlobal', /\bvi\s*\.\s*stubGlobal\b/],
    ['Object.defineProperty on a global', /Object\s*\.\s*defineProperty\s*\(\s*(?:globalThis|global|window|g)\b/],
    ['a computed global assignment', /\bg\s*\[/],
    ['a direct globalThis assignment', /\bglobalThis\s*(?:\.\w+|\[[^\]]*\])\s*=[^=]/],
    // `[ \t]*`, not `\s*`: after the semicolon, `\s` matches a newline too, so the first version of this
    // pattern spanned lines and went red on the perfectly correct one-per-line restore block below.
    ['a second global assignment on one line', /^[ \t]*g\.\w+ =[^;\n]*;[ \t]*g\.\w+ =/m],
  ])('the harness does not stub a global via %s — one spelling only, the one the list reads', (_what, pattern) => {
    expect(code(harness)).not.toMatch(pattern);
  });

  it('restores every one of them, so a leaked sim cannot poison the next scenario', () => {
    // The restore lives in one named function that both destroy() and the construction catch call, so the
    // rail reads that function; `destroy()` is checked separately for calling it under a finally.
    const destroy = /const restore = \(\) => \{[\s\S]*?\n  \};/.exec(code(harness))?.[0] ?? '';
    expect(destroy.length, 'the restore function must be findable, or this rail reads nothing').toBeGreaterThan(100);
    for (const name of STUBBED) {
      // `saved\.` alone stopped at the dot, so `g.document = saved.window;` — the single most damaging
      // copy-paste slip possible in that block — restored the wrong global and went green. Bind the key.
      expect(destroy, `destroy() must put back the real ${name}, from saved.${name}`)
        .toMatch(new RegExp(`g\\.${name} = saved\\.${name}\\b`));
    }
    expect(destroy, 'and the real Math.random').toMatch(/Math\.random = saved\.random/);
  });

  // `Date.now` is THE clock — this describe block's own subject — and stubbing it passed every rail here,
  // because it is not a `g.<name> =` assignment and the allow-list never saw it. It is also the idiomatic
  // thing to write, being the same shape as the sanctioned `Math.random = rng` beside it, and a *constant*
  // spelling (`Date.now = () => 1700000000000`) silently disarms the "costs no real time" scenario, whose
  // `Date.now() - started` then evaluates 0 < 2000 and asserts nothing. (`() => t` is loud, because virtual
  // time really does advance — so the dangerous spelling is the frozen one, not the obvious one.)
  //
  // So: `Math.random` is the ONE built-in member the harness may assign, and every other built-in is off
  // limits by the name of its object. **Not line-anchored**, deliberately. The first version of this rail
  // began `^[ \t]*` and was defeated by `Math.random = rng; Date.now = () => 1700000000000;` — one line,
  // 181/181 green — which is the exact lesson the `g.` same-line rail above already encodes. A line-anchored
  // rail only ever examines the first assignment on its line, and that is now written down twice.
  it('assigns to no built-in except Math.random — Date.now is the clock, and the clock is the subject', () => {
    // `(?<![.\w])` so `foo.Math.random` or `MyMath.random` cannot masquerade as the sanctioned assignment.
    const hits = [...code(harness).matchAll(/(?<![.\w])([A-Z]\w*|console|crypto|performance|navigator|localStorage|sessionStorage)\.(\w+)\s*=[^=]/g)];
    const offenders = hits.filter((m) => !(m[1] === 'Math' && m[2] === 'random')).map((m) => `${m[1]}.${m[2]}`);
    expect(offenders, 'stub a built-in other than Math.random and this rail is the review you owe').toEqual([]);
    expect(hits.length, 'and Math.random must still actually be assigned, or the rail reads nothing')
      .toBeGreaterThan(0);
  });

  // The list above reads assignments through `g`, so a SECOND alias walks past it entirely:
  // `const gg = globalThis as unknown as Record<string, unknown>; gg.navigator = …` left it 161/161 green.
  // One alias, named `g`, is therefore part of the contract — otherwise the allow-list only describes the
  // spelling it happens to know.
  it('aliases globalThis exactly once, as `g` — a second alias walks past the list above', () => {
    const aliases = [...code(harness).matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*globalThis\b/g)].map((m) => m[1]);
    expect(aliases, 'one alias of globalThis, named g').toEqual(['g']);
  });

  // The two object literals handed to the arena as `window` and `document` are stubs the rails above never
  // look inside, so they could grow a fourth and fifth fake member without anyone reviewing it. Same
  // allow-list idea, one level down: the members are named here or they are not there.
  it.each([
    ['win', ['listenerRecorder', 'devicePixelRatio']],
    ['doc', ['createElement']],
  ])('the %s stub exposes only what this list names', (name, allowed) => {
    const literal = new RegExp(`const ${name} = \\{([\\s\\S]*?)\\};`).exec(code(harness))?.[1];
    expect(literal, `the ${name} stub must be findable, or this rail reads nothing`).toBeTruthy();
    const members = [...literal!.matchAll(/(?:\.\.\.(\w+)\(\)|(\w+)\s*:)/g)].map((m) => m[1] ?? m[2]);
    expect(members.sort(), `${name} grew a member the list does not name`).toEqual([...allowed].sort());
  });

  it('restores on the way out of a failed construction too, and under a finally on destroy', () => {
    const src = code(harness);
    // The globals are installed before `new Arena(...)`. If that throws with no restore, no Sim exists for
    // afterEach to destroy and every later scenario runs against a seeded rng and a frozen clock.
    expect(src, 'a throw while installing must restore before it propagates')
      .toMatch(/catch[\s\S]{0,80}restore\(\);[\s\S]{0,40}throw/);
    // And a throw out of arena.destroy() must not strand them either.
    expect(src, 'destroy() must tear the arena down and restore under a finally')
      .toMatch(/try\s*\{\s*arena\.destroy\(\);\s*\}\s*finally\s*\{\s*restore\(\);\s*\}/);
  });

  it('no unit test reaches for a browser — that is what makes npm test runnable on the VM', () => {
    const dir = new URL('../../tests/unit/', import.meta.url);
    const walk = (u: URL): string[] => readdirSync(u, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(new URL(`${e.name}/`, u)) : e.name.endsWith('.ts') ? [readFileSync(new URL(e.name, u), 'utf8')] : []);
    const files = walk(dir);
    expect(files.length, 'the walk found no unit tests, so this rail would pass vacuously').toBeGreaterThan(20);
    for (const src of files) {
      // Four spellings, not one: single or double quotes, a dynamic `await import(...)`, and playwright-core.
      expect(code(src), 'a unit test that needs Playwright belongs in tests/e2e')
        .not.toMatch(/(?:from|import|require)\s*\(?\s*['"](?:@playwright\/test|playwright|playwright-core)['"]/);
    }
  });
});


/**
 * #116 item 1: `build-sw.mjs`, `bundle-single.mjs` and `pwa-icons.mjs` each gated their CLI block on
 * `import.meta.url === \`file://${'$'}{process.argv[1]}\``, comparing a percent-encoded URL to a raw
 * filesystem path. The two disagree the moment the script's own path needs escaping — a space, `#`, anything
 * non-ASCII — and the whole block then silently no-ops: `npm run build` exits 0 with no `sw.js` and no error,
 * from a checkout under an entirely ordinary Mac path like `~/Documents/Sky Academy/…`.
 *
 * This can only be reproduced by actually invoking the script from a path that needs escaping — the bug is in
 * the RUNTIME comparison of two strings Node computes, not anything a source-text rail could see — so this
 * copies each script into a freshly made directory whose name contains a space and runs it as a real
 * subprocess, the same way `npm run build` would.
 */
describe('build scripts run their CLI block from a path that needs URL-escaping (#116)', () => {
  const runFromSpacedPath = (scriptRelPath: string, args: string[]) => {
    const dir = mkdtempSync(join(tmpdir(), 'sna guard rail '));   // the space is the point
    const scriptPath = join(dir, basename(scriptRelPath));
    writeFileSync(scriptPath, readFileSync(new URL(`../../${scriptRelPath}`, import.meta.url)));
    try {
      execFileSync('node', [scriptPath, ...args], { encoding: 'utf8', stdio: 'pipe' });
      return { exitCode: 0, stderr: '' };
    } catch (e) {
      const err = e as { status: number | null; stderr?: Buffer | string };
      return { exitCode: err.status, stderr: err.stderr?.toString() ?? '' };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('build-sw.mjs still errors loudly on a missing dist/index.html when run from a spaced path', () => {
    // Mutating the guard back to the old `file://${argv[1]}` form makes this pass silently instead —
    // exitCode 0, stderr '' — which is the exact failure this rail exists to catch.
    const { exitCode, stderr } = runFromSpacedPath('scripts/build-sw.mjs', ['nonexistent-dist-xyz']);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('index.html is missing');
  });

  it('bundle-single.mjs and pwa-icons.mjs no longer compare a raw path to a `file://` URL', () => {
    for (const f of ['scripts/bundle-single.mjs', 'scripts/pwa-icons.mjs']) {
      const src = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
      expect({ file: f, hasOldGuard: src.includes('file://${process.argv[1]}') })
        .toEqual({ file: f, hasOldGuard: false });
      expect({ file: f, hasNewGuard: src.includes('fileURLToPath(import.meta.url)') })
        .toEqual({ file: f, hasNewGuard: true });
    }
  });
});


/**
 * #116 item 2: `sw.test.ts` drives `renderSw`'s *output* against a hand-built file list, and the rail above
 * proves the CLI block *runs* from any path — but nothing runs the CLI block itself as a subprocess against a
 * real `dist/` and checks what it actually wrote. Three mutations named in #116 leave the whole 1189-test
 * suite green: writing the worker to the wrong filename, or deleting a build-sanity guard — because every
 * existing check reads either the exported functions directly (fed a list nobody built from a real directory)
 * or `package.json`'s text. This drives the real `node scripts/build-sw.mjs <dist>` process, the same way
 * `npm run build` does, against a small real directory on disk.
 *
 * Deliberately not covered here: the "list doesn't include index.html" guard is unreachable independently of
 * the "index.html file is missing" guard right above it in the same block (both fire on the same missing
 * file), and the stale-`distDir` shape of mutation is `package.json` wiring, already covered by the existing
 * `pkg.scripts.build` regex check a few hundred lines up.
 */
describe('build-sw.mjs actually writes dist/sw.js, correctly, or fails loudly (#116 item 2)', () => {
  const run = (dist: string) => {
    try {
      execFileSync('node', ['scripts/build-sw.mjs', dist], { encoding: 'utf8', stdio: 'pipe' });
      return { exitCode: 0, stderr: '' };
    } catch (e) {
      const err = e as { status: number | null; stderr?: Buffer | string };
      return { exitCode: err.status, stderr: err.stderr?.toString() ?? '' };
    }
  };
  const withFixtureDist = (files: Record<string, string>, fn: (dist: string) => void) => {
    const dist = mkdtempSync(join(tmpdir(), 'sna-build-sw-'));
    try {
      for (const [name, contents] of Object.entries(files)) writeFileSync(join(dist, name), contents);
      fn(dist);
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }
  };

  it('writes a real dist/sw.js with both placeholders substituted and the actual built files in its precache list', () => {
    withFixtureDist({ 'index.html': '<div id="app"></div>', 'app.js': 'boot();' }, (dist) => {
      const { exitCode, stderr } = run(dist);
      expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' });
      const swPath = join(dist, 'sw.js');
      expect(existsSync(swPath), 'must write sw.js, not some other filename, under the dist it was given').toBe(true);
      const sw = readFileSync(swPath, 'utf8');
      expect(sw, 'a renamed or duplicated placeholder must not ship un-substituted').not.toMatch(/__PRECACHE__|__CACHE_NAME__/);
      expect(sw, 'the precache list must be the build this run actually produced').toContain('"index.html"');
      expect(sw).toContain('"app.js"');
    });
  });

  it('exits non-zero and writes nothing when the build has no JavaScript at all', () => {
    withFixtureDist({ 'index.html': '<div id="app"></div>' }, (dist) => {
      const { exitCode, stderr } = run(dist);
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('no JavaScript');
      expect(existsSync(join(dist, 'sw.js')), 'a guard that throws must not leave a worker behind to register').toBe(false);
    });
  });

  it('exits non-zero and writes nothing when dist/index.html is missing', () => {
    withFixtureDist({ 'app.js': 'boot();' }, (dist) => {
      const { exitCode, stderr } = run(dist);
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('index.html is missing');
      expect(existsSync(join(dist, 'sw.js'))).toBe(false);
    });
  });
});


/**
 * #136: `bundle-single.mjs` runs `npx vite build`, which empties `dist/` first, and never ran
 * `build-sw.mjs` afterwards — so the single-file build silently deleted `dist/sw.js` and never wrote a new
 * one. `dist/` is shared state: `playwright.config.ts` previews whatever is in it, so the next
 * `npx playwright test` ran the whole suite against a build with no service worker, and the failure
 * ("guard rail: the game still loads and plays with the network off") pointed at the wrong change entirely.
 *
 * `bundle-single.mjs` has no `distDir` argument — unlike `build-sw.mjs` above, it always builds the real
 * project `dist/`, so this drives the actual script end-to-end (a real `vite build`, not a fixture) rather
 * than fabricating a directory it never touches.
 */
describe('bundle-single.mjs regenerates dist/sw.js after vite build deletes it (#136)', () => {
  it('leaves dist/ with a real, filled-in service worker once the single-file build finishes', () => {
    const out = join(tmpdir(), `sna-bundle-single-${process.pid}.html`);
    try {
      execFileSync('node', ['scripts/bundle-single.mjs', out], { encoding: 'utf8', stdio: 'pipe' });
      expect(existsSync('dist/sw.js'), 'vite build empties dist/ first; bundle-single.mjs must put the worker back (#136)').toBe(true);
      const sw = readFileSync('dist/sw.js', 'utf8');
      expect(sw, 'a renamed or unsubstituted placeholder must not ship').not.toMatch(/__PRECACHE__|__CACHE_NAME__/);
      expect(sw, 'the precache list must reflect the build the single-file step just produced').toContain('"index.html"');
    } finally {
      rmSync(out, { force: true });
    }
  }, 30_000);
});
