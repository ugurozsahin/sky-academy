// Paying out coins, stickers and the Daily Dojo when a game ends.
import { applyEvent, dojoFor, type DojoEvent, type DojoOutcome, type DojoState } from '../game/dojo';
import { logGame, sanitizeSlips, type Slip } from '../save-records';
import { load, save } from './store';
import { evaluateStickers } from './stickers';
import { today } from './progress';
/** Add coins, return newly unlocked sticker ids (coin thresholds and any achievement the same play session
 * just satisfied — every mode records its own stats before calling this, so `d` already reflects them).
 *
 * **A results screen wants `recordGameEnd()` instead** (#365), and since it no caller in `src/` uses this: a
 * rail in `tests/unit/guardrails.test.ts` keeps `src/ui/` off both halves of the old pair. Kept for a caller
 * that pays coins with no finished game behind them, and used by `tests/unit/shop.test.ts` to seed a purse. */
export function addCoins(n: number): string[] {
  if (!Number.isFinite(n)) console.warn(`addCoins(${n}): non-finite amount — ignored`); const d = load(); const coins = d.coins + Math.max(0, Number.isFinite(n) ? n : 0);   // save() never sanitizes like migrate() does, and Math.max(0, NaN) is NaN (#797)
  const unlocked = evaluateStickers({ ...d, coins }); const fresh = unlocked.filter(id => !d.stickers.includes(id));
  save({ coins, stickers: unlocked });
  return fresh;
}
/** Today's dojo state (rolled over to a fresh day when needed — not persisted until something is recorded). */
export function dojoToday(now = new Date()): DojoState { return dojoFor(load().dojo, today(now)); }
/** Feed a finished game to the Daily Dojo. Persists the state; the caller pays out `coins` (so sticker unlocks show).
 *
 *  **A results screen wants `recordGameEnd()` instead** (#365): this and `addCoins()` back to back are two
 *  writes, and the pair has no rollback. Since #365 no caller in `src/` uses it: it is kept for one that
 *  genuinely records a dojo event and pays nothing for it, and `tests/unit/storage.test.ts` exercises it. */
export function recordDojo(e: DojoEvent, now = new Date()): DojoOutcome {
  const out = applyEvent(load().dojo, e, today(now));
  save({ dojo: out.state }); return out;
}
/** What a finished game settled: the dojo's own outcome, and the stickers the payout unlocked. */
export interface GameEndOutcome { dojo: DojoOutcome; fresh: string[] }
/**
 * Settle a finished game in **one** write: the Daily Dojo state, the coins it pays (the game's plus the
 * dojo's bonus) and the stickers that unlocks (#365).
 *
 * Every results screen used to call `recordDojo()` and then `addCoins()`, which is two `save()`s with nothing
 * tying them together. `save()` deliberately swallows a refused `setItem` rather than throwing (#151: a device
 * that cannot write must not brick the game), so neither caller could tell the second write had been dropped —
 * and the half-state it leaves is the bad one. **Coins are re-earnable; a completed challenge is not.** Write 1
 * had already put the challenge id into `dojo.done`, and `applyEvent()` only pays `!done.includes(c.id)`, so
 * on a day a child finished the set that is up to `CHALLENGE_BONUS * 3 + SET_BONUS` gone with no way back
 * before the day rolls over — while the overlay, built from the in-memory numbers, cheerfully showed the coins.
 *
 * One `load()`, one `save()`: the store either takes the whole finished game or none of it, so the half-state
 * is unreachable rather than merely unlikely. A refusal still leaves `writeFailed` for the grown-ups screen to
 * report, exactly as before — this closes the *inconsistency*, not the refusal (#151 stands).
 */
export function recordGameEnd(e: DojoEvent & { slips?: Omit<Slip, 'at'>[]; topics?: string[] }, gameCoins: number, now = new Date()): GameEndOutcome {
  if (!Number.isFinite(gameCoins)) console.warn(`recordGameEnd: non-finite gameCoins (${gameCoins}) — ignored`);   // same #797 guard as addCoins()
  const d = load(); const dojo = applyEvent(d.dojo, e, today(now));
  // `gameCoins`, not `coins`: every call site on `main` read `addCoins(paid + dojo.coins)`, so a maintainer
  // with that muscle memory would write `recordGameEnd(e, r.coins + dojo.coins)` and be paid the bonus twice,
  // with no type error and no test to catch it (round 2, note 4). The bonus is this function's to add.
  //
  // The clamp guards the game's own figure alone. Clamping the SUM would let a negative `gameCoins` cancel a
  // bonus the child earned rather than being refused on its own (round 2, note 2) — unreachable with today's
  // non-negative inputs, which is why it is a shape question rather than a bug.
  const total = d.coins + Math.max(0, Number.isFinite(gameCoins) ? gameCoins : 0) + dojo.coins;   // same #797 guard as addCoins()
  // The dojo's new state goes into the sticker evaluation too, so that an achievement reading dojo progress
  // WOULD see the day this game just moved — the old order gave it that (`addCoins`'s `load()` ran after
  // `recordDojo`'s `save()`) and a single `load()` would otherwise quietly lose it. Nothing reads it today:
  // no `ACHIEVEMENTS` entry touches `d.dojo` and `stickersFor` reads only coins, so withholding it is
  // undetectable by any test. Deliberate forward-compatibility, deliberately untested (round 2, note 1).
  const unlocked = evaluateStickers({ ...d, coins: total, dojo: dojo.state });
  const fresh = unlocked.filter(id => !d.stickers.includes(id));
  const slips = e.slips?.length ? sanitizeSlips([...e.slips.map(s => ({ ...s, at: today(now) })), ...d.slips]) : d.slips;   // #938: newest first, capped 20
  const asked = e.mode === 'memory' ? { q: 0, ok: 0 } : { q: e.attempts, ok: e.correct };   // #939: Memory's pairs and moves are not questions
  save({ dojo: dojo.state, coins: total, stickers: unlocked, slips, log: logGame(d.log, today(now), { ...asked, topics: e.topics }) });
  return { dojo, fresh };
}
