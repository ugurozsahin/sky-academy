import { describe, expect, it } from 'vitest';
import { assemble, code, e2eSpecFiles, inDir, SOURCES, styleCss, workflow, workflowFiles } from './helpers/sources';

/**
 * The readers four rail files share (#321). Until the split each of them was a `const` at the top of one
 * file, and a reader that went blind — a glob that matched nothing, a path that moved — would have taken
 * that file's rails green with it. Shared between four files, the same failure now takes **four** groups of
 * rails green at once, silently, so the helpers get rails of their own.
 *
 * This is the same argument `.claude/skills/add-guard-rail/SKILL.md` §3 makes about any rail that cannot
 * fail, applied to the thing every other rail reads through.
 *
 * Prove one red: point the glob at a directory that does not exist, or make `code()` return its input.
 */
describe('the shared rail readers cannot go blind (#321)', () => {
  it('SOURCES really reads src/, and reads the files the rails name', () => {
    const paths = Object.keys(SOURCES);
    expect(paths.length, 'an empty glob makes every src/ rail pass vacuously').toBeGreaterThan(20);
    for (const named of ['/src/game/arena.ts', '/src/ui/play.ts', '/src/curriculum/maths.ts', '/src/storage.ts'])
      expect(paths, `${named} is read by name in a rail, so the glob must reach it`).toContain(named);
    // A glob that resolves but returns empty strings is the same failure wearing a passing shape.
    // Every entry, not a slice: blanking everything *except* the first five left this 4/4 green
    // (PR #417 review, note 6), which is the vacuous pass this very rail is named for.
    for (const [path, src] of Object.entries(SOURCES))
      expect(src.length, `${path} read as an empty string`).toBeGreaterThan(0);
  });

  it('inDir narrows to a real directory rather than returning everything, or nothing', () => {
    const game = inDir('/src/game/');
    expect(game.length, '/src/game/ holds several modules').toBeGreaterThan(1);
    expect(game.length, 'and is not the whole of src/').toBeLessThan(Object.keys(SOURCES).length);
    // It throws rather than returning `[]` (PR #417 review, note 3): a path spelled wrongly — a leading slash
    // dropped, a folder renamed — would otherwise make every rail that reads it green for ever.
    expect(() => inDir('/src/nothing-here/'), 'a directory that does not exist must be loud, not empty').toThrow(/leading slash/);
    expect(() => inDir('src/game/'), 'the missing-leading-slash case this exists for').toThrow();
  });

  it('workflow() reads a real file from disk, since Vite\'s glob does not reach .github/', () => {
    // `as const`, because `workflow()` takes the literal union of the files that exist (PR #417 review,
    // note 5) — a typo is now a compile error rather than a runtime ENOENT, and this line proves it.
    for (const name of ['ci.yml', 'review-gate.yml'] as const) {
      const text = workflow(name);
      expect(text.length, `${name} read as empty — every workflow rail would then pass vacuously`).toBeGreaterThan(200);
      expect(text, `${name} does not look like a workflow`).toMatch(/\bjobs:/);
    }
  });

  it('workflowFiles() finds every workflow, and is loud rather than empty if it finds none', () => {
    const found = workflowFiles();
    expect(found.length, 'the repository has several workflows; zero means the directory moved').toBeGreaterThanOrEqual(3);
    for (const { name, text } of found) {
      expect(name).toMatch(/\.ya?ml$/);
      expect(text.length, `${name} read as empty`).toBeGreaterThan(100);
    }
    expect(found.map((w) => w.name), 'ci.yml is read by name elsewhere, so it must be in here too').toContain('ci.yml');
  });

  // #680 item 4: deleting the `names.length === 0` throw left every rail reading `workflowFiles()` green,
  // because nothing ever calls it against a directory with no `.yml`/`.yaml` files in it — the vacuity guard
  // was proven only in prose. `dir` lets this test point at a real, empty fixture directory instead.
  it('workflowFiles(dir) is loud on a real directory with no workflow files, not just in theory (#680)', () => {
    const empty = new URL('./helpers/fixtures/no-workflows/', import.meta.url);
    expect(() => workflowFiles(empty), 'zero .yml/.yaml files must throw, not return []').toThrow(/pass vacuously/);
  });

  // pr-test-analyzer review of #680: the empty fixture above proves the throw fires, but a filter narrowed to
  // match only `.yml` — silently dropping `.yaml` — would also pass it, since it has neither extension to miss.
  // This fixture holds only a `.yaml` file, so that regression has something to find.
  it('workflowFiles(dir) still finds a .yaml-only directory, not just .yml (#680)', () => {
    const yamlOnly = new URL('./helpers/fixtures/yaml-only/', import.meta.url);
    expect(workflowFiles(yamlOnly).map((w) => w.name)).toEqual(['one.yaml']);
  });

  it('e2eSpecFiles() finds every e2e spec, and is loud rather than empty if it finds none (#750)', () => {
    const found = e2eSpecFiles();
    expect(found.length, 'tests/e2e/ has several spec files; zero means the directory moved').toBeGreaterThanOrEqual(3);
    for (const { name, text } of found) {
      expect(name).toMatch(/\.spec\.ts$/);
      expect(text.length, `${name} read as empty`).toBeGreaterThan(100);
    }
    for (const name of ['00-build-identity.spec.ts', 'game.spec.ts', 'viewport.spec.ts'])
      expect(found.map((f) => f.name), `${name} is read by name or excluded by name elsewhere`).toContain(name);
  });

  // #794, the same gap #680 closed for workflowFiles(): the empty fixture proves the throw actually fires
  // against a real directory with no `.spec.ts` files, not just in prose — deleting the `names.length === 0`
  // throw left every rail reading `e2eSpecFiles()` green, because nothing ever called it against one.
  it('e2eSpecFiles(dir) is loud on a real directory with no e2e specs, not just in theory (#794)', () => {
    const empty = new URL('./helpers/fixtures/no-e2e-specs/', import.meta.url);
    expect(() => e2eSpecFiles(empty), 'zero .spec.ts files must throw, not return []').toThrow(/pass vacuously/);
  });

  it('styleCss() reads src/style.css\'s imports, not one split-out file (#558)', () => {
    const css = styleCss();
    expect(css.length, 'the stylesheet split into src/styles/*.css must not read as empty or one file').toBeGreaterThan(10_000);
    expect(css, 'base.css\'s Fredoka @font-face must survive the split').toMatch(/@font-face/);
    expect(css, 'shop.css\'s .shop-btn rule must survive the split').toContain('.shop-btn');
  });

  // pr-test-analyzer review of #558: the two markers above only prove the first and last file in the import
  // chain survive — nothing checked the ten files between them, so any one of those going empty or duplicated
  // would still clear every rail's length floor unnoticed. Each section's own pre-existing heading comment is
  // a marker already unique to it; checking all twelve, by position, catches a section emptied (its heading
  // vanishes), duplicated (its heading's second `indexOf` would sit before the next section's) or reordered
  // (a later heading's index would not be the greater one) — not just "the total is long enough".
  it('styleCss() carries every section\'s own heading, once each, in the file\'s original order (#558)', () => {
    const css = styleCss();
    const headings = [
      '/* Sky Ninja Academy — twilight sky theme. Mobile-first, desktop-friendly. */',  // base.css
      '/* ---------- backgrounds ---------- */',
      '/* ---------- shared components ---------- */',
      '/* ---------- avatar screen ---------- */',
      '/* ---------- home ---------- */',
      '/* ---------- rewards ---------- */',
      '/* ---------- daily dojo ---------- */',
      '/* ---------- play ---------- */',
      '/* ---------- memory match ---------- */',
      '/* overlays */',
      '/* Grown-ups gate + parent dashboard (#9) */',
      '/* ---------- shop (#6) ---------- */',
    ];
    let last = -1;
    for (const heading of headings) {
      const at = css.indexOf(heading);
      expect(at, `"${heading}" must appear, and only after the previous section's own heading`).toBeGreaterThan(last);
      expect(css.lastIndexOf(heading), `"${heading}" must appear exactly once`).toBe(at);
      last = at;
    }
  });

  it('styleCss(root) is loud on a real entry file with no @import lines, not just in theory (#558)', () => {
    const noImports = new URL('./helpers/fixtures/no-style-imports/', import.meta.url);
    expect(() => styleCss(noImports), 'an entry with no @import lines must throw, not read as the whole stylesheet')
      .toThrow(/no @import lines/);
  });

  // silent-failure-hunter review of #558: a bare `@import`-graph walk would double a section's rules with no
  // error if the entry imports the same file twice — the vacuity guard above only fires on zero imports, not
  // on a repeated one.
  it('styleCss(root) is loud on a real entry file that @imports the same file twice (#558)', () => {
    const dup = new URL('./helpers/fixtures/style-with-duplicate-import/', import.meta.url);
    expect(() => styleCss(dup), 'the same @import twice must throw, not silently double that section')
      .toThrow(/more than once/);
  });

  // silent-failure-hunter review of #558: a file added under src/styles/ that nothing @imports would never
  // reach Vite's bundle either, but a reader that only walks the @import graph has no way to notice it is
  // missing something real on disk — the same "loud on a real directory" shape workflowFiles()/e2eSpecFiles()
  // already use, applied to the file this one is never handed by name.
  it('styleCss(root) is loud on a real src/styles/ directory holding a file nothing @imports (#558)', () => {
    const orphan = new URL('./helpers/fixtures/style-with-orphan/', import.meta.url);
    expect(() => styleCss(orphan), 'a file on disk with no @import naming it must throw, not read as complete')
      .toThrow(/orphan\.css/);
  });

  it('code() strips comments and leaves the code, so a comment naming a ban does not trip it', () => {
    const src = 'const a = 1; // shadowBlur\n/* shadowBlur */\nconst b = 2;';
    expect(code(src), 'the comment naming the banned token must be gone').not.toContain('shadowBlur');
    expect(code(src), 'and the code either side of it must survive').toContain('const a = 1;');
    expect(code(src)).toContain('const b = 2;');
    expect(code('ctx.shadowBlur = 4;'), 'a real use is not a comment and must stay readable').toContain('shadowBlur');
  });

  // #775/#780: an escaped slash inside a regex literal is not a real comment open. The old textual scan had no
  // notion of escaping, so `/a\/*/`'s own `\/*` read as `/*` opening a comment, erasing everything up to the
  // *next* literal `*/` — here, a real import and a real trailing comment.
  it('code() does not read a regex literal\'s own escaped /* as opening a real comment (#775/#780)', () => {
    const src = "const r = /a\\/*/; import { $ } from '../ui/dom'; /** trailing */";
    const out = code(src);
    expect(out, "the regex literal itself must survive untouched").toContain('/a\\/*/');
    expect(out, 'the real import sitting after the regex literal must not be erased').toContain("import { $ } from '../ui/dom';");
    expect(out, 'the real trailing comment must still be stripped').not.toContain('trailing');
  });

  // The same misreading happens to an escaped slash at a regex's own *end* (`\//`), not just before a `*` —
  // and this repository already has that shape today, in the very files these rails read: `governance.test.ts`
  // and `guardrails.test.ts` both call `.replace(/^\.claude\/skills\//, ...)`-style patterns, `pwa.test.ts` and
  // `sw.test.ts` each have `/^icons\//`/`/^\//`. Found only once this fix's own `code()` output was diffed
  // against the old implementation's across every test file, not just src/ — the four real instances are why
  // this is a repository-proven case, not a constructed one.
  it('code() does not read an escaped slash at a regex literal\'s own end as opening a real comment (#775/#780)', () => {
    const src = "path.replace(/^\\.claude\\/skills\\//, ''); realCode();";
    expect(code(src), 'the real code after the regex literal must survive, not be swallowed as a comment')
      .toBe(src);
  });

  // Division and an ordinary regex literal (no escapes) are untouched by this fix either way, and a `/` inside
  // a string must not make a real trailing comment vanish.
  it('code() leaves plain division and plain regex literals alone, and does not lose a comment to a `/` in a string (#775/#780)', () => {
    expect(code('const x = width / 2;'), 'division must stay exactly as written').toBe('const x = width / 2;');
    expect(code("str.replace(/foo/g, 'bar');"), 'a real regex literal must survive untouched')
      .toBe("str.replace(/foo/g, 'bar');");
    const src = "import { gentleRelaunchSet } from './gentleRelaunch';   // #742: real comment\n";
    expect(code(src), "a `/` inside the import path must not eat part of the trailing // comment")
      .not.toContain('#742');
  });

  // pr-test-analyzer and silent-failure-hunter review, independently, of an earlier version of this fix that
  // tried to tell a regex literal from division by its preceding token: a regex right after a keyword
  // (`return`, `typeof`, `case`…) still ends in a word character, so a single-previous-character heuristic
  // misreads it as division and reopens the #775/#780 class through a different door; a real `//` comment
  // straight after a postfix `++`/`--` was misread as a regex read that swallowed part of it. The final design
  // in this file sidesteps both — it never tries to identify a regex literal as a span, only ever treats an
  // escaped character as one atomic unit — so these are regression tests for a design this file no longer
  // uses, kept because both are real inputs a naive "is this a regex?" fix could plausibly get wrong again.
  it('code() is unaffected by a keyword before a regex literal, or a postfix operator before a real comment (#775/#780)', () => {
    expect(code("return /foo\\/*bar/.test(x); realCode();"), 'a regex right after a keyword must not trip anything')
      .toBe("return /foo\\/*bar/.test(x); realCode();");
    expect(code('const stats = {\n  ratio: count-- / total, // ratio note\n};'), 'a real comment straight after count-- / total must still be stripped')
      .not.toContain('ratio note');
  });

  // #816 documented a "safe direction" no-op for this shape under the old hand-rolled scanner: a bare run of
  // backslashes has no meaning outside a string in real JavaScript/TypeScript, but that scanner's own
  // escape-pairing (needed to see past a regex literal's `\/`, #775/#780) read an odd run as escaping the
  // comment opener's own slash regardless. #827's move to the real parser (see the long comment above
  // `code()`) retires that scanner and its pairing along with it: a bare backslash outside a string is not
  // valid TypeScript and the parser does not attach any escaping meaning to it, so `//`/`/*` immediately after
  // one is read as the real comment it is. This is not a fixture reachable from compiling `src/**/*.ts`
  // either way (`tsc` rejects a bare backslash there), so this pins the new behaviour rather than reopening a
  // live bug.
  it('code() strips a real comment even after a run of backslashes that carry no escaping meaning outside a string (#827)', () => {
    const block = '\\\\\\/* kept */ realCode();';
    expect(code(block), 'a bare backslash run has no meaning outside a string, so the real /* comment must strip')
      .toBe('\\\\\\  realCode();');
    const line = '\\\\\\// kept\nrealCode();';
    expect(code(line), 'and the same for a real // comment straight after one').toBe('\\\\\\ \nrealCode();');
  });

  // #816: an unterminated /* used to swallow everything after it to a single space, no error — the same
  // vacuous-pass shape inDir()/workflowFiles()/e2eSpecFiles()/styleCss() already fail loudly on. No real
  // src/*.ts file can hit this (tsc rejects an unterminated block comment), but code() is also applied to
  // non-source text (e.g. governance.test.ts's own local `code` shadow over free-text it() bodies), where a
  // hand-written fixture could.
  it('code() throws on an unterminated /* comment instead of silently swallowing to EOF (#816)', () => {
    // Built by concatenation, not a literal slash-star, so this file's own raw source (which scripts.test.ts's
    // Playwright-import rail scans with code() too, #142) never contains an actually-unterminated comment —
    // and the assertion message below is worded without a literal star-slash for the same reason (#836): that
    // substring would otherwise sit right next to the split-apart opener above, so if an earlier, unrelated
    // slash-star-shaped substring anywhere else in this file's raw text were ever left dangling open by the
    // time the scanner reaches here, this message's own star-slash could close it "by coincidence" rather
    // than by construction.
    const unterminated = 'const a = 1; ' + '/*' + ' never closed';
    expect(() => code(unterminated), 'a missing closing block comment must be loud, not silent')
      .toThrow(/unterminated \/\* comment/);
    expect(code('const a = 1; /* closed */ const b = 2;'), 'a properly closed comment must still be stripped')
      .toBe('const a = 1;   const b = 2;');
  });

  // pr-test-analyzer review of #827: an unterminated string, regex or template literal is a different failure
  // mode from the #816 case above — the real TypeScript parser recovers from each with a token, never a
  // trivia gap, so `stripTrivia`'s own unterminated-`/*` throw never engages, and this reader is silent either
  // way. No real src/*.ts file can hit any of the three (tsc rejects all of them, the same reason #816's own
  // throw is unreachable from real source), so the bar here is only "does not corrupt output", not "throws" —
  // and it does not: an unterminated string or regex recovers to end-of-line, so a real comment further down
  // the file is still found and stripped past it; an unterminated template literal recovers to end-of-*file*
  // (a template literal can hold a real newline), so nothing after it — including a real trailing comment —
  // is reachable at all, and it survives unstripped. A false negative either way, the same safe direction
  // #816's own backslash-run edge already takes, never a false positive that drops real code.
  it('code() does not corrupt output on an unterminated string, regex or template literal (#827)', () => {
    const trailing = 'const b = 1; // real trailing\n';
    expect(code(`const a = 'never closed /* not a real comment */\n${trailing}`),
      'an unterminated string recovers to end-of-line, so the real trailing comment past it is still stripped')
      .not.toContain('real trailing');
    expect(code(`const a = /never closed /* not a real comment */\n${trailing}`),
      'an unterminated regex recovers to end-of-line too, so the real trailing comment is still stripped')
      .not.toContain('real trailing');
    expect(code(`const a = \`never closed /* not a real comment */\n${trailing}`),
      'an unterminated template recovers only at EOF, so nothing past it — the real comment included — is reachable')
      .toContain('real trailing');
  });

  // #827: a /*-shaped substring sitting inside an ordinary string literal is not a real comment open, but the
  // scan above has no notion of string boundaries — it only ever tracks escape pairs and regex-adjacent
  // slashes, never a quote. `tests/unit/governance.test.ts` itself has exactly this shape in a plain string:
  // 'docs' + '/' + '*' + '-PROMPT.md' reads as `/*`. Built by concatenation here for the same #836 reason the
  // test above already gives — so this file's own raw text never contains the shape it is pinning.
  it('code() does not read a /*-shaped substring inside a string literal as opening a real comment (#827)', () => {
    const glob = 'docs' + '/' + '*' + '-PROMPT.md';
    const src = `const msg = 'the ${glob} rail'; realCode(); /* real comment */`;
    const out = code(src);
    expect(out, 'the string literal must survive untouched').toContain(`'the ${glob} rail'`);
    expect(out, 'the real code after the string must not be swallowed').toContain('realCode();');
    expect(out, 'the real trailing comment must still be stripped').not.toContain('real comment');
  });

  // The exact shape the finding was filed against: no closing */ anywhere later in the file either, which
  // #816's throw above used to (wrongly) treat as a real unterminated comment.
  it('code() does not throw on a /*-shaped substring inside a string with no */ anywhere in the file (#827)', () => {
    const glob = 'docs' + '/' + '*' + '-PROMPT.md';
    const src = `const msg = 'the ${glob} rail';`;
    expect(() => code(src), 'a string is not a comment, however it is spelled, so this must not throw').not.toThrow();
    expect(code(src)).toBe(src);
  });

  // A comment that is genuinely inside a string on both sides of a real quote must still be left alone, and a
  // quote character escaped inside a string must not be read as closing it early.
  it('code() leaves a string containing a quote-escaped apostrophe and a `/` untouched', () => {
    const src = "const msg = 'it\\'s a path: a/b'; // real comment\n";
    expect(code(src), 'the escaped apostrophe must not end the string early, and the string must survive')
      .toContain("'it\\'s a path: a/b'");
    expect(code(src), 'the real trailing comment must still be stripped').not.toContain('real comment');
  });

  // #827: a template literal's `${...}` is real code, not string content — `src/ui/profiles.ts`'s render has a
  // genuine `//` comment inside one (naming `avatarById` to explain why it is *not* used, the same
  // banned-token-in-a-comment shape the very first test above pins). Treating the whole backtick span as
  // opaque text, the naive fix for the bug above, stops stripping that real comment.
  it('code() strips a real comment sitting inside a template literal\'s `${...}` interpolation (#827)', () => {
    const src = 'const html = `<div>${list.map((x) => {\n'
      + '  // avatarById: not the real name, just naming the shape\n'
      + '  return x;\n'
      + '})}</div>`;';
    const out = code(src);
    expect(out, 'the comment inside the interpolation must be stripped like any other comment')
      .not.toContain('avatarById');
    expect(out, 'the real code either side of the comment, inside the interpolation, must survive')
      .toContain('return x;');
    expect(out, 'the template literal text outside the interpolation must survive')
      .toContain('<div>${');
  });

  // A nested object literal inside `${...}` has its own `{`/`}`, which must not be mistaken for the
  // interpolation's own closing brace, and a nested string inside it must not leak its own braces either.
  it('code() finds the interpolation\'s own closing brace past a nested object literal and a nested string (#827)', () => {
    const src = "const html = `${fn({ a: 1, s: '{not a close}' })} after`;";
    expect(code(src), 'nested braces and a brace-shaped string inside the interpolation must not end it early')
      .toBe(src);
  });

  // pr-test-analyzer review of an earlier draft of this fix (a hand-rolled string/template-literal tracker,
  // the same kind of scanner #775/#780 already fought and #827's rationale comment above explains abandoning):
  // a quote character sitting inside a regex literal — `esc()` in the real `src/ui/dom.ts`, `familyOf()` in
  // the real `src/ui/font.ts` both have one, `/[&<>"]/g` — was read by that scanner as opening a real string,
  // since it had no notion of a regex literal either. That swallowed unrelated real code as "string content"
  // until a later, unrelated quote happened to close it again, un-stripping the next real comment in the
  // file. The real parser used now has no such gap: a regex literal is one token, quote characters and all.
  it('code() does not read a quote character inside a regex literal as opening a real string (#827)', () => {
    const src = 'const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ \'&\': 1 }[c]));\n/** realComment */\nconst x = 1;';
    const out = code(src);
    expect(out, 'the regex literal, quote and all, must survive untouched').toContain('/[&<>"]/g');
    expect(out, 'the real doc comment after it must still be stripped, not left readable by a desynced tracker')
      .not.toContain('realComment');
  });

  // silent-failure-hunter review of the same earlier draft: its interpolation-depth counter treated every
  // `{`/`}` character inside `${...}` as belonging to the interpolation's own nesting, including one sitting
  // inside a regex literal with no notion of a regex literal to skip past whole (`/}/ ` — one `}`, unbalanced
  // by construction, since regex braces are not JavaScript's braces). That closed the interpolation frame
  // early and desynced everything after it for the rest of that template literal, un-stripping a real comment
  // a few characters later. The real parser sees `/}/ ` as one regex-literal token and never as a stray `}`.
  it('code() does not read an unbalanced brace inside a regex literal, inside a template interpolation, as closing the interpolation (#827)', () => {
    const src = 'const s = `x${/}/.test(y) /* realComment */ + 1}z`;\nconst after = 1; // trailing\n';
    const out = code(src);
    expect(out, 'the regex literal must survive untouched').toContain('/}/.test(y)');
    expect(out, 'the real comment inside the interpolation must still be stripped').not.toContain('realComment');
    expect(out, 'the template literal text past the interpolation must survive').toContain('z`;');
    expect(out, 'and the real trailing comment, now correctly outside any confused string state, must strip too')
      .not.toContain('trailing');
  });

  // #844 finding 1: the existing "unterminated regex" test above (`code() does not corrupt output on an
  // unterminated string, regex or template literal`) doesn't actually produce an unterminated regex token —
  // its fixture's second `/` closes the literal validly (`RegularExpressionLiteral [10,23] "/never closed"`,
  // confirmed against the real parser's own AST), so that test exercises ordinary parser garbage-recovery,
  // not the unterminated-regex path its own comment claims. This fixture genuinely never closes the regex:
  // nothing between the opening `/` and end-of-line is a second unescaped `/`.
  it('code() does not corrupt output on a genuinely unterminated regex literal (#827/#844)', () => {
    const src = 'const a = /never closed\nconst b = 1; // real trailing\n';
    const out = code(src);
    expect(out, 'an unterminated regex recovers to end-of-line, so the real trailing comment past it is still stripped')
      .not.toContain('real trailing');
    expect(out, 'the unterminated regex\'s own text must survive, not be dropped along with the comment')
      .toContain('never closed');
    expect(out, 'the real statement past the unterminated regex must survive too').toContain('const b = 1;');
  });

  // #844 finding 2: a template literal nested inside another template's `${...}` interpolation — named by
  // this fix's own title ("track string/template-literal boundaries") but never pinned. A real comment sitting
  // inside the *inner* interpolation must still be found and stripped, the same as the outer-interpolation case
  // above, and the inner template's own backticks must not desync collectSpans's walk of the outer one.
  it('code() strips a real comment inside a template literal nested inside another template\'s interpolation (#844)', () => {
    const src = 'const html = `outer ${`inner ${/* realComment */ x}`} end`;';
    const out = code(src);
    expect(out, 'the comment inside the nested interpolation must be stripped').not.toContain('realComment');
    expect(out, 'the inner template literal\'s own text must survive').toContain('inner ${');
    expect(out, 'the outer template literal\'s text past the nesting must survive').toContain('end`;');
  });

  // #844 finding 3: a template literal spanning several lines, closed properly (not the #827 unterminated
  // case above), with a comment-shaped substring on one of its lines. `code()` never recurses into a template
  // token with no interpolation — it is one leaf span — so the substring must survive untouched, and a real
  // comment after the template's closing backtick must still be found.
  it('code() leaves a comment-shaped substring inside a closed multi-line template literal untouched (#844)', () => {
    const src = 'const html = `line1\n/* not a comment */\nline2`; // real trailing\n';
    const out = code(src);
    expect(out, 'the comment-shaped substring inside the template literal must survive, not be read as a real comment')
      .toContain('/* not a comment */');
    expect(out, 'the real trailing comment after the template literal must still be stripped')
      .not.toContain('real trailing');
  });

  // #844 finding 4: two real comments with no code between them — `stripTrivia`'s loop must run its own
  // comment branches twice in the same trivia gap rather than stopping after the first. Both block-comment
  // and line-comment adjacency are checked; the code either side of the pair must survive.
  it('code() strips two real comments in a row with no code between them (#844)', () => {
    expect(code('const a = 1; /* a */ /* b */ const b = 2;'), 'both adjacent block comments must go, the code either side must stay')
      .toBe('const a = 1;     const b = 2;');
    const out = code('const a = 1; // a\n// b\nconst b = 2;');
    expect(out, 'both adjacent line comments must go').not.toMatch(/\/\/\s*[ab]\b/);
    expect(out, 'the code either side of the pair must survive').toContain('const a = 1;');
    expect(out).toContain('const b = 2;');
  });

  // #844 finding 5 (type-design-analyzer): `assemble()`'s own ordering invariant — spans arrive left to
  // right and never overlap, which `collectSpans`'s traversal already guarantees and the real parser cannot
  // be driven to violate. Pinned directly with a synthetic span list, since no real source can trigger it:
  // an out-of-order span must throw rather than let `stripTrivia(src, from, to)` silently return `''` for
  // `from > to` and corrupt the output. A normal, correctly-ordered span list must still assemble as before.
  it('assemble() throws on an out-of-order span instead of silently corrupting output (#844)', () => {
    const src = 'const a = 1; const b = 2;';
    expect(() => assemble(src, [
      { start: 6, end: 12, comment: false },
      { start: 0, end: 5, comment: false },
    ]), 'a span starting before the previous one ended must be loud, not silently corrupt the output')
      .toThrow(/span \[0, 5\) is out of order after the previous span ended at 12/);
    expect(assemble(src, [
      { start: 0, end: 5, comment: false },
      { start: 6, end: 12, comment: false },
    ]), 'a correctly-ordered span list must assemble exactly as code() itself would')
      .toBe(src);
  });

  // silent-failure-hunter review of the #844 fix above: the `span.start < pos` guard alone lets a
  // differently-shaped malformed span through untouched — one whose own `end` is before its own `start`.
  // `pos` is not yet corrupted when such a span is reached, so `span.start < pos` can still be false; without
  // this second check, `src.slice(span.start, span.end)` would silently return `''` for `end < start`
  // (dropping that span's text), and `pos` would then be set *backwards* to that `end`, so the *next* span's
  // `stripTrivia(pos, next.start)` would re-read and duplicate a stretch of source already emitted — the
  // exact silent-corruption shape this guard exists to rule out, reached by a different malformed span.
  // Reproduced directly before this test existed: the three-span list below produced
  // `'const a = 1; const bonst b = 2; const c = 3;'` with no exception, under a guard that only checked
  // `span.start < pos`.
  it('assemble() throws on a span whose own end is before its own start, not just an out-of-order one (#844)', () => {
    const src = 'const a = 1; const b = 2; const c = 3;';
    expect(() => assemble(src, [
      { start: 6, end: 12, comment: false },
      { start: 20, end: 14, comment: false },
      { start: 27, end: 33, comment: false },
    ]), 'a span with end before its own start must be loud, not silently drop text and corrupt everything after it')
      .toThrow(/span \[20, 14\) is out of order after the previous span ended at 12/);
  });
});
