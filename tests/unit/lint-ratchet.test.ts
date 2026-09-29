import { readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { beforeAll, describe, expect, it } from 'vitest';

// The lint ratchet (#1381). `eslint.config.js` sets a base limit for `complexity` and `max-lines-per-function` in
// `src/`, and freezes each file that is over today at the size of its worst function. This rail keeps that table
// honest: an entry must equal the file's real worst function, so a function that shrinks forces its number down
// (a number here only ever goes DOWN), and a file under the base limit has no entry.
type Kind = 'complexity' | 'lines';
const table = JSON.parse(readFileSync(new URL('../../lint-ratchet.json', import.meta.url), 'utf8')) as {
  base: Record<Kind, number>; complexity: Record<string, number>; lines: Record<string, number>;
};
const BASE_CEILING: Record<Kind, number> = { complexity: 15, lines: 60 };
const worst: Record<Kind, Record<string, number>> = { complexity: {}, lines: {} };

beforeAll(async () => {
  const eslint = new ESLint({
    cwd: new URL('../../', import.meta.url).pathname,
    overrideConfigFile: true,
    overrideConfig: [{
      files: ['src/**/*.ts'],
      languageOptions: { parser: tseslint.parser },
      rules: { complexity: ['error', { max: 1 }], 'max-lines-per-function': ['error', { max: 1, skipBlankLines: true, skipComments: true }] },
    }],
  });
  for (const r of await eslint.lintFiles(['src'])) {
    const file = r.filePath.slice(r.filePath.indexOf('/src/') + 1);
    for (const m of r.messages) {
      const kind: Kind | null = m.ruleId === 'complexity' ? 'complexity' : m.ruleId === 'max-lines-per-function' ? 'lines' : null;
      const n = kind && Number(/(?:complexity of |too many lines \()(\d+)/.exec(m.message)?.[1]);
      if (kind && n) worst[kind][file] = Math.max(worst[kind][file] ?? 0, n);
    }
  }
}, 60_000);

describe('lint ratchet (#1381)', () => {
  it.each(['complexity', 'lines'] as Kind[])('the %s base limit is no looser than its ceiling', (kind) => {
    expect(table.base[kind], `lint-ratchet.json: base.${kind} may go down, never up`).toBeLessThanOrEqual(BASE_CEILING[kind]);
  });

  for (const kind of ['complexity', 'lines'] as Kind[]) {
    it.each(Object.entries(table[kind]))(`${kind}: %s is frozen at its real worst function, %i`, (file, frozen) => {
      const real = worst[kind][file];
      expect(real, `${file} has no ${kind} entry to keep: it is under the base limit, or gone. Delete the entry`).toBeDefined();
      expect(frozen, `${file}: the worst function is now ${real}, so lower the ${kind} entry to ${real}`).toBe(real);
      expect(frozen).toBeGreaterThan(table.base[kind]);
    });

    it(`${kind}: no file over the base limit is missing from the table`, () => {
      const missing = Object.entries(worst[kind]).filter(([f, n]) => n > table.base[kind] && !(f in table[kind])).map(([f]) => f);
      expect(missing, `new ${kind} over ${table.base[kind]}: split the function, do not add an entry`).toEqual([]);
    });
  }
});
