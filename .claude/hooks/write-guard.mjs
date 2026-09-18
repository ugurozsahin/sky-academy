import { resolve } from 'node:path';
import { deny, isMain, readInput } from './io.mjs';

/** Layer-0 guard for Write and Edit (#101): the root WORKLOG.md is retired (#98). `docs/worklog/` is not. */
export const check = ({ file_path }, root = process.env.CLAUDE_PROJECT_DIR || process.cwd()) =>
  typeof file_path === 'string' && resolve(root, file_path) === resolve(root, 'WORKLOG.md')
    ? 'WORKLOG.md at the repo root is retired (#98): nothing writes to it again. See docs/worklog/.'
    : null;

if (isMain(import.meta.url)) {
  const reason = check(await readInput());
  if (reason) deny(reason);
}
