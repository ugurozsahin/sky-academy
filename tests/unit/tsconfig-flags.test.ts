import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// A rail (#1380): the compiler flags that cost nothing to keep stay on. A run cannot switch one off to get green.
const FLAGS = ['strict', 'noImplicitReturns', 'noFallthroughCasesInSwitch', 'noImplicitOverride', 'noUnusedLocals', 'noUnusedParameters'];
const opts = JSON.parse(readFileSync(new URL('../../tsconfig.json', import.meta.url), 'utf8')).compilerOptions;

describe('tsconfig.json keeps the strict flags on (#1380)', () => {
  it.each(FLAGS)('%s is true', (flag) => {
    expect(opts[flag], `${flag} must stay true in tsconfig.json; fix the errors it reports instead`).toBe(true);
  });
});
