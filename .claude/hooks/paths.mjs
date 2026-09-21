import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

/**
 * One decision, shared by `write-guard.mjs` (the `Write`/`Edit` tools) and `bash-guard.mjs` (the shell):
 * **is this path one an unattended run may write?** It lives here rather than in either guard so that neither
 * can come to answer it differently, and so that each guard module exports nothing but its own rules — which
 * is what lets `tests/unit/hooks.test.ts` hold "every exported rule is reachable from `check`" without
 * exempting helpers by name (#359).
 *
 * Nothing here formats a message. A guard takes the *kind* and says its own sentence, because a shell write
 * and a file write need different advice (#346, PR #393 review).
 */

/** Present only in the owner's working copy: gitignored, so it is never in a clone (#342). */
export const OWNER_MARKER = '.owner-machine';

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

/** The checkout a call is about. */
export const projectDir = (root) => canonical(root || process.env.CLAUDE_PROJECT_DIR || process.cwd());

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
 * A **spelling** that names a protected path, as a whole segment, wherever it would resolve.
 *
 * This is the half that does not depend on a working directory, and it is what closes the family PR #393's
 * round-1 review found: nothing tracks `cd`, and `shell.mjs` hands every statement over flat, so
 * `cd scripts && touch ../.owner-machine` resolved to a harmless-looking path and sailed through — the one
 * command the whole rule exists to refuse. Judging the spelling also covers a checkout reached by another
 * route entirely (a second worktree, an absolute path into a clone). It only ever over-denies: naming a
 * `.claude` or `.owner-machine` segment in something a command *writes* is not a thing a run has business
 * doing, whatever directory it is standing in.
 */
export const PROTECTED_SPELLING = /(^|\/)(\.claude|\.owner-machine)(\/|$)/;

/**
 * What `spelled` is, judged both ways — by its spelling, and by where it lands given `base`:
 *
 *   `'marker'` the owner's-machine marker · `'claude'` the `.claude/` tree, the directory itself included ·
 *   `'root'`   the checkout root or an ancestor of it, which a recursive write takes `.claude/` down with ·
 *   `null`     not this rule's business, **or** the checkout carries the marker and the owner is at the keyboard.
 */
export const protectedKind = (spelled, base) => {
  if (existsSync(resolve(base, OWNER_MARKER))) return null;     // the owner is at the keyboard; both are his
  if (PROTECTED_SPELLING.test(spelled)) return /\.owner-machine(\/|$)/.test(spelled) ? 'marker' : 'claude';
  const target = canonical(resolve(base, spelled));
  if (target === resolve(base, OWNER_MARKER)) return 'marker';
  const claude = resolve(base, '.claude');
  if (target === claude || under(claude, target)) return 'claude';
  // `rm -rf .`, `git checkout -- .`, `rm -rf ..`: `under()` only looks downward, so an ancestor of the
  // checkout walked past the rule while destroying everything inside it (PR #393 review, note 1).
  if (target === base || under(target, base)) return 'root';
  return null;
};
