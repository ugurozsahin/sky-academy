import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { deny, isMain, readInput } from './io.mjs';

/** A path with its **existing** prefix canonicalised. `realpathSync` for the reason `io.mjs` gives: on macOS
 *  a checkout reached through `/var` → `/private/var` otherwise compares unequal to itself. The target of a
 *  write usually does not exist yet, so the walk stops at the deepest ancestor that does and keeps the rest
 *  verbatim — which is why a symlink at the *last* segment is still judged on its own name. */
export const canonical = (path) => {
  let head = resolve(path);
  const tail = [];
  for (;;) {
    try { return resolve(realpathSync(head), ...tail); } catch { /* keep climbing */ }
    const up = resolve(head, '..');
    if (up === head) return resolve(path);
    tail.unshift(relative(up, head));
    head = up;
  }
};

/** The checkout this call is about. Exported because `.claude/hooks/bash-guard.mjs` judges shell write targets
 *  against the same root, by the same arithmetic — two guards that resolved paths differently would disagree
 *  about which checkout they are protecting, which is the one thing neither may get wrong (#346). */
export const projectDir = (root) => canonical(root || process.env.CLAUDE_PROJECT_DIR || process.cwd());

/** Layer-0 guard for Write and Edit (#101): the root WORKLOG.md is retired (#98). `docs/worklog/` is not. */
const worklog = (target, base) => target === resolve(base, 'WORKLOG.md')
  ? 'WORKLOG.md at the repo root is retired (#98): nothing writes to it again. See docs/worklog/.'
  : null;

/** Present only in the owner's working copy: gitignored, so it is never in a clone (#342). */
export const OWNER_MARKER = '.owner-machine';

/**
 * Resolved `target` is inside `base`. `relative()` rather than a string prefix, so `.claudex/` is not read as
 * `.claude/`, and `..` is tested as a whole path segment — `.claude/..hidden` climbs nowhere and is inside.
 * Lexical only: a symlink *under* `base` pointing out, or in, is judged on its spelling. The root itself is
 * canonicalised in `projectDir()`, which is the case that has actually bitten this repository.
 */
const under = (base, target) => {
  const rel = relative(base, target);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};

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
 * **This decides what is protected; it does not decide who asked.** The `Write` and `Edit` tools arrive
 * through `check` below, and `claudeWrite` in `.claude/hooks/bash-guard.mjs` calls this same function on the
 * paths a shell command would write, so the two guards cannot drift apart about which paths count (#346).
 * Neither reaches a script that opens a file itself; the marker is a switch, not a seal, and the seal is that
 * a routine has no reason to be writing here at all.
 *
 * The directory `.claude` itself counts, not only what is under it: a file tool cannot name a directory, but
 * `rm -rf .claude` does, and that one route would otherwise be the loudest thing this rule misses.
 */
export const claudeDir = (target, base) => {
  const marker = resolve(base, OWNER_MARKER);
  const claude = resolve(base, '.claude');
  const inClaude = target === claude || under(claude, target);
  if (!inClaude && target !== marker) return null;
  if (existsSync(marker)) return null;                    // the owner is at the keyboard; both are his to edit
  const name = relative(base, target);
  return inClaude
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
