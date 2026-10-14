import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM, run by Claude Code as a PreToolUse hook (.claude/settings.json)
import { BRANCH_PATTERN, check, prHead } from '../../.claude/hooks/github-write-guard.mjs';
import { pinSentence } from './helpers/pin-sentence';

/**
 * #1838: two runs pushed to the session's assigned `claude/` branch and opened pull requests (#1820, #1830) that
 * `branch-name` held red, one of them left a draft that no step picked up. Three rails: the layer-0 hook that
 * refuses such a `create_pull_request`, the hook's pattern held equal to CI's, and the two prompt clauses
 * (STEP 2.5's orphan draft, STEP 3's no-draft-at-the-end). In a file of their own because `hooks.test.ts` and
 * `governance.test.ts` are at their `lint-ratchet.json` length.
 *
 * Proved red: with `?? prHead(input)` removed from `check`, the check-level cases fail; with the `^` dropped
 * from the marker test (`/BRANCH: PUSH REFUSED/`), the mid-sentence case fails; with either prompt paragraph
 * deleted, its pin fails.
 */
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const denied = (input: unknown) => typeof check(input) === 'string';

describe('github-write-guard refuses a pull request from a branch CI will hold red (#1838)', () => {
  it('denies a claude/ head and any other non-repo-form name, through check()', () => {
    for (const head of ['claude/confident-meitner-cjdt5y', 'feature/no-number', 'Feature/1-x', 'fix/1-', 'chore/1-a_b', 'main', 'ugurozsahin:claude/x'])
      expect({ head, denied: denied({ head, base: 'main', body: 'Closes #1' }) }).toEqual({ head, denied: true });
  });

  it('allows feature|fix|chore/<n>-<slug>, bare or behind an owner: prefix', () => {
    for (const head of ['feature/1-x', 'fix/1838-branch-name', 'chore/12-a-b-c', 'ugurozsahin:feature/1-x'])
      expect({ head, denied: denied({ head, base: 'main', body: 'Closes #1' }) }).toEqual({ head, denied: false });
  });

  it('a BRANCH: PUSH REFUSED line at the start of a line is the one exception, as in CI; mid-sentence is not', () => {
    expect(denied({ head: 'claude/x', body: 'Part of #1\nBRANCH: PUSH REFUSED — tried fix/1-x: 403' })).toBe(false);
    expect(denied({ head: 'claude/x', body: 'BRANCH: PUSH REFUSED at the very start' })).toBe(false);
    expect(denied({ head: 'claude/x', body: 'I did not claim BRANCH: PUSH REFUSED here' })).toBe(true);
    expect(denied({ head: 'claude/x', body: ' BRANCH: PUSH REFUSED, indented' })).toBe(true);
    expect(denied({ head: 'claude/x', body: 'branch: push refused' }), "CI's grep is case-sensitive").toBe(true);
    expect(denied({ head: 'feature/1-x' }), 'a repo-form head needs no body at all').toBe(false);
  });

  it('refuses a head that is not a string, marker or not, and leaves calls with no head alone', () => {
    for (const head of [undefined, null, 42, ['feature/1-x']])
      expect({ head, denied: denied({ head, body: 'BRANCH: PUSH REFUSED' }) }).toEqual({ head, denied: true });
    expect(denied({ method: 'update', issue_number: 5, body: 'a comment' }), 'an issue write carries no head').toBe(false);
    expect(denied({ pullNumber: 3, draft: false }), 'update_pull_request carries no head').toBe(false);
    expect(() => prHead(null)).not.toThrow();
  });

  it('says what to do instead, and that the denial is no push refusal', () => {
    const reason = prHead({ head: 'claude/x', body: '' }) as string;
    expect(reason).toContain('git push origin HEAD:<feature|fix|chore>/<n>-<slug>');
    expect(reason).toContain('#160');
    expect(reason).toMatch(/This denial is not a push refusal, so it never justifies a `BRANCH: PUSH REFUSED` line, which is only for a git push the remote itself refused\./);
  });

  it("uses the branch-name job's pattern in ci.yml, character for character", () => {
    const ci = read('.github/workflows/ci.yml');
    const from = ci.indexOf('\n  branch-name:');
    expect(from, 'ci.yml must still carry the branch-name job').toBeGreaterThan(0);
    const next = ci.slice(from + 1).search(/\n  [\w-]+:\n/);
    const job = next < 0 ? ci.slice(from) : ci.slice(from, from + 1 + next);
    const pattern = job.match(/PATTERN='([^']+)'/)?.[1];
    expect(pattern, 'the branch-name job must still declare PATTERN, or this rail compares nothing').toBeDefined();
    expect(BRANCH_PATTERN).toBe(pattern);
    expect(BRANCH_PATTERN, 'ERE and JS must read it alike').not.toMatch(/\[\[:|\\[dwsb]|\(\?/);
    expect(job, 'and CI must still accept the marker only at a line start').toContain("grep -Eq '^BRANCH: PUSH REFUSED'");
  });
});

describe('the hook as settings.json runs it, reading the payload from stdin (#1838)', () => {
  const run = (toolInput: unknown) => execFileSync('node', ['.claude/hooks/github-write-guard.mjs'], {
    cwd: new URL('../../', import.meta.url), input: JSON.stringify({ tool_name: 'mcp__github__create_pull_request', tool_input: toolInput }),
  }).toString();
  it('prints a deny for a claude/ head and nothing for a repo-form one', () => {
    expect(run({ head: 'claude/x', base: 'main', body: 'b' })).toMatch(/"permissionDecision":"deny".*not a push refusal/);
    expect(run({ head: 'feature/1-x', base: 'main', body: 'b' })).toBe('');
  });
});

describe('docs/ROUTINE-PROMPT.md picks up an orphan draft and never leaves one (#1838)', () => {
  const prompt = read('docs/ROUTINE-PROMPT.md');
  const step = (from: string, to: string) => {
    const [a, b] = [prompt.indexOf(from), prompt.indexOf(to)];
    expect(a >= 0 && b > a, `ROUTINE-PROMPT.md must still carry "${from}" before "${to}"`).toBe(true);
    return prompt.slice(a, b);
  };

  it('STEP 2.5 takes a draft a run left with no REVIEW: comment, and never undrafts a block', () => {
    const s25 = step('STEP 2.5', 'STEP 3 —');
    pinSentence(s25, 'An open, non-fork pull request a run left a draft, with no `REVIEW:` comment at all, its newest commit over ~2 hours old and not this run\'s, not labelled `owner-approval` and with no `Replaced by #` comment, is claimed the same way (#459).');
    pinSentence(s25, 'Check its head first: a head that is not a repo-form branch → push the same commits to the right name, open a replacement saying `Replaces #n`, and comment `Replaced by #m` on the old one.');
    pinSentence(s25, 'Then its newest CI run: green and `mergeable_state` not `dirty` → mark it Ready for review with a one-line note (#200).');
    pinSentence(s25, 'Red or `dirty` → fix it as above (`open-pr` §2), push, and ready it once green.');
    pinSentence(s25, 'Still running, or `unknown` → recheck later; never ready it on that.');
    pinSentence(s25, 'A draft carrying `REVIEW: CHANGES REQUESTED` is a block: never undraft it.');
  });

  it('STEP 3: a run waits for its own CI before it ends, and says so if it cannot', () => {
    const s3 = step('STEP 3 —', 'STEP 4 —');
    pinSentence(s3, 'Wait for the newest CI run on its head — an until-loop, never `sleep` — and act on it before the run ends; if the run must stop first, its report and pulse say the PR is a draft waiting on CI, and STEP 2.5\'s orphan rule is the backstop.');
  });
});
