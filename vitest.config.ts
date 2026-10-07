import { defineConfig } from 'vitest/config';
// CI's `test` job died with `[vitest-worker]: Timeout calling "onTaskUpdate"` after every test
// passed (#1645): a file of synchronous tests that runs longer than 60 s never lets the worker read
// the main process's RPC reply — `tests/unit/setup.ts` has the mechanism and the fix. PR #1649's
// `maxWorkers: 2` predated that finding and only moved the threshold, so it is gone (owner, 2026-10-07).
export default defineConfig({ test: { include: ['tests/unit/**/*.test.ts'], setupFiles: ['tests/unit/setup.ts'] } });
