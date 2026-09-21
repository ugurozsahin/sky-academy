import { readFileSync } from 'node:fs';
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
 * Minutes the stamp runs **ahead of** the write that carried it. Negative is the healthy direction: the
 * clock was read, then the write landed. Minute truncation alone puts an honest stamp up to one minute
 * behind, so a small negative number is what correct looks like, never a problem.
 *
 * @param {string} body the pulse body as it was written
 * @param {string|number|Date} writtenAt GitHub's `updated_at` for that edit — the one field the writing run
 *   cannot author for itself, which is what makes this a check rather than a restatement.
 * @returns {number|null} signed minutes, or `null` when the body opens with no readable stamp.
 */
export function driftMinutes(body, writtenAt) {
  const s = readStamp(body);
  const w = new Date(writtenAt).getTime();
  return s === null || Number.isNaN(w) ? null : (s - w) / 60_000;
}

/**
 * How far ahead of its own write a stamp may sit before it is a finding. Not zero: the session host's clock
 * and GitHub's are two clocks, and a minute or two of skew between them is ordinary and says nothing about
 * how the stamp was produced. The drift this catches was 37 minutes.
 */
export const AHEAD_TOLERANCE_MIN = 2;

/**
 * @param {string} body the pulse body
 * @param {string|number|Date} writtenAt GitHub's `updated_at` for that edit
 * @returns {{ ok: boolean, drift: number|null, reason: string }} `ok: false` means a finding — say `reason`
 *   in the issue. A body with no readable stamp is a finding here too, for the reason
 *   `docs/WATCHDOG-PROMPT.md` already gives: an unparseable pulse is a stale one, never a pass.
 */
export function check(body, writtenAt) {
  const drift = driftMinutes(body, writtenAt);
  if (drift === null) return { ok: false, drift: null, reason: 'the body opens with no readable stamp' };
  const mins = Math.round(drift * 10) / 10;
  if (drift > AHEAD_TOLERANCE_MIN) {
    return { ok: false, drift: mins, reason: `the stamp is ${mins} min ahead of the write GitHub recorded — `
      + 'it was not read from a clock at write time, so every staleness check reading it is short by that much' };
  }
  return { ok: true, drift: mins, reason: mins <= 0 ? `${Math.abs(mins)} min behind its write, as it should be`
    : `${mins} min ahead, inside the ${AHEAD_TOLERANCE_MIN} min allowed for clock skew` };
}

// CLI, both halves:
//   `node scripts/pulse-stamp.mjs`                       prints the stamp to paste into a pulse body
//   `node scripts/pulse-stamp.mjs --check <file> <when>` compares a body against GitHub's `updated_at`,
//                                                        exiting 1 on a finding so a shell can branch on it.
// Import-safe: it runs only when this file is the entry point, so the unit rails import it untouched.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [flag, file, when] = process.argv.slice(2);
  if (flag === '--check') {
    const v = check(readFileSync(file, 'utf8'), when);
    console.log(`${v.ok ? 'ok' : 'FINDING'} — ${v.reason}`);
    if (!v.ok) process.exitCode = 1;
  } else {
    console.log(stamp());
  }
}
