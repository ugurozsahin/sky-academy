// What the picker draws for a profile that is not this session's: read from the slot, never through load().
import { ownedTitleId } from '../game/shop';
import type { RawSave } from './shape';
import { profileIds, readItem, saveKeyFor, type ProfileId } from './profile-index';
import { isFutureSave, isMigratable, onboardedOf } from './migrate';
/**
 * Whether a slot holds a save a **newer build** wrote — the one home of that question about a profile that is
 * not this session's (#420 review B2). `isFutureSave`'s own rule, applied to a slot instead of to the blob
 * `load()` just read, so `deleteProfile` and `profileCard` cannot come to different answers about the same
 * bytes. Deliberately narrower than `!isMigratable`: an unreadable `v` is *not* protected — `load()` resets
 * over it and writes resume on purpose — so only a genuinely newer save refuses a delete.
 */
export function futureSaveIn(id: ProfileId): boolean {
  const raw = readItem(saveKeyFor(id));
  if (!raw) return false;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return false; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  return isFutureSave(parsed as RawSave);
}
/**
 * A discriminated union, not a flat `{ future: boolean; corrupt: boolean }` (#431 review, item 2). The flat
 * shape let a consumer read `.onboarded`/`.avatar`/`.name` on a blank card without ever checking `future` or
 * `corrupt` first — `src/ui/profiles.ts`'s picker did exactly that, drawing a newer-build or unreadable slot
 * as "Ninja 2 / Not started yet" and keeping it tappable, the same conflation the grown-ups row was fixed for
 * in #420/#431 one screen over. With the fields only present on the `'save'` arm, that read is a compile
 * error instead of a silent wrong label, and `canRenameCard` collapses to a state check rather than a
 * negated flag.
 *
 * - `'empty'` — no save behind the slot at all: never written, or bytes this build cannot even parse as JSON.
 * - `'future'` — the slot holds a save a **newer build** wrote. Neither the name nor the ninja can be shown —
 *   they are fields this build cannot read — and a screen must say *why* it is blank rather than claiming the
 *   ninja never played (#420 review B2).
 * - `'corrupt'` — bytes with an unreadable `v` (#431 review, item 3): a real save this build cannot parse the
 *   version of, deliberately *not* `'future'`, since `load()` resets over it and a delete is allowed to take
 *   the slot back. A different reason to be blank than "never played" or "saved by a newer version".
 * - `'save'` — a save this build can read; the only arm carrying `name`/`avatar`/`onboarded`.
 */
export type ProfileCard =
  | { id: ProfileId; state: 'empty' }
  | { id: ProfileId; state: 'future' }
  | { id: ProfileId; state: 'corrupt' }
  | { id: ProfileId; state: 'save'; name: string; avatar: string | null; onboarded: boolean; title: string | null };
/**
 * Name and ninja for a profile that is **not** the one this session is playing — what the picker draws on a
 * card. Deliberately not `load()`: that resolves the session's own profile and caches it, so reading a
 * sibling's save through it would either answer the wrong child or latch the session onto them.
 *
 * Read-only and tolerant by design. It takes the two fields a card shows and nothing else, so a save from an
 * older version, a hand-edited one, or a blob that is not an object at all yields a card with an empty name
 * and no ninja — which the picker renders as an un-onboarded slot — instead of throwing on the first screen a
 * child sees. Nothing here writes, so drawing the picker cannot migrate or damage a save.
 *
 * It does not *run* the migrations, but it applies `MIGRATIONS[2]`'s rule for `onboarded` rather than reading
 * the field raw. A v2 blob has no such field, `load()` derives it and deliberately does not write it back,
 * and nothing on `boot → map → 👥` calls `save()` — so on the first launch after an upgrade a fully-played
 * child's card said "Not started yet" while `load()` answered `onboarded: true` for the very same save
 * (#380 review B3). The rule is `onboardedOf` below and both sites call it, so the two cannot drift.
 *
 * It also applies `load()`'s **version gate** before any of that (#380 review B2). `migrate()` answers
 * `{ ...DEFAULT }` for anything `isMigratable` rejects — a blob from a newer build, or an unreadable `v` —
 * so a card that read those fields raw drew "Bo — Blaze Ninja" for a save this build cannot open, and the
 * tap that followed put Bo in the first-run wizard with `readOnly` latched and every write silently
 * dropped. Answering `blank` is the honest version of that card: "Not started yet" is at least what tapping
 * it gives. Saying *why* on the card is #232's `isReadOnlySave` hook, and is not this slice's.
 */
export function profileCard(id: ProfileId): ProfileCard {
  const raw = readItem(saveKeyFor(id));
  if (!raw) return { id, state: 'empty' };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { id, state: 'empty' }; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { id, state: 'empty' };
  const s = parsed as RawSave;
  // the card agrees with load(), which refuses this blob: `future` for a newer build's save, `corrupt` for
  // everything else `!isMigratable` covers — a `v` no build ever wrote.
  if (!isMigratable(s)) return { id, state: isFutureSave(s) ? 'future' : 'corrupt' };
  return {
    id,
    state: 'save',
    name: typeof s.name === 'string' ? s.name : '',
    avatar: typeof s.avatar === 'string' ? s.avatar : null,
    onboarded: onboardedOf(s), title: ownedTitleId((s.equipped as Record<string, unknown> | undefined)?.title, s.owned),
  };
}
/** Every profile on this device as a card, in slot order — the picker's whole data source.
 *
 *  `readonly`, matching `profileIds()` (#384 item 1): the array is the caller's copy of parsed state and
 *  pushing to it changed nothing, the same shape #335 item 5 fixed on `profileIds()` one function up — the
 *  two answered the same question about mutability differently until now. */
export const profileCards = (): readonly ProfileCard[] => profileIds().map(profileCard);
