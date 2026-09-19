import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blockState, closingRefs, hasSessionUrl, isAdoptionClear, isChangesRequested, isCleared, isOwnerApproved, isOwnerRejected } from '../../scripts/review-gate.mjs';
import type { AuthorAssociation } from '../../scripts/review-gate.mjs';

/**
 * The review gate decides whether a pull request may be merged. It has twice reported "no block" while a
 * reviewer's block stood, so every case below is written in the direction that matters: a marker that must
 * count, and — far more important — text that must NOT be mistaken for one.
 */
const at = (n: number) => new Date(Date.UTC(2026, 8, 7, 12, n)).toISOString();
const pr = (draft: boolean, ...bodies: string[]) =>
  blockState({ draft, labels: [], comments: bodies.map((body, i) => ({ body, created_at: at(i), author_association: 'OWNER' })) });
const gated = (...bodies: string[]) =>
  blockState({ draft: false, labels: ['owner-approval'], comments: bodies.map((body, i) => ({ body, created_at: at(i), author_association: 'OWNER' })) });

describe('review gate', () => {
  // Loose on purpose: a reviewer who types the marker in bold, or in sentence case, still means it.
  it.each([
    'REVIEW: CHANGES REQUESTED — the fps floor is wrong',
    '**REVIEW: CHANGES REQUESTED**',
    'REVIEW: Changes Requested',
    '\n\n  REVIEW: CHANGES REQUESTED',
    '> REVIEW: CHANGES REQUESTED',
    'REVIEW:  CHANGES  REQUESTED',
  ])('counts a block written as %j', (body) => expect(isChangesRequested(body)).toBe(true));

  it.each([
    'Looks good, merging.',
    'I read the REVIEW: CHANGES REQUESTED rule and it seems fine',      // mentions it mid-sentence
    'REVIEW: CLEARED',
  ])('does not read %j as a block', (body) => expect(isChangesRequested(body)).toBe(false));

  // Strict on purpose: a false positive here lifts a real block silently, which is the unrecoverable failure.
  it('clears only on the plain marker at the very start', () => {
    expect(isCleared('REVIEW: CLEARED — fps floor fixed in 5af66c2')).toBe(true);
    expect(isCleared('\n  REVIEW: CLEARED')).toBe(true);                 // leading whitespace is forgiven
  });

  it.each([
    '`REVIEW: CLEARED` is *not* what I am doing here — the block above still stands',   // the 2026-09-07 regression
    '> REVIEW: CLEARED',                                                 // quoting someone else's clear
    '**REVIEW: CLEARED**',                                               // emphasis is not plain
    'review: cleared',                                                   // lower case is not the marker
    'Once you fix it, post REVIEW: CLEARED and mark it ready.',           // instructions about clearing
  ])('does not clear on %j', (body) => expect(isCleared(body)).toBe(false));

  it('a draft blocks on its own, and an open review blocks a PR that is ready', () => {
    expect(pr(true).blocked).toBe(true);
    expect(pr(false, 'REVIEW: CHANGES REQUESTED').blocked).toBe(true);
    expect(pr(false).blocked).toBe(false);
    expect(pr(true, 'REVIEW: CHANGES REQUESTED').reasons).toHaveLength(3);   // draft, no-CLEARED, no-session-url (#189)
  });

  it('the newest marker wins, so block → clear → block still blocks', () => {
    expect(pr(false, 'REVIEW: CHANGES REQUESTED', 'REVIEW: CLEARED').blocked).toBe(false);
    expect(pr(false, 'REVIEW: CHANGES REQUESTED', 'REVIEW: CLEARED', 'REVIEW: CHANGES REQUESTED').blocked).toBe(true);
    expect(pr(false, 'REVIEW: CLEARED', 'REVIEW: CHANGES REQUESTED').blocked).toBe(true);   // clear before the block
  });

  it('an unblocked PR with ordinary conversation is not blocked', () => {
    expect(pr(false, 'Nice.', 'Rebased onto main.', 'CI green.').blocked).toBe(false);
  });

  // The owner's verdict on something he has to look at. Same asymmetry as the review markers, for the same
  // reason: a false REJECTED is red and self-correcting, a false APPROVED ships a visual he never saw.
  describe("the owner's verdict", () => {
    it('an owner-approval label blocks until he approves', () => {
      expect(gated().blocked).toBe(true);
      expect(gated('OWNER: APPROVED — looks right').blocked).toBe(false);
      expect(gated('OWNER: REJECTED — the halo is too soft').blocked).toBe(true);
    });

    it('the newest verdict wins', () => {
      expect(gated('OWNER: REJECTED', 'OWNER: APPROVED').blocked).toBe(false);
      expect(gated('OWNER: APPROVED', 'OWNER: REJECTED').blocked).toBe(true);
    });

    it('a rejection blocks even without the label', () => {
      expect(pr(false, 'OWNER: REJECTED — no').blocked).toBe(true);
    });

    it.each(['**OWNER: APPROVED**', '> OWNER: APPROVED', 'owner: approved',
             'Reply OWNER: APPROVED when you are happy with it'])(
      'does not read %j as approval', (body) => expect(isOwnerApproved(body)).toBe(false));

    it.each(['OWNER: REJECTED — too bright', '**OWNER: REJECTED**', 'owner: rejected'])(
      'reads %j as a rejection', (body) => expect(isOwnerRejected(body)).toBe(true));
  });
});

/**
 * #77 — editing a marker comment away, or deleting it outright, must not leave the gate on stale state.
 * `.github/workflows/review-gate.yml` now wakes on `edited`/`deleted` too and always re-lists the PR's
 * *current* comments before calling blockState(), so the predicate itself needs no notion of "edited" or
 * "deleted" — it only has to keep computing correctly from whatever comment set it is handed. These pin
 * the two directions the issue reports: a block or an approval withdrawn by editing the comment away, and
 * one withdrawn by deleting it, each as the recomputed set would actually look once the workflow re-lists.
 */
describe('a comment recomputes correctly once it is edited away or deleted (#77)', () => {
  it('a REVIEW: CHANGES REQUESTED comment edited to plain text unblocks, once recomputed', () => {
    expect(pr(false, 'REVIEW: CHANGES REQUESTED — fps floor is wrong').blocked).toBe(true);
    // the reviewer edits the same comment to withdraw it — the next listing carries only the new text
    expect(pr(false, 'Never mind, this was a false alarm.').blocked).toBe(false);
  });

  it('an OWNER: APPROVED comment edited to withdraw it re-blocks an owner-approval PR, once recomputed', () => {
    expect(gated('OWNER: APPROVED — looks right').blocked).toBe(false);
    expect(gated('Actually, hold off — let me look again.').blocked).toBe(true);
  });

  it('deleting a REVIEW: CHANGES REQUESTED comment unblocks, once recomputed from what remains', () => {
    expect(pr(false, 'Looks fine so far.', 'REVIEW: CHANGES REQUESTED — fps floor is wrong').blocked).toBe(true);
    // the comment is gone outright — simply absent from the next listing, not edited in place
    expect(pr(false, 'Looks fine so far.').blocked).toBe(false);
  });

  it('deleting an OWNER: APPROVED comment re-blocks an owner-approval PR, once recomputed', () => {
    expect(gated('Looks fine.', 'OWNER: APPROVED').blocked).toBe(false);
    expect(gated('Looks fine.').blocked).toBe(true);
  });
});

/**
 * #189 — a REVIEW: CHANGES REQUESTED comment with no session URL blocks the PR exactly as before, and the
 * gate says the URL is missing: it is the only record of which session set the block, so it is what lets
 * anyone check afterwards that no session reviewed its own change.
 */
describe('the block carries a session URL (#189)', () => {
  const withUrl = 'REVIEW: CHANGES REQUESTED — the fps floor is wrong\n\nSession: https://claude.ai/code/session_01MGtjdpxyeGtFJMYeYp3t8B';
  const withoutUrl = 'REVIEW: CHANGES REQUESTED — the fps floor is wrong';

  it.each([
    'Session: https://claude.ai/code/session_01MGtjdpxyeGtFJMYeYp3t8B',
    'https://claude.ai/code/session_014Zmk2ZfxgaWVtGeCwHxysY',
    '(session https://claude.ai/code/session_abc123XYZ)',
  ])('reads %j as carrying a session URL', (body) => expect(hasSessionUrl(body)).toBe(true));

  it.each([
    'REVIEW: CHANGES REQUESTED — the fps floor is wrong',
    'see https://claude.ai/code/PR-notes for context',                 // not a session link
    'session 01MGtjdpxyeGtFJMYeYp3t8B (no url)',                       // an id with no URL is not enough
  ])('does not read %j as carrying a session URL', (body) => expect(hasSessionUrl(body)).toBe(false));

  it('adds a distinct reason when the open block has no session URL', () => {
    const blocked = pr(false, withoutUrl);
    expect(blocked.blocked).toBe(true);
    expect(blocked.reasons).toContain('the block has no session URL (#199)');
  });

  it('does not add the reason when the open block carries a session URL', () => {
    const blocked = pr(false, withUrl);
    expect(blocked.blocked).toBe(true);
    expect(blocked.reasons).not.toContain('the block has no session URL (#199)');
  });

  it('is silent when there is no open block at all', () => {
    expect(pr(false).reasons).not.toContain('the block has no session URL (#199)');
    expect(pr(false, withoutUrl, 'REVIEW: CLEARED').reasons)
      .not.toContain('the block has no session URL (#199)');
  });

  it('newest marker wins: only the currently-open block is checked for a session URL', () => {
    // an old, url-less block was cleared; the new, currently-open block does carry one — no reason.
    expect(pr(false, withoutUrl, 'REVIEW: CLEARED', withUrl).reasons)
      .not.toContain('the block has no session URL (#199)');
    // the reverse: an old block had a URL and was cleared; the new, currently-open block does not — reason fires.
    expect(pr(false, withUrl, 'REVIEW: CLEARED', withoutUrl).reasons)
      .toContain('the block has no session URL (#199)');
  });

  it('a draft PR with a url-less block reports both reasons, under the 140-char status budget', () => {
    const blocked = pr(true, withoutUrl);
    const description = `Blocked: ${blocked.reasons.join('; ')}`;
    expect(blocked.reasons).toHaveLength(3);   // draft, no-CLEARED, no-session-url
    expect(description.length).toBeLessThanOrEqual(140);
  });
});

/**
 * #195 — the clearing side of #189/#191's gap: an adopting REVIEW: CLEARED comment (one that opens with
 * "Clearing another reviewer's block", #161's own phrasing, and matches every real adoption on record —
 * PR #171, both of them) must carry its own session URL too, or the adoption itself is unattributable.
 * An ordinary clear by the reviewer who set the block never needs to say this, so isAdoptionClear only
 * matches text a plain "REVIEW: CLEARED — fps fixed" would never contain by accident.
 */
describe("a REVIEW: CLEARED adopting another reviewer's block carries its own session URL (#195)", () => {
  const requestWithUrl = 'REVIEW: CHANGES REQUESTED — the fps floor is wrong\n\nSession: https://claude.ai/code/session_01MGtjdpxyeGtFJMYeYp3t8B';
  const adoptionNoUrl = "REVIEW: CLEARED\n\nClearing another reviewer's block, adopted under #161. Verified the fps floor fix directly.";
  const adoptionWithUrl = "REVIEW: CLEARED\n\nClearing another reviewer's block, adopted under #161.\n\nSession: https://claude.ai/code/session_01C2pKTDxG5Ajirpyv3FqQdZ";
  const ordinaryClear = 'REVIEW: CLEARED — fps fixed, verified locally';

  it.each([
    ["REVIEW: CLEARED\n\nClearing another reviewer's block, adopted under #161.", true],
    ['REVIEW: CLEARED\n\nclearing another reviewers block under #161', true],
    ['REVIEW: CLEARED — fps fixed, verified locally', false],
    ["REVIEW: CHANGES REQUESTED — another reviewer's block awaits", false],
    ["Clearing another reviewer's block, adopted under #161.", false],  // right phrasing, but no REVIEW: CLEARED marker at all
  ])('reads %j as an adoption clear: %s', (body, expected) => expect(isAdoptionClear(body)).toBe(expected));

  it('adds a distinct reason when the current clear is an adoption with no session URL of its own', () => {
    const blocked = pr(false, requestWithUrl, adoptionNoUrl);
    expect(blocked.blocked).toBe(true);
    expect(blocked.reasons).toContain("REVIEW: CLEARED supersedes another reviewer's block with no session URL of its own (#191)");
  });

  it('does not add the reason when the adopting clear carries its own session URL', () => {
    const blocked = pr(false, requestWithUrl, adoptionWithUrl);
    expect(blocked.reasons).not.toContain("REVIEW: CLEARED supersedes another reviewer's block with no session URL of its own (#191)");
  });

  it('does not add the reason for an ordinary (non-adoption) clear, session URL or not', () => {
    const blocked = pr(false, requestWithUrl, ordinaryClear);
    expect(blocked.reasons).not.toContain("REVIEW: CLEARED supersedes another reviewer's block with no session URL of its own (#191)");
  });

  it('is silent when the adoption clear is not the PR\'s current state (superseded by a later block)', () => {
    const blocked = pr(false, requestWithUrl, adoptionNoUrl, requestWithUrl);
    expect(blocked.reasons).not.toContain("REVIEW: CLEARED supersedes another reviewer's block with no session URL of its own (#191)");
  });

  it('is silent when there is no clear at all', () => {
    expect(pr(false).reasons).not.toContain("REVIEW: CLEARED supersedes another reviewer's block with no session URL of its own (#191)");
    expect(pr(false, requestWithUrl).reasons).not.toContain("REVIEW: CLEARED supersedes another reviewer's block with no session URL of its own (#191)");
  });
});

/**
 * #215 — the repo went public on 2026-09-16, and the gate read every comment's text without asking who wrote
 * it: any GitHub account could post `OWNER: APPROVED` on an `owner-approval` PR and turn the status green.
 * GitHub stamps each comment with `author_association`, which the commenter cannot choose, so that is what
 * decides whether a marker counts. An `OWNER:` verdict counts only from the repo's OWNER; a `REVIEW:` marker
 * counts from anyone with write access. A comment with no association at all is a stranger's: fail closed.
 */
describe('a marker counts only from someone allowed to write it (#215)', () => {
  const by = (author_association: AuthorAssociation | undefined, body: string, n = 0) => ({ body, created_at: at(n), author_association });
  const state = (labels: string[], draft: boolean, ...comments: ReturnType<typeof by>[]) => blockState({ draft, labels, comments });

  it.each(['NONE', 'CONTRIBUTOR', 'FIRST_TIME_CONTRIBUTOR', 'FIRST_TIMER', 'MANNEQUIN', undefined] as const)(
    "a stranger's (%s) OWNER: APPROVED does not approve an owner-approval PR", (who) => {
      expect(state(['owner-approval'], false, by(who, 'OWNER: APPROVED')).blocked).toBe(true);
    });

  it('a collaborator is not the owner either: only OWNER writes an OWNER: verdict', () => {
    expect(state(['owner-approval'], false, by('COLLABORATOR', 'OWNER: APPROVED')).blocked).toBe(true);
    expect(state([], false, by('COLLABORATOR', 'OWNER: REJECTED — no')).blocked).toBe(false);
  });

  it("the owner's own OWNER: APPROVED still approves", () => {
    expect(state(['owner-approval'], false, by('OWNER', 'OWNER: APPROVED')).blocked).toBe(false);
  });

  it("a stranger's OWNER: APPROVED cannot override the owner's rejection", () => {
    expect(state([], false, by('OWNER', 'OWNER: REJECTED — too dark', 0), by('NONE', 'OWNER: APPROVED', 1)).blocked).toBe(true);
  });

  it("a stranger's REVIEW: CLEARED does not lift a real block", () => {
    const block = by('OWNER', 'REVIEW: CHANGES REQUESTED — fps\n\nSession: https://claude.ai/code/session_abc123', 0);
    expect(state([], false, block, by('NONE', 'REVIEW: CLEARED', 1)).blocked).toBe(true);
  });

  it('and a stranger cannot block a PR or reject it for the owner', () => {
    expect(state([], false, by('NONE', 'REVIEW: CHANGES REQUESTED — spam')).blocked).toBe(false);
    expect(state([], false, by('CONTRIBUTOR', 'OWNER: REJECTED — spam')).blocked).toBe(false);
  });

  it.each(['COLLABORATOR', 'MEMBER', 'OWNER'] as const)('a REVIEW: marker from %s counts both ways', (who) => {
    const block = by(who, 'REVIEW: CHANGES REQUESTED — fps\n\nSession: https://claude.ai/code/session_abc123', 0);
    expect(state([], false, block).blocked).toBe(true);
    expect(state([], false, block, by(who, 'REVIEW: CLEARED', 1)).blocked).toBe(false);
  });
});

/**
 * #144 — a PR body that says "does not close #<n>" closes #<n> anyway.
 *
 * GitHub scans the body for a closing keyword next to an issue reference and has no notion of negation,
 * quotation or context, so the sentence written to explain why an issue must stay open is itself the
 * auto-close. It happened on PR #139: the body said `Part of #<n>`, the very next sentence explained that
 * merging must not close the issue, and GitHub closed it with the woff2 half undone (issue 44, reopened by
 * hand). Every expectation below is the *rule as written* in CLAUDE.md and docs/ROUTINE-PROMPT.md, so a run
 * can check its body against this rather than remember a paragraph:
 *     node scripts/review-gate.mjs body.md
 */
describe('closing references in a PR body (#144)', () => {
  // The regression. Both sentences come from PR #139's real body, with the issue number kept.
  it('reads a *negated* closing keyword as a close, because GitHub does', () => {
    expect(closingRefs('Left open so merging this does not close #44 with that undone.')).toEqual([44]);
    expect(closingRefs("## Deferred (why this doesn't close #26)")).toEqual([26]);          // PR #83, same trap
  });

  // ...and the wordings the rule tells you to use instead. These are the corrected bodies: they must be clean.
  it.each([
    'Part of #44 — the woff2-inlining half is deferred, so the issue stays open.',
    '`Part of #44`. #44 remains open for Part B.',
    'Half of this is deferred; issue 44 stays open until the woff2 inlining lands.',
    'Deferred: the woff2 half. Does not #&#8203;44 — break the link when the keyword is unavoidable.',
  ])('reports nothing for the corrected wording %j', (body) => expect(closingRefs(body)).toEqual([]));

  it('takes the whole keyword list, either reference form, any case', () => {
    expect(closingRefs('closes #1 · Closed #2 · FIX #3 · fixes #4 · Fixed #5')).toEqual([1, 2, 3, 4, 5]);
    expect(closingRefs('resolve #6, resolves #7, RESOLVED: #8')).toEqual([6, 7, 8]);
    expect(closingRefs('Fixes https://github.com/ugurozsahin/sky-academy/issues/9')).toEqual([9]);
    expect(closingRefs('Closes ugurozsahin/sky-academy#10')).toEqual([10]);                  // cross-repo form
    expect(closingRefs('Closes #62\nCloses #63')).toEqual([62, 63]);                         // PR #66, both real
  });

  it.each([
    'Part of #44',                                    // the deferral wording, which is the point of the rule
    'Re-opens #44 and supersedes #139',               // not a closing keyword
    'This encloses #5 and is disclosed in #6',        // keywords need a word boundary, not a substring
    'Closing notes: #7 is next',                      // "closing" is not one of GitHub's keywords
    'See #8 for why',
  ])('does not invent a close in %j', (body) => expect(closingRefs(body)).toEqual([]));

  /**
   * Code spans and fenced blocks are the one context GitHub really does ignore — and that cuts BOTH ways:
   * PRs #125, #145, #149, #150, #151, #154, #156 and #163 each wrote their only `Closes` inside backticks
   * and closed nothing (those issues were closed by hand at merge). So backticks are not a way to disarm a
   * keyword you did not mean, and not a way to close an issue you did: say plainly which it is.
   */
  it('mirrors GitHub on code spans and fences, in both directions', () => {
    expect(closingRefs('`Closes #28`')).toEqual([]);                                          // PR #125, verbatim
    expect(closingRefs('```\nCloses #99\n```\nCloses #100')).toEqual([100]);
    expect(closingRefs('`Closes #28` and, plainly, closes #29')).toEqual([29]);
  });

  // Checked on 2026-09-10 against every PR in this repo (73), with GraphQL closingIssuesReferences as the
  // oracle: 73/73 agreement. These four are the accidents in that corpus — bodies that closed an issue while
  // only *talking* about closing it. None of them is a mistake anyone would spot by reading the PR.
  it.each([
    ['#86', "**`Closes #<n>` finishes an issue, nothing less.** #83 used it while deliberately closed #26's last item", [26]],
    ['#90', 'This is the trap that wrongly closed #26.', [26]],
    ['#120', "with it merged the issue's remaining checkbox is done, so a reviewer can close #35 with the commit", [35]],
    ['#139', 'Left open so merging this does not close #44 with that undone.', [44]],
  ] as [string, string, number[]][])('PR %s closed an issue it was only discussing', (_pr, body, closed) =>
    expect(closingRefs(body)).toEqual(closed));
});

/**
 * CLAUDE.md (interactive sessions), docs/ROUTINE-PROMPT.md (the routine's own prompt) and the `open-pr` skill
 * (the rule's home, where a PR body is written) all tell an agent how to write a PR body. This rail is why a
 * future edit cannot quietly drop the rule from any of them. (`BACKLOG.md` was the third file until #218.)
 */
describe('the process files and the open-pr skill carry the closing-keyword rule (#144)', () => {
  const doc = (name: string) => readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');

  it.each(['CLAUDE.md', 'docs/ROUTINE-PROMPT.md', '.claude/skills/open-pr/SKILL.md'])('%s states it', (name) => {
    const text = doc(name);
    expect(text.length).toBeGreaterThan(500);                          // a vacuous rail is worse than none
    expect(text).toMatch(/closing keyword/i);
    expect(text).toMatch(/scripts\/review-gate\.mjs/);                 // and points at the check
  });

  // The docs quote the trap in order to warn about it. If one of them ever spells it out with a live issue
  // number, the paragraph teaching the rule becomes a body that breaks it the moment anyone copies it.
  it('and none of them spells the bad example out with a live issue number', () => {
    for (const name of ['CLAUDE.md', 'docs/ROUTINE-PROMPT.md']) {
      expect(closingRefs(doc(name).replace(/`/g, ''))).toEqual([]);    // backticks stripped: the text itself
    }
  });
});
