import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';
import { NOISE_SECONDS } from '../../src/audio';   // #41: the rail below holds every SFX inside the shared buffer
import { FONT_PROBE } from '../../src/ui/font';   // #44: the rail below pins the gate's probe to index.html

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
  it('shadowBlur stays out of the per-frame draw paths', () => {
    const hits = inDir('/src/game/').flatMap(([f, s]) => [...code(s).matchAll(/shadowBlur/g)].map(() => f));
    expect(hits.length).toBeLessThanOrEqual(0);                         // #29 removed them; never raise this
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

    const line = yml.split('\n').filter(l => !l.trim().startsWith('#')).find(l => l.includes('playwright test'));
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
    // and the step must stay off the push-to-main run, which is what makes the nightly the only full check
    expect(yml, 'the e2e step stays off the push run').toMatch(/if:\s*github\.event_name\s*!=\s*'push'/);
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
});
