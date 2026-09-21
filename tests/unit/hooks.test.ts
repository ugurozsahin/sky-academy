import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM, run by Claude Code as a PreToolUse hook (.claude/settings.json)
import { check as bashCheck, claudeWrite, forcePush, ownerMarker as bashOwnerMarker, worklogAppend } from '../../.claude/hooks/bash-guard.mjs';
// @ts-expect-error — plain ESM hook helper
import { commands, parse } from '../../.claude/hooks/shell.mjs';
// @ts-expect-error — plain ESM hook helper: the one decision both file and shell guards ask (#346)
import { OWNER_MARKER, protectedKind } from '../../.claude/hooks/paths.mjs';
// @ts-expect-error — plain ESM hook script
import { check as writeCheck, claudeDir } from '../../.claude/hooks/write-guard.mjs';
// @ts-expect-error — plain ESM hook script
import { check as githubCheck, filePath, frozenLabel, heartbeatAppend, ownerMarker, REQUIRED_LINES, requiredLines } from '../../.claude/hooks/github-write-guard.mjs';

/**
 * The layer-0 hooks (#101): `.claude/settings.json` runs one script per tool family before the tool call,
 * and a script denies by printing a PreToolUse `deny`. The rules are pure functions in `.claude/hooks/*.mjs`,
 * so most cases below call them directly; the wiring tests at the end run the real command strings out of
 * `.claude/settings.json`, the way the harness does.
 *
 * Prove one red: break a regex in a hook script, or point a settings.json command at a file that is not there.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));
const settings = JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8'));

type Check<T> = (input: T) => string | null;
const asDeny = (reason: string | null) =>
  reason ? { hookSpecificOutput: { permissionDecision: 'deny', permissionDecisionReason: reason } } : null;
const isDeny = (result: unknown) => (result as any)?.hookSpecificOutput?.permissionDecision === 'deny';
const runHook = (check: Check<string>, command: string) => asDeny(check(command));
const runBodyHook = (check: Check<{ body: string }>, body: string) => asDeny(check({ body }));
// The two mandatory heartbeat lines are ONE rule over one array since #359, so there is one helper — the
// two byte-identical ones this replaced read as though two separately scoped rules were being exercised
// (PR #393 review, note 12). The test titles below still name a line each, because each block argues about
// that line, not about a rule of its own.
const runHeartbeatHook = (input: Record<string, unknown>) => asDeny(requiredLines(input));
const runLabelsHook = (input: Record<string, unknown>) => asDeny(frozenLabel(input));
const runAppendHook = (input: Record<string, unknown>) => asDeny(heartbeatAppend(input));

describe('layer-0 hooks: what each rule denies and allows', () => {
  // #231: the hook's `if:` filter is best-effort (Claude Code runs the hook anyway on `$()`, backticks or
  // `$VAR`), and the old check read any ` -f ` as a force flag — so it denied commands that push nothing.
  it('force-push hook: leaves a command that is not a git push alone, whatever flags it carries (#231)', () => {
    for (const cmd of ['rm -rf dist', 'tail -f build.log', 'gh api repos/o/r/issues -f title=x',
                       'echo "$(date)" && rm -rf "$TMP"', 'git commit -m "push -f later"', 'git log --oneline -f'])
      expect({ cmd, denied: isDeny(runHook(forcePush, cmd)) }).toEqual({ cmd, denied: false });
  });

  it('force-push hook: still finds the push inside a compound command, behind git options, or as a +refspec', () => {
    for (const cmd of ['cd repo && git push --force', 'git -C /tmp/x push -f origin main', 'git push origin +main',
                       'git push --force-if-includes origin main', 'echo $(git push -f)'])
      expect({ cmd, denied: isDeny(runHook(forcePush, cmd)) }).toEqual({ cmd, denied: true });
  });

  // PR #255 review: the first rewrite matched text up to the next `;`, `)` or newline, so a force flag after
  // any of those inside the same push was never seen — a regression from the grep it replaced. The guard now
  // parses the command (`.claude/hooks/shell.mjs`), so these are ordinary arguments of one push.
  it('force-push hook: sees a force flag after a line continuation, a quoted separator or a substitution (PR #255 review)', () => {
    for (const cmd of ['git push origin \\\n  --force main',
                       'git push origin "$(git branch --show-current)" --force',
                       'git push origin "some;branch" --force',
                       '"git" push --force', 'env GIT_TRACE=1 git push -f', 'sh -c "git push --force"',
                       '$GIT push --force origin main', 'if true; then git push -f; fi',
                       'git push origin main;git push -f', '(cd repo && time git push -f)',
                       'git push --force-with-lease=main:abc123 origin main', 'git --git-dir /x/.git push -f'])
      expect({ cmd, denied: isDeny(runHook(forcePush, cmd)) }).toEqual({ cmd, denied: true });
  });

  it('force-push hook: push options that are not a force are allowed', () => {
    for (const cmd of ['git push --follow-tags origin main', 'git push -o ci.skip origin main',
                       'git push origin HEAD:refs/heads/fix/1-x', 'git push --set-upstream origin chore/2-fix-f'])
      expect({ cmd, denied: isDeny(runHook(forcePush, cmd)) }).toEqual({ cmd, denied: false });
  });

  it('force-push hook: text that only looks like a push is not one', () => {
    for (const cmd of ['echo "git push --force"', "grep -rn 'git push -f' docs", 'cat <<EOF\ngit push --force\nEOF',
                       'git log --grep="push --force"', 'git push origin main # never --force'])
      expect({ cmd, denied: isDeny(runHook(forcePush, cmd)) }).toEqual({ cmd, denied: false });
  });

  it('OWNER-marker hook: a quoted or run-time command name still counts as the call it is (PR #255 review)', () => {
    for (const cmd of ['"gh" pr comment 1 --body "OWNER: APPROVED"',
                       'T=gh; $T pr comment 1 --body "OWNER: APPROVED"',
                       'echo "OWNER: APPROVED" | gh pr comment 1 --body-file -',
                       'gh pr comment 1 --body-file - <<EOF\nOWNER: REJECTED - no\nEOF',
                       'gh pr comment 1 --body "$(printf "OWNER: APPROVED")"'])
      expect({ cmd, denied: isDeny(runHook(bashOwnerMarker, cmd)) }).toEqual({ cmd, denied: true });
  });

  it('OWNER-marker hook: a marker in prose, with no gh or curl call on the line, is not a forgery (PR #255 review)', () => {
    for (const cmd of ['git commit -m "docs: mention the OWNER: APPROVED marker, not gh comment"',
                       "grep -rn 'OWNER: APPROVED' docs",
                       'curl https://example.com -d "OWNER: APPROVED"'])
      expect({ cmd, denied: isDeny(runHook(bashOwnerMarker, cmd)) }).toEqual({ cmd, denied: false });
  });

  it('WORKLOG.md Bash hook: only a real append redirect counts, not text that mentions one', () => {
    for (const cmd of ['echo "do not run: echo x >> WORKLOG.md"', 'cat <<EOF > notes.md\necho x >> WORKLOG.md\nEOF'])
      expect({ cmd, denied: isDeny(runHook(worklogAppend, cmd)) }).toEqual({ cmd, denied: false });
    for (const cmd of ['echo x >>WORKLOG.md', 'date 2>&1 >> ./WORKLOG.md', 'sh -c "echo x >> WORKLOG.md"'])
      expect({ cmd, denied: isDeny(runHook(worklogAppend, cmd)) }).toEqual({ cmd, denied: true });
  });

  // PR #255 second review: process substitution was read as a plain redirect, so the command inside it was
  // never seen; `$'…'` quoting left a `$` on the flag; and a closed list of wrapper words missed `timeout`,
  // `nice`, `stdbuf`, `watch`. The scanner now recurses into `<(…)`/`>(…)`, reads `$'…'`, and a tool counts as
  // run wherever its name stands in a statement — there is no wrapper list left to forget an entry of.
  it('force-push hook: sees a push inside a process substitution, behind any wrapper, or ANSI-C quoted (PR #255 second review)', () => {
    for (const cmd of ['diff <(git push --force) file', 'diff < <(git push --force)', 'tee >(git push -f) < log',
                       "git push origin $'--force'", 'git push origin $"--force"',
                       'timeout 30 git push --force', 'nice -n 10 git push --force', 'stdbuf -oL git push --force',
                       'watch git push --force', 'xargs git push -f', 'eval git push --force',
                       'while read x; do git push -f; done < <(ls)'])
      expect({ cmd, denied: isDeny(runHook(forcePush, cmd)) }).toEqual({ cmd, denied: true });
  });

  it('OWNER-marker hook: sees a gh call inside a process substitution or behind any wrapper (PR #255 second review)', () => {
    for (const cmd of ['diff <(gh pr comment 1 --body "OWNER: APPROVED")', 'timeout 30 gh pr comment 1 --body "OWNER: APPROVED"',
                       'eval gh pr comment 1 --body "OWNER: REJECTED"'])
      expect({ cmd, denied: isDeny(runHook(bashOwnerMarker, cmd)) }).toEqual({ cmd, denied: true });
  });

  // The guard leans towards denying: what it cannot finish reading it does not wave through. An unterminated
  // substitution used to lose its last character silently (`--forc`), a wrong answer rather than an error.
  it('a command the scanner cannot finish reading is denied with a reason, never read as "nothing to see"', () => {
    for (const command of ['$(git push --force', 'echo "unclosed', "echo 'unclosed", 'echo `unclosed', '(git push --force'])
      expect({ command, reason: bashCheck({ command }) }).toEqual({ command, reason: expect.stringMatching(/could not read this command \(unterminated/) });
  });

  it('the everyday commit pattern — a heredoc with an apostrophe inside `$(…)` — is read, not refused', () => {
    const commit = 'git commit -m "$(cat <<\'EOF\'\nDon\'t force-push: `git push --force` (is denied\n\nCo-Authored-By: x\nEOF\n)"';
    expect(bashCheck({ command: commit })).toBeNull();
    expect(parse(commit).map((st: any) => st.words[0])).toEqual(['cat', 'git']);
  });

  it('WORKLOG.md Bash hook: a target built from split quotes is still the root file', () => {
    expect(isDeny(runHook(worklogAppend, 'echo x >> "WORK"\'LOG\'.md'))).toBe(true);
    expect(isDeny(runHook(worklogAppend, 'echo x >> docs/worklog/WORKLOG-2026.md'))).toBe(false);
  });

  it('the shell scanner splits statements, strips quotes, and keeps heredoc bodies out of the commands', () => {
    expect(parse('A=1 env -i git -C "my dir" push origin main && echo done | tee out.txt').map((st: any) => st.words))
      .toEqual([['A=1', 'env', '-i', 'git', '-C', 'my dir', 'push', 'origin', 'main'], ['echo', 'done'], ['tee', 'out.txt']]);
    expect(parse('python3 - <<\'PY\'\nimport os; os.system("git push --force")\nPY\nls').map((st: any) => st.words[0])).toEqual(['python3', 'ls']);
    expect(parse('echo a >> "x y.md" 2> err.log')[0].redirects).toEqual([{ op: '>>', target: 'x y.md' }, { op: '>', target: 'err.log' }]);
    expect(parse('a=$(b `c` <(d)) | (e; f)').map((st: any) => st.words[0])).toEqual(['c', 'd', 'b', 'a=$()', 'e', 'f']);
  });

  it('`sh -c` and `eval` hand their script to the scanner, wherever they stand in the statement', () => {
    expect(commands('sudo -u x bash -lc "cd r && make"').map((st: any) => st.words[0])).toEqual(['sudo', 'cd', 'make']);
    expect(commands('time eval "ls; pwd"').map((st: any) => st.words[0])).toEqual(['time', 'ls', 'pwd']);
  });

  it('the Bash guard allows an ordinary command, and a call that carries no command at all', () => {
    expect(bashCheck({ command: 'echo ok' })).toBeNull();
    expect(bashCheck({})).toBeNull();
  });

  // Leaning towards denying is only tolerable if ordinary work gets through. These are the shapes a run really
  // writes — loops, jq filters, arithmetic, `case`, heredocs feeding python, every npm script in package.json.
  it('reads the commands a run really writes without refusing any of them', () => {
    const scripts = Object.values(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts) as string[];
    expect(scripts.length).toBeGreaterThan(4);
    const real = [
      ...scripts,
      'cd /repo && git pull --ff-only 2>&1 | tail -2; git log --oneline --grep="#101" | head -40',
      'for n in 62 61; do gh issue view $n --json updatedAt,body -q \'"#\'$n\' updated \\(.updatedAt)"\'; done',
      'gh pr list --state open --json number,title -q \'.[] | "#\\(.number) \\(.title[0:80])"\'',
      'total=$(git log --oneline | wc -l); echo "n=$((total + 1)) ${total:-0} ${#total}"',
      'case "$1" in a|b) echo ab;; *) echo other;; esac',
      'python3 - <<\'EOF\'\nimport re\ns = "it\'s (unbalanced"\nprint(re.sub(r"[(`\']", "", s))\nEOF',
      'git push -u origin chore/231-hooks-to-scripts 2>&1 | tail -1 && gh pr create --draft --title "x (#231)" --body-file /tmp/b.md',
      'npx vitest run tests/unit/hooks.test.ts 2>&1 | grep -E "×|Tests |^\\s+[-+] " | head -20',
      '[[ -f a.txt && ! -d b ]] || { echo missing >&2; exit 1; }',
    ];
    for (const command of real) expect({ command, reason: bashCheck({ command }) }).toEqual({ command, reason: null });
  });

  it('force-push hook: denies --force, -f, --force-with-lease, and a combined -uf/-fu cluster', () => {
    expect(isDeny(runHook(forcePush, 'git push --force origin main'))).toBe(true);
    expect(isDeny(runHook(forcePush, 'git push -f origin main'))).toBe(true);
    expect(isDeny(runHook(forcePush, 'git push --force-with-lease origin main'))).toBe(true);
    expect(isDeny(runHook(forcePush, 'git push -uf origin main')), '#217 review: a combined short-flag cluster must not bypass this').toBe(true);
    expect(isDeny(runHook(forcePush, 'git push -fu origin main'))).toBe(true);
  });

  it('force-push hook: allows a plain push and a branch name that merely contains the word "force"', () => {
    expect(isDeny(runHook(forcePush, 'git push -u origin feature/1-x'))).toBe(false);
    expect(isDeny(runHook(forcePush, 'git push -u origin fix/1-force-push-test'))).toBe(false);
  });

  it('OWNER-marker hooks: deny a gh/curl command carrying either marker, allow one that does not', () => {
    expect(isDeny(runHook(bashOwnerMarker, "gh pr comment 1 --body 'OWNER: APPROVED'"))).toBe(true);
    expect(isDeny(runHook(bashOwnerMarker, "gh pr comment 1 --body 'OWNER: REJECTED - no'"))).toBe(true);
    expect(isDeny(runHook(bashOwnerMarker, "gh pr comment 1 --body 'REVIEW: CLEARED'"))).toBe(false);
    expect(isDeny(runHook(bashOwnerMarker, "curl -X POST https://api.github.com/repos/x/y/issues/1/comments -d 'body=OWNER: APPROVED'"))).toBe(true);
    expect(isDeny(runHook(bashOwnerMarker, "curl -X POST https://api.github.com/repos/x/y/issues/1/comments -d 'body=REVIEW: CLEARED'"))).toBe(false);
  });

  it('WORKLOG.md Bash hook: denies a bare, absolute-path, and quoted-filename append to the root file', () => {
    expect(isDeny(runHook(worklogAppend, 'echo x >> WORKLOG.md'))).toBe(true);
    expect(isDeny(runHook(worklogAppend, 'echo x >> /home/user/sky-academy/WORKLOG.md')), '#217 review: an absolute path must not bypass this').toBe(true);
    expect(isDeny(runHook(worklogAppend, 'echo x >> "WORKLOG.md"')), '#217 review: quoting the filename must not bypass this').toBe(true);
  });

  it('WORKLOG.md Bash hook: allows an append to the archived docs/worklog/*.md path', () => {
    expect(isDeny(runHook(worklogAppend, 'echo x >> docs/worklog/2026-09.md'))).toBe(false);
  });

  // #101 (MCP-tool gap): unlike the Bash hooks above, EVERY call an MCP write-tool hook sees really does post
  // its `body` to GitHub — there is no `if: Bash(gh *)`-style filter that rules out "this call can't post
  // anyway". A first draft of this hook denied on a bare substring match, which meant it fired on any comment
  // that merely *mentions* a marker in prose — exactly the false positive #217's Bash hook already hit once,
  // rediscovered here live: pipe-testing a body that quoted "OWNER: APPROVED" mid-sentence (this project's own
  // review comments do this constantly, this file included) got denied. Fixed to mirror `isOwnerApproved`/
  // `isOwnerRejected` in scripts/review-gate.mjs exactly: the marker only counts at the START of the body.
  it('MCP-tool marker hook: denies a body that opens with OWNER: APPROVED (plain, or after leading whitespace)', () => {
    expect(isDeny(runBodyHook(ownerMarker, 'OWNER: APPROVED'))).toBe(true);
    expect(isDeny(runBodyHook(ownerMarker, '  \nOWNER: APPROVED\n\nLooks great'))).toBe(true);
  });

  it('MCP-tool marker hook: denies a body that opens with OWNER: REJECTED, matched loosely like review-gate.mjs', () => {
    expect(isDeny(runBodyHook(ownerMarker, 'OWNER: REJECTED - not yet'))).toBe(true);
    expect(isDeny(runBodyHook(ownerMarker, '**OWNER: REJECTED** - not yet ready')), 'bold markdown at the start must still count, same as REVIEW: CHANGES REQUESTED\'s own loose match').toBe(true);
  });

  it('MCP-tool marker hook: allows a body that only mentions a marker in prose, not at the start (#101 false positive)', () => {
    expect(isDeny(runBodyHook(ownerMarker,
      'REVIEW: CLEARED\n\nThis comment discusses the OWNER: APPROVED marker in prose, same as CLAUDE.md does.')),
      'a marker mentioned mid-body is not a verdict — scripts/review-gate.mjs would not treat it as one either').toBe(false);
    expect(isDeny(runBodyHook(ownerMarker, 'Pushed abc123, addressing the review. Ready for re-review.'))).toBe(false);
  });

  // #221 review (session_01Y2hmFMHngKVepeNBXZ4jEs): the strict path used `sed`/`grep` with `^`, which anchors
  // to the start of EVERY LINE of a multi-line string, not the start of the whole body — unlike the real
  // `isOwnerApproved` in scripts/review-gate.mjs, a true whole-string `.startsWith()`. A body whose first line
  // is ordinary prose and whose SECOND line happens to open with "OWNER: APPROVED" (exactly the shape this
  // project's own comments produce constantly, quoting the marker mid-discussion) was denied even though the
  // marker was nowhere near the start. Fixed by switching the strict check to bash's own whole-string glob
  // match (`[[ "$strict" == 'OWNER: APPROVED'* ]]`), which does not split on embedded newlines the way a
  // line-oriented tool does. None of the tests above would have caught this: every case they cover puts the
  // marker on the first non-blank line.
  it('MCP-tool marker hook: allows OWNER: APPROVED-shaped text on a LATER line of an otherwise-unrelated body (#221 review)', () => {
    expect(isDeny(runBodyHook(ownerMarker,
      'Looks good overall.\nOWNER: APPROVED - clearly quoting CLAUDE.md style here\nRest of comment.')),
      'the marker is not at the start of the BODY, only at the start of a later line — review-gate.mjs would not treat this as a verdict').toBe(false);
  });

  // The hook's own asymmetry (APPROVED strict/literal, REJECTED loose/markdown-stripped) means a bold-wrapped
  // "**OWNER: APPROVED**" does NOT start literally with "OWNER: APPROVED" and must be allowed — worth pinning
  // explicitly rather than leaving it as something only the REJECTED sibling test documents.
  it('MCP-tool marker hook: allows a bold-wrapped **OWNER: APPROVED**, per the hook\'s own strict/loose asymmetry', () => {
    expect(isDeny(runBodyHook(ownerMarker, '**OWNER: APPROVED**'))).toBe(false);
  });

  // #221 second review (session_01PX6diT4gEtApGgdssyY1ve): the strict/loose bash checks used `[[:space:]]`/
  // `tr -s '[:space:]'`, POSIX classes that only recognise ASCII whitespace. A body opening with an invisible
  // Unicode character — zero-width space, BOM, NBSP, soft hyphen — sailed through both checks undenied, because
  // stripping "leading whitespace" never touched the invisible character sitting in front of the marker. GitHub
  // renders these invisibly, so a posted comment reads as a real owner verdict to a human while bypassing the
  // one mechanical stop against a forged one. Fixed by moving the strict/loose checks into `node -e` and
  // stripping a small set of zero-width/format characters (ZWSP U+200B, ZWNJ U+200C, ZWJ U+200D, word joiner
  // U+2060, BOM U+FEFF, soft hyphen U+00AD) alongside ordinary `\s`, which in JS already covers NBSP.
  it('MCP-tool marker hook: denies a marker preceded by an invisible Unicode character (#221 second review)', () => {
    for (const [name, ch] of [
      ['ZWSP', '​'], ['BOM', '﻿'], ['NBSP', ' '], ['soft hyphen', '­'],
      ['ZWNJ', '‌'], ['ZWJ', '‍'], ['word joiner', '⁠'],
    ] as const) {
      expect(isDeny(runBodyHook(ownerMarker, ch + 'OWNER: APPROVED')), `${name} before OWNER: APPROVED must still deny`).toBe(true);
      expect(isDeny(runBodyHook(ownerMarker, ch + 'OWNER: REJECTED - no')), `${name} before OWNER: REJECTED must still deny`).toBe(true);
    }
  });


  // #221 third review (session_017EiTZv7sPtAckGDSxSHHDU): the second review's fix only stripped a LEADING
  // run of invisible characters (an anchored strip), so a character placed INSIDE the marker itself was
  // never touched and sailed through denied by neither check. The reviewer also found the enumerated
  // character list itself was incomplete (LRM, RLM, ALM, the Mongolian vowel separator, an RTL override and
  // a tag character all bypassed it too, none in the second review's list of six). Fixed by switching from
  // an anchored strip of an enumerated list to a GLOBAL collapse (every run, anywhere in the body, not just
  // the start) of ordinary `\s` plus the Unicode `Cf` (format) and `Cc` (control) general categories, which
  // covers all six of the second review's characters plus LRM/RLM/ALM/the Mongolian separator/the RTL
  // override/tag characters as one class, rather than growing the enumerated list one discovery at a time.
  // Two characters the reviewer listed sit outside Cf/Cc (Hangul filler U+3164 is category Lo, variation
  // selector U+FE0F is category Mn — both categories too broad to strip wholesale without also eating real
  // Hangul letters or combining accent marks), so those two are still listed explicitly alongside the class.
  it('MCP-tool marker hook: denies an invisible character placed INSIDE the marker, and a wider character set (#221 third review)', () => {
    const marker = 'OWNER: APPROVED';
    const cases: [string, string][] = [
      ['LRM', '\u200E'], ['RLM', '\u200F'], ['ALM', '\u061C'], ['Mongolian vowel separator', '\u180E'],
      ['RTL override', '\u202E'], ['Hangul filler', '\u3164'], ['variation selector', '\uFE0F'],
      ['tag character', '\u{E0001}'],
    ];
    for (const [name, ch] of cases) {
      // leading (the position the second review's fix already covered — re-checked against the wider set)
      expect(isDeny(runBodyHook(ownerMarker, ch + marker)), `${name} leading must deny`).toBe(true);
      // mid-marker: after the colon, and after the space — the position the second review's fix missed
      expect(isDeny(runBodyHook(ownerMarker, 'OWNER:' + ch + 'APPROVED')), `${name} after the colon must deny`).toBe(true);
      expect(isDeny(runBodyHook(ownerMarker, 'OWNER: ' + ch + 'APPROVED')), `${name} after the space must deny`).toBe(true);
    }
    // the same mid-marker placement for one of the second review's own six characters (ZWSP), to pin the
    // new GLOBAL-strip behaviour directly against the regression it fixes, not just the wider character set
    expect(isDeny(runBodyHook(ownerMarker, 'OWNER:\u200BAPPROVED')), 'ZWSP after the colon must deny').toBe(true);
  });

  // #221 fourth round (self-found during post-merge verification, session_011U9Jb5evcfFDNFPyPWyTFd): the third
  // review's fix only tested an invisible character adjacent to the colon or the space already present in
  // "OWNER: APPROVED" — at those two boundary positions, collapsing a run of invisible characters to a single
  // space reproduces the marker exactly, because a space already belonged there. Placed strictly INSIDE a word
  // instead (between two ordinary letters, where no whitespace belongs), the same collapse-to-a-space behaviour
  // inserts a space that was never part of the marker — "APP<ZWSP>ROVED" becomes "APP ROVED", which no longer
  // starts with "APPROVED" — so the check silently fails to deny, while GitHub still renders the zero-width
  // character as nothing, so a human reads the posted comment as a genuine, unbroken "OWNER: APPROVED".
  // Fixed by no longer collapsing invisible/format/control characters into a space at all: they are zero-width,
  // so deleting them outright leaves no visual gap for a human to notice either way, and it stops them from
  // fabricating a word-breaking space that was never there. Ordinary whitespace (`\s`, which also covers a
  // visibly-wide character like NBSP) is still collapsed to a single space afterwards, unchanged from before —
  // a real gap in the text should still break the marker, since a human would see that gap regardless.
  // Proved red first: ran this exact case against the pre-fix (third-review) hook, watched it wrongly allow.
  it('MCP-tool marker hook: denies an invisible character placed strictly inside a word, with no adjacent whitespace (#221 fourth review)', () => {
    const cases: [string, string][] = [
      ['ZWSP', '​'], ['ZWNJ', '‌'], ['ZWJ', '‍'], ['word joiner', '⁠'],
      ['BOM', '﻿'], ['soft hyphen', '­'], ['LRM', '‎'], ['RLM', '‏'],
    ];
    for (const [name, ch] of cases) {
      expect(isDeny(runBodyHook(ownerMarker, `OWNER: APP${ch}ROVED`)), `${name} inside APPROVED must deny`).toBe(true);
      expect(isDeny(runBodyHook(ownerMarker, `OW${ch}NER: APPROVED`)), `${name} inside OWNER must deny`).toBe(true);
    }
    // stacked invisible characters mid-word must not collapse into a single fabricated space either
    expect(isDeny(runBodyHook(ownerMarker, 'OWNER: AP​﻿­PROVED')), 'stacked invisible characters mid-word must deny').toBe(true);
    // a genuinely visible gap (NBSP has real width, unlike the characters above) should still break the
    // marker and correctly NOT deny — this is not a bypass, a human would see the broken word too
    expect(isDeny(runBodyHook(ownerMarker, 'OWNER: AP PROVED'))).toBe(false);
    // every previously-fixed case must still pass unmodified
    expect(isDeny(runBodyHook(ownerMarker, 'OWNER: APPROVED'))).toBe(true);
    expect(isDeny(runBodyHook(ownerMarker, '​OWNER: APPROVED'))).toBe(true);
    expect(isDeny(runBodyHook(ownerMarker, 'OWNER:​APPROVED'))).toBe(true);
    expect(isDeny(runBodyHook(ownerMarker, '**OWNER: APPROVED**'))).toBe(false);
    expect(isDeny(runBodyHook(ownerMarker, 'This discusses OWNER: APPROVED in prose.'))).toBe(false);
    expect(isDeny(runBodyHook(ownerMarker, 'Looks good.\nOWNER: APPROVED - quoting style\nRest.'))).toBe(false);
  });


  // #221 fifth review (session_017EiTZv7sPtAckGDSxSHHDU): the fourth review's fix deleted a hand-picked
  // Cf/Cc-plus-two-stragglers set, which happened to cover every character the first four rounds had tried
  // but was still not exhaustive — Unicode has other invisible-when-unsupported characters outside Cf/Cc
  // entirely (the Mn — nonspacing mark — general category has combining marks and variation selectors that
  // render as nothing when not attached to a base character they modify). Fixed by replacing the ad hoc
  // Cf/Cc-plus-stragglers list with Unicode's own `Default_Ignorable_Code_Point` binary property — the
  // property Unicode maintains specifically for "should be ignored by default when otherwise unsupported",
  // which is exactly this hook's threat model — combined with `\p{Cc}` (kept separately for real control
  // characters, since `Default_Ignorable_Code_Point` and `Cc` are largely disjoint sets and literal newlines
  // still need folding). This covers every character found across all five review rounds as one class,
  // rather than enumerating another one-off exception.
  it('MCP-tool marker hook: denies invisible characters outside the Cf/Cc categories the fourth review covered (#221 fifth review)', () => {
    const cases: [string, string][] = [
      ['Combining Grapheme Joiner', '\u034F'], ['Mongolian Free Variation Selector-1', '\u180B'],
      ['Variation Selector-17', '\u{E0100}'], ['Khmer Vowel Inherent AQ', '\u17B4'],
    ];
    for (const [name, ch] of cases) {
      expect(isDeny(runBodyHook(ownerMarker, `OWNER: APP${ch}ROVED`)), `${name} inside APPROVED must deny`).toBe(true);
      expect(isDeny(runBodyHook(ownerMarker, `${ch}OWNER: APPROVED`)), `${name} leading must deny`).toBe(true);
    }
    // every character from every prior round must still deny, at every position already pinned
    const priorChars: [string, string][] = [
      ['ZWSP', '\u200B'], ['LRM', '\u200E'], ['RLM', '\u200F'], ['ALM', '\u061C'],
      ['Mongolian vowel separator', '\u180E'], ['RTL override', '\u202E'],
      ['Hangul filler', '\u3164'], ['variation selector', '\uFE0F'], ['tag character', '\u{E0001}'],
    ];
    for (const [name, ch] of priorChars) {
      expect(isDeny(runBodyHook(ownerMarker, `OWNER: APP${ch}ROVED`)), `${name} inside APPROVED must still deny`).toBe(true);
    }
    // a genuine visible gap must still correctly NOT deny — not a bypass, a human would see the break
    expect(isDeny(runBodyHook(ownerMarker, 'OWNER: APP\u00A0ROVED')), 'NBSP mid-word must not deny').toBe(false);
    // every previously-fixed case must still pass unmodified
    expect(isDeny(runBodyHook(ownerMarker, 'OWNER: APPROVED'))).toBe(true);
    expect(isDeny(runBodyHook(ownerMarker, '**OWNER: APPROVED**'))).toBe(false);
    expect(isDeny(runBodyHook(ownerMarker, 'This discusses OWNER: APPROVED in prose.'))).toBe(false);
  });


  // #221 sixth review (session_017EiTZv7sPtAckGDSxSHHDU, catching its own round-5 recommendation): swapping
  // the round-4 set (`\p{Cf}` + `\p{Cc}` + two stragglers) for `\p{Default_Ignorable_Code_Point}` + `\p{Cc}`
  // was a REPLACEMENT, not a union, and `Default_Ignorable_Code_Point` is not a superset of `Cf` — some real
  // Cf (format) characters are deliberately excluded from Default_Ignorable in the Unicode Character Database
  // (Unicode's own position is that a conformant renderer should support them, not silently ignore them), but
  // GitHub's comment renderer does not implement their semantics either, so they render as nothing in
  // practice — same bypass shape as every character found so far. Confirmed as an actual regression: these
  // four characters were correctly denied by round 4 (`\p{Cf}` alone caught them) and became silently allowed
  // by round 5's swap. Fixed by taking the UNION of every class found useful so far — `Cf`, `Cc`,
  // `Default_Ignorable_Code_Point`, plus the two stragglers outside all three — rather than trying again to
  // find one clean replacement set. The reviewer's own conclusion, worth recording: an addition to the
  // accumulated set has been sound every round; an attempt to simplify it by swapping for something cleaner
  // has reopened a previously-closed gap both times it was tried (round 3's global-vs-anchored swap did not
  // have this problem, but round 5's category swap did) — so this round only adds, it does not replace.
  it('MCP-tool marker hook: denies real Cf format characters that Default_Ignorable_Code_Point alone dropped (#221 sixth review)', () => {
    const cases: [string, string][] = [
      ['Egyptian Hieroglyph format control', '\u{13430}'], ['Interlinear Annotation Anchor', '\uFFF9'],
      ['Interlinear Annotation Separator', '\uFFFA'], ['Interlinear Annotation Terminator', '\uFFFB'],
    ];
    for (const [name, ch] of cases) {
      expect(isDeny(runBodyHook(ownerMarker, `OWNER: APP${ch}ROVED`)), `${name} inside APPROVED must deny`).toBe(true);
      expect(isDeny(runBodyHook(ownerMarker, `${ch}OWNER: APPROVED`)), `${name} leading must deny`).toBe(true);
    }
    // every character from every prior round (rounds 1-5, 18 characters) must still deny
    const priorChars: [string, string][] = [
      ['ZWSP', '\u200B'], ['LRM', '\u200E'], ['Hangul filler', '\u3164'], ['variation selector', '\uFE0F'],
      ['Combining Grapheme Joiner', '\u034F'], ['Mongolian Free Variation Selector-1', '\u180B'],
      ['Variation Selector-17', '\u{E0100}'], ['Khmer Vowel Inherent AQ', '\u17B4'],
    ];
    for (const [name, ch] of priorChars) {
      expect(isDeny(runBodyHook(ownerMarker, `OWNER: APP${ch}ROVED`)), `${name} inside APPROVED must still deny`).toBe(true);
    }
    // real visible gaps and ordinary allow-cases must still behave exactly as before
    expect(isDeny(runBodyHook(ownerMarker, 'OWNER: APP\u00A0ROVED')), 'NBSP mid-word must not deny').toBe(false);
    expect(isDeny(runBodyHook(ownerMarker, 'OWNER: APPROVED'))).toBe(true);
    expect(isDeny(runBodyHook(ownerMarker, '**OWNER: APPROVED**'))).toBe(false);
    expect(isDeny(runBodyHook(ownerMarker, 'This discusses OWNER: APPROVED in prose.'))).toBe(false);
  });

  it('MCP-tool marker hook: allows a body with no body field at all', () => {
    expect(ownerMarker({})).toBeNull();
  });

  // #101 Layer 4 / #216 §1: the #97 second-item rule ("the run's heartbeat snapshot says whether it took one
  // and, if not, which condition failed") had no check beyond the three files agreeing with each other in
  // prose — nothing stopped an actual heartbeat update from landing without the line #97 asks for. This hook
  // is the one piece of #97 with real behavioural enforcement, which is what #216 §1's bar requires before a
  // triplicated rule's copy may collapse to a pointer (as #191's session-URL requirement already did, #235).
  // Scoped to the routine heartbeat: issue #62 by number, and any create or update carrying its title (#353).
  // No other issue_write call is this rule's business.
  it('#97 second-item hook: denies an update to the routine heartbeat (#62) whose body has no `- second item:` line', () => {
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 62, body: '2026-09-18T00:00Z — did stuff\n- nightly: ok\n- main: green' }))).toBe(true);
  });

  it('#97 second-item hook: allows an update to #62 whose body carries the line, wherever it sits', () => {
    const pick = '\n- query top pick: #298 — taken';
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 62, body: 'stuff\n- second item: no — condition 1 failed\n- main: green' + pick }))).toBe(false);
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 62, body: '- second item: yes, PR #77' + pick }))).toBe(false);
  });

  it('#97 second-item hook: only scopes to issue #62 — a different issue_write is not this rule\'s business', () => {
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 61, body: 'watchdog pulse, no second-item line — never develops' }))).toBe(false);
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 236, body: 'an ordinary issue body with no such line' }))).toBe(false);
  });

  /**
   * #353: every prompt identifies the pulse by TITLE, and `docs/ROUTINE-PROMPT.md` STEP 5 tells a run to
   * create the issue if it is gone — so a recreated heartbeat carries a new number, and a hook that matched
   * only `62` would guard nothing for the rest of the repository's life without a single test going red.
   *
   * The same expression closes the create hole: the one write that establishes a fresh pulse used to be
   * exempt from every body rule, which is this defect seen from the other side.
   *
   * Prove it red: drop `title === HEARTBEAT_TITLE` from `heartbeatWrite`, and the first two go green-to-red.
   */
  it('#353: the heartbeat is matched by title as well as by number, so a recreated one is still guarded', () => {
    const noLines = 'a brand new pulse body, neither line';
    expect(isDeny(runHeartbeatHook({ method: 'create', title: 'routine: heartbeat', body: noLines })),
      'STEP 5 creates the issue when it is missing — that write establishes the pulse and cannot be exempt').toBe(true);
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 4321, title: 'routine: heartbeat', body: noLines })),
      'a recreated heartbeat carries a new number, and the prompts never mention one').toBe(true);
    expect(isDeny(runAppendHook({ method: 'create', title: 'routine: heartbeat', body: '2026-09-20T01:00Z — a\n2026-09-20T02:00Z — b' })),
      'and the same is true of the never-append rule, or the create path launders an append').toBe(true);
  });

  it('#353: an issue_write that names neither the title nor the number is not this rule\'s business', () => {
    expect(isDeny(runHeartbeatHook({ method: 'create', title: 'watchdog: heartbeat', body: 'no lines' }))).toBe(false);
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 61, title: 'watchdog: heartbeat', body: 'no lines' }))).toBe(false);
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 236, body: 'an ordinary issue body' }))).toBe(false);
  });

  /**
   * The title is typed by a run out of prose in a prompt, so it is compared through the module's own `norm()`
   * — case-folded, whitespace-collapsed, invisibles stripped. Raw `===` let `Routine: Heartbeat`, a trailing
   * space that the GitHub UI does not render, and a suffixed title each read as a different issue, which is
   * the same escape #353 is about arriving by a typo instead of a recreate (PR #393 review).
   *
   * Prove it red: compare `title === HEARTBEAT_TITLE` instead.
   */
  it('#353: the heartbeat title is matched as a run would really type it', () => {
    for (const title of ['Routine: Heartbeat', 'ROUTINE: HEARTBEAT', 'routine: heartbeat ', ' routine: heartbeat',
                         'routine:  heartbeat', 'routine: heartbeat (run log)'])
      expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 999, title, body: 'no lines here' })), title).toBe(true);
  });

  /**
   * The gap #353 does NOT close, pinned so it is not mistaken for closed (PR #393 review, B2). An `update`
   * sends a title only when it is changing one, so after a recreate the ordinary body replacement carries
   * neither the title nor #62, and the hook cannot know which issue it is looking at. The half that makes the
   * rule reach the pulse is in the prompt, not here — so the prompt is what this rail reads.
   *
   * Prove it red: drop the "sending its title too" clause from STEP 5.
   */
  it('#353: a title-less update to a recreated heartbeat is NOT caught, and STEP 5 is what closes it', () => {
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 777, body: '2026-09-21T09:00Z — IN PROGRESS: x' })),
      'if this ever denies, the hook learnt the number and this rail should become the opposite claim').toBe(false);
    const step5 = readFileSync(join(root, 'docs/ROUTINE-PROMPT.md'), 'utf8')
      .split('\n').find((l) => l.includes('fixed-size snapshot')) ?? '';
    expect(step5, 'STEP 5 must still be the line that replaces the body, or this rail reads the wrong one')
      .toContain('routine: heartbeat');
    expect(step5, 'STEP 5 must tell the run to send the title, or nothing closes the gap above')
      .toMatch(/title/i);
    expect(step5, 'and say why, or it reads as ceremony and gets dropped').toContain('#353');
  });

  /**
   * #359: `body` is optional on `issue_write`, so a labels-only, title-only or state-only update to #62 is a
   * legitimate call carrying no body — and denying it for a "missing" line names a body that was never sent,
   * whose obvious remedy is to ADD one, overwriting the pulse the rule exists to protect. A non-string body is
   * the same defect from the other side: `.match` throws, a PreToolUse hook that throws exits non-zero with
   * empty stdout, and that is a non-blocking hook error — the write proceeds.
   *
   * Prove it red: drop the `typeof input.body === 'string'` guard from `heartbeatBody`.
   */
  it('#359: a heartbeat write carrying no body text is not a missing line, and never throws', () => {
    for (const input of [{ method: 'update', issue_number: 62, labels: ['watchdog'] },
                         { method: 'update', issue_number: 62, state: 'open' },
                         { method: 'update', issue_number: 62, body: null },
                         { method: 'update', issue_number: 62, body: 42 }]) {
      expect(() => requiredLines(input), `threw on ${JSON.stringify(input)} — the write then proceeds`).not.toThrow();
      expect(() => heartbeatAppend(input), `threw on ${JSON.stringify(input)}`).not.toThrow();
      expect(isDeny(runHeartbeatHook(input)), JSON.stringify(input)).toBe(false);
      expect(isDeny(runAppendHook(input)), JSON.stringify(input)).toBe(false);
    }
  });

  // The sibling line is supplied, or both are missing and this passes on the sibling's absence rather than on
  // the thing it is named for — the shape of vacuity the #341 review found twice in this file.
  it('#97 second-item hook: a mention of "second item" in prose, not as its own `- second item:` line, still denies', () => {
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 62,
      body: 'we discussed the second item rule casually but never wrote the line\n- query top pick: #298 — taken' }))).toBe(true);
  });

  // #338: the same shape as the second-item rule above, and for the same reason. STEP 3's query is meant to
  // be mechanical, so a run that develops a different issue has to say which one the query named and which of
  // the three documented ways past the order it used — a run developed #20 while the query named #18, and
  // nothing obliged it to record the departure, so only a watchdog reconstructing the query found it. What
  // this cannot check is the same gap: that the line is there, never that the issue named is the right one.
  it('#338 query-top-pick hook: denies an update to #62 whose body has no `- query top pick:` line', () => {
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 62, body: '2026-09-20T00:00Z — did stuff\n- second item: no\n- main: green' }))).toBe(true);
  });

  it('#338 query-top-pick hook: allows a body carrying the line, taken or departed from', () => {
    const second = '\n- second item: no — condition 2 failed';
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 62, body: 'stuff\n- query top pick: #298 (P1) — taken\n- main: green' + second }))).toBe(false);
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 62, body: '- query top pick: #298 — not taken; watchdog issue #338 came first' + second }))).toBe(false);
  });

  it('#338 query-top-pick hook: scopes to the heartbeat, like its sibling', () => {
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 61, body: 'the watchdog pulse never develops' }))).toBe(false);
    expect(isDeny(runHeartbeatHook({ body: 'an add_issue_comment carries no method — a comment on #62 is not the pulse' }))).toBe(false);
  });

  it('#338 query-top-pick hook: prose about the query, not the line itself, still denies', () => {
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 62,
      body: 'the query top pick was #298 but I never wrote it as a line\n- second item: no' }))).toBe(true);
  });

  // Round-1 review of PR #341: the deny message is the whole interface a blocked run sees, and this rule was
  // written by copying its sibling — so the likeliest real mutation is that it inherits the sibling's text. A
  // run obeying the wrong message would add a second `- second item:` line and be denied forever.
  it('#338 query-top-pick hook: says which line is missing, in its own words', () => {
    const reason = requiredLines({ method: 'update', issue_number: 62,
      body: 'no pick line here\n- second item: no' }) as string;
    expect(reason, 'it must name its own line').toContain('- query top pick: ');
    expect(reason, 'and not send the run to add the sibling instead').not.toContain('- second item: ');
    expect(reason, 'and say what the line is for').toMatch(/STEP 3's query|documented ways past/);
  });

  /**
   * #359: `check` is a `??` chain, so it used to report one missing line per call — and since #338 made the
   * second line mandatory, a body missing both is the ordinary case, not an edge one. The run is denied, fixes
   * one line, and is denied again: two round trips at STEP 1, and at STEP 5 a denied write leaves the pulse
   * still reading `IN PROGRESS`, which is exactly what the watchdog reports as a dead run.
   *
   * Prove it red: report only `missing[0]`, or go back to two rules chained with `??`.
   */
  it('#359: one deny names every missing line, so a run is not denied twice for the same body', () => {
    const reason = requiredLines({ method: 'update', issue_number: 62, body: '2026-09-20T09:00Z — IN PROGRESS: x' }) as string;
    for (const { key } of REQUIRED_LINES as { key: string }[])
      expect(reason, `a body missing every line must name ${key}, or the next write is denied for it`).toContain(`${key} `);
  });

  // #359: the rules are one array now, and the deny is built from it. A line added to `REQUIRED_LINES` with no
  // reason text, or a key that is not the line a run writes, would make a deny a run cannot act on.
  it('#359: every required line declares the key a run writes and why it is there', () => {
    expect((REQUIRED_LINES as unknown[]).length, 'two lines today; governance.md anticipates a third').toBeGreaterThanOrEqual(2);
    for (const { key, why } of REQUIRED_LINES as { key: string; why: string }[]) {
      expect(key, 'the key is the literal line prefix a run writes').toMatch(/^- [a-z][a-z ]*:$/);
      expect(why.length, `${key} has no reason text, so its deny says nothing`).toBeGreaterThan(20);
    }
  });

  // The trailing space in the pattern is load-bearing: without it a bare heading with no value passes, and
  // the field means nothing in exactly the run that most needs a record (PR #341 review).
  it('#338 query-top-pick hook: the line must carry a value, not just the heading', () => {
    // Round 2: the first version of this pin read `- query top pick: ` and stopped, so the empty-valued line
    // — one keystroke from the shape the test is named for, and the shape a half-written stamp produces —
    // was accepted. `: *\S` is what makes the claim true. The same hole was in `- second item:`, below.
    const second = '\n- second item: no';
    for (const body of ['x\n- query top pick:' + second, 'x\n- query top pick: ' + second, 'x\n- query top pick:   ' + second,
                        'x\n- query top pick: \n- second item: no', 'x\n- query top pick:\n- second item: no'])
      expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 62, body })), body).toBe(true);
    // STEP 4's defined value for a run that found nothing eligible — the case the heading-only form came from.
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 62, body: 'x\n- query top pick: none eligible' + second }))).toBe(false);
  });

  // Round 2: the line anchor was unpinned — dropping `(^|\n)` left every case green, because the only prose
  // case had no colon in it. A record is a line a reader can find, not a phrase buried in a sentence.
  it('#338/#97: the line must start a line, not sit mid-sentence', () => {
    // Each case supplies the OTHER line in its proper form, so the deny can only be about the anchor under
    // test — without that, the missing sibling denies and the assertion passes whatever the anchor does,
    // which is how the first version of this rail was vacuous.
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 62,
      body: 'we recorded - query top pick: #298 inline\n- second item: no' }))).toBe(true);
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 62,
      body: 'note that - second item: no applies\n- query top pick: #298 — taken' }))).toBe(true);
  });

  // The same two holes were in `- second item:` from the start (#239). Closed here rather than deferred:
  // it is one character in the same expression, and the reviewer offered either.
  it('#97 second-item hook: the line must carry a value and start a line', () => {
    const withPick = '\n- query top pick: #298 — taken';
    for (const body of ['x\n- second item:' + withPick, 'x\n- second item: ' + withPick,
                        'x we took - second item: no' + withPick])
      expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 62, body })), body).toBe(true);
    expect(isDeny(runHeartbeatHook({ method: 'update', issue_number: 62, body: 'x\n- second item: no' + withPick }))).toBe(false);
  });

  /**
   * The blocking finding of PR #341's round-1 review: a second mandatory line was added to the #62 hook and
   * STEP 1's stamp sentence was not extended, so the first heartbeat write of every run was refused and the
   * #314 pulse never landed — leaving a stopped run and a run that was never launched indistinguishable to
   * the watchdog, which is the one thing the stamp exists to tell apart.
   *
   * Fed from `docs/ROUTINE-PROMPT.md` itself rather than from a body written here, so the rail fails when
   * either side drifts: the prompt that prescribes the stamp, or the hook that judges it.
   */
  it('the stamp docs/ROUTINE-PROMPT.md prescribes is one the #62 hook accepts (#341 review)', () => {
    const prompt = readFileSync(join(root, 'docs/ROUTINE-PROMPT.md'), 'utf8');
    const sentence = prompt.split('\n').find((l) => l.includes('stamp the pulse')) ?? '';
    expect(sentence, 'STEP 1 must still prescribe a stamp, or this rail reads nothing').toContain('IN PROGRESS');
    // Every `- key: value` the stamp sentence names, reassembled into the body a run would actually send.
    const lines = [...sentence.matchAll(/`(- [a-z][a-z ]*: [^`]+)`/g)].map((m) => m[1]);
    // Counted against the hook's own list rather than `> 1` (#359): a third required line added to
    // `REQUIRED_LINES` and not to the stamp is the identical defect, and `> 1` would not have seen it.
    for (const { key } of REQUIRED_LINES as { key: string }[])
      expect(lines.join('\n'), `STEP 1's stamp does not name ${key}, which the hook requires`).toContain(key);
    const body = `2026-09-20T09:00Z — IN PROGRESS: reviewing #341\n${lines.join('\n')}`;
    expect(githubCheck({ method: 'update', issue_number: 62, body }),
      `STEP 1's stamp is refused by the hook, so the pulse never lands: ${body}`).toBeNull();
  });

  // Both mandatory lines are reachable through the exported `check`, in either order of omission — a rule
  // that is written but not wired into `check` denies nothing, and `.claude/settings.json` calls only `check`.
  it('#338/#97: `check` denies a heartbeat body missing either line, and allows one carrying both', () => {
    const withBoth = '2026-09-20T00:00Z — x\n- query top pick: #298 — taken\n- second item: no — condition 2 failed';
    expect(isDeny(asDeny(githubCheck({ method: 'update', issue_number: 62, body: withBoth })))).toBe(false);
    for (const missing of ['- query top pick: #298 — taken', '- second item: no — condition 2 failed'])
      expect(isDeny(asDeny(githubCheck({ method: 'update', issue_number: 62, body: withBoth.replace(missing + '\n', '').replace('\n' + missing, '') })))).toBe(true);
  });

  // #101 Layer 4 / #216 §1: the freeze-history rule's one enforceable piece — see the structural test above
  // ("a hook denies applying the `frozen` label") for why this, and not the broader lift narrative, is what
  // collapses. `.tool_input.labels` is a real array on `issue_write` (create and update alike), so this reads
  // it directly rather than grepping a command string, which is also what keeps a body merely discussing the
  // retired label (this file included) from tripping it.
  /**
   * PR #393 round 1, B5b — the third route, and the only one that lands on the remote.
   * `mcp__github__create_or_update_file`, `push_files` and `delete_file` take a repository path and commit it
   * straight to a branch, so a run refused by the Write, Edit and Bash guards could have pushed the identical
   * edit to `main` with nothing in its way. The path is repo-relative, which is exactly what `protectedKind()`
   * reads, so this asks the one shared question rather than a fourth spelling of it.
   *
   * Prove it red: drop `filePath` from `check`, or drop the three tools from the settings.json matcher.
   */
  it('#346: an MCP file write to .claude/ is refused, and an ordinary one is not (#393 review B5b)', () => {
    const clone = mkdtempSync(join(tmpdir(), 'sna-mcp-'));
    for (const input of [{ path: '.claude/rules/governance.md' }, { path: '.owner-machine' },
                         { files: [{ path: 'src/main.ts' }, { path: '.claude/settings.json' }] }])
      expect(isDeny(asDeny(githubCheck(input, clone))), JSON.stringify(input)).toBe(true);
    for (const input of [{ path: 'src/main.ts' }, { path: 'docs/ROUTINE-PROMPT.md' },
                         { files: [{ path: 'src/main.ts' }, { path: 'tests/unit/hooks.test.ts' }] },
                         { body: 'an ordinary comment that merely mentions .claude/rules/governance.md' }])
      expect(isDeny(asDeny(githubCheck(input, clone))), JSON.stringify(input)).toBe(false);
    expect(filePath({ path: '.claude/settings.json' }, clone), 'and it says where the change belongs instead')
      .toContain('owner-session');
  });

  // #393 review, note 7: every other guard entry point turns a throw into a deny and says why; this one had
  // no `try` at all, and `check(null)` threw — unreachable only because `io.mjs` happens to do `?? {}`.
  it('github-write-guard denies rather than allows when a rule throws (#393 review note 7)', () => {
    const boom = { method: 'update', issue_number: 62 } as Record<string, unknown>;
    Object.defineProperty(boom, 'body', { get() { throw new Error('unreadable'); } });
    let reason: string | null = 'not called';
    expect(() => { reason = githubCheck(boom); }, 'a hook that throws exits 1 and the write proceeds').not.toThrow();
    expect(reason, 'and swallowing it silently is the same failure wearing a try/catch').toMatch(/refused/);
    expect(() => githubCheck(null), 'io.mjs doing `?? {}` is not this rule\'s guarantee').not.toThrow();
  });

  // #393 review, note 8: the keys are interpolated into `new RegExp`, so a future key carrying a
  // metacharacter would rewrite the rule that decides whether the pulse is refused. Escaped at the boundary
  // now, and the array frozen, rather than relying on a shape assertion that lives in this file.
  it('a required line carrying a regex metacharacter is matched literally (#393 review note 8)', () => {
    expect(Object.isFrozen(REQUIRED_LINES), 'a rule a test can mutate is not a rule').toBe(true);
    expect(() => { (REQUIRED_LINES as { key: string }[])[0].key = '- x.*:'; }).toThrow();
  });

  /**
   * #327 gave the reviewer routine a pulse of its own, and the two pulses share exactly one rule. Replace
   * never append is the same discipline for any pulse (#98), so `heartbeatAppend` covers both. The two
   * mandatory lines are not: `- second item:` is a developer concept (#97) and `- query top pick:` names a
   * query a reviewer never runs, so demanding them of a reviewer pulse would refuse every write it makes.
   *
   * Matching on title is what makes that separation free rather than a second copy of the rule.
   *
   * Prove it red: drop `REVIEWER_HEARTBEAT_TITLE` from the list `pulseWrite` walks, or route the reviewer
   * pulse through `heartbeatWrite`.
   */
  it('#327: the reviewer pulse inherits replace-never-append, and nothing else', () => {
    const appended = '2026-09-21T01:00Z \u2014 reviewed #393\n2026-09-21T02:00Z \u2014 reviewed #394';
    for (const title of ['reviewer: heartbeat', 'Reviewer: Heartbeat', 'reviewer: heartbeat '])
      expect(isDeny(asDeny(githubCheck({ method: 'update', issue_number: 4242, title, body: appended }))), title).toBe(true);
    expect(isDeny(asDeny(githubCheck({ method: 'create', title: 'reviewer: heartbeat', body: appended }))),
      'the create that establishes the pulse is not exempt either').toBe(true);
    // …and the developer-only lines are not demanded of it, or every reviewer write is refused.
    for (const body of ['2026-09-21T01:00Z \u2014 IN PROGRESS: reviewing #393',
                        '2026-09-21T01:00Z \u2014 nothing waiting',
                        '2026-09-21T01:00Z \u2014 stopped: limit'])
      expect(isDeny(asDeny(githubCheck({ method: 'update', issue_number: 4242, title: 'reviewer: heartbeat', body }))), body).toBe(false);
    // The developer pulse keeps both obligations, so the separation is real rather than a blanket loosening.
    expect(isDeny(asDeny(githubCheck({ method: 'update', issue_number: 62, body: '2026-09-21T01:00Z \u2014 IN PROGRESS: x' }))),
      'the developer pulse still carries its two lines').toBe(true);
  });

  it('frozen-label hook: denies an issue_write update whose labels include `frozen`', () => {
    expect(isDeny(runLabelsHook({ method: 'update', issue_number: 5, labels: ['frozen', 'priority:P1'] }))).toBe(true);
  });

  it('frozen-label hook: denies an issue_write create whose labels include `frozen`', () => {
    expect(isDeny(runLabelsHook({ method: 'create', labels: ['frozen'] }))).toBe(true);
  });

  it('frozen-label hook: allows ordinary labels, and a body that only discusses the retired label in prose', () => {
    expect(isDeny(runLabelsHook({ method: 'update', issue_number: 5, labels: ['priority:P1', 'routine-ok'] }))).toBe(false);
    expect(isDeny(runLabelsHook({ body: 'Label `frozen` is retired — see governance.md.' }))).toBe(false);
  });

  it('frozen-label hook: allows a call with no labels field at all', () => {
    expect(frozenLabel({})).toBeNull();
  });

  // #98/#101 Layer 4 / #216 §1: records-have-readers' "overwritten every run, never appended" piece — see the
  // structural test above for why this, and not the rule's other records, is what collapses. The hook reads
  // the new body only (it never sees the old one), so it denies on the structural signature of an append — two
  // or more of the heartbeat's own `YYYY-MM-DDTHH:MMZ — ` summary lines — rather than diffing against history.
  it('heartbeat-append hook: denies an update to #62 whose body carries two heartbeat-shaped timestamp lines', () => {
    expect(isDeny(runAppendHook({
      method: 'update',
      issue_number: 62,
      body: '2026-09-16T22:41Z — merged #101\n\n- nightly: ok\n\n2026-09-18T13:36Z — reviewed and merged PR #242\n- second item: no',
    }))).toBe(true);
  });

  it('heartbeat-append hook: allows an ordinary single-summary replace, including one that mentions other timestamps mid-line', () => {
    expect(isDeny(runAppendHook({
      method: 'update',
      issue_number: 62,
      body: '2026-09-18T13:36Z — reviewed and merged PR #242\n- watchdog pulse: ok — issue #61 body timestamped 2026-09-18T11:09:35Z (~2h27m old)\n- second item: no',
    }))).toBe(false);
  });

  it('heartbeat-append hook: allows a body with no heartbeat-shaped timestamp line at all (a different failure mode, not this rule\'s business)', () => {
    expect(isDeny(runAppendHook({ method: 'update', issue_number: 62, body: 'no timestamp here, just prose' }))).toBe(false);
  });

  it('heartbeat-append hook: only scopes to the heartbeat — by number, or by the title a create carries', () => {
    const twoTimestamps = '2026-09-18T11:00Z — a\n2026-09-18T13:36Z — b';
    expect(isDeny(runAppendHook({ method: 'update', issue_number: 61, body: twoTimestamps }))).toBe(false);
    // No `method` at all is one of the comment tools this hook also matches, never an issue_write — gating an
    // ordinary comment on #62 behind the pulse's body rules would be the rule reaching past its own subject.
    expect(isDeny(runAppendHook({ issue_number: 62, body: twoTimestamps }))).toBe(false);
    expect(isDeny(runAppendHook({ method: 'create', title: 'routine: heartbeat', body: twoTimestamps }))).toBe(true);
  });

  /**
   * #359: five rules were exported and composed in `check()`, which is the only thing `.claude/settings.json`
   * calls — and `heartbeatAppend` could be deleted from that chain with all 1373 unit tests green, on `main`
   * and on PR #341's head alike. The rail that existed enumerated two rules by name, so it did not cover the
   * third, and enumeration would not have covered the next one either.
   *
   * The first version of this rail asserted `String(check).toContain(name)` — a substring test on source
   * text, which the review defeated in one line: a rule exported and mentioned only in a **comment** inside
   * `check` passed while denying nothing, 87/87 green. So it is behavioural now. Each rule gets an input that
   * only it denies, and the assertion is that `check` returns *that rule's* reason — unwire it and `check`
   * returns null or someone else's sentence.
   *
   * Enumerating the inputs is not the enumeration #359 objects to: the coverage assertion below makes a new
   * export a **red build** until its author supplies a denying input, and supplying one is what proves the
   * wiring. The module list is read from `.claude/settings.json`, so a fourth guard cannot arrive unrailed.
   *
   * Prove it red: delete ` ?? heartbeatAppend(input)` from `check`; or call a rule only from a comment.
   */
  it('every rule a guard module exports is reached by its check(), and denies through it (#359)', async () => {
    const scripts = [...new Set((settings.hooks.PreToolUse as any[]).flatMap((e) => e.hooks)
      .map((h) => (h.command as string).match(/\.claude\/hooks\/([\w-]+)\.mjs/)?.[1])
      .filter((n): n is string => Boolean(n)))];
    expect(scripts.length, 'the module list must come from settings.json, or a fourth guard arrives unrailed')
      .toBeGreaterThanOrEqual(3);
    // A marker-free root, because every `.claude/` rule allows everything when the owner is at the keyboard.
    const clone = mkdtempSync(join(tmpdir(), 'sna-wiring-'));
    const force = 'git push --force origin main', forge = "gh pr comment 1 --body 'OWNER: APPROVED'";
    const shellEdit = "sed -i '' s/a/b/ .claude/settings.json", worklog = 'echo x >> WORKLOG.md';
    const noLines = { method: 'update', issue_number: 62, body: 'no lines' };
    const appended = { method: 'update', issue_number: 62,
      body: '2026-01-01T00:00Z — a\n2026-01-02T00:00Z — b\n- second item: no\n- query top pick: #1 — taken' };
    // Keyed by module, because `ownerMarker` exists in two of them and takes a different shape in each.
    // `rule` is what the exported function is called with; `input` is what `check` is called with.
    const wired: Record<string, { rule: unknown[]; input: unknown; reason: RegExp }> = {
      'bash-guard.forcePush': { rule: [force], input: { command: force }, reason: /Force-push denied/ },
      'bash-guard.ownerMarker': { rule: [forge], input: { command: forge }, reason: /only the human owner writes these/ },
      'bash-guard.worklogAppend': { rule: [worklog], input: { command: worklog }, reason: /WORKLOG\.md at the repo root is retired/ },
      'bash-guard.claudeWrite': { rule: [shellEdit, clone], input: { command: shellEdit }, reason: /protected path/ },
      'write-guard.claudeDir': { rule: [join(clone, '.claude/settings.json'), clone], input: { file_path: '.claude/settings.json' }, reason: /protected path/ },
      'github-write-guard.ownerMarker': { rule: [{ body: 'OWNER: APPROVED' }], input: { body: 'OWNER: APPROVED' }, reason: /only the human owner writes these/ },
      'github-write-guard.requiredLines': { rule: [noLines], input: noLines, reason: /must carry/ },
      'github-write-guard.filePath': { rule: [{ path: '.claude/rules/governance.md' }, clone], input: { path: '.claude/rules/governance.md' }, reason: /not a way round/ },
      'github-write-guard.frozenLabel': { rule: [{ labels: ['frozen'] }], input: { labels: ['frozen'] }, reason: /frozen label is retired/ },
      'github-write-guard.heartbeatAppend': { rule: [appended], input: appended, reason: /never appended to/ },
    };
    for (const name of scripts) {
      const mod = await import(`../../.claude/hooks/${name}.mjs`) as Record<string, any>;
      const rules = Object.keys(mod).filter((k) => k !== 'check' && typeof mod[k] === 'function');
      expect(rules.length, `${name}.mjs exports no rules at all — this rail then checks nothing`).toBeGreaterThanOrEqual(1);
      for (const rule of rules) {
        const entry = wired[`${name}.${rule}`];
        expect(entry, `${name}.mjs exports ${rule} and this rail has no denying input for it — add one, `
          + 'which is how the wiring gets proved rather than assumed').toBeDefined();
        expect(mod[rule](...entry!.rule), `${name}.${rule} does not deny its own input, so the next line proves nothing`)
          .toMatch(entry!.reason);
        expect(mod.check(entry!.input, clone),
          `${name}.mjs exports ${rule} but check() never reaches it, and settings.json calls only check`)
          .toMatch(entry!.reason);
      }
    }
  });
});

describe('layer-0 hooks: the root WORKLOG.md write guard', () => {
  it('denies the root file by relative or absolute path, and allows docs/worklog/ and a nested WORKLOG.md', () => {
    expect(writeCheck({ file_path: 'WORKLOG.md' }, root)).toMatch(/retired/);
    expect(writeCheck({ file_path: join(root, 'WORKLOG.md') }, root)).toMatch(/retired/);
    expect(writeCheck({ file_path: join(root, 'docs/worklog/2026-09.md') }, root)).toBeNull();
    expect(writeCheck({ file_path: join(root, 'docs/WORKLOG.md') }, root)).toBeNull();
    expect(writeCheck({}, root)).toBeNull();
  });
});

/**
 * #342: `.claude/` is a Claude Code protected path, so an unattended run meets a permission prompt nobody is
 * there to answer — PR #294 stalled 7h33m and PR #318 overnight, both on `.claude/rules/governance.md`. No
 * routine setting permits the write (#340, `docs/decisions/006-a-routine-never-writes-under-claude.md`), so
 * the hook refuses it first: `PreToolUse` runs before the permission system, and the run gets a denial in
 * milliseconds instead of a prompt that outlives the night.
 *
 * Both roots below are temporary directories, never this checkout: the owner's copy carries the marker and CI
 * does not, so a rail anchored on the real root would say opposite things in the two places.
 *
 * Prove one red: drop the `existsSync` check, or compare paths with `startsWith` instead of `relative`.
 */
describe('layer-0 hooks: an unattended run cannot write under .claude/ (#342)', () => {
  const noMarker = mkdtempSync(join(tmpdir(), 'sna-clone-'));
  const owner = mkdtempSync(join(tmpdir(), 'sna-owner-'));
  writeFileSync(join(owner, OWNER_MARKER), 'owner\n');
  const deniedIn = (dir: string) => (p: string) => writeCheck({ file_path: p }, dir);

  it('denies every write under .claude/, by relative path and by absolute', () => {
    for (const p of ['.claude/rules/governance.md', '.claude/settings.json', '.claude/skills/open-pr/SKILL.md',
                     '.claude/hooks/write-guard.mjs', '.claude/agents/pr-test-analyzer.md'])
      for (const given of [p, join(noMarker, p)])
        expect(deniedIn(noMarker)(given), given).toMatch(/protected path/);
  });

  // Round-1 review of PR #344: `..` was tested as a prefix, so a first segment merely *starting* with two
  // dots read as "climbed out of the directory" and sailed through, though it lands squarely inside.
  it('a first segment that only begins with dots is still inside .claude/ (PR #344 review)', () => {
    for (const p of ['.claude/..x', '.claude/..hidden/notes.md', '.claude/.../x'])
      expect(deniedIn(noMarker)(p), p).toMatch(/protected path/);
  });

  it('names the file the run actually tried to write, not a fixed example', () => {
    // A path that shares nothing with the rule document named in the message's tail, or the assertion passes
    // on the tail alone — which is how the first version of this rail was vacuous (PR #344 review).
    expect(deniedIn(noMarker)('.claude/skills/review-pr/SKILL.md')).toContain('.claude/skills/review-pr/SKILL.md');
    expect(deniedIn(noMarker)('.claude/agents/type-design-analyzer.md')).toContain('type-design-analyzer');
  });

  it('says what to do instead, and does not name a route to the write it just refused', () => {
    const reason = deniedIn(noMarker)('.claude/rules/governance.md') ?? '';
    expect(reason).toContain('owner-session');
    expect(reason).toContain('.claude/rules/governance.md');
    expect(reason, 'a run that retries has understood nothing').toMatch(/do not retry/i);
    expect(reason, 'the one message a stuck run reads must not end by naming the workaround')
      .not.toMatch(/create .*\.owner-machine|\.owner-machine at the repo root/i);
  });

  // The marker is at the repo root, so the .claude/ sentence would state a false fact about it; and a run
  // just refused a .claude/ write must not read this message as a way to get it (PR #344 review).
  it('refuses the marker for its own reason, which is true of the marker', () => {
    const reason = deniedIn(noMarker)(OWNER_MARKER) ?? '';
    expect(reason, 'the marker is not under .claude/').not.toMatch(/is under \.claude\//);
    expect(reason).toMatch(/owner's-machine marker/);
    expect(reason, 'and it must not read as permission to create it').toMatch(/nothing a run does may bring it/);
    expect(deniedIn(noMarker)(join(noMarker, OWNER_MARKER))).toMatch(/owner's-machine marker/);
  });

  it('allows everything under .claude/ in a checkout that carries the marker — the owner is at the keyboard', () => {
    for (const p of ['.claude/rules/governance.md', '.claude/settings.json', OWNER_MARKER])
      expect(deniedIn(owner)(p), p).toBeNull();
  });

  it('judges a path by where it lands, not by how it is spelled', () => {
    for (const p of ['.claudex/notes.md', 'src/main.ts', 'docs/ROUTINE-PROMPT.md', 'claude/x.md',
                     '.claude/../src/main.ts', 'my.claude/x.md'])
      expect(deniedIn(noMarker)(p), p).toBeNull();
    expect(writeCheck({}, noMarker)).toBeNull();
    expect(writeCheck({ file_path: 42 as unknown as string }, noMarker)).toBeNull();
  });

  it('is wired into check(), alongside the WORKLOG.md rule it did not displace', () => {
    expect(deniedIn(noMarker)('.claude/settings.json')).toMatch(/protected path/);
    expect(deniedIn(noMarker)('WORKLOG.md')).toMatch(/retired/);
    expect(deniedIn(noMarker)('src/main.ts')).toBeNull();
  });

  // A protected-path rule that fails open on its own bug is worse than none: `check()` now does filesystem
  // I/O where it used to compare strings, so it has throw surface the rule it replaced did not (PR #344
  // review). `io.mjs` lets unreadable *input* through on purpose; that is the tool's payload, not this rule.
  it('denies rather than allows when the rule itself throws', () => {
    const boom = {} as { file_path: string };
    Object.defineProperty(boom, 'file_path', { get() { throw new Error('unreadable'); } });
    let reason: string | null = 'not called';
    expect(() => { reason = writeCheck(boom, noMarker); }, 'a hook that throws exits 1 and the write proceeds')
      .not.toThrow();
    expect(reason, 'and swallowing the throw silently is the same failure wearing a try/catch')
      .toMatch(/refused/);
  });
});

/**
 * #346: the `Write`/`Edit` guard above closed the route both measured stalls actually took, and left the shell
 * open beside it. `sed -i '' 's/x/y/' .claude/rules/governance.md` is the same edit by another tool, and
 * `touch .owner-machine` is one command after which every later write in that checkout is allowed, permanently
 * and silently. Found independently by `pr-test-analyzer` and `silent-failure-hunter` reviewing PR #344.
 *
 * What counts as protected is `claudeDir()`'s decision, called by both guards, so the cases below are about
 * one thing only: does the Bash guard find the write target the command names?
 *
 * Roots are temporary directories, never this checkout — the owner's copy carries the marker and CI does not,
 * so a rail anchored on the real root would say opposite things in the two places.
 *
 * Prove one red: drop `tee`, `touch`, `rm`, `mkdir` or `truncate` from `WRITES_EVERY_OPERAND`. (Not
 * `rmdir`/`unlink`/`shred`, which are there by family and have no case of their own; and not canonicalisation,
 * which is only red on macOS, where `$TMPDIR` is a symlink and these roots are not — PR #393 review, note 9.)
 */
describe('layer-0 hooks: an unattended run cannot write under .claude/ from the shell either (#346)', () => {
  const noMarker = mkdtempSync(join(tmpdir(), 'sna-sh-clone-'));
  const owner = mkdtempSync(join(tmpdir(), 'sna-sh-owner-'));
  writeFileSync(join(owner, OWNER_MARKER), 'owner\n');
  const denied = (cmd: string) => claudeWrite(cmd, noMarker) as string | null;

  it('denies the routes a run would really take to a file under .claude/', () => {
    for (const cmd of [
      "sed -i '' 's/x/y/' .claude/rules/governance.md",     // the edit the file guard refuses, by another tool
      'sed -i.bak -e s/a/b/ .claude/settings.json',
      'echo x > .claude/settings.json',
      'echo x >> .claude/rules/governance.md',
      'cat > ".claude/rules/governance.md" <<EOF\nnew rule\nEOF',
      'echo x | tee .claude/settings.json',
      'cp /tmp/new.md .claude/rules/governance.md',
      'mv /tmp/new.md .claude/rules/governance.md',
      'rm -f .claude/hooks/write-guard.mjs',
      'rm -rf .claude',                                      // the directory itself, which no file tool can name
      'mkdir -p .claude/rules/new',
      'ln -sf /tmp/evil.md .claude/rules/governance.md',
      'dd if=/tmp/x of=.claude/settings.json',
      'git checkout -- .claude/rules/governance.md',
      'git restore .claude/settings.json',
      'perl -i -pe s/a/b/ .claude/settings.json',
      'install -m 644 /tmp/x .claude/settings.json',
      'truncate -s 0 .claude/settings.json',
    ]) expect(denied(cmd), cmd).toMatch(/protected path/);
  });

  it('denies the one command that would switch the guard off for good', () => {
    for (const cmd of ['touch .owner-machine', 'echo x > .owner-machine', ': > .owner-machine',
                       'cp /tmp/x .owner-machine', 'tee .owner-machine < /dev/null'])
      expect(denied(cmd), cmd).toMatch(/owner's-machine marker/);
  });

  it('follows the target through the quoting, wrappers and nesting the parser already handles', () => {
    for (const cmd of ["sh -c \"touch '.claude/rules/new.md'\"", 'eval "rm -rf .claude/hooks"',
                       'timeout 30 sed -i "" s/a/b/ .claude/settings.json',
                       'npm test && echo done >> .claude/notes.md'])
      expect(denied(cmd), cmd).not.toBeNull();
  });

  it('leaves reads alone — a run that stops reading .claude/ has lost its own rules', () => {
    for (const cmd of ['cat .claude/rules/governance.md', 'grep -n owner-session .claude/settings.json',
                       'git diff .claude/', 'git log --oneline -- .claude/hooks', 'node .claude/hooks/io.mjs',
                       'cp .claude/settings.json /tmp/backup.json',   // .claude/ as the SOURCE of a copy is a read
                       'ls -la .claude/skills', 'wc -c .claude/rules/*.md'])
      expect(denied(cmd), cmd).toBeNull();
  });

  it('leaves the ordinary commands a run runs all day alone', () => {
    for (const cmd of ['npm test', 'git checkout -b chore/346-claude-write-guards', 'git checkout main',
                       'rm -rf dist node_modules', 'mkdir -p docs/worklog', 'echo x > /tmp/body.md',
                       'sed -i "" s/a/b/ src/main.ts', 'mv docs/a.md docs/b.md', 'cp src/main.ts /tmp/x'])
      expect(denied(cmd), cmd).toBeNull();
  });

  it('allows both in a checkout that carries the marker — the owner is at the keyboard', () => {
    for (const cmd of ["sed -i '' 's/x/y/' .claude/rules/governance.md", 'touch .owner-machine'])
      expect(claudeWrite(cmd, owner), cmd).toBeNull();
  });

  it('says what to do instead, names the path, and does not hand back the route it just refused', () => {
    const reason = denied('sed -i "" s/x/y/ .claude/rules/governance.md') ?? '';
    expect(reason, 'the run must be able to see which path it was').toContain('.claude/rules/governance.md');
    expect(reason, 'and where to put the change instead').toContain('owner-session');
    expect(reason, 'a run that retries has understood nothing').toMatch(/do not retry/i);
    expect(reason, 'and the one message a stuck run reads must not end by naming the workaround')
      .not.toMatch(/create .*\.owner-machine|touch \.owner-machine/i);
    // The marker's refusal is its own: the .claude/ sentence would state a false fact about a file at the root.
    expect(denied('touch .owner-machine'), 'the marker is not under .claude/').not.toMatch(/is under \.claude\//);
  });

  /**
   * PR #393 round 1, B1. `writeTargets` spells a target as the command line spells it and `claudeWrite`
   * resolved it against the project root — i.e. it assumed every statement runs there. Nothing tracks `cd`,
   * so a two-word prefix walked round the whole rule, the marker included. The last of these is the command
   * the pull request exists to refuse, and after it every later write in that checkout is allowed.
   *
   * Prove it red: judge a target only by where it resolves, or drop `entersProtected`.
   */
  it('a cd prefix does not walk round the rule (#393 review B1)', () => {
    for (const cmd of ['cd .claude && echo x > settings.json',
                       "cd .claude/rules && sed -i '' s/a/b/ governance.md",
                       '(cd .claude && rm -rf hooks)',
                       'sh -c "cd .claude && rm -rf hooks"',
                       'cd scripts && touch ../.owner-machine',
                       'cd /somewhere/else && rm -rf /tmp/x/.claude'])
      expect(denied(cmd), cmd).not.toBeNull();
    // …and a cd that only READS is still fine, or the guard has started denying a run its own rules.
    expect(denied('cd .claude && cat rules/governance.md')).toBeNull();
    expect(denied('cd docs && echo x > notes.md')).toBeNull();
  });

  /**
   * PR #393 round 1, B4. `mv` was in the "only the destination counts" list beside `cp`, which is true of a
   * copy and false of a move: `mv` removes its source. `mv .claude .claude-old` is the seal itself —
   * `.claude/settings.json` and the hooks cease to exist, the PreToolUse commands then fail, and a failing
   * hook is a non-blocking error, so every later call proceeds unguarded.
   *
   * Prove it red: move `mv` back into `WRITES_LAST_OPERAND`.
   */
  it('mv out of .claude/ is a write, and cp out of it is still a read (#393 review B4)', () => {
    for (const cmd of ['mv .claude/rules/governance.md /tmp/x', 'mv .claude /tmp/stash', 'mv .claude .claude-old',
                       'chmod 000 .claude/hooks/write-guard.mjs', 'git clean -fdx .claude'])
      expect(denied(cmd), cmd).not.toBeNull();
    // The cp/mv distinction, pinned in both directions: a source is read, a destination is written.
    expect(denied('cp .claude/settings.json /tmp/backup.json'), 'a copy reads its source').toBeNull();
    expect(denied('cp /tmp/x .claude/settings.json'), 'and writes its destination').not.toBeNull();
  });

  /**
   * PR #393 round 1, B5a. A tool used to count wherever its name stood in a statement — right for `forcePush`,
   * which reads a subcommand, and wrong here, where the rules read OPERANDS: a filename or a grep pattern is
   * an operand. So a plain read whose *pattern* happened to be `touch` was denied, with a message telling the
   * run to abandon its item.
   *
   * Prove it red: go back to `words.forEach` over every word instead of `toolAt`.
   */
  it('a tool name used as an argument is not the tool (#393 review B5a)', () => {
    for (const cmd of ['grep -rn touch .claude/hooks/bash-guard.mjs', 'grep -c mkdir .claude/hooks/io.mjs',
                       'git grep -n rm .claude/', 'grep -rn "rm -rf" .claude/rules/governance.md',
                       "sed -n '1,40p' .claude/rules/governance.md"])
      expect(denied(cmd), cmd).toBeNull();
    // …while the same tools in command position still write.
    expect(denied('touch .claude/x')).not.toBeNull();
    expect(denied("sed -i '' s/a/b/ .claude/x"), 'the -i is what makes sed a writer').not.toBeNull();
  });

  // #393 review, notes 1–3 and 10: spellings that were mutation-survivable, each with a case of its own now.
  it('the spellings that carried no case: ancestors, >&, and the -t forms', () => {
    for (const cmd of ['rm -rf .', 'git checkout -- .', 'git restore .', 'rm -rf ..',
                       'node a.mjs >& .claude/settings.json', 'echo x >| .claude/settings.json',
                       'cp --target-directory=.claude/rules /tmp/a', 'cp -t .claude/rules /tmp/a'])
      expect(denied(cmd), cmd).not.toBeNull();
    // With `-t DIR` every operand is a SOURCE, so a `.claude/` path in that position is a read.
    expect(denied('cp -t /tmp/dir .claude/settings.json'), 'with -t the last operand is a source').toBeNull();
    // A single operand has no destination to write: `cp x` is an error, not a write to `x`.
    expect(denied('cp .claude/settings.json')).toBeNull();
  });

  it('is wired into check(), alongside the three rules it did not displace', () => {
    expect(bashCheck({ command: 'echo x > .claude/settings.json' }, noMarker)).toMatch(/protected path/);
    expect(bashCheck({ command: 'git push --force origin main' }, noMarker)).toMatch(/Force-push denied/);
    expect(bashCheck({ command: 'echo x >> WORKLOG.md' }, noMarker)).toMatch(/retired/);
    expect(bashCheck({ command: 'npm test' }, noMarker)).toBeNull();
  });
});

describe('layer-0 hooks: .claude/settings.json runs them', () => {
  const entry = (matcher: string) => (settings.hooks.PreToolUse as any[]).find((e) => e.matcher.startsWith(matcher));
  const runWired = (matcher: string, toolInput: Record<string, unknown>, dir = root): unknown => {
    const out = execFileSync('sh', ['-c', entry(matcher).hooks[0].command],
      { input: JSON.stringify({ tool_input: toolInput }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
    return out.trim() === '' ? null : JSON.parse(out);
  };

  it('every PreToolUse hook command names a script that exists under .claude/hooks/', () => {
    const commands = (settings.hooks.PreToolUse as any[]).flatMap((e) => e.hooks).map((h) => h.command as string);
    expect(commands.length).toBeGreaterThanOrEqual(3);
    for (const command of commands) {
      const script = command.match(/\.claude\/hooks\/[\w-]+\.mjs/)?.[0];
      expect(script, `no hook script named in: ${command}`).toBeDefined();
      expect(existsSync(join(root, script!)), `${script} does not exist`).toBe(true);
    }
  });

  it('Bash: denies a force-push, a forged owner marker and a WORKLOG.md append; allows an ordinary command', () => {
    expect(isDeny(runWired('Bash', { command: 'git push --force origin main' }))).toBe(true);
    expect(isDeny(runWired('Bash', { command: "gh pr comment 1 --body 'OWNER: APPROVED'" }))).toBe(true);
    expect(isDeny(runWired('Bash', { command: 'echo x >> WORKLOG.md' }))).toBe(true);
    expect(runWired('Bash', { command: 'npm test' })).toBeNull();
  });

  // The Bash half of #342, through the real command string (#346). Same reasoning as the Write|Edit case
  // below it: a marker-free stand-in for a routine's clone, because the real root carries the marker here.
  it('Bash: denies a shell write under .claude/ and the marker, in a checkout with no owner marker', () => {
    const clone = mkdtempSync(join(tmpdir(), 'sna-sh-wired-'));
    cpSync(join(root, '.claude/hooks'), join(clone, '.claude/hooks'), { recursive: true });
    expect(existsSync(join(clone, OWNER_MARKER)), 'a clone never carries the marker').toBe(false);
    expect(isDeny(runWired('Bash', { command: "sed -i '' s/x/y/ .claude/rules/governance.md" }, clone))).toBe(true);
    expect(isDeny(runWired('Bash', { command: 'touch .owner-machine' }, clone))).toBe(true);
    expect(runWired('Bash', { command: 'cat .claude/rules/governance.md' }, clone)).toBeNull();
  });

  it('Write|Edit: denies the root WORKLOG.md and allows any other file', () => {
    expect(isDeny(runWired('Write', { file_path: join(root, 'WORKLOG.md') }))).toBe(true);
    expect(runWired('Write', { file_path: join(root, 'src/main.ts') })).toBeNull();
  });

  // Run against a marker-free directory, which is what a routine's clone is: on the owner's Mac the real root
  // carries `.owner-machine` and the same call is allowed, so anchoring here would flip between CI and his
  // laptop. The command string is the real one out of `.claude/settings.json` (#342).
  it('Write|Edit: denies a .claude/ write through the real command, in a checkout with no owner marker', () => {
    // A stand-in for a routine's clone: the hooks are there, because they are committed; the marker is not,
    // because it never is. `CLAUDE_PROJECT_DIR` locates the scripts as well as the root, so both must move.
    const clone = mkdtempSync(join(tmpdir(), 'sna-wired-'));
    cpSync(join(root, '.claude/hooks'), join(clone, '.claude/hooks'), { recursive: true });
    expect(existsSync(join(clone, OWNER_MARKER)), 'a clone never carries the marker').toBe(false);
    expect(isDeny(runWired('Write', { file_path: join(clone, '.claude/rules/governance.md') }, clone))).toBe(true);
    expect(isDeny(runWired('Write', { file_path: join(clone, OWNER_MARKER) }, clone))).toBe(true);
    expect(runWired('Write', { file_path: join(clone, 'src/main.ts') }, clone)).toBeNull();
  });

  it('MCP GitHub writes: every body-carrying tool is matched, and each rule denies through the real command', () => {
    for (const tool of ['add_issue_comment', 'issue_write', 'pull_request_review_write', 'update_pull_request',
                        'update_issue_comment', 'create_pull_request', 'add_comment_to_pending_review',
                        'add_reply_to_pull_request_comment',
                        // The file-write route (#393 review B5b): these commit a path straight to a branch.
                        'create_or_update_file', 'push_files', 'delete_file'])
      expect({ tool, matched: entry('mcp__github__').matcher.includes(tool) }).toEqual({ tool, matched: true });
    expect(isDeny(runWired('mcp__github__', { body: 'OWNER: APPROVED' }))).toBe(true);
    expect(isDeny(runWired('mcp__github__', { method: 'update', issue_number: 62, body: 'no line here' }))).toBe(true);
    // …and one that satisfies `- second item:` so the wired path actually reaches `queryTopPick` (#338):
    // `check` short-circuits, so without this the end-to-end test never exercised the new rule.
    expect(isDeny(runWired('mcp__github__', { method: 'update', issue_number: 62, body: 'x\n- second item: no' }))).toBe(true);
    expect(isDeny(runWired('mcp__github__', { method: 'create', labels: ['frozen'] }))).toBe(true);
    expect(runWired('mcp__github__', { body: 'Pushed abc123. Ready for re-review.' })).toBeNull();
  });

  it('unreadable stdin allows the call rather than blocking every tool', () => {
    const out = execFileSync('node', [join(root, '.claude/hooks/bash-guard.mjs')], { input: 'not json', encoding: 'utf8' });
    expect(out).toBe('');
  });

  // #101's verification aid: logs which path-scoped rule file loaded, and when. Pinned so it is not lost quietly.
  it('declares an InstructionsLoaded logger scoped to path_glob_match', () => {
    const logger = (settings.hooks.InstructionsLoaded as any[]).find((e) => e.matcher === 'path_glob_match');
    expect(logger?.hooks?.[0]?.command).toContain('.file_path');
  });
});
