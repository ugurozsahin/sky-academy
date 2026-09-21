import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';
import { stripHead } from '../../scripts/bundle-single.mjs';
import { NOISE_SECONDS } from '../../src/audio';   // #41: the rail below holds every SFX inside the shared buffer
import { FONT_PROBE } from '../../src/ui/font';   // #44: the rail below pins the gate's probe to index.html
import { exportSave, isMigratable, load, migrate, reset, MIGRATIONS, SAVE_VERSION } from '../../src/storage';   // #205/#232: the rails below hold the migration ladder complete, one-directional, and honest about what it exports
import { SOURCES, inDir, code, workflow } from './helpers/sources';

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
    expect(arena).toMatch(/if \(!b\.hit\) this\.cb\.onFall\(b\)/);      // a tapped bubble in flight is not a miss
  });

  // CLAUDE.md: no dependencies without reason (Capacitor is the documented exception). A new one now has
  // to be argued for in the PR that adds it, because this rail goes red until the list is updated too.
  // `@capacitor/filesystem`/`@capacitor/share` (#110) are that exception again: the Android tablet's
  // `certRoute` 'capacitor' path needs the native plugins registered via `npx cap sync`, the same reason
  // `@capacitor/android`/`@capacitor/core` are here — see `shareViaCapacitor` in `src/ui/certificate.ts`,
  // which reads them off the injected `Capacitor.Plugins` bridge rather than importing either package, so
  // neither is a static or dynamic `import` anywhere in `src/` (checked below alongside the empty
  // `dependencies` list, since that only proves neither is a *runtime* dependency of the web build).
  it('dependencies match the allowlist below (CLAUDE.md explains the rule)', () => {
    const allowed = ['@capacitor/android', '@capacitor/cli', '@capacitor/core', '@capacitor/filesystem', '@capacitor/share', '@playwright/test', 'typescript', 'vite', 'vitest'];
    expect(Object.keys((pkg as { dependencies?: object }).dependencies ?? {})).toEqual([]);   // nothing but our own code ships to the browser
    expect(Object.keys((pkg as { devDependencies?: object }).devDependencies ?? {}).sort()).toEqual([...allowed].sort());
  });

  // #110: `@capacitor/filesystem`/`@capacitor/share` exist only so `npx cap sync` registers their native
  // Android code; the web bundle must never import either JS package (that would ship Capacitor's own
  // wrapper code — and the web-only build's `dist/` output — to every non-APK player). `shareViaCapacitor`
  // reads the plugins off the injected `Capacitor.Plugins` global instead, the same pattern `isNativeShell`
  // already uses for `@capacitor/core`. Proved red first: added `import '@capacitor/share'` to a scratch
  // file under `src/`, watched this fail, removed it.
  it('src/ never imports @capacitor/filesystem or @capacitor/share (#110)', () => {
    for (const [path, src] of Object.entries(SOURCES)) {
      expect(src, `${path} must read the Capacitor plugin bridge, not import the plugin package`)
        .not.toMatch(/\bimport\s*\(?[^;]*['"]@capacitor\/(filesystem|share)['"]/);
    }
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
    // Match each route's *body*, not its layout: an equivalent reformat must not turn this red (#74 review).
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
  //    `setActiveProfile` to return true would drop a child into a sibling's game on a store that refuses.
  // 4. Drawing a card never goes through `load()`/`save()` — those resolve and latch *this session's*
  //    profile, so reading a sibling's name through them would answer the wrong child or bind the session
  //    to them. `profileCard()` reads the slot key directly for that reason.
  it('the profile picker is a launch screen, gated on more than one profile (#20 slice 2)', () => {
    const main = code(SOURCES['/src/main.ts']);
    const from = main.indexOf('profiles: () =>'), to = main.indexOf('\n  up,', from);
    const drawFrom = main.indexOf('const goProfiles = () => {'), drawTo = main.indexOf('\n};', drawFrom);
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
    expect(pick, "the store is asked, and its answer is the decision's only input").toMatch(/pickOutcome\(id, setActiveProfile\(id\)\)/);
    expect(pick.match(/\bgo\(/g) ?? [], 'one call site for go(), inside the guarded handler').toHaveLength(1);
    expect(pick, 'and the child is moved with the id off the accepted arm').toMatch(/go\(o\.id\)/);
    expect(pick, 'the same shape for "New ninja": onboarding starts on the added profile').toMatch(/onNew\(o\.id\)/);
    // Both refusals are told apart on screen (#335 item 2): a picker that shows one sentence for both tells a
    // child with four siblings that their browser is broken, or the reverse.
    expect(pick).toMatch(/why === 'full'/);
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
    const drawFrom = main.indexOf('const goProfiles = () => {'), drawTo = main.indexOf('\n};', drawFrom);
    const go = main.slice(drawFrom, drawTo);
    expect(go, 'a stacked entry is popped before the picker is drawn')
      .toMatch(/if \(history\.state\?\.screen\) \{ pendingProfiles = true; history\.back\(\); return; \}/);
    expect(main, 'and the pop lands back in the one way in, so a deeper stack keeps unwinding')
      .toMatch(/if \(pendingProfiles\) \{ pendingProfiles = false; goProfiles\(\); return; \}/);
    expect(main, 'boot takes that same way in, so a reload cannot draw the launch picker on a stacked entry')
      .toMatch(/length > 1\) goProfiles\(\);/);
    expect(main.match(/profilesScreen\(/g) ?? [], 'which is the one place the picker is drawn').toHaveLength(1);
    expect(go, 'and launch-or-back is read off what is on the page, never passed in by the caller')
      .toMatch(/screenDrawn\(\) \? \(\) => nav\.map\(\) : undefined/);
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
    expect(card, 'the card applies the same gate migrate() does').toMatch(/if \(!isMigratable\(s\)\) return blank;/);
    expect(store.slice(store.indexOf('function migrate(')), 'and that gate is still the one load() goes through').toMatch(/if \(!isMigratable\(s\)\) return \{ \.\.\.DEFAULT \};/);
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
    expect(store.slice(from, to)).toMatch(/!idx\.ids\.includes\(id\) && !holdsSave\(id\)/);
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

  // #44 again, the other half: the gate probes one concrete face, and it is only meaningful if index.html
  // actually asks Google for that weight. Trim the `wght@` list and the gate would wait for a face that never
  // arrives — every first wave then pays the full timeout AND still draws in the fallback. index.html is read
  // from disk (Vite's glob does not reach it) and its length asserted, so an empty read cannot pass vacuously.
  it('the font gate probes a weight index.html requests from Google (#44)', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html.length, 'index.html must be read from disk, not a blank import').toBeGreaterThan(500);
    const weights = /family=Fredoka:wght@([\d;]+)/.exec(html)?.[1].split(';') ?? [];
    expect(weights.length, 'index.html should request Fredoka with an explicit wght@ list').toBeGreaterThan(0);
    const probe = /^(\d+)\s/.exec(FONT_PROBE)?.[1];
    expect(weights, `the gate probes weight ${probe}, which index.html must request`).toContain(probe);
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
  it('nothing in src/ asks Fredoka for a weight it does not have (#44)', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html.length, 'index.html must be read from disk, not a blank import').toBeGreaterThan(500);
    const served = (/family=Fredoka:wght@([\d;]+)/.exec(html)?.[1] ?? '').split(';').filter(Boolean);
    expect(served.length, 'index.html should request Fredoka with an explicit wght@ list').toBeGreaterThan(0);
    expect(Math.max(...served.map(Number)), 'Fredoka has no weight above 700').toBeLessThanOrEqual(FREDOKA_MAX);

    const asked = Object.entries(SOURCES).flatMap(([f, s]) => [
      // a canvas font string: `700 24px "Fredoka", …`
      ...[...code(s).matchAll(/(\d{3})\s+[^\n;]{0,40}px[^\n;]{0,80}Fredoka/g)].map(m => `${f}: ${m[1]}`),
      // an inline SVG/HTML attribute: `font-weight="700"`. These inherit --font (== the Fredoka stack) from
      // `html, body` in style.css, so they are the same ask by another spelling, and the canvas pattern above
      // cannot see them — there is no `px` size and no family named on the line.
      ...[...code(s).matchAll(/font-weight="(\d{3})"/g)].map(m => `${f}: ${m[1]}`),
    ]);
    expect(asked.length, 'the rail found no font weights at all — it would pass vacuously').toBeGreaterThan(4);
    expect(asked.filter(a => !served.includes(a.split(': ')[1])),
      `every Fredoka weight in src/ must be one index.html asks Google for (${served.join(';')})`).toEqual([]);
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

    // the nightly arm: every project, or a regression in the missing one is caught by nothing at all
    for (const p of projects) {
      expect(fullArm, `the nightly must run every declared project — '${p}' is missing (#141)`)
        .toContain(`--project=${p}`);
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
        expect(p, `'${name}' must skip the viewport spec, so the pull-request leg stays the suite it was (#141)`)
          .toMatch(/testIgnore:\s*\/viewport\\\.spec\\\.ts\//);
      }
    }
    const spec = readFileSync(new URL('../../tests/e2e/viewport.spec.ts', import.meta.url), 'utf8');
    expect(spec.length, 'the tablet spec must be read from disk, not a stub').toBeGreaterThan(800);
    expect(spec, 'the tablet spec must use the shared assertion, not its own copy of the measurement (#116)')
      .toMatch(/from\s+'\.\/viewport'/);
    expect(spec, 'and actually call it, or the helper is dead code that still reads as coverage (#116)')
      .toMatch(/await expectFitsViewport\(/);
  });

  // #138: fast mode (#32) is only sound while it is a *pure time compression* — the same game, fewer seconds.
  // It shipped with two leaks. `layoutWave` divided the flight time but left `vx` in px/second, so at 4x a
  // bubble drifted a quarter as far sideways as a child ever sees; and a handful of `later(...)` beats in
  // play.ts kept their real-time literals, so they were part of the floor the suite could not get under.
  // Neither failed anything — which is exactly what makes them worth a rail. A test written against the
  // compressed trajectory would have been asserting a path the game does not have, and the next beat added
  // in real time would be just as invisible as these were.
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
                          'tests/unit/guardrails.test.ts', 'scripts/seed-issues.py',
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
// 0.801 is not a preference. Every emoji in `OBJECTS` advances 1.248 em (measured: all ten identical,
// Noto Color Emoji's 2550/2048 design width), so a glyph is inside its slot only while
// font-size <= slot / 1.248 = 0.801 * slot. A ratio above that is the bug returning, whatever it looks
// like in the browser CI happens to have.
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
    expect(k, `an emoji advances 1.248em, so ${k} * slot paints outside the slot — #107 exactly`)
      .toBeLessThanOrEqual(0.801);

  // The box half: if `.slot` goes back to its own viewport clamp, the single source of truth is gone and
  // the ratio above is measured against a width nothing else uses.
  const slotWidth = bare.match(/\.slot\s*\{[^}]*?width:\s*([^;}]+)/)?.[1].trim();
  expect(slotWidth, 'the slot must take its width from --slot, so box and glyph cannot drift apart (#107)')
    .toBe('var(--slot)');
});

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
