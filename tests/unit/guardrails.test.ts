import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';
import { stripHead } from '../../scripts/bundle-single.mjs';
import { NOISE_SECONDS } from '../../src/audio';   // #41: the rail below holds every SFX inside the shared buffer
import { FONT_PROBE } from '../../src/ui/font';   // #44: the rail below pins the gate's probe to index.html
import { exportSave, isMigratable, load, migrate, reset, MIGRATIONS, SAVE_VERSION } from '../../src/storage';   // #205/#232: the rails below hold the migration ladder complete, one-directional, and honest about what it exports
import { SOURCES, inDir, code, workflow } from './helpers/sources';
import { YEARS } from '../../src/curriculum/types';   // #392: the rail below holds docs/CURRICULUM.md's per-year headers to this table
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { BoxGeometry, Mesh } from 'three';   // #714: the budget meter's self-test below
import { BUDGET_CEILING, defaultsOf, OBJECTS } from '../../src/three/objects';   // #714: the budget rail builds every registered object
import { createStage, measure } from '../../src/three/stage';
import { THREE_SETTING_KEY } from '../../src/three/mount/enabled';   // #713 decision 5: the key the e2e projects preset
import { listFiles, precacheList } from '../../scripts/build-sw.mjs';   // #715: the sketchbook stays out of the precache

/**
 * The Fredoka weight axis the app actually serves, `[lo, hi]`, read from the @font-face rules in
 * src/style.css (#479). Before #479 this was index.html's `family=Fredoka:wght@500;600;700` — a discrete
 * list; self-hosting serves Google's own variable file, whose axis they declare as `font-weight: 300 700`.
 *
 * A function declaration rather than a const, because the rails that call it sit both above and below it.
 * It throws rather than defaulting: a missing or reworded declaration must break the rails that depend on
 * it, not quietly hand them a permissive range in which every weight is legal.
 */
function servedWeightRange(): [number, number] {
  const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');
  if (css.length < 5000) throw new Error('style.css must be read from disk, not a blank ?raw import');
  const faces = css.split('@font-face').slice(1);
  if (faces.length < 2) throw new Error('src/style.css must declare Fredoka with @font-face (#479)');
  const ranges = faces.map(f => {
    const m = /font-weight:\s*(\d+)(?:\s+(\d+))?/.exec(f);
    if (!m) throw new Error('every @font-face must state its font-weight (#44)');
    return [Number(m[1]), Number(m[2] ?? m[1])] as [number, number];
  });
  // Every face must cover the same axis, or "the served range" is a fiction that depends on which subset a
  // glyph fell into — a label in latin-ext would then be fitted against a different face than the one beside
  // it. Google serves one variable file per subset with identical axes; this holds that property.
  const [lo, hi] = ranges[0];
  for (const [a, b] of ranges) {
    if (a !== lo || b !== hi) throw new Error(`@font-face rules declare different weight axes (${a}-${b} vs ${lo}-${hi}) — a label's weight would depend on its subset (#479)`);
  }
  return [lo, hi];
}

/**
 * GUARD RAILS (#73) — checks that fail the build so a mistake we have already made cannot come back.
 * Every rail names the incident it prevents. Two rules for whoever edits this file:
 *   1. A *budget* rail (`toBeLessThanOrEqual(N)`) records existing debt. Lower N when you remove a case.
 *      NEVER raise one to make a build pass — that is the whole point of the rail.
 *   2. If a rail is wrong, fix it deliberately and say why in the commit; do not delete it quietly.
 *
 * **This file holds the `src/` rails only (#321).** The instruction, workflow and script rails moved to
 * `governance.test.ts`, `workflows.test.ts` and `scripts.test.ts` beside it — a mechanical move, no rail
 * reworded and none dropped. Put a new rail in the file that matches what it reads.
 *
 * Rails that need a browser live in `tests/e2e/game.spec.ts` under "guard rail:" — frame rate, and the
 * stylesheet ones. Vitest cannot read CSS text (Vite's css plugin returns an empty string for `?raw`
 * and `?inline` outside the browser), so a CSS rail written here would pass vacuously, which is worse
 * than no rail at all. Game wording is enforced separately in `british.test.ts` (#47).
 */


describe('guard rails', () => {
  it('reads the sources it claims to check', () => {                    // a vacuous rail is worse than none
    expect(Object.keys(SOURCES).length).toBeGreaterThan(10);
    expect(SOURCES['/src/game/arena.ts']?.length ?? 0).toBeGreaterThan(1000);
  });

  // Incident 2026-09-06: per-bubble gravity was smuggled through `(b as any)._g`, the e2e helpers then
  // depended on it, and the type said nothing (#33). Fixed: `Bubble.g` is a real field, read directly.
  // Budget now zero — game logic carries no `as any`. Never raise this; a new one means a new hole to close.
  it('game logic does not smuggle state through `as any`', () => {
    const hits = inDir('/src/game/').flatMap(([f, s]) => [...code(s).matchAll(/as\s+any\b/g)].map(() => f));
    expect(hits.length).toBeLessThanOrEqual(0);                         // #33 removed both; never raise this
  });

  // `shuffle(rng, arr)` exists in curriculum/util.ts; `.sort(() => rng() - 0.5)` is non-uniform and
  // engine-dependent, so "random" order is quietly biased (#42). #42 replaced all four (session.ts once,
  // arena.ts ×3) with the Fisher–Yates helper, so the budget is now zero — never raise it.
  // The pattern covers the `(a, b) =>` form and a reversed `0.5 - rng()` as well as the bare one we had;
  // it does not try to catch every way to write a biased comparator (`rng() > 0.5 ? 1 : -1`, say).
  it('no comparator shuffles', () => {
    const shuffle = /\.sort\(\s*\([^)]*\)\s*=>[^;\n]*?(?:(?:Math\.random|rng|random)\(\)[^;\n]*?0?\.5|0?\.5[^;\n]*?(?:Math\.random|rng|random)\(\))/g;
    const hits = Object.entries(SOURCES).flatMap(([f, s]) => [...code(s).matchAll(shuffle)].map(() => f));
    expect(hits.length).toBeLessThanOrEqual(0);                         // #42 removed all four; never raise this
  });

  // `shadowBlur` is per-pixel CPU work; arena.ts itself notes it is "too slow on low-end devices". #29 removed
  // the last of it from the per-frame draw paths — the bolt/star particle glows, the outcome spotlight ring and
  // the tracer stroke now draw a cheap translucent underlay halo instead. Budget is 0: never raise this.
  // #65 review: `arena.paused` used to have five writers across play.ts and play-session.ts, and correctness
  // rested on two of them agreeing (a peek releasing under a stage-clear overlay would have restarted the wave
  // behind it). Every reason to pause now flows through play-session's `syncPaused()` — the screen's overlays
  // via `hold()`, the peek, and a finished game — so outside arena.ts there is exactly one assignment. A second
  // one is a second owner, and this rail names it. #16: the Ninja Duel screen has its own two arenas and no
  // play-session, so it carries its own single sum (`syncPaused`) — one writer per screen, listed verbatim
  // below, so a third assignment anywhere (a new reason written outside a screen's sum) is still red.
  it('arena.paused has one writer per screen outside arena.ts (#65, #16)', () => {
    const writers = Object.entries(SOURCES)
      .filter(([f]) => f !== '/src/game/arena.ts')
      .flatMap(([f, s]) => code(s).split('\n').filter(l => /\.paused\s*=[^=]/.test(l)).map(l => `${f}: ${l.trim()}`));
    expect(writers, 'route a new pause reason through the screen\'s hold()/syncPaused(), never a direct write').toEqual([
      '/src/ui/duel.ts: const syncPaused = () => { for (const p of PLAYERS) arenas[p].paused = holdOpen || duel.ended; };',
      '/src/ui/play-session.ts: if (arena) arena.paused = holdOpen || peekActive || session.ended;',
    ]);
  });

  // #468 item 5: #430's correctness argument for `hintIsData` rests on "`setHint` (play-session.ts) and
  // `showOutcome` (hud.ts) are the only writers of the play screen's `#hint` element" — true by inspection
  // today, not by construction. A third writer anywhere in src/ui/ could show a data-carrying hint's raw
  // values outside those two paths, or blank an instruction hint, with every other rail here still green.
  // Scoped to `els.hint`, the play screen's element — a same-named local `hint` variable elsewhere
  // (profiles.ts, avatar.ts, certificate.ts each build their own unrelated hint element) is not this rail's
  // concern and does not match `els.hint`. This does not catch a write that reaches `els.hint` through an
  // alias (a destructured `{ hint }` or a renamed reference), one split across more than one line, or a
  // property other than `textContent`/`innerHTML` (`.innerText`, `insertAdjacentHTML`, `Object.assign`) —
  // only a direct, single-line `els.hint.textContent`/`.innerHTML` access (silent-failure-hunter review of
  // this pull request, round 1).
  it('the play screen\'s #hint has exactly two writers: setHint and showOutcome (#468 item 5)', () => {
    const writers = inDir('/src/ui/')
      .flatMap(([f, s]) => code(s).split('\n').filter(l => /\bels\.hint\.(?:textContent|innerHTML)\s*\+?=[^=]/.test(l)).map(l => `${f}: ${l.trim()}`));
    expect(writers, 'route a new hint write through setHint() or showOutcome(), never a direct assignment').toEqual([
      '/src/ui/hud.ts: els.hint.innerHTML = outcomeHintHTML(kind, q.answer);',
      '/src/ui/play-session.ts: els.hint.textContent = text;',
    ]);
  });

  // #365: a finished game reaches the save in ONE write. `recordDojo()` then `addCoins()` was two saves with
  // no rollback, and `save()` swallows a refused `setItem` (#151), so a store that took the first and refused
  // the second recorded the Daily Dojo challenge as done while its coins never landed — and `applyEvent()`
  // only pays `!done.includes(c.id)`, so that bonus was gone for the day. `recordGameEnd()` replaced the pair
  // on all three results screens, but nothing stopped them going back: reverting play.ts, memory.ts and
  // duel.ts to the pre-fix pair left the suite 1696/1696 green and `tsc` clean (PR #438 review, round 2).
  // Both halves of the pair stay exported with unchanged signatures and zero `src/` callers, which is exactly
  // the adjacency a fourth results screen meets. A screen settles a finished game through `recordGameEnd()`.
  it('no screen settles a finished game with the recordDojo/addCoins pair (#365)', () => {
    const hits = inDir('/src/ui/').flatMap(([f, s]) =>
      [...code(s).matchAll(/\b(recordDojo|addCoins)\s*\(/g)].map(m => `${f}: ${m[1]}(`));
    expect(hits, 'a results screen uses recordGameEnd() — the pair is two writes with no rollback (#365)')
      .toEqual([]);
  });

  it('shadowBlur stays out of the per-frame draw paths', () => {
    const hits = inDir('/src/game/').flatMap(([f, s]) => [...code(s).matchAll(/shadowBlur/g)].map(() => f));
    expect(hits.length).toBeLessThanOrEqual(0);                         // #29 removed them; never raise this
  });

  // #115: the grown-ups "Start again" reset must use the existing .overlay modal for its confirmation — a
  // native confirm()/alert()/prompt() looks foreign in this game and blocks Playwright's unattended e2e run.
  it('the grown-ups reset flow never uses a native dialog (#115)', () => {
    const src = code(SOURCES['/src/ui/parents.ts']);
    expect(src).not.toMatch(/\b(?:confirm|alert|prompt)\s*\(/);
  });

  // #151: save() swallows a failed write by design (a device that cannot persist must not crash the game),
  // which is exactly why the grown-ups dashboard has to say so — nothing else on the device ever will. This
  // screen has no DOM harness this repo can run without a browser (#141), so the rail is textual: it holds
  // the two distinguishable reasons wired into the dashboard, not merely present somewhere in the file.
  it('the grown-ups dashboard warns when the save is not being kept (#151)', () => {
    const src = code(SOURCES['/src/ui/parents.ts']);
    expect(src).toMatch(/isReadOnlySave\s*\(\s*\)/);
    expect(src).toMatch(/isWriteFailing\s*\(\s*\)/);
    expect(src).toMatch(/class="p-note save-note"/);
  });

  // #28: drawBubble built a radial gradient (+ two colour strings) and ran a `measureText` font-fit loop for
  // every bubble every frame — hundreds of measureText calls per frame with a wide word wave on a phone. The
  // body is now a cached sprite (bodySprite) and the label size is fitted once at spawn (fitLabel), so neither
  // call may reappear in the per-frame draw path. Scoped to drawBubble's body: bodySprite/glowSprite and the
  // ember particle legitimately build gradients elsewhere, and fitLabel measures once at spawn.
  it('drawBubble does no per-frame gradient or measureText work (#28)', () => {
    const src = code(SOURCES['/src/game/arena.ts']);
    const from = src.indexOf('private drawBubble(');
    expect(from).toBeGreaterThan(0);
    const body = src.slice(from, from + 1 + src.slice(from + 1).indexOf('\n  private '));   // up to the next method
    expect(body).not.toMatch(/createRadialGradient|measureText/);
  });

  // #348: a label that had to be wrapped reaches the screen only if drawBubble iterates every fitted line
  // and recentres the block on the disc. Dropping either is a one-line edit that reverts the whole feature,
  // so the shape is pinned here as well as behaviourally in `arena-spawn.test.ts` (PR #467 review, B2).
  it('drawBubble draws every fitted line, recentred on the disc (#348)', () => {
    const src = code(SOURCES['/src/game/arena.ts']);
    const from = src.indexOf('private drawBubble(');
    expect(from).toBeGreaterThan(0);
    const body = src.slice(from, from + 1 + src.slice(from + 1).indexOf('\n  private '));
    // Both text passes (the dark outline, then the white fill) walk the whole `lines` array…
    expect([...body.matchAll(/for \(let i = 0; i < lines\.length; i\+\+\) c\.(stroke|fill)Text\(lines\[i\]/g)]).toHaveLength(2);
    // …and neither draws `b.label`, which is the answer key and not what a wrapped bubble shows.
    expect(body).not.toMatch(/(stroke|fill)Text\(\s*(b\.label|text)\b/);
    // …and the block's first baseline is offset by half the stack, not pinned to the single-line one.
    expect(body).toMatch(/top = 2 - \(lines\.length - 1\) \* lh \/ 2/);
  });

  // #48 review: tapping a TNT threw a ninja star at it, so the bomb burst once from play.ts's BOMB branch and
  // again when the star landed — and the landing fired the avatar's *slice* sound, rewarding the child for
  // hitting the bomb, while the exploded bubble kept falling for the 150 ms flight. The arena now asks
  // `throwFor(b)` before throwing; play.ts answers false for the TNT so it pops under the finger. The e2e
  // proves the behaviour; this rail catches the wiring being dropped in a refactor, where e2e cannot run.
  it('a tapped TNT is never thrown at (#48)', () => {
    const play = code(SOURCES['/src/ui/play.ts']);
    expect(play).toMatch(/throwFor:\s*b\s*=>\s*b\.label\s*!==\s*BOMB/);
    const arena = code(SOURCES['/src/game/arena.ts']);
    expect(arena).toContain('this.throwFor ? this.throwFor(b) : true');   // the tap path consults it
    // #742: the gentle-year branch sits inside the same `!b.hit` guard, so a tapped bubble in flight still
    // never reaches onFall (nor becomes the deferred gentleTargetFallen) whichever path it takes.
    expect(arena).toMatch(/if \(!b\.hit\) \{ if \(gentle\).*this\.cb\.onFall\(b\)/);
  });

  // #742 review round 1 (pr-test-analyzer, silent-failure-hunter): tests/unit/sim.test.ts's own BOMB-vs-gentle
  // regression test hand-duplicates play.ts's `isHazard` predicate rather than reading it — this pins play.ts's
  // own wiring so a future edit that drops or mistypes it (leaving `throwFor` correct but `isHazard` stale)
  // fails a rail here, not just silently un-tests a live bug's fix.
  it('a TNT is wired as a hazard everywhere it is wired as unthrowable (#742)', () => {
    const play = code(SOURCES['/src/ui/play.ts']);
    expect(play).toMatch(/isHazard:\s*label\s*=>\s*label\s*===\s*BOMB/);
    const arena = code(SOURCES['/src/game/arena.ts']);
    expect(arena).toContain('!this.isHazard?.(b.label)) this.gentleDecoys.push(b)');
  });

  // CLAUDE.md: no dependencies without reason (Capacitor is the documented exception). A new one now has
  // to be argued for in the PR that adds it, because this rail goes red until the list is updated too.
  // `@capacitor/filesystem`/`@capacitor/share` (#110) and `@capacitor/app` (#699) are that exception again:
  // the Android tablet's `certRoute` 'capacitor' path and its hardware back button both need native plugin
  // code registered via `npx cap sync`, the same reason `@capacitor/android`/`@capacitor/core` are here — see
  // `src/native.ts`'s `plugin()`, which reads all three off the injected bridge rather than importing any of
  // them, so none is a static or dynamic `import` anywhere in `src/` (checked below alongside the empty
  // `dependencies` list, since that only proves neither is a *runtime* dependency of the web build).
  // #684 (owner, in session, 2026-09-24): `three` is the first runtime dependency — the 3-D solids on the
  // 3-D Shapes cards are three.js primitives — and `@types/three` is its typings (three ships none). The
  // spike measured the cost in its pull request; the owner decides on the issue whether it stays. Both
  // lists are exact, so a second runtime dependency is still a red build until it is argued for here.
  it('dependencies match the allowlist below (CLAUDE.md explains the rule)', () => {
    const allowed = ['@capacitor/android', '@capacitor/app', '@capacitor/cli', '@capacitor/core', '@capacitor/filesystem', '@capacitor/share', '@playwright/test', '@types/three', 'typescript', 'vite', 'vitest'];
    expect(Object.keys((pkg as { dependencies?: object }).dependencies ?? {})).toEqual(['three']);   // #684: the one thing that ships to the browser beside our own code
    expect(Object.keys((pkg as { devDependencies?: object }).devDependencies ?? {}).sort()).toEqual([...allowed].sort());
  });

  // #684/#714: where `three` may be imported, how it is reached and what the built chunks carry is the
  // describe block at the end of this file — `three.js: the src/three/ tree, the flag and the bundle (#714)`.


  // #110/#699: `@capacitor/filesystem`/`@capacitor/share`/`@capacitor/app` exist only so `npx cap sync`
  // registers their native Android code; the web bundle must never import any of the three (that would ship
  // Capacitor's own wrapper code — and the web-only build's `dist/` output — to every non-APK player).
  // `src/native.ts`'s `plugin()` reads them off the injected bridge instead, the same pattern `isNativeShell`
  // already uses for `@capacitor/core`. Proved red first: added `import '@capacitor/share'` to a scratch
  // file under `src/`, watched this fail, removed it.
  it('src/ never imports @capacitor/filesystem, @capacitor/share or @capacitor/app (#110, #699)', () => {
    for (const [path, src] of Object.entries(SOURCES)) {
      expect(src, `${path} must read the Capacitor plugin bridge, not import the plugin package`)
        .not.toMatch(/\bimport\s*\(?[^;]*['"]@capacitor\/(filesystem|share|app)['"]/);
    }
  });

  // #557 (#325 stage 1): src/game/ never imports src/ui/ — zero occurrences today, and that one-way
  // dependency is why src/game/session.ts is testable without a browser and the sim harness (#142) works at
  // all. Every later stage of #325 moves files around, and each could break it silently. Text rail, over
  // code() (comments may name the ban): it reads every literal specifier and RESOLVES it the way the bundler
  // would — `posix.resolve` from the importing file's own directory — before asking whether it lands under
  // `/src/ui/`. Resolving, not spelling-matching, is what closes the class the first two rounds of PR #710
  // patched one member at a time: `../ui/dom`, `../../src/ui/dom` (round 1), `./../ui/dom` (round 2), and
  // `../../game/../ui/dom` all resolve to the same module, and so does any future spelling, since the module
  // graph is what the rail is about. A Vite-root absolute specifier (`/src/ui/…`) is already resolved.
  // It cannot see a path assembled at run time — `'../' + 'ui/' + name` — only a literal or template
  // specifier. And it resolves the DECODED string, not the source text between the quotes (round 3): a
  // specifier written `'..\u002fui\u002fdom'` is `../ui/dom` to TypeScript, so the escapes a string literal can
  // carry — `\uXXXX`, `\u{…}`, `\xXX`, `\/` and the rest — are undone first. Proved red: added each of the four
  // spellings above, then `'..\u002fui\u002fdom'` and `'..\x2fui\x2fdom'` (written with printf so the escape
  // reaches the disk), to a scratch file under src/game/, watched this fail on every one, removed it; a
  // scratch `import { x } from '../curriculum/util'` stays green. `../ui` bare (a barrel, none exists) is
  // caught too — the resolved path is compared as a directory, not only as a prefix.
  // A backslash immediately before a line terminator is JS's line-continuation escape — it vanishes from the
  // decoded string, the same as any other `\<char>` escape decode() already undoes (PR #710 round 4: the
  // specifier-capture regex below excluded `\n` outright, so a specifier split across a continuation line
  // never reached decode() at all — this is that gap's other half, decode() itself swallowing the pair).
  // ECMAScript's LineTerminatorSequence is `\r\n`, a bare `\r`, a bare `\n`, U+2028 or U+2029 (round 5: `\r?\n`
  // only matched a `\n`-terminated pair, so a bare `\<CR>` with no following `\n` — itself a complete, valid
  // continuation — fell through to the `\(.)` fallback, which JS regex `.` cannot match either, since `.`
  // excludes every line terminator; the pair survived undecoded and `posix.resolve` read it as a path segment).
  // `posix.resolve` is POSIX-only — it never treats `\` as a separator — but TypeScript's own resolver does,
  // on every host OS, so a decoded specifier has its backslashes normalised to `/` before resolving (round 6:
  // `..\ui\dom` decodes to a real, single-backslash string via decode()'s own `\(.)` fallback — decode() was
  // never the bug — then glued onto the importing directory as one opaque segment instead of climbing out of
  // it, the same "resolve like the compiler does" gap rounds 1-3 closed for `/`-separated spellings).
  const decode = (s: string) => s.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})|\\(?:\r\n|\r|\n|\u2028|\u2029)|\\(.)/g,
    (_, brace, u4, x2, ch) => brace ? String.fromCodePoint(parseInt(brace, 16)) : u4 ? String.fromCharCode(parseInt(u4, 16)) : x2 ? String.fromCharCode(parseInt(x2, 16)) : ch ?? '');
  it('the specifier decoder undoes what a string literal can hide', () => {
    expect(decode('..\\u002fui\\u002fdom')).toBe('../ui/dom');
    expect(decode('..\\x2fui\\x2fdom')).toBe('../ui/dom');
    expect(decode('\\u{2e}./ui\\/dom')).toBe('../ui/dom');
    expect(decode('../ui/dom')).toBe('../ui/dom');
    expect(decode('../\\\nui/dom')).toBe('../ui/dom');
    expect(decode('../\\\rui/dom')).toBe('../ui/dom');
    expect(decode('../\\\r\nui/dom')).toBe('../ui/dom');
    expect(decode('../\\\u2028ui/dom')).toBe('../ui/dom');
    expect(decode('../\\\u2029ui/dom')).toBe('../ui/dom');
  });
  it('no file in src/game/ imports from src/ui/ (#557)', () => {
    // The capture group excludes a bare `\n` (an unterminated string is a syntax error, not a specifier to
    // chase past) but admits a `\` immediately followed by one — JS's line-continuation escape — so a
    // specifier split across lines that way is still captured whole and reaches decode() above.
    const specifiers = (src: string) => [...code(src).matchAll(/\b(?:from|import|require)\s*\(?\s*['"`]((?:\\\r?\n|[^'"`\n])+)['"`]/g)].map(m => decode(m[1]));
    for (const [path, src] of inDir('/src/game/')) {
      const resolved = specifiers(src).map(s => s.startsWith('.') ? posix.resolve(posix.dirname(path), s.replace(/\\/g, '/')) : s);
      expect(resolved.filter(s => s === '/src/ui' || s.startsWith('/src/ui/')), `${path} must not import from src/ui/ — src/game/ is the browser-free half of the split`)
        .toEqual([]);
    }
  });

  // #699 item 1: `src/native.ts` is the one owner of the Capacitor bridge — every other module under `src/`
  // reads it (presence, platform, a plugin) through `isNativeShell`/`plugin` there rather than touching
  // `window.Capacitor`/`Capacitor.Plugins` itself, so a future change to how the bridge is detected or
  // accessed has one place to make it. Proved red first: added a scratch `(window as
  // {Capacitor?:unknown}).Capacitor` read to `src/pwa.ts`, watched this fail, removed it.
  it('native.ts is the only file under src/ that reads window.Capacitor / Capacitor.Plugins (#699)', () => {
    for (const [path, src] of Object.entries(SOURCES)) {
      if (path === '/src/native.ts') continue;
      expect(src, `${path} must go through native.ts's isNativeShell/plugin, not read the bridge itself`)
        .not.toMatch(/window\.Capacitor|Capacitor\.Plugins/);
    }
    expect(SOURCES['/src/native.ts'], 'native.ts should still be the file doing the reading').toMatch(/\.Capacitor\b/);
  });

  // The `window.__sna` hooks are the e2e contract (CLAUDE.md); losing one breaks every test at runtime only.
  // Substring check: it catches a hook being dropped or renamed, not one that stops working.
  it('the window.__sna test hooks still exist', () => {
    const play = SOURCES['/src/ui/play.ts'];
    expect(play).toContain('__sna');
    for (const hook of ['answer:', 'wrong:', 'bubbles:', 'state:', 'certificate:']) expect(play).toContain(hook);
    for (const hook of ['__sna', 'cards:', 'flip', 'state:']) expect(SOURCES['/src/ui/memory.ts']).toContain(hook);
  });

  // #34: `window.__sna` was typed `any` in play.ts, memory.ts and the spec, so a renamed or dropped hook
  // broke tests only at runtime. The screens now build the hooks as a typed PlayHooks/MemoryHooks from
  // src/ui/hooks.ts, so tsc checks the contract. This rail keeps them typed: neither screen casts the global
  // through `any`, and hooks.ts declares both interfaces. Re-adding `(window as any).__sna` turns it red.
  it('the __sna hooks are typed via hooks.ts, not `any` (#34)', () => {
    for (const f of ['/src/ui/play.ts', '/src/ui/memory.ts'])
      expect(code(SOURCES[f]), `${f} must not cast window to any for __sna`).not.toMatch(/\(\s*window as any\s*\)\.__sna/);
    const hooks = code(SOURCES['/src/ui/hooks.ts'] ?? '');
    expect(hooks, 'hooks.ts declares PlayHooks').toContain('interface PlayHooks');
    expect(hooks, 'hooks.ts declares MemoryHooks').toContain('interface MemoryHooks');
  });

  // Incident 2026-09-06 (#73 review): play/memory own a rAF loop, timers and window listeners, but only the
  // buttons tore them down — the back button left a whole screen running. The router must dispose every
  // screen it replaces, and the e2e rail "leaving the play screen stops it" proves it at runtime.
  it('the router tears down the screen it leaves', () => {
    const main = code(SOURCES['/src/main.ts']);
    expect(main).toMatch(/dispose\s*=\s*playScreen\(/);
    expect(main).toMatch(/dispose\s*=\s*memoryScreen\(/);
    expect(main).toMatch(/dispose\s*=\s*duelScreen\(/);      // #16: the third arena-owning screen
    // Match each route's *body*, not its layout: an equivalent reformat must not turn this red
    // (ugurozsahin/sky-academy-private-archive#74 review).
    // The route names are read from the source, so a screen added later is covered without editing this test.
    // Bound the slice at the router's closing brace: unbounded, the LAST route's "body" ran to end of file, so
    // any `leave()` written lower in main.ts made a genuinely broken route pass (#77 review).
    const from = main.indexOf('const nav = {'), to = main.indexOf('\n};', from);
    expect({ router: from >= 0 && to > from }).toEqual({ router: true });
    const routes = main.slice(from, to).split(/\n\s*(?=\w+:)/).slice(1);
    const named = routes.map(r => [r.slice(0, r.indexOf(':')), r] as const).filter(([n]) => n !== 'up');
    expect(named.length).toBeGreaterThanOrEqual(7);                     // every screen the router can show
    // A route may hand off rather than dispose in its own body — `profiles` calls `goProfiles`, the picker's
    // one way in, which the boot path takes too (#380 review round 5, B3). So the rail follows the hand-off
    // one level instead of being satisfied by the call: whatever the route names must itself tear the old
    // screen down. One level and no further, deliberately — a chain this rail cannot read is a route it
    // cannot vouch for, and it should say so by failing.
    const disposes = (body: string): boolean => {
      if (/\bleave\(\)/.test(body)) return true;
      const handoff = body.match(/=>\s*(\w+)\(\)/);
      if (!handoff) return false;
      const at = main.indexOf(`const ${handoff[1]} = `);
      if (at < 0) return false;
      const brace = main.indexOf('{', at), nl = main.indexOf('\n', at);
      const end = brace >= 0 && brace < nl ? main.indexOf('\n};', at) : nl;   // a block body, or a one-line arrow
      return end > at && /\bleave\(\)/.test(main.slice(at, end));
    };
    for (const [screen, body] of named)
      expect({ screen, disposes: disposes(body) }).toEqual({ screen, disposes: true });
    for (const f of ['/src/ui/play.ts', '/src/ui/memory.ts']) expect(code(SOURCES[f])).toContain('return cleanup;');
  });

  // #20 slice 2 — the profile picker. Four properties it is built on, none of which fails loudly.
  //
  // 1. The picker is a **launch screen, not a stack entry**: `mapScreen` pushes no history entry and
  //    `nav.map()` pops whenever one exists, so an `enter('profiles')` would send every "chosen, go to the
  //    map" straight back to the picker — a loop a child could not leave. A future hand adding `enter(...)`
  //    to the route for symmetry with its neighbours is exactly the plausible edit. **The route is not the
  //    only place that edit lands** (#380 review B3): the route hands off to `goProfiles`, which is what
  //    actually pops, draws the picker and is the boot path's way in too, and is where `leave()` and
  //    `fromPop` already sit — so it looks more like every other route than the route does. It is defined
  //    below `up,` and so was outside this rail's slice by construction: inserting `enter('profiles')`
  //    there alone left all 332 rails and the whole 1439-test suite green.

  // 2. Boot shows it only when siblings actually share the device. Nothing changes for today's players,
  //    which is the owner's decision at the top of #20, and `> 1` is the whole of it.
  // 3. The store is asked before the child is moved: a `go(...)` that did not wait for
  //    `setActiveProfile` to accept the switch would drop a child into a sibling's game on a store that refuses.
  // 4. Drawing a card never goes through `load()`/`save()` — those resolve and latch *this session's*
  //    profile, so reading a sibling's name through them would answer the wrong child or bind the session
  //    to them. `profileCard()` reads the slot key directly for that reason.
  it('the profile picker is a launch screen, gated on more than one profile (#20 slice 2)', () => {
    const main = code(SOURCES['/src/main.ts']);
    const from = main.indexOf('profiles: () =>'), to = main.indexOf('\n  up,', from);
    const drawFrom = main.indexOf('const goProfiles = ('), drawTo = main.indexOf('\n};', drawFrom);
    expect({ route: from >= 0 && to > from, draws: drawFrom >= 0 && drawTo > drawFrom })
      .toEqual({ route: true, draws: true });   // a rename empties the slice below, so fail here instead
    expect(main.slice(from, to) + main.slice(drawFrom, drawTo), 'neither the route nor the function that draws the picker pushes a history entry')
      .not.toMatch(/\benter\(/);
    expect(main, 'boot reaches the picker only with two or more profiles').toMatch(/profileIds\(\)\.length > 1/);
    expect(main, 'and a one-profile device boots exactly as it did').toMatch(/else if \(load\(\)\.onboarded\) nav\.map\(\); else nav\.avatar\(\)/);
  });

  // Property 3 was pinned by source order alone, and source order is not control flow: deleting the one
  // `return` from the refusal branch left this file green and the whole suite at 1427/1427 while a refused
  // switch dropped the child into their sibling's game (#380 review B2). The decision is a pure function now
  // and `tests/unit/profiles.test.ts` mutation-tests it for real; what a source rail can still hold is that
  // the handler routes the store's answer through it, and that the child is moved with an id that exists
  // only on the accepted arm — so falling out of the refusal is a type error, caught by `tsc`, not a rail.
  it('the picker moves a child only once the store has accepted the switch (#20 slice 2)', () => {
    const pick = code(SOURCES['/src/ui/profiles.ts']);
    expect(pick, "the store is asked, and its answer is the decision's only input").toMatch(/pickOutcome\(c\.id, setActiveProfile\)/);
    expect(pick.match(/\bgo\(/g) ?? [], 'one call site for go(), inside the guarded handler').toHaveLength(1);
    expect(pick, 'and the child is moved with the id off the accepted arm').toMatch(/go\(o\.id\)/);
    expect(pick, 'the same shape for "New ninja": onboarding starts on the added profile').toMatch(/onNew\(o\.id\)/);
    // Both refusals are told apart on screen (#335 item 2): a picker that shows one sentence for both tells a
    // child with four siblings that their browser is broken, or the reverse. A `Record`, not the ternary this
    // used to pin (#401 item 2): a third refusal reason missing from it is a `tsc` error here, not a silent
    // fallback to one of the two sentences a rail this shallow could not have told apart either.
    // The call site, not the declaration (PR #590 review round 1): `Record<AddRefusal, string>` alone matches
    // anywhere in the file, so a revert of `addOutcome` back to the ternary left the now-dead `ADD_HINTS`
    // declaration sitting unused beside it and this rail green throughout — reproduced and confirmed by two
    // independent reviewers. Pinning `hint: ADD_HINTS[r.why]` reads the use, not a type sitting nearby.
    expect(pick).toMatch(/hint: ADD_HINTS\[r\.why\]/);
    // And both are read aloud, not only printed — `.claude/rules/style.md`, "read-aloud everywhere" (B6).
    // Two halves, because this rail can only ever hold one of them. It reads `refuse`'s *definition*, and
    // deleting both calls left `tsc` clean and 1436/1436 green while a refused tap did nothing at all — no
    // hint, no `sfx.wrong()`, no spoken sentence (#380 review B2). The call sites below stop that one
    // mutation; what holds the behaviour is the e2e in `tests/e2e/game.spec.ts` that taps a card on a store
    // whose `setItem` throws and asserts both sentences are printed *and* handed to the speech engine.
    expect(pick, 'a refusal is spoken as well as written').toMatch(/hint\.textContent = text; say\(text\);/);
    expect(pick.match(/return refuse\(o\.hint\);/g) ?? [], 'and both handlers route their refusal through it').toHaveLength(2);
  });

  // #380 review B1 (round 3): `avatarById` falls back to `AVATARS[0]`, which is Volt — right for every
  // caller that has already decided a portrait is going on screen, and wrong for the one screen whose job is
  // telling children apart. A slot with no ninja chosen drew Volt's portrait and Volt's glow, pixel for
  // pixel a sibling who plays as Volt, and the only difference was the text under it — on a screen whose
  // audience cannot read. `avatarOrNull` is the lookup that has no opinion; the fallback stays where it is.
  it('the picker draws a slot with no ninja as an empty slot, not as Volt (#20 slice 2)', () => {
    const pick = code(SOURCES['/src/ui/profiles.ts']);
    expect(pick, 'the picker asks for the ninja that exists, not one to fall back on').toMatch(/avatarOrNull\(c\.avatar\)/);
    expect({ fallbackUsed: /\bavatarById\b/.test(pick) }).toEqual({ fallbackUsed: false });
    expect(pick, 'and a card with none borrows the ＋ card\'s dashed figure').toMatch(/a \? '' : ' new-ninja'/);
    // The two cards must not also share their words: "New ninja" on both is what made the empty slot and the
    // ＋ card a coin flip in the first place. The ＋ card's `<b>` is literal; the slot's comes from `cardName`.
    expect(code(SOURCES['/src/avatars.ts']), 'the null-answering lookup is the one home of the id → ninja walk')
      .toMatch(/export const avatarOrNull = [\s\S]{0,200}ALL_AVATARS\.find/);
    expect(pick, 'an unnamed slot is named by its slot, not by the ＋ card\'s words').toMatch(/name\.trim\(\) \? name : `Ninja \$\{slot\}`/);
  });

  // #380 review B1: the picker pushes no history entry, so whatever entry was current when it opened is what
  // everything leaving it unwinds onto — and the 👥 button was then a fourth control on the *shared* topbar, so
  // that was the island or rewards screen. A new Reception profile finished the wizard on the previous child's
  // Year 2 island.
  //
  // **Round 5's B3 is the same bug by the other door, and it is why this rail now reads one function rather
  // than two sites.** The route popped to the root; the boot path drew the picker wherever the stack happened
  // to be, and `history.state` survives a reload — so a refresh from an island put the *launch* picker, the
  // one that deliberately draws no `←` because "back leaves the app", on top of that island's entry, and one
  // back press dismissed it into whoever the index last called active. Two callers of one drawing function,
  // each with its own idea of where the stack was and which mode to ask for, is the shape that produced it; a
  // single way in whose mode is *derived* is what this holds now.
  it('the picker is reached at the root of the history stack, from wherever it was opened (#20 slice 2)', () => {
    const main = code(SOURCES['/src/main.ts']);
    const drawFrom = main.indexOf('const goProfiles = ('), drawTo = main.indexOf('\n};', drawFrom);
    const go = main.slice(drawFrom, drawTo);
    expect(go, 'a stacked entry is popped before the picker is drawn')
      .toMatch(/if \(history\.state\?\.screen\) \{ pendingProfiles = \{ root \}; history\.back\(\); return; \}/);
    // **And the kind of picker survives the pop** (#420 review B1). `pendingProfiles` was a bare boolean, so a
    // launch that had to unwind a stacked entry came back through this line having forgotten it was a launch,
    // and the far side re-derived `back` from `screenDrawn()` — which is `true` on every route that unwinds.
    // The intent has to travel with the flag, and the pop has to hand it back.
    expect(main, 'and the pop lands back in the one way in, carrying which kind of picker it was')
      .toMatch(/if \(pendingProfiles\) \{ const \{ root \} = pendingProfiles; pendingProfiles = null; goProfiles\(root\); return; \}/);
    expect(main, 'boot takes that same way in, so a reload cannot draw the launch picker on a stacked entry')
      .toMatch(/length > 1\) goProfiles\(true\);/);
    expect(main.match(/profilesScreen\(/g) ?? [], 'which is the one place the picker is drawn').toHaveLength(1);
    // Launch-or-back is still derived from the page, with one explicit override: a caller that *knows* the
    // screen behind it is drawn from a save that no longer exists. `root ||` is that override and nothing else
    // may add another, which is why the whole expression is pinned rather than just `screenDrawn()`.
    expect(go, 'and launch-or-back is the page, plus an explicit root the caller can assert')
      .toMatch(/const back = root \|\| !screenDrawn\(\) \? undefined : \(\) => nav\.map\(\);/);
    // The two callers that must assert it, and the one that must not: a removal and boot are launches, the 👥
    // button has the sky map genuinely behind it. Mutating either `true` to `false` puts a `←` on the launch
    // picker, which is #380 round 5 B3 and #420 B1 in one line.
    expect(main, 'a removal relaunches into the launch picker, not one with a way past the question')
      .toMatch(/const relaunch = \(\) => \{[\s\S]{0,600}goProfiles\(true\);/);
    expect(main, 'and the 👥 button asks for the one with a way back').toMatch(/profiles: \(\) => goProfiles\(\),/);
  });

  // #380 review B3: `profileCard` deliberately does not run the migrations, but `onboarded` only exists from
  // v3, and nothing on `boot → map → 👥` writes a migrated blob back — so reading the field raw made a
  // fully-played v2 save draw as "Not started yet" while `load()` said otherwise about the same bytes.
  //
  // This rail used to hold two *copies* of the expression against one regex, and the regex stopped at the
  // colon — so the fallback, which is the whole of the rule, was never compared (#380 review note 1). The
  // two had already drifted: `{ v: 2, avatar: 7 }` migrated to `onboarded: true` and drew a card saying
  // "Not started yet". There is one rule now, so what this holds is that both sites call it rather than
  // spelling it out again — which a copy cannot pass by looking similar.
  it("a card's onboarded flag and the migration's are the same rule, not two copies (#20 slice 2)", () => {
    const store = code(SOURCES['/src/storage.ts']);
    const at = (fn: string) => store.slice(store.indexOf(fn), store.indexOf('\n}', store.indexOf(fn)));
    const raw = /typeof s\.onboarded === 'boolean' \? s\.onboarded/;
    expect(store, 'the rule has one home').toMatch(/export const onboardedOf = \(s: RawSave\): boolean =>/);
    expect(at('export function profileCard('), 'the card calls it').toMatch(/onboarded: onboardedOf\(s\)/);
    const migFrom = store.indexOf('MIGRATIONS: Record');
    const migrations = store.slice(migFrom, store.indexOf('\n};', migFrom));
    expect({ ladder: migFrom >= 0 && migrations.length > 0 }).toEqual({ ladder: true });
    expect(migrations, 'and so does MIGRATIONS[2]').toMatch(/onboarded: onboardedOf\(s\)/);
    // The copies are gone, not merely joined by a third site: a re-inlined rule at either call site is the
    // drift this rail exists to catch, and it would otherwise read as green beside the call it replaced.
    for (const [where, body] of [['profileCard', at('export function profileCard(')], ['MIGRATIONS[2]', migrations]] as const)
      expect({ where, inlined: raw.test(body) }).toEqual({ where, inlined: false });
  });

  // #380 review B2: `profileCard` applied MIGRATIONS[2]'s rule but not the version gate `load()` applies
  // first, so a save from a *newer* build — which `migrate()` refuses and answers `{ ...DEFAULT }` for —
  // drew a card with that child's real name and ninja. Tapping it moved the session, `afterPick()` read
  // `onboarded: false` off the default, and the child was put through the first-run wizard with `readOnly`
  // latched and every write dropped. The card has to agree with `load()` about the same bytes.
  it('a card is blank for a save load() would refuse, not a name the tap cannot deliver (#20 slice 2)', () => {
    const store = code(SOURCES['/src/storage.ts']);
    const card = store.slice(store.indexOf('export function profileCard('), store.indexOf('\n}', store.indexOf('export function profileCard(')));
    // The card still answers blank for every blob `migrate()` refuses — it now also says *which* refusal, so a
    // screen can stop claiming "this ninja has not played" about bytes it could not read (#420 review B2), and
    // can tell a newer build's save apart from a `v` no build ever wrote (#431 review item 3). The gate is
    // unchanged; only the shape of the blank card grew.
    expect(card, 'the card applies the same gate migrate() does').toMatch(/if \(!isMigratable\(s\)\) return \{ id, state: isFutureSave\(s\) \? 'future' : 'corrupt' \};/);
    expect(store.slice(store.indexOf('function migrate(')), 'and that gate is still the one load() goes through').toMatch(/if \(!isMigratable\(s\)\) return \{ \.\.\.DEFAULT \};/);
    // `future` is the *narrower* question, not `!isMigratable` renamed: an unreadable `v` is deliberately not
    // protected — `load()` resets over it and writes resume — so only a genuinely newer save refuses a delete.
    expect(store, 'and the delete refuses on that narrower question, at one home').toMatch(/function futureSaveIn\(id: ProfileId\): boolean \{[\s\S]{0,400}isFutureSave\(parsed as RawSave\)/);
    const del = store.slice(store.indexOf('export function deleteProfile('), store.indexOf('\n}', store.indexOf('export function deleteProfile(')));
    expect(del, 'before the index write, so a refusal changes nothing').toMatch(/if \(futureSaveIn\(id\)\) return \{ ok: false, why: 'future' \};[\s\S]*writeIndex\(next\)/);
  });

  it("a sibling's card is read from the slot, never through the session's load() (#20 slice 2)", () => {
    const store = code(SOURCES['/src/storage.ts']);
    const from = store.indexOf('export function profileCard('), to = store.indexOf('\n}', from);
    expect({ fn: from >= 0 && to > from }).toEqual({ fn: true });
    const body = store.slice(from, to);
    expect(body, 'reads the slot key itself').toMatch(/readItem\(saveKeyFor\(id\)\)/);
    for (const banned of ['load(', 'save(', 'sessionProfile(', 'localStorage.setItem'])
      expect({ banned, used: body.includes(banned) }).toEqual({ banned, used: false });
    expect(code(SOURCES['/src/ui/profiles.ts']), 'and the picker uses it rather than load()').not.toMatch(/\bload\(\)/);
  });

  it('addProfile probes the slot it hands out, not just the index (#335 item 1)', () => {
    const store = code(SOURCES['/src/storage.ts']);
    const from = store.indexOf('export function addProfile('), to = store.indexOf('\n}', from);
    expect({ fn: from >= 0 && to > from }).toEqual({ fn: true });
    // Counting alone gave a new child a slot already holding a sibling's save, and onboarding merged over it.
    // `slotState(id) === 'empty'`, not `!holdsSave(id)`: the free-slot probe must also refuse a slot it can
    // read but cannot parse, not only one it can read cleanly (#384 item 4). `|| tombstoned.includes(id)`
    // widens this on purpose (#431 review, item 4): a slot a delete has tombstoned is free even when a second
    // tab's stale write leaves it looking like 'save'.
    expect(store.slice(from, to)).toMatch(/!idx\.ids\.includes\(id\) && \(slotState\(id\) === 'empty' \|\| tombstoned\.includes\(id\)\)/);
  });

  // Incident 2026-09-06 (#27): the year union `'reception' | 'year1' | 'year2'` was retyped in four files
  // and per-year assets keyed by island index, so a new year (Y3–Y6) meant editing seven places. It now
  // lives once as `YearId` in curriculum/types.ts; every other union must derive from it. This rail counts
  // the literal so a copy re-appearing goes red. (Not a budget — the source of truth stays at exactly one.)
  it('the year union is defined once (YearId), not retyped', () => {
    const union = /'reception'\s*\|\s*'year1'\s*\|\s*'year2'/g;
    const hits = Object.entries(SOURCES).flatMap(([f, s]) => [...code(s).matchAll(union)].map(() => f));
    expect(hits).toEqual(['/src/curriculum/types.ts']);
  });

  // Incident 2026-09-06 (#26): per-mode behaviour was scattered as `o.mode === 'endless' ? … : sprint ? …`
  // ternary chains across session.ts, play.ts, storage.ts and home.ts, so adding a mode meant editing ~12
  // places. Difficulty/speed/points/stars/coins/lives now live in one MODES table (game/modes.ts) that the
  // session reads via `this.spec`. The core-loop file must not compare `o.mode` to a mode literal again.
  // (The UI/storage still carry a few presentation/persistence branches — tracked as the #26 follow-up.)
  it('session behaviour comes from the MODES table, not mode-literal ternaries', () => {
    const session = code(SOURCES['/src/game/session.ts']);
    const modeLiterals = [...session.matchAll(/\bmode\s*[=!]==\s*'(mission|endless|sprint|boss)'/g)].map(m => m[0]);
    expect(modeLiterals).toEqual([]);
    const modes = code(SOURCES['/src/game/modes.ts']);
    for (const m of ['mission', 'endless', 'sprint', 'boss']) expect(modes, `MODES has ${m}`).toContain(`${m}: {`);
  });

  // #26 follow-up: the five island menu buttons were five hardcoded `<button class="btn mode-btn …">` lines,
  // each with its own click handler, so adding a mode button meant editing several places. They now render
  // from one `menu` table in islandScreen (the battle modes take their title from MODES; Sensei-training and
  // Memory-Match are non-Mode flows that share the table). This rail keeps them single-sourced: the button-open
  // markup appears exactly once (the `.map` template). Re-adding a hardcoded button makes it two → red.
  it('island menu buttons render from one table, not hardcoded lines (#26)', () => {
    const home = code(SOURCES['/src/ui/home.ts']);
    const opens = [...home.matchAll(/class="btn mode-btn/g)];
    expect(opens.length).toBe(1);
  });

  // #113 (reviewing #112): tests/unit/avatars.test.ts asserts the roster *data* (name vs. element), but
  // nothing observed the *render* — `${av.element} · ${av.element}` or dropping `· ${av.element}` entirely
  // both left the full suite green. This is the exact line #112 was originally filed about (the topbar card).
  it('the topbar card renders the ninja\'s name next to its element, not the element twice (#112/#113)', () => {
    expect(code(SOURCES['/src/ui/home.ts'])).toContain('${av.name} · ${av.element}');
  });

  // Incident 2026-09-06 (#45): `Topic.mode` ('bubbles'|'tracing') collided with `Session.Mode` (the play
  // mode), and every island menu button carried the class `.storm` — so a screen rule written on a bare
  // modifier like `.memory` could clobber a button (#63). A topic's answer style is now `Topic.input` and the
  // buttons use `.mode-btn`. This rail keeps both from creeping back into the TS sources; the CSS rename and
  // the "mode cards match" layout live in the e2e rail (vitest cannot read CSS text — see the header note).
  it('a topic answers via `input`, and menu buttons use `.mode-btn` not `.storm` (#45)', () => {
    expect(code(SOURCES['/src/curriculum/types.ts'])).toContain("input?: 'bubbles' | 'tracing'");
    const topicMode = Object.entries(SOURCES).flatMap(([f, s]) => [...code(s).matchAll(/\bmode\??:\s*'bubbles'\s*\|\s*'tracing'/g)].map(() => f));
    expect(topicMode).toEqual([]);                                     // no `Topic.mode` field anywhere
    const stormClass = Object.entries(SOURCES).flatMap(([f, s]) => [...code(s).matchAll(/class="[^"]*\bstorm\b/g)].map(() => f));
    expect(stormClass).toEqual([]);                                    // the `.storm` class is gone from markup
    expect(code(SOURCES['/src/ui/home.ts'])).toContain('mode-btn');
  });

  // Incident 2026-09-08 (#129 review): the gate's PREDICATE was tested and its TRIGGERS were not, so a rule
  // that fires on a label shipped with `labeled` missing from the workflow — the label changed nothing, the
  // status stayed green, and an unapproved visual would have merged. A check nobody can reach is not a check.
  it('the review gate wakes on everything its rules depend on', () => {
    const yml = workflow('review-gate.yml');
    expect(yml.length).toBeGreaterThan(500);                            // never assert against an empty read
    // Strip comments before matching: the header explains *why* `labeled` is subscribed, and matching the raw
    // text let the rail read its own prose as the subscription — it passed with the trigger deleted (#129).
    const code = yml.split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
    const on = code.slice(0, code.indexOf('jobs:'));
    // Membership of the parsed list, not a substring of it: `includes('labeled')` is also true of `unlabeled`.
    const types = [...on.matchAll(/types:\s*\[([^\]]*)\]/g)].flatMap(m => m[1].split(',').map(t => t.trim()));
    expect(types.length).toBeGreaterThan(4);
    for (const t of ['opened', 'labeled', 'unlabeled', 'converted_to_draft', 'ready_for_review', 'synchronize'])
      expect({ trigger: t, subscribed: types.includes(t) }).toEqual({ trigger: t, subscribed: true });
    // #131: the six `pull_request` types above all passed with `issue_comment:` deleted from `on:` — nothing
    // checked that the subscription re-stamping a REVIEW:/OWNER: comment onto the status still exists.
    expect({ event: 'issue_comment', subscribed: on.includes('issue_comment') })
      .toEqual({ event: 'issue_comment', subscribed: true });
    // #160 review: the check above only matched the substring `issue_comment`, so a regression that keeps
    // the `issue_comment:` key but narrows its `types:` to something excluding `created` — the one type a
    // fresh REVIEW:/OWNER: comment fires as — left this rail green while #131's exact failure mode came back.
    // Scoped to the `issue_comment:` block itself (not the whole `on`), the same way the `pull_request` types
    // are pinned above, so a narrowed list is caught rather than only a deleted key.
    const issueCommentBlock = on.slice(on.indexOf('issue_comment:'), on.indexOf('concurrency:'));
    const issueCommentTypes = [...issueCommentBlock.matchAll(/types:\s*\[([^\]]*)\]/g)]
      .flatMap(m => m[1].split(',').map(t => t.trim()));
    // #77: `created` alone means editing a marker OUT, or deleting the comment outright, never re-stamps the
    // status — it can outlive the comment it was computed from. `edited`/`deleted` close that.
    for (const t of ['created', 'edited', 'deleted'])
      expect({ event: 'issue_comment', type: t, subscribed: issueCommentTypes.includes(t) })
        .toEqual({ event: 'issue_comment', type: t, subscribed: true });
    const guard = code.slice(code.indexOf('if:'), code.indexOf('runs-on:') + 200);
    for (const marker of ["'REVIEW:'", "'OWNER:'"])                     // both verdicts must wake the job
      expect({ marker, wired: guard.includes(marker) }).toEqual({ marker, wired: true });
    // #77: the checks above alone wake the job when a marker is typed IN by an edit, not when one is edited
    // OUT — the current `comment.body` no longer carries it. `changes.body.from` (the pre-edit body) needs the
    // same checks, gated to `edited` only, or a withdrawn `OWNER: APPROVED` leaves the gate green forever.
    expect({ wired: guard.includes("github.event.action == 'edited'") })
      .toEqual({ wired: true });
    expect({ wired: guard.includes('github.event.changes.body.from') })
      .toEqual({ wired: true });
  });

  // #92: `cancel-in-progress: true` let an ordinary comment's run — one the job `if:` above will skip, since
  // it opens with neither marker — win the single shared concurrency group and cancel a `synchronize` run
  // that was seconds from stamping the freshly pushed head. The cancelling run stamps nothing (it is
  // skipped), so the head was left carrying no `review-gate` status at all — exactly the gap rule 1 of
  // docs/ROUTINE-PROMPT.md warns a reviewer to check for by hand. Queuing instead of cancelling means every
  // triggered run that reaches the job re-reads live PR state before it writes, so a run that cannot stamp
  // (skipped) can no longer destroy one that can.
  it('the review gate queues instead of cancelling, so a skip-filtered run cannot cancel one that stamps (#92)', () => {
    const yml = workflow('review-gate.yml');
    const code = yml.split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
    const concurrency = code.slice(code.indexOf('concurrency:'), code.indexOf('permissions:'));
    expect(concurrency.length).toBeGreaterThan(20);                        // never assert against an empty slice
    expect(concurrency, 'cancel-in-progress must be false, or a skipped run can cancel one that stamps (#92)')
      .toMatch(/cancel-in-progress:\s*false/);
  });

  // Incident 2026-09-06: a review found `Tracer.destroy()` removing only the window listeners, so every
  // question stacked another pair on the shared canvas (#39). Anything that adds a listener must remove it.
  it('every addEventListener in src/game has a matching removeEventListener', () => {
    for (const [f, s] of inDir('/src/game/').map(([f, s]) => [f, code(s)] as const)) {
      const added = new Set([...s.matchAll(/(\w+)\.addEventListener\('([\w-]+)'/g)].map(m => `${m[1]}.${m[2]}`));
      const removed = new Set([...s.matchAll(/(\w+)\.removeEventListener\('([\w-]+)'/g)].map(m => `${m[1]}.${m[2]}`));
      expect({ file: f, leaked: [...added].filter(a => !removed.has(a)) }).toEqual({ file: f, leaked: [] });
    }
  });

  // #39, second half: the rail above (destroy() unbinds the canvas listeners) only helps if the old Tracer is
  // actually disposed. A new Tracer is built per question, so `play.ts` must dispose the previous one first —
  // otherwise ~30 handler pairs stack on the shared #trace canvas over a tracing mission, the very leak #39
  // named. This keeps the single construction site behind a disposal of the old tracer, and the screen
  // teardown disposing it too. Moving `tracer?.destroy()` after `new Tracer(` (or dropping it) turns it red.
  it('play.ts disposes the previous Tracer before building a new one (#39)', () => {
    const play = code(SOURCES['/src/ui/play.ts']);
    const ctors = [...play.matchAll(/new Tracer\(/g)];
    expect(ctors.length).toBe(1);                                       // one construction site to reason about
    const start = play.indexOf('function startTrace');
    const before = play.slice(start, ctors[0].index);
    expect({ inStartTrace: start >= 0 && start < ctors[0].index, disposesFirst: /tracer\??\.destroy\(\)/.test(before) })
      .toEqual({ inStartTrace: true, disposesFirst: true });
    const cleanup = play.slice(play.indexOf('function cleanup'));
    expect(/tracer\??\.destroy\(\)/.test(cleanup), 'cleanup must dispose the Tracer on screen teardown').toBe(true);
  });

  // #38: the save had a version field (`v`) and a versioned key (`sna:v1`) but neither drove anything — load()
  // shallow-merged DEFAULT with the stored blob, so a shape change (a new bests record, Y3+ keys) would silently
  // keep stale keys with no place to transform them. The fix routes load() through migrate(), which switches on
  // `raw.v` and is the seam future shape changes slot into. This rail keeps load() from reverting to a raw merge.
  it('storage.load() routes stored data through migrate() (#38)', () => {
    const storage = code(SOURCES['/src/storage.ts']);
    const load = storage.slice(storage.indexOf('function load'), storage.indexOf('function save'));
    expect(/migrate\(/.test(load), 'load() must migrate the stored blob, not shallow-merge it').toBe(true);
    expect(/\{\s*\.\.\.DEFAULT\s*,\s*\.\.\.JSON\.parse/.test(load)).toBe(false);   // the old shallow-merge is gone
    expect(/switch\s*\(|MIGRATIONS\[/.test(code(SOURCES['/src/storage.ts']))).toBe(true);   // migrate keys off the version
  });

  // The other half of #38, found while writing the first real step (#205, v1 → v2): migrate()'s ladder is
  // `while (v < SAVE_VERSION && MIGRATIONS[v])`, so a version bumped without a step does not fail, it walks
  // straight past the loop and lands back on `{ ...DEFAULT, ...s }` — exactly the shallow merge the rail above
  // forbids, reached by the one route it cannot see. A reshaping bump done that way would keep the old keys
  // and look fine in every test that only reads the new ones.
  it('every version below SAVE_VERSION has a migration step (#205)', () => {
    for (let v = 1; v < SAVE_VERSION; v++)
      expect(MIGRATIONS[v], `SAVE_VERSION is ${SAVE_VERSION} but no MIGRATIONS[${v}] step: migrate() would skip v${v} saves`).toBeTypeOf('function');
    expect(Object.keys(MIGRATIONS).length, 'a step above SAVE_VERSION never runs').toBe(SAVE_VERSION - 1);
  });

  // The third face of the same seam (#232): the ladder only runs forwards, so a blob from a *newer* build fails
  // `v < SAVE_VERSION` immediately and fell through to `{ ...DEFAULT, ...s, v: SAVE_VERSION }` — which relabels
  // v(n+1) data as ours. load() cached it and the next save() wrote it back, making the loss permanent, with
  // whatever the newer version renamed read under its old name. importSave() had refused a newer code from the
  // start for exactly this reason; load() did not. The sequence is ordinary: the APK and the web build do not
  // update together (#64), so one device is routinely a version ahead of the other.
  //
  // This rail is **behavioural on purpose.** A text rail here could check that `isMigratable` is still called
  // and would stay green through any change that kept the identifier and broke the comparison — #205's lesson.
  // The full behaviour (the untouched blob, the read-only latch, the cleared latch) is held in storage.test.ts;
  // this is the one-line invariant that must never come back, sitting in the incident log with the other two.
  // Found reviewing the first cut of the rail below, and the sharper half of the same incident (#232):
  // refusing to *write* is only half the protection, because `exportSave()` is a second route to the stored
  // blob. Under the latch `load()` is a fresh default, so the export box in the grown-ups screen offered a
  // **valid** code carrying no progress — and `parents.ts` tells the grown-up to paste it into Restore on
  // the other device, which is the device holding the real save. The mechanism added to stop a save being
  // destroyed became a better way to destroy it. Behavioural, for the same reason as the rail below: a text
  // rail could see that `exportSave` mentions the latch and not that the code it hands out is the right one.
  it('exportSave() never offers a blank default as the child’s save (#232)', () => {
    const KEY = 'sna:v1';
    // This file has no jsdom environment, so the one rail here that exercises storage brings its own slot.
    const mem: Record<string, string> = {};
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => { mem[k] = v; },
      removeItem: (k: string) => { delete mem[k]; },
      clear: () => { for (const k in mem) delete mem[k]; },
      key: () => null, length: 0,
    } as Storage;
    const newer = JSON.stringify({ v: SAVE_VERSION + 1, name: 'Ada', coins: 500 });
    reset();
    localStorage.setItem(KEY, newer);
    expect(load().coins, 'the session runs on defaults, which is correct').toBe(0);
    const code = exportSave();
    expect(JSON.parse(code).coins, 'but the exported code must carry the progress that exists, not the default').toBe(500);
    expect(code, 'the honest thing to move is the stored blob itself').toBe(newer);
    reset();
  });

  it('a save from a newer build is never relabelled as this version (#232)', () => {
    const future = { v: SAVE_VERSION + 1, name: 'Tablet', coins: 500 };
    const out = migrate(future);
    expect(out.coins, 'a newer blob must not come through carrying its data under our version stamp').toBe(0);
    expect(out.name, 'refused, so the session runs on a fresh default').toBe('');
    // …and the same for a `v` we cannot read at all, which used to re-run the whole ladder over migrated data.
    for (const bad of [{ v: 'two' }, { v: null }, { v: 1.5 }, { v: 0 }, { v: -1 }])
      expect(isMigratable(bad as Record<string, unknown>), `${JSON.stringify(bad)} must not be treated as migratable`).toBe(false);
    // The guard must not overreach: everything we can read still migrates.
    for (let v = 1; v <= SAVE_VERSION; v++) expect(isMigratable({ v }), `v${v} is readable`).toBe(true);
    expect(isMigratable({}), 'a pre-versioning blob is readable as v1').toBe(true);
  });

  // Incident 2026-09-06 (#37): dead code lingered after the outcome-beat refactor — `Bubble.scale` was
  // always 1, `SaveData.totalSlices` was written but never read, and `dom.wait` / `yearById` were exported
  // but imported nowhere. tsc's noUnusedLocals catches neither an unused *export* nor an always-constant
  // field, so this rail keeps the four removed. (`Arena.time` was named in #37 too but is live — two e2e
  // rails read it — and `Arena.flash` was already gone; neither is checked here.)
  it('dead symbols removed in #37 stay gone', () => {
    expect(SOURCES['/src/curriculum/index.ts'], 'yearById was unused').not.toContain('yearById');
    expect(code(SOURCES['/src/ui/dom.ts']), 'dom.wait was unused').not.toMatch(/export\s+(?:const|function)\s+wait\b/);
    expect(code(SOURCES['/src/storage.ts']), 'SaveData.totalSlices was never read').not.toContain('totalSlices');
    const arena = code(SOURCES['/src/game/arena.ts']);
    const from = arena.indexOf('interface Bubble');
    const iface = arena.slice(from, arena.indexOf('}', from));
    expect(iface, 'Bubble.scale was always 1').not.toContain('scale');
  });

  // #35: `esc` was defined twice — the shared export in dom.ts and a private copy in visuals.ts, exactly the
  // copy-paste this issue set out to remove. This rail keeps HTML-escaping single-sourced in dom.ts.
  it('esc (HTML escaping) is defined once, in dom.ts (#35)', () => {
    const defs = Object.entries(SOURCES).filter(([, s]) => /(?:export\s+)?const\s+esc\s*=|function\s+esc\b/.test(code(s))).map(([f]) => f);
    expect(defs).toEqual(['/src/ui/dom.ts']);
  });

  // #35: `later`, `toast` and the alive/timers teardown were copy-pasted between play.ts and memory.ts; they now
  // come from screenScope() in screen.ts. This rail keeps both screens on the shared helper rather than re-rolling
  // their own alive-guarded timer loop.
  it('play + memory build on screenScope() rather than re-declaring the scaffolding (#35)', () => {
    for (const f of ['/src/ui/play.ts', '/src/ui/memory.ts']) {
      const s = code(SOURCES[f]);
      expect(s, `${f} must use screenScope()`).toContain('screenScope(');
      expect(/const\s+later\s*=\s*\(/.test(s), `${f} must not re-declare later`).toBe(false);
    }
  });

  // #35: the end-of-run results-modal shell (hero/medal/heading/star row/stat grid/coin row/Play-again buttons)
  // was copy-pasted between the play overlays and memory.ts, differing only in slots. It is now one
  // resultsModal() in screen.ts that both screens fill. This rail keeps the shell single-sourced: the
  // `<div class="modal results">` markup appears exactly once. Re-inlining a second results modal makes it two → red.
  it('the results modal shell is built once, in screen.ts (#35)', () => {
    const shells = Object.entries(SOURCES).flatMap(([f, s]) => [...code(s).matchAll(/<div class="modal results">/g)].map(() => f));
    expect(shells).toEqual(['/src/ui/screen.ts']);
  });

  // #36: play.ts was one long closure with ~30 lines over 180 chars; every Edit had to reproduce those
  // lines verbatim (token cost). The three overlay templates moved to overlays.ts (byte-identical HTML),
  // then the HUD writers (drawLives/Timer/Hp, showOutcome) to hud.ts, then the remaining multi-statement,
  // object-literal and nested-ternary one-liners were wrapped (24→5), and then the stage pill's 393-char
  // innerHTML — the longest line in the file, and the only one of those 5 outside a render() template —
  // moved to hud.ts as the pure `stageHTML` builder (5→4), and finally the Session callbacks moved to
  // play-session.ts (375→269 lines, and the budget stays at 4 — none of the four was theirs). The 4 that
  // remain are the arena/HUD markup template literals inside render(), where a newline would change the
  // emitted HTML — the irreducible floor here. This *budget* records what is left and only ever ratchets
  // DOWN. Never raise it to go green.
  it('play.ts long lines keep shrinking (#36 budget)', () => {
    const over = SOURCES['/src/ui/play.ts'].split('\n').filter(l => l.length > 180).length;
    expect(over, 'wrap a long line or move it out — never raise this budget').toBeLessThanOrEqual(4);
  });

  // #36: play-session.ts was carved out of the play.ts closure, so it starts at the floor the budget above
  // spent four PRs reaching — no line over 180 chars, because it holds no `render()` template. Its budget is
  // therefore 0 from the first day: a long callback line here is new debt, not inherited debt.
  it('play-session.ts long lines keep shrinking (#36 budget)', () => {
    const src = SOURCES['/src/ui/play-session.ts'] ?? '';
    expect(src.length, 'play-session.ts must be read, not a blank import').toBeGreaterThan(1000);
    expect(src.split('\n').filter(l => l.length > 180).length, 'wrap a long line — never raise this budget').toBeLessThanOrEqual(0);
  });

  // #36: the Session callback object was the last tenant of the 200-line playScreen() closure — the question
  // beat, the outcome beat, the sprint clock and the boss reactions, wired in among the screen's markup,
  // overlays and test hooks. It now lives in play-session.ts with the state only it touches, and the screen
  // passes what the callbacks need. Nothing else would go red if a callback were moved back inline "just for
  // this one fix": the game would still play, and the closure would start growing again exactly as it did the
  // first time. The session is built where its callbacks are, so `new Session(` has one site in src/.
  it('the Session callbacks live in play-session.ts, not back inside playScreen() (#36)', () => {
    const beat = code(SOURCES['/src/ui/play-session.ts'] ?? '');
    const play = code(SOURCES['/src/ui/play.ts'] ?? '');
    expect(beat.length, 'play-session.ts must be read, not a blank import').toBeGreaterThan(1000);
    const built = Object.entries(SOURCES).filter(([, src]) => /new Session\(/.test(code(src))).map(([f]) => f);
    expect(built, 'the session is constructed where its callbacks are').toEqual(['/src/ui/play-session.ts']);
    const callbacks = ['onQuestion', 'onCorrect', 'onWrong', 'onMiss', 'onProgress', 'onLives', 'onStageClear', 'onTime', 'onBoss', 'onEnd'];
    for (const cb of callbacks) {
      expect(beat, `${cb} belongs in play-session.ts`).toContain(`${cb}(`);
      expect(play, `${cb} must not move back into play.ts`).not.toContain(`${cb}(`);
    }
  });

  // #36: the session's three outcome callbacks (onCorrect/onWrong/onMiss) each carried their own copy of the
  // same closing beat — mark the mission segment, spotlight the answer under the card, freeze the wave for
  // the hold — differing only in a sound, a toast and a hold. They now share one `settle()` driven by the
  // OUTCOME table, the same shape as the MODES rail above. A fourth outcome, or a "just this once" copy of
  // the beat back into a callback, is exactly how the triplication grew the first time and nothing else
  // would fail: the game would still play, three near-identical bodies would drift apart quietly. Each of
  // these calls therefore has exactly ONE site in play.ts, inside settle().
  it('the outcome beat is one settle() path, not a copy per callback (#36)', () => {
    // The callbacks moved to play-session.ts; both files are counted, so a copy of the beat left behind in
    // play.ts — or a second one added beside settle() — is caught wherever it is written.
    const files = ['/src/ui/play-session.ts', '/src/ui/play.ts'];
    for (const f of files) expect((SOURCES[f] ?? '').length, `${f} must be read, not a blank import`).toBeGreaterThan(1000);
    const beat = files.map(f => code(SOURCES[f] ?? '')).join('\n');
    for (const call of ['showOutcome(', 'endWave(scaled(', 'arena.reveal(', 'markSeg(']) {
      const n = beat.split(call).length - 1;
      expect(n, `${call} belongs to settle() alone — put a new outcome in the OUTCOME table`).toBe(1);
    }
    for (const kind of ['correct', 'wrong', 'miss']) expect(beat).toContain(`${kind}: { seg:`);
  });

  // #36, the same shape as the YearId rail above: `'correct' | 'wrong' | 'miss'` was written out in three
  // places (play.ts's lastOutcome, hud.ts's outcomeHintHTML and showOutcome), so a fourth outcome meant
  // finding all of them. It is `Outcome` in hud.ts now, and every other spelling derives from it.
  it('the outcome union is defined once (Outcome), not retyped (#36)', () => {
    const union = /'correct'\s*\|\s*'wrong'\s*\|\s*'miss'/g;
    const hits = Object.entries(SOURCES).flatMap(([f, s]) => [...code(s).matchAll(union)].map(() => f));
    expect(hits).toEqual(['/src/ui/hud.ts']);
  });

  // #36: home.ts (topbar/dojoCard/mapScreen/islandScreen/rewardsScreen) carried the same long-line token
  // cost as play.ts — every Edit had to reproduce those lines verbatim. The non-HTML lines (the `Nav` type,
  // the island and tab click handlers, and the menu.map interpolation) were wrapped (12→8). The 8 that
  // remain are HTML template literals inside render(), where a newline would change the emitted markup —
  // the irreducible floor here. Like the play.ts budget above, this only ratchets DOWN (e.g. if the
  // style.css long lines or the session-callback object land next). Never raise it to go green.
  it('home.ts long lines keep shrinking (#36 budget)', () => {
    const over = SOURCES['/src/ui/home.ts'].split('\n').filter(l => l.length > 180).length;
    expect(over, 'wrap a long line or move it out — never raise this budget').toBeLessThanOrEqual(8);
  });

  // #36: src/style.css carried the same long-line token cost — 65 rules packed declarations (and often
  // several rule blocks, or a whole single-line @media) onto one line, so every Edit had to reproduce them
  // verbatim. They were split so each declaration and each rule sits on its own line — a pure whitespace
  // change, the minified build is byte-identical to main. Unlike the .ts budgets above this cannot be read
  // through Vite's `?raw` (the css plugin blanks it — see the file header), so it reads the source from disk
  // with fs; the length guard makes that a real check, not a vacuous empty read. CSS has no HTML-template
  // floor, so the floor is 0. Ratchets DOWN only — never raise it to go green.
  it('style.css long lines keep shrinking (#36 budget)', () => {
    const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');
    expect(css.length, 'style.css must be read from disk, not a blank ?raw import').toBeGreaterThan(1000);
    const over = css.split('\n').filter(l => l.length > 180).length;
    expect(over, 'wrap a long line or move it out — never raise this budget').toBeLessThanOrEqual(0);
  });

  // #35: the 2-D and 3-D shape tables were copy-pasted in curriculum/maths.ts and game/memory.ts at
  // different arities. They are now one source, curriculum/util.ts (SHAPES_2D/SHAPES_3D), which both import.
  // This rail fails if a table-only glyph reappears in another source file — the marker of the shape table
  // being re-duplicated. (⬟ pentagon and ⬢ hexagon are 2-D-table-only; 🥫 cylinder is 3-D-table-only.)
  it('shape tables are defined once in util.ts (#35)', () => {
    for (const glyph of ['⬟', '⬢', '🥫']) {
      const files = Object.entries(SOURCES).filter(([, s]) => code(s).includes(glyph)).map(([f]) => f);
      expect(files, `${glyph} should live only in curriculum/util.ts`).toEqual(['/src/curriculum/util.ts']);
    }
  });

  // #453 item 2: `repeatKey` (`src/game/session.ts`) keys a `' · '`-separated `hint`/`listen` as a **set**,
  // sorted rather than left in draw order, on the premise that the three generators building an *unordered*
  // list (`y1-soundhunt`'s `listen`, `y1-mass`'s and `y2-temp`'s `hint`) are the only places the separator
  // reaches a `Question`'s content fields. Nothing pinned that premise: the first generator writing an
  // *ordered* `' · '` list — steps, a timetable, a sequence read aloud — would collapse two different
  // questions onto one key in silence, since sorting an ordered list the same way an unordered one is sorted
  // is exactly what makes them equal. This rail is the inventory: a fourth `hint`/`listen` line carrying the
  // separator fails it, which is the point at which someone decides whether the list it carries is genuinely
  // order-free before letting it stand.
  it("' · ' reaches a hint/listen field only from the three generators contentList's premise names (#453 item 2)", () => {
    // The exact three lines, not a count (PR #692 review round 1): a count plus "each file represented" lets a
    // swap through — drop one of maths.ts's two known lines while adding an unrelated new one to the same
    // file, and both the total and the per-file presence check stay exactly as they were. Pinning the lines
    // themselves is what a swap cannot pass through unnoticed.
    const hits = inDir('/src/curriculum/').flatMap(([file, src]) =>
      code(src).split('\n')
        .filter(line => /\b(?:hint|listen):/.test(line) && line.includes(' · '))
        .map(line => `${file}: ${line.trim()}`));
    expect(hits, "a new or changed ' · ' hint/listen line — check it is genuinely unordered before updating this list").toEqual([
      "/src/curriculum/maths.ts: hint: cols.map((c, i) => `${c} ${noun}: ${vals[i]} ${unit}`).join(' · '), hintIsData: true,",
      "/src/curriculum/maths.ts: return wordQ(rng, `Which was ${warmer ? 'warmer' : 'colder'}?`, first ? ca : cb, [first ? cb : ca], { hint: `${ca}: ${a}°C · ${cb}: ${b}°C`, hintIsData: true, say: `${ca} was ${a} degrees. ${cb} was ${b} degrees. Which was ${warmer ? 'warmer' : 'colder'}?` });",
      "/src/curriculum/writing.ts: return wordQ(rng, '🔊 Listen!', g, ds, { say: `Listen: ${ws.join(', ')}. Which sound do they ${where}?`, listen: ws.join(' · '), hint: `Slice the sound at the ${pos}` });",
    ]);
  });

  // #44: the FIRST wave must spawn behind the font gate. Canvas text bakes in whichever face is loaded when
  // fillText runs, and a bubble's label size is fitted once at spawn (#28) — so a wave launched before Fredoka
  // lands is measured against the fallback face and then changes shape in mid-air while a child reads it.
  // The gate is one line, sitting in the middle of the onQuestion closure, and trivially lost to a refactor.
  // The second assertion is the exact line this replaced: `if (demo) later(spawn, demo); else spawn();`.
  it('the first wave spawns behind the font gate (#44)', () => {
    const play = SOURCES['/src/ui/play-session.ts'];   // #36: onQuestion moved here with the rest of the callbacks
    expect(play, 'play-session.ts must be readable').toBeTruthy();
    expect(code(play)).toMatch(/fontReady\(\)\.then\([\s\S]{0,120}?spawn\(\)/);
    expect(code(play), 'the ungated `else spawn()` is the bug this rail exists for').not.toMatch(/else\s+spawn\(\)\s*;/);
    // ...and the tutorial branch goes through the gate too. `demo` is the child's first ever play — the one
    // launch certain to have a cold font cache — and it was waved through on nothing but showTutorial()'s
    // 1800 ms happening to exceed the 1200 ms cap, an accident of two unrelated constants (review of #139).
    expect(code(play), 'the first-ever play must not skip the gate').not.toMatch(/later\(\s*spawn\s*,/);
  });

  // #44 again, the other half: the gate probes one concrete face, and it is only meaningful if the face is
  // one the app actually serves. Narrow what is served and the gate waits for a face that never arrives —
  // every first wave then pays the full timeout AND still draws in the fallback.
  //
  // #479 moved where "served" is written down. It was index.html's `wght@` list; it is now the `font-weight`
  // range on the @font-face rules in src/style.css, because the font is ours. Both files are read from disk
  // (Vite's glob reaches neither) with their length asserted, so an empty read cannot pass vacuously.
  it('the font gate probes a weight the app actually serves (#44, #479)', () => {
    const [lo, hi] = servedWeightRange();
    const probe = Number(/^(\d+)\s/.exec(FONT_PROBE)?.[1]);
    expect(probe, 'FONT_PROBE must start with a numeric weight').toBeGreaterThan(0);
    expect(probe, `the gate probes weight ${probe}, outside the served axis ${lo}-${hi}`).toBeGreaterThanOrEqual(lo);
    expect(probe, `the gate probes weight ${probe}, outside the served axis ${lo}-${hi}`).toBeLessThanOrEqual(hi);
  });

  // #479: the whole point of self-hosting is that no face is fetched from a third party, so nothing in the
  // shipped page may name one. A `<link>` is how it was written before; a `@import` in the stylesheet and a
  // `src: url(https://…)` inside an @font-face are the two ways it comes back without a `<link>`, and both
  // would fail exactly the same way — silently, in a cloud session, measuring the fallback face while every
  // test reads green. The fallback STACK in `--font` is untouched by this: those are names, not fetches.
  it('no face is fetched from a third party (#479)', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');
    expect(html.length, 'index.html must be read from disk').toBeGreaterThan(500);
    expect(css.length, 'style.css must be read from disk').toBeGreaterThan(5000);
    // NOT `code()`. That helper strips `//` to end of line as a JS line comment, and every URL this rail
    // exists to catch contains `//` — `href="https://fonts.googleapis.com/…"` becomes `href="https:` and the
    // host vanishes, so a rail built on `code()` would pass on the very file it was written against. (Found
    // by running this rail against the pre-#479 index.html, which is the first mutation in the PR's table.)
    // What IS stripped is the comment syntax each language really has: a host named in a comment fetches
    // nothing, and both files carry a note about the host they stopped using. Lengths were asserted on the
    // raw text above, so stripping cannot make an empty read pass.
    const markup = (s: string) => s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
    for (const host of ['fonts.googleapis.com', 'fonts.gstatic.com']) {
      expect(markup(html).includes(host), `index.html must not reach ${host} — a routine session cannot (#479)`).toBe(false);
      expect(markup(css).includes(host), `style.css must not reach ${host} — a routine session cannot (#479)`).toBe(false);
    }
    expect(markup(css), 'no @import may pull a stylesheet from anywhere but this repo (#479)').not.toMatch(/@import\s+(?:url\()?["']?https?:/i);
    // ...and every @font-face src is a path into public/, not an absolute URL by another spelling.
    const srcs = [...markup(css).matchAll(/src:\s*url\(\s*["']?([^"')]+)/g)].map(m => m[1]);
    expect(srcs.length, 'the rail found no @font-face src at all — it would pass vacuously').toBeGreaterThanOrEqual(2);
    expect(srcs.filter(u => !u.startsWith('/fonts/')), 'every font src must be a local /fonts/ path (#479)').toEqual([]);
    // ...and the files those paths name are really in the tree, at a size only a real font reaches. A src
    // pointing at nothing is the same defect as a src pointing at Google: the fallback face, silently.
    // `statSync` throws ENOENT on a missing file, which aborts the test with a stack trace instead of the
    // sentence explaining what went wrong — so existence is asserted first, and only then the size. A src
    // naming a file that is not in the tree is the same defect as a src naming Google: the fallback face,
    // silently, with the stylesheet reading as correct.
    const bytes = (p: string, why: string) => {
      const f = new URL(`../../${p}`, import.meta.url);
      expect(existsSync(f), `${p} is not in the tree — ${why} (#479)`).toBe(true);
      return statSync(f).size;
    };
    for (const u of srcs) expect(bytes(`public${u}`, 'the stylesheet names it but nothing ships it'),
      `${u} must be a real font file, not a placeholder (#479)`).toBeGreaterThan(2000);
    expect(bytes('public/fonts/OFL.txt', 'Fredoka is SIL OFL 1.1 and the licence ships beside the files it covers'),
      'the licence must be the real text, not an empty file').toBeGreaterThan(1000);
  });
  // #31: `update()` runs up to six times per frame (the substep loop clamps each step to 1/60 s), and it used
  // to rebuild `shots`, `particles` and `trail` with `.filter()` on every one of them — up to 18 throwaway
  // arrays a frame, on the one path that must never stutter. The compaction now happens once, in `cull()`,
  // which rewrites in place. This rail reads the substep body only: an allocation anywhere else in the file
  // is fine, one in here is the bug coming back. It is a text check — it catches `.filter(`, `.map(`,
  // `.slice(` and an array literal, which is how every version of this mistake has been written so far.
  it('the physics substep allocates no arrays (#31)', () => {
    const src = code(SOURCES['/src/game/arena.ts']);
    const from = src.indexOf('private update(dt'), to = src.indexOf('private cull(');
    expect(from, 'update() must exist and come before cull()').toBeGreaterThan(0);
    expect(to, 'cull() must exist — it is where the compaction moved to').toBeGreaterThan(from);
    const body = src.slice(from, to);
    expect(body.length, 'the slice must actually hold the substep body').toBeGreaterThan(400);
    expect(body).toContain('this.particles');                            // reading the right method
    expect(body, 'update() must not rebuild an array with filter()').not.toContain('.filter(');
    expect(body, 'update() must not allocate with map()').not.toContain('.map(');
    expect(body, 'update() must not allocate with slice()').not.toContain('.slice(');
    expect(body, 'update() must not build an array literal').not.toMatch(/=\s*\[/);
  });

  // #31 again, the half a reader gets wrong first: `cull()` must run every frame, NOT inside the
  // `if (!this.paused)` branch that guards the substeps. The trail is culled against `now - 280`, so a paused
  // arena that never culls keeps a stale trail and paints it the instant it resumes.
  it('the per-frame cull runs even while the arena is paused (#31)', () => {
    const loop = code(SOURCES['/src/game/arena.ts']).match(/private loop = \(now: number\) => \{[\s\S]*?\n  \};/)?.[0] ?? '';
    expect(loop, 'the rAF loop must be readable for this rail to mean anything').toContain('requestAnimationFrame');
    const paused = loop.indexOf('if (!this.paused)'), cull = loop.indexOf('this.cull(');
    expect(paused, 'the substep loop is still guarded by !paused').toBeGreaterThan(-1);
    expect(cull, 'cull() is called from the frame loop').toBeGreaterThan(-1);
    expect(loop.slice(paused, cull), 'cull() must sit after that branch closes, not inside it').toContain('}');
    expect(cull).toBeGreaterThan(paused);
  });

  // #31, the trap in skipping the draw: `resize()` assigns `canvas.width`, which wipes the bitmap. A resize
  // can arrive while the arena is paused (rotate the phone on the pause overlay), and a paused render that
  // skipped would leave the arena blank until the child resumed. `dirty` forces the one repaint that fixes it,
  // so a `render` that skips must consult it and a `resize` that wipes must set it.
  it('a resize repaints even while paused (#31)', () => {
    const src = code(SOURCES['/src/game/arena.ts']);
    const resize = src.slice(src.indexOf('resize = ()'), src.indexOf('radius(wide'));
    expect(resize, 'the slice must hold resize()').toContain('canvas.width');
    expect(resize, 'resize() wipes the bitmap, so it must mark it dirty').toContain('this.dirty = true');
    const render = src.slice(src.indexOf('private render(now'), src.indexOf('private drawShot'));
    expect(render, 'the slice must hold render()').toContain('clearRect');
    expect(render, 'render() must not skip a frame the resize asked for').toContain('this.dirty');
  });

  // Incident 2026-09-09 (#147): `npx playwright install --with-deps chromium` runs `apt-get update` first,
  // the ubuntu-latest image ships Google's chrome-stable apt source, and that repository served a Release
  // file and a package index whose SHA256s disagreed. apt exited 100, the install step died, and EVERY job
  // on this repo failed at that line for hours — pull requests and the nightly on main alike — each still
  // paying for checkout, npm ci, unit tests and the build first, on a repo already over its Actions quota
  // (#119). We install Chromium through Playwright and never install Google Chrome, so a third party we do
  // not use was a hard prerequisite for all of our CI. The workflow now deletes that source first.
  //
  // Comments are stripped before matching, because ci.yml's own comment names the file it deletes — the
  // #129 failure exactly: a rail that reads its own prose passes with the line it guards deleted.
  it('CI drops the Google Chrome apt source before installing browsers (#147)', () => {
    const yml = workflow('ci.yml');
    expect(yml.length, 'ci.yml must be read from disk, not a blank import').toBeGreaterThan(500);
    const steps = yml.split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
    const install = steps.indexOf('playwright install --with-deps');
    const drop = steps.indexOf('sources.list.d/google-chrome');
    expect(install, 'ci.yml must still install the browsers').toBeGreaterThan(-1);
    expect(drop, 'ci.yml must delete the google-chrome apt source (#147)').toBeGreaterThan(-1);
    expect(drop < install, 'the deletion must run BEFORE the install, or apt-get update still reads it')
      .toBe(true);
    // `apt-get update || true` would end this outage by making every apt failure invisible, a real one
    // included — the silent-degradation the rails exist to prevent. Remove the source, do not deafen apt.
    expect(steps, 'do not swallow apt failures; drop the unused source instead (#147)')
      .not.toMatch(/apt-get\s+update[^\n]*\|\|\s*true/);
  });

  // #40: say() interrupts by default, which is right for a new question and wrong for the letters of one
  // word — sliced letters arrive faster than they can be spoken, so each say() cut the last one off and the
  // child heard fragments. The queued form is easy to lose in a later edit of that callback (it looks like a
  // stray option), and nothing else would fail if it were: the game would just quietly stop reading letters
  // out. Behaviour is covered by audio.test.ts; this pins the one call site that must not interrupt.
  // #41: every swish, slice and elemental hit used to allocate its own AudioBuffer and fill it with
  // Math.random() mid-frame. One shared 0.5 s buffer replaced them, played as sub-ranges — which only works
  // while no sound is longer than the buffer: a longer one runs off the end and goes silent early while its
  // gain ramp carries on, and nothing would fail. `audio.test.ts` drives the real tables through a stand-in
  // context and checks the bounds that way; this rail is the cheap text half, so a new sound that is too long
  // is caught at the line that declares it rather than only when someone happens to listen.
  it('no SFX asks for more noise than the one shared buffer holds (#41)', () => {
    const audio = code(SOURCES['/src/audio.ts'] ?? '');
    expect(audio.length, 'audio.ts must be read, not a blank import').toBeGreaterThan(1000);
    const durations = [...audio.matchAll(/\bnoise\(\s*([\d.]+)/g)].map(m => Number(m[1]));
    expect(durations.length, 'the rail found no noise() calls — it would pass vacuously').toBeGreaterThan(5);
    for (const d of durations) expect(d, `noise(${d}) is longer than the shared buffer`).toBeLessThanOrEqual(NOISE_SECONDS);
    // …and the buffer itself is built once, in one place. A second createBuffer is the old defect returning.
    const allocs = Object.values(SOURCES).map(code).join('\n').match(/createBuffer\(/g) ?? [];
    expect(allocs.length, 'AudioBuffers are allocated in exactly one place, noiseBuffer()').toBe(1);
  });

  it('per-letter progress speech is queued, never interrupting (#40)', () => {
    const play = code(SOURCES['/src/ui/play-session.ts'] ?? '');   // #36: onProgress moved here with the callbacks
    expect(play.length, 'play-session.ts must be read, not a blank import').toBeGreaterThan(1000);
    const progress = play.slice(play.indexOf('onProgress('), play.indexOf('onLives('));
    expect(progress.length, 'onProgress must still precede onLives in the session callbacks').toBeGreaterThan(50);
    const says = [...progress.matchAll(/say\(([^\n]*?)\)[;,]/g)].map(m => m[1]);
    expect(says.length, 'the rail found no say() in onProgress — it would pass vacuously').toBe(1);
    expect(says[0], 'a per-letter say() must pass { queue: true } or it cancels the letter before it (#40)')
      .toContain('queue: true');
  });

  // Fredoka stops at 700: Google Fonts answers a request for `Fredoka:wght@800` with HTTP 400. So every
  // 800/900 the app asked for named a face that does not exist. Measured, that changed nothing — Chromium
  // picks the nearest declared face, and 700/800/900 come out with the same advance width and zero differing
  // pixels (500 differs plainly, so the axis is live). Nothing was smeared; fitLabel measured what it drew.
  //
  // The rail is not about today's pixels, then. It is that the identical render is luck of this engine: the
  // spec permits synthesising a heavier face and WebKit and older Android WebView do, so the same code can
  // look different elsewhere. And "make it bolder" is the obvious move for anyone who thinks a label reads
  // thin — the browser will silently oblige with a weight Google never served.
  //
  // Limits, stated plainly, because this reads text rather than proving anything:
  //  - it catches a literal weight beside a size in a font string that also names Fredoka, and a literal
  //    `font-weight="…"` attribute in inline SVG/HTML built in `src/**/*.ts` (that second form is how
  //    visuals.ts's coin label escaped the first version of this rail — the review of #143 found it);
  //  - `certificate.ts` passes its weight as an argument (`font(px, w = 700)`), so its call sites are
  //    outside both forms. They are 500/600/700 today.
  const FREDOKA_MAX = 700;
  it('nothing in src/ asks Fredoka for a weight it does not have (#44, #479)', () => {
    // #479: "served" moved from index.html's discrete `wght@` list to the @font-face axis in style.css, so
    // the test moved with it — from membership of a list to containment in a range. That is a real widening
    // (600 was never in the old list's gaps, but 450 now passes where it would once have failed) and it is
    // the truth: the served file is variable, so 450 really is a face the browser can produce. What the rail
    // still holds is the thing that was ever wrong — a weight OUTSIDE the axis, which the engine synthesises
    // or rounds silently, differently on WebKit and older Android WebView than on Chromium.
    const [lo, hi] = servedWeightRange();
    expect(hi, 'Fredoka has no weight above 700').toBeLessThanOrEqual(FREDOKA_MAX);

    const asked = Object.entries(SOURCES).flatMap(([f, s]) => [
      // a canvas font string: `700 24px "Fredoka", …`
      ...[...code(s).matchAll(/(\d{3})\s+[^\n;]{0,40}px[^\n;]{0,80}Fredoka/g)].map(m => `${f}: ${m[1]}`),
      // an inline SVG/HTML attribute: `font-weight="700"`. These inherit --font (== the Fredoka stack) from
      // `html, body` in style.css, so they are the same ask by another spelling, and the canvas pattern above
      // cannot see them — there is no `px` size and no family named on the line.
      ...[...code(s).matchAll(/font-weight="(\d{3})"/g)].map(m => `${f}: ${m[1]}`),
    ]);
    expect(asked.length, 'the rail found no font weights at all — it would pass vacuously').toBeGreaterThan(4);
    expect(asked.filter(a => { const w = Number(a.split(': ')[1]); return w < lo || w > hi; }),
      `every Fredoka weight in src/ must sit on the served axis (${lo}-${hi}, src/style.css @font-face)`).toEqual([]);
  });

  // The same mistake in CSS. Read from disk: Vite's `?raw` returns an empty string for stylesheets outside
  // the browser (see the note at the top of this file), so a glob-based CSS rail would pass vacuously.
  // 800 is the value that is always wrong — 700 exists, and the one 900 left is on a ✕ that Fredoka has no
  // glyph for, so it falls through to the system stack where 900 is a real designed weight.
  it('no stylesheet rule asks Fredoka for a weight it does not have (#44)', () => {
    const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');
    expect(css.length, 'style.css must be read from disk, not a blank import').toBeGreaterThan(5000);
    expect(css).toContain('--font: "Fredoka"');                          // the stack these weights resolve in
    expect([...css.matchAll(/font-weight:\s*800/g)].length,
      'Fredoka has no 800; use 700 and let the stroke or colour carry the weight').toBe(0);
  });

  // #43, found while writing this rail's own PR: pulling the wave layout out of spawnWave was meant to make
  // it testable, and the first attempt still disagreed with `main` on a differential — `dealOrdered` held a
  // *second* `Math.random`, in the per-batch shuffle, that the extraction had missed. That is the failure
  // mode worth catching: a function that reads as pure but quietly draws from the global RNG cannot be
  // seeded, so a test can only sample it. It looks covered and is not, and the disagreement shows up as a
  // wave that plays subtly differently rather than as a red build. Both take `rng: Rng`; neither may reach.
  /*
   * #389 — a duel's two halves pose the same wave, and three separate things have to stay true for that.
   * Found in play: the answer rose at a different moment on each side, so the match measured the shuffle.
   * The unit tests in `tests/unit/duel.test.ts` hold what a shared draw *does* — and stay green against the
   * unfixed screen, because they never touch it; only a source rail can hold that the screen still wires one
   * up. The plausible edits are all small: dropping `now` back to each arena's own clock, hoisting one
   * generator out of the loop (stateful, so the second half gets the first's leftovers), or letting the two
   * halves' geometry drift, which is what `layoutWave` reads.
   */
  it('the duel spawns both halves from one draw, one clock origin and equal geometry (#389)', () => {
    const duel = code(SOURCES['/src/ui/duel.ts']);
    const from = duel.indexOf('for (const p of PLAYERS) { arenas[p].topInset');
    expect({ loop: from >= 0 }).toEqual({ loop: true });
    const spawn = duel.slice(from, duel.indexOf('\n', from));
    // One generator *per arena*, built inside the loop: `seededRng(seed)` is called where the spawn is, so
    // hoisting it to a shared instance — the bug with extra steps — no longer matches.
    expect(spawn, 'each half gets its own generator off the round seed').toMatch(/spawnWave\(opts, \{ rng: seededRng\(seed\), now: at \}\)/);
    // ...and both halves are given the same inset in the same statement, so the geometry cannot drift apart
    // without this line changing: `layoutWave` reads topInset, and a different one is a different wave.
    expect(spawn, 'and the same topInset, in the same statement').toMatch(/arenas\[p\]\.topInset = 8;/);
    // The seed and the clock origin are drawn once, above the loop. Inside it they would be per-arena again,
    // which is exactly the defect: `performance.now()` moves between the two calls.
    const draw = duel.slice(duel.lastIndexOf('const seed', from), from);
    expect(draw, 'one seed and one `now` for the round, drawn before either half').toMatch(/const seed = .*performance\.now\(\)/);
    expect(spawn, 'so neither of them is re-drawn per arena').not.toMatch(/performance\.now\(\)|Math\.random/);
    // And the seam they ride: `spawnWave`'s shared draw is optional, so every wave outside the duel keeps
    // `Math.random` and the live clock — a seeded arena in ordinary play would repeat itself (#389).
    const arena = code(SOURCES['/src/game/arena.ts']);
    expect(arena, 'the shared draw is opt-in').toMatch(/spawnWave\(o: WaveOpts, shared\?: \{ rng: Rng; now: number \}\)/);
    expect(arena, 'and ordinary play still draws for itself').toMatch(/shared\?\.now \?\? performance\.now\(\), shared\?\.rng \?\? Math\.random/);
  });

  /*
   * #425/PR #428 — the duel's toast sits in the question bar's own `grid-area: q`, overlapping the card and
   * neither arena. That placement bought the arenas back the 32px a third grid row had cost them, and it holds
   * only while the toast stays SHORTER than the strip: a line long enough to wrap grows the `q` row and takes
   * the height off both children again. The e2e rail measures exactly that, on `DUEL_TOAST_LONGEST` — so this
   * rail's whole job is to keep that constant the real worst case. A longer line added to `duel.ts` would
   * otherwise leave the e2e measuring a case that no longer exists, green, which is the shape of the failure
   * #425 was opened about: "the guard rail that should have caught it did not".
   */
  it('the duel e2e probes the longest verdict the screen can actually raise (#425)', () => {
    const src = SOURCES['/src/ui/duel.ts'] ?? '';
    expect(src.length, 'duel.ts must be read, not a blank import').toBeGreaterThan(1000);
    // Read out of the source rather than imported: `src/ui/duel.ts` pulls the arena, the certificate canvas
    // and the audio graph in behind it, and a rail about a string is not a reason to stand all that up here.
    // EVERY read below is off `body`, never off `src`. `seat` used to be read raw, so the first `a: '…'`
    // anywhere in the file — a COMMENT included — became the seat name every `${NAME[player]}` verdict was
    // measured at, and one comment above `NAME` reading `` {  a: 'P1', b: 'P2' } `` shortened a 44-char
    // verdict to 38 and slipped it under the bound (PR #428 review, B2). This is a file that quotes code in
    // its comments as a matter of habit — `src/ui/duel.ts` carries a literal `` `toast(` `` in prose — which
    // is why the call-site scan below always stripped them. One `body` now, so the three reads cannot
    // disagree about whether comments count.
    const body = code(src);
    const longest = /export const DUEL_TOAST_LONGEST = '([^']*)'/.exec(body)?.[1] ?? '';
    const seat = /a: '([^']*)'/.exec(body)?.[1] ?? '';
    expect({ longest: longest.length > 0, seat: seat.length > 0 },
      'both must be found in the source, or every comparison below is against an empty string').toEqual({ longest: true, seat: true });
    // Every `toast(` argument in the file, with the two seat names substituted at their real width. Both are
    // 'Player N', so either stands for both; a name that stopped being fixed-width would need this widened.
    // All three quote styles, because nothing in this repository makes `toast("…")` unreachable — there is no
    // linter forbidding double quotes, and a double-quoted 62-char verdict was invisible here (review, note 1).
    // The substitution handles exactly ONE interpolation shape, `${NAME[…]}`: a verdict that reached a seat
    // name any other way (a local alias, `NAME.a`, a template helper) is measured at SOURCE length, which
    // over-states it and so cannot green a real overflow — but it does mean this rail's "every `toast(` in the
    // file" is exact only for the shapes named here.
    const raised = [...body.matchAll(/\btoast\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g)]
      .map(m => (m[1] ?? m[2] ?? m[3]).replace(/\$\{NAME\[[^\]]+\]\}/g, seat))
      .filter(s => s.length > 0);
    // 2, not 5: #436 moved the certificate outcome ('Certificate saved!' etc.) off `#toast` entirely — it now
    // reports through `#cert-msg`, inside the results overlay `#toast` sits BEHIND — so the family this rail
    // guards has shrunk to the round verdicts that still share the query-bar slot. `onRoundWon`/`onRoundMiss`
    // are the two left as string literals; the draw verdict raises the constant directly (checked below) rather
    // than repeating its text, so it is deliberately not double-counted here.
    expect(raised.length, 'the toast call sites must be found, or this rail passes vacuously').toBeGreaterThanOrEqual(2);
    // The constant is raised by a real call site, not merely declared beside them.
    expect(body, 'DUEL_TOAST_LONGEST is what one of those calls passes').toMatch(/toast\(DUEL_TOAST_LONGEST/);
    for (const s of raised) {
      expect(s.length, `"${s}" is longer than DUEL_TOAST_LONGEST, so the e2e layout rail no longer measures the worst case`)
        .toBeLessThanOrEqual(longest.length);
    }
    // #436: the certificate outcome must stay off `#toast` — the whole reason it moved — so a regression that
    // routes it back through `toast(` (where the overlay hides it again) is caught here rather than by a child
    // never seeing whether their certificate saved.
    expect(body, 'the certificate outcome is reported through #cert-msg, not the toast the overlay covers')
      .toMatch(/certMsg\(/);
    expect(body, 'and never back through toast() — that is the bug #436 fixed')
      .not.toMatch(/toast\(['"`](?:Certificate|Could not make the certificate)/);
    // And the e2e really uses it, rather than a copy that drifts the moment this constant changes.
    const spec = readFileSync(new URL('../e2e/duel.spec.ts', import.meta.url), 'utf8');
    expect(spec, 'the duel spec imports the constant').toContain("import { DUEL_TOAST_LONGEST } from '../../src/ui/duel'");
  });

  // #508: a `commitMatch` throw must not hang a finished duel, at ANY of the three commit points — round 1
  // of this fix caught it only at the two early call sites (`onRoundWon`, `waveEnd`) and left `onMatchEnd`'s
  // own bare call reachable with `committed=true, payout=null` on the very same last round: `waveEnd`'s
  // `later(() => duel.waveEnd(), …)` runs `Duel.end()` synchronously, which fires `onMatchEnd` before that
  // `later()` call even returns, so a throw caught early still resurfaced one beat later at the third point
  // and skipped `showResults`. The catch now lives INSIDE `commitOnce` itself, so all three callers are safe
  // by construction rather than each needing its own wrapper. This rail is a text check that the shape is
  // still there — it cannot see a throw actually being swallowed at runtime (no jsdom here,
  // `.claude/rules/guardrails.md`). duel.ts is at the #714 ratchet's line cap, hence the dense lines.
  it('a throw from commitOnce cannot hang a duel at any of its three commit points (#508)', () => {
    const src = SOURCES['/src/ui/duel.ts'] ?? '';
    const body = code(src);
    expect(body.length, 'duel.ts must be read, not a blank import').toBeGreaterThan(1000);
    // commitOnce itself catches and returns null on failure, rather than throwing or trusting a caller-side
    // wrapper (round 1's commitOrToast, which left onMatchEnd's bare call unprotected).
    expect(body, 'commitOnce must return GameEndOutcome | null, not GameEndOutcome — a caller must be able to see failure')
      .toMatch(/const commitOnce = \(r: DuelResult\): GameEndOutcome \| null => \{/);
    expect(body, 'commitOnce must try/catch commitMatch itself, not leave it to a wrapper')
      .toMatch(/try \{ payout = commitMatch\(r\); \}\s*catch \(e\) \{/);
    // All three call sites go through the one function — nothing calls commitMatch directly, and nothing
    // still routes through the retired commitOrToast wrapper.
    expect(body, 'onRoundWon, right before endWave, must call commitOnce').toMatch(/if \(duel\.onLastRound\) commitOnce\(duel\.result\(\)\);\s*endWave\(/);
    expect(body, 'waveEnd, right before the later() that arms duel.waveEnd(), must call commitOnce').toMatch(/if \(duel\.onLastRound\) commitOnce\(duel\.result\(\)\);\s*later\(\(\) => duel\.waveEnd\(\)/);
    expect(body, 'the retired commitOrToast wrapper must not come back').not.toMatch(/commitOrToast/);
    // onMatchEnd reads commitOnce's return rather than trusting it non-null: a failed commit skips showResults
    // (there is no real payout to show) and falls back to pausing the arenas directly, so the match still
    // visibly stops rather than sitting live with only the toast as feedback.
    expect(body, 'onMatchEnd must branch on a possibly-null commit result, not assume it succeeded')
      .toMatch(/onMatchEnd: r => \{ const p = commitOnce\(r\); if \(p\) later\(\(\) => showResults\(r, p\), [\s\S]+?\); else hold\(true, false\); \}/);
    // The failure toast fits inside DUEL_TOAST_LONGEST like every other toast() in this file (#425) — checked
    // again here directly, since the #425 rail above only scans literal toast( arguments and would not catch
    // a call built from a variable.
    const longest = /export const DUEL_TOAST_LONGEST = '([^']*)'/.exec(body)?.[1] ?? '';
    expect(longest.length, 'DUEL_TOAST_LONGEST must be found').toBeGreaterThan(0);
    const failToast = /catch \(e\) \{ console\.error\('duel commit failed', r, e\); toast\("([^"]*)"/.exec(body)?.[1] ?? '';
    expect(failToast.length, 'the failure toast text must be found').toBeGreaterThan(0);
    expect(failToast.length, `"${failToast}" is longer than DUEL_TOAST_LONGEST, so it would wrap and cost the arenas height (#425)`)
      .toBeLessThanOrEqual(longest.length);
  });

  /*
   * #436 round-1 review, B1 — `.cert-msg { color: var(--good); ... }` on its own is (0,1,0): one class. The
   * pre-existing `.modal p { margin: 4px 0 14px; color: var(--muted); ... }` is (0,1,1) — one class AND one
   * element selector — which beats it regardless of source order, since class-count ties and the tiebreak goes
   * to the element-selector column. `#cert-msg` is a `<p class="cert-msg">`, so it matches both, and the bare
   * class silently lost: every successful save/share rendered in `--muted` grey with the wrong margin, and
   * nothing failed — it just wasn't green. `.modal .cert-msg`, two classes, (0,2,0), wins outright.
   */
  it('.cert-msg is qualified enough to beat .modal p, not a bare class a higher-specificity rule can silently win against (#436 review, B1)', () => {
    const raw = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');
    expect(raw.length, 'style.css must be read from disk, not a blank import').toBeGreaterThan(5000);
    // Comments stripped (`code()`): this rule's own explanatory comment names the bare selector in prose, which
    // would otherwise trip the last assertion below on the very sentence describing why it must not appear.
    const css = code(raw);
    expect(css, 'the pre-existing higher-specificity rule this is qualified against must still exist').toMatch(/\.modal p \{/);
    expect(css, '.cert-msg must be qualified under .modal, not left as a bare one-class selector').toMatch(/\.modal \.cert-msg \{/);
    expect(css, 'the .bad modifier must be qualified the same way').toMatch(/\.modal \.cert-msg\.bad \{/);
    // A `.cert-msg` not immediately preceded by `.modal ` would mean the qualifier was dropped again — a
    // negative lookbehind rather than a bare "not present" check, since `.modal .cert-msg` must NOT itself
    // count as the regression it is the fix for.
    expect(css, 'no .cert-msg selector may reappear unqualified by .modal').not.toMatch(/(?<!\.modal )\.cert-msg\b/);
  });

  it('the wave layout draws only from the rng it is given (#43)', () => {
    const src = code(SOURCES['/src/game/arena.ts'] ?? '');
    expect(src.length, 'arena.ts must be read, not a blank import').toBeGreaterThan(1000);
    for (const fn of ['layoutWave', 'dealOrdered']) {
      const start = src.indexOf(`export function ${fn}(`);
      expect(start, `${fn} must stay an exported, unit-testable function`).toBeGreaterThan(-1);
      const next = src.indexOf('\nexport ', start + 1);
      const body = src.slice(start, next === -1 ? src.length : next);
      expect(body, `${fn} must take its randomness as an argument`).toContain('rng: Rng');
      expect(body, `${fn} must draw from rng(), never Math.random — a hidden draw cannot be seeded`).not.toContain('Math.random');
    }
    // the seam only pays if the game still goes through it: one definition, one call, and spawnWave
    // hands over the real clock and the real RNG rather than layoutWave reaching for them itself.
    expect(src.split('layoutWave(').length - 1, 'layoutWave has one call site: spawnWave').toBe(2);
    // #389 widened the last of these rather than weakening it: spawnWave now hands over the caller's draw and
    // clock origin when a duel gives it one (both halves must pose the same wave), and its own otherwise. The
    // claim is unchanged — layoutWave never reaches for a clock or a global RNG itself — so this pins both
    // arms, where it used to pin the one that existed. The `??` spelling is what keeps ordinary play impure.
    expect(src, 'spawnWave passes the speed multiplier, the clock and the RNG in')
      .toContain('gameSpeed(), shared?.now ?? performance.now(), shared?.rng ?? Math.random');
  });

  // #43: the tracing pass/fail rule is what decides whether a child gets their letter accepted, and the half
  // of it that counts pixels — which cells a stroke claims, and whether a point landed on the glyph at all —
  // used to live inside Tracer, where testing it needed a real canvas and so nothing tested it. Keeping it as
  // pure exports over a plain grid is the whole reason it now has unit tests; folding it back into the class
  // would silently return the pass rule to e2e-only cover, which is how it went untested for so long.
  it('the tracing pixel accounting stays canvas-free and unit-testable (#43)', () => {
    const src = code(SOURCES['/src/game/tracing.ts'] ?? '');
    expect(src.length, 'tracing.ts must be read, not a blank import').toBeGreaterThan(1000);
    for (const fn of ['markPoint', 'paintStroke']) {
      const start = src.indexOf(`export function ${fn}(`);
      expect(start, `${fn} must stay an exported, unit-testable function`).toBeGreaterThan(-1);
      const next = src.indexOf('\nexport ', start + 1);
      const body = src.slice(start, next === -1 ? src.length : next);
      // a canvas, a DOM node or a pointer event in here and the accounting is untestable again
      for (const reach of ['getContext', 'document.', 'this.', 'PointerEvent', 'getImageData'])
        expect(body, `${fn} must stay pure: no ${reach}`).not.toContain(reach);
    }
    // and the class must actually go through them, rather than keeping a second copy of the maths
    expect(src, 'Tracer.paint hands the stroke to paintStroke').toContain('paintStroke(this.grid, this.tally');
    expect(src, 'Tracer.autoTrace marks through markPoint').toContain('markPoint(this.grid, this.tally');
    expect(src.split('tally.glyphHits[').length - 1, 'only markPoint credits a letter').toBe(1);
    expect(src.split('.covered[').length - 1, 'only markPoint claims a cell').toBe(2);   // the read and the write, both in markPoint
  });

  // #138: most e2e tests now seed the avatar into localStorage instead of walking the avatar screen, which is
  // the right trade — but it is a trade that can be taken one step too far without anything going red. If the
  // last `pickAvatar` call sites were "tidied" into `seedPlayer`, the avatar screen → sky map → island → play
  // path would keep its own small tests and lose the only test that walks it all the way into a mission, and
  // the suite would still be green. The seed's other silent failure is the init script: it runs on every
  // navigation, so an unconditional write would quietly reset the save under any test that reloads to check
  // something persisted (the Daily Dojo, the remembered home screen) — those tests would then be asserting
  // against the seed rather than against what the game stored.
  it('the e2e seed shortcut keeps a walked cold start, and never overwrites a save (#138)', () => {
    const spec = readFileSync(new URL('../e2e/game.spec.ts', import.meta.url), 'utf8');
    expect(spec.length, 'the e2e spec must be read, not an empty string').toBeGreaterThan(10000);
    const src = code(spec);
    // the storage slot the seed writes is the one the app reads — a rename in storage.ts must not be silent
    const key = /const KEY = '([^']+)'/.exec(code(SOURCES['/src/storage.ts'] ?? ''))?.[1];
    expect(key, 'storage.ts must still declare a KEY').toBeTruthy();
    expect(src, `seedPlayer writes the save slot storage.ts reads (${key})`).toContain(`localStorage.getItem('${key}')`);
    expect(src, 'seedPlayer seeds only an empty slot, so a reload reads what the test stored')
      .toMatch(/if \(!localStorage\.getItem\('[^']+'\)\) localStorage\.setItem\(/);
    // and at least two tests still walk the avatar screen, one of them all the way into a mission
    expect(src.split('await pickAvatar(page').length - 1, 'the walked cold start keeps at least two tests')
      .toBeGreaterThanOrEqual(2);
    const tutorial = src.indexOf("test('first play shows the slice tutorial hand");
    expect(tutorial, 'the cold-start-into-play test must still exist').toBeGreaterThan(-1);
    const body = src.slice(tutorial, src.indexOf("\n  test('", tutorial + 1));
    expect(body, 'it walks the avatar screen').toContain('await pickAvatar(page)');
    expect(body, 'and carries on into a mission').toContain('await startTopic(page');
  });

  // #141: a pull request now runs the MOBILE project only, so the nightly is the only place a desktop-only
  // regression is caught at all. That makes two silent failures possible, neither of which reddens anything:
  //   - a project is added to `playwright.config.ts` (#116's portrait tablet is next) and wired into the PR
  //     arm, or into neither — the first pays for a whole extra sequential leg on every PR, the second means
  //     a project that exists but is never run;
  //   - a later tidy-up collapses the ternary to one command and the nightly quietly stops running desktop,
  //     which reads as a 4-minute saving and is actually the loss of the only desktop coverage there is.
  // The rail therefore reads the config as the source of truth: every declared project must appear in the
  // full-matrix arm, and the pull-request arm must name exactly one. Comments are stripped first — the step's
  // own comment names both projects, and a rail that reads its own prose is the #129 failure.
  it('CI runs one project on a pull request and every project on the nightly (#141)', () => {
    const yml = workflow('ci.yml');
    expect(yml.length, 'ci.yml must be read from disk, not a blank import').toBeGreaterThan(500);
    const cfg = readFileSync(new URL('../../playwright.config.ts', import.meta.url), 'utf8');
    const projects = [...code(cfg).matchAll(/name:\s*'([^']+)'/g)].map(m => m[1]);
    expect(projects.length, 'playwright.config.ts must declare its projects').toBeGreaterThanOrEqual(2);

    const lines = yml.split('\n').filter(l => !l.trim().startsWith('#'));
    const line = lines.find(l => l.includes('playwright test'));
    expect(line, 'ci.yml must still have an e2e step').toBeTruthy();
    expect(line, 'the e2e command must branch on the event, not run one fixed matrix')
      .toContain("github.event_name == 'pull_request'");
    const [prArm, fullArm] = [...line!.matchAll(/'((?:--project=[\w-]+\s*)+)'/g)].map(m => m[1].trim());
    expect(prArm, 'the pull-request arm must be a quoted --project list').toBeTruthy();
    expect(fullArm, 'the full-matrix arm must be a quoted --project list').toBeTruthy();

    // the PR arm: exactly one project, and one that really exists
    const prProjects = prArm.split(/\s+/).map(a => a.replace('--project=', ''));
    expect(prProjects.length, 'a pull request runs ONE project — each extra one is a whole extra leg (#141)').toBe(1);
    expect(projects, `the PR project '${prProjects[0]}' must be declared in playwright.config.ts`).toContain(prProjects[0]);

    // #486: `setup` exists only to be another project's `dependencies` entry (it runs the identity spec
    // before everything else, at any worker count) — it is not a leg of its own, and Playwright runs it
    // automatically whenever a project depending on it is selected, with no `--project=` flag of its own.
    // Demanding one in the nightly arm would ask CI for a flag it never needs, so a project referenced by
    // ANY other project's `dependencies` array is excluded from the "every project" loop below.
    const depOnly = new Set([...code(cfg).matchAll(/dependencies:\s*\[([^\]]*)\]/g)]
      .flatMap(m => [...m[1].matchAll(/'([^']+)'/g)].map(d => d[1])));

    // the nightly arm: every LEG project, or a regression in the missing one is caught by nothing at all
    for (const p of projects) {
      if (depOnly.has(p)) continue;
      expect(fullArm, `the nightly must run every declared project — '${p}' is missing (#141)`)
        .toContain(`--project=${p}`);
    }
    // and a dependency-only project must actually be reachable from every leg, in both arms — nothing else
    // here checks that `dependencies` still names it once a leg is added, renamed or edited (#486).
    const parts = code(cfg).slice(code(cfg).indexOf('projects:')).split(/(?=\{\s*name:\s*')/).filter(p => /^\{\s*name:\s*'/.test(p));
    for (const dep of depOnly) {
      for (const part of parts) {
        const name = part.match(/name:\s*'([^']+)'/)![1];
        if (depOnly.has(name)) continue;
        expect(part, `'${name}' must depend on '${dep}', or it can start running before '${dep}' has (#486)`)
          .toMatch(new RegExp(`dependencies:\\s*\\[[^\\]]*'${dep}'`));
      }
    }
    // and the step must stay off the push-to-main run, which is what makes the nightly the only full check.
    // #162: read from the e2e STEP, never from the file. Three steps carry that same `if:` — the apt
    // tidy-up (#147) and the browser install as well as e2e — so a whole-file match was satisfied by any
    // one of them: deleting the guard from the e2e step alone left this rail green while e2e quietly
    // rejoined every push to main, at ~3 metered minutes a merge on the very bill #141 exists to cut.
    // The step is bounded by the next `- ` at its own indent, so a step gains no cover from its neighbours.
    const stepAt = lines.findIndex(l => l.includes('playwright test'));
    let from = stepAt;
    while (from >= 0 && !/^\s*- /.test(lines[from])) from--;
    expect(from, 'the e2e command must sit inside a workflow step').toBeGreaterThan(-1);
    const dash = lines[from].indexOf('- ');
    const sibling = new RegExp(`^\\s{${dash}}- `);
    // ends at the next step at this indent, or at anything that dedents out of the steps list — so the slice
    // is this step wherever it sits, including last, where "the next `- `" alone would run to end of file
    const out = (l: string) => l.trim() !== '' && /^\s*/.exec(l)![0].length < dash;
    let to = from + 1;
    while (to < lines.length && !sibling.test(lines[to]) && !out(lines[to])) to++;
    const step = lines.slice(from, to).join('\n');
    expect(step, 'the located block is the e2e step itself').toContain('playwright test');
    // a rail on the slicing above: widen it back to the file and this goes red rather than quietly passing
    expect(lines.slice(from, to).filter(l => sibling.test(l)), 'the block is ONE step, not a run of them')
      .toHaveLength(1);
    expect(step, "the E2E STEP stays off the push run — another step carrying that `if:` is not cover (#162)")
      .toMatch(/if:\s*github\.event_name\s*!=\s*'push'/);
  });

  // #116: nothing in CI had ever rendered a tablet, which is the shared root of #107, #109 and #110. The
  // fix is two projects that run ONE small spec file, and there are two ways that decays silently:
  //   - a tablet project loses its `testMatch` and picks up the whole spec instead. Playwright gets one
  //     worker on a 2-core runner, so a project costs a whole sequential leg (#141 measured mobile at 2m43s
  //     and desktop at 4m00s) — two unrestricted tablet legs would be ~8 min a night on the bill #119 is
  //     about, and nothing would go red to say so;
  //   - `viewport.spec.ts` stops importing the shared assertion and the helper becomes dead code that
  //     still reads as tablet coverage. #116 asks for it to be used by a spec for exactly that reason.
  // The #141 rail above already holds every declared project into the nightly arm and the pull-request arm
  // to one, so neither half is repeated here: this rail is only about what a tablet project may run.
  // Split on the project boundary rather than by line, so reformatting the config cannot quietly blank it.
  it('the tablet projects run only the viewport spec, which uses the shared assertion (#116)', () => {
    const cfg = code(readFileSync(new URL('../../playwright.config.ts', import.meta.url), 'utf8'));
    const parts = cfg.slice(cfg.indexOf('projects:')).split(/(?=\{\s*name:\s*')/).filter(p => /^\{\s*name:\s*'/.test(p));
    expect(parts.length, 'playwright.config.ts must declare its projects, and be read from disk').toBeGreaterThanOrEqual(4);
    expect(parts.filter(p => /name:\s*'tablet/.test(p)).length,
      'a portrait tablet and a landscape one — the geometry #107 shows up on (#116)').toBeGreaterThanOrEqual(2);
    for (const p of parts) {
      const name = p.match(/name:\s*'([^']+)'/)![1];
      if (name.startsWith('tablet')) {
        expect(p, `'${name}' must be touch-driven, or it is the desktop project at another size (#116)`)
          .toMatch(/hasTouch:\s*true/);
        expect(p, `'${name}' must run the viewport spec only — an unrestricted tablet leg is ~4 min a night (#116)`)
          .toMatch(/testMatch:\s*\/viewport\\\.spec\\\.ts\//);
      } else {
        // #486: `mobile`/`desktop` now also exclude the identity spec (`setup` runs it instead), which makes
        // `testIgnore` an array rather than a bare regex — the optional `[...` tolerates that without caring
        // how many other patterns share the array, only that `/viewport\.spec\.ts/` is genuinely one of them.
        expect(p, `'${name}' must skip the viewport spec, so the pull-request leg stays the suite it was (#141)`)
          .toMatch(/testIgnore:\s*(?:\[[^\]]*)?\/viewport\\\.spec\\\.ts\//);
      }
    }
    const spec = readFileSync(new URL('../../tests/e2e/viewport.spec.ts', import.meta.url), 'utf8');
    expect(spec.length, 'the tablet spec must be read from disk, not a stub').toBeGreaterThan(800);
    expect(spec, 'the tablet spec must use the shared assertion, not its own copy of the measurement (#116)')
      .toMatch(/from\s+'\.\/viewport'/);
    expect(spec, 'and actually call it, or the helper is dead code that still reads as coverage (#116)')
      .toMatch(/await expectFitsViewport\(/);
  });

  // #483: Playwright's default parallelises across FILES only — the tests inside one file are a single
  // sequential chain on one worker. 97 of the mobile project's 104 tests live in tests/e2e/game.spec.ts, so
  // with the flag off the e2e step is as long as that one chain however many workers the runner offers, and
  // the rest idle: CI run 35640634022 paid 416 s of a 488 s job while worker 2 sat done after 57 s.
  // This is worth a rail because turning it back off breaks NOTHING that goes red. The suite still passes,
  // just three times slower, and a regression whose only symptom is a bill is one nobody files.
  //
  // **The first version of this rail matched TEXT, and review of PR #487 found three ways round it in one
  // round** — a spread defined above `defineConfig(` and mixed into a project; a spec in a subdirectory the
  // non-recursive `readdirSync` never saw; and a `//` inside a string, which `code()` strips to end of line,
  // hiding the very call being searched for. Each was real and each was reproduced with the rail green.
  //
  // They are not three bugs. They are three members of ONE class — ways to write a thing so that a regex
  // does not see it — and in a Turing-complete language that class has no end: patch three spellings and a
  // fourth exists. So the fix is not a fourth regex. It is to **stop reading the text and read the value**:
  // import the config and ask what Playwright will actually resolve. A spread resolves. An indirection
  // resolves. A computed value resolves. A comment cannot lie to it because no comment is read.
  //
  // Round 2 found the SECOND lever still failing the first way, and named the shape better than round 1 did:
  // a check that **substitutes a placeholder for a value it does not recognise** cannot fail on the values it
  // does not recognise. `workers` is typed `number | string` and a percentage is resolved against the
  // runner's cores at run time, so `'50%'` is one worker on a two-core box — and this rail used to default
  // any non-number to a passing `2`. One rule now covers both levers: **what this rail cannot judge, it
  // refuses.** Not a number above 1, or a worker flag on the command line in any spelling — red, and say so.
  //
  // The ceiling of "read the resolved value", stated because the next rail to use the technique should know
  // it: a config that reads its own importer (`process.env.VITEST ? … : …`) resolves one way here and
  // another under Playwright. Nothing in this file can close that, and nothing pretends to.
  //
  // What is left textual is the spec half, and deliberately: Playwright's reporters do not expose a file's
  // parallel mode, so there is nothing to ask. That half reads RAW text rather than `code()` — the opposite
  // trade from the first version and the right way round for a guard rail. Raw text can produce a false
  // POSITIVE (the word in a comment turns it red, and somebody rewords the comment); `code()` produced a
  // false NEGATIVE (the defect ships green), which is the failure this whole file exists against.
  it('the e2e suite parallelises inside a file, not only across files (#483)', async () => {
    // The resolved config, not its source text. `defineConfig` returns the object; importing it runs the
    // port derivation at the top of the file, which is pure.
    const cfg = (await import('../../playwright.config')).default;
    expect(cfg.fullyParallel, 'fullyParallel must be on at the top level — with it off, 97 of the suite\'s tests are one sequential chain on one worker (#483)').toBe(true);
    expect(cfg.projects?.length, 'the config must still declare its projects, or this rail checks nothing').toBeGreaterThanOrEqual(4);
    for (const p of cfg.projects ?? []) {
      // `?? cfg.fullyParallel` is how Playwright resolves it: a project that says nothing inherits the top
      // level. A project that says `false` governs itself alone, and every OTHER project would still look
      // fine — which is exactly what the text version could not see through a spread.
      expect(p.fullyParallel ?? cfg.fullyParallel, `project '${p.name}' resolves fullyParallel to false — however it is spelt, that project is back to one file at a time (#483)`).toBe(true);
    }
    // Same class, other lever: one worker makes the flag moot without touching it. `workers` is typed
    // `number | string` and a percentage is resolved against the runner at RUN time (`resolveWorkers`,
    // playwright/lib/common/config.js), so no value this rail can see tells it how many workers a runner
    // will get. Unset is the default — half the logical cores — and is what every #483 measurement was
    // taken at. So the rule is not "is it 1?" but "can this rail judge it at all?", and an unjudgeable
    // value fails. `? cfg.workers : 2` here used to hand a passing number to every value it did not
    // understand, which is the defect the config half above was rewritten to remove, in the same rail.
    expect(cfg.workers === undefined || (typeof cfg.workers === 'number' && cfg.workers > 1),
      `workers is ${JSON.stringify(cfg.workers)} — leave it unset, or give a plain number above 1. One worker runs the suite a test at a time with fullyParallel still resolving true, and a percentage takes its meaning from the runner, so this rail cannot approve it on sight (#483)`).toBe(true);
    // ...and the same lever on the command line, where no config rail can see it. "No worker flag at all"
    // rather than "not --workers=1": the flag has a short form (`-j`), takes `=` or a space, and a
    // percentage means whatever the runner makes it — so there is no value this rail could approve by
    // reading. ci.yml passes none today, and every #483 measurement was taken with none.
    const e2eStep = workflow('ci.yml').split('\n').filter(l => l.includes('playwright test')).join('\n');
    expect(e2eStep, 'the rail must have found the e2e command in ci.yml').toContain('playwright test');
    expect(e2eStep, "ci.yml's e2e command must pass no worker flag at all — `--workers` or `-j`, in any spelling, is #483 undone from the command line where no config rail can see it (#483)")
      .not.toMatch(/--workers|(?<![\w-])-j/);

    // The spec half. RECURSIVE, because Playwright's own discovery is: a spec under tests/e2e/sub/ runs, and
    // the first version of this rail never opened it. Raw text, quote-agnostic: `mode: "serial"` type-checks
    // just as well as `mode: 'serial'`, `describe.serial` is a third spelling and `describe['serial']` a
    // fourth (round 2 — semantically identical, and the dot form is what the regex used to want).
    //
    // `isDirectory()` deliberately, WITHOUT `isSymbolicLink()`. That looks like the same non-recursive gap
    // one level down, and it was raised as one — but measured, Playwright does not follow a symlinked
    // directory either: `--list` reports the same 106 tests with `tests/e2e/link -> /tmp/outside` present as
    // without it, that directory's spec included. This walk is meant to mean "everything Playwright would
    // discover", so following the link would make the rail STRICTER than the thing it models and turn red
    // on a file that never runs. If Playwright's discovery ever changes, this changes with it.
    const dir = new URL('../../tests/e2e/', import.meta.url);
    const specs: string[] = [];
    const walk = (rel: string) => {
      for (const e of readdirSync(new URL(rel, dir), { withFileTypes: true })) {
        if (e.isDirectory()) walk(`${rel}${e.name}/`);
        else if (e.name.endsWith('.spec.ts')) specs.push(`${rel}${e.name}`);
      }
    };
    walk('');
    expect(specs.length, 'the e2e specs must be read from disk — an empty walk would pass vacuously').toBeGreaterThanOrEqual(3);
    const serial = specs.filter(f =>
      /mode:\s*['"`]serial['"`]|describe\s*(?:\.\s*serial\b|\[\s*['"`]serial['"`]\s*\])/
        .test(readFileSync(new URL(f, dir), 'utf8')));
    expect(serial, 'no e2e spec may re-serialise itself — that undoes #483 for that file with the config still resolving true. If a flow genuinely needs ordering, scope it to its own describe and name it here with the reason')
      .toEqual([]);
  });

  // #138: fast mode (#32) is only sound while it is a *pure time compression* — the same game, fewer seconds.
  // It shipped with two leaks. `layoutWave` divided the flight time but left `vx` in px/second, so at 4x a
  // bubble drifted a quarter as far sideways as a child ever sees; and a handful of `later(...)` beats in
  // play.ts kept their real-time literals, so they were part of the floor the suite could not get under.
  // Neither failed anything — which is exactly what makes them worth a rail. A test written against the
  // compressed trajectory would have been asserting a path the game does not have, and the next beat added
  // in real time would be just as invisible as these were.
  /**
   * #301's hold, wired — and the two shapes of it no other unit test can see (PR #474 round-1 review).
   *
   * Reverting the user-visible half of #301 outright — `holdTimers` a no-op in `play.ts`, `scope.holdTimers`
   * deleted from `duel.ts` — left the whole unit suite green at 1,931: only the two new e2e specs caught it,
   * and a `testIgnore` could quietly drop those (review, note 7). The terminal-hold rule had nothing at all:
   * `hold(true)` at the results screen froze beats no resume would ever re-arm, so the sticker jingle never
   * played and every results toast pinned itself over the modal — and CI stayed green through both, because
   * nothing asserted that a toast goes AWAY. Text checks, like every rail in this file: they hold the exact
   * call sites named in their comments, and say nothing about a third screen or a new way to arm a beat.
   */
  it('both game screens put their beats on the hold, and take the terminal hold off it (#301, PR #474 review B1)', () => {
    const play = code(SOURCES['/src/ui/play.ts'] ?? '');
    const playSession = code(SOURCES['/src/ui/play-session.ts'] ?? '');
    const duel = code(SOURCES['/src/ui/duel.ts'] ?? '');
    expect({ play: play.length > 1000, playSession: playSession.length > 1000, duel: duel.length > 1000 },
      'all three must be read, not blank imports').toEqual({ play: true, playSession: true, duel: true });
    // Wired at all: the pause hold reaches the beat clock on both screens.
    expect(playSession, "play-session's hold drives the screen's beats, not only the arena").toMatch(/\bdeps\.holdTimers\(open\)/);
    expect(play, "and play.ts hands the scope's holdTimers to the session").toMatch(/\bholdTimers\b/);
    expect(duel, "the duel's hold drives them too").toMatch(/\bscope\.holdTimers\(open\)/);
    // And taken OFF it where the hold is TERMINAL. `showResults` never reopens — both screens offer only
    // Play again and Islands, and both go straight to cleanup — so a beat armed after it has no resume.
    expect(play, 'the play results hold does not freeze the beats it is about to arm')
      .toMatch(/playSession\.hold\(true,\s*false\)/);
    expect(duel, 'nor does the duel results hold').toMatch(/\bhold\(true,\s*false\)/);
    // The beat that proved it, still inside the results path on both screens. Named so that moving it out is
    // a deliberate act rather than something this rail silently stops covering.
    for (const [name, src] of [['play.ts', play], ['duel.ts', duel]] as const) {
      const at = src.indexOf('function showResults');
      expect(at, `${name} still has a showResults for this rule to be about`).toBeGreaterThan(-1);
      expect(src.slice(at), `${name}'s results screen still arms the unlock jingle after its hold`)
        .toMatch(/later\(\(\) => sfx\.stage\(\)/);
    }
  });

  /**
   * #301's one gap, closed in PR #474's round 1 (review, B2): the first wave's font gate.
   *
   * `fontReady()` is a promise, and a raw `.then()` continuation is guarded by `mounted()`/`waveId` and by
   * nothing that reads the hold — so a pause pressed inside that gate, up to the 1200 ms cap on a cold font
   * cache, spoke the question and launched the wave behind the overlay, which is the very symptom #301's
   * docblock says it removes. Routed through `later(..., scaled(0))` it defers instead of dropping. A text
   * check: it holds that the two known gates go through the beat clock, not that no third way to spawn exists.
   */
  it('the font-gated first spawn goes through the beat clock, not straight out of the promise (#301, PR #474 review B2)', () => {
    for (const [name, path] of [['play-session.ts', '/src/ui/play-session.ts'], ['duel.ts', '/src/ui/duel.ts']] as const) {
      const src = code(SOURCES[path] ?? '');
      expect(src.length, `${name} must be read, not a blank import`).toBeGreaterThan(1000);
      // EVERY occurrence, not the first. `play-session.ts` has two — `fontReady().then(() => { fontsReady =
      // true; })`, which sets the flag and launches nothing, and the gate itself — and slicing by first match
      // read the wrong one, green. That is the same trap #395 files against the prose rails, met here.
      const gates = [...src.matchAll(/fontReady\(\)\.then\(/g)].map(m => m.index ?? -1);
      expect(gates.length, `${name} still gates on fontReady at all`).toBeGreaterThan(0);
      const launching = gates.filter(at => /\bspawn(Wave)?\(/.test(src.slice(at, at + 900)));
      expect(launching.length, `${name} has a fontReady gate that goes on to launch a wave`).toBe(1);
      // The beat clock must be the FIRST thing inside that continuation, not something reached later in it.
      expect(src.slice(launching[0], launching[0] + 80).replace(/\s+/g, ' '),
        `${name}'s font gate hands its continuation to later(), so a pause inside the gate holds the spawn`)
        .toMatch(/^fontReady\(\)\.then\(\(\) => (deps\.)?later\(/);
    }
  });

  it('fast mode compresses time only — the drift scales with it and no beat is left in real time (#138)', () => {
    const arena = code(SOURCES['/src/game/arena.ts'] ?? '');
    expect(arena.length, 'arena.ts must be read, not a blank import').toBeGreaterThan(1000);
    // the one place a horizontal velocity is handed to a bubble: it must carry the speed multiplier
    const vx = /const vx = ([^;]+);/.exec(arena)?.[1];
    expect(vx, 'layoutWave must still compute a vx').toBeTruthy();
    expect(vx, 'vx is px/second, so it scales with the speed multiplier or the arc is not the real one (#138)')
      .toContain('speedK');

    // and every scheduled beat goes through scaled(): a bare `later(fn, 1200)` is a real-time wait.
    // BOTH files are counted, the same way #36's settle() rail counts both: the question beat, the outcome
    // beat and the results beat live in play-session.ts now, so a rail scoped to play.ts alone would be green
    // while the file that owns most of the beats went unwatched. play-session.ts has no bare-numeric later()
    // today, so it starts at the floor — this rail costs nothing to widen and stops a whole file drifting.
    const files = ['/src/ui/play.ts', '/src/ui/play-session.ts'];
    for (const f of files) expect((SOURCES[f] ?? '').length, `${f} must be read, not a blank import`).toBeGreaterThan(1000);
    const real = files.flatMap(f => code(SOURCES[f] ?? '').split('\n')
      .filter(l => l.includes('later(') && /,\s*\d+\s*\)/.test(l)).map(l => `${f}: ${l.trim()}`));
    expect(real, `a beat is still scheduled in real time — wrap it in scaled(...) (#138):\n${real.join('\n')}`)
      .toEqual([]);

    // the one thing the multiplier must never touch, restated here because #32's whole premise rests on it
    const speed = code(SOURCES['/src/game/speed.ts'] ?? '');
    expect(speed, 'scaled() divides a duration; it never multiplies a clock').toContain('ms / factor');
    expect(SOURCES['/src/ui/play.ts'], 'the sprint clock still samples the real clock, not a scaled one')
      .toContain('performance.now()');
  });

  // #138: found by the e2e suite while scaling the beats above. A spawn is queued twice over — behind the
  // tutorial hold, then behind a requestAnimationFrame — and the session can move on in either gap. When it
  // does, the superseded spawn still runs, and `spawnWave` empties the bubble array before filling it, so the
  // PREVIOUS question's bubbles replace the current question's wave: the child is asked one thing and handed
  // the answers to another. It hid for as long as the tutorial hold was 1.8 s of real time; the moment that
  // hold scaled with the game speed, the desktop e2e caught it ("no bubble for <word>"). `endWave` already
  // guards on the same `waveId` counter — this is that idiom applied to the other end of the wave.
  // Reads play-session.ts: onQuestion and its spawn closure moved there with #36, and a rail left pointing at
  // play.ts would have gone green on a file that no longer contains the code it claims to guard.
  it('a queued spawn checks its question is still on screen before it lands (#138)', () => {
    const play = code(SOURCES['/src/ui/play-session.ts'] ?? '');
    expect(play.length, 'play-session.ts must be read, not a blank import').toBeGreaterThan(1000);
    const from = play.indexOf('waveId++');
    expect(play.indexOf('const spawn = () =>'), 'play-session.ts must still build its wave in a spawn() closure').toBeGreaterThan(from);
    const body = play.slice(from, play.indexOf('spawnWave(', from));                 // the question's own wave, start to launch
    expect(body, 'play-session.ts must still capture the wave id the spawn belongs to').toMatch(/=\s*waveId;/);
    // one check per deferral: the timer/font gate, and the animation frame inside it
    expect((body.match(/waveId !==/g) ?? []).length, 'both deferrals must drop a superseded spawn (#138)')
      .toBeGreaterThanOrEqual(2);
  });

  // Incident 2026-09-10 (#159): `on: pull_request` carried no `types:` list at all, so GitHub applied its
  // default — [opened, synchronize, reopened] — and `ready_for_review` is not in it. Undrafting is exactly
  // how a reviewer CLEARS a block here (CLAUDE.md, review-gate.yml), so the last step of the review protocol
  // fired no CI: #150 merged at 12:37Z on a tick from 03:31Z, four merges of `main` behind, one of which
  // (#155) had rewritten the e2e helpers that PR's own new rail called. The reviewing run merged while
  // saying it was waiting for a re-run that could not arrive. A stale tick is absence wearing a green tick,
  // which is the same defect as reading a missing `review-gate` status as a pass.
  //
  // Two ways this regresses, and the rail names both because they look nothing alike:
  //   - `ready_for_review` is dropped, or the whole `types:` line is deleted as redundant clutter — a tidy-up
  //     that silently restores the default trio and puts the hole straight back;
  //   - one of the three defaults is lost while editing the line, because an explicit `types:` REPLACES the
  //     default rather than extending it. Losing `synchronize` would mean a push to a PR tests nothing.
  // Comments are stripped first: ci.yml's own trigger note explains all four events at length, and a rail
  // that reads its own prose passes with the line it guards deleted — the #129 failure, exactly.
  it('CI re-runs when a blocked PR is undrafted, and still on the default three (#159)', () => {
    const yml = workflow('ci.yml');
    expect(yml.length, 'ci.yml must be read from disk, not a blank import').toBeGreaterThan(500);
    const lines = yml.split('\n').filter(l => !l.trim().startsWith('#'));
    const from = lines.findIndex(l => l.startsWith('on:'));
    const to = lines.findIndex(l => l.startsWith('jobs:'));
    expect(from, 'ci.yml must have an `on:` block').toBeGreaterThan(-1);
    expect(to, 'ci.yml must have a `jobs:` block after it').toBeGreaterThan(from);
    // Only the pull_request sub-block, so a `types:` belonging to `push` or a future trigger cannot answer
    // for it — the bug was specific to which pull-request events CI subscribes to.
    const on = lines.slice(from, to);
    const at = on.findIndex(l => l.trim().startsWith('pull_request:'));
    expect(at, 'ci.yml must still trigger on pull_request').toBeGreaterThan(-1);
    const rest = on.slice(at + 1);
    const end = rest.findIndex(l => /^ {0,2}\S/.test(l));            // the next key at pull_request's indent
    const block = rest.slice(0, end === -1 ? rest.length : end).join('\n');

    // Both YAML spellings, so reformatting the list is not a false red: `types: [a, b]` and a block sequence.
    const flow = block.match(/types:\s*\[([^\]]*)\]/);
    const seq = block.match(/types:[^\S\n]*\n((?:[^\S\n]*-[^\S\n]*\w+[^\S\n]*\n?)+)/);
    const types = (flow ? flow[1].split(',') : (seq?.[1] ?? '').split('\n').map(l => l.replace(/^\s*-\s*/, '')))
      .map(t => t.trim()).filter(Boolean);
    expect(types.length, 'with no explicit `types:` GitHub applies [opened, synchronize, reopened] and ' +
      'clearing a review block runs nothing (#159)').toBeGreaterThan(0);
    // Membership of the parsed list, never a substring of it: `includes('opened')` is true of `reopened` too.
    for (const t of ['opened', 'synchronize', 'reopened', 'ready_for_review'])
      expect({ trigger: t, subscribed: types.includes(t) }).toEqual({ trigger: t, subscribed: true });
  });

  // #176: e2e now runs on a pull request only when the diff can reach the game, decided by one regex in
  // ci.yml's scope step. Every way this saving turns into a silent loss of coverage is a change to that one
  // line or to the conditions that read it, so the rail reads all of them out of the workflow itself.
  //
  // The failure it is written against is specific and cheap to cause: someone adds a top-level directory
  // under `src/` — `src/lessons/` for #10, say — while the filter enumerates the directories that existed
  // when it was written. Nothing goes red, e2e silently stops covering the new code, and the first anyone
  // knows is a regression on a child's phone. Today the filter uses the `src/` prefix and so covers any new
  // directory for free; this rail is what makes that a property rather than an accident, because the moment
  // an edit narrows the prefix to a list, a directory left off it turns this red.
  //
  // Prove it red both ways before trusting it: narrow `src/` to `src/game/` in ci.yml and the coverage half
  // fails; widen the regex to `.` and the discrimination half fails. A filter that matches everything is a
  // rail that has stopped filtering, and it reads as a passing test.
  describe('e2e is filtered by path, and the filter cannot silently stop covering src/ (#176)', () => {
    const yml = workflow('ci.yml');
    const lines = yml.split('\n').filter(l => !l.trim().startsWith('#'));
    // Read from the assignment in the scope step, not from a comment: ci.yml's own prose names these paths.
    const raw = /GAME_PATHS='([^']+)'/.exec(lines.join('\n'))?.[1];
    // A DELETED GAME_PATHS must fail the coverage rail, not slip past it. `new RegExp(undefined)` is `/(?:)/`
    // — the empty pattern, which matches every string — so falling back to the raw value would have made
    // "every src/ path is covered" pass with the filter gone and "nothing else is matched" the only rail
    // left. Caught while proving these red: the coverage half went green against a ci.yml with no filter at
    // all. `(?!)` is the opposite failure and the safe one — it matches nothing, so a missing filter reads
    // as covering nothing.
    const filter = () => new RegExp(raw ?? '(?!)');

    it('ci.yml declares the path filter as a single readable regex', () => {
      expect(yml.length, 'ci.yml must be read from disk, not a blank import').toBeGreaterThan(500);
      expect(raw, "ci.yml must assign GAME_PATHS='<regex>' on one line — the rail below reads it from there")
        .toBeTruthy();
    });

    it('every top-level entry under src/ is covered — a new directory cannot lose e2e', () => {
      const re = filter();
      const entries = readdirSync(new URL('../../src', import.meta.url), { withFileTypes: true });
      expect(entries.length, 'src/ must be read from disk, not an empty listing').toBeGreaterThan(3);
      for (const e of entries) {
        const path = e.isDirectory() ? `src/${e.name}/some-new-file.ts` : `src/${e.name}`;
        expect({ path, e2e: re.test(path) }, `a change to ${path} would skip e2e — add it to GAME_PATHS (#176)`)
          .toEqual({ path, e2e: true });
      }
    });

    it('and the other game paths the filter promises', () => {
      const re = filter();
      for (const path of ['index.html', 'public/avatars/ninja.webp', 'tests/e2e/game.spec.ts',
                          'playwright.config.ts', 'package.json', 'package-lock.json',
                          '.github/workflows/ci.yml'])
        expect({ path, e2e: re.test(path) }).toEqual({ path, e2e: true });
    });

    // Without this half the rail above is satisfied by `GAME_PATHS='.'`, which skips nothing and reads green.
    it('and it still discriminates — the shapes that pay for this change are not matched', () => {
      const re = filter();
      // `docs/worklog/2026-09.md` replaces `WORKLOG.md` here (#178 archived it): the shape being asserted is
      // "a markdown file that cannot reach the game", and pointing at a path that no longer exists would
      // have made this line read as a leftover rather than a check.
      for (const path of ['CLAUDE.md', 'docs/ROUTINE-PROMPT.md', 'docs/worklog/2026-09.md',
                          'tests/unit/guardrails.test.ts', 'scripts/board-sync.mjs',
                          '.claude/skills/add-topic/SKILL.md', '.github/workflows/review-gate.yml'])
        expect({ path, e2e: re.test(path) }, `${path} cannot reach the game, so it must not pay for e2e (#176)`)
          .toEqual({ path, e2e: false });
    });

    // The filter is only sound because it fails towards running. Both defaults are load-bearing: the nightly
    // is the one full check a merged tree gets (#141), and a diff that could not be computed must never read
    // as "nothing changed" — that is a silent loss of coverage wearing a green tick, the #150 shape again.
    it('the scope step fails towards running e2e, never towards skipping it', () => {
      const at = lines.findIndex(l => l.includes('id: scope'));
      expect(at, 'ci.yml must still have the scope step').toBeGreaterThan(-1);
      const script = lines.slice(at, lines.findIndex(l => l.includes('Unit tests + guard rails'))).join('\n');
      expect(script, 'a non-pull_request event must not consult the diff at all')
        .toMatch(/EVENT"?\s*!=\s*'pull_request'\s*\]\s*;\s*then\s*\n\s*echo "e2e=true"/);
      expect(script, 'a diff that cannot be computed must still run e2e')
        .toMatch(/if ! files=\$\(git diff[^\n]*\n\s*echo "e2e=true"/);
      expect((script.match(/echo "e2e=false"/g) ?? []).length,
        'exactly one branch may skip e2e — the one that read the diff and found nothing').toBe(1);
    });

    // The three steps that exist only to run e2e must all carry the condition. Installing a browser for a
    // run that never opens one is about a minute of the ~2.9 this change is worth.
    it('the e2e step and its two setup steps all read the scope output', () => {
      for (const name of ['playwright test', 'playwright install', 'sources.list.d/google-chrome']) {
        const at = lines.findIndex(l => l.includes(name));
        expect(at, `ci.yml must still have the ${name} step`).toBeGreaterThan(-1);
        let from = at;
        while (from >= 0 && !/^\s*- /.test(lines[from])) from--;
        const dash = lines[from].indexOf('- ');
        const sibling = new RegExp(`^\\s{${dash}}- `);
        let to = from + 1;
        while (to < lines.length && !sibling.test(lines[to])) to++;
        const step = lines.slice(from, to).join('\n');
        expect(step, `the ${name} step must be gated on the path filter (#176)`)
          .toMatch(/steps\.scope\.outputs\.e2e\s*==\s*'true'/);
      }
    });

    // Written because #176 itself was drafted with this bug and caught in self-review, not on a runner.
    // GitHub's `&&`/`||` return the OPERAND, not a boolean, so `${{ cond && A || B }}` is a ternary only
    // while A is truthy. `fetch-depth: ${{ github.event_name == 'pull_request' && 0 || 1 }}` collapses to
    // `1` in both branches, because `true && 0` is `0` and `0 || 1` is `1`. This file already leans on the
    // idiom twice with string operands, so the next editor has two correct examples in front of them and no
    // warning — and the failure is invisible: the clone is shallow, the diff fails, the scope step fails
    // safe and runs e2e, and the filter simply never fires. Nothing goes red; the feature is just absent.
    // Read from `lines`, never `yml`: the comment above names the very idiom this bans, and the first draft
    // of this rail went red on its own explanation — the #129 failure, from the other side.
    it('no `${{ … && <falsy> || … }}` — GitHub returns the operand, so that is not a ternary', () => {
      const bad = [...lines.join('\n').matchAll(/\$\{\{([^}]*)\}\}/g)]
        .map(m => m[1]).filter(e => /&&\s*(0|false|''|"")\s*\|\|/.test(e));
      expect(bad, `these expressions always return their right-hand side:\n${bad.join('\n')}`).toHaveLength(0);
    });


    // #176's other half, and the reason it is a tightening rather than only a saving: a pull request used to
    // be able to produce NO `CI` check at all, which the merge rules then had to carve out as an acceptable
    // absence sitting next to "a missing check is a red light". The guard rails in this very file read
    // CLAUDE.md and docs/ROUTINE-PROMPT.md, so a documentation-only pull request is exactly the
    // change they exist to catch and was the one shape they never ran on. `push` keeps its filter: that tree
    // already passed on its own pull request minutes earlier.
    it('a pull request always gets a CI check — no paths-ignore on the pull_request trigger', () => {
      const from = lines.findIndex(l => l.startsWith('on:'));
      const to = lines.findIndex(l => l.startsWith('jobs:'));
      const on = lines.slice(from, to);
      const at = on.findIndex(l => l.trim().startsWith('pull_request:'));
      expect(at, 'ci.yml must still trigger on pull_request').toBeGreaterThan(-1);
      const rest = on.slice(at + 1);
      const end = rest.findIndex(l => /^ {0,2}\S/.test(l));
      const block = rest.slice(0, end === -1 ? rest.length : end).join('\n');
      expect(block, 'a docs-only pull request must still report a CI check — filter the e2e step, not the ' +
        'workflow (#176)').not.toMatch(/paths-ignore/);
    });
  });

  // #206: `concurrency.group` used to be `ci-${{ github.ref }}-${{ github.event_name }}` with no commit in
  // it, so two pushes to `main` within the workflow's run time landed in the SAME group
  // (`ci-refs/heads/main-push`) and `cancel-in-progress` killed the earlier one. PR #190 and PR #193 merged
  // 3 seconds apart on 2026-09-17; #190's run was cancelled by #193's push and never reported a conclusion at
  // all — benign only because #193 happened to be a fast-follow rebased on top of #190's tree, so its own
  // green run re-tested #190's changes as a superset. A genuinely unrelated pair, or a broken second commit
  // whose own run is *also* cancelled by a third, goes straight from "cancelled" to "nobody looks" — main
  // gets no other check on a push (#89's split reserves the full suite for the nightly). The fix folds
  // `github.sha` into a push's group so every push gets a group nothing else can collide with; `pull_request`
  // and `schedule`/`workflow_dispatch` are untouched; keyed on `ref`+`event_name` alone, which is #88's own
  // fix for the opposite direction (an undraft must still cancel a stale `synchronize` run for the SAME PR).
  it('a push to main cannot cancel another push\'s CI run (#206)', () => {
    const yml = workflow('ci.yml');
    const lines = yml.split('\n').filter(l => !l.trim().startsWith('#'));
    const at = lines.findIndex(l => l.trim().startsWith('group:') && l.includes('ci-'));
    expect(at, 'ci.yml must still declare the concurrency group').toBeGreaterThan(-1);
    const group = lines[at];
    // The two events #206 was never about must keep colliding on ref+event alone — a pull_request's group is
    // the same across its own `synchronize` runs (#88), and schedule/workflow_dispatch have nothing to key on.
    expect(group, 'a push must be singled out — the fix must not touch every event').toMatch(/event_name\s*==\s*'push'/);
    expect(group, 'a push\'s group must fold in the commit so no two pushes ever share one')
      .toMatch(/event_name\s*==\s*'push'[\s\S]*github\.sha/);
    // The falsy-ternary trap this file already bans two rails up: the branch taken when the event IS 'push'
    // must not itself be a falsy literal, or GitHub's `&&`/`||` fall through to the non-push branch anyway.
    expect(group).not.toMatch(/&&\s*(0|false|''|"")\s*\|\|/);
  });

  // #236: every "Android APK" run failed at the SDK step — `Warning: Failed to find package 'tools'`, then
  // sdkmanager exit 1 — because `android-actions/setup-android` was called with no inputs and its DEFAULT is
  // `packages: 'tools platform-tools'`. `tools` is the retired legacy SDK Tools package; Google removed it
  // from the repository and nothing here said otherwise. Nothing in this repository had changed.
  //
  // What this rail can and cannot do, stated plainly: it could not have predicted Google's retirement, and it
  // is not a build. What it catches is the shape that made us vulnerable — an input we do not control, left to
  // a third party's default — plus the retired name coming back. The workflow runs only on `workflow_dispatch`,
  // a `v*` tag, or a pull request touching the Android paths, so nothing else would tell us it is broken until
  // someone wants an APK; the watchdog's check on the last run's conclusion (docs/WATCHDOG-PROMPT.md) is the
  // other half. Prove it red in EVERY spelling, not the convenient one — two earlier versions of this rail
  // were green for some of these, and each row below is #236 restored verbatim, so each must fail:
  //     the `with:` line dropped entirely (the original bug)
  //     with: { packages: 'tools platform-tools' }
  //     with: { packages: "tools platform-tools" }
  //     with: { packages: 'tools platform-tools' }   # a trailing comment
  //     with: { packages: "tools platform-tools", accept-android-sdk-licenses: true }
  //     with:
  //       packages: tools platform-tools
  //     with:
  //       packages: tools platform-tools   # a trailing comment
  //     with: { packages: '' }                       — installs nothing
  // And these must stay GREEN, or the rail is a false alarm on a correct workflow:
  //     with: { packages: 'platform-tools' }   ·   the same double-quoted   ·   the same with a trailing comment
  //     with: { packages: "platform-tools", accept-android-sdk-licenses: true }
  //     with:
  //       packages: platform-tools
  it('the Android SDK step names its packages, and never the retired `tools` (#236)', () => {
    const yml = workflow('android.yml');
    expect(yml.length, 'android.yml must be read, not an empty file').toBeGreaterThan(500);
    const lines = yml.split('\n').filter(l => !l.trim().startsWith('#'));
    // EVERY setup-android step, not the first: a second one added later would install whatever it liked.
    const steps = lines.map((l, i) => [l, i] as const)
      .filter(([l]) => /uses:\s*android-actions\/setup-android@/.test(l)).map(([, i]) => i);
    expect(steps.length, 'the APK build must still set the Android SDK up through the action this rail reads')
      .toBeGreaterThan(0);
    for (const at of steps) {
    // The step's own `with:` block: the lines under it, up to the next step (`- uses:` / `- name:` / `- run:`).
    const body = [];
    for (const line of lines.slice(at + 1)) { if (/^\s*-\s/.test(line)) break; body.push(line); }
    // The key itself — `(?:\{\s*)?packages` — so a sibling like `extra-packages:` is not read as this one.
    const withLine = body.find(l => /^\s*(?:with:\s*\{\s*)?packages\s*:/.test(l));
    expect(withLine, "name `packages` on the step — the action's default asks for the retired `tools`").toBeTruthy();
    // End the value where YAML ends it, rather than taking the rest of the line and scrubbing it. Two earlier
    // versions of this line were the same bug as #236 itself, one level up — an input that could not be read,
    // degraded into a pass: first `'([^']*)'` with `?? ''`, which let a double-quoted or block-form list
    // extract nothing; then a strip-and-trim chain whose brace removal ran before the comment removal, so a
    // trailing `# comment` left a quote welded to the first token and `'tools` no longer equalled `tools`.
    // A quoted scalar is read first (a space inside quotes is not a terminator), otherwise the value runs to
    // the flow map's `,` or `}`, or to a `#`. Anything that does not then look like a plain package list is
    // RED — never scrubbed into something assertable.
    const m = /packages\s*:\s*(?:'([^']*)'|"([^"]*)"|([^,}#]*))/.exec(withLine!);
    expect(m, 'this rail must be able to read the packages value; unreadable is red, never a pass').toBeTruthy();
    const asked = (m![1] ?? m![2] ?? m![3] ?? '').trim();
    expect(asked, 'keep `packages` a plain space-separated list this rail can read — and not empty, which installs nothing')
      .toMatch(/^[A-Za-z0-9][A-Za-z0-9;._\- ]*$/);
    // What must be there, as well as what must not: `packages: ''` installs nothing and would otherwise be green.
    expect(asked, 'the step must still ask for the package the build needs')
      .toContain('platform-tools');
    // Word-boundary matched on purpose: `platform-tools` is the package we do want, and a plain `includes`
    // would read it as the retired one and go red on a correct workflow.
    expect(asked.split(/\s+/).filter(Boolean), '`tools` was retired by Google; sdkmanager cannot resolve it')
      .not.toContain('tools');
    }
  });

  // #236 review: nothing pinned the watchdog's check 9, so deleting it left the suite green — and that check
  // is the only thing that would notice a *future* APK break of a different cause, since the rail above is a
  // text check and not a build. Every other watchdog rule in this file is held by a rail that quotes its
  // wording; this is check 9's.
  it('the watchdog reads the APK workflow through the per-workflow endpoint, and judges every conclusion (#236)', () => {
    // Read from disk like the other prompt rails: Vite's glob covers `/src/**` only, and `docs/` is not in it.
    const text = readFileSync(new URL('../../docs/WATCHDOG-PROMPT.md', import.meta.url), 'utf8');
    expect(text.length, 'the watchdog prompt must be read, not an empty file').toBeGreaterThan(1000);
    // Assert against CHECK 9's own slice, not the whole document: `cancelled` also appears in check 1, so a
    // document-wide search let check 9's conclusion list be gutted while riding on its neighbour — and it let
    // the whole check be relocated verbatim under a "retired checks" heading with every assertion still green.
    // Inside the "## The checks" section, not merely somewhere in the file: a check moved verbatim under a
    // "retired checks" heading keeps its number and its wording, and a document-wide search reads as green.
    const checks = text.slice(text.indexOf('\n## The checks'));
    const section = checks.slice(0, checks.indexOf('\n## ', 1));
    expect(section.length, 'the checks section must be read, not an empty slice').toBeGreaterThan(2000);
    const at = section.indexOf('9. **Can an APK still be built');
    expect(at, 'check 9 must exist, in the checks a run performs — it is the only thing watching the APK')
      .toBeGreaterThan(0);
    const check9 = section.slice(at);
    expect(check9, 'and it must be about main, not about whichever branch ran last')
      .toMatch(/on `main`\?/);
    expect(check9, 'read through the per-workflow endpoint, filtered to main')
      .toContain('/actions/workflows/android.yml/runs?branch=main');
    expect(check9, 'never `?workflow=`, which that endpoint ignores — it returns the newest run in the repository')
      .toMatch(/`\/actions\/runs\?workflow=android\.yml`\n   looks plausible and is wrong/);
    expect(check9, "both filters must be confirmed on the run itself — a dropped one is this check's own failure mode")
      .toMatch(/if the\n   run's `name` is not `Android APK`, or its `head_branch` is not `main`/);
    expect(check9, '`success` is the pass — `failure` alone would wave through timed_out and startup_failure')
      .toMatch(/\*\*`success` is the pass\.\*\*/);
    for (const conclusion of ['timed_out', 'startup_failure', 'cancelled', 'action_required', 'stale', 'neutral'])
      expect(check9, `${conclusion} must be named as a finding, not left to the reader`).toContain(conclusion);
    expect(check9, 'and a run stuck at null must be bounded, as check 1 bounds it — a permanent queue is a dead quota')
      .toMatch(/45 minutes/);
  });
});


describe('the tablet layout rails (#107, #109)', () => {
// #107: the five-frame glyph outgrew its box because the box and its contents were sized from different
// units — `.slot` from `min(6.5vw, 4.5vh)`, `.obj` from `5.5vw` alone — so on a tablet the box collapsed
// towards its floor while the glyph stayed near its cap. The e2e in `viewport.spec.ts` measures the two
// rendered boxes, but only at the handful of viewports a project declares; this rail is the cheap
// complement #107 asks for by name, and it is the exhaustive half: it holds the *arithmetic* for every
// `--slot` the stylesheet declares, at every viewport, for the two-group and take-away variants too.
//
// 0.801 is the exact-fit line, not the rail's bound. Every emoji in `OBJECTS` advances 1.248 em (measured:
// all ten identical, Noto Color Emoji's 2550/2048 design width), so a glyph is inside its slot only while
// font-size <= slot / 1.248 = 0.801 * slot — but #594 found the game shipping at 0.78, ~3% of headroom at
// the `--slot` clamp's own 40px cap (the size a tablet in portrait sits at), against a font metric measured
// from one face this game is not guaranteed to render with. 0.72 is the rail's bound so the margin cannot
// silently drift back to that: it leaves at least ~10% in hand under the exact-fit line, whatever ratio a
// future change picks below it.
//
// The stylesheet is read with readFileSync, not the `?raw` glob at the top of this file: Vite's css
// plugin returns an empty string for CSS outside the browser, which would make this rail pass vacuously.
// The length assertion below is what proves it did not.
it('the five-frame glyph is sized from its slot, never from the viewport (#107)', () => {
  const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');
  expect(css.length, 'style.css must be read from disk as text, or this rail checks nothing').toBeGreaterThan(10_000);
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');   // comments may quote the very units the rail bans

  const objFont = [...bare.matchAll(/\.objs\s+\.obj\s*\{[^}]*?font-size:\s*([^;}]+)/g)].map(m => m[1].trim());
  expect(objFont.length, 'the object glyph must get its font-size somewhere (#107)').toBe(1);
  // Two rules setting it is how the bug survived at short heights: the block set 16px and then 20px
  // eight lines later, so the first was dead and nobody reading the first one saw the real pairing.
  expect(objFont[0], 'the glyph must be sized from --obj, not from vw/vh — that divergence IS #107')
    .toBe('var(--obj)');

  const ratios = [...bare.matchAll(/--obj:\s*calc\(\s*var\(--slot\)\s*\*\s*([0-9.]+)\s*\)/g)].map(m => Number(m[1]));
  const objDecls = [...bare.matchAll(/--obj:/g)].length;
  expect(ratios.length, 'every --obj must be calc(var(--slot) * k) — a literal size can drift from the box')
    .toBe(objDecls);
  expect(objDecls, '--obj must be declared at least once (#107)').toBeGreaterThanOrEqual(1);
  for (const k of ratios)
    expect(k, `0.801 is the exact-fit line for a 1.248em advance; ${k} leaves less than #594's ~10% margin`)
      .toBeLessThanOrEqual(0.72);

  // The box half: if `.slot` goes back to its own viewport clamp, the single source of truth is gone and
  // the ratio above is measured against a width nothing else uses.
  const slotWidth = bare.match(/\.slot\s*\{[^}]*?width:\s*([^;}]+)/)?.[1].trim();
  expect(slotWidth, 'the slot must take its width from --slot, so box and glyph cannot drift apart (#107)')
    .toBe('var(--slot)');
});

// #594: two text-matching rails lived here through six review rounds — one for the `@media (…max-height…)`
// gate, one enumerating "every sizing property" a `.tenframe` selector could carry. Both kept losing to a
// new CSS spelling every round (a compound selector, a shorthand, a logical property, case, a `calc()`
// wrapper) because CSS has an unbounded number of ways to say "this is a fixed size", and grepping stylesheet
// *text* for that claim cannot terminate. The reviewer's own conclusion, round 7: replace text-matching with
// a rendered-geometry assertion — measure what the browser actually computed, which is insensitive to how
// the CSS that produced it was spelled — or drop the text rail and lean on what already holds. Both text
// rails are gone; what replaces them:
//   - the `--obj` ratio bound above (still a real, mutation-tested arithmetic guarantee — a ratio is a
//     number, not a spelling, so there's no unbounded set of ways to write it);
//   - `tests/e2e/viewport.spec.ts`'s "the ten-frame shrinks to fit an unrealistically narrow card" and
//     "the five-frame glyph is sized from --obj even inside a height gate" — real browser measurements of
//     `.tenframe`'s and `.objs .obj`'s ACTUAL rendered size, which catches a fixed 140px/24px/16px/whatever
//     future spelling produces one, because it is never fooled by how the fixed size was written, only by
//     whether the element is genuinely, still, this many pixels wide.

  // #109: the grown-ups dashboard laid itself out 936 px wide inside an 800 px portrait tablet, at every
  // tablet size alike, because the width never came from the viewport. `.p-year-row span` carried
  // `min-width: 130px`, which a flex item cannot shrink below, so the `.p-year` card's min-content width
  // was 300 px — and a `1fr` grid track is `minmax(auto, 1fr)`, which never goes under min-content. So
  // `repeat(3, 1fr)` was 3x300 px however narrow the screen got, and the page grew a horizontal scrollbar.
  //
  // Two halves, because either one alone lets the bug back:
  //   - no un-shrinkable floor on the row label, or the min-content width climbs again;
  //   - the three-up desktop grid does not start at the 600 px breakpoint, or a ~800 px portrait tablet
  //     takes a layout drawn for 1280 px and there is nowhere for the cards to go.
  it('the dashboard year cards can shrink, and do not take the desktop grid on a tablet (#109)', () => {
    const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');
    expect(css.length, 'style.css must be read from disk as text, or this rail checks nothing').toBeGreaterThan(10_000);
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');   // comments quote the very declaration the rail bans

    const row = bare.match(/\.p-year-row\s+span\s*\{([^}]*)\}/)?.[1];
    expect(row, 'the .p-year-row label rule must exist, or this rail is measuring nothing (#109)').toBeTruthy();
    const floor = row!.match(/(?:^|[;{\s])min-width:\s*([^;}]+)/)?.[1].trim();
    expect(floor, 'the label needs min-width: 0 — a non-zero floor is exactly what made the card 300 px (#109)')
      .toBe('0');
    expect(row, 'and a flex-basis, so the 130 px preferred width survives wherever there is room for it')
      .toMatch(/flex(-basis)?:\s*[^;}]*130px/);

    // Every media query that hands `.p-years` a three-column grid must be a desktop-width one.
    const tiers = [...bare.matchAll(/@media\s*\(min-width:\s*(\d+)px\)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)]
      .map(m => ({ px: Number(m[1]), body: m[2] }));
    const threeUp = tiers.filter(t => /\.p-years\s*\{[^}]*repeat\(\s*3\s*,/.test(t.body));
    expect(threeUp.length, 'the three-up year grid must be declared in a min-width media query (#109)').toBeGreaterThanOrEqual(1);
    for (const t of threeUp)
      expect(t.px, `three year cards across at ${t.px}px puts the desktop grid on a portrait tablet — #109 exactly`)
        .toBeGreaterThanOrEqual(900);
  });
});


/**
 * #137 item 1: the tally chart's "gate stroke" — the diagonal line across a group of four uprights that turns
 * `||||` into a five — is drawn entirely in `::after`, which a unit test cannot see rendered, only read as
 * text. The existing generator test pins the *class* `tal five` and the four uprights; none of it can tell
 * whether the pseudo-element that actually draws the fifth mark still exists, still has a visible stroke, or
 * is still positioned inside its own `.tal`. Six mutations proved this gap (the issue's own table): deleting
 * the rule, retargeting it to a class nothing emits, collapsing the stroke to zero width, dropping
 * `position: relative` from `.tal` (the anchor the `::after` is positioned against), deleting
 * `display: contents` from `.chart-row` (which is what lets `.cat`/`.data` sit directly in the `.chart` grid),
 * and deleting the base `.chart` grid rule, `.chart .blk` or `.chart .key` outright — every one of them left
 * the whole suite, e2e included (it only asserts `.tal` is visible, not what it draws), green.
 *
 * The stylesheet is read with readFileSync, not the `?raw` glob elsewhere in this file: Vite's CSS plugin
 * returns an empty string outside a browser, which would make this rail pass on nothing. The length assertion
 * is what proves it read real content, the same idiom as the #107/#109 rails above.
 */
describe('the chart visual\'s CSS structure cannot go missing without a red test (#137)', () => {
  const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');
  it('the base grid, the row, the block and the key rules all exist', () => {
    expect(css.length, 'style.css must be read from disk as text, or this rail checks nothing').toBeGreaterThan(10_000);
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

    const chart = bare.match(/(?:^|[}\s])\.chart\s*\{([^}]*)\}/)?.[1];
    expect(chart, 'the base .chart rule must exist (#137)').toBeTruthy();
    expect(chart, 'the chart lays its rows out on a grid, or .chart-row: display: contents below has nothing to plug into')
      .toMatch(/display:\s*grid/);

    const row = bare.match(/\.chart\s+\.chart-row\s*\{([^}]*)\}/)?.[1];
    expect(row, 'a .chart .chart-row rule must exist (#137)').toBeTruthy();
    expect(row, '.chart-row must stay display: contents, or .cat/.data stop sitting directly in the grid')
      .toMatch(/display:\s*contents/);

    expect(bare, 'a .chart .blk rule must exist — one per child in a block diagram').toMatch(/\.chart\s+\.blk\s*\{[^}]*\}/);
    expect(bare, 'a .chart .key rule must exist — the pictogram key line').toMatch(/\.chart\s+\.key\s*\{[^}]*\}/);
  });

  it('the tally gate stroke exists, is anchored to its upright group, and is actually visible', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

    const tal = bare.match(/\.chart\s+\.tal\s*\{([^}]*)\}/)?.[1];
    expect(tal, 'a .chart .tal rule must exist').toBeTruthy();
    expect(tal, '.tal must stay position: relative, or its ::after gate stroke positions against the wrong box')
      .toMatch(/position:\s*relative/);

    const gate = bare.match(/\.chart\s+\.tal\.five::after\s*\{([^}]*)\}/)?.[1];
    expect(gate, 'a .chart .tal.five::after rule must exist — a tally of five renders identically to four without it')
      .toBeTruthy();

    const width = gate!.match(/border-top:\s*([\d.]+)px/)?.[1];
    expect(width, 'the gate stroke must be drawn with a border-top width').toBeTruthy();
    expect(Number(width), 'a zero-width border-top draws no visible stroke at all').toBeGreaterThan(0);

    // `inset: top right bottom left`. Width is `containingBlockWidth - right - left`: a fixed px offset on
    // each side (as shipped, -2px/-2px) always leaves a real width, but a *percentage* offset is relative to
    // the row's own width and can be made to collapse it to nothing — `50% 50%` gives width 0, and "the
    // offsets differ" cannot catch that (`50%`/`50%` are equal, but so are the legitimate `-2px`/`-2px`).
    // Requiring px on both sides is what actually rules the collapse out.
    const inset = gate!.match(/inset:\s*([^;}]+)/)?.[1].trim().split(/\s+/);
    expect(inset?.length, 'inset must give all four offsets').toBe(4);
    expect(inset![1], 'the right offset must be a fixed px value — a % of the row width can collapse the stroke to zero')
      .toMatch(/^-?[\d.]+px$/);
    expect(inset![3], 'same for the left offset')
      .toMatch(/^-?[\d.]+px$/);
  });
});


/**
 * #299 review B2: on a `y2-symmetry` card `.symgrid rect.on` *is* the answer. Delete that one line from
 * `src/style.css` and every square renders at the same faint fill, so every card is a blank grid — and a
 * blank grid is symmetric. Every `answer: 'no'` card becomes unanswerable, on a year with three lives.
 *
 * Nothing saw it: `curriculum`, `visuals` and `guardrails` together (709 tests) stayed green, and so did the
 * new e2e, because both count DOM nodes rather than paint — `.symgrid rect.on` is still emitted, it just
 * draws the same as its neighbour. That is the same failure, in the same function, that the #137 rail above
 * was written for after deleting `.chart .blk` left the whole suite green; `renderVisual`'s symmetry case
 * cites #137 by number for its input defence, so it carries #137's CSS rail too.
 *
 * Read with readFileSync for the reason the #137 rail gives: Vite's CSS plugin returns an empty string
 * outside a browser, and the length assertion is what proves this read real content.
 */
describe('the symmetry visual\'s CSS structure cannot go missing without a red test (#299)', () => {
  const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');

  it('a coloured square and an empty one cannot render the same, and the fold line stays visible', () => {
    expect(css.length, 'style.css must be read from disk as text, or this rail checks nothing').toBeGreaterThan(10_000);
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

    const box = bare.match(/\.symgrid\s*\{([^}]*)\}/)?.[1];
    expect(box, 'a .symgrid rule must exist (#299)').toBeTruthy();
    expect(box, '.symgrid is sized by a clamp() on the width, so a 6-wide picture still fits a phone (design-language §2)')
      .toMatch(/width:\s*clamp\(/);
    expect(box, 'height stays auto, or the viewBox stops carrying the grid\'s aspect and a taller picture is squashed')
      .toMatch(/height:\s*auto/);

    const off = bare.match(/\.symgrid\s+rect\s*\{([^}]*)\}/)?.[1];
    const on = bare.match(/\.symgrid\s+rect\.on\s*\{([^}]*)\}/)?.[1];
    expect(off, 'a .symgrid rect rule must exist — the faint empty square').toBeTruthy();
    expect(on, 'a .symgrid rect.on rule must exist — without it every card is a blank grid, and a blank grid is symmetric')
      .toBeTruthy();
    const fill = (rule: string) => rule.match(/fill:\s*([^;}]+)/)?.[1].trim();
    expect(fill(off!), 'an empty square must declare a fill').toBeTruthy();
    expect(fill(on!), 'a coloured square must declare a fill').toBeTruthy();
    expect(fill(on!), 'a coloured square and an empty one must not render the same, or the picture says nothing at all')
      .not.toBe(fill(off!));

    const mirror = bare.match(/\.symgrid\s+\.mirror\s*\{([^}]*)\}/)?.[1];
    expect(mirror, 'a .symgrid .mirror rule must exist — the fold line the question is about').toBeTruthy();
    expect(mirror, 'the fold line must be stroked, or the question has nothing to point at').toMatch(/stroke:\s*[^;}]+/);
    const width = mirror!.match(/stroke-width:\s*([\d.]+)/)?.[1];
    expect(width, 'the fold line must declare a stroke-width — an SVG line has no default thickness to fall back on').toBeTruthy();
    expect(Number(width), 'a zero-width stroke draws nothing at all').toBeGreaterThan(0);
    expect(mirror, 'the fold stays dashed: it is an instruction to compare the two halves, not part of the shape')
      .toMatch(/stroke-dasharray:/);
  });
});


/**
 * #110: the opening screen's "Your name" field was the last thing on a long page — brand header, the full
 * eleven-card grid, *then* the field — and `.avatar-grid` is `repeat(auto-fill, minmax(104px, 1fr))`, so the
 * wider and taller the screen the further down it went. On a tablet it was below the fold behind every card.
 *
 * #67's wizard split (choose ninja, then name, as two separate screens) turned the ordering guarantee into a
 * stronger one: `nameScreen` never renders `.avatar-grid` at all, so there is nothing left for the field to
 * be buried under, on any viewport. This rail now holds *that* — the two screens' markup stays disjoint —
 * because indirecting them back through one shared template is exactly how the field could end up back
 * below a grid.
 *
 * `canStart` itself is tested for real in `avatar.test.ts` — this rail only checks that the screen routes
 * both the initial attribute and the live re-check through it, because a hand-rolled second copy of the rule
 * is exactly how the two drifted apart before.
 */
describe('the opening screen asks for a name where it can be seen (#110)', () => {
  const src = readFileSync(new URL('../../src/ui/avatar.ts', import.meta.url), 'utf8');
  const chooseNinjaBody = src.slice(src.indexOf('export function chooseNinjaScreen'), src.indexOf('export function nameScreen'));
  const nameScreenBody = src.slice(src.indexOf('export function nameScreen'), src.indexOf('export function changeAvatarScreen'));

  it('chooseNinjaScreen (step 1) has the avatar grid and no name field', () => {
    expect(src.length, 'avatar.ts must be read from disk as text, or this rail checks nothing').toBeGreaterThan(1_000);
    expect(chooseNinjaBody, 'the .avatar-grid must exist in step 1 (#110)').toContain('class="avatar-grid"');
    expect(chooseNinjaBody, 'step 1 must never ask for a name — nothing on it can bury the name field (#110)')
      .not.toContain('class="name-row"');
  });

  it('nameScreen (step 2) has the name field and no avatar grid to bury it under', () => {
    expect(nameScreenBody, 'the .name-row label must exist in step 2 (#110)').toContain('class="name-row"');
    expect(nameScreenBody, 'step 2 must never render the avatar grid — the whole point of splitting the wizard is that nothing competes with the name field for space (#110)')
      .not.toContain('class="avatar-grid"');
  });

  it('both the initial button state and the live re-check go through canStart', () => {
    const go = nameScreenBody.match(/<button id="go"[^>]*?\$\{([^}]*)\}/)?.[1];
    expect(go, 'the Let\'s go! button must compute its disabled state inline (#110)').toBeTruthy();
    expect(go, 'it must ask canStart, not `d.avatar` alone — an empty name used to sail through')
      .toMatch(/canStart\(/);
    expect(nameScreenBody, 'and the name input must re-check on every keystroke, or the button never enables (#110)')
      .toMatch(/#name[\s\S]*?addEventListener\('input'|addEventListener\('input'[\s\S]*?sync/);
  });

  // #424: the wizard's own `save({ name: nameEl.value.trim() })` was the one write path with no length bound
  // at all — `maxlength` is a browser courtesy a paste or an autofill walks past. `cleanName()` is the shared
  // clamp `renameProfile` and Restore both apply; a bare `.trim()` here is the bug coming back. This is a
  // text rail: it cannot see a `cleanName` that itself stopped truncating — `storage.test.ts`'s `#424` test
  // covers that behaviourally.
  it('the #go click handler saves through cleanName, not a bare .trim() (#424)', () => {
    const go = nameScreenBody.match(/\$\('#go'\)\.addEventListener\('click',[\s\S]*?\}\);/)?.[0];
    expect(go, "the #go click handler must exist in nameScreen's body").toBeTruthy();
    expect(go, 'it must clamp through cleanName(), the one home of the NAME_MAX rule').toMatch(/cleanName\(nameEl\.value\)/);
    expect(go, 'a bare .trim() with no cleanName call is the #424 bug').not.toMatch(/name:\s*nameEl\.value\.trim\(\)/);
  });
});


/**
 * #67 acceptance: "progress is obvious to a child" — all three first-run wizard steps must actually call
 * `wizardProgress()`, not just define it. A helper nobody renders is not progress being obvious to anyone.
 */
describe('the first-run wizard shows its progress rail on every step (#67)', () => {
  const src = readFileSync(new URL('../../src/ui/avatar.ts', import.meta.url), 'utf8');

  it('chooseNinjaScreen (step 1) renders wizardProgress(1, 3)', () => {
    const chooseNinjaBody = src.slice(src.indexOf('export function chooseNinjaScreen'), src.indexOf('export function nameScreen'));
    expect(chooseNinjaBody).toMatch(/\$\{wizardProgress\(1,\s*3\)\}/);
  });

  it('nameScreen (step 2) renders wizardProgress(2, 3)', () => {
    const nameScreenBody = src.slice(src.indexOf('export function nameScreen'), src.indexOf('export function changeAvatarScreen'));
    expect(nameScreenBody).toMatch(/\$\{wizardProgress\(2,\s*3\)\}/);
  });

  it('introScreen (step 3) renders wizardProgress(3, 3)', () => {
    const introScreenBody = src.slice(src.indexOf('export function introScreen'));
    expect(introScreenBody).toMatch(/\$\{wizardProgress\(3,\s*3\)\}/);
  });

  it('changeAvatarScreen (returning players, not the wizard) shows no progress rail', () => {
    const changeScreenBody = src.slice(src.indexOf('export function changeAvatarScreen'), src.indexOf('export function introScreen'));
    expect(changeScreenBody.length, 'changeAvatarScreen must be found before introScreen, or this rail checks nothing').toBeGreaterThan(100);
    expect(changeScreenBody, 'a returning player is not mid-wizard — no step rail to show them').not.toMatch(/wizardProgress/);
  });
});


/**
 * #15 Part A — the two ways offline support ships broken without anything going red.
 *
 * These are TEXT rails and they say so: the behaviour is covered in `tests/unit/pwa.test.ts` and in the
 * `offline (#15)` e2e test. What text can catch, and behaviour cannot, is somebody quietly reintroducing the
 * shape of the mistake — a filename written into the worker by hand, or the build step that generates it
 * dropped from `npm run build` so the worker silently stops being regenerated.
 */
describe('offline support cannot go stale on its own (#15)', () => {
  const script = (name: string) => readFileSync(new URL(`../../scripts/${name}`, import.meta.url), 'utf8');
  const root = (name: string) => readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');

  it('reads the files it claims to check', () => {                    // a vacuous rail is worse than none
    expect(script('sw-template.js').length).toBeGreaterThan(500);
    expect(script('build-sw.mjs').length).toBeGreaterThan(500);
  });

  // The classic way a hand-rolled service worker ships broken: someone pastes today's hashed filename into
  // the worker "just for now". It works until the next build, then serves an index.html asking offline for
  // an asset nobody has — a blank sky that a reload cannot cure.
  it('the worker template names no build asset — the precache list is generated', () => {
    const t = script('sw-template.js');
    expect(t, 'the precache list must still be a placeholder').toContain('__PRECACHE__');
    expect(t, 'and the cache name must be derived from it').toContain('__CACHE_NAME__');
    expect(code(t), 'a hashed filename in the template is a list written by hand').not.toMatch(/assets\/index-/);
    expect(code(t), 'and so is a .webp path').not.toMatch(/avatars\/\w+\.webp/);
  });

  // If the generator stops running, `dist/` keeps the PREVIOUS deployment's sw.js — or none at all — and
  // every check above still passes.
  it('the build regenerates the worker every time', () => {
    expect(pkg.scripts.build, '`npm run build` must run the generator after vite').toMatch(/vite build.*build-sw\.mjs/);
    expect(root('.gitignore'), 'dist/ is a build output; a committed sw.js would be served stale').toMatch(/^dist$/m);
  });

  // The single-file page is hosted on an origin that is not ours and has no sw.js beside it. `src/pwa.ts`
  // gates registration on the manifest link, so the bundler removing that link is the other half of one
  // mechanism — and the two halves live in different files, which is exactly how they drift apart.
  it('the single-file build strips the switch that turns the worker on', () => {
    // Asserted on what the bundler PRODUCES, given the real `index.html`, rather than on its source text: a
    // rail reading the source is red on a harmless refactor and green if the regex stops matching the file it
    // is meant to strip. (Raised in review of #214.)
    const head = root('index.html').match(/<head>([\s\S]*?)<\/head>/)![1];
    expect(head, 'index.html must carry the link, or nothing registers anywhere').toMatch(/<link rel="manifest"/);
    expect(stripHead(head), 'and the single-file page must not').not.toMatch(/<link rel="manifest"/);
    expect(SOURCES['/src/pwa.ts'] ?? '', 'pwa.ts is the half that reads it').toContain('link[rel="manifest"]');
    // The other half of the same mechanism: strip the link but keep the rest of the head.
    expect(stripHead(head), 'the theme colour still has to survive').toMatch(/<meta name="theme-color"/);
  });

  // #15 Part B added a second head link that points at a file, and the single-file page ships alone. The
  // rule this states is the general one the manifest case is an instance of: after stripping, the page
  // references nothing it has not inlined. Asserted on the OUTPUT, for the reason the rail above gives.
  it('the single-file page asks nobody else for our icons', () => {
    const head = root('index.html').match(/<head>([\s\S]*?)<\/head>/)![1];
    expect(head, 'index.html must carry the Apple icon, or the iOS home screen is a screenshot')
      .toMatch(/<link rel="apple-touch-icon"/);
    // A reference, not the spelling: the comment above the link says the word `icons/` too, and a rail that
    // could not tell a comment from an `href` would be red on the explanation of why it is green.
    expect(stripHead(head), 'the inlined page has no icons/ beside it, wherever it is hosted')
      .not.toMatch(/(?:href|src)="icons\//);
    // The data-URI favicon is inlined already and must survive: it is the only mark the single page has.
    expect(stripHead(head), 'the inline favicon is not a file and must stay').toMatch(/<link rel="icon" href="data:/);
  });

  // `stripHead` has four replacements; only the manifest and Apple-icon links (above) had a test (#116 item
  // 4). These two fabricate the shapes Vite's own build injects — an empty `<script src="…">` and the built
  // stylesheet link — since the source `index.html` this file otherwise reads has neither: both appear only
  // in `dist/index.html`, after `vite build`.
  it("strips the built page's own module script tag, so the single-file page does not run the app twice", () => {
    const head = '<title>t</title>\n<script type="module" crossorigin src="/assets/index-ABC123.js"></script>';
    expect(stripHead(head)).not.toMatch(/<script/);
    expect(stripHead(head)).toContain('<title>t</title>');
  });

  it('strips the built stylesheet link, leaving the rest of the head alone', () => {
    const head = '<title>t</title>\n<link rel="stylesheet" crossorigin href="/assets/index-ABC123.css">';
    expect(stripHead(head)).not.toMatch(/<link rel="stylesheet"/);
    expect(stripHead(head)).toContain('<title>t</title>');
  });

  // No `vite-plugin-pwa`, no `workbox-*`: #15's acceptance criteria rule them out and the dependency
  // allow-list rail would fail them anyway. This states the intent next to the feature that would want them.
  it('offline support added no dependency', () => {
    const deps = Object.keys({ ...pkg.devDependencies, ...(pkg as { dependencies?: object }).dependencies ?? {} });
    expect(deps.filter(d => /pwa|workbox|service-worker/i.test(d))).toEqual([]);
  });
});


/*
 * #205 — the certificate button must never resolve to a no-op.
 *
 * The owner pressed it on the Android tablet and nothing happened: no share sheet, no picture, no error.
 * `deliverCertificate`'s own contract says it "never silently does nothing", and the route it picked was
 * `<a download>` — which a stock Android WebView swallows without a word, because it has no download
 * handler. The bug was not a missing feature; it was a fallback that assumed a capability it never checked.
 *
 * So the rail is about the shape of the fallback rather than about Android: `<a download>` is reachable
 * from exactly ONE place in the file, and that place rules out the runtime that cannot honour it. A second
 * call site is how the first version of this fix still lost — `deliverCertificate`'s cancelled-share path
 * stepped down past the check straight into `triggerDownload`.
 *
 * **What this block does NOT do, stated plainly so the next reader does not stop looking.** These are text
 * checks over the source. They catch a verbatim revert cheaply, and they are blind to every mutation that
 * keeps the text while changing the behaviour — severing the detector (`const nativeShell = false`), the
 * same severing behind a helper, inlining the anchor so the identifier never appears, or dropping the call
 * to `lastResort()`. All four were demonstrated green against this block alone. The thing that actually
 * enforces the contract is `describe('deliverCertificate, actually run (#205)')` in
 * `tests/unit/certificate.test.ts`, which runs the function against stubbed globals and kills all four.
 * These rails are the cheap half of the pair, not the guarantee.
 *
 * Prove it red: call `triggerDownload` from a second place, or drop the `nativeShell` check in front of it.
 */
describe('`<a download>` stays reachable from one guarded place in the certificate (#205)', () => {
  const cert = SOURCES['/src/ui/certificate.ts'] ?? '';

  it('reads the file it claims to check', () => {
    expect(cert.length, 'an empty read would make every rail below pass vacuously').toBeGreaterThan(2000);
    expect(code(cert)).toContain('function triggerDownload');
  });

  it('only ever reaches `<a download>` from one place, so one check can rule out one runtime', () => {
    const calls = [...code(cert).matchAll(/(?<!function )\btriggerDownload\s*\(/g)];
    expect(calls.length, 'a second call site walks past the nativeShell check — that is how #205 happened')
      .toBe(1);
  });

  it('rules out the native shell immediately before that call, and CALLS the view', () => {
    // `showCertificateFullscreen` alone used to satisfy this — the identifier, not a call. Dropping the
    // parentheses is tsc-clean and left the whole suite green while the tablet button did nothing again:
    // the rail protecting the guard accepted the bug the guard exists to prevent. `\(` is the fix, and
    // the behavioural assertion in certificate.test.ts ("the child must actually SEE the certificate")
    // is what catches the spellings no text rail can — `void view;`, `if (Math.random() < 0) …`.
    expect(code(cert), 'the last resort must SHOW the certificate, not merely name the function')
      .toMatch(/if\s*\(\s*nativeShell\s*\)\s*\{[^}]*showCertificateFullscreen\s*\([^}]*\}\s*triggerDownload/);
  });

  it('and certRoute itself never sends a native shell to a download', () => {
    expect(code(cert), 'certRoute must answer `show` for a native shell before it answers `download`')
      .toMatch(/if\s*\(\s*caps\.nativeShell\s*\)\s*return\s*'show'\s*;[\s\S]{0,40}return\s*'download'/);
  });
});

/*
 * #18 slice 2, group A. The DOM-screen width cap moved off the 820 px phone column on wide viewports, and
 * the only behavioural check on it lives in `tests/e2e/viewport.spec.ts` — which the `mobile` and `desktop`
 * projects skip, so it runs on the nightly and never on a pull request (`.claude/rules/e2e.md`). A revert
 * or a stray `max-width` on `.screen` would therefore ship green and be found a day later, on a screen the
 * audit spent a whole slice measuring.
 *
 * This rail is the pull-request-time half: it reads the stylesheet as text and holds the three decisions
 * that make the fix what it is, not the pixel values the e2e file owns. Widening `.play` or `.memory` is
 * `owner-approval` work (the arena cap and the card grid change the look and how far a thumb travels), so
 * the exclusion is part of the rule, not a detail — dropping it is how an unapproved look change would
 * arrive without anyone deciding to make one.
 */
describe('the landscape screen width cannot silently return to the phone column (#18)', () => {
  const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

  it('a wide-viewport media query widens .screen, and excludes .play and .memory', () => {
    expect(css.length, 'style.css must be read from disk as text, or this rail checks nothing').toBeGreaterThan(10_000);

    const block = bare.match(/@media\s*\(min-width:\s*900px\)\s*\{\s*\.screen:not\(\.play\):not\(\.memory\)\s*\{([^}]*)\}/);
    expect(block, 'the #18 rule must stay a min-width: 900px block over .screen:not(.play):not(.memory)').toBeTruthy();
    expect(block![1], 'the widened cap must still be a max-width, and must not be the 820 px phone column')
      .toMatch(/max-width:\s*min\(\s*\d{3,4}px\s*,/);
    expect(block![1], 'the widened cap must be bigger than the 820 px column it replaces')
      .not.toMatch(/max-width:\s*min\(\s*(?:[0-7]?\d{1,2}|8[01]\d|820)px/);
  });

  it('the base .screen rule still carries the phone column for narrow viewports', () => {
    const base = bare.match(/(?:^|[}\s])\.screen\s*\{([^}]*)\}/)?.[1];
    expect(base, 'the base .screen rule must exist').toBeTruthy();
    expect(base, 'a phone and a portrait tablet keep the 820 px column — the audit found both clean')
      .toMatch(/max-width:\s*820px/);
  });
});

/*
 * #18 slice 2, group A — the tracing pad, group A's second look-changing cap. Same shape as the rail
 * above and for the same reason: the only behavioural check is `tests/e2e/viewport.spec.ts`, which the
 * `mobile`/`desktop` projects a pull request runs skip entirely (`.claude/rules/e2e.md`), so a revert here
 * would ship green.
 *
 * The rail holds two things a revert or a careless edit could break independently: the tracing pad widens
 * past 560 px on a wide viewport, and the BASE `--arena-w` declaration (mobile default, and the value the
 * bubble arena keeps under 900 px, and under `.duel-screen` at every width — the follow-up rail below
 * covers the arena's own ≥900 px widening) stays at exactly 600 px.
 */
describe('the tracing pad cannot silently return to the phone column, and the fix cannot silently reach the arena (#18)', () => {
  const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

  it('a wide-viewport media query widens .play.tracing .hud and .trace-wrap to close to 880px, not merely past 560px', () => {
    const block = bare.match(/@media\s*\(min-width:\s*900px\)\s*\{\s*\.play\.tracing\s*\.hud,\s*\.play\.tracing\s*\.trace-wrap\s*\{([^}]*)\}/);
    expect(block, 'the #18 group A tracing rule must stay a min-width: 900px block over .play.tracing .hud, .play.tracing .trace-wrap').toBeTruthy();
    const cap = block![1].match(/max-width:\s*min\(\s*(\d{3,4})px\s*,/);
    // #534 review (pr-test-analyzer): a bound that only ruled out `<= 560px` still passed a hand-edit down to
    // 600px — barely more than the old phone column and nowhere near the 880px this PR ships and measures in
    // its own body. A range around 880 catches that regression while still allowing a genuine future retune.
    expect(cap, 'the widened cap must still be a max-width: min(NNNpx, ...)').toBeTruthy();
    expect(Number(cap![1]), 'the widened cap must stay close to the shipped 880px, not merely wider than 560px')
      .toBeGreaterThanOrEqual(850);
    expect(Number(cap![1]), 'the widened cap must stay close to the shipped 880px, not merely wider than 560px')
      .toBeLessThanOrEqual(920);
  });

  it('the base .play rule still declares --arena-w at exactly 600px', () => {
    const play = bare.match(/(?:^|[}\s])\.play\s*\{([^}]*)\}/)?.[1];
    expect(play, 'the base .play rule must exist').toBeTruthy();
    expect(play, 'the mobile default, and the value duel and the sub-900px arena keep, is 600 px')
      .toMatch(/--arena-w:\s*600px/);
  });
});

/*
 * #18 slice 2, group A — the bubble arena, group A's third and last look-changing cap. Same shape as the
 * two rails above: the only behavioural check is `tests/e2e/viewport.spec.ts`, skipped by the `mobile`/
 * `desktop` projects a pull request runs, so a revert here would ship green too.
 *
 * The rail holds three things a revert or a careless edit could break independently: the widening rule
 * targets the single-player arena and no other screen, its value is close to the shipped 880 px rather
 * than a token amount past 600, and duel — which reads the same `--arena-w` variable for its own,
 * unrelated width maths (`tests/e2e/duel.spec.ts`'s "a half is half the screen, capped at --arena-w") —
 * is excluded by selector, not merely by accident of specificity.
 */
describe('the bubble arena cannot silently return to the phone column, and the fix cannot silently reach duel or tracing (#18)', () => {
  const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

  it('a wide-viewport media query widens --arena-w on the single-player arena to close to 880px, not merely past 600px', () => {
    const block = bare.match(/@media\s*\(min-width:\s*900px\)\s*\{\s*\.play:not\(\.tracing\):not\(\.duel-screen\)\s*\{([^}]*)\}/);
    expect(block, 'the #18 group A arena rule must stay a min-width: 900px block over .play:not(.tracing):not(.duel-screen)').toBeTruthy();
    const cap = block![1].match(/--arena-w:\s*min\(\s*(\d{3,4})px\s*,/);
    expect(cap, 'the widened value must still be --arena-w: min(NNNpx, ...)').toBeTruthy();
    expect(Number(cap![1]), 'the widened value must stay close to the shipped 880px, not merely wider than 600px')
      .toBeGreaterThanOrEqual(850);
    expect(Number(cap![1]), 'the widened value must stay close to the shipped 880px, not merely wider than 600px')
      .toBeLessThanOrEqual(920);
  });

  it('the arena-widening rule excludes .duel-screen by selector, not merely by the base rule losing a specificity tie', () => {
    // Anchored on the DECLARATION, not on the selector text itself — a match that already required
    // `:not(.duel-screen)` to exist would make the assertion below pass whenever the match succeeded at all,
    // proving nothing a dropped exclusion wouldn't also let through. This finds whichever `.play`-rooted
    // selector sets the widened `--arena-w` inside a >=900px block, then reads ITS selector separately.
    const block = bare.match(/@media\s*\(min-width:\s*900px\)\s*\{\s*(\.play[^{]*)\{\s*--arena-w:\s*min\(/);
    expect(block, 'a >=900px block must set --arena-w: min(...) on a .play-rooted selector').toBeTruthy();
    // a selector that dropped :not(.duel-screen) would still beat the base .play rule on specificity, so a
    // careless simplification would ship green on every rail above and only show up in duel.spec.ts's own
    // 600px pin — which a pull request's mobile-only CI project may not even run against a duel change.
    expect(block![1], "duel must be excluded from the widening rule's own selector").toMatch(/:not\(\.duel-screen\)/);
  });
});

/*
 * #399: `--sal`/`--sar` were read at `.cert-view` (`var(--sal, 0px)`/`var(--sar, 0px)`) but never declared
 * beside `--sat`/`--sab` in `:root` — an undefined custom property with no fallback in the `var()` that
 * reads it is invalid at computed-value time and falls back to nothing at all, silently. Neither Playwright
 * project emulated safe-area insets at the time this rail was written (`env()` resolved to its fallback in
 * both, since nothing injected a real one), so no viewport-level e2e check could catch this class at all —
 * this was the cheap, exhaustive complement: every `var(--x…)` in
 * `style.css` names a property declared somewhere, in either the stylesheet (a `:root`/rule declaration) or
 * a `.ts` source's own inline `style="--x:…"` (`--focus`/`--cols`/`--tint`/the confetti particles' `--i`/
 * `--x`/`--d`/`--c` and the shop trail swatch's `--c`/`--k` are all set that way, never in CSS, so the
 * search has to cover both or it reports its own five real properties as five false positives).
 *
 * Comments are stripped from the CSS first — this file's own doc-comments quote `env()`/`var()` syntax by
 * name, which would otherwise read as a declaration of whatever property the prose happens to mention. The
 * `.ts` half is narrowed to `style="…"` attribute values for the same reason one level up: scanning a whole
 * source file for `--word:` would also match the shape inside an unrelated string or comment (review note,
 * PR #399) — the declaration only really exists if it sits inside a `style` attribute a browser reads.
 *
 * The "no viewport-level e2e check can catch this class" half is no longer true for three of the four sites
 * (`.hud`/`.play.duel-screen`/`.villain`, not `.cert-view` yet): `tests/e2e/viewport.ts`'s
 * `overrideSafeAreaInsets` drives Chromium's own `Emulation.setSafeAreaInsetsOverride` over CDP, and
 * `viewport.spec.ts`'s "a real safe-area inset becomes real padding" tests read the real computed padding
 * back. This rail and its siblings below stay as they are regardless — they still run at pull-request time
 * with no browser at all, and they are the only check left for `.cert-view`.
 */
it('every CSS custom property style.css reads with var() is declared somewhere — in the stylesheet or a .ts inline style (#399)', () => {
  const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');
  expect(css.length, 'style.css must be read from disk as text, or this rail checks nothing').toBeGreaterThan(10_000);
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

  const referenced = new Set([...bare.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]));
  expect(referenced.size, 'style.css must reference at least one custom property, or this rail checks nothing')
    .toBeGreaterThan(10);
  const declared = new Set([...bare.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

  const styleAttrs = [...inDir('/src')].flatMap(([, src]) => [...code(src).matchAll(/\bstyle="([^"]*)"/g)]);
  expect(styleAttrs.length, 'src/**/*.ts must set at least one inline style="…", or this half checks nothing')
    .toBeGreaterThan(0);
  for (const [, attr] of styleAttrs)
    for (const m of attr.matchAll(/(--[\w-]+)\s*:/g)) declared.add(m[1]);

  const undeclared = [...referenced].filter((name) => !declared.has(name)).sort();
  expect(undeclared, 'a var() naming a property nothing declares resolves to its fallback (or nothing, with '
    + 'none) silently — no console warning, nothing failing (#399)').toEqual([]);
});

/*
 * #399's own next slice: `.hud` (shared by the bubble arena and the tracing pad, `.trace-wrap` sitting
 * inside it) and `.play.duel-screen` (landscape) both reach the true screen edge once the viewport is
 * narrower than `--arena-w` — a notched phone on its side is exactly that case — and both used a fixed
 * left/right number with no `--sal`/`--sar` at all, the same silent-zero shape #530 already fixed for
 * `.screen`. At the time this rail was written neither Playwright project emulated safe-area insets, so
 * nothing here was reachable from the e2e suite (`.claude/rules/e2e.md`'s own reason the sibling rail above
 * is text-only); this is the pull-request-time half, same as the #18 rail above it. Both sites now ALSO
 * have a real e2e check — `tests/e2e/viewport.spec.ts`'s "a real safe-area inset becomes real padding"
 * describe, driving Chromium's `Emulation.setSafeAreaInsetsOverride` over CDP — but that only runs on the
 * nightly full matrix, same as everything else in that file, so this text-only pair stays as the
 * pull-request-time check.
 */
describe('.hud and the duel screen use --sal/--sar too, not just a fixed number (#399)', () => {
  const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

  it('.hud pads left/right by --sal/--sar, not a bare 12px — the tracing pad inherits it, nested inside', () => {
    const block = bare.match(/(?:^|[}\s])\.hud\s*\{([^}]*)\}/)?.[1];
    expect(block, 'the base .hud rule must exist').toBeTruthy();
    // Positional, not just "appears somewhere in the shorthand": the 4-value list is top/right/bottom/left,
    // so a transposed pair (--sar on the left, --sal on the right) insets away from the wrong edge on a real
    // notched phone — nothing else here could catch that, since env() is always 0 under Playwright (review
    // finding, both the silent-failure-hunter and pr-test-analyzer agents flagged the presence-only version).
    expect(block, 'the shorthand must read top(--sat) right(--sar) bottom(0) left(--sal), in that order')
      .toMatch(/padding:\s*calc\([^)]*var\(--sat\)[^)]*\)\s+calc\([^)]*var\(--sar\)[^)]*\)\s+0\s+calc\([^)]*var\(--sal\)[^)]*\)/);
  });

  it('the landscape duel screen insets the arena PAIR by --sal/--sar, never a .duel-half on its own', () => {
    const block = bare.match(/\.play\.duel-screen\s*\{([^}]*)\}/)?.[1];
    expect(block, 'the .play.duel-screen landscape rule must exist').toBeTruthy();
    expect(block, 'padding-left must read --sal').toMatch(/padding-left:\s*var\(--sal\)/);
    expect(block, 'padding-right must read --sar').toMatch(/padding-right:\s*var\(--sar\)/);
    // A per-half inset would put unequal padding on two boxes the centred-divider assertion in
    // tests/e2e/duel.spec.ts compares directly — the issue's own reason to inset the pair instead. Every
    // `.duel-half { ... }` block, not just the first: a non-global match here would miss the landscape
    // override two rules below the one this test itself patches (pr-test-analyzer review finding) — exactly
    // where a wrong per-half inset would actually land.
    const halfBlocks = [...bare.matchAll(/(?:^|[}\s])\.duel-half\s*\{([^}]*)\}/g)].map((m) => m[1]);
    expect(halfBlocks.length, '.duel-half must still be declared somewhere, or this checks nothing').toBeGreaterThan(0);
    for (const halfBlock of halfBlocks)
      expect(halfBlock, '.duel-half itself must never carry --sal/--sar — that is the per-half shape #399 rejected')
        .not.toMatch(/--sa[lr]/);
  });

  // #399's own last miss: `.villain` is `position: absolute` inside `.hud`, and an absolutely positioned
  // child's own offsets are measured from its containing block's PADDING edge — the padding `.hud` itself
  // carries does not shift them. `bottom` already read `--sab` (correct by the same containing-block rule,
  // since `.hud`'s bottom padding is 0 and so never masked the gap); `right` stayed a bare 10px and so sat
  // flush with the true screen edge on a landscape notched phone, the exact silent-zero shape this issue is
  // for. Text-only, like the sibling rail above, and for the same pull-request-time reason — a real e2e
  // check now exists too, in the "a real safe-area inset becomes real padding" describe in viewport.spec.ts.
  it('.villain reads --sar on its right offset, not a bare 10px', () => {
    const block = bare.match(/(?:^|[}\s])\.villain\s*\{([^}]*)\}/)?.[1];
    expect(block, 'the base .villain rule must exist').toBeTruthy();
    expect(block, 'right must read calc(10px + var(--sar))').toMatch(/right:\s*calc\([^)]*var\(--sar\)[^)]*\)/);
    expect(block, 'bottom must still read var(--sab), unshifted by this change').toMatch(/bottom:\s*calc\([^)]*var\(--sab\)[^)]*\)/);
  });
});


/**
 * #392: docs/CURRICULUM.md said Year 2 was "8 q/stage" while `YEARS` (src/curriculum/types.ts) has always
 * played 7 — the play screen's own progress pips show 1/7 on a Year 2 mission, so the game and the doc
 * contradicted each other where a parent can see both. That was one number on one line, caught only by a
 * reviewer reading both sides; this rail reads docs/CURRICULUM.md itself and holds each year's "N q/stage"
 * and "N lives" header text to the `YEARS` entry it describes, so the next `perStage`/`lives` change cannot
 * leave the doc behind the way this one did.
 */
describe('docs/CURRICULUM.md\'s per-year headers match YEARS (#392)', () => {
  const doc = readFileSync(new URL('../../docs/CURRICULUM.md', import.meta.url), 'utf8');

  for (const year of YEARS) {
    it(`${year.title}'s header states ${year.perStage} q/stage and ${year.lives} lives`, () => {
      const header = doc.split('\n').find((line) => line.startsWith(`## ${year.title}`));
      expect(header, `docs/CURRICULUM.md must have a "## ${year.title}" header`).toBeTruthy();

      const stageMatch = header!.match(/(\d+)\s+q\/stage/);
      expect(stageMatch, `${year.title}'s header must state its questions-per-stage as "N q/stage"`).toBeTruthy();
      expect(Number(stageMatch![1]), `docs/CURRICULUM.md's ${year.title} q/stage must match YEARS.perStage (#392)`)
        .toBe(year.perStage);

      const livesMatch = header!.match(/(\d+)\s+lives/);
      expect(livesMatch, `${year.title}'s header must state its lives as "N lives"`).toBeTruthy();
      expect(Number(livesMatch![1]), `docs/CURRICULUM.md's ${year.title} lives must match YEARS.lives (#392)`)
        .toBe(year.lives);
    });
  }
});

/*
 * #714 — three.js stays inside its own tree, behind the flag, and out of the main chunk (epic #713 decisions
 * 2 and 3; `.claude/rules/three.md` is the rule's home). The module-graph rails read specifiers and RESOLVE
 * them from the importing file's directory, the way the bundler does, rather than matching spellings — every
 * spelling of a path is the same edge. The chunk rails run a real `vite build` twice, because the module
 * graph is a claim about the source and the chunk is what a child's tablet downloads.
 */
describe('three.js: the src/three/ tree, the flag and the bundle (#714)', () => {
  const THREE_DIR = '/src/three/', MOUNT_DIR = '/src/three/mount/', OBJECTS_DIR = '/src/three/objects/';
  interface Edge { from: string; spec: string; to: string; kind: 'static' | 'type' | 'dynamic' | 'require' }
  /** What a string literal can hide — `\uXXXX`, `\u{…}`, `\xXX`, `\<char>` — undone, so the reader sees what TypeScript sees. */
  const decode = (s: string) => s.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})|\\(.)/g,
    (_, brace, u4, x2, ch) => brace ? String.fromCodePoint(parseInt(brace, 16)) : u4 ? String.fromCharCode(parseInt(u4, 16)) : x2 ? String.fromCharCode(parseInt(x2, 16)) : ch);
  /** Every literal import edge out of `path`: the specifier as written, and where it resolves to. */
  const edges = (path: string, src: string): Edge[] => {
    const c = code(src), out: Edge[] = [];
    // Resolve the DECODED string, not the source text between the quotes: `'..\u002fthree\u002fstage'` is
    // `../three/stage` to TypeScript (PR #710 round 3, the same class), so a literal's escapes are undone first.
    const to = (raw: string) => { const spec = decode(raw); return spec.startsWith('.') ? posix.resolve(posix.dirname(path), spec) : spec; };
    for (const m of c.matchAll(/(typeof\s*)?\bimport\s*\(\s*['"`]([^'"`\n]+)['"`]\s*\)/g)) out.push({ from: path, spec: m[2], to: to(m[2]), kind: m[1] ? 'type' : 'dynamic' });   // `typeof import('x')` is a type position, erased like `import type`
    for (const m of c.matchAll(/\b(?:import|export)\s+(type\s+)?(?:[^;'"`(]*?\bfrom\s*)?['"`]([^'"`\n]+)['"`]/g)) out.push({ from: path, spec: m[2], to: to(m[2]), kind: m[1] ? 'type' : 'static' });
    for (const m of c.matchAll(/\brequire\s*\(\s*['"`]([^'"`\n]+)['"`]\s*\)/g)) out.push({ from: path, spec: m[1], to: to(m[1]), kind: 'require' });
    // `import.meta.glob('../three/stage/*.ts')` is an import Vite resolves and bundles too (pr-test-analyzer).
    for (const m of c.matchAll(/\bimport\.meta\.glob\s*\(\s*['"`]([^'"`\n]+)['"`]/g)) out.push({ from: path, spec: m[1], to: to(m[1]), kind: 'static' });
    return out;
  };
  const all = Object.entries(SOURCES).flatMap(([p, s]) => edges(p, s));
  const isThree = (spec: string) => spec === 'three' || spec.startsWith('three/');

  it('the edge reader resolves every spelling of a path to one module, and sees the four kinds of import', () => {
    const src = "import { a } from '../ui/dom'; import type { B } from './../ui/x'; import('../../src/ui/lazy'); export { c } from '/src/ui/abs'; const r = require('three'); type T = typeof import('./../ui/t'); const g = import.meta.glob('../three/stage/*.ts');";
    expect(edges('/src/game/f.ts', src)).toEqual([
      { from: '/src/game/f.ts', spec: '../../src/ui/lazy', to: '/src/ui/lazy', kind: 'dynamic' },
      { from: '/src/game/f.ts', spec: './../ui/t', to: '/src/ui/t', kind: 'type' },
      { from: '/src/game/f.ts', spec: '../ui/dom', to: '/src/ui/dom', kind: 'static' },
      { from: '/src/game/f.ts', spec: './../ui/x', to: '/src/ui/x', kind: 'type' },
      { from: '/src/game/f.ts', spec: '/src/ui/abs', to: '/src/ui/abs', kind: 'static' },
      { from: '/src/game/f.ts', spec: 'three', to: 'three', kind: 'require' },
      { from: '/src/game/f.ts', spec: '../three/stage/*.ts', to: '/src/three/stage/*.ts', kind: 'static' },
    ]);
    expect(all.length, 'the reader must see the real tree').toBeGreaterThan(100);
    expect(edges('/src/ui/x.ts', "import { a } from '..\\u002fthree\\u002fstage\\x2frig';")[0].to, 'escapes are decoded before resolving').toBe('/src/three/stage/rig');
  });

  // (a) Proved red: `import { Color } from 'three'` in a scratch `src/ui/x.ts` fails.
  it('three is imported only under src/three/', () => {
    const importers = [...new Set(all.filter(e => isThree(e.spec)).map(e => e.from))].sort();
    expect(importers.length, 'nothing imports three at all — the rail would be vacuous').toBeGreaterThan(0);
    expect(importers, 'the spike renderer is the one three importer the game reaches today').toContain('/src/three/mount/solids.ts');
    expect(importers.filter(f => !f.startsWith(THREE_DIR)), 'three is imported outside src/three/').toEqual([]);
  });

  // (b) Proved red: a static `import { SolidView } from '../three/mount/solids'` in src/ui/solid.ts fails, and so
  // does `import('../three/stage/rig')` from a scratch file under src/ui/.
  it('src/ outside the tree reaches src/three/ only through src/three/mount/, and only by a dynamic import()', () => {
    const inbound = all.filter(e => !e.from.startsWith(THREE_DIR) && e.to.startsWith(THREE_DIR) && e.kind !== 'type');
    const bad = inbound.filter(e => e.kind !== 'dynamic' || !e.to.startsWith(MOUNT_DIR));
    expect(bad, 'a static import pulls three into the main chunk; a reach past mount/ bypasses the flag').toEqual([]);
    // #684: the loader asks the flag (`enabled`, a small chunk with no three.js) before it downloads the solids.
    expect(inbound.map(e => `${e.from} → ${e.to}`).sort(), 'the one lazy loader today (#684), and the flag it asks first').toEqual(['/src/ui/solid.ts → /src/three/mount/enabled', '/src/ui/solid.ts → /src/three/mount/solids']);
  });

  // (c) Proved red: `import { $ } from '../../ui/dom'` in src/three/stage/rig.ts fails. Stronger than the epic's
  // "objects and stage never import src/ui or src/game" because scripts/bundle-single.mjs needs it: every module
  // under src/three/ is reached lazily and becomes its own chunk, and a chunk that imports the main chunk cannot
  // be inlined as a data URL. `import type` is erased and allowed.
  it('nothing under src/three/ imports anything under src/ outside src/three/', () => {
    const out = all.filter(e => e.from.startsWith(THREE_DIR) && e.to.startsWith('/src/') && !e.to.startsWith(THREE_DIR) && e.kind !== 'type');
    expect(out.map(e => `${e.from} → ${e.spec}`)).toEqual([]);
  });

  // (c′, #715) The sketchbook is a developer page the game does not know: nothing under `src/` outside
  // `src/three/sketchbook/` may import it, by any kind of edge. Proved red: `import '../three/sketchbook/main'`
  // in a scratch `src/ui/` file fails; the fixture line keeps the reader honest about that path shape.
  it('nothing outside src/three/sketchbook/ imports the sketchbook', () => {
    const SKETCH = '/src/three/sketchbook/';
    expect(edges('/src/ui/x.ts', "import '../three/sketchbook/main';")[0]).toMatchObject({ to: '/src/three/sketchbook/main', kind: 'static' });
    const inbound = all.filter(e => !e.from.startsWith(SKETCH) && e.to.startsWith(SKETCH));
    expect(inbound.map(e => `${e.from} → ${e.spec}`)).toEqual([]);
    expect(inDir(SKETCH).length, 'the sketchbook folder must exist, or this holds nothing').toBeGreaterThan(3);
  });

  // (#715) The sketchbook spec is invisible to the game's projects only because ONE project declares its own
  // `testDir`; the #116 and #123 rails read projects by the names `mobile|desktop|tablet` and never look at it.
  // Two silent decays this holds: the `sketchbook` project loses `testDir` (it then runs the whole game suite
  // nightly at 600×600 and the shot spec runs nowhere), or the spec is "tidied" into `tests/e2e/` (every
  // pull request's mobile leg then screenshots into docs/sketchbook/).
  it('the sketchbook project alone declares a testDir, tests/sketch, and holds the shot spec', () => {
    const cfg = code(readFileSync(new URL('../../playwright.config.ts', import.meta.url), 'utf8'));
    const parts = cfg.slice(cfg.indexOf('projects:')).split(/(?=\{\s*name:\s*')/).filter(p => /^\{\s*name:\s*'/.test(p));
    const withDir = parts.filter(p => /\btestDir:/.test(p)).map(p => ({ name: p.match(/name:\s*'([^']+)'/)![1], dir: p.match(/testDir:\s*'([^']+)'/)?.[1] }));
    expect(withDir).toEqual([{ name: 'sketchbook', dir: 'tests/sketch' }]);
    const sketchSpecs = readdirSync(new URL('../../tests/sketch', import.meta.url)).filter(f => f.endsWith('.spec.ts'));
    expect(sketchSpecs.length, 'tests/sketch must hold the shot spec').toBeGreaterThan(0);
    for (const f of readdirSync(new URL('../../tests/e2e', import.meta.url)))
      expect(readFileSync(new URL(`../../tests/e2e/${f}`, import.meta.url), 'utf8'), `${f} must not import the shot script — that would put the sketchbook on every mobile leg`).not.toMatch(/sketch-shot/);
  });

  // #713 decision 5 and the owner's rule (2026-09-25): the game's e2e runs with 3-D off, stored the way a
  // grown-up stores it. Every project that is not `setup` or `sketchbook` is a game project and must start from
  // `THREE_OFF` — read from the projects, not a list here, so a new game project without it fails too. And the
  // key it stores must be the key the game reads, or the setting would be stored and never seen.
  it('every game e2e project starts with the grown-ups 3-D setting off (#713 decision 5)', () => {
    const cfg = code(readFileSync(new URL('../../playwright.config.ts', import.meta.url), 'utf8'));
    expect(cfg, 'THREE_KEY must be the key the game reads').toMatch(new RegExp(`THREE_KEY\\s*=\\s*'${THREE_SETTING_KEY}'`));
    expect(cfg, 'THREE_OFF must store THREE_KEY as off').toMatch(/name:\s*THREE_KEY,\s*value:\s*'off'/);
    const parts = cfg.slice(cfg.indexOf('projects:')).split(/(?=\{\s*name:\s*')/).filter(p => /^\{\s*name:\s*'/.test(p));
    const named = parts.map(p => ({ name: p.match(/name:\s*'([^']+)'/)![1], body: p }));
    const game = named.filter(p => p.name !== 'setup' && p.name !== 'sketchbook');
    expect(game.map(p => p.name), 'the game projects the rail reads').toEqual(expect.arrayContaining(['mobile', 'desktop']));
    for (const p of game) expect(p.body, `${p.name} must start with 3-D off`).toMatch(/storageState:\s*THREE_OFF\b/);
  });

  // (d) 250 lines is the cap, not the target (`.claude/rules/three.md`): split by part and assembly.
  it('no file under src/three/ is longer than 250 lines', () => {
    const files = inDir(THREE_DIR);
    expect(files.map(([f]) => f).sort()).toEqual(expect.arrayContaining(['/src/three/mount/enabled.ts', '/src/three/stage/rig.ts', '/src/three/objects/index.ts']));
    for (const [f, src] of files) expect(src.split('\n').length, `${f} is over the 250-line cap`).toBeLessThanOrEqual(251);
  });

  // (e) The ratchet (epic #713 decision 3): the game's largest files, at their length the day this landed, and
  // none may grow. A budget rail — a number here only ever goes DOWN (`.claude/rules/guardrails.md`). Every
  // `src/` file of 300 lines or more on 2026-09-25, counted as `wc -l` counts, newlines.
  const RATCHET: Record<string, number> = {
    'src/style.css': 1878, 'src/storage.ts': 1511, 'src/game/arena.ts': 1102, 'src/curriculum/maths.ts': 993,
    'src/curriculum/writing.ts': 701, 'src/ui/duel.ts': 508, 'src/ui/parents.ts': 451, 'src/ui/play-session.ts': 435,
    'src/game/session.ts': 395, 'src/game/duel.ts': 395, 'src/ui/play.ts': 365, 'src/ui/certificate.ts': 341, 'src/audio.ts': 311,
  };
  it.each(Object.entries(RATCHET))('%s has not grown past %i lines (#714 ratchet)', (file, cap) => {
    const text = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');   // throws if the file moved: the table cannot rot
    expect((text.match(/\n/g) ?? []).length).toBeLessThanOrEqual(cap);
  });

  // (h) The stage owns the look (decision record 010, Consequences): an object asks `stage.toon()` and
  // `stage.outline()` and never constructs a material or a light. Text rail over the objects tree; `inDir`
  // throws if the folder is missing, so an empty registry still reads its index.
  const NEW_MATERIAL = /\bnew\s+\w*Material\b/, NEW_LIGHT = /\bnew\s+\w*Light\b/;
  it('nothing under src/three/objects/ constructs a Material or a Light', () => {
    // The folder holds only its index today, so the two patterns have never matched a real file: prove them on
    // a fixture first, or a typo in either would go unnoticed until the first object lands (pr-test-analyzer).
    expect('new MeshToonMaterial({})').toMatch(NEW_MATERIAL); expect('new DirectionalLight()').toMatch(NEW_LIGHT);
    expect('stage.toon("--accent"); stage.outline(m); const light = 1;').not.toMatch(NEW_MATERIAL);
    expect('stage.toon("--accent"); stage.outline(m); const light = 1;').not.toMatch(NEW_LIGHT);
    for (const [f, src] of inDir(OBJECTS_DIR)) {
      expect(code(src), `${f}: materials come from the stage`).not.toMatch(NEW_MATERIAL);
      expect(code(src), `${f}: the rig has the only lights`).not.toMatch(NEW_LIGHT);
    }
    // And no back door: `toonMaterial(colour, 5)` or `outlineMaterial(ink, 0.2)` imported from the stage's own
    // modules would let one object choose its own tone count or width. An object reaches the stage only
    // through the `Stage` value `build` receives; a type import is all it may take from the folder.
    const back = all.filter(e => e.from.startsWith(OBJECTS_DIR) && e.to.startsWith('/src/three/stage') && e.kind !== 'type');
    expect(back.map(e => `${e.from} → ${e.spec}`), 'an object imports the stage as a value').toEqual([]);
  });

  // (i) Every registered object under its declared budget at the `high` tier (`three-art` §3), on a headless
  // stage — three.js geometry and materials need no renderer. The meter is proved on a known mesh first, so
  // an empty registry (today) cannot make the rail vacuous: a wrong meter fails here before any object lands.
  it('the budget meter counts a box with its outline as 24 triangles and 2 draw calls', () => {
    const stage = createStage('high', () => '#0d1226');
    const box = new Mesh(new BoxGeometry(1, 1, 1), stage.toon('--accent'));
    stage.outline(box);
    expect(measure(box)).toEqual({ triangles: 24, drawCalls: 2 });
  });
  it.each(OBJECTS.map(o => [o.name, o] as const))('%s is built under its declared budget at the high tier, defaults and every variant', (_, o) => {
    expect(o.budget.triangles).toBeLessThanOrEqual(BUDGET_CEILING.triangles);
    expect(o.budget.drawCalls).toBeLessThanOrEqual(BUDGET_CEILING.drawCalls);
    // The gallery renders every variant (`three-art` §4), so every variant is measured, not only the defaults —
    // and each value must sit inside its parameter's range, which `n()` guards for the default alone.
    for (const [name, p] of [['default', defaultsOf(o.params)] as const, ...Object.entries(o.variants)]) {
      expect(Object.keys(p).sort(), `variant ${name} must be a full parameter set`).toEqual(Object.keys(o.params).sort());
      for (const [k, v] of Object.entries(p)) expect(v >= o.params[k].min && v <= o.params[k].max, `${name}.${k} = ${v} is outside [${o.params[k].min}, ${o.params[k].max}]`).toBe(true);
      const m = measure(o.build(p, createStage('high', () => '#0d1226')));
      expect(m.triangles, `${name}: triangles`).toBeLessThanOrEqual(o.budget.triangles);
      expect(m.drawCalls, `${name}: draw calls`).toBeLessThanOrEqual(o.budget.drawCalls);
    }
  });

  // (f) and (g): the chunks. `__THREE__` is the global three.js's entry sets on load and `THREE.` prefixes its
  // own warnings — hundreds of them in the library, none in this code base — so a chunk carrying either is a
  // chunk carrying three. Built into a temp folder, never `dist/` (shared with the e2e preview, #136).
  describe('the built chunks', () => {
    const SIGNATURE = /__THREE__|\bTHREE\.[A-Z]\w+/;
    // `--logLevel error`, not `silent`: Vite's CLI prints a build error through its logger and exits 1, so at
    // `silent` a red run here would say only "Command failed" — in CI, where nobody can re-run it by hand.
    const build = (env: Record<string, string>) => {
      const out = mkdtempSync(join(tmpdir(), 'sna-three-'));
      try {
        execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], { env: { ...process.env, ...env }, stdio: 'pipe' });
        const html = readFileSync(join(out, 'index.html'), 'utf8');
        const entry = /<script[^>]*src="\/assets\/([^"]+\.js)"/.exec(html)?.[1];
        const chunks = readdirSync(join(out, 'assets')).filter(f => f.endsWith('.js')).map(f => ({ name: f, three: SIGNATURE.test(readFileSync(join(out, 'assets', f), 'utf8')) }));
        return { entry, chunks };
      } finally { rmSync(out, { recursive: true, force: true }); }
    };
    it('the default build keeps three.js out of the main chunk, in exactly one lazy chunk', () => {
      const { entry, chunks } = build({ VITE_THREE: '' });
      expect(entry, 'index.html must load one entry script').toBeTruthy();
      expect(chunks.filter(c => c.three).map(c => c.name.replace(/-[\w-]+\.js$/, '')), 'the signature must find the three chunk, or it proves nothing').toEqual(['solids']);
      expect(chunks.find(c => c.name === entry)?.three, 'three.js code in the main chunk').toBe(false);
    }, 60_000);
    // #715: the sketchbook is its own Vite build into `dist/sketchbook/` (vite.sketchbook.config.ts says why
    // it is not a second input of the game's build). Three things keep it out of the game: the game's
    // `index.html` references nothing of it, the service worker precaches nothing under its folder, and it
    // does carry three.js of its own — asserted, so a broken sketchbook build cannot read as "nothing leaked".
    it('the sketchbook builds beside the game and the game carries none of it', () => {
      const out = mkdtempSync(join(tmpdir(), 'sna-sketch-'));
      try {
        const vite = (args: string[]) => execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', ...args, '--logLevel', 'error'], { stdio: 'pipe' });
        vite(['--outDir', out, '--emptyOutDir']);
        vite(['-c', 'vite.sketchbook.config.ts', '--outDir', join(out, 'sketchbook'), '--emptyOutDir']);
        const files = listFiles(out);
        const sketch = files.filter(f => f.startsWith('sketchbook/'));
        expect(sketch, 'the sketchbook must have built into dist/sketchbook/').toContain('sketchbook/sketchbook.html');
        expect(sketch.some(f => f.endsWith('.js') && SIGNATURE.test(readFileSync(join(out, f), 'utf8'))), 'the sketchbook carries its own three.js').toBe(true);
        expect(readFileSync(join(out, 'index.html'), 'utf8'), 'the game page references the sketchbook').not.toMatch(/sketchbook/);
        expect(precacheList(files).filter(f => f.startsWith('sketchbook/')), 'the service worker would precache the sketchbook').toEqual([]);
        expect(precacheList(files), 'and still precaches the game').toContain('index.html');
      } finally { rmSync(out, { recursive: true, force: true }); }
    }, 90_000);
    it('a VITE_THREE=off build has no three.js chunk at all', () => {
      const { entry, chunks } = build({ VITE_THREE: 'off' });
      expect(chunks.map(c => c.name), 'the kill switch must fold the import() away, leaving only the entry').toEqual([entry]);
      expect(chunks[0].three).toBe(false);
    }, 60_000);
  });
});
