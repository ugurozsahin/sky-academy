import { describe, it, expect, beforeEach } from 'vitest';
import { balance, buy, canBuy, equip, equippedItem, itemById, SHOP_ITEMS, type Wallet } from '../../src/game/shop';
import { addCoins, buyItem, coinBalance, equipItem, load, reset, wallet } from '../../src/storage';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

const w = (coins: number, extra: Partial<Wallet> = {}): Wallet => ({ coins, spent: 0, owned: [], equipped: {}, ...extra });
const gold = itemById('trail-gold')!;

describe('coin shop rules (#6)', () => {
  it('catalogue: unique ids, one free default per kind that has items, prices are whole coins', () => {
    expect(new Set(SHOP_ITEMS.map(i => i.id)).size).toBe(SHOP_ITEMS.length);
    for (const kind of new Set(SHOP_ITEMS.map(i => i.kind))) expect(SHOP_ITEMS.filter(i => i.kind === kind && i.price === 0).length).toBe(1);
    for (const i of SHOP_ITEMS) expect(Number.isInteger(i.price) && i.price >= 0).toBe(true);
  });
  it('balance is lifetime coins minus spent, never negative', () => {
    expect(balance(w(200, { spent: 150 }))).toBe(50);
    expect(balance(w(10, { spent: 30 }))).toBe(0);
  });
  it('canBuy: poor → ok → owned; unknown ids are refused', () => {
    expect(canBuy(w(gold.price - 1), gold.id)).toBe('poor');
    expect(canBuy(w(gold.price), gold.id)).toBe('ok');
    expect(canBuy(w(0), 'trail-element')).toBe('owned');          // free default is always owned
    expect(canBuy(w(999), 'trail-nope')).toBe('unknown');
  });
  it('buy spends without touching lifetime coins, equips the item, and cannot buy twice', () => {
    const r = buy(w(200), gold.id);
    expect(r.ok).toBe(true); expect(r.wallet.coins).toBe(200); expect(r.wallet.spent).toBe(gold.price);
    expect(r.wallet.owned).toEqual([gold.id]); expect(r.wallet.equipped.trail).toBe(gold.id);
    const again = buy(r.wallet, gold.id); expect(again.ok).toBe(false); expect(again.wallet).toBe(r.wallet);
    const poor = buy(w(10), gold.id); expect(poor.ok).toBe(false); expect(poor.wallet.spent).toBe(0);
  });
  it('equip only works for owned items; equippedItem falls back to the free default', () => {
    const base = w(0);
    expect(equip(base, gold.id)).toBe(base);                                     // not owned → unchanged
    expect(equippedItem(base, 'trail')?.id).toBe('trail-element');
    const owned = equip(w(0, { owned: [gold.id] }), gold.id); expect(owned.equipped.trail).toBe(gold.id);
    expect(equippedItem(owned, 'trail')?.trail?.color).toBe(gold.trail!.color);
    expect(equippedItem(equip(owned, 'trail-element'), 'trail')?.id).toBe('trail-element');   // switch back to the default
    expect(equippedItem(w(0, { equipped: { trail: gold.id } }), 'trail')?.id).toBe('trail-element');   // equipped but not owned (tampered save) → default
    expect(equippedItem(base, 'costume')).toBeUndefined();                       // no costumes in the catalogue yet
  });
});

describe('shop storage', () => {
  beforeEach(() => reset());
  it('old saves get an empty wallet; buying persists and keeps sticker unlocks', () => {
    mem['sna:v1'] = JSON.stringify({ v: 1, name: 'Old', coins: 200, stickers: ['volt', 'blaze', 'splash', 'terra'] });
    expect(wallet()).toEqual({ coins: 200, spent: 0, owned: [], equipped: {} });
    expect(coinBalance()).toBe(200);
    expect(buyItem(gold.id)).toBe(true);
    expect(coinBalance()).toBe(200 - gold.price); expect(load().coins).toBe(200); expect(load().stickers.length).toBe(4);
    expect(buyItem(gold.id)).toBe(false);
    expect(JSON.parse(mem['sna:v1']).owned).toEqual([gold.id]);
  });
  it('earning after spending raises the balance and still unlocks stickers from lifetime coins', () => {
    addCoins(210); expect(buyItem(gold.id)).toBe(true); expect(coinBalance()).toBe(10);   // lifetime 210, spent 200
    const fresh = addCoins(50); expect(fresh).toEqual(['gust']);             // lifetime 260 → the 250 sticker (5th), unaffected by spending
    expect(coinBalance()).toBe(60);
  });
  it('equipItem switches between owned items and refuses unowned ones', () => {
    expect(equipItem(gold.id)).toBe(false);
    addCoins(gold.price); buyItem(gold.id);
    expect(equipItem('trail-element')).toBe(true); expect(load().equipped.trail).toBe('trail-element');
    expect(equipItem(gold.id)).toBe(true); expect(load().equipped.trail).toBe(gold.id);
  });
});
