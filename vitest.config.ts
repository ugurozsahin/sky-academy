import { defineConfig } from 'vitest/config';
// CI's `test` job died with `[vitest-worker]: Timeout calling "onTaskUpdate"` after every test
// passed (#1645): a file of synchronous tests that runs longer than 60 s never lets the worker read
// the main process's RPC reply — `tests/unit/setup.ts` has the mechanism and the fix. PR #1649's
// `maxWorkers: 2` predated that finding and only moved the threshold, so it is gone (owner, 2026-10-07).
// Whole-tree-scanning tests (british.test.ts, guardrails.test.ts…)pass locally but crossed vitest's 5 s
// default on a loaded CI runner and failed unrelated PRs (#1742). 60 s matches the per-test timeouts of #1732.
export default defineConfig({ test: { testTimeout: 60_000, include: ['tests/unit/**/*.test.ts'], setupFiles: ['tests/unit/setup.ts'] } });
