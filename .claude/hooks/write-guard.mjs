import { existsSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { deny, isMain, readInput } from './io.mjs';

const dir = (root) => root || process.env.CLAUDE_PROJECT_DIR || process.cwd();

/** Layer-0 guard for Write and Edit (#101): the root WORKLOG.md is retired (#98). `docs/worklog/` is not. */
export const worklog = ({ file_path }, root) =>
  typeof file_path === 'string' && resolve(dir(root), file_path) === resolve(dir(root), 'WORKLOG.md')
    ? 'WORKLOG.md at the repo root is retired (#98): nothing writes to it again. See docs/worklog/.'
    : null;

/** Present only in the owner's working copy: gitignored, so it is never in a clone (#342). */
export const OWNER_MARKER = '.owner-machine';

/** Resolved `target` is inside `base`. `relative()` rather than a string prefix, so `.claudex/` is not read
 *  as `.claude/` and a path that climbs out with `..` is judged on where it actually lands. */
const under = (base, target) => {
  const rel = relative(base, target);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

/**
 * `.claude/` is a Claude Code **protected path**, like `.git/`: a write there is never auto-approved, and no
 * cloud-routine setting changes that — `permissions.allow` does not reach protected paths, cloud sessions
 * cannot use `bypassPermissions`, and a routine has no permission-mode picker (#340). So an unattended run
 * that edits one of these files stops at a prompt no unattended run can answer: PR #294 stalled 7h33m and
 * PR #318 stalled overnight, both on `.claude/rules/governance.md`, and the approval a `.claude/` prompt
 * offers is scoped to that session, so it can never carry to the next scheduled run.
 *
 * Denying here ends the stall, because `PreToolUse` runs *before* the permission system: the call is refused
 * in milliseconds instead of waiting hours for a person. Reads are untouched — a run still reads CLAUDE.md,
 * the rules, the skills and these hooks.
 *
 * The marker is checked, never trusted to a flag a run could set: writing it is denied by the same rule, so
 * a run cannot grant itself the permission it was just refused.
 */
export const claudeDir = ({ file_path }, root) => {
  if (typeof file_path !== 'string') return null;
  const base = dir(root);
  const target = resolve(base, file_path);
  if (!under(resolve(base, '.claude'), target) && target !== resolve(base, OWNER_MARKER)) return null;
  if (existsSync(resolve(base, OWNER_MARKER))) return null;
  return `${relative(base, target) || file_path} is under .claude/, a protected path (#342). An unattended run `
    + 'cannot write there: the permission prompt it raises has no one to answer it, and it stalled PR #294 for '
    + '7h33m and PR #318 overnight. Do not retry and do not work around it. Say on the issue what needed '
    + 'changing here and why, label it `owner-session`, and take the next item — .claude/rules/governance.md '
    + 'has the rule. (In a session with the owner: create .owner-machine at the repo root.)';
};

export const check = (input, root) => worklog(input, root) ?? claudeDir(input, root);

if (isMain(import.meta.url)) {
  const reason = check(await readInput());
  if (reason) deny(reason);
}
