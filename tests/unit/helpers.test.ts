import { describe, expect, it } from 'vitest';
import { code, inDir, SOURCES, workflow } from './helpers/sources';

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
    for (const [path, src] of Object.entries(SOURCES).slice(0, 5))
      expect(src.length, `${path} read as an empty string`).toBeGreaterThan(0);
  });

  it('inDir narrows to a real directory rather than returning everything, or nothing', () => {
    const game = inDir('/src/game/');
    expect(game.length, '/src/game/ holds several modules').toBeGreaterThan(1);
    expect(game.length, 'and is not the whole of src/').toBeLessThan(Object.keys(SOURCES).length);
    expect(inDir('/src/nothing-here/'), 'a directory that does not exist yields nothing, not everything').toEqual([]);
  });

  it('workflow() reads a real file from disk, since Vite\'s glob does not reach .github/', () => {
    for (const name of ['ci.yml', 'review-gate.yml']) {
      const text = workflow(name);
      expect(text.length, `${name} read as empty — every workflow rail would then pass vacuously`).toBeGreaterThan(200);
      expect(text, `${name} does not look like a workflow`).toMatch(/\bjobs:/);
    }
  });

  it('code() strips comments and leaves the code, so a comment naming a ban does not trip it', () => {
    const src = 'const a = 1; // shadowBlur\n/* shadowBlur */\nconst b = 2;';
    expect(code(src), 'the comment naming the banned token must be gone').not.toContain('shadowBlur');
    expect(code(src), 'and the code either side of it must survive').toContain('const a = 1;');
    expect(code(src)).toContain('const b = 2;');
    expect(code('ctx.shadowBlur = 4;'), 'a real use is not a comment and must stay readable').toContain('shadowBlur');
  });
});
