import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * #636-#641 (#322 rows 1-6): the rationale for the freeze, the review block, records-have-readers, tightening
 * versus loosening, the board and the second item lives in one ADR each, and the files that used to restate it carry a pointer. The routing test is that a run
 * acts on the operative sentence mid-run and only asks "why" afterwards, so these rails pin both halves:
 * the pointer is there, and the copied reasoning has not come back.
 *
 * Prove one red: delete a pointer from the file named in the case, or paste the old clause back.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const flat = (f: string) => read(f).replace(/\s+/g, ' ');

const FREEZE = 'docs/decisions/012-the-code-health-freeze-and-its-lift.md';
const BLOCK = 'docs/decisions/013-a-review-blocks-by-draft-and-comment.md';
const RECORDS = 'docs/decisions/014-records-have-readers.md';
const LOOSEN = 'docs/decisions/015-tightening-and-loosening-a-governance-change.md';
const BOARD = 'docs/decisions/016-the-board-is-a-projection-of-the-repo.md';
const SECOND = 'docs/decisions/017-a-second-item-never-a-third.md';
const OPEN_PR = '.claude/skills/open-pr/SKILL.md';

/** Where each record must be pointed at, so the reasoning has a way in from the file a reader is in. */
const POINTERS: Array<[string, string]> = [
  [FREEZE, 'CLAUDE.md'],
  [FREEZE, 'docs/ROUTINE-PROMPT.md'],
  [FREEZE, 'docs/WATCHDOG-PROMPT.md'],
  [FREEZE, '.claude/rules/governance.md'],
  [BLOCK, 'CLAUDE.md'],
  [BLOCK, '.claude/rules/governance.md'],
  [RECORDS, 'CLAUDE.md'],
  [RECORDS, 'docs/ROUTINE-PROMPT.md'],
  [RECORDS, '.claude/rules/governance.md'],
  [LOOSEN, '.claude/rules/governance.md'],
  [LOOSEN, OPEN_PR],
  [BOARD, 'docs/ROUTINE-PROMPT.md'],
  [SECOND, 'docs/ROUTINE-PROMPT.md'],
];

describe('the freeze, review-block and records-have-readers rationale lives in one ADR each (#322)', () => {
  it.each([FREEZE, BLOCK, RECORDS, LOOSEN, BOARD, SECOND])('%s exists in the house shape', (adr) => {
    expect(existsSync(join(root, adr)), `${adr} is missing`).toBe(true);
    const text = read(adr);
    for (const heading of ['**Status:**', '## Context', '## Decision', '## Considered and dropped', '## Consequences']) {
      expect(text, `${adr} lacks ${heading}`).toContain(heading);
    }
  });

  it.each(POINTERS)('%s is pointed at from %s', (adr, file) => {
    expect(read(file), `${file} must carry the pointer to ${adr}`).toContain(adr);
  });

  it('the reason for a draft-and-comment block is the ADR\'s, not restated in CLAUDE.md', () => {
    expect(read('CLAUDE.md')).not.toMatch(/since GitHub refuses a formal CHANGES_REQUESTED review/);
    expect(read(BLOCK), 'the ADR holds the reason').toMatch(/GitHub refuses a formal `CHANGES_REQUESTED` review/);
    // The mechanism a reviewer performs stays inline where the run reads it (#637).
    expect(flat('CLAUDE.md')).toContain('the reviewer who set it clears it with `REVIEW: CLEARED` and "Ready for review"');
  });

  it('records-have-readers is no longer a verbatim copy; each file keeps its routing inline (#638)', () => {
    expect(read('CLAUDE.md'), 'the history sentence moved to the ADR').not.toContain('The test for any record is');
    expect(read('docs/ROUTINE-PROMPT.md')).not.toContain('twelve-plus writers');
    for (const f of ['CLAUDE.md', 'docs/ROUTINE-PROMPT.md'] as const) {
      expect(read(f), `${f} keeps the question a run asks`).toContain('who opens this, and when?');
      expect(read(f), `${f} keeps the heartbeat routing`).toContain('overwritten every run, never appended');
    }
    expect(read('.claude/rules/governance.md'), 'the debt line is retired')
      .not.toContain('Two paragraphs are still copied');
  });

  it('the freeze history is gone from the files that restated it, the lift stays inline (#636)', () => {
    expect(read('.claude/rules/governance.md')).not.toContain('refactors move code around');
    expect(read('docs/WATCHDOG-PROMPT.md')).not.toContain('instead of blocking them');
    expect(read('CLAUDE.md')).toMatch(/one-time event, not a condition that can re-arm/);
    expect(read('docs/ROUTINE-PROMPT.md')).toMatch(/one-time event, not a condition that can re-arm/);
  });

  it('tightening versus loosening: the reasoning is the ADR\'s, the classification stays in the skill (#639)', () => {
    const skill = flat(OPEN_PR);
    expect(skill).not.toContain('PR #96 sat open all day');
    expect(skill).not.toContain('The point is asymmetry');
    for (const kept of ['Judge the constraint, not the signal', 'cheapest cover story', 'disagreeing with the label', 'Never routine-merged, however obviously right it looks', '`loosening` label']) {
      expect(skill, `open-pr §6 keeps "${kept}"`).toContain(kept);
    }
    expect(read(LOOSEN), 'the rejected alternative is recorded').toMatch(/Let `review-gate` enforce/);
  });

  it('the board: the reason is the ADR\'s, "never the card" stays inline (#640)', () => {
    expect(flat('CLAUDE.md')).toContain('to move a card, change the label or the PR, never the card');
    expect(flat('docs/ROUTINE-PROMPT.md')).toContain('No run syncs or reads it');
    expect(read(BOARD)).toMatch(/GraphQL-only/);
  });

  it('the second item: STEP 3 keeps all four conditions verbatim, the rationale moved (#641)', () => {
    const step = flat('docs/ROUTINE-PROMPT.md');
    for (const c of [
      '1. **At most three pull requests are waiting for review**',
      '2. **Time is left in the run.**',
      '3. **The second item\'s file scope is disjoint from the first\'s.**',
      '4. **The first item actually finished.**',
      'never one pull request closing two issues',
    ]) expect(step, `STEP 3 keeps "${c}"`).toContain(c);
    expect(step).not.toContain('the bottleneck here is review and conflict');
    expect(step).not.toContain('reviewable, mergeable and blockable independently');
    expect(read(SECOND)).toMatch(/review and conflict/);
  });

  it('accuracy fixes: #88 is the CI re-run, the freeze is not "recorded on #36", the verbatim-copy line is true', () => {
    expect(read(BLOCK)).not.toMatch(/\(#88\)\. `review-gate` goes red/);
    expect(read(BLOCK)).toContain('#88: an undraft fired no CI run');
    expect(read(FREEZE)).not.toContain('recorded on issue #36');
    expect(read(FREEZE)).toContain('ba2c1a7d');
    expect(read('docs/ROUTINE-PROMPT.md')).not.toContain('issue #36');
    expect(read('.claude/rules/governance.md')).toContain('one sentence still is, the freeze lift');
  });
});
