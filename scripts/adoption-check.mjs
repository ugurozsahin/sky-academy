import { isChangesRequested, isCleared, hasSessionUrl } from './review-gate.mjs';

/**
 * #161 CANON's two MECHANICAL conditions — is the pull request's current active block old enough, and has its
 * setter gone quiet on that same pull request — evaluated against live comment data. The other two conditions
 * (re-deriving the original objection, and the clearing comment's own wording) are a judgment call no function
 * can make; they stay the reviewing agent's responsibility, per `docs/ROUTINE-PROMPT.md` STEP 2.
 *
 * Deliberately lives OUTSIDE `review-gate.mjs`. That file must never read a clock — its own guard rail
 * (`tests/unit/guardrails.test.ts`, "review-gate.mjs orders the markers and never reads a clock") exists
 * because a block that ages itself out on every CI re-run is how #74 merged over five open review items: the
 * gate is read on every push and every scheduled re-check, so any elapsed-time logic inside it would let a
 * stale block go green by itself, with nobody having adopted anything. This function DOES read a clock, on
 * purpose, because it runs somewhere structurally different: once, at the moment an agent is about to POST a
 * `REVIEW: CLEARED` comment (a `PreToolUse` hook in `.claude/settings.json`, not a CI check), and its answer
 * becomes fixed history the instant the write does or does not happen — it is never re-asked later the way
 * `blockState()` is on every subsequent run.
 *
 * @param {{comments: {body: string, created_at: string}[], now: Date}} args
 * @returns {{ok: boolean, reasons: string[]}}
 */
export function canAdoptNow({ comments, now }) {
  const SESSION_ID_RE = /session_([A-Za-z0-9]+)/;
  const sessionIdOf = (body) => (body || '').match(SESSION_ID_RE)?.[1] ?? null;
  const HOUR = 60 * 60 * 1000;

  // The currently active block: the last REVIEW: CHANGES REQUESTED with no later REVIEW: CLEARED after it —
  // the same "openReview" ordering blockState() uses, so the two never disagree about which comment is live.
  let block = null;
  for (const c of comments || []) {
    if (isChangesRequested(c.body)) block = c;
    else if (isCleared(c.body)) block = null;
  }
  if (block === null) {
    return { ok: false, reasons: ['no open REVIEW: CHANGES REQUESTED block was found on this pull request to adopt'] };
  }
  if (!hasSessionUrl(block.body)) {
    return { ok: false, reasons: ['the block carries no session URL — CANON: not adoptable at all, fail closed'] };
  }

  const reasons = [];
  const blockCreated = new Date(block.created_at);
  const ageHours = (now - blockCreated) / HOUR;
  if (ageHours < 4) {
    reasons.push(`the block is only ${ageHours.toFixed(1)}h old — CANON's age condition is not yet met`);
  }

  const blockSession = sessionIdOf(block.body);
  const laterFromBlockingSession = (comments || [])
    .filter((c) => new Date(c.created_at) > blockCreated && sessionIdOf(c.body) === blockSession);
  if (laterFromBlockingSession.length > 0) {
    const newest = laterFromBlockingSession.reduce((a, b) => (new Date(a.created_at) > new Date(b.created_at) ? a : b));
    const silenceHours = (now - new Date(newest.created_at)) / HOUR;
    if (silenceHours < 2) {
      reasons.push(`the blocking session commented on this pull request ${silenceHours.toFixed(1)}h ago — CANON's silence condition is not yet met`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}
