// Reading and recording the certificate album and the duel history of the active profile.
import { load, save } from './store';
import { DUEL_CAP, fileCert, fileDuel, isCert, isDuel } from './album-checks';
import type { StoredCert, StoredDuel } from './shape';
/** Every certificate earned, most recently filed first. Tolerant of a hand-edited save. */
export function certificates(): StoredCert[] { const c = load().certs; return Array.isArray(c) ? c.filter(isCert) : []; }
/** Record the certificate a won mission earned. Returns the album as it now stands. */
export function recordCert(c: StoredCert): StoredCert[] {
  const certs = fileCert(certificates(), c);
  save({ certs }); return certs;
}
/**
 * Every duel played, most recent first. Tolerant of a hand-edited save, and capped the same as a fresh write
 * (#423 review item 6): `fileDuel` enforces `DUEL_CAP` going in, but a Restore or a hand-edited save can carry
 * more rows than that straight past it — 200 well-formed rows migrate and read back as 200, past the "last
 * few sessions" the docstring above argues for, until the next real match trims the list back down.
 *
 * Sorted by `at` descending, not just trusted to arrive that way (#423 review item 4): `fileDuel` only ever
 * prepends, so ordinary play keeps the list newest-first for free, but `at` is documented as "the list's order
 * and its only identity" while nothing enforced that — a Restore or a hand-edited save with rows out of `at`
 * order used to render under "Recent duels" in whatever order it arrived in, and the cap above used to keep
 * the first `DUEL_CAP` rows in storage order rather than the newest `DUEL_CAP` by `at`.
 */
export function duelHistory(): StoredDuel[] {
  const d = load().duels;
  return Array.isArray(d) ? d.filter(isDuel).sort((a, b) => b.at - a.at).slice(0, DUEL_CAP) : [];
}
/** Record a finished match. Returns the history as it now stands. */
export function recordDuel(d: StoredDuel): StoredDuel[] {
  const duels = fileDuel(duelHistory(), d);
  save({ duels }); return duels;
}
