import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// #1645: `tests/unit/setup.ts` has the mechanism. Two halves are pinned — that the config loads the file, and
// that a macrotask turn really happens between two synchronous tests, which is what lets the worker read the
// main process's RPC reply before birpc's 60 s deadline.
describe('every test yields one macrotask turn to the worker RPC (#1645)', () => {
  it('vitest.config.ts loads tests/unit/setup.ts for every file', () => {
    expect(readFileSync('vitest.config.ts', 'utf8')).toMatch(/setupFiles: \['tests\/unit\/setup\.ts'\]/);
  });
  it('setup.ts captures setImmediate before a test can fake it, and awaits it after each test', () => {
    const src = readFileSync('tests/unit/setup.ts', 'utf8');
    expect(src).toContain('const nextTurn = globalThis.setImmediate;');
    expect(src).toContain('afterEach(() => new Promise<void>((resolve) => nextTurn(resolve)));');
  });

  let turned = false;
  it('schedules a macrotask', () => { setImmediate(() => { turned = true; }); expect(turned).toBe(false); });
  it('the next synchronous test runs after that macrotask, not before it', () => { expect(turned).toBe(true); });
});
