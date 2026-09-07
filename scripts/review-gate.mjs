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

/** Emphasis, quoting and heading marks stripped; whitespace collapsed; upper-cased. */
const loose = (body) => (body || '').replace(/[*_`>#]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

export const isChangesRequested = (body) => loose(body).startsWith('REVIEW: CHANGES REQUESTED');
export const isCleared = (body) => (body || '').replace(/^\s+/, '').startsWith('REVIEW: CLEARED');

/**
 * @param {{draft: boolean, comments: {body: string, created_at: string}[]}} pr
 * @returns {{blocked: boolean, reasons: string[]}} newest marker wins, so block → clear → block works.
 */
export function blockState({ draft, comments }) {
  let requested = null, cleared = null;
  for (const c of comments || []) {
    if (isChangesRequested(c.body)) requested = c.created_at;
    if (isCleared(c.body)) cleared = c.created_at;
  }
  const openReview = requested !== null && (cleared === null || cleared < requested);
  const reasons = [];
  if (draft) reasons.push('the PR is a draft');
  if (openReview) reasons.push('a REVIEW: CHANGES REQUESTED comment has no later REVIEW: CLEARED');
  return { blocked: reasons.length > 0, reasons };
}
