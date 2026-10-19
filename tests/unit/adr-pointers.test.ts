import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * #636, #637, #638 (#322 rows 1-3): the rationale for the freeze, the review block and records-have-readers
 * lives in one ADR each, and the files that used to restate it carry a pointer. The routing test is that a run
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
];

describe('the freeze, review-block and records-have-readers rationale lives in one ADR each (#322)', () => {
  it.each([FREEZE, BLOCK, RECORDS])('%s exists in the house shape', (adr) => {
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
});
