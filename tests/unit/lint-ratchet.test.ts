import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { beforeAll, describe, expect, it } from 'vitest';

// The lint ratchet (#1381, per function since #1387, tests since #1388). `eslint.config.js` sets a base limit for `complexity` and
// `max-lines-per-function` in `src/` and freezes each function that is over today, keyed `file::name`, at its size. A
// name that occurs twice among a file's over-base functions is `name#1`, `name#2` by line; a function with none is `(anonymous)`. This rail
// keeps the table honest (`tests/unit/` gets `complexity` only; the file length of `src/` and `tests/unit/` is the `fileLines` table, below): an entry must equal that function's real size (a number here only ever goes DOWN), a
// function that is gone or under the base has no entry, and a function over the base without one fails.
type Kind = 'complexity' | 'lines';
const KINDS: Kind[] = ['complexity', 'lines'];
const table = JSON.parse(readFileSync(new URL('../../lint-ratchet.json', import.meta.url), 'utf8')) as {
  base: Record<Kind, number> & { fileLines: number };
  complexity: Record<string, number>; lines: Record<string, number>; fileLines: Record<string, number>;
};
const ROOT = new URL('../../', import.meta.url).pathname;
const BASE_CEILING = { complexity: 15, lines: 60, fileLines: 600 };
const real: Record<Kind, Record<string, number>> = { complexity: {}, lines: {} };

beforeAll(async () => {
  const eslint = new ESLint({
    cwd: ROOT,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['src/**/*.ts'],
        languageOptions: { parser: tseslint.parser },
        rules: { complexity: ['error', { max: 1 }], 'max-lines-per-function': ['error', { max: 1, skipBlankLines: true, skipComments: true }] },
      },
      { files: ['tests/unit/**/*.ts'], languageOptions: { parser: tseslint.parser }, rules: { complexity: ['error', { max: 1 }] } },
    ],
  });
  const found: Record<Kind, { file: string; name: string; line: number; n: number }[]> = { complexity: [], lines: [] };
  for (const r of await eslint.lintFiles(['src', 'tests/unit'])) {
    const file = relative(ROOT, r.filePath);
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
  it.each([...KINDS, 'fileLines' as const])('the %s base limit is no looser than its ceiling', (kind) => {
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

  const tsFiles = (dir: string): string[] => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tsFiles(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []);
  const FILE_DIRS = ['src', 'tests/unit'];
  const fileLinesOf = () => FILE_DIRS.flatMap(tsFiles);
  const length = (file: string) => readFileSync(join(ROOT, file), 'utf8').split('\n').length - 1;

  it.each(Object.entries(table.fileLines))('fileLines: %s is frozen at its real length, %i', (file, frozen) => {
    const now = fileLinesOf().includes(file) ? length(file) : undefined;
    expect(now, `${file} is gone or renamed: delete or rename its fileLines entry`).toBeDefined();
    expect(frozen, now! > frozen
      ? `${file} grew to ${now} lines and a frozen file cannot grow: ${file.startsWith('src/')
        ? 'move the code you added to a new file, in a folder named for the module (guardrails.md, "a frozen src file")'
        : 'move the tests you added to a new tests/unit/*.test.ts'}, and leave the entry at ${frozen}`
      : `${file} shrank to ${now} lines: lower the entry to ${now}`).toBe(now);
    expect(frozen).toBeGreaterThan(table.base.fileLines);
  });

  it('fileLines: no src or test file over the base length is missing from the table', () => {
    const missing = fileLinesOf().filter((f) => length(f) > table.base.fileLines && !(f in table.fileLines));
    expect(missing, `over ${table.base.fileLines} lines: put the new code or tests in a new file, do not add an entry`).toEqual([]);
  });
});
