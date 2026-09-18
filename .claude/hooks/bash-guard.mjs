import { deny, isMain, readInput } from './io.mjs';

/**
 * Layer-0 guard for every Bash call (#101). Each check returns a reason to deny, or null.
 *
 * The checks decide for themselves whether the command is theirs. They used to lean on the hook's `if:`
 * filter, which Claude Code documents as best-effort: on a command holding `$()`, backticks or `$VAR` it runs
 * the hook anyway. The force-push check then saw any ` -f ` as a force flag and denied `rm -rf`, `tail -f`
 * and `gh api -f` (#231).
 */

// The arguments of each `git push` in the command. Only git's own global options may sit between `git` and
// `push`, so a commit message that merely talks about pushing is not a push.
const PUSH = /(?:^|[\s;&|(`])git(?:\s+(?:-[Cc]\s+\S+|--[\w-]+(?:=\S+)?))*\s+push\b([^;&|\n)`]*)/g;
const FORCE = /(?:^|\s)(?:--force(?:-with-lease|-if-includes)?(?:=\S*)?|-[a-zA-Z]*f[a-zA-Z]*)(?:\s|$)|(?:^|\s)\+\S/;

export const forcePush = (cmd) => [...cmd.matchAll(PUSH)].some((m) => FORCE.test(m[1]))
  ? 'Force-push denied (.claude/rules/guardrails.md, #101 layer 0): never force-push without the user explicitly asking for it in this session.'
  : null;

const MARKERS = ['OWNER: APPROVED', 'OWNER: REJECTED'];
const runs = (cmd, tool) => new RegExp(`(?:^|[\\s;&|(\`])${tool}\\s`).test(cmd);

export const ownerMarker = (cmd) =>
  MARKERS.some((m) => cmd.includes(m)) && (runs(cmd, 'gh') || (runs(cmd, 'curl') && cmd.includes('api.github.com')))
    ? 'No agent ever writes an OWNER: APPROVED / OWNER: REJECTED marker (CLAUDE.md, #101 layer 0) - only the human owner writes these, in the GitHub UI.'
    : null;

export const worklogAppend = (cmd) => />>\s*(?:\S*\/)?WORKLOG\.md(?:\s|$)/.test(cmd.replace(/['"]/g, ''))
  ? 'WORKLOG.md at the repo root is retired (#98): nothing appends to it again. See docs/worklog/.'
  : null;

export const check = ({ command }) => {
  const cmd = typeof command === 'string' ? command : '';
  return forcePush(cmd) ?? ownerMarker(cmd) ?? worklogAppend(cmd);
};

if (isMain(import.meta.url)) {
  const reason = check(await readInput());
  if (reason) deny(reason);
}
