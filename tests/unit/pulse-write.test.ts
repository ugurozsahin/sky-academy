import { describe, expect, it } from 'vitest';
import { check, heartbeatAppend, requiredLines } from '../../.claude/hooks/github-write-guard.mjs';

/**
 * #679 (#429 items 1 and 2). `pulseWrite` once returned on a title match before it looked at the number, so
 * `reviewer: heartbeat` sent with issue_number 62 was DENY before #417 and ALLOW after it: both `requiredLines`
 * obligations dropped for that shape. The number is the belt, and is tested first.
 *
 * Prove it red: move the `ROUTINE_HEARTBEAT` line in `pulseWrite` below the title loop, or change
 * `heartbeatAppend`'s message from `"${pulse}"` to `"${HEARTBEAT_TITLE}"`.
 */
const oneStamp = '2026-09-21T01:00Z — IN PROGRESS: x';
const mixed = { method: 'update', issue_number: 62, title: 'reviewer: heartbeat', body: oneStamp };
const appended = '2026-09-21T01:00Z — a\n2026-09-21T02:00Z — b';

describe("the developer pulse's number beats a reviewer title (#679)", () => {
  it("a title does not take #62 out of the developer pulse's two obligations", () => {
    expect(requiredLines(mixed)).toMatch(/must carry/);
    expect(check(mixed), 'through check() too').toMatch(/must carry/);
    expect(check({ ...mixed, issue_number: '62' }), 'a numeric string is the same issue').toMatch(/must carry/);
  });

  it('a body carrying both lines is still allowed, and another issue with the reviewer title is the reviewer pulse', () => {
    expect(requiredLines({ ...mixed, body: `${oneStamp}\n- second item: no\n- query top pick: #1 — taken` })).toBeNull();
    expect(requiredLines({ ...mixed, issue_number: 4242 }), 'no developer lines demanded of the reviewer').toBeNull();
  });

  it('the refusal names the pulse it refused, so a reviewer is never sent to fix the other routine\'s issue', () => {
    expect(heartbeatAppend({ method: 'update', issue_number: 4242, title: 'reviewer: heartbeat', body: appended }))
      .toContain('"reviewer: heartbeat"');
    expect(heartbeatAppend({ method: 'update', issue_number: 62, body: appended })).toContain('"routine: heartbeat"');
  });
});
