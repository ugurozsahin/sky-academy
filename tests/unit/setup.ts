import { afterEach } from 'vitest';

// #1645: Vitest 3's worker awaits an `onTaskUpdate` acknowledgement from the main process on birpc's fixed
// 60 s deadline, and that reply is only read from the IPC channel on a macrotask turn. A file of synchronous
// tests never takes one, so once the file runs longer than 60 s on a slow runner the deadline fires after
// every test has passed (`session.test.ts` at 60–63 s: red; 54 s: green). Upstream fix vitest-dev/vitest#8297
// ships in 4.0.0 only. One macrotask turn after each test lets the reply in. Captured before any test can
// install fake timers, which replace `setImmediate`.
const nextTurn = globalThis.setImmediate;
afterEach(() => new Promise<void>((resolve) => nextTurn(resolve)));
