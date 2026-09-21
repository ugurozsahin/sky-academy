import { deny, isMain, readInput } from './io.mjs';
import { projectDir, PROTECTED_SPELLING, protectedKind } from './paths.mjs';
import { base, commands, runsAt } from './shell.mjs';

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
 * What counts as protected is `protectedKind()`'s decision in `./paths.mjs`, asked rather than restated, so
 * the two guards cannot come to disagree about it. Only the message differs: a shell write never meets the
 * permission prompt the file guard's message talks about — it is simply not an unattended run's to make.
 *
 * It judges a target **two ways**, because either alone has a hole. By *spelling*, which needs no working
 * directory: nothing tracks `cd`, so `cd scripts && touch ../.owner-machine` resolved somewhere harmless and
 * walked round the whole rule. And by where it *lands*, which catches a target that names nothing protected
 * but lands there anyway. The `cd`-into-`.claude/` case needs both halves paired, and `entersProtected` is
 * that pairing.
 *
 * **What it cannot see**, and no command-line rule can: a script that opens the file itself (`python3 - <<EOF`,
 * `node -e`), a target assembled at run time (`$DIR/settings.json`, `$(…)` — `forcePush` fails closed on such
 * a word and this rule does not, deliberately, because a write target is far more often an ordinary `$TMPDIR`
 * path than a tool name is a disguised `git`), a working directory changed to a computed path, an editor
 * driven interactively, and a tool absent from the lists below — `git apply`, `patch`, `ed`, `rsync`,
 * `awk -i inplace` and `find -delete` among them. Claude Code's own permission documentation draws the same
 * line around its Bash checks. The bar here is `forcePush`'s — close the routes a run would really take and
 * say what is left open — and the seal is that a routine has no reason to be writing here at all (ADR 006 §5).
 */
const WRITE_REDIRECT = /^(>|>>|>\||>&|&>|&>>|<>)$/;
// Every operand is a path the tool writes — `mv` included, because it REMOVES its sources: `mv .claude
// .claude-old` relocates the whole guard, after which `.claude/settings.json` is gone, the PreToolUse
// commands fail, and a failing hook is a non-blocking error (PR #393 review). `chmod 000` on a hook is the
// same class. `cp`, `ln` and `install` are NOT here: they only read their sources.
const WRITES_EVERY_OPERAND = /^(tee|touch|rm|rmdir|mkdir|truncate|unlink|shred|mv|chmod|chown)$/;
// Only the destination counts, so a `.claude/` path as the SOURCE of a copy stays a read.
const WRITES_LAST_OPERAND = /^(cp|ln|install)$/;
const TARGET_DIR_FLAG = /^(-t|--target-directory)(=(.*))?$/;
const EDITS_IN_PLACE = /^(sed|gsed|perl|ruby)$/;
const IN_PLACE_FLAG = /^(-[a-zA-Z]*i|--in-place)/;
const GIT_WRITES_PATHS = /^(checkout|restore|clean)$/;
const CHANGES_DIR = /^(cd|pushd|chdir)$/;
// Wrappers that take a command as their argument, and a bare duration for `timeout`/`sleep`-shaped ones.
const WRAPPER = /^(env|sudo|nohup|nice|time|timeout|command|builtin|stdbuf|xargs|exec)$/;
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const isOption = (word) => word.startsWith('-');

/**
 * Where the tool a statement runs stands, or -1. **Command position**, unlike `forcePush` above, which counts
 * a tool wherever its name appears: these rules read OPERANDS, and an operand can be a filename or a pattern.
 * Reading `touch` as the tool in `grep -rn touch .claude/hooks/bash-guard.mjs` made a plain READ a denial
 * that told the run to abandon its item (PR #393 review, B5a).
 */
const toolAt = (words) => words.findIndex((w) =>
  !ASSIGNMENT.test(w) && !isOption(w) && !WRAPPER.test(base(w)) && !/^\d+(\.\d+)?[smhd]?$/.test(w));

/** Every path a statement would write, spelled as the command line spells it. */
const writeTargets = ({ words, redirects }) => {
  const targets = redirects.filter((r) => WRITE_REDIRECT.test(r.op)).map((r) => r.target);
  const at = toolAt(words);
  if (at < 0) return targets;
  const tool = base(words[at]), rest = words.slice(at + 1);
  const flagged = rest.find((w) => isOption(w) && TARGET_DIR_FLAG.test(w));
  const operands = rest.filter((w, i) => !isOption(w) && !TARGET_DIR_FLAG.test(rest[i - 1] ?? ''));
  if (WRITES_EVERY_OPERAND.test(tool)) targets.push(...operands);
  if (WRITES_LAST_OPERAND.test(tool)) {
    // With `-t DIR` / `--target-directory=DIR` the destination is the flag's value and EVERY operand is a
    // source, so the last one is a read. Without it, the last operand is the destination.
    if (flagged) targets.push(TARGET_DIR_FLAG.exec(flagged)[3] ?? rest[rest.indexOf(flagged) + 1] ?? '');
    else if (operands.length > 1) targets.push(operands[operands.length - 1]);
  }
  // The script argument is an operand too (`sed -i '' 's/x/y/' f`), but it resolves to a path nothing
  // protects, so letting it through the filter costs nothing and keeps this rule off flag parsing.
  if (EDITS_IN_PLACE.test(tool) && rest.some((w) => isOption(w) && IN_PLACE_FLAG.test(w))) targets.push(...operands);
  if (tool === 'dd') targets.push(...rest.filter((w) => w.startsWith('of=')).map((w) => w.slice(3)));
  const sub = rest.findIndex((w) => GIT_WRITES_PATHS.test(w));
  if (tool === 'git' && sub >= 0) targets.push(...rest.slice(sub + 1).filter((w) => !isOption(w)));
  return targets.filter((t) => t !== '');
};

/** A statement that walks INTO a protected directory, which makes every later relative target unjudgeable. */
const entersProtected = ({ words }) => {
  const at = toolAt(words);
  return at >= 0 && CHANGES_DIR.test(base(words[at]))
    && words.slice(at + 1).some((w) => !isOption(w) && PROTECTED_SPELLING.test(w));
};

export const claudeWrite = (cmd, root) => {
  const dir = projectDir(root);
  const statements = commands(cmd);
  // `cd .claude && rm -rf hooks` names no protected path in the thing it writes, so the spelling rule cannot
  // see it and nothing tracks the working directory. Pairing the two halves of the command is what closes it.
  const entered = statements.some(entersProtected);
  for (const statement of statements)
    for (const spelled of writeTargets(statement)) {
      const kind = entered ? 'claude' : protectedKind(spelled, dir);
      if (kind === null) continue;
      const what = entered ? `${spelled}, written after a cd into .claude/,` : spelled;
      return kind === 'marker'
        ? `${spelled} is the owner's-machine marker (#342). It is how these guards tell a checkout with a `
          + "person in it from a routine's clone, so nothing a run does may bring it into existence — through "
          + 'the shell no more than through Write, and no more from another directory than from this one. If '
          + 'a .claude/ write was just refused, that refusal stands. .claude/rules/governance.md has both.'
        : kind === 'root'
          ? `${what} is the checkout root or above it, and a write there takes .claude/ down with it (#342). `
            + 'Name the files you mean instead. Do not retry as spelled — .claude/rules/governance.md has the rule.'
          : `${what} is under .claude/, a protected path (#342), and it is not an unattended run's to write `
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
