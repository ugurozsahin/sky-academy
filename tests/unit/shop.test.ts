import { describe, it, expect, beforeEach } from 'vitest';
import { balance, buy, canBuy, equip, equippedItem, itemById, SHOP_ITEMS, type Wallet } from '../../src/game/shop';
import { addCoins, buyItem, coinBalance, equipItem, isWriteFailing, load, reset, wallet } from '../../src/storage';

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
  it('element trails (#69): every element is buyable, master is never for sale, colour+fx come from the same source, prices form a ladder', () => {
    const trails = SHOP_ITEMS.filter(i => i.kind === 'trail');
    const elements = ['fire', 'water', 'electric', 'earth', 'wind', 'ice', 'light', 'shadow', 'blade', 'robot'];
    for (const el of elements) {
      const it = itemById(`trail-${el}`);
      expect(it, `trail-${el} must exist`).toBeDefined();
      expect(it!.fx).toBe(el);
      expect(it!.trail?.color).toBeTruthy();
      expect(it!.trail?.core).toBeTruthy();
    }
    expect(trails.some(i => i.fx === 'master')).toBe(false);           // the all-topics reward is never for sale
    expect(itemById('trail-element')!.fx).toBeUndefined();             // the free default keeps the avatar's own element
    const prices = trails.map(i => i.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));         // strictly the ladder the owner asked for
    expect(new Set(prices).size).toBe(prices.length);                  // no two trails share a price
    const paid = prices.filter(p => p > 0);
    expect(paid[0]).toBeGreaterThan(0);                                 // the cheapest paid trail is still a real price
    expect(Math.max(...paid)).toBe(itemById('trail-gold')!.price);     // gold stays the premium item at the top
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
  it('earning after spending raises the balance without unlocking more coin stickers, and spending never touches sticker unlocks (#114)', () => {
    addCoins(210); expect(buyItem(gold.id)).toBe(true); expect(coinBalance()).toBe(10);   // lifetime 210, spent 200 — already past all three coin stickers
    const fresh = addCoins(50); expect(fresh).toEqual([]);                  // lifetime 260 — the rest of the album is earned, not bought (#114)
    expect(coinBalance()).toBe(60);
    expect(load().stickers).toEqual(['volt', 'blaze', 'splash']);           // only the coin-tier three, unaffected by spending or by coins climbing further
  });
  it('equipItem switches between owned items and refuses unowned ones', () => {
    expect(equipItem(gold.id)).toBe(false);
    addCoins(gold.price); buyItem(gold.id);
    expect(equipItem('trail-element')).toBe(true); expect(load().equipped.trail).toBe('trail-element');
    expect(equipItem(gold.id)).toBe(true); expect(load().equipped.trail).toBe(gold.id);
  });
  it('buying all ten element trails never costs a single sticker — coins stay lifetime, only spent grows (#69)', () => {
    const trails = SHOP_ITEMS.filter(i => i.kind === 'trail' && i.price > 0);
    const total = trails.reduce((sum, i) => sum + i.price, 0);
    addCoins(total + 30);                                              // 30 past every trail's cost, past the first coin sticker (30)
    const stickersBeforeSpending = load().stickers.length;
    for (const it of trails) expect(buyItem(it.id)).toBe(true);
    expect(load().coins).toBe(total + 30);                             // lifetime total is untouched by spending
    expect(load().spent).toBe(total);
    expect(load().stickers.length).toBe(stickersBeforeSpending);       // spending ten trails unlocked no new sticker and lost none
    expect(load().owned.sort()).toEqual(trails.map(i => i.id).sort());
  });

  // #151: buyItem() used to return true off the in-memory patch alone, so a purchase `save()` could not
  // actually keep still played the "bought" sound and line, took the coins in this session, and vanished on
  // the next launch with nothing telling the child or the grown-up it never happened. The shop is the one
  // screen that must not lie, because it takes coins.
  it('buyItem() reports failure and rolls back when the write does not land, instead of a purchase that will vanish', () => {
    addCoins(gold.price);
    const realSet = localStorage.setItem;
    (localStorage as unknown as { setItem: unknown }).setItem = () => { throw new Error('quota'); };
    let bought: boolean;
    try { bought = buyItem(gold.id); } finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
    expect(bought, 'the write failed, so the purchase must not be reported as made').toBe(false);
    expect(isWriteFailing()).toBe(true);
    expect(load().owned, 'rolled back — never left half-applied in cache').toEqual([]);
    expect(load().spent, 'the coins were not actually spent').toBe(0);
    expect(coinBalance(), 'the child still has the coins to spend once the browser recovers').toBe(gold.price);

    // …and once the browser can write again, the same purchase goes through normally.
    expect(buyItem(gold.id), 'the underlying purchase itself was never the problem').toBe(true);
    expect(load().owned).toEqual([gold.id]);
  });

  it('equipItem() reports failure and rolls back when the write does not land', () => {
    addCoins(gold.price); buyItem(gold.id);           // buying equips gold; switch back to the free default first
    equipItem('trail-element');
    const realSet = localStorage.setItem;
    (localStorage as unknown as { setItem: unknown }).setItem = () => { throw new Error('quota'); };
    let equipped: boolean;
    try { equipped = equipItem(gold.id); } finally { (localStorage as unknown as { setItem: unknown }).setItem = realSet; }
    expect(equipped, 'the write failed, so the switch must not be reported as kept').toBe(false);
    expect(load().equipped.trail, 'still showing whichever trail was equipped before the failed attempt').toBe('trail-element');
  });
});
