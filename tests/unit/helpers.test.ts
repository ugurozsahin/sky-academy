import { describe, expect, it } from 'vitest';
import { code, e2eSpecFiles, inDir, SOURCES, workflow, workflowFiles } from './helpers/sources';

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

  // #816: the documented safe-direction edge — an odd (3+) backslash run immediately before a real comment
  // opener reads the last backslash as escaping the opener's own slash, so the comment survives unstripped.
  // Unreachable from any compiling TypeScript (a literal only closes on an even backslash run), so this is a
  // pin on the documented no-op behaviour rather than a regression test for a real bug, matching this file's
  // own pattern of a companion test beside every documented `code()` nuance.
  it('code() leaves an odd (3+) backslash run before a real comment opener unstripped (#816)', () => {
    const block = '\\\\\\/* kept */ realCode();';
    expect(code(block), 'three backslashes against a real /* must leave the comment unstripped, output unchanged')
      .toBe(block);
    const line = '\\\\\\// kept\nrealCode();';
    expect(code(line), 'three backslashes against a real // must leave the comment unstripped, output unchanged')
      .toBe(line);
  });
});
