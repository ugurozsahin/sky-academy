// The grown-ups Settings section (#904): the 3-D pictures control plus the per-ninja "Slower bubbles" row
// (#905), under one "Settings" heading so #906/#907/#940 each have room to add their own row.
import { setThreeSetting, THREE_SETTINGS, threeSetting, type ThreeSetting } from '../device-settings';
import { sfx } from '../audio';
import { isWriteFailing, load, save } from '../storage';
import { $, $$ } from './dom';

export const THREE_LABEL: Readonly<Record<ThreeSetting, string>> = { auto: 'Auto', on: 'On', off: 'Off' };
const SLOW_LABEL: Readonly<Record<'off' | 'on', string>> = { off: 'Off', on: 'On' };

/** The Settings section's markup: the 3-D pictures control, then "Slower bubbles" (#905). */
export function settingsHTML(three: ThreeSetting = threeSetting(), slow: boolean = load().settings.slow): string {
  return `
    <h3 class="p-h">Settings</h3>
    <div class="p-three">
      <p class="p-three-say">Some shapes can be drawn as solid 3-D models. <b>Auto</b> turns them on when this device can manage it; <b>Off</b> keeps every picture flat.</p>
      <div class="tabs p-three-pick" role="radiogroup" aria-label="3-D pictures">${THREE_SETTINGS.map(v =>
        `<button class="tab${v === three ? ' on' : ''}" data-three="${v}" role="radio" aria-checked="${v === three}">${THREE_LABEL[v]}</button>`).join('')}</div>
      <p class="p-three-msg" id="three-msg" role="status" hidden></p>
    </div>
    <div class="p-three p-slow">
      <p class="p-three-say">Some children can read the answer but need longer to slice it. <b>On</b> flies every bubble one step slower for this ninja.</p>
      <div class="tabs p-slow-pick" role="radiogroup" aria-label="Slower bubbles">${(['off', 'on'] as const).map(v =>
        `<button class="tab${(v === 'on') === slow ? ' on' : ''}" data-slow="${v}" role="radio" aria-checked="${(v === 'on') === slow}">${SLOW_LABEL[v]}</button>`).join('')}</div>
      <p class="p-three-msg" id="slow-msg" role="status" hidden></p>
    </div>`;
}

/** Wire the Settings section's controls: the 3-D pictures tabs, then "Slower bubbles" (#905). */
export function bindSettings(): void {
  // #714: the 3-D setting. Patched in place rather than redrawn — nothing else on the screen reads it — and
  // written through `src/storage.ts`; `src/three/mount/enabled.ts` reads it the next time a mount point asks.
  // Painted from what the store holds after the write, never from the tap: a refused write (private mode, a
  // full store) would otherwise show Off selected while the device stays on Auto (silent-failure review).
  $$('button[data-three]').forEach(b => b.addEventListener('click', () => {
    sfx.tap();
    const stored = setThreeSetting(b.dataset.three as ThreeSetting);
    const now = threeSetting();
    $$('button[data-three]').forEach(o => { const on = o.dataset.three === now; o.classList.toggle('on', on); o.setAttribute('aria-checked', String(on)); });
    const msg = $('#three-msg');
    msg.hidden = stored;
    if (!stored) { sfx.wrong(); msg.textContent = `This device would not save that, so it stays on ${THREE_LABEL[now]}.`; }
  }));
  // #905: per-ninja, kept in the save rather than the device. Unlike `setThreeSetting()`, `save()` always
  // updates its in-memory cache (which `load()` then returns) even when the underlying write is refused
  // (private mode, a full store) — it only ever latches `isWriteFailing()`, with nothing lower-level left to
  // re-read a "true" prior value from. So this session's own gameplay (`d.settings.slow` in play.ts, reading
  // the same cache) genuinely does honour the tap either way; what a refused write threatens is only whether
  // the choice survives a reload, which `#three-msg`'s sibling message below makes visible rather than silent
  // (silent-failure review) — the same shape `parents.ts`'s page-level `saveNote()` banner already uses for
  // every other `save()` call in this file, just surfaced right where the tap happened.
  $$('button[data-slow]').forEach(b => b.addEventListener('click', () => {
    sfx.tap();
    const slow = b.dataset.slow === 'on';
    save({ settings: { ...load().settings, slow } });
    $$('button[data-slow]').forEach(o => { const on = (o.dataset.slow === 'on') === slow; o.classList.toggle('on', on); o.setAttribute('aria-checked', String(on)); });
    const msg = $('#slow-msg');
    const failed = isWriteFailing();
    msg.hidden = !failed;
    if (failed) { sfx.wrong(); msg.textContent = `This device is not saving right now, so this choice may be lost when the game closes.`; }
  }));
}
