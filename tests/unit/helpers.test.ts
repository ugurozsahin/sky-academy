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

  it('code() strips comments and leaves the code, so a comment naming a ban does not trip it', () => {
    const src = 'const a = 1; // shadowBlur\n/* shadowBlur */\nconst b = 2;';
    expect(code(src), 'the comment naming the banned token must be gone').not.toContain('shadowBlur');
    expect(code(src), 'and the code either side of it must survive').toContain('const a = 1;');
    expect(code(src)).toContain('const b = 2;');
    expect(code('ctx.shadowBlur = 4;'), 'a real use is not a comment and must stay readable').toContain('shadowBlur');
  });

  // PR #710 round 7: a purely textual `/\/\*[\s\S]*?\*\//` strip cannot tell a real comment apart from the
  // same two characters sitting inside two ordinary string literals, so it erased everything between them —
  // a real `src/game/` import included — rather than only the comment the rail exists to see past.
  it('code() does not let a string literal\'s own text open or close a comment (#710 round 7)', () => {
    const src = "export const decoy1 = '/*';\nimport { $ } from '../ui/dom';\nexport const decoy2 = '*/';";
    const stripped = code(src);
    expect(stripped, 'a real import sitting between two decoy string literals must survive').toContain("import { $ } from '../ui/dom';");
    expect(stripped, 'the code naming decoy1 must survive too').toContain('decoy1');
    expect(stripped, 'and decoy2').toContain('decoy2');
    // A genuine comment either side of the decoys must still be stripped as before.
    const withRealComment = `/* a real comment mentioning shadowBlur */\n${src}`;
    expect(code(withRealComment), 'a real comment must still be gone').not.toContain('shadowBlur');
  });

  it('code() skips a template literal\'s raw text, but still scans a comment inside its ${…} interpolation', () => {
    // The template's own backticked body is not code — `/*` inside it is just characters, same as a
    // single-quoted string — but an interpolation re-enters real code, where a comment is still a comment.
    const src = 'const s = `look, a /* fake comment */ right here`;\nconst t = `${/* real */ 1}`;';
    const stripped = code(src);
    expect(stripped, 'text inside a template literal is not a comment and must survive').toContain('a /* fake comment */ right here');
    expect(stripped, 'a comment inside a template interpolation is still a comment').not.toContain('real');
    // Nesting: a `${…}` that contains its own object literal or template literal must not close early on
    // the object's own `}`, or on the nested template's own backtick.
    const nested = 'const u = `${ ({ a: 1, b: () => `${2}` }).a }`;\nimport { $ } from \'../ui/dom\';';
    expect(code(nested), 'a nested {…}/`…` inside an interpolation must not end the template early').toContain("import { $ } from '../ui/dom';");
  });
});
