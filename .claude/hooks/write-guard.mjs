import { resolve, sep } from 'node:path';
import { deny, isMain, readInput } from './io.mjs';
import { canonical, projectDir, protectedKind } from './paths.mjs';

/** Layer-0 guard for Write and Edit (#101): the root WORKLOG.md is retired (#98). `docs/worklog/` is not. */
const worklog = (target, base) => target === resolve(base, 'WORKLOG.md')
  ? 'WORKLOG.md at the repo root is retired (#98): nothing writes to it again. See docs/worklog/.'
  : null;

/**
 * `.claude/` is a Claude Code **protected path**, like `.git/`: a write there is never auto-approved, and no
 * cloud-routine setting changes that — `permissions.allow` does not reach protected paths, cloud sessions
 * cannot use `bypassPermissions`, and a routine has no permission-mode picker (#340,
 * `docs/decisions/006-a-routine-never-writes-under-claude.md`). So an unattended run that edits one of these
 * files stops at a prompt no unattended run can answer: PR #294 stalled 7h33m and PR #318 stalled overnight,
 * both on `.claude/rules/governance.md`, and the approval a `.claude/` prompt offers is scoped to that
 * session, so it can never carry to the next scheduled run.
 *
 * Denying here ends the stall, because `PreToolUse` runs *before* the permission system: the call is refused
 * in milliseconds instead of waiting hours for a person. Reads are untouched.
 *
 * **Which paths count is `protectedKind()`'s, not this function's** — `.claude/hooks/bash-guard.mjs` asks the
 * same question of the paths a shell command would write, so the two guards cannot drift apart about it
 * (#346). What differs is the sentence: a run refused here met a permission prompt, and a run refused in the
 * shell did not. The marker is a switch, not a seal; the seal is that a routine has no reason to write here.
 */
export const claudeDir = (target, base) => {
  const kind = protectedKind(target, base);
  if (kind === null || kind === 'root') return null;            // a file tool cannot name a directory
  const name = target.startsWith(base + sep) ? target.slice(base.length + 1) : target;
  return kind === 'claude'
    ? `${name} is under .claude/, a protected path (#342): a write there raises a permission prompt an `
      + 'unattended run cannot answer, and it stalled PR #294 for 7h33m and PR #318 overnight. Do not retry, '
      + 'and do not look for another route to the same edit. Say on the issue what needed changing here and '
      + 'why, label it `owner-session`, and take the next item — .claude/rules/governance.md has the rule.'
    // Its own reason. The marker is at the repo root, so the sentence above would state a false fact here —
    // and a run just refused a `.claude/` write must not read this one as a way to get it. Only the owner
    // creates this file, by hand, once per checkout; where that is written down is `governance.md`, not here.
    : `${name} is the owner's-machine marker (#342). It is how this guard tells a checkout with a person in `
      + "it from a routine's clone, so nothing a run does may bring it into existence. This is not the "
      + '.claude/ rule and creating this file is not a way round one: if a write there was just refused, that '
      + 'refusal stands. .claude/rules/governance.md has both.';
};

// A protected-path rule that fails open on its own bug is worse than none, so everything it touches — the
// payload, the filesystem, the path arithmetic — is inside the `try`. `io.mjs` lets unreadable *input*
// through on purpose; that is the tool's payload arriving malformed, not this rule failing to decide.
export const check = (input, root) => {
  try {
    const base = projectDir(root);
    if (typeof input?.file_path !== 'string') return null;
    const target = canonical(resolve(base, input.file_path));
    return worklog(target, base) ?? claudeDir(target, base);
  } catch {
    return 'write-guard could not decide about this path (#342), so it refused. Treat it as a denied .claude/ '
      + 'write: say what needed changing on the issue, label it `owner-session`, and move on.';
  }
};

if (isMain(import.meta.url)) {
  const reason = check(await readInput());
  if (reason) deny(reason);
}
