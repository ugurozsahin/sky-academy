// Ninja Shop (#6): spend coins on skins. Infrastructure + one placeholder trail skin; every look goes to the owner for approval.
import { buyItem, coinBalance, equipItem, wallet } from '../storage';
import { canBuy, equippedItem, KIND_LABEL, SHOP_ITEMS, type ItemKind } from '../game/shop';
import { sfx, say } from '../audio';
import { $, $$, render } from './dom';
import type { Nav } from './home';

const KINDS: ItemKind[] = ['trail', 'bubble', 'decor', 'costume'];
const SOON: Record<ItemKind, string> = { trail: '', bubble: 'Cloud, lantern and scroll bubbles are being drawn', decor: 'Lanterns, flags and huts for your islands are on the way', costume: 'New outfits for every ninja are being painted' };

export function shopScreen(nav: Nav) {
  const w = wallet(); const bal = coinBalance();
  const sections = KINDS.map(kind => {
    const items = SHOP_ITEMS.filter(i => i.kind === kind); const eq = equippedItem(w, kind);
    const cards = items.map(it => {
      const state = canBuy(w, it.id); const on = eq?.id === it.id;
      const action = on ? '<span class="pill on">Using ✓</span>'
        : state === 'owned' ? `<button class="btn equip" data-equip="${it.id}">Use</button>`
        : `<button class="btn primary buy" data-buy="${it.id}" ${state === 'ok' ? '' : 'disabled'} aria-label="Buy ${it.name} for ${it.price} coins">Buy 🪙 ${it.price}</button>`;
      const swatch = it.trail ? `<i class="swatch" style="--c:${it.trail.color};--k:${it.trail.core}"></i>` : '';
      return `<div class="item${on ? ' on' : ''}${state === 'poor' ? ' poor' : ''}" data-item="${it.id}"><span class="icon">${it.icon}${swatch}</span><b>${it.name}</b><small>${it.blurb}</small>${action}</div>`;
    }).join('');
    return `<h3>${KIND_LABEL[kind]}</h3><div class="shop-grid">${cards}${SOON[kind] ? `<div class="item soon"><span class="icon">🎨</span><b>Coming soon</b><small>${SOON[kind]}</small></div>` : ''}</div>`;
  }).join('');
  render(`
  <section class="screen home shop">
    <div class="isl-head"><button class="icon-btn" id="back" aria-label="Back">←</button><div><b>Ninja Shop</b><small>Spend your coins on new looks — stickers stay yours</small></div><span class="coin-pill" id="balance" aria-label="${bal} coins to spend">🪙 <b>${bal}</b></span></div>
    ${sections}
  </section>`, 'bg-sky');
  $('#back').addEventListener('click', () => { sfx.tap(); nav.up(); });
  $$('[data-buy]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.buy!; const name = b.closest('.item')?.querySelector('b')?.textContent ?? 'it';
    if (buyItem(id)) { sfx.stage(); say(`You bought the ${name}!`, true); } else sfx.wrong();
    shopScreen(nav);
  }));
  $$('[data-equip]').forEach(b => b.addEventListener('click', () => { if (equipItem(b.dataset.equip!)) sfx.tap(); shopScreen(nav); }));
}
