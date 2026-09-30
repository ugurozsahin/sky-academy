// The shop's side of the save: the purse, buying and equipping.
import { balance, buy, equip, type Wallet } from '../game/shop';
import { load, save } from './store';
import { state } from './state';
/** The spendable part of the save. */
export function wallet(): Wallet { const d = load(); return { coins: d.coins, spent: d.spent || 0, owned: Array.isArray(d.owned) ? d.owned : [], equipped: d.equipped ?? {} }; }   // tolerant of hand-edited saves
export const coinBalance = () => balance(wallet());
/**
 * Buy (and equip) a shop item. Returns false when it is already owned, unknown or too dear — and also when the
 * purchase could not be kept (#151): the shop is the one screen that must not lie, because it takes coins.
 * Rolled back rather than left in `cache` for the rest of the session, so a false return means what it says —
 * nothing changed — instead of a purchase that plays back correctly until the next reload silently drops it.
 */
export function buyItem(id: string): boolean {
  const r = buy(wallet(), id); if (!r.ok) return false;
  const before = load();
  save({ spent: r.wallet.spent, owned: r.wallet.owned, equipped: r.wallet.equipped });
  if (state.readOnly || state.writeFailed) { state.cache = before; return false; }
  return true;
}
/** Equip an owned item. Returns false when nothing changed, or when the choice could not be kept (#151, same
 *  reasoning as buyItem — rolled back rather than shown as equipped for a session that will forget it). */
export function equipItem(id: string): boolean {
  const w = wallet(); const next = equip(w, id); if (next === w) return false;
  const before = load();
  save({ equipped: next.equipped });
  if (state.readOnly || state.writeFailed) { state.cache = before; return false; }
  return true;
}
