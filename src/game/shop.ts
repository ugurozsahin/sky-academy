// Coin shop (#6): the catalogue and the pure buy / equip rules. Coins are never taken away — `coins` stays the
// lifetime total (stickers unlock from it); spending adds to `spent`, and the balance is what is left to spend.
export type ItemKind = 'trail' | 'bubble' | 'decor' | 'costume';
export interface TrailSkin { color: string; core: string }          // slice-trail colours (glow + bright core)
export interface ShopItem { id: string; kind: ItemKind; name: string; blurb: string; icon: string; price: number; trail?: TrailSkin }
export interface Wallet { coins: number; spent: number; owned: string[]; equipped: Partial<Record<ItemKind, string>> }

export const KIND_LABEL: Record<ItemKind, string> = { trail: 'Slice trails', bubble: 'Bubble skins', decor: 'Island decorations', costume: 'Costumes' };

/** Price 0 = everyone owns it (the default of its kind). Skins are code-drawn placeholders until the owner approves each look. */
export const SHOP_ITEMS: ShopItem[] = [
  { id: 'trail-element', kind: 'trail', name: 'Element Trail', blurb: "Your ninja's own element", icon: '✨', price: 0 },
  { id: 'trail-gold', kind: 'trail', name: 'Golden Trail', blurb: 'A shimmering gold slice', icon: '🌟', price: 200, trail: { color: '#ffd23a', core: '#fff6c4' } },
];

export const itemById = (id: string) => SHOP_ITEMS.find(i => i.id === id);
export const balance = (w: Wallet) => Math.max(0, w.coins - w.spent);
export const owns = (w: Wallet, id: string) => { const it = itemById(id); return !!it && (it.price === 0 || w.owned.includes(id)); };

export type BuyCheck = 'ok' | 'owned' | 'poor' | 'unknown';
export function canBuy(w: Wallet, id: string): BuyCheck {
  const it = itemById(id);
  if (!it) return 'unknown';
  if (owns(w, id)) return 'owned';
  return balance(w) >= it.price ? 'ok' : 'poor';
}
/** Buy and equip in one go (a child who buys a skin wants to see it). Returns the unchanged wallet when the purchase is not allowed. */
export function buy(w: Wallet, id: string): { ok: boolean; wallet: Wallet } {
  if (canBuy(w, id) !== 'ok') return { ok: false, wallet: w };
  const it = itemById(id)!;
  return { ok: true, wallet: equip({ ...w, spent: w.spent + it.price, owned: [...w.owned, id] }, id) };
}
/** Equip an owned item of its kind; unknown or unowned items leave the wallet unchanged. */
export function equip(w: Wallet, id: string): Wallet {
  const it = itemById(id);
  if (!it || !owns(w, id)) return w;
  return { ...w, equipped: { ...w.equipped, [it.kind]: id } };
}
/** The equipped item of a kind — falls back to the kind's free default (or nothing when the kind has no items yet). */
export function equippedItem(w: Wallet, kind: ItemKind): ShopItem | undefined {
  const id = w.equipped[kind];
  const it = id ? itemById(id) : undefined;
  return it && owns(w, it.id) ? it : SHOP_ITEMS.find(i => i.kind === kind && i.price === 0);
}
