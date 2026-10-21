import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * #271 — a `.d.mts` twin is all `tsc` ever reads of a plain `.mjs` module (`checkJs` is off), so nothing said
 * when one drifted from the code it describes. Three things are held here: every runtime export of a module is
 * declared (and nothing else is), the gate's JSDoc says what its declaration says, and every hook that exports
 * has a declaration to be imported through. A missing declaration is not silent in the other direction:
 * `@ts-expect-error` on an import that resolves fails `tsc`, which is how the old masks were removed.
 *
 * Prove it red: delete an `export declare` line from any twin; add an `export const` to a hook; change
 * `AuthorAssociation` to `string` in `scripts/review-gate.mjs`'s `@param`; delete `hooks/shell.d.mts`.
 */
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const names = (src: string, re: RegExp) => [...src.matchAll(re)].map((m) => m[1]).sort();
const runtimeExports = (src: string) => names(src, /^export (?:async )?(?:const|function) (\w+)/gm);
const declared = (src: string) => names(src, /^export declare (?:const|function) (\w+)/gm);

const hooks = readdirSync(new URL('../../.claude/hooks/', import.meta.url)).filter((f) => f.endsWith('.mjs'));
const twins: [string, string][] = [
  ['scripts/review-gate.mjs', 'scripts/review-gate.d.mts'],
  ['scripts/site-shots.mjs', 'scripts/site-shots.d.mts'],
  ...hooks.filter((f) => f !== 'io.mjs').map((f): [string, string] => [`.claude/hooks/${f}`, `.claude/hooks/${f.replace(/\.mjs$/, '.d.mts')}`]),
];

describe('declaration twins (#271)', () => {
  it('finds the hooks it is meant to cover, so the list cannot go empty and pass', () => {
    expect(hooks).toEqual(expect.arrayContaining(['bash-guard.mjs', 'github-write-guard.mjs', 'paths.mjs', 'shell.mjs', 'write-guard.mjs']));
  });

  it.each(twins)('%s and %s declare the same exports', (mjs, dmts) => {
    const real = runtimeExports(read(mjs));
    expect(real.length, `${mjs} exports nothing, so there is nothing to declare`).toBeGreaterThan(0);
    expect(declared(read(dmts)), `${dmts} must declare exactly what ${mjs} exports`).toEqual(real);
  });

  it("io.mjs is the one hook with no twin, because no test or hook imports its types", () => {
    expect(hooks).toContain('io.mjs');
    expect(() => read('.claude/hooks/io.d.mts')).toThrow();
  });

  // The same parameter and return type, written twice. Whitespace and `,`/`;` separators are normalised away.
  it("review-gate.mjs's blockState JSDoc states the types review-gate.d.mts does", () => {
    const flat = (t: string) => t.replace(/import\('\.\/review-gate\.d\.mts'\)\./g, '').replace(/\s+/g, '').replace(/,/g, ';');
    const js = read('scripts/review-gate.mjs'), ts = read('scripts/review-gate.d.mts');
    const param = js.match(/@param (\{\{.*\}\}) pr/)?.[1], ret = js.match(/@returns (\{\{.*?\}\})/)?.[1];
    const declaredParam = ts.match(/blockState\(pr: (\{.*\})\):/)?.[1], declaredRet = ts.match(/function blockState[^\n]*\n\s*(\{[^\n]*\});/)?.[1];
    expect([param, ret, declaredParam, declaredRet], 'all four must be found, or the comparison below proves nothing')
      .not.toContain(undefined);
    // JSDoc wraps the parameter type in `{…}` as its own syntax: `{{a: b}}` is the type `{a: b}`.
    expect(flat(param!.slice(1, -1))).toBe(flat(declaredParam!));
    expect(flat(ret!.slice(1, -1))).toBe(flat(declaredRet!));
  });

  // #229 — one list of invisible characters, owned by the gate, read by the hook. A second copy is how the
  // gate came to miss five characters the hook already stripped.
  it('the github hook imports the gate\'s INVISIBLE class rather than defining its own', () => {
    const hook = read('.claude/hooks/github-write-guard.mjs');
    expect(hook, 'a dynamic import, so a failure can be caught and refused').toMatch(
      /\{ INVISIBLE \} = await import\('\.\.\/\.\.\/scripts\/review-gate\.mjs'\)/);
    expect(hook, 'a local definition would shadow the shared one').not.toMatch(/INVISIBLE = \//);
    expect(read('scripts/review-gate.mjs')).toMatch(/^export const INVISIBLE = /m);
  });
});
