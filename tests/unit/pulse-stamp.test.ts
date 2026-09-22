import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AHEAD_TOLERANCE_MIN, CANNOT_CHECK, FINDING, OK, check, driftMinutes, readStamp, readWrite, stamp }
  from '../../scripts/pulse-stamp.mjs';

/**
 * THE PULSE STAMP (#439) — the timestamp both routines write and every staleness check in the repo reads.
 *
 * A reviewer run stamped a time 37 minutes into the future, and nothing noticed, because `now - stamp` is
 * computed against the number the writing run chose. So the rails below are written in the two directions
 * that matter rather than around the happy path: a stamp ahead of its own write must be a finding, and the
 * ordinary small lag of an honest one must not.
 *
 * Four of them are written the way the PR #450 review proved they had to be, by mutation rather than by
 * reading: a probe built FROM the constant it guards moves with it and can never fail; `Math.abs` on a drift
 * throws away the only direction that matters; and a whole-file `toContain` against a document that already
 * held the word certifies nothing. Each is noted at the assertion that now holds it.
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
    // UTC by construction, not by the runner's accident: local formatting passes the two above under an
    // unset TZ and fails only under something like `TZ=Asia/Tokyo`, which CI does not set (#450 review).
    expect(stamp(0), 'the epoch is the epoch in every zone').toBe('1970-01-01T00:00Z');
  });

  it('comes from the clock, and never runs ahead of it', () => {
    // NOT `Math.abs(…) < 61_000`: that admitted a stamp 55 s into the FUTURE — the exact direction of #439 —
    // inside the function whose stated purpose is that a run cannot produce a time that is not now. Minute
    // truncation guarantees an honest stamp is at or behind now, so the sign is the assertion (#450 review B2).
    const now = Date.now();
    const read = readStamp(stamp())!;
    expect(read, 'a stamp of now must never be in the future').toBeLessThanOrEqual(now);
    expect(read, 'and truncation alone can put it at most one minute behind').toBeGreaterThan(now - 61_000);
  });
});

describe('reading the stamp out of a pulse body', () => {
  it('takes the one the body opens with', () => {
    expect(readStamp(INCIDENT_BODY)).toBe(Date.UTC(2026, 8, 21, 11, 40));
    expect(readStamp('2026-09-07T18:00Z — clean · nightly 1 run ok · 3 PRs open')).toBe(Date.UTC(2026, 8, 7, 18, 0));
    expect(readStamp('﻿2026-09-07T18:00Z — a body that opens with a byte-order mark'),
      'the BOM strip is load-bearing or it should not be there').toBe(Date.UTC(2026, 8, 7, 18, 0));
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

/**
 * The write time is the half of the comparison the writing run cannot author, so it is the half worth being
 * strict about. Every case below was measured against the first version of this file, where each produced a
 * confident wrong answer rather than a refusal (#450 review B3).
 */
describe('reading the write time GitHub recorded', () => {
  it('takes an instant with an explicit zone, a Date or an epoch', () => {
    expect(readWrite('2026-09-21T11:02:55Z')).toBe(Date.parse('2026-09-21T11:02:55Z'));
    expect(readWrite('2026-09-21T11:02:55+02:00')).toBe(Date.parse('2026-09-21T11:02:55+02:00'));
    expect(readWrite(new Date('2026-09-21T11:02:55Z'))).toBe(Date.parse('2026-09-21T11:02:55Z'));
    expect(readWrite(0)).toBe(0);
  });

  it.each([
    ['2026-09-21T11:02:55', 'a zoneless string is read in the runner\'s local zone — 240 min of phantom drift under TZ=America/New_York'],
    ['', 'an unquoted empty shell variable'],
    ['not a date', 'a mistyped argument'],
    [null, 'new Date(null).getTime() is 0, not NaN — this read as 29833200 min ahead'],
    [undefined, 'a missing argument'],
    [false, 'epoch 0 again, by another route'],
    [NaN, 'not a time'],
    [Infinity, 'not a time either'],
  ] as [unknown, string][])('refuses %p — %s', (value) => {
    expect(readWrite(value as string)).toBeNull();
  });
});

describe('the drift a stamp carries against the write that landed it', () => {
  it('is negative when the clock was read and the write landed after it — what correct looks like', () => {
    // Minute truncation alone puts an honest stamp up to a minute behind, so this must never read as a fault.
    expect(driftMinutes('2026-09-21T12:39Z — developed #439', '2026-09-21T12:39:58Z')).toBeCloseTo(-0.97, 2);
    expect(check('2026-09-21T12:39Z — developed #439', '2026-09-21T12:39:58Z').code).toBe(OK);
    expect(check('2026-09-21T10:42Z — IN PROGRESS: fixing #331', '2026-09-21T10:44:44Z').code).toBe(OK);
  });

  it('is the finding when the stamp runs ahead of its own write (#439)', () => {
    expect(driftMinutes(INCIDENT_BODY, INCIDENT_WRITE)).toBeCloseTo(37.0833, 3);
    const v = check(INCIDENT_BODY, INCIDENT_WRITE);
    expect(v.code).toBe(FINDING);
    expect(v.drift, 'reported to one decimal place, and pinned so the rounding cannot vanish').toBe(37.1);
    expect(v.reason).toMatch(/37\.1 min ahead of the write/);
  });

  it('allows exactly two minutes of clock skew, and not a minute more', () => {
    // Literals, not `at(AHEAD_TOLERANCE_MIN)`: probes built from the constant they guard move with it, so
    // widening the tolerance 2 → 9 left all fifteen tests green (#450 review B1). The value itself is pinned
    // below — it is a tolerance, and there is no version of this check that wants a looser one by accident.
    const at = (min: number) => check(stamp(Date.UTC(2026, 8, 21, 12, 0) + min * 60_000), '2026-09-21T12:00:00Z');
    expect(AHEAD_TOLERANCE_MIN, 'moving this is a decision, and belongs in a pull request that argues it').toBe(2);
    expect(at(2).code, 'two minutes of skew between two hosts is ordinary').toBe(OK);
    expect(at(3).code, 'three is not').toBe(FINDING);
    expect(at(37).code, "and #439's own drift must never be inside it").toBe(FINDING);
  });

  it('decides on the number it prints, so the verdict and the message cannot disagree', () => {
    // Deciding on the unrounded drift produced `FINDING — 2 min ahead` next to a rule saying 2 is allowed.
    const noon = Date.UTC(2026, 8, 21, 12, 0);
    // The stamp is fixed at noon; the write is pushed back by `secs`, so the drift is exactly that far ahead.
    const at = (secs: number) => check(stamp(noon), new Date(noon - secs * 1000).toISOString());
    const just = at(121);            // 2.017 min ahead: rounds to 2.0, which the rule allows
    expect(just.drift).toBe(2);
    expect(just.code).toBe(OK);
    expect(just.reason).toContain('inside the 2 min allowed');
    const over = at(125);            // 2.083 min ahead: rounds to 2.1, which it does not
    expect(over.drift).toBe(2.1);
    expect(over.code).toBe(FINDING);
  });

  it('stops calling a lag "as it should be" once it is longer than a run', () => {
    const near = check('2026-09-21T11:30Z — developed #439', '2026-09-21T12:00:00Z');
    expect(near.code).toBe(OK);
    expect(near.reason).toContain('as it should be');
    const day = check('2026-09-20T12:00Z — developed #439', '2026-09-21T12:00:00Z');
    expect(day.code, 'behind is deliberately unbounded — this is wording, not a verdict').toBe(OK);
    expect(day.reason).toContain("further behind than a run's own length explains");
  });
});

/**
 * The three codes exist because a tool that blames the pulse for its own bad arguments manufactures a
 * `watchdog` issue against a healthy routine — and `docs/ROUTINE-PROMPT.md` STEP 1 makes an open `watchdog`
 * issue the next developer run's first work, so that false finding costs a whole run (#450 review B3).
 */
describe('a fault in the call is never reported as a verdict about the pulse', () => {
  it('calls an unreadable stamp a finding — that one really is about the pulse', () => {
    const v = check('nothing here', '2026-09-21T12:00:00Z');
    expect(v).toMatchObject({ code: FINDING, drift: null });
    expect(v.reason, 'and it must name the body, not the write time').toMatch(/body opens with no readable stamp/);
  });

  it('calls an unreadable write time uncheckable, and says so about the write time', () => {
    for (const bad of ['', 'not a date', null, undefined]) {
      const v = check('2026-09-21T12:00Z — a perfectly healthy pulse', bad as string);
      expect(v, `${JSON.stringify(bad)} must not become a finding against a healthy pulse`)
        .toMatchObject({ code: CANNOT_CHECK, drift: null });
      expect(v.reason).toMatch(/write time/);
      expect(v.reason, 'and must not blame the body').not.toMatch(/body/);
    }
  });
});

describe('the CLI both routines and the watchdog are pointed at', () => {
  const run = (...args: string[]) => execFileSync('node', [script, ...args], { encoding: 'utf8' });
  /** The exit code and stdout of a run that may fail, so a rail can assert the code rather than the throw. */
  const exit = (...args: string[]): { code: number; out: string } => {
    try {
      return { code: 0, out: run(...args) };
    } catch (e) {
      const err = e as { status: number; stdout: string };
      return { code: err.status, out: err.stdout };
    }
  };

  it('prints a stamp of now with no arguments, and never one in the future', () => {
    const now = Date.now();
    const out = run().trim();
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/);
    expect(readStamp(out)!).toBeLessThanOrEqual(now + 1_000);
    expect(readStamp(out)!).toBeGreaterThan(now - 61_000);
  });

  it('exits 0 on a healthy pulse and 1 on a finding, so a shell can branch on it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pulse-'));
    try {
      const file = join(dir, 'body.md');
      writeFileSync(file, INCIDENT_BODY);
      const ok = exit('--check', file, '2026-09-21T11:39:00Z');
      expect(ok.code).toBe(OK);
      expect(ok.out).toMatch(/^ok — /);
      const bad = exit('--check', file, INCIDENT_WRITE);
      expect(bad.code, 'a finding must fail the command, not only print').toBe(FINDING);
      expect(bad.out).toMatch(/^FINDING — /);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /**
   * Every case here exited 1 or 0 before the #450 review: a missing argument and a missing file were
   * indistinguishable from a real finding, and `-check` — one character out, or the flag lost when a prompt
   * line is reflowed — printed a plausible, correctly formatted stamp and exited 0, never comparing anything.
   */
  it('exits 2 and says nothing about the pulse when the call itself is wrong', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pulse-'));
    try {
      const file = join(dir, 'body.md');
      writeFileSync(file, '2026-09-21T12:00Z — a perfectly healthy pulse\n');
      for (const args of [
        ['--check', file],                            // the write time lost to an unquoted empty variable
        ['--check', file, ''],                        // …or passed as an empty string
        ['--check', file, 'not a date'],
        ['--check', join(dir, 'gone.md'), '2026-09-21T12:00:00Z'],   // an ENOENT stack trace also exited 1
        ['--check'],
        ['--check', file, '2026-09-21T12:00:00Z', 'extra'],
        ['-check', file, '2026-09-21T12:00:00Z'],     // the silent one: it printed a stamp and exited 0
        ['--chek', file, '2026-09-21T12:00:00Z'],
        ['--help'],
      ]) {
        const r = exit(...args);
        expect(r.code, `${args.join(' ')} must report a fault in the call, not a verdict`).toBe(CANNOT_CHECK);
        expect(r.out, 'and must print nothing to stdout that could be read as a stamp or a verdict').toBe('');
      }
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
  //
  // Scoped to the paragraph carrying that invocation, not the file (#450 review B4). Whole-file `toContain`
  // certified nothing: `docs/WATCHDOG-PROMPT.md` already held `updated_at` and all three pulse names before
  // this check existed, so deleting the names from the new paragraph left every assertion green. These
  // prompts are trimmed to pay byte budgets constantly, which makes that a live regression path.
  it('and the watchdog is told to run the check half, on every pulse it reads', () => {
    const w = readFileSync(join(root, 'docs/WATCHDOG-PROMPT.md'), 'utf8');
    const para = w.split(/\n\s*\n/).filter((p) => p.includes('node scripts/pulse-stamp.mjs --check'));
    expect(para, 'exactly one paragraph must carry the invocation, or this rail is reading the wrong text')
      .toHaveLength(1);
    const text = para[0];
    expect(text, 'against the field the writing run cannot author for itself').toContain('updated_at');
    // `refiner: heartbeat` joined the list with #512. It is the one pulse whose routine writes no IN PROGRESS
    // stamp, so a forward-dated stamp there is uncheckable against anything but `updated_at`.
    for (const pulse of ['routine: heartbeat', 'reviewer: heartbeat', 'board: heartbeat', 'refiner: heartbeat']) {
      expect(text, `${pulse} must be one of the pulses that paragraph covers`).toContain(pulse);
    }
    expect(text, 'and it must say what a non-zero exit means, or exit 2 reads as a finding')
      .toMatch(/exit(s|ing)? 2|2 means/);
  });
});
