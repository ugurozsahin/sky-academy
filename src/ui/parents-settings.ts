// The grown-ups Settings section (#904): today just the 3-D pictures control, moved out of parents.ts (at its
// #714 ratchet cap) under one "Settings" heading so #905/#906/#907/#940 each have room to add their own row.
import { setThreeSetting, THREE_SETTINGS, threeSetting, type ThreeSetting } from '../device-settings';
import { sfx } from '../audio';
import { $, $$ } from './dom';

export const THREE_LABEL: Readonly<Record<ThreeSetting, string>> = { auto: 'Auto', on: 'On', off: 'Off' };

/** The Settings section's markup — today just the 3-D pictures control. */
export function settingsHTML(three: ThreeSetting = threeSetting()): string {
  return `
    <h3 class="p-h">Settings</h3>
    <div class="p-three">
      <p class="p-three-say">Some shapes can be drawn as solid 3-D models. <b>Auto</b> turns them on when this device can manage it; <b>Off</b> keeps every picture flat.</p>
      <div class="tabs p-three-pick" role="radiogroup" aria-label="3-D pictures">${THREE_SETTINGS.map(v =>
        `<button class="tab${v === three ? ' on' : ''}" data-three="${v}" role="radio" aria-checked="${v === three}">${THREE_LABEL[v]}</button>`).join('')}</div>
      <p class="p-three-msg" id="three-msg" role="status" hidden></p>
    </div>`;
}

/** Wire the Settings section's controls — today just the 3-D pictures tabs. */
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
}
