// The certificate album and the duel history as pure data: the field guards that keep a hand-edited save from
// taking an album down, and the filing rules.
// Type-only plus one small runtime tuple (#423 review item 1): no runtime edge back into duel.ts's own import of this.
import { DUEL_OUTCOMES, type DuelOutcome } from '../game/duel';
import { checkFields, count, fin, str, strOrNull, type Fields } from '../save-records';
import type { StoredCert, StoredDuel } from './shape';
/** Certificate album cap. Far above the mission count, so it only ever trims a hand-edited or imported save. */
export const CERT_CAP = 60;
// A stored certificate has to survive a hand-edited save without taking the album down with it. Still not
// #174's full validator — it checks types, not values — but it checks **every field an entry is used
// through**, because a half-checked entry is worse than an unchecked one here: `{ id, title }` alone passed
// an earlier version of this guard, and then `fileCert`'s `c.stars > prev.stars` compared a real 3 against
// `undefined`, which is `false`, so the junk entry won every comparison and a child who had genuinely earned
// three stars could never be given that certificate. A guard that lets a partial object through does not
// merely fail to help; it manufactures a `prev` that beats everything. `avatar` used to be the one exception
// to "every field" — `avatarById()` reads it (`ui/certificate.ts`) but nothing here checked it, so a
// hand-edited `avatar: 7` reached the album and was saved only by `avatarById()`'s own fallback, in a
// different file, rather than by this guard (#422).
//
// `training`/`duel` are the two fields that stay deliberately unchecked — see `certKind()`'s comment in
// `ui/certificate.ts`: rejecting a malformed flag here would drop a certificate a child genuinely earned,
// which is worse than `certKind()` misreading which kind it was earned for.
type CheckedCertFields = Omit<StoredCert, 'training' | 'duel'>;
const CERT_FIELDS: Fields<CheckedCertFields> = {
  id: str, name: str, avatar: strOrNull, year: str, title: str,
  stars: fin, score: fin, correct: fin, attempts: fin, date: str,
};
export const isCert = (c: unknown): c is StoredCert => {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  return checkFields(CERT_FIELDS, c as Record<string, unknown>);
};
/**
 * File a certificate into the album (pure). One entry per mission (`c.id`) — replaying a mission does not earn
 * a second award for it — and the entry kept is the **best** run, not simply the newest: a child who plays a
 * three-star mission again and does worse must not lose the certificate they earned, which is the one outcome
 * a reward has to rule out. Better = more stars, then a higher score; an equal run replaces the old one, so the
 * name and avatar follow a child who has since changed either. The kept entry moves to the front either way, so
 * the album reads most recently earned first. Capped at `cap`, oldest dropped.
 */
export function fileCert(list: StoredCert[], c: StoredCert, cap = CERT_CAP): StoredCert[] {
  const prev = list.find(x => x.id === c.id);
  const better = !prev || (c.stars !== prev.stars ? c.stars > prev.stars : c.score >= prev.score);
  return [better ? c : prev, ...list.filter(x => x.id !== c.id)].slice(0, Math.max(0, cap));
}
/**
 * Duel history cap (#16). Deliberately far smaller than `CERT_CAP`: a certificate is a *reward*, one per
 * mission and kept for good, while a duel is an afternoon's play — two children can finish ten matches in
 * half an hour, and a list that keeps all of them is a list nobody scrolls. Twenty is "the last few
 * sessions", and the oldest fall off the end.
 */
export const DUEL_CAP = 20;
/**
 * Every field a duel row is read through, checked — the same bar `isCert` is held to, and for the reason its
 * comment gives: a half-checked entry is worse than an unchecked one, because the junk it lets through then
 * gets compared, formatted and drawn as if it were real. `winner` is checked against the three values the
 * screen knows, because `duelHistoryLine()` branches on it and an unknown fourth would render as a match
 * nobody won — checked against `DUEL_OUTCOMES` rather than three hand-written literals, so a member added to
 * or dropped from `DuelOutcome` cannot leave this guard silently admitting or rejecting the old set (#423
 * review item 1). The two scores and `rounds` are counts, not just numbers (#423 review item 7): a negative
 * or fractional value is type-correct and still nonsense — `scoreB: -5` or `rounds: 1.5` passed this guard
 * before and rendered as-is. `at` stays on bare finiteness; it is a timestamp, not a count.
 */
const isWinner = (v: unknown): v is DuelOutcome => (DUEL_OUTCOMES as readonly unknown[]).includes(v);
const DUEL_FIELDS: Fields<StoredDuel> = {
  at: fin, topic: str, title: str, year: str, winner: isWinner, scoreA: count, scoreB: count, rounds: count,
};
export const isDuel = (d: unknown): d is StoredDuel => {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
  return checkFields(DUEL_FIELDS, d as Record<string, unknown>);
};
/**
 * File a finished duel into the history (pure). **Every match is its own row**, which is the one way this
 * differs from `fileCert` and is deliberate: a certificate is an award for a mission, so replaying that
 * mission must not earn a second one, but a duel is an event — two children who play the same topic five
 * times want to see five matches, not one that keeps being rewritten. So there is no "better run" comparison
 * and nothing to deduplicate; the newest goes to the front and the list is capped at `cap`, oldest dropped.
 */
export function fileDuel(list: StoredDuel[], d: StoredDuel, cap = DUEL_CAP): StoredDuel[] {
  return [d, ...list].slice(0, Math.max(0, cap));
}
