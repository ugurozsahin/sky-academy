import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM helper, no types beyond scripts/adoption-check.d.ts
import { canAdoptNow } from '../../scripts/adoption-check.mjs';

/**
 * #161 CANON's two mechanical conditions (age, silence — see docs/ROUTINE-PROMPT.md STEP 2 for the figures
 * themselves; this file does not restate them, the same rail that pins .claude/ documents to a pointer rather
 * than a paraphrase). `canAdoptNow` is pure and takes `now` as an argument precisely so these tests need no
 * fake timers and no network — the wiring that actually fetches a pull request's live comments and calls this
 * function lives in the `.claude/settings.json` hook, exercised separately in tests/unit/guardrails.test.ts.
 */
const NOW = new Date('2026-09-18T16:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString();
const SESSION_A = 'https://claude.ai/code/session_AAAA1111';
const SESSION_B = 'https://claude.ai/code/session_BBBB2222';

describe('canAdoptNow — #161 CANON evaluated against live comment data', () => {
  it('denies when there is no open block to adopt', () => {
    const v = canAdoptNow({ comments: [], now: NOW });
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/no open REVIEW: CHANGES REQUESTED block/);
  });

  it('denies when the block carries no session URL — not adoptable at all, whatever its age', () => {
    const v = canAdoptNow({
      comments: [{ body: 'REVIEW: CHANGES REQUESTED — fps floor is wrong', created_at: hoursAgo(10) }],
      now: NOW,
    });
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/no session URL/);
  });

  it('denies on age when the block is not old enough, even with a session URL', () => {
    const v = canAdoptNow({
      comments: [{ body: `REVIEW: CHANGES REQUESTED — see above. ${SESSION_A}`, created_at: hoursAgo(1) }],
      now: NOW,
    });
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/only 1\.0h old/);
  });

  it('denies on silence when the blocking session commented on this pull request too recently', () => {
    const v = canAdoptNow({
      comments: [
        { body: `REVIEW: CHANGES REQUESTED — see above. ${SESSION_A}`, created_at: hoursAgo(10) },
        { body: `Still waiting on the fix. ${SESSION_A}`, created_at: hoursAgo(1) },
      ],
      now: NOW,
    });
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/blocking session commented .* 1\.0h ago/);
  });

  it('can report both conditions failing at once', () => {
    const v = canAdoptNow({
      comments: [
        { body: `REVIEW: CHANGES REQUESTED — see above. ${SESSION_A}`, created_at: hoursAgo(1) },
        { body: `Ping. ${SESSION_A}`, created_at: hoursAgo(0.5) },
      ],
      now: NOW,
    });
    expect(v.ok).toBe(false);
    expect(v.reasons).toHaveLength(2);
  });

  it('allows adoption once the block is old enough and its session has gone quiet on this pull request', () => {
    const v = canAdoptNow({
      comments: [
        { body: `REVIEW: CHANGES REQUESTED — see above. ${SESSION_A}`, created_at: hoursAgo(10) },
        { body: `Just a note. ${SESSION_A}`, created_at: hoursAgo(3) },
      ],
      now: NOW,
    });
    expect(v).toEqual({ ok: true, reasons: [] });
  });

  it('allows when the blocking session never commented on this pull request again', () => {
    const v = canAdoptNow({
      comments: [{ body: `REVIEW: CHANGES REQUESTED — see above. ${SESSION_A}`, created_at: hoursAgo(24) }],
      now: NOW,
    });
    expect(v.ok).toBe(true);
  });

  it('ignores a different session commenting recently — silence is measured on the blocking session only', () => {
    const v = canAdoptNow({
      comments: [
        { body: `REVIEW: CHANGES REQUESTED — see above. ${SESSION_A}`, created_at: hoursAgo(10) },
        { body: `Pushed a fix just now. ${SESSION_B}`, created_at: hoursAgo(0.1) },
      ],
      now: NOW,
    });
    expect(v.ok).toBe(true);
  });

  it('only the current block counts — an intervening ordinary clear resets it, then a fresh block is what gets checked', () => {
    const v = canAdoptNow({
      comments: [
        { body: `REVIEW: CHANGES REQUESTED — first pass. ${SESSION_A}`, created_at: hoursAgo(20) },
        { body: `REVIEW: CLEARED — addressed. ${SESSION_A}`, created_at: hoursAgo(15) },
        { body: `REVIEW: CHANGES REQUESTED — second pass. ${SESSION_B}`, created_at: hoursAgo(1) },
      ],
      now: NOW,
    });
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/only 1\.0h old/);
  });

  it('fails closed when any comment on the pull request has a missing or malformed created_at, rather than letting NaN comparisons read as satisfied', () => {
    // Found in review of the PR that introduced this file: new Date(bad) is Invalid Date, and both
    // `NaN < 4` and `NaN < 2` evaluate to false — an indeterminate age/silence would otherwise pass silently,
    // the opposite of this function's stated fail-closed design.
    const v1 = canAdoptNow({
      comments: [{ body: `REVIEW: CHANGES REQUESTED — see above. ${SESSION_A}`, created_at: 'not-a-date' }],
      now: NOW,
    });
    expect(v1.ok).toBe(false);
    expect(v1.reasons.join(' ')).toMatch(/missing or malformed created_at/);

    const v2 = canAdoptNow({
      comments: [{ body: `REVIEW: CHANGES REQUESTED — see above. ${SESSION_A}`, created_at: undefined as unknown as string }],
      now: NOW,
    });
    expect(v2.ok).toBe(false);
    expect(v2.reasons.join(' ')).toMatch(/missing or malformed created_at/);
  });

  it('a comment mid-sentence mentioning the session URL does not count as the setter speaking again — it does, deliberately (any mention is a live signal)', () => {
    // Documents the actual behaviour rather than asserting an aspiration: the check is textual, like the rest
    // of this repository's marker detection, and a session ID appearing anywhere in a later comment counts.
    const v = canAdoptNow({
      comments: [
        { body: `REVIEW: CHANGES REQUESTED — see above. ${SESSION_A}`, created_at: hoursAgo(10) },
        { body: `Quoting the earlier block from ${SESSION_A} for context.`, created_at: hoursAgo(1) },
      ],
      now: NOW,
    });
    expect(v.ok).toBe(false);
  });
});
