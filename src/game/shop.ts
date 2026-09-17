// Coin shop (#6): the catalogue and the pure buy / equip rules. Coins are never taken away — `coins` stays the
// lifetime total (stickers unlock from it); spending adds to `spent`, and the balance is what is left to spend.
import { FX_COLORS, type FxKind } from './arena';

export type ItemKind = 'trail' | 'bubble' | 'decor' | 'costume';
export interface TrailSkin { color: string; core: string }          // slice-trail colours (glow + bright core)
// `fx` overrides the equipped avatar's own particle/sound effect (#69) — undefined = keep the avatar's element.
export interface ShopItem { id: string; kind: ItemKind; name: string; blurb: string; icon: string; price: number; trail?: TrailSkin; fx?: FxKind }
export interface Wallet { coins: number; spent: number; owned: string[]; equipped: Partial<Record<ItemKind, string>> }

export const KIND_LABEL: Record<ItemKind, string> = { trail: 'Slice trails', bubble: 'Bubble skins', decor: 'Island decorations', costume: 'Costumes' };

// One shop item per element trail (#69): colour *and* particle effect come from the same FX_COLORS the arena
// already draws, so a bought trail is never just a recolour of the avatar's own effect. `master` is the
// all-topics-starred reward (masterProgress()) and is deliberately never for sale.
const ELEMENT_TRAILS: { fx: FxKind; name: string; icon: string; blurb: string; price: number }[] = [
  { fx: 'fire', name: 'Fire Trail', icon: '🔥', blurb: 'Blazing embers trail behind your slice', price: 40 },
  { fx: 'water', name: 'Water Trail', icon: '💧', blurb: 'Cool droplets splash with every slice', price: 55 },
  { fx: 'electric', name: 'Electric Trail', icon: '⚡', blurb: 'Crackling sparks streak behind your slice', price: 70 },
  { fx: 'earth', name: 'Earth Trail', icon: '🪨', blurb: 'Rugged rock chips fly with every slice', price: 85 },
  { fx: 'wind', name: 'Wind Trail', icon: '🍃', blurb: 'Breezy leaves swirl behind your slice', price: 100 },
  { fx: 'ice', name: 'Ice Trail', icon: '❄️', blurb: 'Frosty crystals shimmer with every slice', price: 115 },
  { fx: 'light', name: 'Light Trail', icon: '💡', blurb: 'Golden sparkles light up your slice', price: 130 },
  { fx: 'shadow', name: 'Shadow Trail', icon: '🔮', blurb: 'Wisps of smoke curl behind your slice', price: 145 },
  { fx: 'blade', name: 'Blade Trail', icon: '⚔️', blurb: 'Sharp steel flashes with every slice', price: 160 },
  { fx: 'robot', name: 'Robot Trail', icon: '🤖', blurb: 'Pixel sparks flicker behind your slice', price: 175 },
];

/** Price 0 = everyone owns it (the default of its kind). Skins are code-drawn placeholders until the owner approves each look. */
export const SHOP_ITEMS: ShopItem[] = [
  { id: 'trail-element', kind: 'trail', name: 'Element Trail', blurb: "Your ninja's own element", icon: '✨', price: 0 },
  ...ELEMENT_TRAILS.map(({ fx, name, icon, blurb, price }): ShopItem => ({
    id: `trail-${fx}`, kind: 'trail', name, blurb, icon, price, fx,
    trail: { color: FX_COLORS[fx][0], core: FX_COLORS[fx][1] },
  })),
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
