import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The pulse stamp — one home for the timestamp both routines write and the watchdog reads (#439).
 *
 * Every staleness check in this repo is the same arithmetic: `now - the timestamp written inside the pulse
 * body`. `docs/ROUTINE-PROMPT.md` STEP 1 does it, `docs/REVIEWER-PROMPT.md` STEP 1 does it, and
 * `docs/WATCHDOG-PROMPT.md` check 3 does it three times over — for a stale snapshot, for an `IN PROGRESS`
 * stamp, and for the board pulse. None of them consults GitHub's own `updated_at`, so **the stamp is trusted
 * absolutely and checked nowhere**, and a run that writes the wrong one is believed.
 *
 * On 2026-09-21 a reviewer run stamped `11:40Z` on an edit GitHub recorded at `11:02:55Z` — 37 minutes into
 * the future — and did it again at 12:47Z against a real 12:38Z. The developer pulse's gap the same hour was
 * 2-3 minutes in the *other* direction, which is what the gap is supposed to look like: the clock is read,
 * then the write lands a moment later. A stamp that runs ahead makes `now - stamp` artificially small, or
 * negative, however long the run actually ran or however long ago it died — so a dead run reads as freshly
 * alive. That is this project's signature failure (an absence read as a pass) displaced onto the pulse's own
 * accuracy rather than its presence.
 *
 * Two halves, deliberately in one file so they cannot come to disagree about the format:
 *
 *   `stamp()`  — the write half. Its only source of a time is the system clock, so a run that calls it
 *                cannot estimate one. That is the whole point: `2026-09-21T12:39Z` is cheap to *type* from
 *                memory of roughly when the run began, and impossible to type wrong from `date -u`.
 *   `check()`  — the read half, the comparison that actually caught this: the stamp inside the body against
 *                the time GitHub recorded for that edit. Ahead of its own write is the finding.
 *
 * `docs/decisions/007-a-pulse-stamp-is-read-from-the-clock.md` has why, and the alternatives dropped.
 */

/**
 * Minute-truncated UTC — the format every pulse body opens with, and the only one written here.
 * Seconds are dropped on purpose: the checks that read it work in hours, and a seconds field would invite
 * exactly the false precision this file exists to stop.
 */
export const stamp = (at = new Date()) => `${new Date(at).toISOString().slice(0, 16)}Z`;

/**
 * The stamp a pulse body opens with. Anchored at the very start (`^`) because that is where every reader
 * looks for it — a timestamp further down is a second summary line, which is an append, not this stamp.
 */
export const STAMP_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})Z/;

/**
 * @param {string} body a pulse issue's body
 * @returns {number|null} the epoch ms the body's opening stamp names, or `null` if it opens with no stamp
 *   — which the watchdog already treats as stale rather than as a pulse.
 */
export function readStamp(body) {
  const m = STAMP_RE.exec((body || '').replace(/^﻿/, ''));
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const ms = Date.UTC(y, mo - 1, d, h, mi);
  // Date.UTC rolls a 13th month or a 32nd day over silently, so a nonsense stamp would parse into a real
  // instant and be compared as though it were one. Round-tripping is the cheapest way to refuse it.
  return stamp(ms) === m[0] ? ms : null;
}

/**
 * The write time, strictly. GitHub's `updated_at` is always a full ISO instant ending in `Z`, so anything
 * else reaching here is a mangled argument rather than a fact about the pulse — and the strictness is load
 * bearing twice over. `new Date('2026-09-21T13:00:00')` (the same string with the `Z` lost) is read in the
 * runner's LOCAL zone, which under `TZ=America/New_York` turned a healthy pulse into a confident
 * `240 min behind`; and `new Date(null).getTime()` is 0, not `NaN`, so a missing argument became a stamp
 * "29833200 min ahead" of the epoch. Both are the tool being wrong about itself while sounding certain.
 *
 * @param {string|number|Date} writtenAt GitHub's `updated_at` for that edit — the one field the writing run
 *   cannot author for itself, which is what makes this a check rather than a restatement.
 * @returns {number|null} epoch ms, or `null` when the argument is not a timestamp this may rely on.
 */
export function readWrite(writtenAt) {
  if (writtenAt instanceof Date) return Number.isNaN(writtenAt.getTime()) ? null : writtenAt.getTime();
  if (typeof writtenAt === 'number') return Number.isFinite(writtenAt) ? writtenAt : null;
  // An explicit zone required: `Z`, or `+HH:MM`/`-HH:MM`. A zoneless string is refused rather than guessed.
  if (typeof writtenAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/.test(writtenAt.trim())) return null;
  const ms = Date.parse(writtenAt.trim());
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Minutes the stamp runs **ahead of** the write that carried it. Negative is the healthy direction: the
 * clock was read, then the write landed. Minute truncation alone puts an honest stamp up to one minute
 * behind, so a small negative number is what correct looks like, never a problem.
 *
 * It returns one `null` for two unrelated causes, which is exactly why it is not what the CLI reports on:
 * `check()` below asks the two questions separately, because "this pulse is unreadable" and "you passed me
 * a bad write time" must not come out of the tool as the same sentence.
 *
 * @param {string} body the pulse body as it was written
 * @param {string|number|Date} writtenAt GitHub's `updated_at` for that edit
 * @returns {number|null} signed minutes, unrounded, or `null` when either side is unreadable.
 */
export function driftMinutes(body, writtenAt) {
  const s = readStamp(body);
  const w = readWrite(writtenAt);
  return s === null || w === null ? null : (s - w) / 60_000;
}

/**
 * How far ahead of its own write a stamp may sit before it is a finding. Not zero: the session host's clock
 * and GitHub's are two clocks, and a minute or two of skew between them is ordinary and says nothing about
 * how the stamp was produced. The drift this catches was 37 minutes.
 *
 * `tests/unit/pulse-stamp.test.ts` pins this to its exact value. It is a tolerance, not a budget that may
 * drift upward quietly: widening it is how a real drift would be let through without a line of the check
 * changing, so it moves only in a pull request that argues for the new number.
 */
export const AHEAD_TOLERANCE_MIN = 2;

/** The three verdicts, and the process exit codes the CLI uses for them. Nothing else exits non-zero. */
export const OK = 0;             // the stamp and the write agree
export const FINDING = 1;        // something is wrong with the PULSE — worth an issue
export const CANNOT_CHECK = 2;   // something is wrong with the CALL — the check was never made

/**
 * @param {string} body the pulse body
 * @param {string|number|Date} writtenAt GitHub's `updated_at` for that edit
 * @returns {{ code: 0|1|2, ok: boolean, drift: number|null, reason: string }}
 *
 * The three codes are the point. A tool that says "FINDING" when its own argument was missing manufactures
 * an issue against a healthy routine — and `docs/ROUTINE-PROMPT.md` STEP 1 makes an open `watchdog` issue
 * the next developer run's first work, so that false finding costs a run. `CANNOT_CHECK` therefore never
 * reports on the pulse at all. A body with no readable stamp *is* a finding, for the reason
 * `docs/WATCHDOG-PROMPT.md` already gives: an unparseable pulse is a stale one, never a pass.
 */
export function check(body, writtenAt) {
  const w = readWrite(writtenAt);
  if (w === null) {
    return { code: CANNOT_CHECK, ok: false, drift: null, reason: 'the write time is not an ISO instant with '
      + "an explicit zone (GitHub's `updated_at` always ends in Z) — nothing was checked about the pulse" };
  }
  const s = readStamp(body);
  if (s === null) return { code: FINDING, ok: false, drift: null, reason: 'the body opens with no readable stamp' };
  // Rounded once, here, and every decision below made on the rounded number: a verdict computed from more
  // precision than the message shows produces "FINDING — 2 min ahead" beside a rule saying 2 min is allowed.
  const drift = Math.round(((s - w) / 60_000) * 10) / 10;
  if (drift > AHEAD_TOLERANCE_MIN) {
    return { code: FINDING, ok: false, drift, reason: `the stamp is ${drift} min ahead of the write GitHub `
      + 'recorded — it was not read from a clock at write time, so every staleness check reading it is short by that much' };
  }
  if (drift > 0) {
    return { code: OK, ok: true, drift, reason: `${drift} min ahead, inside the ${AHEAD_TOLERANCE_MIN} min allowed for clock skew` };
  }
  // Behind is the benign direction and deliberately unbounded (a STEP 1 stamp says when the run STARTED, so
  // by STEP 5 it may honestly be three quarters of an hour old). Past that it is still not a finding, but it
  // is no longer what a run's own length explains, so the wording stops blessing it.
  const behind = Math.abs(drift);
  return { code: OK, ok: true, drift,
    reason: behind > 90 ? `${behind} min behind its write — further behind than a run's own length explains`
      : `${behind} min behind its write, as it should be` };
}

// CLI:
//   `node scripts/pulse-stamp.mjs`                       prints the stamp to paste into a pulse body
//   `node scripts/pulse-stamp.mjs --check <file> <when>` compares a body against GitHub's `updated_at`
//
// Exit 0 ok, 1 a finding about the pulse, 2 the check could not be made. The dispatch is exhaustive on
// purpose: it used to fall through to printing a stamp, so one character out (`-check`) printed a plausible,
// correctly formatted timestamp and exited 0 — the drifting pulse never compared, and the output of a
// mistake indistinguishable from the output of a success. That is the failure this whole file exists to
// stop, inside the file itself.
//
// Import-safe: it runs only when this file is the entry point, so the unit rails import it untouched.
//
// #457: `resolve()` normalises `.`/`..` but does not resolve symlinks, while `import.meta.url` is always the
// realpath — so a script reached through a symlinked directory (a Mac Desktop alias, `/tmp` on macOS being
// `/private/tmp`, a `node_modules/.bin` shim) compared unequal here, the whole CLI block was skipped, and
// Node exited 0 having done nothing: `--check` printed no verdict, the no-args form printed no stamp. Both
// look like a pass. `realpathSync` resolves both sides properly; the `try`/`catch` falls back to the original
// comparison only for ENOENT — a missing `argv[1]` must never throw here, and that is the one way this call
// can legitimately fail. Anything else `realpathSync` throws (EACCES on some ancestor directory, ELOOP) is
// left to propagate rather than swallowed into the same silent "not the entry point" verdict this fix exists
// to close: a caught-and-ignored EACCES here would reopen the exact bug, just with a different trigger.
const sameFile = (a, b) => {
  try { return realpathSync(a) === realpathSync(b); } catch (e) {
    if (e.code === 'ENOENT') return resolve(a) === b;
    throw e;
  }
};
if (process.argv[1] && sameFile(process.argv[1], fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const cannot = (why) => { process.stderr.write(`pulse-stamp: ${why}\n`); process.exitCode = CANNOT_CHECK; };
  if (args.length === 0) {
    console.log(stamp());
  } else if (args[0] !== '--check') {
    cannot(`unknown argument ${JSON.stringify(args[0])} — usage: pulse-stamp.mjs [--check <body file> <updated_at>]`);
  } else if (args.length !== 3) {
    cannot(`--check takes a body file and an updated_at, got ${args.length - 1} argument(s)`);
  } else {
    let body;
    try {
      body = readFileSync(args[1], 'utf8');
    } catch (e) {
      cannot(`cannot read ${args[1]}: ${e.message}`);
    }
    if (body !== undefined) {
      // #457: an uncaught throw here would exit 1 — the same code FINDING uses — so a bug in the tool would
      // read as a finding about the pulse rather than as the tool having failed to check it. Nothing today
      // makes check() throw (PR #450 proved the three verdicts red-before-green), so this is structural
      // hardening, not a reachable bug: route it to CANNOT_CHECK (exit 2) like every other way this CLI fails.
      try {
        const v = check(body, args[2]);
        if (v.code === CANNOT_CHECK) cannot(v.reason);
        else {
          console.log(`${v.ok ? 'ok' : 'FINDING'} — ${v.reason}`);
          process.exitCode = v.code;
        }
      } catch (e) {
        cannot(`check() threw: ${e.message}`);
      }
    }
  }
}
