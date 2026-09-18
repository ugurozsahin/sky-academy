import { deny, isMain, readInput } from './io.mjs';
import { commands } from './shell.mjs';

/**
 * Layer-0 guard for every Bash call (#101). Each check returns a reason to deny, or null.
 *
 * The checks ask what the command would run (`shell.mjs`), not whether some text appears in it. Text
 * matching was wrong in both directions: it denied `rm -rf` and `tail -f` as force-pushes (#231), and it
 * missed a force flag after a line continuation or a quoted argument (PR #255 review).
 */

const isForce = (arg) => /^--force(-with-lease|-if-includes)?(=.*)?$/.test(arg) || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(arg) || /^\+./.test(arg);
// A command name that is only known at run time (`$GIT`, `$(which git)`): it might be the one we guard.
const isUnknown = (name) => name.startsWith('$');

const pushArgs = ({ name, args }) => {
  if (isUnknown(name)) return args.includes('push') ? args.slice(args.indexOf('push') + 1) : null;
  if (name !== 'git') return null;
  let i = 0;                                                    // git's own options come before the subcommand
  while (i < args.length && args[i].startsWith('-')) i += /^-[Cc]$|^--(git-dir|work-tree|namespace)$/.test(args[i]) ? 2 : 1;
  return args[i] === 'push' ? args.slice(i + 1) : null;
};

export const forcePush = (cmd) => commands(cmd).some((c) => pushArgs(c)?.some(isForce))
  ? 'Force-push denied (.claude/rules/guardrails.md, #101 layer 0): never force-push without the user explicitly asking for it in this session.'
  : null;

const MARKERS = ['OWNER: APPROVED', 'OWNER: REJECTED'];
const postsToGitHub = ({ name, args }) =>
  name === 'gh' || isUnknown(name) || (name === 'curl' && args.some((a) => a.includes('api.github.com')));

// Deliberately broad once a real `gh`/`curl` call is on the line: the marker may reach it through a pipe, a
// heredoc or a substitution, so its text anywhere in the command counts. With no such call it is only prose.
export const ownerMarker = (cmd) => MARKERS.some((m) => cmd.includes(m)) && commands(cmd).some(postsToGitHub)
  ? 'No agent ever writes an OWNER: APPROVED / OWNER: REJECTED marker (CLAUDE.md, #101 layer 0) - only the human owner writes these, in the GitHub UI.'
  : null;

const isRootWorklog = (target) => /(^|\/)WORKLOG\.md$/.test(target);

export const worklogAppend = (cmd) =>
  commands(cmd).some((c) => c.redirects.some((r) => (r.op === '>>' || r.op === '&>>') && isRootWorklog(r.target)))
    ? 'WORKLOG.md at the repo root is retired (#98): nothing appends to it again. See docs/worklog/.'
    : null;

export const check = ({ command }) => {
  const cmd = typeof command === 'string' ? command : '';
  try {
    return forcePush(cmd) ?? ownerMarker(cmd) ?? worklogAppend(cmd);
  } catch (e) {
    // A parser bug must not switch the guard off without anyone noticing. Denying says so, and costs one retry.
    return `The Bash guard could not read this command (${e?.message ?? e}). Split it into simpler commands.`;
  }
};

if (isMain(import.meta.url)) {
  const reason = check(await readInput());
  if (reason) deny(reason);
}
