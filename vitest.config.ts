import { defineConfig } from 'vitest/config';
// CI's `test` job died with `[vitest-worker]: Timeout calling "onTaskUpdate"` after every test
// passed (#1645): a file of synchronous tests that runs longer than 60 s never lets the worker read
// the main process's RPC reply — `tests/unit/setup.ts` has the mechanism and the fix. `maxWorkers: 2`
// (PR #1649) predates that finding; it only makes each file faster on a loaded runner.
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts'], setupFiles: ['tests/unit/setup.ts'], maxWorkers: 2 },
});
