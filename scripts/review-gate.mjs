import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Does an open review block stand on a pull request?
 *
 * Pure on purpose: `.github/workflows/review-gate.yml` calls this, and `tests/unit/review-gate.test.ts`
 * holds it to both directions. This predicate has already failed *green* twice — publishing "no block" while
 * a reviewer's block stood — and both times an ad-hoc check agreed with it. A gate that lies in the green
 * direction is worse than no gate, so it lives here where it can be tested rather than inline in YAML.
 *
 * The two markers are matched ASYMMETRICALLY, and that asymmetry is the whole design:
 *
 *   REVIEW: CHANGES REQUESTED — matched loosely (emphasis, quoting, case, spacing all forgiven). The marker
 *     is written `**REVIEW: CHANGES REQUESTED**` in CLAUDE.md, and a reviewer typing it in bold or in
 *     sentence case still means it. A false positive here turns the check red, which a human immediately
 *     notices and clears: self-correcting.
 *
 *   REVIEW: CLEARED — matched strictly against the raw text, leading whitespace only. A false positive here
 *     is silent: it lifts a real block and lets the PR merge. That is exactly what happened when both markers
 *     shared the loose matcher — a comment reading "`REVIEW: CLEARED` is *not* what I am doing here, the
 *     block above still stands" had its backticks stripped and cleared the block it was refusing to clear.
 *     So: to clear a review you write the marker plainly, at the very start, in capitals. Nothing else counts.
 */

/**
 * The same asymmetry governs the owner's verdict on a change he has to look at (new art, a new FX look):
 *   OWNER: REJECTED — matched loosely. A false positive keeps the PR red, which he notices and corrects.
 *   OWNER: APPROVED — matched strictly. A false positive ships a visual he never saw.
 * Neither marker is *verifiable*: one GitHub token serves the owner and every agent, so an agent could write
 * `OWNER: APPROVED` itself. Nothing here can stop that — it is a convention agents are told never to forge,
 * and the honest fix is a second identity (a machine account), not more code.
 */

/** Emphasis, quoting and heading marks stripped; whitespace collapsed; upper-cased. */
const loose = (body) => (body || '').replace(/[*_`>#]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

export const isChangesRequested = (body) => loose(body).startsWith('REVIEW: CHANGES REQUESTED');
export const isCleared = (body) => (body || '').replace(/^\s+/, '').startsWith('REVIEW: CLEARED');
export const isOwnerRejected = (body) => loose(body).startsWith('OWNER: REJECTED');
export const isOwnerApproved = (body) => (body || '').replace(/^\s+/, '').startsWith('OWNER: APPROVED');

/**
 * A REVIEW: CHANGES REQUESTED comment must carry its own session URL (docs/ROUTINE-PROMPT.md, #161's two
 * mechanical checks): the setter's silence is measured from the id in *this* comment, and “if the blocking
 * comment carries no session id at all, condition 1 cannot be evaluated and the block is not adoptable: fail
 * closed and leave it for the owner.” That rule was prose only — nothing read the comment for the URL, so a
 * reviewing session that forgot the footer produced a block silently nobody but the owner could ever clear,
 * discovered only by reading the PR by hand or waiting for the 8-hour watchdog check (#189; live instances:
 * PR #160, cleared only by the owner's direct intervention, and PR #179).
 */
export const hasSessionUrl = (body) => /https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]+/.test(body || '');

/**
 * Is a REVIEW: CLEARED comment itself a #161 adoption — clearing a block a *different* session set — rather
 * than an ordinary clear by the reviewer who set it? #161's own language is "clearing another reviewer's
 * block" (docs/ROUTINE-PROMPT.md, CLAUDE.md), and every adoption comment on record (PR #171, both of them)
 * opens with exactly that phrase. An ordinary clear never needs to say this, so its absence is the signal:
 * this only matches text a plain "REVIEW: CLEARED — fps fixed" clear would never contain by accident.
 */
export const isAdoptionClear = (body) => isCleared(body) && /another reviewer'?s block/i.test(body || '');

/**
 * Who may write a marker (#215). The repo went public on 2026-09-16 and the gate read every comment's text
 * without asking who wrote it, so any GitHub account could post `OWNER: APPROVED` and turn the status green.
 * `author_association` is GitHub's own stamp on each comment, relative to this repo — the commenter cannot
 * choose it. An `OWNER:` verdict counts only from the repo's OWNER; a `REVIEW:` marker from anyone with write
 * access. A comment with no association is a stranger's: fail closed. This does not make the owner's marker
 * unforgeable by an *agent* — they still share his account (the note above, #78) — but when the agents get
 * their own identity they become COLLABORATOR and this same check starts refusing them with no change here.
 */
const mayReview = (c) => ['OWNER', 'COLLABORATOR', 'MEMBER'].includes(c.author_association);
const isOwner = (c) => c.author_association === 'OWNER';

/**
 * @param {{draft: boolean, labels?: string[], comments: {body: string, created_at: string, author_association?: string}[]}} pr
 * @returns {{blocked: boolean, reasons: string[]}} newest marker wins, so block → clear → block works.
 */
export function blockState({ draft, labels, comments }) {
  let requested = null, requestedHasSession = false, cleared = null, clearedBody = null, rejected = null, approved = null;
  for (const c of comments || []) {
    if (mayReview(c) && isChangesRequested(c.body)) { requested = c.created_at; requestedHasSession = hasSessionUrl(c.body); }
    if (mayReview(c) && isCleared(c.body)) { cleared = c.created_at; clearedBody = c.body; }
    if (isOwner(c) && isOwnerRejected(c.body)) rejected = c.created_at;
    if (isOwner(c) && isOwnerApproved(c.body)) approved = c.created_at;
  }
  const openReview = requested !== null && (cleared === null || cleared < requested);
  // #195 — the clearing side of #189/#191's gap: a REVIEW: CLEARED comment that adopts another reviewer's
  // block under #161 must carry its own session URL too (docs/ROUTINE-PROMPT.md, CLAUDE.md); nothing read
  // it for one, so an adopting session that forgot the footer cleared silently and passed. Checked only
  // when this clear is the PR's *current* state (not openReview) — an already-superseded clear from PR
  // history, such as PR #171's two pre-#191 comments, is not re-flagged.
  const clearNeedsSession = cleared !== null && !openReview && isAdoptionClear(clearedBody) && !hasSessionUrl(clearedBody);
  // `owner-approval` says a human has to look at this before it ships — a new look, not a refactor that
  // must keep the old one. It clears only on OWNER: APPROVED; OWNER: REJECTED blocks on its own so the
  // verdict is recorded rather than the label quietly disappearing.
  const wantsOwner = (labels || []).includes('owner-approval');
  const ownerSaidNo = rejected !== null && (approved === null || approved < rejected);
  const reasons = [];
  if (draft) reasons.push('the PR is a draft');
  if (openReview) reasons.push('a REVIEW: CHANGES REQUESTED comment has no later REVIEW: CLEARED');
  if (openReview && !requestedHasSession) reasons.push('no session URL — unadoptable per #161');
  if (clearNeedsSession) reasons.push("REVIEW: CLEARED adopts another reviewer's block with no session URL of its own — unmarked per #161/#191/#195");
  if (ownerSaidNo) reasons.push('the owner rejected it (OWNER: REJECTED, no later OWNER: APPROVED)');
  else if (wantsOwner && approved === null) reasons.push('labelled owner-approval and the owner has not written OWNER: APPROVED');
  return { blocked: reasons.length > 0, reasons };
}

/**
 * Which issues would GitHub close if this pull-request body were merged? (#144)
 *
 * GitHub scans a PR body for a closing keyword followed by an issue reference and has **no notion of
 * negation, quotation or context**: the sentence written to explain why an issue must stay open closes it.
 * PR #139 said `Part of #<n>` and, one line later, "Left open so merging this does not close #<n> with that
 * undone" — GitHub recorded a closing reference and shut issue 44 with half its work undone.
 *
 * Measured against every pull request in this repo (73 of them, GraphQL `closingIssuesReferences` as the
 * oracle, 2026-09-10) this agrees with GitHub on all of them: the four bodies that closed an issue by
 * accident while only discussing it (#83, #86, #90, #139) and the eight whose only `Closes` sat inside
 * backticks — see `withoutCode` below. It is a *predicate over text*, not a promise about GitHub's parser:
 * treat a number it reports as one that will be closed, and never read silence as a licence to be careless.
 */
export const CLOSING_KEYWORDS = ['close', 'closes', 'closed', 'fix', 'fixes', 'fixed', 'resolve', 'resolves', 'resolved'];

/**
 * Code spans and fenced blocks are the one context GitHub's parser really does ignore — proven the hard way
 * here: PRs #125, #145, #149, #150, #151, #154, #156 and #163 all wrote their only `Closes` inside backticks
 * and closed nothing (a person closed those issues by hand at merge), so the cut runs both ways. Never
 * *rely* on backticks to disarm a keyword you did not mean — write "the issue stays open", or break the
 * link — and never rely on them to close one you did.
 */
const withoutCode = (body) => (body || '')
  .replace(/^ {0,3}(```+|~~~+)[^\n]*\n[\s\S]*?^ {0,3}\1[^\n]*$/gm, ' ')   // fenced blocks, both fence styles
  .replace(/^ {0,3}(?:```+|~~~+)[\s\S]*$/m, ' ')                          // an unclosed fence runs to the end
  .replace(/``[\s\S]*?``|`[^`\n]*`/g, ' ');                               // inline code spans

const REFERENCE = String.raw`(?:[\w.-]+\/[\w.-]+)?#(\d+)|https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/(\d+)`;
const CLOSING = new RegExp(String.raw`\b(?:${CLOSING_KEYWORDS.join('|')})\b\s*:?\s+(?:${REFERENCE})`, 'gi');

/**
 * @param {string} body a pull-request body
 * @returns {number[]} the issue numbers GitHub would treat as closing references, ascending, deduplicated.
 */
export function closingRefs(body) {
  const hits = [...withoutCode(body).matchAll(CLOSING)].map((m) => Number(m[1] ?? m[2]));
  return [...new Set(hits)].sort((a, b) => a - b);
}

// CLI: `node scripts/review-gate.mjs <file>` prints what that body would close, so a run can check its PR
// body against what it actually means before opening the PR (docs/ROUTINE-PROMPT.md). Import-safe: it runs
// only when this file is the entry point, so the review gate workflow's `await import(...)` is unaffected.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const refs = closingRefs(readFileSync(process.argv[2], 'utf8'));
  console.log(refs.length ? `closes: ${refs.map((n) => '#' + n).join(', ')}` : 'closes: nothing');
}
