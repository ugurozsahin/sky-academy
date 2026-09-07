import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM helper shared with .github/workflows/review-gate.yml (see scripts/review-gate.d.ts)
import { blockState, isChangesRequested, isCleared } from '../../scripts/review-gate.mjs';

/**
 * The review gate decides whether a pull request may be merged. It has twice reported "no block" while a
 * reviewer's block stood, so every case below is written in the direction that matters: a marker that must
 * count, and — far more important — text that must NOT be mistaken for one.
 */
const at = (n: number) => new Date(Date.UTC(2026, 8, 7, 12, n)).toISOString();
const pr = (draft: boolean, ...bodies: string[]) =>
  blockState({ draft, comments: bodies.map((body, i) => ({ body, created_at: at(i) })) });

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
    expect(pr(true, 'REVIEW: CHANGES REQUESTED').reasons).toHaveLength(2);
  });

  it('the newest marker wins, so block → clear → block still blocks', () => {
    expect(pr(false, 'REVIEW: CHANGES REQUESTED', 'REVIEW: CLEARED').blocked).toBe(false);
    expect(pr(false, 'REVIEW: CHANGES REQUESTED', 'REVIEW: CLEARED', 'REVIEW: CHANGES REQUESTED').blocked).toBe(true);
    expect(pr(false, 'REVIEW: CLEARED', 'REVIEW: CHANGES REQUESTED').blocked).toBe(true);   // clear before the block
  });

  it('an unblocked PR with ordinary conversation is not blocked', () => {
    expect(pr(false, 'Nice.', 'Rebased onto main.', 'CI green.').blocked).toBe(false);
  });
});
