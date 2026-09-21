import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AHEAD_TOLERANCE_MIN, check, driftMinutes, readStamp, stamp } from '../../scripts/pulse-stamp.mjs';

/**
 * THE PULSE STAMP (#439) — the timestamp both routines write and every staleness check in the repo reads.
 *
 * A reviewer run stamped a time 37 minutes into the future, and nothing noticed, because `now - stamp` is
 * computed against the number the writing run chose. So the rails below are written in the two directions
 * that matter rather than around the happy path: a stamp ahead of its own write must be a finding, and the
 * ordinary small lag of an honest one must not.
 *
 * `scripts/pulse-stamp.mjs` has the incident and the design; `docs/decisions/007-a-pulse-stamp-is-read-from-the-clock.md` has the alternatives dropped.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));
const script = join(root, 'scripts/pulse-stamp.mjs');
/** The real body of the reviewer pulse at the moment #439 was filed, and the edit GitHub recorded for it. */
const INCIDENT_BODY = '2026-09-21T11:40Z — IN PROGRESS: reviewing #415\n\n- #433: blocked\n- #415: in progress\n';
const INCIDENT_WRITE = '2026-09-21T11:02:55Z';

describe('the stamp a run writes', () => {
  it('is minute-truncated UTC, with no seconds to invite false precision', () => {
    expect(stamp(Date.UTC(2026, 8, 21, 12, 39, 58))).toBe('2026-09-21T12:39Z');
    expect(stamp(new Date('2026-01-02T03:04:00Z'))).toBe('2026-01-02T03:04Z');
  });

  it('comes from the clock, not from an argument, when called the way a run calls it', () => {
    // The write half's whole value: the default path has no way to produce a time that is not now. A stamp
    // more than a minute from the test's own clock would mean it came from somewhere else.
    expect(Math.abs(readStamp(stamp())! - Date.now())).toBeLessThan(61_000);
  });
});

describe('reading the stamp out of a pulse body', () => {
  it('takes the one the body opens with', () => {
    expect(readStamp(INCIDENT_BODY)).toBe(Date.UTC(2026, 8, 21, 11, 40));
    expect(readStamp('2026-09-07T18:00Z — clean · nightly 1 run ok · 3 PRs open')).toBe(Date.UTC(2026, 8, 7, 18, 0));
  });

  it('refuses a body that does not open with one — an unparseable pulse is stale, never a pass', () => {
    expect(readStamp('')).toBeNull();
    expect(readStamp('IN PROGRESS: reviewing #415\n2026-09-21T11:40Z')).toBeNull();   // not at the start
    expect(readStamp('2026-09-21 11:40Z — no T')).toBeNull();
    expect(readStamp('2026-09-21T11:40:12Z — seconds are not this format')).toBeNull();
  });

  it('refuses a nonsense date rather than letting Date.UTC roll it over into a real instant', () => {
    // Date.UTC(2026, 12, …) is January 2027 and Date.UTC(…, 32) is the 1st of the next month. Either would
    // parse into a comparable number and be checked as though it were the time somebody meant.
    expect(readStamp('2026-13-01T00:00Z — thirteenth month')).toBeNull();
    expect(readStamp('2026-09-31T00:00Z — September has thirty days')).toBeNull();
    expect(readStamp('2026-09-21T24:00Z — no such hour')).toBeNull();
  });
});

describe('the drift a stamp carries against the write that landed it', () => {
  it('is negative when the clock was read and the write landed after it — what correct looks like', () => {
    // Minute truncation alone puts an honest stamp up to a minute behind, so this must never read as a fault.
    expect(driftMinutes('2026-09-21T12:39Z — developed #439', '2026-09-21T12:39:58Z')).toBeCloseTo(-0.97, 1);
    expect(check('2026-09-21T12:39Z — developed #439', '2026-09-21T12:39:58Z').ok).toBe(true);
    expect(check('2026-09-21T10:42Z — IN PROGRESS: fixing #331', '2026-09-21T10:44:44Z').ok).toBe(true);
  });

  it('is the finding when the stamp runs ahead of its own write (#439)', () => {
    expect(driftMinutes(INCIDENT_BODY, INCIDENT_WRITE)).toBeCloseTo(37.08, 1);
    const v = check(INCIDENT_BODY, INCIDENT_WRITE);
    expect(v.ok).toBe(false);
    expect(v.drift).toBeCloseTo(37.1, 1);
    expect(v.reason).toMatch(/ahead of the write/);
  });

  it('forgives clock skew between two hosts, and only that', () => {
    const at = (min: number) => check(stamp(Date.UTC(2026, 8, 21, 12, 0) + min * 60_000), '2026-09-21T12:00:00Z');
    expect(at(AHEAD_TOLERANCE_MIN).ok, 'the tolerance itself is inside it').toBe(true);
    expect(at(AHEAD_TOLERANCE_MIN + 1).ok, 'a minute past it is not').toBe(false);
    expect(AHEAD_TOLERANCE_MIN, 'a tolerance this wide would have forgiven the 37-minute drift').toBeLessThan(10);
  });

  it('calls an unreadable stamp or an unreadable write time a finding, not an ok', () => {
    expect(check('nothing here', '2026-09-21T12:00:00Z')).toMatchObject({ ok: false, drift: null });
    expect(check('2026-09-21T12:00Z — fine', 'not a date')).toMatchObject({ ok: false, drift: null });
  });
});

describe('the CLI both routines and the watchdog are pointed at', () => {
  const run = (...args: string[]) => execFileSync('node', [script, ...args], { encoding: 'utf8' });

  it('prints a stamp of now with no arguments', () => {
    const out = run().trim();
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/);
    expect(Math.abs(readStamp(out)! - Date.now())).toBeLessThan(61_000);
  });

  it('reports a finding and exits non-zero, so a shell can branch on it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pulse-'));
    try {
      const file = join(dir, 'body.md');
      writeFileSync(file, INCIDENT_BODY);
      expect(run('--check', file, '2026-09-21T11:39:00Z')).toMatch(/^ok — /);
      let code = 0;
      try { run('--check', file, INCIDENT_WRITE); } catch (e) { code = (e as { status: number }).status; }
      expect(code, 'a finding must fail the command, not only print').toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/**
 * The prompts are where the rule actually binds: a script nobody is told to run changes nothing. This is a
 * pointer rail, not a wording pin — it asks that each file that writes or reads a pulse names the script,
 * and leaves the prose free to shrink. `tests/unit/instructions.test.ts` then proves that path resolves.
 *
 * Prove it red: drop the `scripts/pulse-stamp.mjs` mention from any one of the three.
 */
describe('every routine that writes or reads a pulse is pointed at the one home (#439)', () => {
  it.each(['docs/ROUTINE-PROMPT.md', 'docs/REVIEWER-PROMPT.md', 'docs/WATCHDOG-PROMPT.md'])(
    '%s names scripts/pulse-stamp.mjs', (file) => {
      expect(readFileSync(join(root, file), 'utf8')).toContain('scripts/pulse-stamp.mjs');
    });

  // The two halves are no use apart, the way #314's stamp and its watchdog check are no use apart: a stamp
  // read from the clock that nobody verifies is a convention, and a verifier nobody is told to run is dead
  // prose. So the watchdog is held to the *invocation*, not only to the path — the three prompts above would
  // all pass on a bare mention in a sentence.
  it('and the watchdog is told to run the check half, on every pulse it reads', () => {
    const w = readFileSync(join(root, 'docs/WATCHDOG-PROMPT.md'), 'utf8');
    expect(w, 'check 3 must run the comparison, not merely know the script exists')
      .toContain('node scripts/pulse-stamp.mjs --check');
    expect(w, 'against the field the writing run cannot author for itself').toContain('updated_at');
    for (const pulse of ['routine: heartbeat', 'reviewer: heartbeat', 'board: heartbeat']) {
      expect(w, `${pulse} must be one of the pulses the check covers`).toContain(pulse);
    }
  });
});
