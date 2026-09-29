import { readFileSync } from 'node:fs';
import tseslint from 'typescript-eslint';

// Two rules only (#1381). `lint-ratchet.json` holds the base limits and, per file, the size of its worst function
// today; a number there only ever goes DOWN (`tests/unit/lint-ratchet.test.ts`, `.claude/rules/guardrails.md`).
const { base, complexity, lines } = JSON.parse(readFileSync(new URL('./lint-ratchet.json', import.meta.url), 'utf8'));
const linesRule = (max) => ['error', { max, skipBlankLines: true, skipComments: true }];

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    rules: { complexity: ['error', { max: base.complexity }], 'max-lines-per-function': linesRule(base.lines) },
  },
  ...Object.entries(complexity).map(([file, max]) => ({ files: [file], rules: { complexity: ['error', { max }] } })),
  ...Object.entries(lines).map(([file, max]) => ({ files: [file], rules: { 'max-lines-per-function': linesRule(max) } })),
];
