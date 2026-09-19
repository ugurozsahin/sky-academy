import { deny, isMain, readInput } from './io.mjs';
import { commands, runsAt } from './shell.mjs';

/**
 * Layer-0 guard for every Bash call (#101). Each check returns a reason to deny, or null.
 *
 * The checks ask what the command would run (`shell.mjs`), not whether some text appears in it. Text
 * matching was wrong in both directions: it denied `rm -rf` and `tail -f` as force-pushes (#231), and it
 * missed a force flag after a line continuation or a quoted argument (PR #255 review).
 *
 * They lean towards denying. A tool counts as run wherever its name stands in a statement, so nothing depends
 * on a list of wrappers (`timeout 30 git push …`, `xargs gh …`); the price is that `echo git push --force`
 * is denied too. And a command the parser cannot finish reading is denied, never waved through.
 */

const isForce = (arg) => /^--force(-with-lease|-if-includes)?(=.*)?$/.test(arg) || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(arg) || /^\+./.test(arg);
// A word only known at run time (`$GIT`, `$(which git)`): it might be the tool we guard.
const unknownAt = (words) => words.flatMap((w, i) => (w.startsWith('$') ? [i] : []));

// The arguments of a `git push` whose `git` stands at `words[at]`, or null. git's own options come first.
const pushArgs = (words, at) => {
  let i = at + 1;
  while (i < words.length && words[i].startsWith('-')) i += /^-[Cc]$|^--(git-dir|work-tree|namespace)$/.test(words[i]) ? 2 : 1;
  return words[i] === 'push' ? words.slice(i + 1) : null;
};

export const forcePush = (cmd) => commands(cmd).some(({ words }) =>
  [...runsAt(words, 'git'), ...unknownAt(words)].some((at) => pushArgs(words, at)?.some(isForce)))
  ? 'Force-push denied (.claude/rules/guardrails.md, #101 layer 0): never force-push without the user explicitly asking for it in this session.'
  : null;

const MARKERS = ['OWNER: APPROVED', 'OWNER: REJECTED'];
const postsToGitHub = ({ words }) => runsAt(words, 'gh').length > 0 || words[0]?.startsWith('$')
  || (runsAt(words, 'curl').length > 0 && words.some((w) => w.includes('api.github.com')));

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
    // Reading the command failed — an unterminated quote or substitution, or a parser bug. Either way the
    // guard does not know what would run, so it must not say "nothing to see".
    return `The Bash guard could not read this command (${e?.message ?? e}). Close every quote and substitution, or split it into simpler commands.`;
  }
};

if (isMain(import.meta.url)) {
  const reason = check(await readInput());
  if (reason) deny(reason);
}
