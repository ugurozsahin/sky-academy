import { defineConfig } from 'vitest/config';
// CI's `test` job died with `[vitest-worker]: Timeout calling "onTaskUpdate"` after every test
// passed (#1645). Several files spawn child processes synchronously, so on the 4-core runner three
// workers plus those children left the main process too starved to answer a worker's RPC within
// vitest's fixed 60 s. Two workers leave headroom for it.
export default defineConfig({ test: { include: ['tests/unit/**/*.test.ts'], maxWorkers: 2 } });
