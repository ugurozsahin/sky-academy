import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';
// @ts-expect-error — plain ESM bundler helper (see scripts/bundle-single.d.ts); #15's rail asserts its output
import { stripHead } from '../../scripts/bundle-single.mjs';
import { NOISE_SECONDS } from '../../src/audio';   // #41: the rail below holds every SFX inside the shared buffer
import { FONT_PROBE } from '../../src/ui/font';   // #44: the rail below pins the gate's probe to index.html
import { exportSave, isMigratable, load, migrate, reset, MIGRATIONS, SAVE_VERSION } from '../../src/storage';   // #205/#232: the rails below hold the migration ladder complete, one-directional, and honest about what it exports

/**
 * GUARD RAILS (#73) — checks that fail the build so a mistake we have already made cannot come back.
 * Every rail names the incident it prevents. Two rules for whoever edits this file:
 *   1. A *budget* rail (`toBeLessThanOrEqual(N)`) records existing debt. Lower N when you remove a case.
 *      NEVER raise one to make a build pass — that is the whole point of the rail.
 *   2. If a rail is wrong, fix it deliberately and say why in the commit; do not delete it quietly.
 *
 * Rails that need a browser live in `tests/e2e/game.spec.ts` under "guard rail:" — frame rate, and the
 * stylesheet ones. Vitest cannot read CSS text (Vite's css plugin returns an empty string for `?raw`
 * and `?inline` outside the browser), so a CSS rail written here would pass vacuously, which is worse
 * than no rail at all. Game wording is enforced separately in `british.test.ts` (#47).
 */
const SOURCES = import.meta.glob('/src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
// Vite's glob does not reach `.github/`, and an empty read would make the workflow rail pass vacuously — the
// exact failure it exists to prevent — so this one file is read from disk, and its length is asserted first.
const workflow = (name: string) => readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), 'utf8');
const inDir = (dir: string) => Object.entries(SOURCES).filter(([f]) => f.startsWith(dir));
// Comments may name the very thing a rail bans, so rails strip them first. Crude on purpose: a `//` inside
// a string literal would blank the rest of that line — no such line exists in src/, and a rail that reads
// slightly less is safer than one that goes red on prose.
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ' ');

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
  // one is a second owner, and this rail names it.
  it('arena.paused has one writer outside arena.ts (#65)', () => {
    const writers = Object.entries(SOURCES)
      .filter(([f]) => f !== '/src/game/arena.ts')
      .flatMap(([f, s]) => code(s).split('\n').filter(l => /\.paused\s*=[^=]/.test(l)).map(l => `${f}: ${l.trim()}`));
    expect(writers, 'route a new pause reason through play-session\'s hold()/syncPaused(), never a direct write').toEqual([
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
  it('dependencies match the allowlist below (CLAUDE.md explains the rule)', () => {
    const allowed = ['@capacitor/android', '@capacitor/cli', '@capacitor/core', '@playwright/test', 'typescript', 'vite', 'vitest'];
    expect(Object.keys((pkg as { dependencies?: object }).dependencies ?? {})).toEqual([]);   // nothing but our own code ships to the browser
    expect(Object.keys((pkg as { devDependencies?: object }).devDependencies ?? {}).sort()).toEqual([...allowed].sort());
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
    // Match each route's *body*, not its layout: an equivalent reformat must not turn this red (#74 review).
    // The route names are read from the source, so a screen added later is covered without editing this test.
    // Bound the slice at the router's closing brace: unbounded, the LAST route's "body" ran to end of file, so
    // any `leave()` written lower in main.ts made a genuinely broken route pass (#77 review).
    const from = main.indexOf('const nav = {'), to = main.indexOf('\n};', from);
    expect({ router: from >= 0 && to > from }).toEqual({ router: true });
    const routes = main.slice(from, to).split(/\n\s*(?=\w+:)/).slice(1);
    const named = routes.map(r => [r.slice(0, r.indexOf(':')), r] as const).filter(([n]) => n !== 'up');
    expect(named.length).toBeGreaterThanOrEqual(7);                     // every screen the router can show
    for (const [screen, body] of named)
      expect({ screen, disposes: /\bleave\(\)/.test(body) }).toEqual({ screen, disposes: true });
    for (const f of ['/src/ui/play.ts', '/src/ui/memory.ts']) expect(code(SOURCES[f])).toContain('return cleanup;');
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
    expect({ event: 'issue_comment', type: 'created', subscribed: issueCommentTypes.includes('created') })
      .toEqual({ event: 'issue_comment', type: 'created', subscribed: true });
    const guard = code.slice(code.indexOf('if:'), code.indexOf('runs-on:') + 200);
    for (const marker of ["'REVIEW:'", "'OWNER:'"])                     // both verdicts must wake the job
      expect({ marker, wired: guard.includes(marker) }).toEqual({ marker, wired: true });
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
    expect(src, 'spawnWave passes the speed multiplier, the clock and the RNG in').toContain('gameSpeed(), performance.now(), Math.random');
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
      for (const path of ['CLAUDE.md', 'BACKLOG.md', 'docs/ROUTINE-PROMPT.md', 'docs/worklog/2026-09.md',
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
    // CLAUDE.md, BACKLOG.md and docs/ROUTINE-PROMPT.md, so a documentation-only pull request is exactly the
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
 * The owner's code-health freeze (2026-09-06) ended on 2026-09-10, once every `review`/`debt` issue the
 * 6 September review produced was closed. It was worded as a *condition* — "while any issue labelled
 * `review` or `debt` is open" — which the process kept re-arming every time a run filed a new finding about
 * itself, so the wording that replaces it has to say in as many words that the lift is one-time. That
 * sentence is the load-bearing one: without it the next `review` issue re-freezes the repo by reading.
 *
 * The three files each speak to a different reader — CLAUDE.md to an interactive session, BACKLOG.md to
 * whoever looks up the labels, docs/ROUTINE-PROMPT.md to the routine itself — and CLAUDE.md says they change
 * together. A rail is why a future edit cannot drop the lift from two of them and leave one run in 2026-09-06.
 * (Reinstating a freeze is the owner's to declare, and would rewrite all three of these files at once — this
 * rail going red on such a change is it working, not it objecting.)
 */
describe('the code-health freeze is over, in all three process files (2026-09-10)', () => {
  const doc = (name: string) => readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
  const FILES = ['CLAUDE.md', 'BACKLOG.md', 'docs/ROUTINE-PROMPT.md'];

  it.each(FILES)('%s records the lift, and that it cannot re-arm', (name) => {
    const text = doc(name);
    expect(text.length, 'a vacuous rail is worse than none').toBeGreaterThan(500);
    expect(text, 'the file must say the freeze is over').toMatch(/the code-health freeze is over/i);
    expect(text, 'and that a new review/debt issue does not re-freeze the repo')
      .toMatch(/one-time event, not a condition that can re-arm/i);
    // Was `/#46/` until 2026-09-11. The ordered list it pointed at is retired (#171) — what has to survive
    // the edit is that the file still says how work IS chosen, or "the freeze is over" means nothing.
    expect(text, 'and say how work is chosen instead — by the priority labels (#171)')
      .toMatch(/priority labels/i);
  });

  // The old rule, verbatim in the present tense, is what a run would act on if an edit put it back in one
  // file only. Quoting it in the past tense ("was open") is how all three describe the history.
  it.each(FILES)('%s does not still state the freeze as a live rule', (name) => {
    expect(doc(name)).not.toMatch(/feature work while any issue labelled `review` or `debt` is open/i);
  });
});

/**
 * #178 — the worklog is closed, and the habit is what needs the rail.
 *
 * `WORKLOG.md` had twelve-plus writers a day and zero readers *by rule*: CLAUDE.md said "nothing reads it"
 * and docs/ROUTINE-PROMPT.md STEP 1 said "do not read it", while it grew ~17 KB a day with no rotation logic
 * anywhere in the repository. The only rotation that ever happened was manual, and it happened because the
 * file had already killed a run on the token limit at 94.8 KB. The second file reached 55 KB — about three
 * days from doing it again — before the owner closed it on 2026-09-10.
 *
 * Deleting the instruction is not enough on its own, which is the whole reason these are rails rather than a
 * note. A run reads an old PR description, sees a worklog line in it and copies the habit; that is exactly
 * how the `claude/*` branch names survived their own rename (#160). So: the file may not come back to the
 * root, and no live instruction may tell a run to write to it.
 *
 * The rails read the *literal filename* and ban instruction SHAPES, not the word itself — every one of these
 * files still has to be able to say what happened and why, in the past tense, without going red. That is the
 * #129 failure from the other side: a rail that cannot tolerate its own explanation gets deleted rather than
 * obeyed. Prove them red by restoring `WORKLOG.md` to the root, and by putting "append a line to WORKLOG.md"
 * back into any live instruction file.
 */
describe('the worklog is archived and nothing writes it again (#178)', () => {
  const root = new URL('../../', import.meta.url);
  // Live instructions — the files a run or a session actually acts on. `docs/worklog/` is deliberately NOT
  // here: it is the archive, it describes itself in the past tense, and a rail that policed it would be
  // policing history. `tests/` is not here either, for the reason in the block comment above.
  const LIVE = ['CLAUDE.md', 'BACKLOG.md', 'docs/ROUTINE-PROMPT.md', 'docs/WATCHDOG-PROMPT.md',
                'README.md', 'scripts/seed-issues.py'];
  const live = (name: string) => readFileSync(new URL(name, root), 'utf8');

  it('WORKLOG.md is gone from the repository root, and the archive is still there', () => {
    const entries = readdirSync(root).map(String);
    expect(entries.length, 'the root must be read from disk, not an empty listing').toBeGreaterThan(10);
    expect(entries, 'nothing appends to a worklog any more — the record goes to the heartbeat issue (#178)')
      .not.toContain('WORKLOG.md');
    // Without this half the rail above also passes if someone deletes the archive, which is the opposite
    // mistake: those two files are the record of the project's first week and are kept on purpose.
    const archived = readdirSync(new URL('docs/worklog/', root)).map(String);
    expect(archived.filter(f => f.endsWith('.md')).length,
      'docs/worklog/ must still hold the archive — it is history, not clutter').toBeGreaterThanOrEqual(2);
  });

  // Three shapes, each an instruction to write rather than a mention. A file may still say the file existed,
  // where it went and why — that is what every one of these now does.
  it.each(LIVE)('%s does not tell a run to write to it', (name) => {
    const text = live(name);
    expect(text.length, 'a vacuous rail is worse than none').toBeGreaterThan(200);
    for (const [shape, re] of [
      ['"append/write/record … to WORKLOG.md"', /\b(append|writ|add|record|put|log)\w*\b[^.\n]{0,50}\bto\s+`?WORKLOG\.md/i],
      ['"… in WORKLOG.md"', /\bin\s+`?WORKLOG\.md/i],
      ['"a WORKLOG entry"', /\bWORKLOG(\.md)?\s+entry\b/i],
    ] as const)
      expect({ file: name, shape, found: re.test(text) },
        `${name} still instructs a run to write the worklog (${shape}) — the record goes to the heartbeat ` +
        'issue body instead (#178)').toEqual({ file: name, shape, found: false });
  });

  // The trap #178 names explicitly: the heartbeat issue is the one record here that IS read, so an appended
  // one rebuilds the unbounded file in the worst possible place. The instruction has to say "replace".
  it('the routine is told to REPLACE the heartbeat body, never to append to it', () => {
    const text = live('docs/ROUTINE-PROMPT.md');
    expect(text, 'STEP 5 must say the heartbeat body is replaced').toMatch(/\*\*replace\*\*|\breplace\b[^.\n]{0,40}body/i);
    expect(text, 'and say in as many words that it is never appended to').toMatch(/never append/i);
    expect(text, 'and it is still written last, so a run that dies leaves a stale pulse')
      .toMatch(/last, not first/i);
  });

  // The three-file rule: the routing table is the thing that stops the habit coming back as a new file
  // somewhere else, so all three have to carry it.
  it.each(['CLAUDE.md', 'BACKLOG.md', 'docs/ROUTINE-PROMPT.md'])('%s carries the record-routing rule', (name) => {
    const text = live(name);
    expect(text, 'the file must ask who reads a record before one is written')
      .toMatch(/who opens this, and when/i);
    expect(text, 'and route operational state to the heartbeat issue, overwritten')
      .toMatch(/overwritten every run, never appended/i);
  });
});

/**
 * The tablet layout rails (#107, #109). Both come from the same playtest and the same blind spot — nothing
 * in CI had ever rendered a tablet — and both are the cheap exhaustive half of a check whose expensive half
 * is an e2e in `tests/e2e/viewport.spec.ts` that can only measure the viewports a project declares.
 *
 * (The #107 rail below was written inside the `#178` worklog describe and is moved here unchanged: a
 * failure printed under "the worklog is archived and nothing writes it again" sends the reader to the
 * wrong rule. Raised reviewing PR #186.)
 */
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
 * #110: the opening screen's "Your name" field was the last thing on a long page — brand header, the full
 * eleven-card grid, *then* the field — and `.avatar-grid` is `repeat(auto-fill, minmax(104px, 1fr))`, so the
 * wider and taller the screen the further down it went. On a tablet it was below the fold behind every card.
 * The e2e in `game.spec.ts` and `viewport.spec.ts` measures the rendered field against the viewport, but only
 * at the geometries a project declares; this is the cheap exhaustive half, and it holds the *ordering*, which
 * is the thing that cannot come back without someone moving the markup.
 *
 * `canStart` itself is tested for real in `avatar.test.ts` — this rail only checks that the screen routes
 * both the initial attribute and the live re-check through it, because a hand-rolled second copy of the rule
 * is exactly how the two drifted apart before.
 */
describe('the opening screen asks for a name where it can be seen (#110)', () => {
  const src = readFileSync(new URL('../../src/ui/avatar.ts', import.meta.url), 'utf8');

  it('the name row is rendered above the avatar grid', () => {
    expect(src.length, 'avatar.ts must be read from disk as text, or this rail checks nothing').toBeGreaterThan(1_000);
    const nameRow = src.indexOf('class="name-row"'), grid = src.indexOf('class="avatar-grid"');
    expect(nameRow, 'the .name-row label must exist in the template (#110)').toBeGreaterThan(-1);
    expect(grid, 'the .avatar-grid must exist in the template (#110)').toBeGreaterThan(-1);
    expect(nameRow, 'the name field below the eleven cards IS #110 — it must be rendered before the grid')
      .toBeLessThan(grid);
  });

  it('both the initial button state and the live re-check go through canStart', () => {
    const go = src.match(/<button id="go"[^>]*?\$\{([^}]*)\}/)?.[1];
    expect(go, 'the Let\'s go! button must compute its disabled state inline (#110)').toBeTruthy();
    expect(go, 'it must ask canStart, not `d.avatar` alone — an empty name used to sail through')
      .toMatch(/canStart\(/);
    expect(src, 'and the name input must re-check on every keystroke, or the button never enables (#110)')
      .toMatch(/#name[\s\S]*?addEventListener\('input'|addEventListener\('input'[\s\S]*?sync/);
  });
});

/**
 * #171 — the ordered list is retired, and the rail is about the *dependency*, not the issue number.
 *
 * A pinned issue held the order by hand, and a hand-kept list has to agree with the labels, the board and
 * reality. It did not: four consecutive runs reported items carrying `review` that were missing from its code
 * health section, its own "Four left" line went stale against its own checkboxes twice, and a session had to
 * reconcile it with the board by hand. Worse, it was the run's *control flow* — STEP 3 said "pick the first
 * unticked item in it" — so the one issue that could retire the list was the one issue no run could pick, and
 * the owner had to place it at the top by hand to break that.
 *
 * The order is now the labels: highest `priority:*`, oldest issue first, among open `routine-ok` issues.
 * There is nothing to keep in step, so the way this comes back is not a decision, it is a sentence — one
 * instruction file quietly pointing at the list again. That is what this rail reads. It checks the live
 * instruction files only: `docs/worklog/` is the archive and records what was true then, and this test file
 * names the number constantly in exactly these comments.
 *
 * Prove it red by putting "work top-down through issue #4" + "6" back into any file in LIVE.
 */
describe('no live rule points at the retired priority-order issue (#171)', () => {
  const root = new URL('../../', import.meta.url);
  const LIVE = ['CLAUDE.md', 'BACKLOG.md', 'docs/ROUTINE-PROMPT.md', 'docs/WATCHDOG-PROMPT.md', 'README.md'];
  // Built from parts so this rail's own source does not contain the string it bans — otherwise the file
  // could never be checked by a sibling rail, and a reader grepping the repo gets a false hit here.
  const RETIRED = '#' + '46';

  it.each(LIVE)('%s does not route work through it', (name) => {
    const text = readFileSync(new URL(name, root), 'utf8');
    expect(text.length, `${name} must be read from disk as text, or this rail checks nothing`)
      .toBeGreaterThan(300);
    expect(text, `${name} still points at the retired ordered list — work is chosen from the labels (#171)`)
      .not.toContain(RETIRED);
  });

  // The other half: removing the pointer is only right if something replaced it. A file with neither is a
  // run with no way to choose what to do, which is the failure this issue was opened to avoid, not fix.
  it('the routine still states the query that replaced it', () => {
    const text = readFileSync(new URL('docs/ROUTINE-PROMPT.md', root), 'utf8');
    expect(text, 'STEP 3 must name the label the query selects on').toMatch(/labels=routine-ok/);
    expect(text, 'and the priority order').toMatch(/priority:P1`? before `?priority:P2/);
    // `later` is how the owner parks something without arguing with its priority — #8 is `priority:P1`
    // and parked. Leave it out of the drop list and the query hands the next run parked work.
    expect(text, 'and that `later` is dropped, or parked work comes straight back')
      .toMatch(/\*\*drop\*\* anything labelled `later`/);
    expect(text, 'and the tie-break, or two runs can read the same repo and disagree')
      .toMatch(/oldest first/i);
    expect(text, 'and that the project board is not in the loop').toMatch(/nothing in this flow reads the project board/i);
  });
});

/**
 * #157 — the priority order left `priority:P0` unstated, so two runs could read it two different ways.
 *
 * STEP 3 said "priority:P1 before priority:P2 before priority:P3" and stopped there, while
 * `scripts/board-sync.mjs`'s own `PRIORITIES` array already orders `['P0', 'P1', 'P2', 'P3']` — the board has
 * been treating P0 as the most urgent all along while the routine's own ordering rule had no answer for it: a
 * P0 issue was neither one of the three enumerated levels nor "no `priority:*` label". Determinism is the
 * entire point of STEP 3 — two runs reading the same repo state must pick the same issue — and an unrecognised
 * label breaks that guarantee, which is exactly what #157 found while running the query for real.
 *
 * Prove it red: drop `priority:P0` back out of the STEP 3 sentence.
 */
describe('STEP 3 states where priority:P0 sorts (#157)', () => {
  const root = new URL('../../', import.meta.url);

  it('P0 is named ahead of P1 in the ordering rule', () => {
    const text = readFileSync(new URL('docs/ROUTINE-PROMPT.md', root), 'utf8');
    expect(text, 'STEP 3 must say priority:P0 outranks priority:P1, or a P0 issue sorts nowhere')
      .toMatch(/priority:P0`? before `?priority:P1/);
  });

  it('agrees with the order scripts/board-sync.mjs already uses', () => {
    const boardSync = readFileSync(new URL('scripts/board-sync.mjs', root), 'utf8');
    expect(boardSync, 'the board-sync PRIORITIES array is the other place this order is encoded')
      .toMatch(/PRIORITIES\s*=\s*\[\s*'P0',\s*'P1',\s*'P2',\s*'P3'\s*\]/);
  });
});

/**
 * #160 — branch names say what the change is, and the rail is about the *matcher*, not the prefix.
 *
 * Branch listings read `claude/affectionate-noether-cztizx` and `claude/bold-knuth-fbbwdx` — generated animal
 * names that say nothing about the work, so a stale branch could not be judged without opening its PR and
 * thirteen merged-but-undeleted ones had to be cleared by hand. The owner noticed twice and raised it to P1.
 *
 * The prefix is the easy half. Two things underneath it are why this is a rail and not a note:
 *
 * 1. **The escape clause, not the prefix, produced those names.** STEP 3 used to end "…or the branch this run
 *    is told to push to if it has one", so a cloud run taking the harness-assigned branch was *obeying the
 *    documented rule*. Rename the prefix and leave the clause and the next `claude/bold-knuth-*` is still
 *    compliant. The clause now costs a line of disclosure in the PR body, which is what turns a departure
 *    from silent into visible.
 * 2. **STEP 2 matched on the old prefix.** "List open PRs from branches `claude/*`" is a behaviour, not
 *    wording: under the new names that match returns an empty list, and a run that trusted it would report
 *    "nothing to review" with work sitting open — a reviewer stops seeing PRs and nothing goes red. So the
 *    rail reads the listing instruction as well as the naming one.
 *
 * The files may still *describe* `claude/*` in the past tense — every one of them has to be able to explain
 * what was retired and why, which is the #129 lesson: a rail that cannot tolerate its own explanation gets
 * deleted rather than obeyed. What is banned is the retired *instruction* form, `claude/issue-<n>`.
 *
 * Prove it red: put "branch `claude/issue-" + "<n>`" back into any file in LIVE, or change STEP 2 back to
 * listing PRs by branch prefix.
 */
describe('branches are named for the change, and nothing matches on the old prefix (#160)', () => {
  const root = new URL('../../', import.meta.url);
  const LIVE = ['CLAUDE.md', 'BACKLOG.md', 'docs/ROUTINE-PROMPT.md', 'docs/WATCHDOG-PROMPT.md',
                'README.md', 'scripts/seed-issues.py'];
  const live = (name: string) => readFileSync(new URL(name, root), 'utf8');
  // Built from parts so this rail's own source does not contain the instruction form it bans.
  const RETIRED = 'claude/' + 'issue-';

  it.each(LIVE)('%s does not tell anyone to open a retired-style branch', (name) => {
    const text = live(name);
    expect(text.length, `${name} must be read from disk as text, or this rail checks nothing`)
      .toBeGreaterThan(300);
    expect(text, `${name} still hands out the retired branch name — the convention is feature|fix|chore (#160)`)
      .not.toContain(RETIRED);
  });

  // The three process files carry this convention word for word, the same way they carry the freeze wording
  // and the records rule. A mapping that drifts between them is a run guessing which file to believe.
  const PROCESS = ['CLAUDE.md', 'BACKLOG.md', 'docs/ROUTINE-PROMPT.md'];
  it.each(PROCESS)('%s states the prefix mapping in the one canonical form', (name) => {
    const text = live(name);
    expect(text, `${name} must map the three prefixes onto the labels, identically in all three files`)
      .toContain('`fix/` for `bug`/`playtest`, `feature/` for `enhancement`, `chore/` for everything else');
    expect(text, `${name} must give the branch shape, or the mapping has nothing to attach to`)
      .toMatch(/<n>-<slug>/);
  });

  // The half that is a behaviour change. Losing this is not a typo: the reviewer's own listing goes empty
  // and the run reports "nothing to review" while PRs sit open, with nothing red to say otherwise.
  it('STEP 2 lists every open PR instead of matching a branch prefix', () => {
    const text = live('docs/ROUTINE-PROMPT.md');
    expect(text, 'STEP 2 must name the unfiltered listing call').toMatch(/pulls\?state=open/);
    expect(text, 'and say plainly that branch name is not a filter').toMatch(/never filter by branch name/i);
  });

  // The clause that actually produced the old names, and the reason this half is a rail rather than prose.
  //
  // A scheduled run is handed a push branch and told not to use another without explicit permission, so the
  // rule has to do two things a flat "name your own branch" cannot: say the assigned branch is not to be
  // used, and say WHERE the permission comes from. A run weighing a repository file against the instruction
  // it was launched with should be able to point at the owner giving it — not at this file alone, which is
  // the one thing any agent editing the repo could have written for itself.
  //
  // Two runs on 2026-09-11 read the old wording and used the pinned branch, which is what a rule that only
  // says "prefer" is worth. The remaining fallback is a REFUSED push, not an unencouraged one, and it still
  // costs a line in the PR body: otherwise taking it is indistinguishable from ignoring the convention.
  it('the assigned push branch is refused, and the permission is sourced', () => {
    const text = live('docs/ROUTINE-PROMPT.md');
    expect(text, 'the rule must say the session-assigned branch is not the one to use')
      .toMatch(/do not use it/i);
    expect(text, "and cite the owner's permission, or it is a file granting itself a licence")
      .toMatch(/owner's explicit permission/i);
    expect(text, 'and the fallback must be a refusal, not a preference').toMatch(/if the push is \*\*refused\*\*/i);
    expect(text, 'and must still require the disclosure that makes it visible')
      .toMatch(/BRANCH: PUSH REFUSED/);
  });

  // The owner asked for this one by name, and the reason is the gap every rail above has:
  //
  //   "The guard rail this issue asks for should check the PR's head branch name, which is where the rule
  //    actually shows up, not just that the docs agree with each other."  — #160, 2026-09-10T18:12Z
  //
  // Everything in this file reads text from disk. A pull request whose own branch ignores the convention is
  // green on all of it — which is exactly what happened while the convention was being written, on the pull
  // request that introduced it. Only CI can see a head branch, so the check lives in `ci.yml` and this rail
  // guards that it is still there and still means something: the pattern, the `pull_request` scoping, and
  // the single documented exception.
  //
  // Prove it red by deleting the `branch-name` job, by loosening the pattern, or by dropping the marker.
  it('CI reads the head branch itself, which no rail in this file can', () => {
    const ci = readFileSync(new URL('.github/workflows/ci.yml', root), 'utf8');
    expect(ci, 'the job the owner asked for must exist').toMatch(/^ {2}branch-name:$/m);
    expect(ci, 'and enforce the three prefixes with an issue number and a slug')
      .toContain("PATTERN='^(feature|fix|chore)/[0-9]+-[a-z0-9]+(-[a-z0-9]+)*$'");
    // A push to main and the nightly have no head branch; failing them there would be nonsense, and a job
    // that fails for a silly reason is a job someone deletes.
    expect(ci, 'and run only where there is a head branch to judge')
      .toMatch(/branch-name:[\s\S]{0,200}?if: github\.event_name == 'pull_request'/);
    // Anchored: a reviewer quoting the marker in a sentence must not clear the check — #144's bug, which
    // GitHub's own closing-keyword parser has and which cost this repo two wrongly-closed issues.
    expect(ci, "and match the exception marker at a line start, not anywhere in the body")
      .toContain("grep -Eq '^BRANCH: PUSH REFUSED'");
    expect(live('docs/ROUTINE-PROMPT.md'), 'and the routine must tell a run the job exists')
      .toMatch(/`branch-name` job in `ci\.yml`/);
  });
});

/**
 * #161 — a stale review block may be adopted by another agent.
 *
 * The rule it replaces was absolute: "only the reviewer who set the block clears it". Sessions are mortal and
 * that rule is not, so on PR #150 the blocking session went quiet at 00:53Z, the developer fixed what it asked
 * for, the owner approved at 06:55Z, and the PR still sat drafted and red for ~10 hours until a session broke
 * it by hand. This is a LOOSENING — it lets an agent clear a block it did not set — which is why the four
 * conditions have to survive verbatim in all three process files rather than being paraphrased into a licence.
 *
 * The figure has exactly one written form, `at least 4 hours old`, so it cannot drift between the files; the
 * rail asserts the whole canonical paragraph, which is stronger than asserting the number alone.
 *
 * Two things this rail also pins, because each is the way the loosening would decay into the failure it fixes:
 *
 *  - **`scripts/review-gate.mjs` has no clock.** A block must never expire by itself — that is how #74 was
 *    merged over five open review items. The gate reads marker ORDER (which `created_at` is later), never
 *    elapsed time, so `Date.now` appearing in it at all means someone taught it to age a block out.
 *  - **The absolute wording is gone from all three files.** Leaving it beside the new rule is worse than not
 *    landing the rule: a run finds "only the reviewer who set it may clear it" and obeys the stricter of two
 *    contradicting sentences, which is the stall again.
 *
 * Prove it red: drop the paragraph from any of the three files; change `4 hours` to `four hours` in one of
 * them; put the retired absolute sentence back; or add `Date.now()` to the gate.
 */
describe('a stale review block may be adopted, and only under the four conditions (#161)', () => {
  const root = new URL('../../', import.meta.url);
  const read = (name: string) => readFileSync(new URL(name, root), 'utf8');
  const PROCESS = ['CLAUDE.md', 'BACKLOG.md', 'docs/ROUTINE-PROMPT.md'];

  // The canonical paragraph, in the one form all three files must carry. Split across lines for readability
  // only — it is rejoined with single spaces, so the assertion is on the exact prose in the files.
  const CANON = [
    '**A stale review block may be adopted (#161).** A `REVIEW: CHANGES REQUESTED` block may be cleared by an',
    'agent that did not open the pull request when all four of these hold: the block is **at least 4 hours',
    'old**; the session that set it has posted **no comment on that same pull request in the last 2 hours**',
    '(a comment elsewhere in the repository does not protect the block — it is the signal that the reviewer',
    'has moved on); the adopting agent has re-derived the original objection against the current head and',
    'found it genuinely resolved; and its `REVIEW: CLEARED` comment says in its own first lines that it is',
    'clearing another reviewer\'s block and names the conditions that made that legitimate.',
  ].join(' ');

  it.each(PROCESS)('%s carries the adoption rule in the one canonical form', (name) => {
    const text = read(name);
    expect(text.length, `${name} must be read from disk as text, or this rail checks nothing`)
      .toBeGreaterThan(300);
    expect(text, `${name} must state the four conditions word for word — a paraphrase is how a loosening widens`)
      .toContain(CANON);
  });

  it.each(PROCESS)('%s keeps the limits that did not move, and drops the absolute rule', (name) => {
    const text = read(name);
    expect(text, `${name} must still forbid clearing your own block, and a live reviewer's`)
      .toContain('Clearing your own block is still forbidden, and so is clearing a live reviewer\'s');
    expect(text, `${name} must say a block never expires on its own`).toContain('A block never expires by itself');
    // Built from parts so this rail's own source is not what trips it.
    expect(text, `${name} still carries the retired absolute rule, which contradicts the adoption rule (#161)`)
      .not.toContain('Only the reviewer who set ');
    // #213: the windowless repo-wide test is the one that made the loosening a dead letter. It must not
    // survive anywhere beside the window that replaced it, in any of the three files.
    expect(text, `${name} still carries #213's windowless repo-wide silence test`)
      .not.toContain('commented nowhere in the repository');
    expect(text, `${name} must state the window, and the figure has one written form`)
      .toContain('in the last 2 hours');
  });

  /**
   * #213 — the window is measured on the blocked pull request, never repo-wide.
   *
   * The owner's decision of 2026-09-12T08:40Z, and the whole of the fix. "Has this session written anything
   * anywhere since" is ~always true — a reviewing run posts its block and then merges something, comments on
   * an issue, or opens its own PR before it ends — so with no window the condition could never be satisfied
   * and every block became permanently unadoptable. #204, #209, #214, #221 and #222 each stalled that way,
   * with their authors' fixes pushed and CI green.
   *
   * A comment the setter left elsewhere is evidence it has moved ON, so it must never be read as evidence the
   * block is live. That inversion is the way this would silently decay back: widen the window's scope from the
   * PR to the repository and the rule is a dead letter again, with nothing red to say so.
   *
   * Prove it red: drop the "on this pull request only" sentence, or point the check back at the repo-wide
   * `issues/comments` listing.
   */
  it('the silence window is scoped to the blocked pull request, not the repository (#213)', () => {
    const text = read('docs/ROUTINE-PROMPT.md');
    expect(text, 'STEP 2 must scope the window to the one pull request')
      .toContain('**The window is measured on this pull request only, never repo-wide.**');
    expect(text, 'and say that a comment elsewhere is the reviewer moving on, never a live block')
      .toMatch(/moved on\*?\*?, so it does not protect the block/);
    // The repo-wide listing is what condition 1 must no longer be checked against.
    expect(text, 'the retired repo-wide listing must not be left standing as the check to run')
      .not.toMatch(/issues\/comments\?sort=created/);
  });

  // The watchdog tells the owner which conditions already hold, so it must carry the same window.
  it('the watchdog quotes the adoption conditions with the same window (#213)', () => {
    const text = read('docs/WATCHDOG-PROMPT.md');
    expect(text, 'the watchdog must not hand the owner the retired condition')
      .not.toContain('commented\n   nowhere in the repository since');
    expect(text, 'it must state the window it tells a run to check')
      .toContain('no\n   comment on that same pull request in the last 2 hours');
  });

  // Acceptance criterion: STEP 2 tells a run how to check the two conditions it cannot eyeball.
  it('STEP 2 gives the two mechanical checks, and fails closed without a session id', () => {
    const text = read('docs/ROUTINE-PROMPT.md');
    expect(text, 'age comes from the blocking comment itself').toMatch(/issues\/<pr>\/comments/);
    expect(text, 'and the setter is identified by session URL, since one token serves every agent')
      .toMatch(/https:\/\/claude\.ai\/code\/session_<id>/);
    expect(text, 'with the window that makes silence checkable, read off the blocked PR itself (#213)')
      .toMatch(/less than 2 hours old/);
    expect(text, 'and no session id must mean NOT adoptable, never "probably gone"')
      .toMatch(/is not adoptable/i);
  });

  // The gate reports the block; it never ages one out. #74 is what an expiring block costs.
  it('review-gate.mjs orders the markers and never reads a clock', () => {
    const src = read('scripts/review-gate.mjs');
    expect(src, 'the gate must still decide by marker order').toContain('created_at');
    expect(src, 'but never by elapsed time — a block that expires by itself is #74 again')
      .not.toMatch(/Date\.now|getTime\(\)|\b\d+\s*\*\s*60\s*\*\s*60\b/);
  });

  it('the watchdog tells the owner a stalled block is adoptable, not merely stuck', () => {
    const text = read('docs/WATCHDOG-PROMPT.md');
    expect(text, 'the stale-block step must name the rule').toMatch(/Since #161 such a block is adoptable/);
    expect(text, 'and point at where the mechanical checks live').toMatch(/ROUTINE-PROMPT\.md` STEP 2/);
  });

  /**
   * And nothing under `.claude/` may carry a fourth copy of the conditions.
   *
   * The three rails above hold the three process files identical to each other. They cannot see a copy that
   * lives somewhere else, and PR #235's first cut put one in `.claude/skills/review-pr/SKILL.md` — a
   * paraphrase, in the reviewer's own words. The reviewing agent demonstrated what that costs: changing
   * `at least 4 hours old` to `at least 20 minutes old` in the skill, and swapping the pull-request-scoped
   * silence window for #213's retired repo-wide one, each left all 855 tests green. A run reading the skill
   * and not STEP 2 would then have adopted a twenty-minute-old block — which is clearing a live reviewer's.
   *
   * `.claude/` is the scope because it is the context a run loads *about to do this job*: a skill's body
   * arrives in the turn its description triggers, and an agent definition arrives with the agent. A widened
   * condition anywhere else is a bug; a widened condition here is one the run is actively reading.
   *
   * **The first cut of this rail matched only the canonical phrasings, and that was the wrong half.** Its
   * author argued a widening "has no reason to reword condition 3"; #235's second reviewer showed it has
   * every reason, with a paraphrase that said "re-checked the objection against the current head" instead of
   * "re-derived the original objection" and carried a twenty-minute window and #213's retired repo-wide
   * silence test straight past the rail. A rail keyed to the words of the *correct* rule catches the
   * harmless copy and waves the harmful one through, which is the exact failure mode #235 itself was
   * blocked for twice.
   *
   * So the rule below is keyed on what a widener **cannot** drop. To grant a licence you must say when it
   * applies, which takes a figure and a time unit; and the conditions live in three files this repository
   * holds identical, so a `.claude/` document that discusses adoption at all has exactly one correct thing
   * to do — point at them. Hence: talk about adoption and you must name STEP 2 and must state no window of
   * your own. The canonical fragments are kept as well, because a verbatim copy-paste is the likeliest
   * accident and costs nothing to catch.
   *
   * What this rail is NOT, said plainly rather than implied:
   *  - It does not police `docs/`, where a decision record may legitimately quote the rule.
   *  - It reads markdown only. A non-`.md` file under `.claude/` is invisible to it, and to the `#180`
   *    per-file check as well (that one skips project-written entries via `if (!src) continue`), so
   *    `.claude/skills/review-pr/adoption.txt` would carry a widened paraphrase unseen. #238's territory.
   *  - "Discusses adoption" is itself a text match (`REVIEW: CHANGES REQUESTED` or `#161`). A document that
   *    granted the licence while naming neither would pass — but it would also be unreadable as a rule.
   *
   * Prove it red four ways: restate a condition verbatim in a skill; reword one and add a window; delete
   * review-pr's pointer at STEP 2; or narrow the walk so it no longer reaches the skills.
   */
  describe('no .claude/ document carries a second copy of the adoption conditions (#161)', () => {
    // Built from parts so this rail's own source, and the CANON above, are not what trips it.
    const FRAGMENTS = [
      ['at least 4 ', 'hours old'],
      ['in the last ', '2 hours'],
      ['no comment on ', 'that same pull request'],
      ['re-derived the ', 'original objection'],
      // The two wordings this repository has already had to retire, and so the likeliest to be copied back.
      ['Only the reviewer ', 'who set '],
      ['commented nowhere ', 'in the repository'],
    ].map((p) => p.join(''));
    /** A figure and a time unit: what stating a window takes, in any wording a widener could choose. */
    const WINDOW = /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty|thirty|sixty)[\s-]*(?:minute|hour|day|week)s?\b/i;
    /** A document is talking about *this* protocol, rather than using the English word "adopt", if it names it. */
    const ABOUT_BLOCKS = /REVIEW: CHANGES REQUESTED|#161/;

    const walk = (dir: string): string[] => readdirSync(new URL(dir, root), { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? walk(`${dir}${e.name}/`) : e.name.endsWith('.md') ? [`${dir}${e.name}`] : []));
    const docs = walk('.claude/');

    // A count is not the files that matter: narrowing the walk to one vendored skill still cleared a
    // `toBeGreaterThan(4)` floor while never reaching the file the rail exists for. Name them instead, and
    // derive the list from the filesystem so a skill added later joins the scope without anyone remembering.
    it('the walk reaches every skill and agent document', () => {
      const shallow = (p: string) => readdirSync(new URL(p, root), { withFileTypes: true });
      const expected = [
        ...shallow('.claude/skills/').filter((e) => e.isDirectory()).map((e) => `.claude/skills/${e.name}/SKILL.md`),
        ...shallow('.claude/agents/').filter((e) => e.isFile()).map((e) => `.claude/agents/${e.name}`),
      ];
      expect(expected.length, 'the independent listing must find something, or it cannot cross-check anything')
        .toBeGreaterThan(4);
      for (const file of expected) {
        expect(docs, `the walk missed ${file} — a rail that does not read a file cannot hold it`).toContain(file);
      }
      expect(docs, 'and above all the reviewing skill, which is the one that auto-loads for this job')
        .toContain('.claude/skills/review-pr/SKILL.md');
    });

    it.each(docs)('%s restates no adoption condition', (file) => {
      const text = read(file);
      for (const fragment of FRAGMENTS) {
        expect(text, `${file} restates an adoption condition — point at ROUTINE-PROMPT.md STEP 2 instead, `
          + 'because a paraphrase of a loosening is a licence nothing checks (#161)')
          .not.toContain(fragment);
      }
    });

    // The half the fragments cannot hold: a reworded copy. Keyed on the figure a licence needs to be usable.
    it.each(docs)('%s states no window of its own, and points at STEP 2 if it discusses adoption', (file) => {
      const text = read(file);
      if (!ABOUT_BLOCKS.test(text)) return;                  // not about this protocol; vendored bodies land here
      const window = WINDOW.exec(text);
      expect(window?.[0], `${file} states a time window beside the block protocol. The four conditions live in `
        + 'CLAUDE.md, BACKLOG.md and ROUTINE-PROMPT.md STEP 2 and nowhere else; a figure here is a licence (#161)')
        .toBeUndefined();
      expect(text, `${file} discusses block adoption without naming ROUTINE-PROMPT.md — a pointer is the only `
        + 'correct thing a .claude/ document can do with a loosening (#161)')
        .toContain('ROUTINE-PROMPT.md');
    });

    // And the pointer itself is pinned, not merely permitted: the rail above forbids the wrong text, this
    // requires the right text. Deleting review-pr's whole adoption section left the suite green without it.
    it('the reviewing skill keeps its pointer and its fail-closed rule', () => {
      const text = read('.claude/skills/review-pr/SKILL.md');
      expect(text, 'the skill must send the reader to STEP 2 for the conditions')
        .toMatch(/Adopting someone else's stale block \(#161\)/);
      expect(text, 'and keep the rule that needs no conditions to state: no session id, no adoption')
        .toContain('not adoptable at all');
      expect(text, 'and the two things adoption never licenses')
        .toContain("Clearing your own block, or a live reviewer's, is forbidden");
    });

    // FRAGMENTS is a hand-written echo of CANON: retune the figures legitimately in all three process files
    // and the numeric fragments become dead strings with nothing going red. (#235's reviewer warned the join
    // splits `at least 4 hours old` across two entries so this could not be asserted directly — checked, and
    // it does not: the `**` falls outside the phrase, so plain containment works.)
    it.each(FRAGMENTS.slice(0, 4))('the canonical paragraph still contains %s', (fragment) => {
      expect(CANON, 'a fragment absent from CANON is a dead string, and the rail above is weaker than it reads')
        .toContain(fragment);
    });
  });
});

/**
 * #158 — the project board is a projection of the repository, synced from the owner's Mac, and never a
 * second source of truth. No cloud session can reach it.
 *
 * The board's 44 cards sat in Backlog for four days because Projects v2 sets nothing by itself, and a session
 * then backfilled it by hand — which is the state the retired pinned list was in before #171: a second thing
 * that has to agree with the labels and does not. The first cut of this work told the ROUTINE to run the
 * sync, with the token as a cloud secret; the Claude Code docs say the cloud GitHub proxy answers every
 * non-PR GraphQL request 403 "regardless of the credentials you supply" and name Projects v2 as the example,
 * so that instruction could only ever have produced a `NOT synced` line in every heartbeat. Three ways this
 * decays, and a rail for each:
 *
 * 1. **A cloud instruction file tells a run to execute the sync again.** It cannot work, and the doc that
 *    says so is the one a run reads. The live instruction files must not carry the run command at all, and
 *    must say why, so the next agent who "fixes" it by adding the command back has to delete the sentence
 *    explaining the 403 first.
 * 2. **Nobody reads the pulse.** With the sync out of reach, the only way a cloud agent can tell a synced
 *    board from a dead Mac job is the `board: heartbeat` issue the script rewrites at least hourly. STEP 1
 *    and the watchdog's check 8 must both read it, and the heartbeat shape must carry the `- board:` line.
 *    Drop any of those and a dead sync reads as a quiet board, which is this project's signature failure.
 * 3. **The sync starts writing back.** The arrows point one way, repo → board, plus one pulse. The day the
 *    script sets a label, closes an issue or edits a PR, the labels are no longer the input and the owner's
 *    control surface has two authors. The rail reads the source for the endpoints and mutations that would
 *    do that, and counts the call sites of the one write helper.
 *
 * Prove it red: put "`node scripts/board-sync.mjs`" into STEP 1, delete "board: heartbeat" from the
 * watchdog's check 8, or add a third `restWrite(` call to the script.
 */
describe('the project board is synced from the Mac, read by pulse in the cloud, and never written back (#158)', () => {
  const root = new URL('../../', import.meta.url);
  const read = (name: string) => readFileSync(new URL(name, root), 'utf8');
  const CLOUD = ['docs/ROUTINE-PROMPT.md', 'docs/WATCHDOG-PROMPT.md'];

  it.each(CLOUD)('%s never tells a cloud run to execute the sync, and says why it cannot', (name) => {
    const text = read(name);
    expect(text.length).toBeGreaterThan(1000);
    expect(text, 'a cloud session cannot run this — the GitHub proxy answers Projects v2 with 403')
      .not.toMatch(/node scripts\/board-sync\.mjs/);
    // Both files hard-wrap prose, so the two facts may sit on adjacent lines.
    expect(text, 'and the file must say so, or the next edit adds the command back').toMatch(/Projects v2[\s\S]{0,300}403|403[\s\S]{0,300}Projects v2/);
  });

  it('the routine reads the pulse in STEP 1 and carries it in the STEP 5 snapshot', () => {
    const text = read('docs/ROUTINE-PROMPT.md');
    const step1 = text.slice(text.indexOf('STEP 1 —'), text.indexOf('STEP 2 —'));
    const step5 = text.slice(text.indexOf('STEP 5 —'));
    expect(step1.length, 'STEP 1 must be found by its heading').toBeGreaterThan(200);
    expect(step5.length, 'STEP 5 must be found by its heading').toBeGreaterThan(200);
    expect(step1, 'STEP 1 must name the pulse issue').toContain('`board: heartbeat`');
    expect(step1, 'and treat a stale or unreadable pulse as a finding, not a pass').toMatch(/unparseable, missing or closed/);
    expect(step5, 'the heartbeat shape must carry the board line').toMatch(/^- board: pulse /m);
  });

  it('the watchdog reads the same pulse and bounds its age', () => {
    const text = read('docs/WATCHDOG-PROMPT.md');
    expect(text).toContain('`board: heartbeat`');
    expect(text, 'the age bound is the check').toMatch(/older than ~2 hours is a finding/);
    expect(text, 'an open issue is not a pulse').toMatch(/an open issue is not a pulse/);
  });

  it('CLAUDE.md and BACKLOG.md tell a session where the sync runs, where the token lives, and what feeds Blocked', () => {
    const claude = read('CLAUDE.md');
    expect(claude, 'the launchd definition is how it runs').toContain('scripts/board-sync.plist');
    expect(claude).toContain('.git/github-project-token');
    expect(claude, 'the token file sits beside the credentials file, never inside it').toMatch(/beside — never inside/);
    expect(claude, 'and a session must not be sent to the cloud for it').toMatch(/No cloud session can reach the board/);
    expect(read('BACKLOG.md'), 'the label list must carry `blocked`, or the Blocked column has no input').toMatch(/`blocked` \(/);
  });

  it('the launchd agent runs the script every 15 minutes from the clone', () => {
    const plist = read('scripts/board-sync.plist');
    expect(plist).toContain('<string>scripts/board-sync.mjs</string>');
    expect(plist).toMatch(/<key>StartInterval<\/key>\s*<integer>900<\/integer>/);
    expect(plist).toContain('<string>com.sky-academy.board-sync</string>');
    expect(plist, 'XML comments cannot contain a double hyphen; the doc inside must stay well-formed')
      .not.toMatch(/<!--[\s\S]*?--[\s\S]*?-->/);
  });

  it('the sync writes Status, Priority, archive, add and its own pulse — and never a label, an issue state or a PR', () => {
    const src = read('scripts/board-sync.mjs');
    expect(src.length).toBeGreaterThan(1000);
    expect(src, 'no label endpoint').not.toMatch(/\/labels\b/);
    // Scoped to the write calls: the JSDoc types above `plan()` legitimately spell `state:'open'|'closed'`.
    expect(src, 'no issue state in any write payload').not.toMatch(/restWrite\([^;]*\bstate\s*:/);
    expect(src, 'no pull-request write').not.toMatch(/restWrite\([^)]*\/pulls/);
    // One write helper, two call sites (create the pulse, edit the pulse). A third call is a new kind of
    // write and must be argued for here, in this rail.
    expect(src, 'the write helper must exist, or the count below counts nothing').toMatch(/const restWrite = async/);
    expect(src.match(/restWrite\(/g)?.length, 'restWrite has exactly two pulse call sites').toBe(2);
    expect(src, 'and the direct fetch calls are the GET pager, GraphQL and the write helper only')
      .not.toMatch(/fetch\([^)]*\/repos\/[^)]*(PATCH|PUT|DELETE)/);
    for (const forbidden of ['addLabelsToLabelable', 'removeLabelsFromLabelable', 'closeIssue', 'reopenIssue',
      'updateIssue', 'updatePullRequest', 'mergePullRequest', 'closePullRequest']) {
      expect(src, `the sync must never call ${forbidden}`).not.toContain(forbidden);
    }
    for (const allowed of ['updateProjectV2ItemFieldValue', 'clearProjectV2ItemFieldValue', 'archiveProjectV2Item', 'addProjectV2ItemById']) {
      expect(src).toContain(allowed);
    }
  });
});

/**
 * #195 — a merge swallowed a bullet onto the line above, and nothing could see it.
 *
 * PR #194 resolved a conflict in `CLAUDE.md` and `BACKLOG.md` against `a986b44` and lost the newline between
 * two bullets in each, giving `…Never review your own PR.- British English everywhere…` and `…nothing
 * republishes in its place.- The 2026-09-06 code review findings…`. No wording was lost; the *shape* was. The
 * British English rule stopped being a rule of its own and became the tail of the longest bullet in the file.
 *
 * Every rail in this file passed, because they all ask whether a phrase is present somewhere in the text. That
 * is the gap: these four documents are the mechanism this project runs on, they are written as very long
 * single-line paragraphs, and a contested merge of one is exactly where a newline goes missing unnoticed.
 *
 * The signature is exact rather than a matter of taste. A full stop followed immediately by `- ` occurs zero
 * times in all four files on every commit up to `a986b44`, and once in each of the two damaged files at
 * `ce95028`: the prose uses em dashes, and a real bullet begins a line. The same holds for the other list
 * markers these files use.
 *
 * Prove it red: join any bullet in any of the four files to the line above it.
 */
describe('a bullet is never swallowed onto the line above it (#195)', () => {
  const PROCESS = ['CLAUDE.md', 'BACKLOG.md', 'docs/ROUTINE-PROMPT.md', 'docs/WATCHDOG-PROMPT.md'];

  // A sentence end, then a list marker, mid-line: `.- ` or `. 1. `. Deliberately narrow — the marker must be a
  // hyphen or a number, and what precedes it a full stop, question or exclamation mark. Widening it to `*` or
  // `+`, or to a closing backtick or bracket, fires on the real prose of these files (```review`- or `debt`-labelled```,
  // ```(unit) + Playwright```, ```reads?* `docs/…````) — a rail that cries wolf on the documents it guards gets deleted.
  const SWALLOWED = /[.!?]\s?(?:-|\d{1,2}\.)\s+\S/;

  it.each(PROCESS)('%s has no bullet joined to the end of another line', (name) => {
    const text = readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
    expect(text.length, `${name} must be read from disk as text, or this rail checks nothing`)
      .toBeGreaterThan(300);
    const joined = text
      .split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => SWALLOWED.test(line))
      .map(({ line, n }) => `${name}:${n}: …${line.slice(Math.max(0, line.search(SWALLOWED) - 40), line.search(SWALLOWED) + 60)}…`);
    expect(joined, `a merge has joined a bullet to the line above (#195 — this is what #194 did)`).toEqual([]);
  });

  // The rail is only worth having if it would have caught the real thing, so assert on the real thing.
  it('catches the two joins #194 actually made', () => {
    expect(SWALLOWED.test('…No agent publishes it instead. Never review your own PR.- British English everywhere'))
      .toBe(true);
    expect(SWALLOWED.test('…nothing republishes in its place.- The 2026-09-06 code review findings are issues'))
      .toBe(true);
  });

  // And only if it stays quiet on the prose these files are actually written in.
  it('does not fire on the ordinary prose of these documents', () => {
    for (const ok of [
      '- **Workflow**: Refine → Develop (agent A, branch `feature|fix|chore/<n>-<slug>`)',
      'branch `chore/141-mobile-only-pr-matrix`, and the slug is lower case',
      'the trigger is still named "…— hourly dev run" from when it fired hourly',
      'Say "the issue stays open" instead; break the link (`#&#8203;<n>`, or "issue 44" in words)',
      '`priority:P1` before `priority:P2` before `priority:P3`; an issue with no `priority:*` label sorts last',
      'read it with `GET /repos/ugurozsahin/sky-academy/actions/runs?head_sha=<full head sha>`',
    ]) expect(SWALLOWED.test(ok), `false positive on: ${ok}`).toBe(false);
  });
});

/**
 * #180 — the agent skills and review agents this repository carries.
 *
 * Cloud sessions and scheduled runs see only three sources of skills: `.claude/` in the cloned repo, plugins
 * declared in settings, and skills enabled on the owner's account. A plugin needs an interactive install, which
 * no routine can perform, so everything is **vendored into the repo** and pinned to the commit it came from.
 *
 * Two failure modes this rail exists for. First, a vendored file that has quietly been edited or re-copied from
 * a different commit: the pin in its header is the only thing that says which upstream text this is, so a file
 * without one, or with the wrong SHA, is unpinned. Second, the skill list growing by accident — context cost is
 * per skill, not per byte, because every description sits in every turn's context. **The allow-list below is the
 * rail**: adding a skill or an agent means editing this list in the same pull request, which is where a reviewer
 * can see it and ask why.
 *
 * Prove it red: drop a stray directory into `.claude/skills/`, or change a SHA in a vendored header.
 */
describe('the vendored skills and agents are pinned, and the list is the allow-list (#180)', () => {
  const root = new URL('../../', import.meta.url);
  const SUPERPOWERS = { repo: 'obra/superpowers', sha: 'b36e0829c6d0' };
  const MARKETPLACE = { repo: 'anthropics/claude-plugins-official', sha: '3b600518a637' };

  /** Every skill directory that may exist, and where it came from (`null` = written for this project). */
  const SKILLS: Record<string, { repo: string; sha: string; path: string } | null> = {
    'add-guard-rail': null,
    'add-topic': null,
    'design-language': null,
    'frontend-design': { ...MARKETPLACE, path: 'plugins/frontend-design/skills/frontend-design' },
    'open-pr': null,
    'qa-screenshot': null,
    'review-pr': null,
    'verification-before-completion': { ...SUPERPOWERS, path: 'skills/verification-before-completion' },
    'using-git-worktrees': { ...SUPERPOWERS, path: 'skills/using-git-worktrees' },
    'systematic-debugging': { ...SUPERPOWERS, path: 'skills/systematic-debugging' },
    'test-driven-development': { ...SUPERPOWERS, path: 'skills/test-driven-development' },
  };
  /** Every agent definition that may exist. All three are vendored review agents (#180). */
  const AGENTS: Record<string, { repo: string; sha: string; path: string }> = {
    'pr-test-analyzer': { ...MARKETPLACE, path: 'plugins/pr-review-toolkit/agents/pr-test-analyzer.md' },
    'silent-failure-hunter': { ...MARKETPLACE, path: 'plugins/pr-review-toolkit/agents/silent-failure-hunter.md' },
    'type-design-analyzer': { ...MARKETPLACE, path: 'plugins/pr-review-toolkit/agents/type-design-analyzer.md' },
  };
  /** Vendored files kept byte-for-byte, with no header: a comment would have to go inside code or a licence. */
  const VERBATIM = [
    '.claude/skills/systematic-debugging/condition-based-waiting-example.ts',
    '.claude/skills/systematic-debugging/find-polluter.sh',
    '.claude/skills/frontend-design/LICENSE.txt',
  ];

  const dirs = (p: string) => readdirSync(new URL(p, root), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const files = (p: string) => readdirSync(new URL(p, root), { withFileTypes: true })
    .filter((e) => e.isFile()).map((e) => e.name).sort();
  const read = (name: string) => readFileSync(new URL(name, root), 'utf8');

  it('no skill directory and no agent exists that this list does not name', () => {
    expect(dirs('.claude/skills'), 'a skill nobody listed is a skill nobody reviewed (#180)')
      .toEqual(Object.keys(SKILLS).sort());
    expect(files('.claude/agents'), 'same for an agent definition')
      .toEqual(Object.keys(AGENTS).map((n) => `${n}.md`).sort());
  });

  it.each([
    ...Object.keys(SKILLS).map((n) => [`.claude/skills/${n}/SKILL.md`] as const),
    ...Object.keys(AGENTS).map((n) => [`.claude/agents/${n}.md`] as const),
  ])('%s has frontmatter with a one-line description', (file) => {
    const text = read(file);
    const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
    expect(front, `${file} must open with YAML frontmatter, or nothing loads it`).not.toBeNull();
    const description = /^description:[ \t]*(\S.*)$/m.exec(front![1]);
    expect(description, `${file} needs a description — it is the only line that reaches every turn's context`)
      .not.toBeNull();
    expect(description![1], 'and it must be one line, not a folded block').not.toMatch(/^[|>]/);
    expect(/^name:[ \t]*\S/m.test(front![1]), `${file} needs a name`).toBe(true);
  });

  it.each([
    ...Object.entries(SKILLS).filter(([, v]) => v).map(([n, v]) => [`.claude/skills/${n}/SKILL.md`, v!] as const),
    ...Object.entries(AGENTS).map(([n, v]) => [`.claude/agents/${n}.md`, v!] as const),
  ])('%s carries the source and the pin it was copied from', (file, src) => {
    const header = /<!-- vendored: (\S+) (\S+) @ ([0-9a-f]{12}) —/.exec(read(file));
    expect(header, `${file} is vendored, so it must say where from and at which commit (#180)`).not.toBeNull();
    expect(header![1], 'the source repository').toBe(src.repo);
    expect(header![2], 'the path within it').toContain(src.path);
    expect(header![3], 'and the pinned commit').toBe(src.sha);
  });

  it('every markdown file inside a vendored skill is pinned; the rest are kept verbatim and listed', () => {
    for (const [name, src] of Object.entries(SKILLS)) {
      if (!src) continue;
      for (const f of files(`.claude/skills/${name}`)) {
        const path = `.claude/skills/${name}/${f}`;
        if (f.endsWith('.md')) {
          expect(read(path), `${path} is vendored markdown without a pin`).toContain(`@ ${src.sha}`);
        } else {
          expect(VERBATIM, `${path} is not markdown: keep it byte-for-byte and list it here`).toContain(path);
        }
      }
    }
  });

  it('relative links inside the vendored skills resolve to a file that was copied with them', () => {
    for (const name of Object.keys(SKILLS)) {
      for (const f of files(`.claude/skills/${name}`).filter((x) => x.endsWith('.md'))) {
        const text = read(`.claude/skills/${name}/${f}`);
        const siblings = files(`.claude/skills/${name}`);
        for (const [, target] of text.matchAll(/\]\(([^):#]+\.(?:md|ts|sh))\)/g)) {
          expect(siblings, `.claude/skills/${name}/${f} links to ${target}, which was not copied with it`)
            .toContain(target.replace(/^\.\//, ''));
        }
      }
    }
  });
});

/**
 * The `open-pr` skill's load-bearing lines (#180).
 *
 * The allow-list above holds that the directory may exist and that a project-written skill declares a
 * `description`. It says nothing about the body, and #235 established what that costs: deleting `review-pr`'s
 * entire adoption section left the whole suite green. A skill is loaded by the run that is about to do the
 * job, so a rule quietly dropped from one is a rule that stops being read, with nothing going red.
 *
 * **This rail has now failed twice in the same direction, and the second failure is the instructive one.**
 *
 *  - The *first* cut pinned five strings out of a 7,956-byte file. #249's first reviewer replaced the body
 *    with a 3,033-byte stub carrying those five strings, each embedded in a sentence asserting the opposite
 *    rule, and the suite stayed green.
 *  - The *second* cut answered that with nineteen pins and a length floor — and #249's second reviewer showed
 *    that neither holds, because **every pin was a bare substring search over the whole file**. Two hunks of
 *    the genuine 8,765-character file, nothing deleted and nothing padded, passed 231/231:
 *      1. the pinned ownership clause kept *verbatim* and then continued — "…but the `author` field and the
 *         `Claude-Session:` commit trailer do tell you, so check them: if they are not yours, you may review
 *         and merge it in this same run";
 *      2. the bold **Owner-gated. Never routine-merged** block moved onto the *Tightening* bullet and the
 *         *Loosening* bullet given "Reviewed and merged like any other pull request" — a free-floating regex
 *         cannot see which bullet it matched.
 *    Both are live licences: a run loading either version merges its own work, or routine-merges a loosening.
 *
 * A longer pinned clause is a longer substring, not a stronger check. So the rule here is **scope, not
 * length**: the body is sliced on its `## N.` headings and every assertion is made *inside the section that
 * owns it*, which is what the previous docstring already claimed to do. That is what closes the bullet swap
 * directly, and it is why a padded full-file rewrite no longer helps — a stub with no headings slices to
 * nothing and fails every section assertion at once.
 *
 * Two smaller lessons from the same round, both encoded below:
 *
 *  - **Wrapping is prose, not a rule.** The second cut matched literal text including its line breaks, so
 *    rewrapping one bullet at a different column — no word changed — turned the suite red. A rail that goes
 *    red on an honest reflow teaches the next editor to reach for the rail rather than the prose, so every
 *    comparison here runs over whitespace-normalised text.
 *  - **The floor is a backstop and nothing more.** The second cut set it 38 characters below the file and its
 *    own failure message claimed it stopped stubs; it cannot, since a stub can be padded. The per-section
 *    pins are the substance. **Never lower this number to make a build pass** — the same rule CLAUDE.md sets
 *    for budget rails. If prose trimming trips it, the rail is telling you the file lost a section.
 *
 * What is pinned, per section, and what each cost before it was written down:
 *
 *  §1 Claim the issue before branching — #27 was built twice.
 *  §2 The label→prefix mapping, and the refusal marker **anchored**: `ci.yml` greps `^BRANCH: PUSH REFUSED`,
 *     so a skill permitting it mid-sentence sends the author into the one spelling `branch-name` refuses.
 *  §3 `Closes` finishes, `Part of` defers (#26 reopened by hand); the keyword binds **inside a negation**,
 *     which is the half that actually shut issue 44 (#144); backticks are not a fix; the body is checked with
 *     `scripts/review-gate.mjs`, whose `closes: nothing` is a result and not an all-clear.
 *  §4 `e2e not run (env)` — a prescribed spelling that nothing in `tests/` held anywhere before this, so a
 *     run whose skill had lost it would report "tests pass" for a suite that never executed — and desktop as
 *     the author's job (#141).
 *  §5 The **newest** run, not merely a green one on the head SHA: a stale tick sits on the same SHA, which is
 *     the #150 incident. Plus the fact that undrafting fires a run of its own (#159). Plus ownership, pinned
 *     as the sentence an inversion cannot keep — "you know it is yours because you opened it this run" — with
 *     a negative assertion beside it, because a positive pin can always be appended to.
 *  §6 Loosening is owner-gated, asserted **within the Loosening bullet**, with Tightening required to carry
 *     the other text and forbidden to carry the gate.
 *  §7 The three-file rule and #178's "records have readers".
 *
 * This is still text matching: it sees these spellings and nothing else, and a negative assertion is narrow
 * by nature — it forbids one phrasing of one inversion, not the idea. A rewrite that keeps a rule and changes
 * its words will fail; the right answer then is to update the rail in the same commit, never to drop the rule.
 *
 * Prove it red: delete any of the seven sections; invert the rule a section carries; swap the Tightening and
 * Loosening bullets; append the author-field inversion to §5; or replace the body with a stub, padded or not.
 * All of those are red. An honest reflow is green.
 */
describe('the open-pr skill keeps the rules that were paid for (#180)', () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  const raw = read('.claude/skills/open-pr/SKILL.md');
  /** Wrapping is prose, not a rule — see the docstring. Normalise it away before every comparison. */
  const flat = (t: string) => t.replace(/\s+/g, ' ').trim();
  /** The body sliced on its `## N.` headings, so a pin cannot be satisfied by text in a different section. */
  const SECTIONS = new Map<number, string>();
  for (const m of raw.matchAll(/^## (\d+)\.[^\n]*\n([\s\S]*?)(?=^## \d+\.|$(?![\s\S]))/gm)) {
    SECTIONS.set(Number(m[1]), flat(m[2]));
  }
  /** One numbered section's text. Throws rather than returning '' — an absent section must not read as a pass. */
  const S = (n: number): string => {
    const text = SECTIONS.get(n);
    if (!text) throw new Error(`open-pr/SKILL.md has no section ${n} — the rail cannot hold a section that is not there`);
    return text;
  };
  /** One `- **Label** …` bullet out of a section, up to the next bullet: which bullet carries a rule is the rule. */
  const bullet = (text: string, label: string): string =>
    new RegExp(`- \\*\\*${label}\\*\\*(.*?)(?=- \\*\\*|$)`).exec(text)?.[1] ?? '';

  it('slices into the seven sections the pins below address', () => {
    // The slicer's own vacuity guard: a regex that matched nothing would make every assertion below throw for
    // the wrong reason, and a file reorganised into different headings must be a visible failure, not a quiet one.
    expect([...SECTIONS.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('is long enough to be the skill rather than a stub', () => {
    // Backstop only — the per-section pins are the substance, and a stub can be padded past any floor.
    // NEVER lower this to make a build pass (CLAUDE.md's rule for budget rails applies): if prose trimming
    // trips it, a section has gone missing. Measured in characters, not bytes — the file has multi-byte
    // punctuation in it, so `wc -c` reads larger than `raw.length`.
    expect(raw.length, 'open-pr/SKILL.md is too short to be the skill').toBeGreaterThan(6_000);
  });

  it('§1 tells the author to claim the issue before branching', () => {
    expect(S(1), 'comment on the issue first; #27 was built twice')
      .toContain('One comment on the issue before you branch');
  });

  it('§2 names the branch convention, the label that picks the prefix, and anchors the refusal marker', () => {
    expect(S(2), 'the three prefixes (#160)').toContain('feature/<n>-<slug>');
    expect(S(2), 'and which label picks which — the prefix follows the change, not the finding')
      .toContain('`fix/` for a `bug` or `playtest` issue, `feature/` for an `enhancement`');
    // ci.yml greps '^BRANCH: PUSH REFUSED'. A skill permitting it mid-sentence sends the author into the one
    // spelling branch-name refuses, so the anchoring — not the marker — is what has to be pinned.
    expect(S(2), 'the marker must be required to begin a line')
      .toContain('begin a line of the pull request body with `BRANCH: PUSH REFUSED`');
    expect(S(2), 'and the reason: ci.yml anchors it').toContain('greps `^BRANCH: PUSH REFUSED`');
  });

  it('§3 keeps Closes/Part of, the negation trap, backticks, and the gate script', () => {
    expect(S(3), '`Closes` finishes an issue — nothing less')
      .toContain('`Closes #<n>` when the issue is **finished**');
    expect(S(3), 'and `Part of` is what a deferral gets, which #26 was reopened by hand for')
      .toContain('`Part of #<n>` when you are deferring any of it');
    // The half that actually shut issue 44: PR #139's keyword sat inside the sentence denying it (#144).
    expect(S(3), 'a keyword binds inside a negation — the sentence written to keep an issue open is the close')
      .toContain('inside a negation, a quotation, or the very sentence explaining why you are not closing it');
    expect(S(3), 'the quoting trick fails in both directions, and that is the half authors get wrong')
      .toContain('**Backticks are not a fix** — the parser ignores code spans');
    expect(S(3), 'the body is checked by the same parser GitHub uses, not by eye')
      .toContain('node scripts/review-gate.mjs');
    expect(S(3), 'and `closes: nothing` must not read as an all-clear')
      .toContain('**`closes: nothing` is a result, not an all-clear.**');
  });

  it('§4 keeps a non-run distinguishable from a pass, and desktop the author’s job', () => {
    expect(S(4), 'the exact phrase, so an unrun suite is never reported as green')
      .toContain('e2e not run (env)');
    expect(S(4), 'and that the marker records a gap rather than closing one')
      .toContain('**That marker records a gap; it does not close one.**');
    expect(S(4), 'nothing on the pull request runs desktop (#141), so the author is the only one who will')
      .toContain('**If your change is viewport-sensitive, run desktop yourself.**');
    expect(S(4), 'and a diff CI will not run e2e on is not licence to skip it (#176)')
      .toContain('that is not licence to skip it');
  });

  it('§5 requires the newest run, says the undraft fires its own, and keeps ownership unprovable', () => {
    // #150 was merged on a tick four merges of `main` stale. A stale run sits on the same head SHA as a fresh
    // one, so "green on the head SHA" cannot tell them apart — "newest" is the whole criterion.
    expect(S(5), 'the #150 criterion is the newest run, not any green one on the head')
      .toContain('the **newest** CI run on the current head is green');
    expect(S(5), 'and undrafting starts a run of its own, so the author’s green is never the handover evidence')
      .toContain('Undrafting fires a run of its own');
    expect(S(5), 'the author is never the reviewer here')
      .toContain('**Do not review or merge your own pull request.**');
    // The sentence an inversion cannot keep. A pinned clause can always be *continued* — the second cut's
    // ownership pin was kept verbatim and then contradicted — so this pins the conclusion, not the premise.
    expect(S(5), 'ownership is not derivable from the API; only "I opened it this run" establishes it')
      .toContain('you know it is yours because you opened it this run, and that is the only evidence there is');
    // And the matching negative, narrow by nature but aimed at the one inversion this file has already seen.
    expect(S(5), 'the author field is not evidence of ownership — one token serves every agent and the owner')
      .not.toMatch(/check (?:the |them|it)?.{0,20}`?author`? field/i);
  });

  it('§6 keeps the loosening gate on the Loosening bullet, not merely somewhere in the section', () => {
    const loosening = bullet(S(6), 'Loosening'), tightening = bullet(S(6), 'Tightening');
    expect(loosening, '§6 has no Loosening bullet').not.toBe('');
    expect(tightening, '§6 has no Tightening bullet').not.toBe('');
    // A free-floating regex cannot see which bullet it matched: swapping the two bullets' text left the
    // second cut green while the skill said a loosening may be routine-merged (#249 review).
    expect(loosening, 'a skill that let a run merge its own loosening is a licence nothing checks')
      .toContain('**Owner-gated. Never routine-merged, however obviously right it looks.**');
    expect(tightening, 'and tightening is the one a run may merge')
      .toContain('Reviewed and merged like any other pull request, by a run that did not open it');
    expect(tightening, 'the gate must not migrate onto the tightening bullet').not.toContain('Owner-gated');
  });

  it('§7 keeps the three-file rule and where a record goes', () => {
    expect(S(7), 'CLAUDE.md, BACKLOG.md and ROUTINE-PROMPT.md change together, and rails hold them to it')
      .toContain('If you change one, change all three in the same pull request');
    expect(S(7), 'and #178: a record with no reader is not written')
      .toContain('**records have readers** (#178)');
  });
});

/**
 * The `add-guard-rail` skill's load-bearing lines (#180).
 *
 * This is the skill a run loads when it is about to write a rail, so a rule dropped from it is a rule that
 * stops being read at the exact moment it applies — with nothing going red, which is the failure `open-pr`'s
 * rail above was built (twice) to answer. The method is the one that round arrived at, and it is copied
 * deliberately rather than reinvented: **slice the body on its `## N.` headings and assert inside the section
 * that owns the rule**, because every escape found so far was a bare substring satisfied by text somewhere
 * else in the file.
 *
 * What is pinned, per section, and why each is load-bearing rather than merely true:
 *
 *  §1 A rail names its incident. Without that the next editor who meets it red deletes it instead of asking,
 *     which is how a rail is lost without anyone deciding to lose it.
 *  §2 The four homes, asserted **per table row** rather than anywhere in the section — which home a kind of
 *     rail belongs to *is* the rule, and a free-floating match cannot see which row it landed in. Plus the
 *     one placement that produces a permanently green rail: Vitest reads CSS as an empty string, so a CSS
 *     rail written in `guardrails.test.ts` passes vacuously for ever. That sentence is the whole reason the
 *     e2e spec has a `guard rail:` section at all.
 *  §3 Assert that the rail read what it claims to read. A glob matching nothing and a file renamed out from
 *     under a path both look exactly like a pass.
 *  §4 Proved red by restoring the bug *before* it is made green — the rule CLAUDE.md states and this file
 *     demonstrates — together with the limit that makes it more than a slogan: a text rail cannot see a
 *     mutation that keeps every identifier (#205's `showCertificateFullscreen;`), so a behavioural test has
 *     to sit beside it.
 *  §5 **The one-directional budget rule, with a negative beside it.** This is the highest-value pin in the
 *     file: a skill saying a budget may be raised when the rise is justified is a live licence to switch off
 *     any rail in the repository, and it would read perfectly reasonably. The positive pin cannot hold that
 *     on its own — a pinned clause can always be *continued* — so a detector for the permission itself runs
 *     beside it, over the **whole file** (below).
 *  §6 Scope, not length, and the slicer that **throws** on a missing section. An absent section returning ''
 *     makes every assertion over it pass, which is the vacuity failure of §3 one level up.
 *  §7 Both runs in the body, and the rule that a rail is never weakened quietly.
 *
 * **The first cut of this rail was blocked, and all four objections reproduced.** Each is a way a scoped
 * text rail decays that the `open-pr` round had not yet met, so each is written down here rather than only
 * fixed:
 *
 *  1. **A negative in one voice is not a negative.** The first cut forbade `may … raise` and nothing else, so
 *     `a budget may be **raised** when the rise is justified` walked straight past it — the exact sentence
 *     this docstring names as the threat, because `raise\b` does not match `raised`. `Raising N is
 *     acceptable` passed too. A single phrasing is not a rule, and the fix is not a longer alternation
 *     either: `WIDENER` below pairs a *raise word* with a *permission word* inside one sentence, and
 *     **self-tests positively** — a `.not.toMatch` whose pattern matches nothing passes for ever, which is
 *     §3's own vacuity failure applied to a negative, and the case §3 did not cover.
 *  2. **A duplicate heading silently replaces a section.** `SECTIONS.set` is last-write-wins and the keys are
 *     a set, so `1,2,3,4,5,5,6,7` satisfied `toEqual([1..7])`. Gutting §5 to a licence and appending the
 *     genuine §5 at the end as a decoy left every pin green *and the file longer*: the reader meets the
 *     licence, the rail reads the decoy. Duplicates are now collected and asserted empty.
 *  3. **Per-row scoping is only as good as the row lookup.** The first cut pinned three of §2's four rows and
 *     never row 1 — the home most rails go to — so it could be pointed at the vacuous one or deleted
 *     outright. Worse, `row()` took the first *substring* hit, which is the "which row did I match" failure
 *     the scoping was supposed to end, moved down one level. First cells are now compared **exactly**, the
 *     full list is pinned in order, and a lookup matching other than exactly one row fails.
 *  4. **Text outside every section is text outside every pin.** The preamble is not sliced, so a licence
 *     sentence above `## 1.` was green. The widener detector therefore runs over the whole file, not §5, and
 *     the preamble's substance is pinned.
 *
 * **A second review round found three more, and the first is the one to learn from.** The fix above turned
 * the licence detector from one phrasing into a raise word paired with a *permission* word — and every rule
 * in this skill is written as a bare imperative, which has no modal. So `Raise N to the new count when a
 * refactor adds cases` was green while the test asserting it was called *"in every voice one would be
 * written in"*. That claim, and a matching "in any voice" in this docstring, were false as written; both are
 * gone. The detector now anchors on a **budget symbol** and vetoes on **negation**, which is what lets the
 * vocabulary be wide without firing on the prose of a document about moving rails about:
 *
 *  5. **A negative with no polarity is loud in the wrong direction.** `It is never legitimate to raise N`
 *     went red — an author making §5 *more* emphatic met an inexplicable failure, which is exactly how §6
 *     says a rail teaches people to edit the rail rather than the prose. The real file survived only because
 *     the pinned clause happens to carry no permission word: luck, not design.
 *  6. **Heading text is outside every slice.** The slicer discarded the heading tail, so the rule was
 *     reversible in title form — `## 5. A budget number only ever goes down` → `## 5. A budget number moves
 *     with the count`, green. That is finding 4 of the first round in the instance that matters most, which
 *     is worth saying plainly: the lesson was written into §6 and the same class of hole was left open one
 *     line above it.
 *  7. **The guard that is a separate `it` is a guard an `it.only` can skip.** The duplicate-heading check now
 *     lives inside `S()`, so a decoy fails every pin rather than one test.
 *
 * The limit, stated here because §7 of the skill asks for exactly this and a rail that will not say it of
 * itself has no standing to ask: **these are containment checks, and containment cannot prove the absence of
 * a sentence contradicting what it found** (#257). The detector pairs vocabulary, not meaning — a licence
 * written without a budget word, or with a raise word this list does not carry, would pass, and the sentence
 * splitter is a regex over full stops. What it now covers is stated by the two self-tests below rather than
 * by adjectives here, because that is the only claim that cannot rot. A rewrite that keeps a rule and
 * changes its words will fail here; the answer then is to update this rail in the same commit, never to drop
 * the rule.
 *
 * Prove it red: delete any of the seven sections, give one a duplicate heading, or add an unnumbered one;
 * reverse a section's heading text; change or delete any row of §2's table; write a licence to raise a budget
 * anywhere in the file, imperative or modal; drop one of §6's four lessons; gut the preamble; replace the
 * body with a stub, padded or not.
 */
describe('the add-guard-rail skill keeps the rules that were paid for (#180)', () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  const raw = read('.claude/skills/add-guard-rail/SKILL.md');
  /** Wrapping is prose, not a rule (the lesson of #249's second cut). Normalise it away before comparing. */
  const flat = (t: string) => t.replace(/\s+/g, ' ').trim();
  /** The body sliced on its `## N.` headings, both flattened and raw — the table in §2 needs its newlines. */
  const SECTIONS = new Map<number, { flat: string; raw: string; heading: string }>();
  /** Headings seen twice. `set` is last-write-wins and the keys are a set, so a decoy copy is invisible here. */
  const DUPLICATE_HEADINGS: number[] = [];
  for (const m of raw.matchAll(/^## (\d+)\.([^\n]*)\n([\s\S]*?)(?=^## \d+\.|$(?![\s\S]))/gm)) {
    const n = Number(m[1]);
    if (SECTIONS.has(n)) DUPLICATE_HEADINGS.push(n);
    SECTIONS.set(n, { flat: flat(m[3]), raw: m[3], heading: flat(m[2]) });
  }
  /** Every `## ` heading in the file, numbered or not: an `## Appendix` after §7 is invisible to the keys guard. */
  const ALL_HEADINGS = [...raw.matchAll(/^## ([^\n]*)/gm)].map((m) => flat(m[1]));
  /**
   * Everything above `## 1.` — sliced into no section, so covered by no pin unless one is put here. A missing
   * `## 1.` makes `search` answer -1, and `slice(0, -1)` would quietly hand back the whole document, turning a
   * scoped pin into whole-file containment; the index is checked rather than trusted.
   */
  const PREAMBLE_END = raw.search(/^## 1\./m);
  const PREAMBLE = PREAMBLE_END < 0 ? '' : flat(raw.slice(0, PREAMBLE_END));
  /**
   * One section's text. Throws on absent *and* on empty — an empty body satisfies every `toContain`-free pass
   * — and on a duplicated heading, so a decoy copy fails **every** pin rather than only the one `it` that
   * checks for it. That separation was the gap: an `it.only` or a `.skip` elsewhere in this block would
   * otherwise leave all the pins green against a file whose real section had been gutted.
   */
  const S = (n: number): string => {
    if (DUPLICATE_HEADINGS.length) throw new Error(`add-guard-rail/SKILL.md repeats heading(s) ${DUPLICATE_HEADINGS.join(', ')} — the pinned section may be a decoy`);
    const s = SECTIONS.get(n);
    if (!s?.flat) throw new Error(`add-guard-rail/SKILL.md has no section ${n} — the rail cannot hold a section that is not there`);
    return s.flat;
  };
  /**
   * A section's markdown table as trimmed cells per row, the `| --- |` separator dropped — **the header row is
   * kept**, so a pin over the first column carries its label. Dropping it instead would mean deleting the real
   * header silently promotes row 1 into its place and loses a home with nothing going red.
   *
   * Throws on a missing section for the reason §6 of the skill gives: a slicer that answers `[]` makes every
   * assertion over it pass, and the next pin added here would be vacuous. Both call sites are protected today;
   * this is so the third one is too.
   */
  const table = (n: string | number): string[][] => {
    const s = SECTIONS.get(Number(n));
    if (!s) throw new Error(`add-guard-rail/SKILL.md has no section ${n} — a table cannot be read from a section that is not there`);
    return s.raw.split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('|'))
      .map((l) => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()))
      .filter((cells) => !/^-+$/.test(cells[1] ?? ''));
  };
  /**
   * One table row, keyed on its first cell **exactly**. The first cut used `includes`, so the first substring
   * hit won and a row could absorb another's key — the "which row did I match" failure per-row scoping exists
   * to end, one level down. Other than exactly one match is a failure, never a silent `''`.
   */
  const row = (n: number, key: string): string => {
    const hits = table(n).filter((cells) => cells[0] === key);
    expect(hits, `§${n}'s table must have exactly one row whose first cell is ${key}`).toHaveLength(1);
    return flat(hits[0].slice(1).join(' '));
  };

  /**
   * A sentence that would let a budget get bigger. Three cuts to get here, and the shape of each failure is
   * the lesson:
   *
   *  1. `may … raise` — one phrasing. `may be raised` walked past it, which is the wording this block's own
   *     docstring uses to *name* the threat.
   *  2. a raise word **and a permission word** — two vocabularies, which reads like a rule but needs a modal.
   *     Every other line in this skill is a bare imperative ("Lower N when you remove a case"), so the
   *     natural way to write the licence was the one shape it could not see: *"Raise N to the new count when
   *     a refactor adds cases."* A test named "in every voice" was green over exactly that.
   *  3. what is here: a **budget symbol** and a **bigger word** in one sentence, **unless the sentence
   *     forbids it**. Anchoring on the budget is what lets the vocabulary be wide without firing on the prose
   *     of a document about moving rails about — "A rail can be lifted into the e2e spec" names no budget.
   *     The polarity veto is the other half: without it `It is never legitimate to raise N` went red, so an
   *     author making §5 *more* emphatic met an inexplicable failure — precisely how §6 says a rail teaches
   *     people to edit the rail instead of the prose.
   *
   * No permission word is required any more, so the imperative is covered. Self-tested in both directions
   * below, on the sentences that escaped cut 2 and on the honest prose that cut 2 fired on.
   */
  const BUDGET = /\bN\b|budget|\bnumbers?\b|\bcounts?\b|threshold|\bfloors?\b/i;
  // `set` is the verb only — `\bset\b` alone fired on "its keys are a set", in the §6 bullet about decoy
  // headings, where "the heading number" supplied the budget word. A rail red on its own prose is the defect
  // this whole section is about, so the verb is matched with its object rather than bare.
  const BIGGER = /\brais\w*|increas\w*|bump\w*|widen\w*|grow\w*|\bris(?:e|es|ing)\b|updat\w*|adjust\w*|\bset(?:s|ting)?\s+(?:it|its|the|a|N)\b|track\w*|reflect\w*|loosen\w*|relax\w*|lift\w*|\bgoes? up\b/i;
  const FORBIDS = /\bnever\b|\bnot\b|n't\b|\bcannot\b|\bno\b|\bnothing\b|forbid\w*|\bonly ever\b|one-directional/i;
  const widening = (t: string) => flat(t).split(/(?<=[.!?])\s+/)
    .filter((s) => BUDGET.test(s) && BIGGER.test(s) && !FORBIDS.test(s));

  it('slices into the seven sections the pins below address, each heading exactly once', () => {
    // The slicer's own vacuity guard: a file reorganised into different headings must fail visibly here
    // rather than making every assertion below throw for the wrong reason.
    expect([...SECTIONS.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // And the half the keys cannot show. `set` is last-write-wins, so a gutted §5 followed by a verbatim
    // decoy `## 5.` at the end of the file satisfied every pin below while the reader met the gutted one —
    // and made the file *longer*, clearing the floor comfortably.
    expect(DUPLICATE_HEADINGS, 'a second `## N.` heading makes the pinned section a decoy the reader never sees')
      .toEqual([]);
    // And no unnumbered heading: an `## Appendix` after §7 is invisible to the keys guard and its text lands
    // inside §7's slice, so a licence written there is covered by nothing.
    expect(ALL_HEADINGS.filter((h) => !/^\d+\./.test(h)), 'the file has exactly seven numbered sections and no others')
      .toEqual([]);
  });

  it('the heading of each section carries its rule, not just the body', () => {
    // The slicer discarded the heading tail, so every pin read the body only — which made the rule reversible
    // in title form: `## 5. A budget number only ever goes down` → `## 5. A budget number moves with the
    // count` was green. This is the 16:49Z review's own finding 4 (text the slicer does not reach is text no
    // pin covers), in the instance that matters most.
    const H = (n: number) => SECTIONS.get(n)?.heading ?? '';
    expect(H(1)).toContain('Name the incident');
    expect(H(2)).toContain('homes');
    expect(H(3)).toContain('A rail that cannot fail is worse than no rail');
    expect(H(4)).toContain('Prove it red by restoring the bug, before you make it green');
    expect(H(5), 'the direction is the rule, and it belongs in the title too')
      .toContain('A budget number only ever goes down');
    expect(H(6)).toContain('Scope, not length');
    expect(H(7)).toContain('both runs');
  });

  it('the widener-detector fires on a licence, imperative and passive alike', () => {
    // A detector that matches nothing passes for ever — §3's own vacuity failure, applied to a negative. The
    // first four escaped cut 1 (active voice only); the last four escaped cut 2, which needed a modal and so
    // was blind to the imperative — the voice every other rule in this skill is written in.
    for (const licence of [
      'In practice a budget may be raised when the rise is justified in the pull request body.',
      'Raising N is acceptable when a refactor legitimately adds cases.',
      'Increasing N is acceptable where the reviewer signs off on the reason.',
      'You may raise N when justified.',
      'Raise N to the new count when a refactor adds cases, and set it wherever reality puts it.',
      'Budgets track reality: when a refactor adds cases, update N to the new count.',
      'A rise in N is fine when the refactor that caused it is named in the body.',
      'Raise N when a refactor adds cases.',
    ]) expect(widening(licence), `a licence went undetected: ${licence}`).toHaveLength(1);
  });

  it('and stays quiet on a prohibition, and on prose about moving rails about', () => {
    // The other half of the same defect. `RAISE && PERMISSION` had no polarity, so making the rule *more*
    // emphatic turned the suite red; and without the budget anchor, ordinary sentences about relocating a
    // rail collided with it — in a document whose whole subject is where rails go.
    for (const honest of [
      'Lower N when you remove a case. Never raise it to make a build pass.',
      'It is never legitimate to raise N.',
      'A rail can be lifted into the e2e spec when it needs a browser.',
      'Relaxing the glob is fine when the walk still reaches the file.',
      'A budget number only ever goes down.',
    ]) expect(widening(honest), `false positive on: ${honest}`).toEqual([]);
  });

  it('nothing anywhere in the file permits raising a budget', () => {
    // Over the WHOLE file rather than §5: the preamble is sliced into no section, so a licence sentence
    // above `## 1.` was green against every per-section pin the first cut had.
    expect(widening(raw), 'a skill permitting a raised budget is a licence to switch off any rail here')
      .toEqual([]);
  });

  it('the preamble states what a rail is for, so it cannot be gutted or repurposed', () => {
    expect(PREAMBLE, 'the distinction the whole skill rests on').toContain('A guard rail is not test coverage');
    expect(PREAMBLE, 'and what a rail is instead')
      .toContain('one specific mistake we have already made cannot come back silently');
  });

  it('is long enough to be the skill rather than a stub', () => {
    // Backstop only — the per-section pins are the substance, and a stub can be padded past any floor.
    // NEVER lower this to make a build pass: if prose trimming trips it, a section has gone missing.
    //
    // Note the direction. A *budget* is a maximum and only ever comes down; this is a minimum, so tightening
    // it means raising it, and 6,500 against a 9,691-character file was 33% of slack doing nothing. Raised to
    // a real backstop with room for honest trimming.
    expect(raw.length, 'add-guard-rail/SKILL.md is too short to be the skill').toBeGreaterThan(9_000);
  });

  it('§1 requires the rail to name the incident it prevents', () => {
    expect(S(1), 'a rail whose comment names no incident is deleted by whoever next meets it red')
      .toContain('**A rail with no incident behind it is a style preference**');
  });

  it('§2 lists exactly the four homes, and nothing is dropped or renamed', () => {
    // The first cut pinned three rows and never row 1 — the home most rails go to — so it could be pointed
    // at the vacuous one or deleted outright, both green. Pinning the whole first column closes deletion,
    // renaming, a key absorbed into another row, and a fifth home nobody reviewed.
    //
    // Sorted, because row *order* is presentation: which row comes first carries no rule, and the same
    // argument that made every comparison here whitespace-normalised says a rail must not go red on an
    // honest reorder. What each row is *for* is the rule, and the test below holds that per row.
    expect(table(2).map((cells) => cells[0]).sort(), 'the four homes a rail can live in, and the header above them')
      .toEqual([
        'Where',
        '`tests/unit/guardrails.test.ts`',
        '`tests/e2e/game.spec.ts`, named `guard rail: …`',
        '`tests/unit/british.test.ts`',
        'a job in `.github/workflows/ci.yml`',
      ].sort());
  });

  it('§2 says what each home is for, and rules out the one that is green for ever', () => {
    // Which row a purpose sits in is the rule: swapping two purposes between rows changes where a rail is
    // told to go while every free-floating string in the section is still present.
    expect(row(2, '`tests/unit/guardrails.test.ts`'), 'the default home is text and structure, not behaviour')
      .toContain('text and structure');
    expect(row(2, '`tests/e2e/game.spec.ts`, named `guard rail: …`'), 'the e2e spec is for a rail needing a browser')
      .toContain('browser');
    expect(row(2, '`tests/unit/british.test.ts`'), 'game wording is enforced separately (#47)').toContain('wording');
    expect(row(2, 'a job in `.github/workflows/ci.yml`'), 'a workflow job is for what the tests cannot see (#160)')
      .toContain('#160');
    // The placement fact that makes the e2e section necessary at all: Vite's css plugin answers `?raw` with
    // an empty string outside the browser, so a CSS rail written in Vitest reads nothing and is green for ever.
    expect(S(2), 'a CSS rail in Vitest is a permanently green tick asserting the thing is safe')
      .toContain('a CSS rail written in Vitest passes vacuously');
    expect(S(2), 'and it must say where such a rail goes instead').toContain('CSS rails live in the e2e spec');
  });

  it('§3 requires the rail to assert that it read what it claims to read', () => {
    expect(S(3), 'a vacuous rail is not a no-op, it is a green tick asserting safety')
      .toContain('A vacuous rail is not a neutral no-op: it is a green tick asserting the thing is safe');
    expect(S(3), 'so the read itself is asserted first').toContain('**assert first that it read it**');
  });

  it('§4 keeps red-before-green, and says what a text rail cannot see', () => {
    expect(S(4), 'CLAUDE.md’s rule: the bug is restored and the rail watched to fail')
      .toContain('put the bug back and watch the rail fail');
    // The half that makes it more than a slogan: #205 shipped past a text rail with every identifier intact.
    expect(S(4), 'a text rail is blind to a mutation that keeps the identifiers and changes the behaviour')
      .toContain('**A text rail cannot see a mutation that keeps every identifier and changes what happens**');
    expect(S(4), 'and the answer to that is a behavioural test beside it')
      .toContain('a behavioural test has to sit beside it');
  });

  it('§5 keeps the budget rule one-directional, and does not permit raising one', () => {
    expect(S(5), 'a budget records debt that exists today, and comes down as the debt does')
      .toContain('Lower N when you remove a case');
    expect(S(5), 'the rule that is the whole point of a budget rail')
      .toContain('**Lower N when you remove a case. Never raise it to make a build pass**');
    expect(S(5), 'and why: a raised budget is not a new value, it is the rail switched off')
      .toContain('it is the rail switched off');
    // The negative that belongs with these pins lives in `nothing anywhere in the file permits raising a
    // budget` above, over the whole file rather than this section: the first cut scoped it to §5 and a
    // licence sentence in the unsliced preamble was green.
  });

  it('§6 answers substring escapes with scope, and makes a missing section throw', () => {
    expect(S(6), 'the escape itself: a pin is a substring of the whole file, so the file can contradict it')
      .toContain('a pinned string is a substring of the whole file');
    expect(S(6), 'and the answer is scope rather than a longer pin')
      .toContain('A longer pinned clause is a longer substring, not a stronger check');
    expect(S(6), 'assertions are made inside the part that owns the rule')
      .toContain('assert inside the part that owns the rule');
    // An absent section returning '' makes every assertion over it pass — §3's vacuity failure one level up.
    expect(S(6), 'the slicer must throw on a missing section, not skip it')
      .toContain('**throws when the section is missing**');
    expect(S(6), 'a floor is a backstop, and it is a budget number too').toContain('so it does not go down either');
    // The three lessons this pull request's own review rounds paid for. The rail block records them in its
    // docstring, but the skill is the artefact a future run actually loads, so they have to be held here too
    // — deleting all three left the suite green and the file only 1,195 characters shorter.
    expect(S(6), 'the decoy-heading escape (review round 1, finding 2)')
      .toContain('**A repeated heading is a decoy.**');
    expect(S(6), 'text the slicer does not reach (review round 1, finding 4; round 2, finding 3)')
      .toContain('**Text outside every slice is text outside every pin.**');
    expect(S(6), 'and a negative that matches nothing (review round 1, finding 1)')
      .toContain('**Self-test a negative.**');
  });

  it('§7 asks for both runs in the body, and forbids weakening a rail quietly', () => {
    expect(S(7), 'the mutation that restored the bug and the failure it produced, then the same rail green')
      .toContain('**both runs**');
    expect(S(7), 'the rail says in its own comment what it cannot catch (#256, #257)')
      .toContain("Finish the rail's comment with its limits");
    expect(S(7), 'a rail that is wrong is fixed in the open, with the reason in the commit')
      .toContain('**If a rail blocks you and you think it is wrong, say so in the pull request.**');
    expect(S(7), 'and never quietly').toContain('Never weaken or delete one quietly');
  });
});

/**
 * #177 — a run with nothing to review may take a second item, and the shape of that permission is the part
 * that decays.
 *
 * The owner's reasoning (session, 2026-09-10) is that development was never the bottleneck here — review and
 * conflict are — so the rule fills *idle* capacity and nothing else. That makes it **a condition, not a
 * quota**, and the condition is self-limiting by construction: the moment second items produce a backlog,
 * condition 1 stops being true and the run goes back to reviewing. Rewrite it as "two items per run" and the
 * property is gone while the words still look like the rule.
 *
 * Two ways it fails quietly, and a rail each.
 *
 * First, condition 1 read as "no open pull requests at all". That is the reading that makes the rule never
 * fire — a run has almost always just opened one of its own — so the files have to say in as many words that
 * a pull request the run may not act on is not one it is skipping. Second, one pull request closing two
 * issues: they must be reviewable, mergeable and blockable independently, and #139 is what a single body
 * carrying two issue references does on its own.
 *
 * The three files each speak to a different reader — CLAUDE.md to an interactive session, BACKLOG.md to
 * whoever looks up the labels, docs/ROUTINE-PROMPT.md to the routine itself — and all three say they change
 * together, the same way they do for the freeze lift and the record-routing rule.
 *
 * Prove it red: drop the rule from one file, reword condition 1 as "no open pull requests", or turn it into a
 * quota.
 */
describe('a run with nothing to review may take a second item, in all three process files (#177)', () => {
  // Match against prose with its markdown taken off, not against the raw bytes. Three of these rails failed
  // on their own subject first time round — `**start of the run**`, `*not* "no open…"`, and a sentence the
  // line wrap split — which is a rail testing the author's formatting rather than the rule. Emphasis markers
  // go, curly quotes fold to straight, and every run of whitespace becomes one space, so a re-wrap or a bolded
  // phrase cannot turn a rule that is still stated into a red build.
  const flat = (s: string) =>
    s.replace(/[*_`]/g, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ');
  const doc = (name: string) => flat(readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8'));
  const FILES = ['CLAUDE.md', 'BACKLOG.md', 'docs/ROUTINE-PROMPT.md'];

  it.each(FILES)('%s carries the rule, and its four conditions', (name) => {
    const text = doc(name);
    expect(text.length, 'a vacuous rail is worse than none').toBeGreaterThan(500);
    expect(text, 'the file must state the permission itself')
      .toMatch(/a run with nothing to review may take a second item/i);
    expect(text, 'and that it is one more item, as its own pull request')
      .toMatch(/second, separate pull request/i);
    // Each of the four conditions, by the thing that makes it checkable rather than by its number: a
    // renumbering must not be able to drop one.
    expect(text, 'condition 1 — nothing is waiting for a review this run could do')
      .toMatch(/waiting for a review (that|this) run could do/i);
    expect(text, 'condition 2 — the ~45-minute clock runs from the start of the run, not the second item')
      .toMatch(/from the start of the run/i);
    expect(text, 'condition 3 — the second item cannot touch the first item’s files')
      .toMatch(/disjoint/i);
    expect(text, 'condition 4 — a WIP `Part of #<n>` push is not a finished first item')
      .toMatch(/Part of #<n>/);
  });

  it.each(FILES)('%s keeps it a condition rather than a quota', (name) => {
    const text = doc(name);
    expect(text, 'the self-limiting property is the point, and it has to be stated')
      .toMatch(/condition, not a quota/i);
    // The rewrite that keeps the words and loses the property. #177 rules it out by name.
    expect(text, 'a per-run allowance is exactly what the owner declined — the rule is idle capacity only')
      .not.toMatch(/two items per run(?!["”])/i);
  });

  it.each(FILES)('%s says condition 1 is not "no open pull requests at all"', (name) => {
    expect(doc(name), 'the misreading that makes the rule never fire has to be closed off in the text')
      .toMatch(/not "no open pull requests at all"/i);
  });

  it.each(FILES)('%s forbids one pull request closing two issues', (name) => {
    expect(doc(name), 'two items are two pull requests, or one going bad holds the other')
      .toMatch(/never one pull request closing two issues/i);
  });

  // Without this line nobody can tell a rule that is never true from a rule nobody applied — and #178 moved
  // the record it lands in, so the routine's own file has to name the new home rather than the worklog.
  it('the routine records whether it took one, in the heartbeat snapshot', () => {
    const raw = readFileSync(new URL('../../docs/ROUTINE-PROMPT.md', import.meta.url), 'utf8');
    expect(doc('docs/ROUTINE-PROMPT.md'), 'STEP 3 must ask for the line').toMatch(/- second item:/);
    expect(doc('docs/ROUTINE-PROMPT.md'), 'and name which condition failed when none was taken')
      .toMatch(/which of the four conditions failed/i);
    // Read raw here on purpose: the point is a line of the snapshot block, and `flat()` joins the lines.
    expect(raw, 'and STEP 5 example snapshot must show the line itself').toMatch(/^- second item: /m);
  });
});

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
