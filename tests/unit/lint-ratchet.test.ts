import { readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { beforeAll, describe, expect, it } from 'vitest';

// The lint ratchet (#1381, per function since #1387). `eslint.config.js` sets a base limit for `complexity` and
// `max-lines-per-function` in `src/` and freezes each function that is over today, keyed `file::name`, at its size. A
// name that occurs twice among a file's over-base functions is `name#1`, `name#2` by line; a function with none is `(anonymous)`. This rail
// keeps the table honest: an entry must equal that function's real size (a number here only ever goes DOWN), a
// function that is gone or under the base has no entry, and a function over the base without one fails.
type Kind = 'complexity' | 'lines';
const KINDS: Kind[] = ['complexity', 'lines'];
const table = JSON.parse(readFileSync(new URL('../../lint-ratchet.json', import.meta.url), 'utf8')) as {
  base: Record<Kind, number>; complexity: Record<string, number>; lines: Record<string, number>;
};
const BASE_CEILING: Record<Kind, number> = { complexity: 15, lines: 60 };
const real: Record<Kind, Record<string, number>> = { complexity: {}, lines: {} };

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
  const found: Record<Kind, { file: string; name: string; line: number; n: number }[]> = { complexity: [], lines: [] };
  for (const r of await eslint.lintFiles(['src'])) {
    const file = r.filePath.slice(r.filePath.indexOf('/src/') + 1);
    for (const m of r.messages) {
      const kind: Kind | null = m.ruleId === 'complexity' ? 'complexity' : m.ruleId === 'max-lines-per-function' ? 'lines' : null;
      const n = kind && Number(/(?:complexity of |too many lines \()(\d+)/.exec(m.message)?.[1]);
      if (kind && n) found[kind].push({ file, name: /'([^']+)'/.exec(m.message)?.[1] ?? '(anonymous)', line: m.line, n });
    }
  }
  for (const kind of KINDS) {
    const all = found[kind].filter((f) => f.n > table.base[kind]).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
    const seen: Record<string, number> = {};
    const count = (f: (typeof all)[number]) => all.filter((x) => x.file === f.file && x.name === f.name).length;
    for (const f of all) {
      const id = `${f.file}::${f.name}`;
      seen[id] = (seen[id] ?? 0) + 1;
      real[kind][count(f) > 1 ? `${id}#${seen[id]}` : id] = f.n;
    }
  }
}, 60_000);

describe('lint ratchet (#1381, #1387)', () => {
  it.each(KINDS)('the %s base limit is no looser than its ceiling', (kind) => {
    expect(table.base[kind], `lint-ratchet.json: base.${kind} may go down, never up`).toBeLessThanOrEqual(BASE_CEILING[kind]);
  });

  for (const kind of KINDS) {
    it.each(Object.entries(table[kind]))(`${kind}: %s is frozen at its real size, %i`, (key, frozen) => {
      const now = real[kind][key];
      expect(now, `${key} has no ${kind} entry to keep: it is gone, renamed or under the base limit. Delete or rename the entry`).toBeDefined();
      expect(frozen, `${key}: it is now ${now}, so lower the ${kind} entry to ${now}`).toBe(now);
      expect(frozen).toBeGreaterThan(table.base[kind]);
    });

    it(`${kind}: no function over the base limit is missing from the table`, () => {
      const missing = Object.entries(real[kind]).filter(([k, n]) => n > table.base[kind] && !(k in table[kind])).map(([k, n]) => `${k} (${n})`);
      expect(missing, `new ${kind} over ${table.base[kind]}: split the function, do not add an entry`).toEqual([]);
    });
  }
});
