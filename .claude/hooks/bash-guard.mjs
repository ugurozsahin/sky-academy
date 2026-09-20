import { resolve } from 'node:path';
import { deny, isMain, readInput } from './io.mjs';
import { base, commands, runsAt } from './shell.mjs';
import { canonical, claudeDir, OWNER_MARKER, projectDir } from './write-guard.mjs';

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

/**
 * The shell route round the file guard (#346). `write-guard.mjs` refuses a `Write` or `Edit` under `.claude/`,
 * or of the owner marker, in a checkout with no `.owner-machine` — but nothing stopped the same edit arriving
 * as `sed -i '' 's/x/y/' .claude/rules/governance.md`, and nothing stopped `touch .owner-machine`: one command
 * after which every later write in that checkout is allowed, permanently and silently.
 *
 * What counts as protected is `claudeDir()`'s decision, called rather than restated, so the two guards cannot
 * come to disagree about it. Only the message differs: a shell write never meets the permission prompt the
 * file guard's message talks about — it is simply not an unattended run's to make.
 *
 * **What it cannot see**, and no command-line rule can: a script that opens the file itself (`python3 - <<EOF`,
 * `node -e`), a target assembled at run time (`$DIR/settings.json`), an editor driven interactively, or a tool
 * absent from the lists below. Claude Code's own permission documentation draws the same line around its Bash
 * checks. The bar here is `forcePush`'s — close the routes a run would really take and say what is left open —
 * and the seal is that a routine has no reason to be writing here at all (ADR 006 §5).
 */
const WRITE_REDIRECT = /^(>|>>|>\||&>|&>>|<>)$/;
const WRITES_EVERY_OPERAND = /^(tee|touch|rm|rmdir|mkdir|truncate|unlink|shred)$/;
// `cp`, `mv`, `ln` and `install` read their sources, so only the destination counts: naming a `.claude/` file
// as the SOURCE of a copy is a read, and reads stay allowed.
const WRITES_LAST_OPERAND = /^(cp|mv|ln|install)$/;
const EDITS_IN_PLACE = /^(sed|gsed|perl|ruby)$/;
const IN_PLACE_FLAG = /^(-[a-zA-Z]*i|--in-place)/;
const RESTORES_PATHS = /^(checkout|restore)$/;
const isOption = (word) => word.startsWith('-');

/** Every path a statement would write, spelled as the command line spells it. */
const writeTargets = ({ words, redirects }) => {
  const targets = redirects.filter((r) => WRITE_REDIRECT.test(r.op)).map((r) => r.target);
  words.forEach((word, i) => {
    const tool = base(word), rest = words.slice(i + 1), operands = rest.filter((w) => !isOption(w));
    if (WRITES_EVERY_OPERAND.test(tool)) targets.push(...operands);
    if (WRITES_LAST_OPERAND.test(tool)) {
      if (operands.length > 1) targets.push(operands[operands.length - 1]);
      const t = rest.findIndex((w) => w === '-t' || w === '--target-directory');   // `cp -t DIR src…`
      if (t >= 0) targets.push(rest[t + 1] ?? '');
    }
    // The script argument is an operand too (`sed -i '' 's/x/y/' f`), but it resolves to a path nothing
    // protects, so letting it through the filter costs nothing and keeps this rule off flag parsing.
    if (EDITS_IN_PLACE.test(tool) && rest.some((w) => isOption(w) && IN_PLACE_FLAG.test(w))) targets.push(...operands);
    if (tool === 'dd') targets.push(...rest.filter((w) => w.startsWith('of=')).map((w) => w.slice(3)));
    const sub = rest.findIndex((w) => RESTORES_PATHS.test(w));
    if (tool === 'git' && sub >= 0) targets.push(...rest.slice(sub + 1).filter((w) => !isOption(w)));
  });
  return targets.filter((t) => t !== '');
};

export const claudeWrite = (cmd, root) => {
  const dir = projectDir(root);
  const marker = resolve(dir, OWNER_MARKER);
  for (const statement of commands(cmd))
    for (const spelled of writeTargets(statement)) {
      const target = canonical(resolve(dir, spelled));
      if (!claudeDir(target, dir)) continue;
      return target === marker
        ? `${spelled} is the owner's-machine marker (#342). It is how these guards tell a checkout with a `
          + "person in it from a routine's clone, so nothing a run does may bring it into existence — through "
          + 'the shell no more than through Write. If a .claude/ write was just refused, that refusal stands. '
          + '.claude/rules/governance.md has both.'
        : `${spelled} is under .claude/, a protected path (#342), and it is not an unattended run's to write `
          + 'by any tool — the shell is not a way round the Write and Edit guard (#346). Do not retry. Say on '
          + 'the issue what needed changing here and why, label it `owner-session`, and take the next item — '
          + '.claude/rules/governance.md has the rule.';
    }
  return null;
};

export const check = ({ command }, root) => {
  const cmd = typeof command === 'string' ? command : '';
  try {
    return forcePush(cmd) ?? ownerMarker(cmd) ?? worklogAppend(cmd) ?? claudeWrite(cmd, root);
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
